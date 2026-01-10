import { useState, useMemo } from "react";
import AppLayout from "@/components/layout/AppLayout";
import StatsGrid from "@/components/dashboard/StatsGrid";
import WalletBanner from "@/components/dashboard/WalletBanner";
import ActiveTradesCard from "@/components/dashboard/ActiveTradesCard";
import MarketOverview from "@/components/dashboard/MarketOverview";
import QuickActions from "@/components/dashboard/QuickActions";
import RecentActivity from "@/components/dashboard/RecentActivity";
import BotStatusCard from "@/components/dashboard/BotStatusCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { usePositions } from "@/hooks/usePositions";
import { useWallet } from "@/hooks/useWallet";
import { useToast } from "@/hooks/use-toast";
import { useAppMode } from "@/contexts/AppModeContext";
import { PortfolioChart } from "@/components/charts/PriceCharts";
import { TrendingUp, ArrowUpRight, FlaskConical } from "lucide-react";

const formatCurrency = (value: number) => {
  if (Math.abs(value) >= 1000000) return `$${(value / 1000000).toFixed(2)}M`;
  if (Math.abs(value) >= 1000) return `$${(value / 1000).toFixed(1)}K`;
  return `$${value.toFixed(2)}`;
};

const generatePortfolioData = () => {
  const data = [];
  let value = 1000;
  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const change = (Math.random() - 0.4) * 100;
    value = Math.max(value + change, 500);
    data.push({ 
      date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      value: value,
      pnl: value - 1000,
    });
  }
  return data;
};

const Index = () => {
  const { openPositions, closedPositions, loading: positionsLoading } = usePositions();
  const { wallet } = useWallet();
  const { toast } = useToast();
  const { isDemo } = useAppMode();
  
  const [portfolioData] = useState(generatePortfolioData);
  const [isBotActive, setIsBotActive] = useState(false);

  const totalValue = useMemo(() => 
    openPositions.reduce((sum, p) => sum + p.current_value, 0), 
    [openPositions]
  );
  
  const totalPnL = useMemo(() => 
    openPositions.reduce((sum, p) => sum + (p.profit_loss_value || 0), 0),
    [openPositions]
  );
  
  const totalPnLPercent = useMemo(() => {
    const entryTotal = openPositions.reduce((sum, p) => sum + p.entry_value, 0);
    return entryTotal > 0 ? (totalPnL / entryTotal) * 100 : 0;
  }, [openPositions, totalPnL]);

  const todayPerformance = useMemo(() => {
    const initial = portfolioData[0]?.value || 1000;
    const current = portfolioData[portfolioData.length - 1]?.value || 1000;
    return ((current - initial) / initial) * 100;
  }, [portfolioData]);

  const handleBotToggle = (active: boolean) => {
    setIsBotActive(active);
    toast({
      title: active ? "Bot Activated" : "Bot Deactivated",
      description: active 
        ? (isDemo ? "Liquidity bot is running in demo mode (simulation)" : "Liquidity bot is now scanning for opportunities")
        : "Automatic trading has been paused",
    });
  };

  return (
    <AppLayout>
      <div className="container mx-auto max-w-7xl px-4 space-y-6">
        {/* Demo Mode Banner */}
        {isDemo && (
          <Alert className="bg-warning/10 border-warning/30">
            <FlaskConical className="h-4 w-4 text-warning" />
            <AlertTitle className="text-warning">Demo Mode</AlertTitle>
            <AlertDescription className="text-warning/80">
              You're viewing simulated data. Switch to Live mode for real trading.
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
                      <CardTitle className="text-base font-semibold">Portfolio Performance</CardTitle>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-2xl font-bold text-foreground">
                          {formatCurrency(portfolioData[portfolioData.length - 1]?.value || 1000)}
                        </span>
                        <Badge 
                          variant="outline" 
                          className={`text-xs ${todayPerformance >= 0 ? 'bg-success/10 text-success border-success/30' : 'bg-destructive/10 text-destructive border-destructive/30'}`}
                        >
                          <ArrowUpRight className="w-3 h-3 mr-0.5" />
                          {todayPerformance >= 0 ? '+' : ''}{todayPerformance.toFixed(2)}% (7D)
                        </Badge>
                      </div>
                    </div>
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
            {/* Bot Status */}
            <BotStatusCard 
              isActive={isBotActive}
              onToggle={handleBotToggle}
              tokensScanned={1247}
              tradesExecuted={12}
            />
            
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
