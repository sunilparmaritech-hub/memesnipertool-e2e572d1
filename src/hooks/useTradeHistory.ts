import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { fetchDexScreenerTokenMetadata, isPlaceholderTokenText } from '@/lib/dexscreener';

export interface TradeHistoryEntry {
  id: string;
  user_id: string;
  token_address: string;
  token_name: string | null;
  token_symbol: string | null;
  trade_type: 'buy' | 'sell';
  amount: number;
  // NEW SEMANTIC COLUMNS (source of truth for P&L)
  sol_spent: number | null;       // BUY: actual SOL deducted, SELL: 0
  sol_received: number | null;    // SELL: actual SOL received, BUY: 0
  token_amount: number | null;    // Actual token delta
  realized_pnl_sol: number | null; // SELL only: solReceived - matchedBuySolSpent
  roi_percent: number | null;     // SELL only: (pnl / solSpent) * 100
  sol_balance_after: number | null;
  // Legacy columns (for backwards compatibility)
  price_sol: number | null;
  price_usd: number | null;
  status: string | null;
  tx_hash: string | null;
  created_at: string;
  // Extended metadata columns
  buyer_position: number | null;
  liquidity: number | null;
  risk_score: number | null;
  entry_price: number | null;
  exit_price: number | null;
  slippage: number | null;
  // Integrity tracking
  data_source: 'legacy' | 'on_chain' | 'calculated' | null;
  is_corrupted: boolean | null;
  corruption_reason: string | null;
  matched_buy_tx_hash: string | null;
}

type RefetchOptions = {
  /** If true, attempts to rebuild history from existing positions even if we've tried before. */
  forceBackfill?: boolean;
};

type PositionBackfillRow = {
  token_address: string;
  token_name: string | null;
  token_symbol: string | null;
  amount: number;
  entry_price: number;
  entry_price_usd: number | null;
  status: string | null;
  created_at: string;
  closed_at: string | null;
  exit_price: number | null;
  exit_tx_id: string | null;
};

