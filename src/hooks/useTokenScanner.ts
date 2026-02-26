import { useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAppMode } from '@/contexts/AppModeContext';
import { useScannerStore } from '@/stores/scannerStore';
import { fetchDexScreenerPrices, isLikelyRealSolanaMint } from '@/lib/dexscreener';
import { getFunctionErrorMessage } from '@/lib/functionErrors';
import { useUsageTracking } from '@/hooks/useUsageTracking';
import { useCredits } from '@/hooks/useCredits';

// Token lifecycle stages (Raydium-only - no bonding curve tokens)
export type TokenStage = 'LP_LIVE' | 'INDEXING' | 'LISTED';

export interface TokenStatus {
  tradable: boolean;
  stage: TokenStage;
  poolAddress?: string;
  detectedAtSlot?: number;
  dexScreener: {
    pairFound: boolean;
    retryAt?: number;
  };
}

export interface ScannedToken {
  id: string;
  address: string;
  name: string;
  symbol: string;
  chain: string;
  liquidity: number;
  liquidityLocked: boolean;
  lockPercentage: number | null;
  priceUsd: number;
  priceChange24h: number;
  volume24h: number;
  marketCap: number;
  holders: number;
  createdAt: string;
  earlyBuyers: number;
  buyerPosition: number | null;
  riskScore: number;
  source: string;
  pairAddress: string;
  // Safety validation fields from token-scanner
  isPumpFun?: boolean;
  isTradeable?: boolean;
  canBuy?: boolean;
  canSell?: boolean;
  freezeAuthority?: string | null;
  mintAuthority?: string | null;
  safetyReasons?: string[];
  tokenStatus?: TokenStatus;
  // Deployer & LP enrichment from RugCheck
  deployerWallet?: string | null;
  lpMintAddress?: string | null;
  creatorAddress?: string | null;
  lpLockedPercent?: number | null;
  rugcheckTopHolders?: { address: string; pct: number }[];
  imageUrl?: string | null;
}

export interface ApiError {
  apiName: string;
  apiType: string;
  errorMessage: string;
  endpoint: string;
  timestamp: string;
}

interface ScanResult {
  stage?: 'discovery' | 'tradability' | 'both';
  tokens: ScannedToken[];
  allTokens?: ScannedToken[];
  discoveredTokens?: ScannedToken[];
  pendingTokens?: Array<{
    address: string;
    symbol: string;
    name: string;
    liquidity: number;
    source: string;
    reason: string;
  }>;
  errors: string[];
  apiErrors: ApiError[];
  timestamp: string;
  apiCount: number;
  stats?: ScanStats;
}

export interface RateLimitState {
  isLimited: boolean;
  remainingScans: number;
  resetTime: number | null;
  countdown: number;
}

export interface ScanStats {
  discovered?: number;
  total: number;
  tradeable: number;
  pending?: number;
  rejected?: number;
  pumpFun?: number;
  filtered: number;
  stages?: {
    discovered?: number;
    pending?: number;
    tradeable?: number;
    rejected?: number;
    lpLive?: number;
    indexing?: number;
    listed?: number;
  };
}

