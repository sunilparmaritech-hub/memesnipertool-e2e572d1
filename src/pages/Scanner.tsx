import { useState, useEffect, useCallback, useMemo } from "react";
import TradingHeader from "@/components/trading/TradingHeader";
import LiquidityBotPanel from "@/components/trading/LiquidityBotPanel";
import LiquidityMonitor from "@/components/scanner/LiquidityMonitor";
import PerformancePanel from "@/components/scanner/PerformancePanel";
import ActivePositionsPanel from "@/components/scanner/ActivePositionsPanel";
import StatsCard from "@/components/StatsCard";
import { PortfolioChart } from "@/components/charts/PriceCharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useTokenScanner } from "@/hooks/useTokenScanner";
import { useSniperSettings } from "@/hooks/useSniperSettings";
import { useAutoSniper } from "@/hooks/useAutoSniper";
import { useWallet } from "@/hooks/useWallet";
import { usePositions } from "@/hooks/usePositions";
import { useToast } from "@/hooks/use-toast";
import { useAppMode } from "@/contexts/AppModeContext";
import { Wallet, TrendingUp, Zap, Activity, AlertTriangle, X, FlaskConical } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

const generatePortfolioData = () => {
  const data = [];
  let value = 1000;
  const now = new Date();
  for (let i = 24; i >= 0; i--) {
    const time = new Date(now.getTime() - i * 60 * 60 * 1000);
    const change = (Math.random() - 0.4) * 100;
    value = Math.max(value + change, 500);
    data.push({ 
      date: time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      value: value,
      pnl: value - 1000,
    });
  }
  return data;
};

