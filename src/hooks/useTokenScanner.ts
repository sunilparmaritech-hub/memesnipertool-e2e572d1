import { useState, useCallback, useMemo } from 'react';
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
const generateDemoTokens = (): ScannedToken[] => {
  const demoNames = [
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

  return demoNames.map((token, idx) => ({
    id: `demo-${idx}-${Date.now()}`,
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
  }));
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

  const scanTokens = useCallback(async (minLiquidity: number = 300, chains: string[] = ['solana']) => {
    setLoading(true);
    setErrors([]);
    setApiErrors([]);

    try {
      // Demo mode: return simulated data
      if (isDemo) {
        await new Promise(resolve => setTimeout(resolve, 800)); // Simulate API delay
        const demoTokens = generateDemoTokens().filter(t => t.liquidity >= minLiquidity);
        setTokens(demoTokens);
        setLastScan(new Date().toISOString());
        setApiCount(3);
        toast({
          title: 'Demo Scan Complete',
          description: `Found ${demoTokens.length} simulated opportunities`,
        });
        return { tokens: demoTokens, errors: [], apiErrors: [], timestamp: new Date().toISOString(), apiCount: 3 };
      }

      // Live mode: call real API
      const { data, error } = await supabase.functions.invoke('token-scanner', {
        body: { minLiquidity, chains },
      });

      if (error) throw error;

      const result = data as ScanResult;
      setTokens(result.tokens || []);
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
      } else {
        toast({
          title: 'Scan complete',
          description: `Found ${result.tokens.length} potential opportunities`,
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
      throw error;
    } finally {
      setLoading(false);
    }
  }, [toast, isDemo]);

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
  };
}