// NOTE: PostgREST has a default max of 1000 rows per request.
export function useTradeHistory(limit: number = 1000) {
  const [trades, setTrades] = useState<TradeHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();

  const hasAttemptedBackfillRef = useRef(false);

  // Cache DexScreener metadata by token address to avoid repeated external calls
  const tokenMetaCacheRef = useState(() => new Map<string, { name: string; symbol: string }>())[0];

  useEffect(() => {
    // reset between users
    hasAttemptedBackfillRef.current = false;
  }, [user?.id]);

  /**
   * DISABLED: Backfill creates fake trades without tx_hash which corrupts audit trail.
   * Trade history should ONLY be created by confirm-transaction edge function
   * after on-chain confirmation with valid tx_hash.
   * 
   * This function now only syncs metadata between positions and existing trade_history.
   */
  const syncMetadataFromPositions = useCallback(async () => {
    if (!user) return 0;

    // Get existing trade_history entries with token metadata issues
    const { data: existingTrades } = await supabase
      .from('trade_history')
      .select('id, token_address, token_symbol, token_name, tx_hash')
      .eq('user_id', user.id);

    if (!existingTrades || existingTrades.length === 0) return 0;

    // Get positions to use as metadata source
    const { data: positionsData } = await supabase
      .from('positions')
      .select('token_address, token_symbol, token_name')
      .eq('user_id', user.id);

    if (!positionsData) return 0;

    // Create metadata lookup from positions
    const positionMetaMap = new Map<string, { symbol: string; name: string }>();
    for (const pos of positionsData) {
      if (pos.token_symbol && pos.token_name && 
          !pos.token_symbol.includes('…') && !pos.token_symbol.includes('...')) {
        positionMetaMap.set(pos.token_address, {
          symbol: pos.token_symbol,
          name: pos.token_name,
        });
      }
    }

    // Fix trades with truncated/placeholder metadata
    let fixedCount = 0;
    for (const trade of existingTrades) {
      const isPlaceholder = !trade.token_symbol || 
        trade.token_symbol.includes('…') || 
        trade.token_symbol.includes('...') ||
        trade.token_symbol.startsWith('Token ');
      
      if (isPlaceholder) {
        const meta = positionMetaMap.get(trade.token_address);
        if (meta) {
          const { error } = await supabase
            .from('trade_history')
            .update({
              token_symbol: meta.symbol,
              token_name: meta.name,
            })
            .eq('id', trade.id);
          
          if (!error) fixedCount++;
        }
      }
    }

    return fixedCount;
  }, [user]);

  /**
   * Legacy backfill - NOW DISABLED to prevent fake trades
   * Kept for reference but returns 0 immediately
   */
  const backfillFromPositions = useCallback(async () => {
    // DISABLED: Do not create trades without on-chain tx_hash
    // This was causing "fake token" issues in the audit trail
    console.warn('[TradeHistory] Backfill disabled - trades should only come from confirm-transaction');
    return 0;
  }, []);

  const fetchTrades = useCallback(async (options?: RefetchOptions) => {
    if (!user) {
      setTrades([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      // Fetch up to the maximum allowed per request (default 1000)
      let { data, error } = await supabase
        .from('trade_history')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      // DISABLED backfill - trades should only come from on-chain confirmation
      // Instead, we just fix metadata inconsistencies if needed
      if ((data?.length ?? 0) > 0 && !hasAttemptedBackfillRef.current) {
        hasAttemptedBackfillRef.current = true;
        try {
          const fixed = await syncMetadataFromPositions();
          if (fixed > 0) {
            console.log(`[TradeHistory] Fixed ${fixed} token metadata entries`);
            // Refetch to get updated metadata
            const refetchResult = await supabase
              .from('trade_history')
              .select('*')
              .eq('user_id', user.id)
              .order('created_at', { ascending: false })
              .limit(limit);

            if (!refetchResult.error) {
              data = refetchResult.data;
            }
          }
        } catch (e) {
          console.warn('Metadata sync failed:', e);
        }
      }

      const rawTrades = ((data || []) as TradeHistoryEntry[]).map((t) => ({ ...t }));
      setTrades(rawTrades);

      // Enrich missing/placeholder token metadata
      const addressesToFetch = Array.from(
        new Set(
          rawTrades
            .filter((t) => isPlaceholderTokenText(t.token_symbol) || isPlaceholderTokenText(t.token_name))
            .map((t) => t.token_address)
            .filter((addr) => !tokenMetaCacheRef.has(addr))
        )
      );

      if (addressesToFetch.length > 0) {
        const metaMap = await fetchDexScreenerTokenMetadata(addressesToFetch);
        for (const [addr, meta] of metaMap.entries()) {
          tokenMetaCacheRef.set(addr, { name: meta.name, symbol: meta.symbol });
        }

        if (metaMap.size > 0) {
          setTrades((prev) =>
            prev.map((t) => {
              const meta = tokenMetaCacheRef.get(t.token_address);
              if (!meta) return t;
              return {
                ...t,
                token_symbol: isPlaceholderTokenText(t.token_symbol) ? meta.symbol : t.token_symbol,
                token_name: isPlaceholderTokenText(t.token_name) ? meta.name : t.token_name,
              };
            })
          );
        }
      }
    } catch (error: any) {
      console.error('Error fetching trade history:', error);
      toast({
        title: 'Error',
        description: 'Failed to load trade history',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [user, limit, toast, syncMetadataFromPositions]);

  // Initial fetch
  useEffect(() => {
    fetchTrades();
  }, [fetchTrades]);

  // Subscribe to realtime updates
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('trade_history_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'trade_history',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log('Trade history update:', payload);
          fetchTrades();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchTrades]);

  // Force sync - now focuses on fixing metadata consistency, not creating fake trades
  const forceSync = useCallback(async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      
      // Fix metadata inconsistencies between positions and trade_history
      const fixedMeta = await syncMetadataFromPositions();
      
      // Refetch after sync
      const { data } = await supabase
        .from('trade_history')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(limit);
      
      setTrades((data || []) as TradeHistoryEntry[]);
      
      if (fixedMeta > 0) {
        toast({
          title: 'Metadata Synced',
          description: `Fixed ${fixedMeta} token names/symbols from positions`,
        });
      } else {
        toast({
          title: 'Already in sync',
          description: 'Transaction history metadata is up to date',
        });
      }
    } catch (error: any) {
      console.error('Force sync failed:', error);
      toast({
        title: 'Sync Failed',
        description: error.message || 'Failed to sync transaction history',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [user, syncMetadataFromPositions, limit, toast]);

  return {
    trades,
    loading,
    refetch: fetchTrades,
    forceSync,
  };
}
