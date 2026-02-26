/**
 * Discovery Pipeline Hook
 * 
 * Orchestrates the two-stage token discovery and tradability pipeline:
 * 
 * STAGE 1 - Discovery: Broad token detection with minimal filtering
 * - Captures all new pools/tokens from DexScreener, GeckoTerminal
 * - Stores tokens in NEW or PENDING state
 * - Does NOT apply strict liquidity filters
 * 
 * STAGE 2 - Tradability: Strict filtering for trade execution
 * - Checks liquidity threshold
 * - Verifies Jupiter swap route availability
 * - Runs safety validation (RugCheck)
 * - Only TRADEABLE tokens are eligible for auto-trade
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

/** Invoke an edge function with automatic JWT refresh + retry on auth errors */
async function invokeWithRetry(fnName: string, body: Record<string, unknown>) {
  const first = await supabase.functions.invoke(fnName, { body });
  if (first.error) {
    const msg = String(first.error?.message || first.error || '').toLowerCase();
    const isAuth = msg.includes('expired') || msg.includes('401') || msg.includes('unauthorized') || msg.includes('jwt');
    if (isAuth) {
      console.log(`[Pipeline] Auth error on ${fnName}, refreshing session…`);
      const { error: refreshErr } = await supabase.auth.refreshSession();
      if (!refreshErr) {
        return supabase.functions.invoke(fnName, { body });
      }
    }
  }
  return first;
}
import { useAppMode } from '@/contexts/AppModeContext';
import { useTokenStateManager, TokenState } from '@/hooks/useTokenStateManager';

export interface DiscoveredToken {
  address: string;
  name: string;
  symbol: string;
  chain: string;
  liquidity: number;
  priceUsd: number;
  volume24h: number;
  marketCap: number;
  source: string;
  pairAddress: string;
  poolCreatedAt: string;
  dexId: string;
}

export interface PendingToken {
  address: string;
  symbol: string;
  name: string;
  liquidity: number;
  source: string;
  reason: string;
}

export interface TradableToken extends DiscoveredToken {
  id: string;
  liquidityLocked: boolean;
  lockPercentage: number | null;
  priceChange24h: number;
  holders: number;
  earlyBuyers: number;
  buyerPosition: number | null;
  riskScore: number;
  isTradeable: boolean;
  canBuy: boolean;
  canSell: boolean;
  freezeAuthority: string | null;
  mintAuthority: string | null;
  isPumpFun: boolean;
  safetyReasons: string[];
  tokenStatus: {
    tradable: boolean;
    stage: 'DISCOVERED' | 'PENDING' | 'TRADEABLE' | 'REJECTED';
    poolAddress?: string;
    jupiterIndexed: boolean;
    lastChecked: string;
  };
}

export interface PipelineStats {
  discovered: number;
  total: number;
  tradeable: number;
  pending: number;
  rejected: number;
  filtered: number;
  stages?: {
    discovered: number;
    pending: number;
    tradeable: number;
    rejected: number;
  };
}

export interface PipelineResult {
  stage: 'discovery' | 'tradability' | 'both';
  tokens: TradableToken[];
  pendingTokens: PendingToken[];
  discoveredTokens: DiscoveredToken[];
  stats: PipelineStats;
  timestamp: string;
}

interface UseDiscoveryPipelineOptions {
  minLiquidity: number;
  autoRefresh?: boolean;
  refreshIntervalMs?: number;
}

