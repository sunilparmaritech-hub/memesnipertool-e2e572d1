import { useState, useMemo } from "react";
import AppLayout from "@/components/layout/AppLayout";
import StatsGrid from "@/components/dashboard/StatsGrid";
import WalletBanner from "@/components/dashboard/WalletBanner";
import ActiveTradesCard from "@/components/dashboard/ActiveTradesCard";
import MarketOverview from "@/components/dashboard/MarketOverview";
import QuickActions from "@/components/dashboard/QuickActions";
import RecentActivity from "@/components/dashboard/RecentActivity";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { usePositions } from "@/hooks/usePositions";
import { useWallet } from "@/hooks/useWallet";
import { useAppMode } from "@/contexts/AppModeContext";
import { useDemoPortfolio } from "@/contexts/DemoPortfolioContext";
import { PortfolioChart } from "@/components/charts/PriceCharts";
import { TrendingUp, ArrowUpRight, FlaskConical, Coins } from "lucide-react";

const formatCurrency = (value: number) => {
  if (Math.abs(value) >= 1000000) return `$${(value / 1000000).toFixed(2)}M`;
  if (Math.abs(value) >= 1000) return `$${(value / 1000).toFixed(1)}K`;
  return `$${value.toFixed(2)}`;
};

const Index = () => {
  const { openPositions: realOpenPositions, closedPositions: realClosedPositions, loading: positionsLoading } = usePositions();
  const { wallet } = useWallet();
  const { isDemo } = useAppMode();
  
  // Demo portfolio context
  const {
    demoBalance,
    openDemoPositions,
    closedDemoPositions,
    portfolioHistory,
    selectedPeriod,
    setSelectedPeriod,
    getCurrentPortfolioData,
    totalValue: demoTotalValue,
    totalPnL: demoTotalPnL,
    totalPnLPercent: demoTotalPnLPercent,
  } = useDemoPortfolio();

  // Use demo or real positions based on mode
  const openPositions = isDemo ? openDemoPositions : realOpenPositions;
  const closedPositions = isDemo ? closedDemoPositions : realClosedPositions;

  // Get portfolio data based on mode
  const portfolioData = useMemo(() => getCurrentPortfolioData(), [getCurrentPortfolioData, selectedPeriod]);

  const totalValue = useMemo(() => {
    if (isDemo) {
      return demoTotalValue;
    }
    return realOpenPositions.reduce((sum, p) => sum + p.current_value, 0);
  }, [isDemo, demoTotalValue, realOpenPositions]);
  
  const totalPnL = useMemo(() => {
    if (isDemo) {
      return demoTotalPnL;
    }
    return realOpenPositions.reduce((sum, p) => sum + (p.profit_loss_value || 0), 0);
  }, [isDemo, demoTotalPnL, realOpenPositions]);
  
  const totalPnLPercent = useMemo(() => {
    if (isDemo) {
      return demoTotalPnLPercent;
    }
    const entryTotal = realOpenPositions.reduce((sum, p) => sum + p.entry_value, 0);
    return entryTotal > 0 ? (totalPnL / entryTotal) * 100 : 0;
  }, [isDemo, demoTotalPnLPercent, realOpenPositions, totalPnL]);

  const todayPerformance = useMemo(() => {
    if (portfolioData.length < 2) return 0;
    const initial = portfolioData[0]?.value || totalValue;
    const current = portfolioData[portfolioData.length - 1]?.value || totalValue;
    return initial > 0 ? ((current - initial) / initial) * 100 : 0;
  }, [portfolioData, totalValue]);

  return (
    <AppLayout>
      <div className="container mx-auto max-w-7xl px-4 space-y-6">
        {/* Demo Mode Banner */}
        {isDemo && (
          <Alert className="bg-warning/10 border-warning/30">
            <FlaskConical className="h-4 w-4 text-warning" />
            <AlertTitle className="text-warning flex items-center gap-2">
              Demo Mode Active
              <Badge className="bg-warning/20 text-warning border-warning/30 ml-2">
                <Coins className="w-3 h-3 mr-1" />
                {demoBalance.toFixed(0)} SOL
              </Badge>
            </AlertTitle>
            <AlertDescription className="text-warning/80">
              You're trading with simulated {demoBalance.toFixed(0)} SOL. Switch to Live mode for real trading.
            </AlertDescription>
          </Alert>
        )}

        {/* Wallet Banner */}
        {wallet.isConnected && wallet.address && (
          <WalletBanner 
            address={wallet.address} 
            balance={wallet.balance || '0'} 
            network={wallet.network || 'solana'} 
          />
        )}

        {/* Stats Grid */}
        <StatsGrid
          totalValue={totalValue}
          totalPnL={totalPnL}
          totalPnLPercent={totalPnLPercent}
          openPositionsCount={openPositions.length}
          closedPositionsCount={closedPositions.length}
        />

        {/* Main Content Grid */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left Column - 2/3 width */}
          <div className="lg:col-span-2 space-y-6">
            {/* Portfolio Chart */}
            <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-card/90 to-card/60 backdrop-blur-xl animate-fade-in">
              <div className="absolute inset-0 opacity-30">
                <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl" />
              </div>
              
              <CardHeader className="relative pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/10">
                      <TrendingUp className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-base font-semibold">
                        {isDemo ? "Demo Portfolio" : "Portfolio Performance"}
                      </CardTitle>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-2xl font-bold text-foreground">
                          {isDemo 
                            ? `${demoBalance.toFixed(0)} SOL`
                            : formatCurrency(portfolioData[portfolioData.length - 1]?.value || totalValue)
                          }
                        </span>
                        <Badge 
                          variant="outline" 
                          className={`text-xs ${todayPerformance >= 0 ? 'bg-success/10 text-success border-success/30' : 'bg-destructive/10 text-destructive border-destructive/30'}`}
                        >
                          <ArrowUpRight className="w-3 h-3 mr-0.5" />
                          {todayPerformance >= 0 ? '+' : ''}{todayPerformance.toFixed(2)}% ({selectedPeriod})
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1 bg-secondary/60 rounded-lg p-0.5">
                    {(['1H', '24H', '7D', '30D'] as const).map((period) => (
                      <button
                        key={period}
                        onClick={() => setSelectedPeriod(period)}
                        className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                          period === selectedPeriod 
                            ? 'bg-primary text-primary-foreground' 
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        {period}
                      </button>
                    ))}
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="relative">
                <PortfolioChart data={portfolioData} height={200} />
              </CardContent>
            </Card>

            {/* Active Trades + Market Overview */}
            <div className="grid md:grid-cols-2 gap-6">
              <ActiveTradesCard 
                positions={openPositions} 
                loading={positionsLoading}
              />
              <MarketOverview />
            </div>
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            {/* Quick Actions */}
            <QuickActions />
            
            {/* Recent Activity */}
            <RecentActivity />
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default Index;
