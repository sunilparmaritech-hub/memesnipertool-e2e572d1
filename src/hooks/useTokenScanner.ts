import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

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

interface ScanResult {
  tokens: ScannedToken[];
  errors: string[];
  timestamp: string;
  apiCount: number;
}

export function useTokenScanner() {
  const [tokens, setTokens] = useState<ScannedToken[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastScan, setLastScan] = useState<string | null>(null);
  const [apiCount, setApiCount] = useState(0);
  const [errors, setErrors] = useState<string[]>([]);
  const { toast } = useToast();

  const scanTokens = useCallback(async (minLiquidity: number = 300, chains: string[] = ['solana']) => {
    setLoading(true);
    setErrors([]);

    try {
      const { data, error } = await supabase.functions.invoke('token-scanner', {
        body: { minLiquidity, chains },
      });

      if (error) throw error;

      const result = data as ScanResult;
      setTokens(result.tokens || []);
      setLastScan(result.timestamp);
      setApiCount(result.apiCount);
      
      if (result.errors && result.errors.length > 0) {
        setErrors(result.errors);
        toast({
          title: 'Scan completed with warnings',
          description: `${result.errors.length} API(s) had issues`,
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
  }, [toast]);

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
    scanTokens,
    getTopOpportunities,
    filterByChain,
    filterByRisk,
  };
}
