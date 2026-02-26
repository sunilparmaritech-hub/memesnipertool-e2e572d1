/**
 * Scanner Stats Hook
 * 
 * Computes portfolio metrics (invested, value, P&L) from positions data.
 * Extracted from Scanner.tsx to reduce monolith size.
 */

import { useMemo } from 'react';
import { useAppMode } from '@/contexts/AppModeContext';
import { useDemoPortfolio } from '@/contexts/DemoPortfolioContext';
import { usePositions } from '@/hooks/usePositions';

interface ScannerStatsOptions {
  tradeAmount: number;
  solPrice: number;
}

export function useScannerStats(options: ScannerStatsOptions) {
  const { tradeAmount, solPrice } = options;
  const { isDemo } = useAppMode();
  const {
    openDemoPositions,
    closedDemoPositions,
    totalValue: demoTotalValue,
    totalPnL: demoTotalPnL,
    totalPnLPercent: demoTotalPnLPercent,
  } = useDemoPortfolio();
  const { openPositions: realOpenPositions, closedPositions: realClosedPositions } = usePositions();

  const openPositions = isDemo ? openDemoPositions : realOpenPositions;
  const closedPositions = isDemo ? closedDemoPositions : realClosedPositions;

  // Total SOL invested (what the user actually spent)
  const totalInvestedSol = useMemo(() => {
    if (isDemo) {
      return openDemoPositions.length * (tradeAmount || 0.1);
    }
    return realOpenPositions.reduce((sum, p) => {
      return sum + (p.entry_value ?? (tradeAmount || 0.04));
    }, 0);
  }, [isDemo, openDemoPositions.length, realOpenPositions, tradeAmount]);

  // Open Value in SOL
  const totalValueSol = useMemo(() => {
    if (isDemo) return demoTotalValue;
    return realOpenPositions.reduce((sum, p) => {
      const entryVal = p.entry_value ?? 0;
      const entryPriceUsd = p.entry_price_usd ?? p.entry_price ?? 0;
      const currentPrice = p.current_price ?? entryPriceUsd;
      if (entryVal <= 0 || entryPriceUsd <= 0) return sum + entryVal;
      return sum + (entryVal * (currentPrice / entryPriceUsd));
    }, 0);
  }, [isDemo, demoTotalValue, realOpenPositions]);

  // Open P&L in SOL (unrealized)
  const openPnLSol = useMemo(() => totalValueSol - totalInvestedSol, [totalValueSol, totalInvestedSol]);

  // Closed P&L in SOL (realized)
  const closedPnLSol = useMemo(() => {
    if (isDemo) {
      return closedDemoPositions.reduce((sum, p) => {
        const exitPrice = p.exit_price ?? p.current_price ?? p.entry_price ?? 0;
        const entryPrice = p.entry_price ?? 0;
        const entryVal = p.entry_value || 0;
        if (entryPrice <= 0 || entryVal <= 0) return sum;
        return sum + ((entryVal * (exitPrice / entryPrice)) - entryVal);
      }, 0);
    }
    return realClosedPositions.reduce((sum, p) => {
      const exitPrice = p.exit_price ?? p.current_price ?? p.entry_price ?? 0;
      const entryPriceUsd = p.entry_price_usd ?? p.entry_price ?? 0;
      const entryVal = p.entry_value ?? 0;
      if (entryPriceUsd <= 0 || entryVal <= 0) return sum;
      return sum + ((entryVal * (exitPrice / entryPriceUsd)) - entryVal);
    }, 0);
  }, [isDemo, closedDemoPositions, realClosedPositions]);

  // Total P&L
  const totalPnLSol = useMemo(() => {
    if (isDemo) return demoTotalPnL;
    return openPnLSol + closedPnLSol;
  }, [isDemo, demoTotalPnL, openPnLSol, closedPnLSol]);

  // Total invested across ALL positions for percentage
  const closedInvestedSol = useMemo(() => {
    if (isDemo) {
      return closedDemoPositions.length * (tradeAmount || 0.1);
    }
    return realClosedPositions.reduce((sum, p) => {
      return sum + (p.entry_value ?? (tradeAmount || 0.04));
    }, 0);
  }, [isDemo, closedDemoPositions.length, realClosedPositions, tradeAmount]);

  const allInvestedSol = useMemo(() => totalInvestedSol + closedInvestedSol, [totalInvestedSol, closedInvestedSol]);

  const totalPnLPercent = useMemo(() => {
    if (isDemo) return demoTotalPnLPercent;
    return allInvestedSol > 0 ? (totalPnLSol / allInvestedSol) * 100 : 0;
  }, [isDemo, demoTotalPnLPercent, allInvestedSol, totalPnLSol]);

  // Win rate
  const winRate = closedPositions.length > 0
    ? (closedPositions.filter(p => (p.profit_loss_percent || 0) > 0).length / closedPositions.length) * 100
    : 0;

  return {
    totalInvestedSol,
    totalValueSol,
    openPnLSol,
    closedPnLSol,
    totalPnLSol,
    totalPnLPercent,
    winRate,
    openPositionsCount: openPositions.length,
    closedPositionsCount: closedPositions.length,
  };
}
