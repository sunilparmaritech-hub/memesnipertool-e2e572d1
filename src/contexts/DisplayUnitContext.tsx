import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { useSolPrice } from '@/hooks/useSolPrice';
import { formatPreciseUsd, formatPreciseSol } from '@/lib/precision';

export type DisplayUnit = 'SOL' | 'USD';

interface DisplayUnitContextType {
  displayUnit: DisplayUnit;
  setDisplayUnit: (unit: DisplayUnit) => void;
  toggleDisplayUnit: () => void;
  solPrice: number;
  solPriceLoading: boolean;
  // Conversion utilities
  usdToSol: (usd: number) => number;
  solToUsd: (sol: number) => number;
  // Formatting with proper visual hierarchy
  formatPrimaryValue: (usdValue: number, options?: FormatOptions) => string;
  formatSecondaryValue: (usdValue: number) => string;
  // Format SOL-native values (input is SOL, not USD) - shows SOL primary, USD secondary
  formatSolNativeValue: (solValue: number, options?: FormatOptions) => { primary: string; secondary: string };
  formatDualValue: (usdValue: number, options?: FormatOptions) => { primary: string; secondary: string };
}

interface FormatOptions {
  showSign?: boolean;
  decimals?: number;
}

const DisplayUnitContext = createContext<DisplayUnitContextType | undefined>(undefined);

export function DisplayUnitProvider({ children }: { children: React.ReactNode }) {
  const [displayUnit, setDisplayUnit] = useState<DisplayUnit>('SOL');
  const { price: solPrice, loading: solPriceLoading } = useSolPrice(60000);

  const toggleDisplayUnit = useCallback(() => {
    setDisplayUnit(prev => prev === 'SOL' ? 'USD' : 'SOL');
  }, []);

  const usdToSol = useCallback((usd: number): number => {
    if (!solPrice || solPrice <= 0) return 0;
    if (!Number.isFinite(usd)) return 0;
    return usd / solPrice;
  }, [solPrice]);

  const solToUsd = useCallback((sol: number): number => {
    if (!Number.isFinite(sol)) return 0;
    return sol * solPrice;
  }, [solPrice]);

  // Format SOL value with financial-grade precision
  const formatSolValue = useCallback((sol: number, showSign = false): string => {
    return formatPreciseSol(sol, { showSign });
  }, []);

  // Format USD value with financial-grade precision
  const formatUsdValue = useCallback((usd: number, showSign = false): string => {
    return formatPreciseUsd(usd, { showSign });
  }, []);

  // Primary value based on current display unit
  const formatPrimaryValue = useCallback((usdValue: number, options?: FormatOptions): string => {
    const showSign = options?.showSign ?? false;
    
    if (displayUnit === 'SOL') {
      const solValue = usdToSol(usdValue);
      return formatSolValue(solValue, showSign);
    }
    return formatUsdValue(usdValue, showSign);
  }, [displayUnit, usdToSol, formatSolValue, formatUsdValue]);

  // Secondary value (opposite of primary)
  const formatSecondaryValue = useCallback((usdValue: number): string => {
    if (displayUnit === 'SOL') {
      return `(${formatUsdValue(usdValue)})`;
    }
    const solValue = usdToSol(usdValue);
    return `(${formatSolValue(solValue)})`;
  }, [displayUnit, usdToSol, formatSolValue, formatUsdValue]);

  // Get both values for dual display
  const formatDualValue = useCallback((usdValue: number, options?: FormatOptions): { primary: string; secondary: string } => {
    const showSign = options?.showSign ?? false;
    
    if (displayUnit === 'SOL') {
      const solValue = usdToSol(usdValue);
      return {
        primary: formatSolValue(solValue, showSign),
        secondary: formatUsdValue(usdValue, showSign),
      };
    }
    const solValue = usdToSol(usdValue);
    return {
      primary: formatUsdValue(usdValue, showSign),
      secondary: formatSolValue(solValue, showSign),
    };
  }, [displayUnit, usdToSol, formatSolValue, formatUsdValue]);

  // Format SOL-native values (input is SOL, not USD)
  // Always shows SOL as primary and USD as secondary for consistency
  const formatSolNativeValue = useCallback((solValue: number, options?: FormatOptions): { primary: string; secondary: string } => {
    const showSign = options?.showSign ?? false;
    const usdValue = solToUsd(solValue);
    return {
      primary: formatSolValue(solValue, showSign),
      secondary: formatUsdValue(usdValue, showSign),
    };
  }, [solToUsd, formatSolValue, formatUsdValue]);

  const value = useMemo(() => ({
    displayUnit,
    setDisplayUnit,
    toggleDisplayUnit,
    solPrice,
    solPriceLoading,
    usdToSol,
    solToUsd,
    formatPrimaryValue,
    formatSecondaryValue,
    formatDualValue,
    formatSolNativeValue,
  }), [
    displayUnit,
    toggleDisplayUnit,
    solPrice,
    solPriceLoading,
    usdToSol,
    solToUsd,
    formatPrimaryValue,
    formatSecondaryValue,
    formatDualValue,
    formatSolNativeValue,
  ]);

  return (
    <DisplayUnitContext.Provider value={value}>
      {children}
    </DisplayUnitContext.Provider>
  );
}

export function useDisplayUnit() {
  const context = useContext(DisplayUnitContext);
  if (!context) {
    throw new Error('useDisplayUnit must be used within DisplayUnitProvider');
  }
  return context;
}