export function useDiscoveryPipeline(options: UseDiscoveryPipelineOptions) {
  const { minLiquidity, autoRefresh = false, refreshIntervalMs = 30000 } = options;
  
  const [loading, setLoading] = useState(false);
  const [discoveryLoading, setDiscoveryLoading] = useState(false);
  const [tradabilityLoading, setTradabilityLoading] = useState(false);
  
  const [discoveredTokens, setDiscoveredTokens] = useState<DiscoveredToken[]>([]);
  const [pendingTokens, setPendingTokens] = useState<PendingToken[]>([]);
  const [tradeableTokens, setTradeableTokens] = useState<TradableToken[]>([]);
  
  const [stats, setStats] = useState<PipelineStats>({
    discovered: 0,
    total: 0,
    tradeable: 0,
    pending: 0,
    rejected: 0,
    filtered: 0,
  });
  
  const [lastDiscovery, setLastDiscovery] = useState<string | null>(null);
  const [lastTradabilityCheck, setLastTradabilityCheck] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const { toast } = useToast();
  const { isDemo, isLive } = useAppMode();
  const tokenStateManager = useTokenStateManager();
  
  const discoveryInProgress = useRef(false);
  const tradabilityInProgress = useRef(false);
  const refreshIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /**
   * STAGE 1: Run broad discovery
   * Captures all new tokens without strict filtering
   */
  const runDiscovery = useCallback(async (): Promise<DiscoveredToken[]> => {
    if (discoveryInProgress.current || isDemo) return [];
    
    discoveryInProgress.current = true;
    setDiscoveryLoading(true);
    setError(null);
    
    try {
      console.log('[Pipeline] Running STAGE 1: Discovery...');
      
      const { data, error: fnError } = await invokeWithRetry('token-scanner', { 
        minLiquidity: 1, chains: ['solana'], stage: 'discovery',
      });
      
      if (fnError) throw fnError;
      if (data.error) throw new Error(data.error);
      
      const discovered = data.discoveredTokens || [];
      
      // Merge with existing discovered tokens (dedupe)
      setDiscoveredTokens(prev => {
        const map = new Map(prev.map(t => [t.address, t]));
        discovered.forEach((t: DiscoveredToken) => {
          if (!map.has(t.address)) {
            map.set(t.address, t);
          }
        });
        return Array.from(map.values()).slice(0, 200); // Keep max 200
      });
      
      // Register with state manager
      if (discovered.length > 0 && tokenStateManager.initialized) {
        await tokenStateManager.registerTokensBatch(
          discovered.map((t: DiscoveredToken) => ({
            address: t.address,
            symbol: t.symbol,
            name: t.name,
            source: t.source,
            liquidity: t.liquidity,
          }))
        );
      }
      
      setLastDiscovery(data.timestamp);
      setStats(prev => ({
        ...prev,
        discovered: (prev.discovered || 0) + discovered.length,
      }));
      
      console.log(`[Pipeline] STAGE 1 complete: +${discovered.length} tokens discovered`);
      return discovered;
      
    } catch (err: any) {
      const message = err.message || 'Discovery failed';
      setError(message);
      console.error('[Pipeline] Discovery error:', err);
      return [];
    } finally {
      setDiscoveryLoading(false);
      discoveryInProgress.current = false;
    }
  }, [isDemo, tokenStateManager]);

  /**
   * STAGE 2: Run tradability verification
   * Applies strict filters: liquidity, routes, safety
   */
  const runTradabilityCheck = useCallback(async (): Promise<TradableToken[]> => {
    if (tradabilityInProgress.current || isDemo) return [];
    
    tradabilityInProgress.current = true;
    setTradabilityLoading(true);
    setError(null);
    
    try {
      console.log('[Pipeline] Running STAGE 2: Tradability check...');
      
      const { data, error: fnError } = await invokeWithRetry('token-scanner', { 
        minLiquidity, chains: ['solana'], stage: 'both',
      });
      
      if (fnError) throw fnError;
      if (data.error) throw new Error(data.error);
      
      const tradeable = data.tokens || [];
      const pending = data.pendingTokens || [];
      const discovered = data.discoveredTokens || [];
      
      setTradeableTokens(tradeable);
      setPendingTokens(pending);
      
      // Update discovered tokens with fresh data
      if (discovered.length > 0) {
        setDiscoveredTokens(prev => {
          const map = new Map(prev.map(t => [t.address, t]));
          discovered.forEach((t: DiscoveredToken) => {
            map.set(t.address, t); // Update with fresh data
          });
          return Array.from(map.values()).slice(0, 200);
        });
      }
      
      setStats(data.stats || {
        discovered: discovered.length,
        total: tradeable.length + pending.length,
        tradeable: tradeable.length,
        pending: pending.length,
        rejected: 0,
        filtered: discovered.length - tradeable.length,
      });
      
      setLastTradabilityCheck(data.timestamp);
      
      console.log(`[Pipeline] STAGE 2 complete: ${tradeable.length} tradeable, ${pending.length} pending`);
      return tradeable;
      
    } catch (err: any) {
      const message = err.message || 'Tradability check failed';
      setError(message);
      console.error('[Pipeline] Tradability error:', err);
      return [];
    } finally {
      setTradabilityLoading(false);
      tradabilityInProgress.current = false;
    }
  }, [minLiquidity, isDemo]);

  /**
   * Run full pipeline (both stages)
   */
  const runFullPipeline = useCallback(async (): Promise<PipelineResult | null> => {
    if (loading) return null;
    
    setLoading(true);
    
    try {
      // Run both stages via single API call
      const { data, error: fnError } = await invokeWithRetry('token-scanner', { 
        minLiquidity, chains: ['solana'], stage: 'both',
      });
      
      if (fnError) throw fnError;
      if (data.error) throw new Error(data.error);
      
      const result: PipelineResult = {
        stage: 'both',
        tokens: data.tokens || [],
        pendingTokens: data.pendingTokens || [],
        discoveredTokens: data.discoveredTokens || [],
        stats: data.stats || {},
        timestamp: data.timestamp,
      };
      
      setTradeableTokens(result.tokens);
      setPendingTokens(result.pendingTokens);
      setDiscoveredTokens(prev => {
        const map = new Map(prev.map(t => [t.address, t]));
        result.discoveredTokens.forEach(t => map.set(t.address, t));
        return Array.from(map.values()).slice(0, 200);
      });
      setStats(result.stats);
      setLastDiscovery(result.timestamp);
      setLastTradabilityCheck(result.timestamp);
      
      return result;
      
    } catch (err: any) {
      const message = err.message || 'Pipeline failed';
      setError(message);
      toast({
        title: 'Scan failed',
        description: message,
        variant: 'destructive',
      });
      return null;
    } finally {
      setLoading(false);
    }
  }, [minLiquidity, toast, loading]);

  /**
   * Get tokens by state for UI display
   */
  const getTokensByState = useCallback((state: TokenState): DiscoveredToken[] => {
    return discoveredTokens.filter(t => {
      const tokenState = tokenStateManager.getTokenState(t.address);
      return tokenState === state;
    });
  }, [discoveredTokens, tokenStateManager]);

  /**
   * Filter tokens eligible for auto-trading
   */
  const getAutoTradeEligible = useCallback((): TradableToken[] => {
    return tradeableTokens.filter(t => {
      // Must be tradeable
      if (!t.isTradeable || !t.canBuy) return false;
      
      // Check state manager - not already traded or rejected
      const state = tokenStateManager.getTokenState(t.address);
      if (state === 'TRADED' || state === 'REJECTED') return false;
      
      // Risk score check
      if (t.riskScore >= 100) return false;
      
      return true;
    });
  }, [tradeableTokens, tokenStateManager]);

  // Auto-refresh setup
  useEffect(() => {
    if (autoRefresh && isLive && !isDemo) {
      refreshIntervalRef.current = setInterval(() => {
        runTradabilityCheck();
      }, refreshIntervalMs);
    }
    
    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [autoRefresh, isLive, isDemo, refreshIntervalMs, runTradabilityCheck]);

  // Cleanup pending tokens periodically
  useEffect(() => {
    if (!tokenStateManager.initialized) return;
    
    const cleanup = setInterval(() => {
      tokenStateManager.cleanupExpiredPending();
    }, 60000); // Every minute
    
    return () => clearInterval(cleanup);
  }, [tokenStateManager]);

  return {
    // State
    loading,
    discoveryLoading,
    tradabilityLoading,
    error,
    
    // Token lists
    discoveredTokens,
    pendingTokens,
    tradeableTokens,
    
    // Stats
    stats,
    lastDiscovery,
    lastTradabilityCheck,
    
    // Actions
    runDiscovery,
    runTradabilityCheck,
    runFullPipeline,
    
    // Helpers
    getTokensByState,
    getAutoTradeEligible,
    
    // State manager passthrough
    tokenStateManager,
  };
}
