import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useNotifications } from '@/hooks/useNotifications';
import { useAppMode } from '@/contexts/AppModeContext';
import { addBotLog } from '@/components/scanner/BotActivityLog';
import { useSolPrice } from '@/hooks/useSolPrice';
import { 
  preExecutionGate, 
  batchPreExecutionGate, 
  filterExecutableTokens,
  type PreExecutionGateInput,
  type GateDecision,
  type GateActivityLogEntry,
} from '@/lib/preExecutionGate';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';

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
  // Scanner validation flags - CRITICAL for trade execution
  isPumpFun?: boolean;      // True if on Pump.fun bonding curve
  isTradeable?: boolean;    // True if scanner verified tradability
  canBuy?: boolean;         // True if buy is possible
  canSell?: boolean;        // True if sell is possible
  source?: string;          // API source (e.g., 'Pump.fun', 'DexScreener')
  safetyReasons?: string[]; // Array of safety check results
  // Gate-critical fields from scanner
  poolCreatedAt?: string;   // ISO string from scanner
  freezeAuthority?: string | null;
  mintAuthority?: string | null;
  holders?: number;
  holderCount?: number;
  deployerWallet?: string | null;
  lpMintAddress?: string | null;
  creatorAddress?: string | null;
  lpLockedPercent?: number | null;
  rugcheckTopHolders?: { address: string; pct: number }[];
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
  gateResults?: Array<{ token: string; decision: GateDecision }>; // Pre-execution gate results
  summary: {
    total: number;
    approved: number;
    rejected: number;
    executed: number;
    openPositions: number;
    maxPositions: number;
    gateBlocked?: number;  // Tokens blocked by pre-execution gate
    gateExecutable?: number; // Tokens that passed gate
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

export interface EvaluateTokensOptions {
  /**
   * When true, do not show the "Enable auto-trading" / opportunities toast.
   * Useful when the caller handles execution (e.g., wallet-signing flow) and will
   * show its own UX.
   */
  suppressOpportunityToast?: boolean;
}

export function useAutoSniper() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AutoSniperResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Accumulated gate results across all evaluation cycles
  const accumulatedGateResultsRef = useRef<Map<string, { token: string; decision: GateDecision }>>(new Map());
  const { toast } = useToast();
  const { addNotification } = useNotifications();
  const { mode } = useAppMode();
  const { price: solPrice } = useSolPrice();
  const { guardFeature, isTierAllowed } = useFeatureAccess();
  
  // Demo mode guard
  const isDemo = mode === 'demo';

  // Ref to prevent concurrent evaluations
  const evaluatingRef = useRef(false);
  // Last evaluation timestamp
  const lastEvalRef = useRef(0);

  const evaluateTokens = useCallback(async (
    tokens: TokenData[],
    executeOnApproval: boolean = false,
    onTradeExecuted?: () => void,
    options?: EvaluateTokensOptions
  ): Promise<AutoSniperResult | null> => {
    // Prevent concurrent evaluations
    if (evaluatingRef.current) {
      console.log('[Auto-sniper] Evaluation already in progress, skipping...');
      return null;
    }

    // Throttle: 3 seconds for live mode, 5 seconds for demo mode
    // Reduced from previous values to allow faster continuous operation
    const throttleMs = isDemo ? 5000 : 3000;
    const now = Date.now();
    if (now - lastEvalRef.current < throttleMs) {
      // Silent throttle - don't log this as it's normal behavior
      return null;
    }

    evaluatingRef.current = true;
    lastEvalRef.current = now;
    setLoading(true);
    setError(null);

    try {
      // Demo mode guard - don't call real API (demo trades handled in Scanner.tsx)
      if (isDemo) {
        console.log('[Auto-sniper] Demo mode - skipping API call');
        evaluatingRef.current = false;
        setLoading(false);
        return null;
      }

      // Subscription access guard — blocks if tier doesn't allow auto-trade
      // or daily auto-execution limit is reached
      if (executeOnApproval && !guardFeature('auto_trade', { incrementOnAllow: true })) {
        evaluatingRef.current = false;
        setLoading(false);
        return null;
      }

      // Filter out demo/invalid tokens before sending to API
      // Demo tokens have truncated addresses like "Demo0...f9xjij" which fail validation
      const validTokens = tokens.filter(t => {
        const addr = t.address || '';
        // Reject demo addresses (contain '...' or start with 'Demo')
        if (addr.includes('...') || addr.startsWith('Demo')) {
          console.log(`[Auto-sniper] Filtering out demo token: ${t.symbol} (${addr})`);
          return false;
        }
        // Reject invalid length addresses
        if (addr.length < 26 || addr.length > 66) {
          console.log(`[Auto-sniper] Filtering out invalid address: ${t.symbol} (${addr.length} chars)`);
          return false;
        }
        return true;
      });

      if (validTokens.length === 0) {
        console.log('[Auto-sniper] No valid tokens after filtering, skipping API call');
        evaluatingRef.current = false;
        setLoading(false);
        return null;
      }

      // ==========================================
      // PRE-EXECUTION GATE (CLIENT-SIDE CHECK)
      // ==========================================
      
      // Fetch user settings FIRST to populate toggles, buy amount, slippage, and liquidity thresholds
      let userToggles: Record<string, boolean> | null = null;
      let userBuyAmount = 0.1;
      let userSlippage = 0.15;
      let userMinLiquidityUsd = 10000; // default auto threshold
      let userTargetBuyerPositions: number[] | undefined = undefined;
      
      try {
        const { data: { session: authSession } } = await supabase.auth.getSession();
        if (authSession) {
          const { data: sniperSettings } = await supabase
            .from('user_sniper_settings')
            .select('trade_amount, slippage_tolerance, validation_rule_toggles, min_liquidity, target_buyer_positions')
            .eq('user_id', authSession.user.id)
            .maybeSingle();
          
          if (sniperSettings) {
            userToggles = (sniperSettings as any).validation_rule_toggles as Record<string, boolean> | null;
            userBuyAmount = sniperSettings.trade_amount || 0.1;
            userSlippage = sniperSettings.slippage_tolerance 
              ? (sniperSettings.slippage_tolerance as number) / 100 
              : 0.15;
            // Convert min_liquidity from settings (may be SOL) to USD
            const rawMinLiq = (sniperSettings as any).min_liquidity || 300;
            userMinLiquidityUsd = rawMinLiq < 1000 ? rawMinLiq * (solPrice || 150) : rawMinLiq;
            // Target buyer positions: array = enabled with specific positions, empty array = disabled
            const tbp = (sniperSettings as any).target_buyer_positions;
            userTargetBuyerPositions = Array.isArray(tbp) ? tbp : undefined;
          }
        }
      } catch (settingsErr) {
        console.warn('[Auto-sniper] Failed to fetch settings for gate:', settingsErr);
      }
      
      // Check if EXECUTABLE_SELL rule is enabled by user
      const execSellEnabled = userToggles?.EXECUTABLE_SELL !== false;

      const currentSolPrice = solPrice || 150;
      
      const gateInputs: PreExecutionGateInput[] = validTokens.map(t => ({
        tokenAddress: t.address,
        tokenSymbol: t.symbol,
        tokenName: t.name,
        // Convert liquidity: if < 1000, assume it's in SOL and convert to USD
        liquidity: t.liquidity < 1000 ? t.liquidity * currentSolPrice : t.liquidity,
        priceUsd: t.priceUsd,
        buyerPosition: t.buyerPosition ?? undefined,
        // FIX: uniqueBuyerCount should come from holderCount, NOT buyerPosition
        // buyerPosition = user's position in the buy queue (e.g., #2 = 2nd buyer)
        // holderCount = total unique holders of the token
        // Previously: uniqueBuyerCount was set to buyerPosition, so buyer #2 → uniqueBuyerCount=2 → failed "<3 buyers" check
        uniqueBuyerCount: (t.holderCount || t.holders || (t as any).holderCount) ?? undefined,
        isPumpFun: t.isPumpFun,
        source: t.source,
        // FIX: Respect EXECUTABLE_SELL toggle - if disabled, treat unknown as true
        hasJupiterRoute: t.canSell === true ? true : (execSellEnabled ? undefined : true),
        // FIX: Use poolCreatedAt from TokenData (now properly passed from scanner)
        poolCreatedAt: (() => {
          const raw = t.poolCreatedAt || (t as any).pairCreatedAt || (t as any).createdAt;
          if (!raw) return undefined;
          if (typeof raw === 'number') return raw;
          const parsed = typeof raw === 'string' ? (raw.includes('T') || raw.includes('-') ? new Date(raw).getTime() : Number(raw)) : undefined;
          return parsed && !isNaN(parsed) ? parsed : undefined;
        })(),
        // FIX: Pass freeze authority from scanner data
        hasFreezeAuthority: t.freezeAuthority !== undefined ? (t.freezeAuthority !== null && t.freezeAuthority !== '') : undefined,
        holderCount: t.holderCount || t.holders || (t as any).holderCount,
        buyAmountSol: userBuyAmount,
        maxSlippage: userSlippage,
        solPriceUsd: currentSolPrice,
        executionMode: 'auto' as const,
        // Deployer & LP enrichment from RugCheck (passed through scanner response)
        deployerWallet: t.deployerWallet || (t as any).creatorAddress || undefined,
        lpMintAddress: t.lpMintAddress || undefined,
        creatorAddress: t.creatorAddress || t.deployerWallet || undefined,
        // FIX: Pass user's configured liquidity thresholds instead of hardcoded defaults
        liquidityThresholds: {
          autoMinUsd: userMinLiquidityUsd,
          manualMinUsd: Math.max(userMinLiquidityUsd * 0.5, 5000),
        },
        validationToggles: userToggles || undefined,
        // Pass user's target buyer positions: empty array = disabled (allow any), populated = enforce
        targetBuyerPositions: userTargetBuyerPositions,
        // TIER FEATURES: controls which premium rules run in the gate
        tierFeatures: {
          advanced_clustering: isTierAllowed('advanced_clustering'),
          capital_preservation: isTierAllowed('capital_preservation'),
        },
      }));

      // Create activity logger that feeds into BotActivityLog
      const logGateActivity = (entry: GateActivityLogEntry) => {
        addBotLog({
          level: entry.level,
          category: entry.category,
          message: entry.message,
          details: entry.details,
          tokenSymbol: entry.tokenSymbol !== 'BATCH' && entry.tokenSymbol !== 'SUMMARY' 
            ? entry.tokenSymbol 
            : undefined,
          tokenAddress: entry.tokenAddress || undefined,
        });
      };

      // Run batch gate check with logging
      const gateResults = await batchPreExecutionGate(gateInputs, { 
        logActivity: logGateActivity 
      });
      const executableTokens = filterExecutableTokens(gateResults);
      
      const gateBlocked = gateResults.filter(r => !r.gateDecision.allowed).length;
      const gateExecutable = executableTokens.length;
      
      console.log(`[Auto-sniper] Pre-execution gate: ${gateExecutable}/${validTokens.length} executable, ${gateBlocked} blocked`);

      // Only send executable tokens to the API
      const tokensToEvaluate = validTokens.filter(t => 
        executableTokens.some(e => e.tokenAddress === t.address)
      );

      // Accumulate gate results
      for (const r of gateResults) {
        accumulatedGateResultsRef.current.set(r.tokenAddress, {
          token: r.tokenSymbol,
          decision: r.gateDecision,
        });
      }
      // Cap accumulated results to prevent unbounded growth
      if (accumulatedGateResultsRef.current.size > 100) {
        const entries = Array.from(accumulatedGateResultsRef.current.entries());
        accumulatedGateResultsRef.current = new Map(entries.slice(-80));
      }
      const allAccumulatedGateResults = Array.from(accumulatedGateResultsRef.current.values());
      
      // Persist gate results to scanner store for cross-navigation persistence
      try {
        const { useScannerStore } = await import('@/stores/scannerStore');
        useScannerStore.getState().mergeGateResults(allAccumulatedGateResults as any);
      } catch (e) {
        // Non-blocking
      }

      if (tokensToEvaluate.length === 0) {
        console.log('[Auto-sniper] No tokens passed pre-execution gate');
        evaluatingRef.current = false;
        setLoading(false);
        
        // Return result showing all tokens were gate-blocked
        const blockedResult: AutoSniperResult = {
          decisions: [],
          executedTrades: [],
          gateResults: allAccumulatedGateResults,
          summary: {
            total: validTokens.length,
            approved: 0,
            rejected: validTokens.length,
            executed: 0,
            openPositions: 0,
            maxPositions: 3,
            gateBlocked,
            gateExecutable: 0,
          },
          settings: {
            minLiquidity: 0,
            priority: 'normal',
            categoryFilters: [],
            profitTakePercent: 100,
            stopLossPercent: 20,
          },
          timestamp: new Date().toISOString(),
        };
        setResult(blockedResult);
        return blockedResult;
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Please sign in to use the auto-sniper');
      }

      console.log(`[Auto-sniper] Evaluating ${tokensToEvaluate.length} gate-approved tokens:`, tokensToEvaluate.map(t => `${t.symbol}(${t.source || 'unknown'})`).join(', '));

      // Use direct fetch instead of supabase.functions.invoke to avoid
      // the "Failed to send request to Edge Function" error that occurs
      // when the Supabase JS client fails silently on network issues.
      const functionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/auto-sniper`;
      const accessToken = session.access_token;

      let data: any;
      try {
        const response = await fetch(functionUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ tokens: tokensToEvaluate, executeOnApproval }),
          signal: AbortSignal.timeout(15000), // 15s timeout
        });

        if (!response.ok) {
          if (response.status === 429) {
            toast({ title: 'Rate Limited', description: 'Auto-sniper rate limited by server. Retrying shortly.', variant: 'destructive' });
            evaluatingRef.current = false;
            setLoading(false);
            return null;
          }
          const errBody = await response.text().catch(() => '');
          throw new Error(`Edge function error (${response.status}): ${errBody.slice(0, 200) || 'Unknown error'}`);
        }

        data = await response.json();
      } catch (fetchErr: any) {
        if (fetchErr?.name === 'TimeoutError' || fetchErr?.name === 'AbortError') {
          throw new Error('Auto-sniper request timed out. The server may be busy.');
        }
        throw fetchErr;
      }

      // Augment result with accumulated gate information
      const augmentedData = {
        ...data,
        gateResults: allAccumulatedGateResults,
        summary: {
          ...data.summary,
          gateBlocked,
          gateExecutable,
        },
      };
      
      setResult(augmentedData);
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
      } else if (approved > 0 && !executeOnApproval && !options?.suppressOpportunityToast) {
        toast({
          title: 'Opportunities Found',
          description: `${approved} token(s) passed all rules.`,
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
  }, [toast, addNotification, isDemo, guardFeature, isTierAllowed]);

  const clearResult = useCallback(() => {
    setResult(null);
    setError(null);
    accumulatedGateResultsRef.current.clear();
  }, []);

  return {
    loading,
    result,
    error,
    evaluateTokens,
    clearResult,
  };
}
