import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAppMode } from '@/contexts/AppModeContext';

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
}

export interface ApiError {
  apiName: string;
  apiType: string;
  errorMessage: string;
  endpoint: string;
  timestamp: string;
}

interface ScanResult {
  tokens: ScannedToken[];
  errors: string[];
  apiErrors: ApiError[];
  timestamp: string;
  apiCount: number;
}

// Demo tokens for testing without real API calls
const demoTokenNames = [
  { name: 'DogeMoon', symbol: 'DOGEM' },
  { name: 'ShibaRocket', symbol: 'SHIBR' },
  { name: 'PepeGold', symbol: 'PEPEG' },
  { name: 'FlokiMax', symbol: 'FLOKM' },
  { name: 'BabyWhale', symbol: 'BBYWH' },
  { name: 'SafeApe', symbol: 'SAPE' },
  { name: 'MoonShot', symbol: 'MSHOT' },
  { name: 'RocketFuel', symbol: 'RFUEL' },
  { name: 'DiamondHands', symbol: 'DHAND' },
  { name: 'GigaChad', symbol: 'GIGA' },
];

const generateSingleDemoToken = (idx: number): ScannedToken => {
  const token = demoTokenNames[idx % demoTokenNames.length];
  return {
    id: `demo-${idx}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    address: `Demo${idx}...${Math.random().toString(36).substring(2, 8)}`,
    name: token.name,
    symbol: token.symbol,
    chain: 'solana',
    liquidity: Math.floor(Math.random() * 50000) + 5000,
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
    source: 'Demo',
    pairAddress: `DemoPair${idx}`,
  };
};

export function useTokenScanner() {
  const [tokens, setTokens] = useState<ScannedToken[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastScan, setLastScan] = useState<string | null>(null);
  const [apiCount, setApiCount] = useState(0);
  const [errors, setErrors] = useState<string[]>([]);
  const [apiErrors, setApiErrors] = useState<ApiError[]>([]);
  const { toast } = useToast();
  const { isDemo, isLive } = useAppMode();
  
  // Ref to track if a scan is in progress
  const scanInProgress = useRef(false);
  // Ref to store interval for tick-by-tick loading
  const tickIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Add tokens one by one with delay (tick-by-tick)
  const addTokensIncrementally = useCallback((newTokens: ScannedToken[], onComplete?: () => void) => {
    // Clear any existing interval
    if (tickIntervalRef.current) {
      clearInterval(tickIntervalRef.current);
    }

    let index = 0;
    const addInterval = 150; // 150ms between each token

    tickIntervalRef.current = setInterval(() => {
      if (index < newTokens.length) {
        const tokenToAdd = newTokens[index];
        setTokens(prev => {
          // Check if token already exists (by address)
          const exists = prev.some(t => t.address === tokenToAdd.address);
          if (exists) {
            // Update existing token
            return prev.map(t => t.address === tokenToAdd.address ? tokenToAdd : t);
          }
          // Add new token at the beginning
          return [tokenToAdd, ...prev].slice(0, 50); // Keep max 50 tokens
        });
        index++;
      } else {
        // All tokens added
        if (tickIntervalRef.current) {
          clearInterval(tickIntervalRef.current);
          tickIntervalRef.current = null;
        }
        if (onComplete) onComplete();
      }
    }, addInterval);
  }, []);

  const scanTokens = useCallback(async (minLiquidity: number = 300, chains: string[] = ['solana']): Promise<ScanResult | null> => {
    // Prevent concurrent scans
    if (scanInProgress.current) {
      console.log('Scan already in progress, skipping...');
      return null;
    }

    scanInProgress.current = true;
    setLoading(true);
    setErrors([]);
    setApiErrors([]);

    try {
      // Demo mode: return simulated data incrementally
      if (isDemo) {
        // Generate 3-5 new demo tokens per scan
        const numNewTokens = Math.floor(Math.random() * 3) + 3;
        const newDemoTokens: ScannedToken[] = [];
        
        for (let i = 0; i < numNewTokens; i++) {
          const token = generateSingleDemoToken(Math.floor(Math.random() * 10));
          if (token.liquidity >= minLiquidity) {
            newDemoTokens.push(token);
          }
        }

        // Add tokens incrementally
        addTokensIncrementally(newDemoTokens, () => {
          setLoading(false);
          scanInProgress.current = false;
        });

        setLastScan(new Date().toISOString());
        setApiCount(3);
        
        return { 
          tokens: newDemoTokens, 
          errors: [], 
          apiErrors: [], 
          timestamp: new Date().toISOString(), 
          apiCount: 3 
        };
      }

      // Live mode: call real API
      const { data, error } = await supabase.functions.invoke('token-scanner', {
        body: { minLiquidity, chains },
      });

      if (error) throw error;

      const result = data as ScanResult;
      
      // Add tokens incrementally for smooth loading
      if (result.tokens && result.tokens.length > 0) {
        addTokensIncrementally(result.tokens, () => {
          setLoading(false);
          scanInProgress.current = false;
        });
      } else {
        setLoading(false);
        scanInProgress.current = false;
      }

      setLastScan(result.timestamp);
      setApiCount(result.apiCount);
      setApiErrors(result.apiErrors || []);
      
      if (result.errors && result.errors.length > 0) {
        setErrors(result.errors);
        const failedApis = result.apiErrors?.map(e => e.apiName).join(', ') || 'Unknown APIs';
        toast({
          title: 'Scan completed with warnings',
          description: `${result.errors.length} API(s) had issues: ${failedApis}`,
          variant: 'destructive',
        });
      }

      return result;
    } catch (error: any) {
      console.error('Scan error:', error);
      toast({
        title: 'Scan failed',
        description: error.message || 'Failed to scan for tokens',
        variant: 'destructive',
      });
      setLoading(false);
      scanInProgress.current = false;
      return null;
    }
  }, [toast, isDemo, addTokensIncrementally]);

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

  // Cleanup on unmount
  const cleanup = useCallback(() => {
    if (tickIntervalRef.current) {
      clearInterval(tickIntervalRef.current);
    }
  }, []);

  return {
    tokens,
    loading,
    lastScan,
    apiCount,
    errors,
    apiErrors,
    scanTokens,
    getTopOpportunities,
    filterByChain,
    filterByRisk,
    isDemo,
    isLive,
    cleanup,
  };
}
