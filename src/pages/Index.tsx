import React, { useMemo, useState, useEffect } from "react";
import AppLayout from "@/components/layout/AppLayout";
import EquityCurveHero from "@/components/dashboard/EquityCurveHero";
import ActivePositionsGrid from "@/components/dashboard/ActivePositionsGrid";
import RiskAnalyticsPanel from "@/components/dashboard/RiskAnalyticsPanel";
import RiskExposurePanel from "@/components/dashboard/RiskExposurePanel";
import DashboardBotStatus from "@/components/dashboard/DashboardBotStatus";
import NonCustodialBadge from "@/components/dashboard/NonCustodialBadge";

import DashboardRiskSidebar from "@/components/dashboard/DashboardRiskSidebar";
import DashboardReferEarn from "@/components/dashboard/DashboardReferEarn";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { usePositions } from "@/hooks/usePositions";
import { useWallet } from "@/hooks/useWallet";
import { useAppMode } from "@/contexts/AppModeContext";
import { useDemoPortfolio } from "@/contexts/DemoPortfolioContext";
import { useDisplayUnit } from "@/contexts/DisplayUnitContext";
import CreditWidget from "@/components/credits/CreditWidget";
import { FlaskConical, Coins, RotateCcw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { differenceInMinutes } from "date-fns";
import { usePortfolioSnapshots } from "@/hooks/usePortfolioSnapshots";

type Period = '1H' | '4H' | '24H' | '7D' | '30D';

function Index() {
  const { openPositions: realOpenPositions, closedPositions: realClosedPositions, loading: positionsLoading } = usePositions();
  const { wallet } = useWallet();
  const { isDemo } = useAppMode();
  const { toast } = useToast();
  const [selectedPeriod, setSelectedPeriod] = useState<Period>('24H');

  const { formatSolNativeValue } = useDisplayUnit();

  const {
    demoBalance, openDemoPositions, closedDemoPositions,
    totalValue: demoTotalValue, totalPnL: demoTotalPnL,
    totalPnLPercent: demoTotalPnLPercent, resetDemoPortfolio,
  } = useDemoPortfolio();

  const openPositions = isDemo ? openDemoPositions : realOpenPositions;
  const closedPositions = isDemo ? closedDemoPositions : realClosedPositions;
  const allDisplayPositions = [...openPositions, ...closedPositions];
  const activeTradesLoading = !isDemo && positionsLoading && realOpenPositions.length === 0;

  // Computed metrics
  const winCount = useMemo(() => closedPositions.filter(p => {
    const pnl = 'profit_loss_percent' in p ? (p.profit_loss_percent ?? 0) : 0;
    return pnl > 0;
  }).length, [closedPositions]);

  const closedPnLValues = useMemo(() => closedPositions.map(p => 'profit_loss_percent' in p ? (p.profit_loss_percent ?? 0) : 0), [closedPositions]);

  const maxDrawdown = useMemo(() => {
    if (closedPnLValues.length === 0) return 0;
    let peak = 0, maxDd = 0, cumulative = 0;
    closedPnLValues.forEach(pnl => { cumulative += pnl; if (cumulative > peak) peak = cumulative; const dd = peak - cumulative; if (dd > maxDd) maxDd = dd; });
    return -maxDd;
  }, [closedPnLValues]);

  const investedSol = useMemo(() => {
    if (isDemo) return openDemoPositions.reduce((sum, p) => sum + (p.entry_value || 0), 0);
    return realOpenPositions.reduce((sum, p) => sum + (p.entry_value ?? 0.04), 0);
  }, [isDemo, openDemoPositions, realOpenPositions]);

  const openValueSol = useMemo(() => {
    if (isDemo) return demoTotalValue;
    return realOpenPositions.reduce((sum, p) => {
      const entryVal = p.entry_value ?? 0;
      const entryPriceUsd = p.entry_price_usd ?? p.entry_price ?? 0;
      const currentPrice = p.current_price ?? entryPriceUsd;
      if (entryVal <= 0 || entryPriceUsd <= 0) return sum + entryVal;
      return sum + (entryVal * (currentPrice / entryPriceUsd));
    }, 0);
  }, [isDemo, demoTotalValue, realOpenPositions]);

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

  const totalPnLSol = useMemo(() => isDemo ? demoTotalPnL : (openValueSol - investedSol) + closedPnLSol, [isDemo, demoTotalPnL, openValueSol, investedSol, closedPnLSol]);

  const allInvestedSol = useMemo(() => {
    const openArr = isDemo ? openDemoPositions : realOpenPositions;
    const closedArr = isDemo ? closedDemoPositions : realClosedPositions;
    return openArr.reduce((s, p) => s + (p.entry_value ?? 0), 0) + closedArr.reduce((s, p) => s + (p.entry_value ?? 0), 0);
  }, [isDemo, openDemoPositions, closedDemoPositions, realOpenPositions, realClosedPositions]);

  const totalPnLPercent = useMemo(() => {
    if (isDemo) return demoTotalPnLPercent;
    return allInvestedSol > 0 ? (totalPnLSol / allInvestedSol) * 100 : 0;
  }, [isDemo, demoTotalPnLPercent, allInvestedSol, totalPnLSol]);

  const winRate = useMemo(() => closedPositions.length > 0 ? (winCount / closedPositions.length) * 100 : 0, [winCount, closedPositions]);

  // Portfolio snapshots - save daily and provide historical data
  const { saveSnapshot } = usePortfolioSnapshots(90);

  // Save snapshot whenever portfolio metrics change (throttled to once per page load)
  useEffect(() => {
    if (isDemo || openPositions.length === 0) return;
    const unrealizedPnL = openValueSol - investedSol;
    saveSnapshot({
      openPositionsCount: openPositions.length,
      totalInvestedSol: investedSol,
      totalValueSol: openValueSol,
      unrealizedPnlSol: unrealizedPnL,
      realizedPnlSol: closedPnLSol,
      totalPnlSol: totalPnLSol,
      solPriceUsd: formatSolNativeValue(1).primary ? parseFloat(formatSolNativeValue(1).secondary?.replace(/[^0-9.]/g, '') || '0') : 0,
      winRate,
      closedTradesCount: closedPositions.length,
    });
  // Only save once on load, not on every rerender
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openPositions.length, closedPositions.length]);

  const lastTradeTime = useMemo(() => {
    const all = [...openPositions, ...closedPositions];
    if (all.length === 0) return null;
    return all.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]?.created_at;
  }, [openPositions, closedPositions]);

  const handleResetDemo = () => {
    resetDemoPortfolio();
    toast({ title: "Demo Reset", description: "Demo balance reset to 100 SOL. All positions cleared." });
  };

  return (
    <AppLayout>
      <div className="container mx-auto max-w-[1600px] px-2 sm:px-3 md:px-5 space-y-3 py-2 sm:py-3">
        {/* Non-Custodial Compliance Badge */}
        <NonCustodialBadge />
        {/* Demo Mode Banner */}
        {isDemo && (
          <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl border border-warning/20 bg-warning/5">
            <div className="flex items-center gap-2 min-w-0">
              <FlaskConical className="w-4 h-4 text-warning shrink-0" />
              <span className="text-xs font-semibold text-warning whitespace-nowrap">Demo Mode</span>
              <Badge className="bg-warning/15 text-warning border-warning/30 text-[10px] px-1.5 py-0">
                <Coins className="w-3 h-3 mr-1" />{demoBalance.toFixed(0)} SOL
              </Badge>
            </div>
            <Button variant="ghost" size="sm" className="h-7 text-[10px] text-warning hover:bg-warning/10 shrink-0" onClick={handleResetDemo}>
              <RotateCcw className="w-3 h-3 mr-1" />Reset
            </Button>
          </div>
        )}

        {/* Main 2-column layout - single col on mobile/tablet, side-by-side on lg+ */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] xl:grid-cols-[1fr_300px] gap-3">
          {/* LEFT COLUMN — Main content */}
          <div className="space-y-3 min-w-0 overflow-hidden">
            {/* Section 1: Portfolio Performance Chart */}
            <EquityCurveHero
              openValueSol={openValueSol}
              investedSol={investedSol}
              totalPnLSol={totalPnLSol}
              totalPnLPercent={totalPnLPercent}
              realizedPnLSol={closedPnLSol}
              unrealizedPnLSol={openValueSol - investedSol}
              maxDrawdown={maxDrawdown}
              selectedPeriod={selectedPeriod}
              onPeriodChange={setSelectedPeriod}
              positions={allDisplayPositions as any}
              loading={activeTradesLoading}
              walletBalance={isDemo ? demoBalance : (parseFloat(wallet.balance || '0') || openValueSol)}
            />

            {/* Active Positions + Risk Analytics side by side on desktop, stacked on tablet */}
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-3">
              <ActivePositionsGrid
                positions={openPositions as any}
                loading={activeTradesLoading}
              />
              <RiskAnalyticsPanel
                winCount={winCount}
                totalClosed={closedPositions.length}
                closedPositions={closedPositions}
                maxDrawdown={maxDrawdown}
                loading={activeTradesLoading}
              />
            </div>

            {/* Risk Exposure + Risk Overview side by side on desktop */}
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-3">
              <RiskExposurePanel
                positions={openPositions as any}
                loading={activeTradesLoading}
              />
              <DashboardRiskSidebar
                positions={openPositions as any}
                totalTrades={closedPositions.length}
              />
            </div>
          </div>

          {/* RIGHT COLUMN — Sidebar */}
          <div className="space-y-2 lg:space-y-3">
            {/* Bot Status */}
            <DashboardBotStatus
              balance={isDemo ? demoBalance : (parseFloat(wallet.balance || '0') || openValueSol)}
              totalPnLPercent={totalPnLPercent}
              winRate={winRate}
              totalTrades={closedPositions.length}
              closedPnLSol={closedPnLSol}
              lastTradeTime={lastTradeTime}
            />

            {/* Credit Widget */}
            {!isDemo && <CreditWidget />}

            {/* Refer & Earn + Wallet Activity */}
            <DashboardReferEarn />
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

export default Index;