const Scanner = () => {
  const { tokens, loading, scanTokens, errors, apiErrors, isDemo } = useTokenScanner();
  const { settings, saving, saveSettings, updateField } = useSniperSettings();
  const { evaluateTokens } = useAutoSniper();
  const { wallet, connectPhantom, disconnect, refreshBalance } = useWallet();
  const { openPositions, closedPositions } = usePositions();
  const { toast } = useToast();
  const { mode } = useAppMode();

  const [isBotActive, setIsBotActive] = useState(false);
  const [portfolioData] = useState(generatePortfolioData);
  const [scanSpeed, setScanSpeed] = useState<'slow' | 'normal' | 'fast'>('normal');
  const [isPaused, setIsPaused] = useState(false);
  const [showApiErrors, setShowApiErrors] = useState(true);

  // Calculate stats
  const totalValue = useMemo(() => 
    openPositions.reduce((sum, p) => sum + p.current_value, 0) + 1890, 
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

  // Calculate today's change
  const todayChange = useMemo(() => {
    const initial = portfolioData[0]?.value || 1000;
    const current = portfolioData[portfolioData.length - 1]?.value || 1000;
    const change = current - initial;
    const percent = (change / initial) * 100;
    return { value: change, percent };
  }, [portfolioData]);

  // Auto-scan on mount
  useEffect(() => {
    if (settings?.min_liquidity && !isPaused) {
      scanTokens(settings.min_liquidity);
    }
  }, [settings?.min_liquidity]);

  // Periodic scanning based on speed - optimized intervals
  useEffect(() => {
    if (isPaused) return;
    
    // Demo mode uses faster intervals since no real API calls
    const intervals = isDemo 
      ? { slow: 30000, normal: 15000, fast: 5000 }
      : { slow: 90000, normal: 45000, fast: 20000 }; // Longer intervals for live to reduce API load
    
    const interval = setInterval(() => {
      if (settings?.min_liquidity) {
        scanTokens(settings.min_liquidity);
      }
    }, intervals[scanSpeed]);
    
    return () => clearInterval(interval);
  }, [scanSpeed, isPaused, settings?.min_liquidity, scanTokens, isDemo]);

  // Auto-sniper when bot is active (only in live mode)
  useEffect(() => {
    if (!isBotActive || tokens.length === 0 || !settings || isDemo) return;
    
    const tokenData = tokens.slice(0, 10).map(t => ({
      address: t.address,
      name: t.name,
      symbol: t.symbol,
      chain: t.chain,
      liquidity: t.liquidity,
      liquidityLocked: t.liquidityLocked,
      lockPercentage: t.lockPercentage,
      buyerPosition: t.buyerPosition,
      riskScore: t.riskScore,
      categories: [],
    }));
    
    evaluateTokens(tokenData, true);
  }, [isBotActive, tokens.length, isDemo]);

  const handleConnectWallet = async () => {
    if (wallet.isConnected) {
      await disconnect();
    } else {
      await connectPhantom();
    }
  };

  const handleSaveSettings = async () => {
    if (!settings) return;
    try {
      await saveSettings(settings);
    } catch {
      // Error handled in hook
    }
  };

  const handleToggleBotActive = (active: boolean) => {
    if (active && isDemo) {
      toast({
        title: "Demo Mode Active",
        description: "Bot is running in simulation mode. No real trades will be executed.",
        variant: "default",
      });
    }
    setIsBotActive(active);
    toast({
      title: active ? "Liquidity Bot Activated" : "Liquidity Bot Deactivated",
      description: active 
        ? (isDemo ? "Bot will simulate trades (Demo Mode)" : "Bot will automatically enter trades when conditions are met")
        : "Automatic trading has been paused",
    });
  };

  // Win rate calculation
  const winRate = closedPositions.length > 0 
    ? (closedPositions.filter(p => (p.profit_loss_percent || 0) > 0).length / closedPositions.length) * 100 
    : 0;

  return (
    <div className="min-h-screen bg-background">
      <TradingHeader
        walletConnected={wallet.isConnected}
        walletAddress={wallet.address || undefined}
        network={wallet.network}
        onConnectWallet={handleConnectWallet}
      />

      <main className="pt-20 pb-6 px-4">
        <div className="container mx-auto space-y-6">
          {/* Demo Mode Banner */}
          {isDemo && (
            <Alert className="bg-warning/10 border-warning/30">
              <FlaskConical className="h-4 w-4 text-warning" />
              <AlertTitle className="text-warning">Demo Mode Active</AlertTitle>
              <AlertDescription className="text-warning/80">
                You're viewing simulated data. Switch to Live mode in the header to connect to real APIs and execute real trades.
              </AlertDescription>
            </Alert>
          )}

          {/* API Errors Alert - Only show in Live mode */}
          {!isDemo && apiErrors.length > 0 && showApiErrors && (
            <Alert variant="destructive" className="relative">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle className="flex items-center justify-between">
                <span>API Issues Detected ({apiErrors.length})</span>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-6 w-6 absolute top-2 right-2"
                  onClick={() => setShowApiErrors(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </AlertTitle>
              <AlertDescription>
                <div className="mt-2 space-y-1">
                  {apiErrors.map((error, index) => (
                    <div key={index} className="flex items-center justify-between text-sm bg-destructive/10 rounded px-2 py-1">
                      <div>
                        <span className="font-medium">{error.apiName}</span>
                        <span className="text-muted-foreground ml-2">({error.apiType})</span>
                      </div>
                      <span className="text-xs text-muted-foreground">{error.errorMessage}</span>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  View Admin Panel → Analytics for detailed API health monitoring
                </p>
              </AlertDescription>
            </Alert>
          )}

          {/* Stats Row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatsCard
              title="Portfolio Value"
              value={`$${totalValue.toFixed(2)}`}
              change={`${totalPnLPercent >= 0 ? '+' : ''}${totalPnLPercent.toFixed(1)}% total`}
              changeType={totalPnLPercent >= 0 ? 'positive' : 'negative'}
              icon={Wallet}
            />
            <StatsCard
              title="Active Trades"
              value={openPositions.length.toString()}
              change={`${openPositions.filter(p => (p.profit_loss_percent || 0) > 0).length} profitable`}
              changeType="positive"
              icon={TrendingUp}
            />
            <StatsCard
              title="Pools Detected"
              value={tokens.length.toString()}
              change={`${tokens.filter(t => t.riskScore < 50).length} signals`}
              changeType="neutral"
              icon={Zap}
            />
            <StatsCard
              title="Win Rate"
              value={`${winRate.toFixed(0)}%`}
              change={`${closedPositions.length} trades`}
              changeType={winRate >= 50 ? 'positive' : winRate > 0 ? 'negative' : 'neutral'}
              icon={Activity}
            />
          </div>

          {/* Main Content Grid */}
          <div className="grid lg:grid-cols-[1fr,380px] gap-6">
            {/* Left Column */}
            <div className="space-y-6">
              {/* Portfolio Chart */}
              <Card className="bg-card/80 backdrop-blur-sm border-border/50">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base font-semibold">Portfolio Value</CardTitle>
                      <div className="flex items-baseline gap-2 mt-1">
                        <span className="text-2xl font-bold text-foreground">${totalValue.toFixed(2)}</span>
                        <span className={`text-sm font-medium ${todayChange.value >= 0 ? 'text-success' : 'text-destructive'}`}>
                          {todayChange.value >= 0 ? '+' : ''}${todayChange.value.toFixed(2)} ({todayChange.percent.toFixed(2)}%) today
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-1 bg-secondary/60 rounded-lg p-0.5">
                      {['1H', '24H', '7D', '30D'].map((period) => (
                        <button
                          key={period}
                          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                            period === '24H' 
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
                <CardContent>
                  <PortfolioChart data={portfolioData} height={250} />
                </CardContent>
              </Card>

              {/* Liquidity Monitor */}
              <LiquidityMonitor 
                pools={tokens}
                activeTrades={openPositions.length}
                loading={loading}
                apiStatus={loading ? 'active' : 'waiting'}
              />
            </div>

            {/* Right Column - Bot Settings & Performance */}
            <div className="space-y-6">
              {/* Liquidity Bot Panel */}
              <LiquidityBotPanel
                settings={settings}
                saving={saving}
                onUpdateField={updateField}
                onSave={handleSaveSettings}
                isActive={isBotActive}
                onToggleActive={handleToggleBotActive}
              />

              {/* Performance Panel */}
              <PerformancePanel
                winRate={winRate}
                totalPnL={totalPnLPercent}
                avgPnL={totalPnLPercent / Math.max(closedPositions.length, 1)}
                bestTrade={Math.max(...closedPositions.map(p => p.profit_loss_percent || 0), 0)}
                worstTrade={Math.min(...closedPositions.map(p => p.profit_loss_percent || 0), 0)}
                totalTrades={closedPositions.length}
              />

              {/* Active Positions */}
              <ActivePositionsPanel positions={openPositions} />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Scanner;
