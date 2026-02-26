/**
 * Token Holders Hook
 * 
 * Fetches real holder count and buyer position data from on-chain RPC.
 * Uses hybrid approach: fast holder count + background position calculation.
 */

import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface TokenHolderData {
  tokenAddress: string;
  holderCount: number;
  topHolders: {
    address: string;
    balance: number;
    percentage: number;
  }[];
  buyerPosition?: number;
  calculatedAt: string;
}

interface UseTokenHoldersOptions {
  /** Automatically fetch holder data when tokens change */
  autoFetch?: boolean;
  /** Include buyer position calculation (slower but required for strict validation) */
  includePosition?: boolean;
  /** Wallet address for position calculation */
  walletAddress?: string;
}

export function useTokenHolders(options: UseTokenHoldersOptions = {}) {
  // CRITICAL: Default includePosition to TRUE for strict position validation
  const { autoFetch = false, includePosition = true, walletAddress } = options;
  
  const [holders, setHolders] = useState<Map<string, TokenHolderData>>(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Track pending requests to avoid duplicates
  const pendingRef = useRef<Set<string>>(new Set());
  
  /**
   * Fetch holder data for multiple tokens
   */
  const fetchHolders = useCallback(async (tokenAddresses: string[]): Promise<Map<string, TokenHolderData>> => {
    if (tokenAddresses.length === 0) {
      return new Map();
    }
    
    // Filter out already pending or cached tokens
    const newAddresses = tokenAddresses.filter(addr => {
      if (pendingRef.current.has(addr)) return false;
      // Allow refresh if data is older than 60 seconds
      const cached = holders.get(addr);
      if (cached) {
        const age = Date.now() - new Date(cached.calculatedAt).getTime();
        if (age < 60000) return false;
      }
      return true;
    });
    
    if (newAddresses.length === 0) {
      return holders;
    }
    
    // Mark as pending
    newAddresses.forEach(addr => pendingRef.current.add(addr));
    
    setLoading(true);
    setError(null);
    
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      
      if (!sessionData?.session?.access_token) {
        throw new Error('Not authenticated');
      }
      
      const response = await supabase.functions.invoke('token-holders', {
        body: {
          tokenAddresses: newAddresses,
          includePosition,
          walletAddress,
        },
      });
      
      if (response.error) {
        throw new Error(response.error.message);
      }
      
      const responseHolders = response.data?.holders as Record<string, TokenHolderData> | undefined;
      
      if (responseHolders) {
        setHolders(prev => {
          const updated = new Map(prev);
          for (const [address, data] of Object.entries(responseHolders)) {
            updated.set(address, data);
          }
          return updated;
        });
      }
      
      // Clear pending
      newAddresses.forEach(addr => pendingRef.current.delete(addr));
      
      return holders;
      
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch holder data';
      setError(message);
      console.error('[useTokenHolders] Error:', err);
      
      // Clear pending on error
      newAddresses.forEach(addr => pendingRef.current.delete(addr));
      
      return holders;
      
    } finally {
      setLoading(false);
    }
  }, [holders, includePosition, walletAddress]);
  
  /**
   * Get holder data for a single token (from cache or fetch)
   */
  const getHolder = useCallback((tokenAddress: string): TokenHolderData | undefined => {
    return holders.get(tokenAddress);
  }, [holders]);
  
  /**
   * Get holder count for a token (convenience method)
   */
  const getHolderCount = useCallback((tokenAddress: string): number | null => {
    const data = holders.get(tokenAddress);
    return data?.holderCount ?? null;
  }, [holders]);
  
  /**
   * Get buyer position for a token (convenience method)
   */
  const getBuyerPosition = useCallback((tokenAddress: string): number | null => {
    const data = holders.get(tokenAddress);
    return data?.buyerPosition ?? null;
  }, [holders]);
  
  /**
   * Clear cached data
   */
  const clearCache = useCallback(() => {
    setHolders(new Map());
    pendingRef.current.clear();
  }, []);
  
  return {
    holders,
    loading,
    error,
    fetchHolders,
    getHolder,
    getHolderCount,
    getBuyerPosition,
    clearCache,
  };
}
