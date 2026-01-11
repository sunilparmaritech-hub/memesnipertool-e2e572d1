import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useNotifications } from '@/hooks/useNotifications';
import { useAppMode } from '@/contexts/AppModeContext';

export interface TokenData {
  address: string;
  name: string;
  symbol: string;
  chain: string;
  liquidity: number;
  liquidityLocked: boolean;
  lockPercentage: number | null;
  buyerPosition: number | null;
  riskScore: number;
  categories: string[];
  priceUsd?: number;
}

export interface SnipeDecision {
  token: TokenData;
  approved: boolean;
  reasons: string[];
  tradeParams: {
    amount: number;
    slippage: number;
    priority: string;
  } | null;
}

export interface ExecutedTrade {
  token: string;
  txId?: string;
  error?: string;
  positionId?: string;
}

export interface AutoSniperResult {
  decisions: SnipeDecision[];
  executedTrades: ExecutedTrade[];
  summary: {
    total: number;
    approved: number;
    rejected: number;
    executed: number;
    openPositions: number;
    maxPositions: number;
  };
  settings: {
    minLiquidity: number;
    priority: string;
    categoryFilters: string[];
    profitTakePercent: number;
    stopLossPercent: number;
  };
  timestamp: string;
}

export function useAutoSniper() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AutoSniperResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const { addNotification } = useNotifications();
  const { mode } = useAppMode();
  
  // Demo mode guard
  const isDemo = mode === 'demo';
  
  // Ref to prevent concurrent evaluations
  const evaluatingRef = useRef(false);
  // Last evaluation timestamp
  const lastEvalRef = useRef(0);

  const evaluateTokens = useCallback(async (
    tokens: TokenData[],
    executeOnApproval: boolean = false,
    onTradeExecuted?: () => void
  ): Promise<AutoSniperResult | null> => {
    // Prevent concurrent evaluations
    if (evaluatingRef.current) {
      console.log('Auto-sniper evaluation already in progress, skipping...');
      return null;
    }

    // Throttle: minimum 20 seconds between runs
    const now = Date.now();
    if (now - lastEvalRef.current < 20000) {
      console.log('Auto-sniper throttled, too soon since last run');
      return null;
    }

    evaluatingRef.current = true;
    lastEvalRef.current = now;
    setLoading(true);
    setError(null);

    try {
      // Demo mode guard - don't call real API
      if (isDemo) {
        console.log('[Demo Guard] Skipping real auto-sniper API call in demo mode');
        evaluatingRef.current = false;
        setLoading(false);
        return null;
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Please sign in to use the auto-sniper');
      }

      console.log(`Auto-sniper evaluating ${tokens.length} tokens, executeOnApproval: ${executeOnApproval}`);

      const { data, error: fnError } = await supabase.functions.invoke('auto-sniper', {
        body: { tokens, executeOnApproval },
      });

      if (fnError) throw fnError;

      if (data.error) {
        throw new Error(data.error);
      }

      setResult(data);
      
      const approved = data.summary?.approved || 0;
      const executed = data.summary?.executed || 0;
      const executedTrades = data.executedTrades || [];
      
      // Send notifications for each executed trade
      if (executeOnApproval && executed > 0) {
        executedTrades.forEach((trade: ExecutedTrade) => {
          if (!trade.error) {
            // Send toast notification
            toast({
              title: '🎯 Trade Executed!',
              description: `Bought ${trade.token} - Position opened`,
            });
            
            // Add to notification center
            addNotification({
              title: `Trade Executed: ${trade.token}`,
              message: `Auto-sniper bought ${trade.token}. Position ID: ${trade.positionId?.slice(0, 8) || 'N/A'}`,
              type: 'trade',
              metadata: {
                token: trade.token,
                txId: trade.txId,
                positionId: trade.positionId,
                settings: data.settings,
              },
            });
          } else {
            // Notify about failed trade
            addNotification({
              title: `Trade Failed: ${trade.token}`,
              message: trade.error,
              type: 'error',
            });
          }
        });

        // Notify parent to refresh positions
        if (onTradeExecuted) {
          onTradeExecuted();
        }
      } else if (approved > 0 && !executeOnApproval) {
        toast({
          title: 'Snipe Opportunities Found',
          description: `${approved} token(s) passed all rules. Enable auto-trading to execute.`,
        });
      }

      return data;
    } catch (err: any) {
      const message = err.message || 'Failed to evaluate tokens';
      setError(message);
      console.error('Auto-sniper error:', err);
      toast({
        title: 'Auto-Sniper Error',
        description: message,
        variant: 'destructive',
      });
      return null;
    } finally {
      setLoading(false);
      evaluatingRef.current = false;
    }
  }, [toast, addNotification]);

  const clearResult = useCallback(() => {
    setResult(null);
    setError(null);
  }, []);

  return {
    loading,
    result,
    error,
    evaluateTokens,
    clearResult,
  };
}