// Demo token configs for testing
const demoTokenConfigs = [
  { name: 'DogeMoon', symbol: 'DOGEM', address: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263' },
  { name: 'ShibaRocket', symbol: 'SHIBR', address: 'So11111111111111111111111111111111111111112' },
  { name: 'PepeGold', symbol: 'PEPEG', address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' },
  { name: 'FlokiMax', symbol: 'FLOKM', address: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB' },
  { name: 'BabyWhale', symbol: 'BBYWH', address: '7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr' },
  { name: 'SafeApe', symbol: 'SAPE', address: 'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So' },
  { name: 'MoonShot', symbol: 'MSHOT', address: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN' },
  { name: 'RocketFuel', symbol: 'RFUEL', address: 'orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE' },
  { name: 'DiamondHands', symbol: 'DHAND', address: 'HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3' },
  { name: 'GigaChad', symbol: 'GIGA', address: 'A3eME5CetyZPBoWbRUwY3tSe25S6tb18ba9ZPbWk9eFJ' },
];

const MAX_SCANS_PER_MINUTE = 10;
const RATE_LIMIT_WINDOW_MS = 60000;

function generateDemoAddress(seed: number): string {
  const chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  const random = new Array(44).fill(0).map((_, i) => chars[(seed * 31 + i * 17 + Date.now()) % chars.length]);
  return random.join('');
}

const generateSingleDemoToken = (idx: number): ScannedToken => {
  const config = demoTokenConfigs[idx % demoTokenConfigs.length];
  const liquidity = Math.floor(Math.random() * 50) + 5;
  const stage: TokenStage = Math.random() > 0.5 ? 'LISTED' : 'LP_LIVE';
  const uniqueId = `demo-${idx}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  
  return {
    id: uniqueId,
    address: generateDemoAddress(idx),
    name: config.name,
    symbol: config.symbol,
    chain: 'solana',
    liquidity,
    liquidityLocked: Math.random() > 0.3,
    lockPercentage: Math.random() > 0.5 ? Math.floor(Math.random() * 50) + 50 : null,
    priceUsd: Math.random() * 0.001,
    priceChange24h: (Math.random() - 0.3) * 200,
    volume24h: Math.floor(Math.random() * 100000) + 1000,
    marketCap: Math.floor(Math.random() * 500000) + 10000,
    holders: Math.floor(Math.random() * 500) + 50,
    createdAt: new Date(Date.now() - Math.random() * 86400000).toISOString(),
    earlyBuyers: Math.floor(Math.random() * 8) + 1,
    buyerPosition: Math.floor(Math.random() * 5) + 1,
    riskScore: Math.floor(Math.random() * 60) + 20,
    source: 'Raydium AMM',
    pairAddress: `DemoPair${idx}`,
    isPumpFun: false,
    isTradeable: false,
    canBuy: false,
    canSell: false,
    freezeAuthority: null,
    mintAuthority: null,
    safetyReasons: [`✅ Raydium V4 (${liquidity.toFixed(1)} SOL) - ${stage === 'LISTED' ? 'Listed' : 'Live LP'}`],
    tokenStatus: {
      tradable: true,
      stage,
      poolAddress: `DemoPool${idx}`,
      dexScreener: { pairFound: stage === 'LISTED' },
    },
  };
};

export function useTokenScanner() {
  // Use Zustand store for persistent state
  const {
    tokens,
    lastScan,
    apiCount,
    errors,
    apiErrors,
    lastScanStats,
    rateLimit,
    isInitialLoad,
    setTokens,
    mergeTokens,
    setLastScan,
    setApiCount,
    setErrors,
    setApiErrors,
    setLastScanStats,
    setRateLimit,
    setIsInitialLoad,
    clearTokens,
  } = useScannerStore();

  const { toast } = useToast();
  const { isDemo, isLive } = useAppMode();
  const { incrementUsage, canUse } = useUsageTracking();
  const { deductCredits, canAfford } = useCredits();
  
  // Loading state (local - not persisted)
  const loadingRef = useRef(false);
  const scanInProgress = useRef(false);
  const priceUpdateInProgress = useRef(false);
  const priceUpdateIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scanTimestampsRef = useRef<number[]>([]);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Update countdown every second when rate limited
  useEffect(() => {
    if (rateLimit.isLimited && rateLimit.resetTime) {
      countdownIntervalRef.current = setInterval(() => {
        const now = Date.now();
        const remaining = Math.max(0, Math.ceil((rateLimit.resetTime! - now) / 1000));
        
        if (remaining <= 0) {
          setRateLimit({
            isLimited: false,
            remainingScans: MAX_SCANS_PER_MINUTE,
            resetTime: null,
            countdown: 0,
          });
          scanTimestampsRef.current = [];
          if (countdownIntervalRef.current) {
            clearInterval(countdownIntervalRef.current);
          }
        } else {
          setRateLimit({ ...rateLimit, countdown: remaining });
        }
      }, 1000);
    }

    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
    };
  }, [rateLimit.isLimited, rateLimit.resetTime, setRateLimit, rateLimit]);

  // Check rate limit status
  const checkRateLimit = useCallback((): { allowed: boolean; remaining: number; resetIn: number } => {
    const now = Date.now();
    const windowStart = now - RATE_LIMIT_WINDOW_MS;
    
    scanTimestampsRef.current = scanTimestampsRef.current.filter(ts => ts > windowStart);
    const currentCount = scanTimestampsRef.current.length;
    const remaining = MAX_SCANS_PER_MINUTE - currentCount;
    
    if (currentCount >= MAX_SCANS_PER_MINUTE) {
      const oldestTimestamp = scanTimestampsRef.current[0];
      const resetTime = oldestTimestamp + RATE_LIMIT_WINDOW_MS;
      const resetIn = Math.ceil((resetTime - now) / 1000);
      return { allowed: false, remaining: 0, resetIn };
    }
    
    return { allowed: true, remaining, resetIn: 0 };
  }, []);

  const scanTokens = useCallback(async (minLiquidity: number = 300, chains: string[] = ['solana']): Promise<ScanResult | null> => {
    if (scanInProgress.current) {
      console.log('[Scanner] Scan already in progress, skipping...');
      return null;
    }

    // Rate limiting for live mode
    if (isLive) {
      const { allowed, remaining, resetIn } = checkRateLimit();
      
      if (!allowed) {
        const resetTime = Date.now() + (resetIn * 1000);
        setRateLimit({
          isLimited: true,
          remainingScans: 0,
          resetTime,
          countdown: resetIn,
        });
        
        toast({
          title: 'Rate Limited',
          description: `Too many scans. Please wait ${resetIn} seconds.`,
          variant: 'destructive',
        });
        return null;
      }
      
      scanTimestampsRef.current.push(Date.now());
      setRateLimit({
        ...rateLimit,
        remainingScans: remaining - 1,
        isLimited: false,
      });
    }

    scanInProgress.current = true;
    loadingRef.current = true;
    setErrors([]);
    setApiErrors([]);

    try {
      // Demo mode: return simulated data
      if (isDemo) {
        const numNewTokens = Math.floor(Math.random() * 3) + 3;
        const newDemoTokens: ScannedToken[] = [];
        
        for (let i = 0; i < numNewTokens; i++) {
          const token = generateSingleDemoToken(Math.floor(Math.random() * 10));
          if (token.liquidity >= minLiquidity) {
            newDemoTokens.push(token);
          }
        }

        mergeTokens(newDemoTokens);
        setLastScan(new Date().toISOString());
        setApiCount(3);
        setIsInitialLoad(false);
        scanInProgress.current = false;
        loadingRef.current = false;

        return { 
          tokens: newDemoTokens, 
          errors: [], 
          apiErrors: [], 
          timestamp: new Date().toISOString(), 
          apiCount: 3 
        };
      }

      // Live mode: check usage limits before calling API
      if (!canUse('token_validation')) {
        toast({
          title: 'Daily Limit Reached',
          description: 'You have used all your token validation credits for today. Upgrade for more.',
          variant: 'destructive',
        });
        scanInProgress.current = false;
        loadingRef.current = false;
        return null;
      }

      // Live mode: call real API with session refresh retry
      let data: any;
      let invokeError: any;
      
      const invokeScanner = async () => {
        const result = await supabase.functions.invoke('token-scanner', {
          body: { minLiquidity, chains, stage: 'both' },
        });
        return result;
      };
      
      const firstAttempt = await invokeScanner();
      data = firstAttempt.data;
      invokeError = firstAttempt.error;
      
      // PRODUCTION FIX: If auth error (401/expired), refresh session and retry once
      if (invokeError) {
        // Extract the REAL error message from the response body, not just the generic SDK message
        const detailedMsg = await getFunctionErrorMessage(invokeError);
        const errMsg = detailedMsg.toLowerCase();
        
        // Handle server-side rate limiting (429)
        const isRateLimited = errMsg.includes('429') || errMsg.includes('rate limit');
        if (isRateLimited) {
          const retryAfter = 30;
          setRateLimit({
            isLimited: true,
            remainingScans: 0,
            resetTime: Date.now() + retryAfter * 1000,
            countdown: retryAfter,
          });
          toast({
            title: 'Rate Limited',
            description: `Server rate limit reached. Please wait ${retryAfter}s.`,
            variant: 'destructive',
          });
          scanInProgress.current = false;
          loadingRef.current = false;
          return null;
        }
        
        // FIX: Check detailed message for JWT/auth errors — the SDK's invokeError.message 
        // is often just "Edge Function returned a non-2xx status code" and misses "JWT has expired"
        const isAuthError = errMsg.includes('expired') || errMsg.includes('401') || errMsg.includes('unauthorized') || errMsg.includes('jwt');
        
        if (isAuthError) {
          console.log('[Scanner] Auth error detected:', detailedMsg, '— refreshing session and retrying...');
          try {
            const { error: refreshErr } = await supabase.auth.refreshSession();
            if (!refreshErr) {
              const retryAttempt = await invokeScanner();
              data = retryAttempt.data;
              invokeError = retryAttempt.error;
            } else {
              console.warn('[Scanner] Session refresh returned error:', refreshErr.message);
            }
          } catch (refreshEx) {
            console.warn('[Scanner] Session refresh failed:', refreshEx);
          }
        }
        
        if (invokeError) {
          const retryMsg = await getFunctionErrorMessage(invokeError);
          throw new Error(retryMsg);
        }
      }

      const result = data as ScanResult;

      // Track usage after successful scan
      incrementUsage('token_validation');
      incrementUsage('api_check');
      
      // Deduct credits for the scan
      if (canAfford('token_validation')) {
        deductCredits({ actionType: 'token_validation' });
      }
      
      if (result.tokens && result.tokens.length > 0) {
        mergeTokens(result.tokens);
      }

      setLastScan(result.timestamp);
      setApiCount(result.apiCount);
      setApiErrors(result.apiErrors || []);
      setIsInitialLoad(false);
      
      if (result.stats) {
        setLastScanStats({
          discovered: result.stats.discovered || 0,
          total: result.stats.total,
          tradeable: result.stats.tradeable,
          pending: result.stats.pending || 0,
          rejected: result.stats.rejected || 0,
          filtered: result.stats.filtered,
          stages: result.stats.stages || {
            discovered: result.stats.discovered || 0,
            pending: result.stats.pending || 0,
            tradeable: result.stats.tradeable || 0,
            rejected: result.stats.rejected || 0,
          },
        });
      }
      
      if (result.errors && result.errors.length > 0) {
        setErrors(result.errors);
        const failedApiNames = result.apiErrors
          ?.map(e => e.apiName || e.apiType)
          .filter(name => name && name.trim() !== '') || [];
        
        const hasTokens = result.tokens && result.tokens.length > 0;
        if (!hasTokens && failedApiNames.length > 0) {
          toast({
            title: 'Scan failed',
            description: `No tokens found. APIs with issues: ${failedApiNames.join(', ')}`,
            variant: 'destructive',
          });
        }
      }

      scanInProgress.current = false;
      loadingRef.current = false;
      return result;
    } catch (error: any) {
      console.error('[Scanner] Scan error:', error);
      toast({
        title: 'Scan failed',
        description: error.message || 'Failed to scan for tokens',
        variant: 'destructive',
      });
      setIsInitialLoad(false);
      scanInProgress.current = false;
      loadingRef.current = false;
      return null;
    }
  }, [toast, isDemo, isLive, mergeTokens, checkRateLimit, setErrors, setApiErrors, setLastScan, setApiCount, setLastScanStats, setIsInitialLoad, setRateLimit, rateLimit]);

  const getTopOpportunities = useCallback((limit: number = 5) => {
    return tokens
      .filter(t => t.buyerPosition && t.buyerPosition <= 5 && t.riskScore < 70)
      .slice(0, limit);
  }, [tokens]);

  const filterByChain = useCallback((chain: string) => {
    return tokens.filter(t => t.chain === chain);
  }, [tokens]);

  const filterByRisk = useCallback((maxRisk: number) => {
    return tokens.filter(t => t.riskScore <= maxRisk);
  }, [tokens]);

  // Silent background price update
  const updateTokenPrices = useCallback(async () => {
    if (priceUpdateInProgress.current || tokens.length === 0) return;
    
    const addresses = tokens
      .map(t => t.address)
      .filter(addr => isLikelyRealSolanaMint(addr));
    
    if (addresses.length === 0) return;
    
    priceUpdateInProgress.current = true;
    
    try {
      const priceMap = await fetchDexScreenerPrices(addresses, {
        timeoutMs: 5000,
        chunkSize: 30,
      });
      
      if (priceMap.size === 0) {
        priceUpdateInProgress.current = false;
        return;
      }
      
      // Build update map
      const updates = new Map<string, Partial<ScannedToken>>();
      
      tokens.forEach(token => {
        const priceData = priceMap.get(token.address);
        if (!priceData || priceData.priceUsd <= 0) return;
        
        const oldPrice = token.priceUsd || 0;
        const priceChangePercent = oldPrice > 0 
          ? Math.abs((priceData.priceUsd - oldPrice) / oldPrice) * 100 
          : 100;
        
        if (priceChangePercent >= 0.05) {
          updates.set(token.address, {
            priceUsd: priceData.priceUsd,
            priceChange24h: priceData.priceChange24h,
            volume24h: priceData.volume24h,
            liquidity: priceData.liquidity,
          });
        }
      });
      
      if (updates.size > 0) {
        // Update tokens in store
        setTokens(tokens.map(token => {
          const update = updates.get(token.address);
          return update ? { ...token, ...update } : token;
        }));
      }
    } catch (err) {
      // Silent failure
    } finally {
      priceUpdateInProgress.current = false;
    }
  }, [tokens, setTokens]);

  // Set up background price updates (every 10 seconds)
  useEffect(() => {
    if (tokens.length === 0) return;
    
    const initialTimeout = setTimeout(updateTokenPrices, 2000);
    priceUpdateIntervalRef.current = setInterval(updateTokenPrices, 10000);
    
    return () => {
      clearTimeout(initialTimeout);
      if (priceUpdateIntervalRef.current) {
        clearInterval(priceUpdateIntervalRef.current);
      }
    };
  }, [tokens.length > 0, updateTokenPrices]);

  // Cleanup on unmount
  const cleanup = useCallback(() => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
    }
    if (priceUpdateIntervalRef.current) {
      clearInterval(priceUpdateIntervalRef.current);
    }
  }, []);

  return {
    tokens,
    loading: isInitialLoad && loadingRef.current,
    lastScan,
    apiCount,
    errors,
    apiErrors,
    rateLimit,
    lastScanStats,
    scanTokens,
    getTopOpportunities,
    filterByChain,
    filterByRisk,
    isDemo,
    isLive,
    cleanup,
    updateTokenPrices,
    clearTokens,
  };
}
