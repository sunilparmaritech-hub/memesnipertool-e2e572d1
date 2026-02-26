/**
 * Scanner Store - Zustand-based Global State
 * 
 * Persists detected pools/tokens across:
 * - Tab switches (Active, Waiting, Pools)
 * - Page navigation
 * - Component remounts
 * 
 * Uses sessionStorage for persistence within browser session
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { ScannedToken, ScanStats, ApiError, RateLimitState } from '@/hooks/useTokenScanner';

// Tab types for the monitor
export type MonitorTab = 'pools' | 'trades' | 'waiting';

// Gate result stored in scanner state
export interface StoredGateResult {
  token: string;
  decision: {
    allowed: boolean;
    state: string;
    riskScore: number;
    reasons: string[];
    failedRules: string[];
    passedRules: string[];
    [key: string]: unknown;
  };
}

interface ScannerState {
  // Token data
  tokens: ScannedToken[];
  lastScan: string | null;
  apiCount: number;
  errors: string[];
  apiErrors: ApiError[];
  lastScanStats: ScanStats | null;
  
  // Gate results - persisted across navigation
  gateResults: StoredGateResult[];
  
  // Rate limiting
  rateLimit: RateLimitState;
  
  // Loading states
  isInitialLoad: boolean;
  
  // UI state - persisted
  activeTab: MonitorTab;
  searchTerm: string;
  
  // Configurable pool limit
  maxPoolSize: number;
  
  // Actions
  setTokens: (tokens: ScannedToken[]) => void;
  mergeTokens: (newTokens: ScannedToken[]) => void;
  updateTokenPrices: (updates: Map<string, Partial<ScannedToken>>) => void;
  setLastScan: (timestamp: string) => void;
  setApiCount: (count: number) => void;
  setErrors: (errors: string[]) => void;
  setApiErrors: (errors: ApiError[]) => void;
  setLastScanStats: (stats: ScanStats | null) => void;
  setGateResults: (results: StoredGateResult[]) => void;
  mergeGateResults: (results: StoredGateResult[]) => void;
  setRateLimit: (rateLimit: RateLimitState) => void;
  setIsInitialLoad: (isInitial: boolean) => void;
  setActiveTab: (tab: MonitorTab) => void;
  setSearchTerm: (term: string) => void;
  setMaxPoolSize: (size: number) => void;
  clearTokens: () => void;
  removeToken: (address: string) => void;
}

const DEFAULT_MAX_TOKENS = 100;

export const useScannerStore = create<ScannerState>()(
  persist(
    (set, get) => ({
      // Initial state
      tokens: [],
      lastScan: null,
      apiCount: 0,
      errors: [],
      apiErrors: [],
      lastScanStats: null,
      rateLimit: {
        isLimited: false,
        remainingScans: 10,
        resetTime: null,
        countdown: 0,
      },
      isInitialLoad: true,
      activeTab: 'pools',
      searchTerm: '',
      maxPoolSize: DEFAULT_MAX_TOKENS,
      gateResults: [],

      // Actions
      setTokens: (tokens) => set((state) => ({ tokens: tokens.slice(0, state.maxPoolSize) })),
      
      mergeTokens: (newTokens) => set((state) => {
        const tokenMap = new Map<string, ScannedToken>();
        const processedAddresses = new Set<string>();
        
        // Add existing tokens to map
        state.tokens.forEach(t => {
          if (!processedAddresses.has(t.address)) {
            tokenMap.set(t.address, t);
            processedAddresses.add(t.address);
          }
        });
        
        // Merge new tokens - update existing or add new
        newTokens.forEach(newToken => {
          const existing = tokenMap.get(newToken.address);
          if (existing) {
            // Update existing token's data
            tokenMap.set(newToken.address, {
              ...existing,
              priceUsd: newToken.priceUsd,
              priceChange24h: newToken.priceChange24h,
              volume24h: newToken.volume24h,
              liquidity: newToken.liquidity,
              marketCap: newToken.marketCap,
              holders: newToken.holders,
              riskScore: newToken.riskScore,
              // Preserve safety data if new token has it
              ...(newToken.isTradeable !== undefined && { isTradeable: newToken.isTradeable }),
              ...(newToken.canBuy !== undefined && { canBuy: newToken.canBuy }),
              ...(newToken.canSell !== undefined && { canSell: newToken.canSell }),
            });
          } else {
            tokenMap.set(newToken.address, newToken);
            processedAddresses.add(newToken.address);
          }
        });
        
        // Build ordered array: new tokens first, then existing
        const existingAddresses = state.tokens.map(t => t.address);
        const orderedTokens: ScannedToken[] = [];
        const addedAddresses = new Set<string>();
        
        // Add new tokens at top
        newTokens.forEach(t => {
          if (!existingAddresses.includes(t.address) && !addedAddresses.has(t.address)) {
            const token = tokenMap.get(t.address);
            if (token) {
              orderedTokens.push(token);
              addedAddresses.add(t.address);
            }
          }
        });
        
        // Add existing tokens in original order
        existingAddresses.forEach(addr => {
          if (!addedAddresses.has(addr)) {
            const token = tokenMap.get(addr);
            if (token) {
              orderedTokens.push(token);
              addedAddresses.add(addr);
            }
          }
        });
        
        return { tokens: orderedTokens.slice(0, state.maxPoolSize) };
      }),

      updateTokenPrices: (updates) => set((state) => {
        const updatedTokens = state.tokens.map(token => {
          const update = updates.get(token.address);
          if (update) {
            return { ...token, ...update };
          }
          return token;
        });
        return { tokens: updatedTokens };
      }),

      setLastScan: (timestamp) => set({ lastScan: timestamp }),
      setApiCount: (count) => set({ apiCount: count }),
      setErrors: (errors) => set({ errors }),
      setApiErrors: (errors) => set({ apiErrors: errors }),
      setLastScanStats: (stats) => set({ lastScanStats: stats }),
      setGateResults: (results) => set({ gateResults: results.slice(-100) }),
      mergeGateResults: (results) => set((state) => {
        const map = new Map<string, StoredGateResult>();
        state.gateResults.forEach(r => map.set(r.token, r));
        results.forEach(r => map.set(r.token, r));
        const merged = Array.from(map.values());
        return { gateResults: merged.slice(-100) };
      }),
      setRateLimit: (rateLimit) => set({ rateLimit }),
      setIsInitialLoad: (isInitial) => set({ isInitialLoad: isInitial }),
      setActiveTab: (tab) => set({ activeTab: tab }),
      setSearchTerm: (term) => set({ searchTerm: term }),
      setMaxPoolSize: (size) => set((state) => {
        const clamped = Math.max(50, Math.min(500, size));
        // If reducing size, trim existing tokens (remove oldest = end of array)
        const trimmedTokens = state.tokens.length > clamped 
          ? state.tokens.slice(0, clamped) 
          : state.tokens;
        return { maxPoolSize: clamped, tokens: trimmedTokens };
      }),
      
      clearTokens: () => set({
        tokens: [], 
        lastScan: null, 
        isInitialLoad: true,
        lastScanStats: null,
      }),
      
      removeToken: (address) => set((state) => ({
        tokens: state.tokens.filter(t => t.address !== address),
      })),
    }),
    {
      name: 'scanner-storage',
      storage: createJSONStorage(() => sessionStorage),
      // Persist tokens, scan metadata, and UI state
      partialize: (state) => ({
        tokens: state.tokens,
        lastScan: state.lastScan,
        apiCount: state.apiCount,
        lastScanStats: state.lastScanStats,
        activeTab: state.activeTab,
        searchTerm: state.searchTerm,
        maxPoolSize: state.maxPoolSize,
        gateResults: state.gateResults,
      }),
    }
  )
);
