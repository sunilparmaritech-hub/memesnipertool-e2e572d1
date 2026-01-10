import { useState, useEffect, useCallback, useMemo } from "react";
import TradingHeader from "@/components/trading/TradingHeader";
import LiquidityBotPanel from "@/components/trading/LiquidityBotPanel";
import LiquidityMonitor from "@/components/scanner/LiquidityMonitor";
import PerformancePanel from "@/components/scanner/PerformancePanel";
import ActivePositionsPanel from "@/components/scanner/ActivePositionsPanel";
import StatsCard from "@/components/StatsCard";
import { PortfolioChart } from "@/components/charts/PriceCharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTokenScanner } from "@/hooks/useTokenScanner";
import { useSniperSettings } from "@/hooks/useSniperSettings";
import { useAutoSniper } from "@/hooks/useAutoSniper";
import { useWallet } from "@/hooks/useWallet";
import { usePositions } from "@/hooks/usePositions";
import { useToast } from "@/hooks/use-toast";
import { Wallet, TrendingUp, Zap, Activity } from "lucide-react";

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
  const { tokens, loading, scanTokens } = useTokenScanner();
  const { settings, saving, saveSettings, updateField } = useSniperSettings();
  const { evaluateTokens } = useAutoSniper();
  const { wallet, connectPhantom, disconnect, refreshBalance } = useWallet();
  const { openPositions, closedPositions } = usePositions();
  const { toast } = useToast();

  const [isBotActive, setIsBotActive] = useState(false);
  const [portfolioData] = useState(generatePortfolioData);
  const [scanSpeed, setScanSpeed] = useState<'slow' | 'normal' | 'fast'>('normal');
  const [isPaused, setIsPaused] = useState(false);

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

  // Periodic scanning based on speed
  useEffect(() => {
    if (isPaused) return;
    
    const intervals = { slow: 60000, normal: 30000, fast: 10000 };
    const interval = setInterval(() => {
      if (settings?.min_liquidity) {
        scanTokens(settings.min_liquidity);
      }
    }, intervals[scanSpeed]);
    
    return () => clearInterval(interval);
  }, [scanSpeed, isPaused, settings?.min_liquidity, scanTokens]);

  // Auto-sniper when bot is active
  useEffect(() => {
    if (!isBotActive || tokens.length === 0 || !settings) return;
    
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
  }, [isBotActive, tokens.length]);

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
    setIsBotActive(active);
    toast({
      title: active ? "Liquidity Bot Activated" : "Liquidity Bot Deactivated",
      description: active 
        ? "Bot will automatically enter trades when conditions are met" 
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
