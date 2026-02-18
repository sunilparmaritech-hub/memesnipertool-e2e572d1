import React, { useMemo } from "react";
import AppLayout from "@/components/layout/AppLayout";
import ConnectedWalletBanner from "@/components/dashboard/ConnectedWalletBanner";
import PerformanceStatsRow from "@/components/dashboard/PerformanceStatsRow";
import BotPerformancePanel from "@/components/dashboard/BotPerformancePanel";
import TokenPerformanceMatrix from "@/components/dashboard/TokenPerformanceMatrix";
import IntelligencePanels from "@/components/dashboard/IntelligencePanels";
import SnipeHistoryTable from "@/components/dashboard/SnipeHistoryTable";
import RiskExposureChart from "@/components/dashboard/RiskExposureChart";
import AlertCenter from "@/components/dashboard/AlertCenter";
import SolTradesBanner from "@/components/dashboard/SolTradesBanner";
import SubscriptionBanner from "@/components/subscription/SubscriptionBanner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { usePositions } from "@/hooks/usePositions";
import { useWallet } from "@/hooks/useWallet";
import { useAppMode } from "@/contexts/AppModeContext";
import { useDemoPortfolio } from "@/contexts/DemoPortfolioContext";
import { FlaskConical, Coins, RotateCcw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

function Index() {
  const { openPositions: realOpenPositions, closedPositions: realClosedPositions, positions: allPositions, loading: positionsLoading } = usePositions();
  const { wallet } = useWallet();
  const { isDemo } = useAppMode();
  const { toast } = useToast();
  
  // Demo portfolio context
  const {
    demoBalance,
    openDemoPositions,
    closedDemoPositions,
    totalValue: demoTotalValue,
    totalPnL: demoTotalPnL,
    totalPnLPercent: demoTotalPnLPercent,
    resetDemoPortfolio,
  } = useDemoPortfolio();

  // Use demo or real positions based on mode
  const openPositions = isDemo ? openDemoPositions : realOpenPositions;
  const closedPositions = isDemo ? closedDemoPositions : realClosedPositions;

  // Calculate stats from ALL positions (open + closed) for cumulative view
  const totalPnL = useMemo(() => {
    if (isDemo) {
      return demoTotalPnL;
    }
    const openPnL = realOpenPositions.reduce((sum, p) => sum + (p.profit_loss_value ?? 0), 0);
    const closedPnL = realClosedPositions.reduce((sum, p) => sum + (p.profit_loss_value ?? 0), 0);
    return openPnL + closedPnL;
  }, [isDemo, demoTotalPnL, realOpenPositions, realClosedPositions]);
  
  const totalPnLPercent = useMemo(() => {
    if (isDemo) {
      return demoTotalPnLPercent;
    }
    const allPos = [...realOpenPositions, ...realClosedPositions];
    const entryTotal = allPos.reduce((sum, p) => sum + (p.entry_value ?? 0), 0);
    return entryTotal > 0 ? (totalPnL / entryTotal) * 100 : 0;
  }, [isDemo, demoTotalPnLPercent, realOpenPositions, realClosedPositions, totalPnL]);

  // Calculate additional stats
  const roi = totalPnLPercent;
  const sharpeRatio = 1.8; // Would be calculated from volatility data
  const maxDrawdown = -3.5; // Would be calculated from price history
  const avgHoldTime = "4h 22m"; // Would be calculated from position durations
  
  const bestTrade = useMemo(() => {
    const allPos = [...openPositions, ...closedPositions];
    if (allPos.length === 0) return 0;
    return Math.max(...allPos.map(p => p.profit_loss_value ?? 0));
  }, [openPositions, closedPositions]);
  
  const worstTrade = useMemo(() => {
    const allPos = [...openPositions, ...closedPositions];
    if (allPos.length === 0) return 0;
    return Math.min(...allPos.map(p => p.profit_loss_value ?? 0));
  }, [openPositions, closedPositions]);

  // Bot stats
  const tradesToday = closedPositions.filter(p => {
    const today = new Date();
    const closedAt = p.closed_at ? new Date(p.closed_at) : null;
    return closedAt && closedAt.toDateString() === today.toDateString();
  }).length;

  // Reset demo handler
  const handleResetDemo = () => {
    resetDemoPortfolio();
    toast({
      title: "Demo Reset",
      description: "Demo balance reset to 100 SOL. All positions cleared.",
    });
  };

  return (
    <AppLayout>
      <div className="container mx-auto max-w-[1600px] px-3 md:px-4 space-y-3">
        {/* Demo Mode Banner */}
        {isDemo && (
          <Alert className="bg-warning/10 border-warning/30 py-2">
            <FlaskConical className="h-4 w-4 text-warning" />
            <AlertTitle className="text-warning flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                Demo Mode Active
                <Badge className="bg-warning/20 text-warning border-warning/30 text-xs">
                  <Coins className="w-3 h-3 mr-1" />
                  {demoBalance.toFixed(0)} SOL
                </Badge>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                className="h-6 text-xs border-warning/30 text-warning hover:bg-warning/20"
                onClick={handleResetDemo}
              >
                <RotateCcw className="w-3 h-3 mr-1" />
                Reset
              </Button>
            </AlertTitle>
            <AlertDescription className="text-warning/80 text-xs">
              Trading with simulated {demoBalance.toFixed(0)} SOL. Switch to Live for real trading.
            </AlertDescription>
          </Alert>
        )}

        {/* Subscription Banner */}
        <SubscriptionBanner />

        {/* SOL Trades Banner - Informational */}
        <SolTradesBanner />

        {/* Connected Wallet Banner */}
        {wallet.isConnected && wallet.address && (
          <ConnectedWalletBanner 
            address={wallet.address} 
            balance={wallet.balance || '0'} 
            network={wallet.network || 'Solana'} 
          />
        )}

        {/* Performance Stats Row + Bot Performance Panel */}
        <div className="grid gap-3 lg:grid-cols-[1fr_260px]">
          <PerformanceStatsRow
            totalPnL={totalPnL}
            totalPnLPercent={totalPnLPercent}
            roi={roi}
            sharpeRatio={sharpeRatio}
            maxDrawdown={maxDrawdown}
            avgHoldTime={avgHoldTime}
            bestTrade={bestTrade}
            worstTrade={worstTrade}
          />
          <BotPerformancePanel
            uptime={99.9}
            tradesToday={tradesToday}
            pendingSignals={openPositions.length}
            queueStatus={openPositions.length > 0 ? 'active' : 'idle'}
          />
        </div>

        {/* Token Performance Matrix + Intelligence Panels */}
        <div className="grid gap-3 lg:grid-cols-[1fr_280px]">
          <TokenPerformanceMatrix positions={allPositions} />
          <IntelligencePanels />
        </div>

        {/* Bottom Section: Snipe History, Risk Chart, Alert Center */}
        <div className="grid gap-3 lg:grid-cols-[1fr_280px_240px]">
          <SnipeHistoryTable />
          <RiskExposureChart />
          <AlertCenter />
        </div>
      </div>
    </AppLayout>
  );
}

export default Index;
