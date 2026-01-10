import { useState, useEffect, useCallback, useMemo } from "react";
import TradingHeader from "@/components/trading/TradingHeader";
import TokenScannerPanel from "@/components/trading/TokenScannerPanel";
import LiquidityBotPanel from "@/components/trading/LiquidityBotPanel";
import StatsGrid from "@/components/dashboard/StatsGrid";
import WalletBanner from "@/components/dashboard/WalletBanner";
import ActiveTradesCard from "@/components/dashboard/ActiveTradesCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { usePositions } from "@/hooks/usePositions";
import { useTokenScanner } from "@/hooks/useTokenScanner";
import { useSniperSettings } from "@/hooks/useSniperSettings";
import { useCopyTrades } from "@/hooks/useCopyTrades";
import { useWallet } from "@/hooks/useWallet";
import { useAutoSniper } from "@/hooks/useAutoSniper";
import { useToast } from "@/hooks/use-toast";
import { PortfolioChart } from "@/components/charts/PriceCharts";
import { 
  RefreshCw,
  Loader2,
  LayoutDashboard,
  Bot,
  Copy,
  TrendingUp,
  ArrowUpRight,
  Sparkles,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

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
  const { tokens, loading: tokensLoading, scanTokens } = useTokenScanner();
  const { settings, saving, saveSettings, updateField } = useSniperSettings();
  const { trades: copyTrades, loading: copyLoading } = useCopyTrades();
  const { wallet, connectPhantom, disconnect, refreshBalance } = useWallet();
  const { evaluateTokens } = useAutoSniper();
  const { toast } = useToast();
  
  const [portfolioData] = useState(generatePortfolioData);
  const [activeTab, setActiveTab] = useState<string>("dashboard");
  const [scanSpeed, setScanSpeed] = useState<'slow' | 'normal' | 'fast'>('normal');
  const [isPaused, setIsPaused] = useState(false);
  const [isBotActive, setIsBotActive] = useState(false);

  // Auto-scan on mount
  useEffect(() => {
    if (settings?.min_liquidity && !isPaused) {
      scanTokens(settings.min_liquidity);
    }
  }, [settings?.min_liquidity]);

  // Periodic scanning based on speed
  useEffect(() => {
    if (isPaused || activeTab !== "scanner") return;
    
    const intervals = { slow: 60000, normal: 30000, fast: 10000 };
    const interval = setInterval(() => {
      if (settings?.min_liquidity) {
        scanTokens(settings.min_liquidity);
      }
    }, intervals[scanSpeed]);
    
    return () => clearInterval(interval);
  }, [scanSpeed, isPaused, settings?.min_liquidity, scanTokens, activeTab]);

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

  // Calculate dashboard stats
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

  // Calculate today's performance
  const todayPerformance = useMemo(() => {
    const initial = portfolioData[0]?.value || 1000;
    const current = portfolioData[portfolioData.length - 1]?.value || 1000;
    return ((current - initial) / initial) * 100;
  }, [portfolioData]);

  const handleScan = useCallback(() => {
    scanTokens(settings?.min_liquidity || 300);
  }, [scanTokens, settings?.min_liquidity]);

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

  const copyTradeColors = [
    'from-purple-500/30 to-purple-500/10 text-purple-400 border-purple-500/20',
    'from-blue-500/30 to-blue-500/10 text-blue-400 border-blue-500/20',
    'from-pink-500/30 to-pink-500/10 text-pink-400 border-pink-500/20',
    'from-cyan-500/30 to-cyan-500/10 text-cyan-400 border-cyan-500/20',
  ];

  return (
    <div className="min-h-screen bg-background relative">
      {/* Background effects */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent/5 rounded-full blur-3xl" />
      </div>
      
      <TradingHeader
        walletConnected={wallet.isConnected}
        walletAddress={wallet.address || undefined}
        network={wallet.network}
        onConnectWallet={handleConnectWallet}
      />
      
      <main className="relative pt-20 pb-8 px-4">
        <div className="container mx-auto max-w-7xl">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            {/* Modern Tab Header */}
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <TabsList className="bg-secondary/40 backdrop-blur-xl border border-border/50 p-1.5 rounded-2xl">
                <TabsTrigger 
                  value="dashboard" 
                  className="gap-2 rounded-xl px-4 py-2.5 data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-primary/80 data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg data-[state=active]:shadow-primary/25 transition-all duration-300"
                >
                  <LayoutDashboard className="w-4 h-4" />
                  Dashboard
                </TabsTrigger>
                <TabsTrigger 
                  value="scanner" 
                  className="gap-2 rounded-xl px-4 py-2.5 data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-primary/80 data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg data-[state=active]:shadow-primary/25 transition-all duration-300"
                >
                  <Bot className="w-4 h-4" />
                  Token Scanner
                </TabsTrigger>
              </TabsList>
              
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => refreshBalance()} 
                disabled={!wallet.isConnected}
                className="gap-2 rounded-xl border-border/50 bg-secondary/40 backdrop-blur-xl hover:bg-secondary/60"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh
              </Button>
            </div>

            <TabsContent value="dashboard" className="space-y-6 mt-0 animate-fade-in">
              {/* Wallet Banner */}
              {wallet.isConnected && wallet.address && (
                <WalletBanner 
                  address={wallet.address} 
                  balance={wallet.balance || '0'} 
                  network={wallet.network} 
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
                  {/* Portfolio Chart Card */}
                  <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-card/90 to-card/60 backdrop-blur-xl animate-fade-in">
                    {/* Decorative elements */}
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
                        
                        {/* Time Range Selector */}
                        <div className="flex gap-1 bg-secondary/40 backdrop-blur rounded-xl p-1 border border-border/30">
                          {['1D', '7D', '1M', 'All'].map((period, i) => (
                            <button
                              key={period}
                              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all duration-200 ${
                                i === 1 
                                  ? 'bg-primary text-primary-foreground shadow-sm' 
                                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60'
                              }`}
                            >
                              {period}
                            </button>
                          ))}
                        </div>
                      </div>
                    </CardHeader>
                    
                    <CardContent className="relative">
                      <PortfolioChart data={portfolioData} height={220} />
                    </CardContent>
                  </Card>

                  {/* Active Trades */}
                  <ActiveTradesCard 
                    positions={openPositions} 
                    loading={positionsLoading}
                    onStartSnipping={() => setActiveTab("scanner")}
                  />
                </div>

                {/* Right Column - 1/3 width */}
                <div className="space-y-6">
                  {/* Copy Trades Card */}
                  <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-card/90 to-card/60 backdrop-blur-xl animate-fade-in">
                    <div className="absolute inset-0 opacity-30">
                      <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-purple-500/10 rounded-full blur-3xl" />
                    </div>
                    
                    <CardHeader className="relative pb-3">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-gradient-to-br from-purple-500/20 to-purple-500/5 border border-purple-500/10">
                          <Copy className="w-4 h-4 text-purple-400" />
                        </div>
                        <div>
                          <CardTitle className="text-base font-semibold">Copy Trades</CardTitle>
                          <p className="text-xs text-muted-foreground">Recent activity</p>
                        </div>
                      </div>
                    </CardHeader>
                    
                    <CardContent className="relative">
                      {copyLoading ? (
                        <div className="flex items-center justify-center py-8">
                          <div className="relative">
                            <div className="absolute inset-0 bg-purple-500/20 rounded-full blur-xl animate-pulse" />
                            <Loader2 className="w-6 h-6 animate-spin text-purple-400 relative" />
                          </div>
                        </div>
                      ) : copyTrades.length === 0 ? (
                        <div className="text-center py-8">
                          <div className="relative inline-flex mb-3">
                            <div className="absolute inset-0 bg-muted/30 rounded-2xl blur-xl" />
                            <div className="relative p-3 rounded-2xl bg-gradient-to-br from-muted/20 to-muted/5 border border-border/50">
                              <Sparkles className="w-6 h-6 text-muted-foreground/50" />
                            </div>
                          </div>
                          <p className="text-sm text-muted-foreground">No copy trades yet</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {copyTrades.slice(0, 5).map((trade, index) => (
                            <div 
                              key={trade.id} 
                              className="group flex items-center justify-between p-3 bg-secondary/30 hover:bg-secondary/50 rounded-xl border border-transparent hover:border-border/50 transition-all duration-300 animate-fade-in"
                              style={{ animationDelay: `${index * 50}ms` }}
                            >
                              <div className="flex items-center gap-2.5">
                                <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${copyTradeColors[index % copyTradeColors.length]} border flex items-center justify-center font-bold text-xs`}>
                                  {trade.token_symbol.slice(0, 2)}
                                </div>
                                <div>
                                  <p className="text-sm font-medium text-foreground">{trade.token_symbol}</p>
                                  <p className="text-xs text-muted-foreground">{trade.leader_name || 'Unknown'}</p>
                                </div>
                              </div>
                              <Badge 
                                variant={trade.action === 'buy' ? 'default' : 'secondary'} 
                                className={`text-xs capitalize ${trade.action === 'buy' ? 'bg-success/20 text-success border-success/30' : 'bg-destructive/20 text-destructive border-destructive/30'}`}
                              >
                                {trade.action}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="scanner" className="mt-0 animate-fade-in">
              <div className="grid lg:grid-cols-[1fr,400px] gap-6 h-[calc(100vh-160px)]">
                <TokenScannerPanel
                  tokens={tokens}
                  loading={tokensLoading}
                  onScan={handleScan}
                  scanSpeed={scanSpeed}
                  onSpeedChange={setScanSpeed}
                  isPaused={isPaused}
                  onPauseToggle={() => setIsPaused(!isPaused)}
                />
                
                <LiquidityBotPanel
                  settings={settings}
                  saving={saving}
                  onUpdateField={updateField}
                  onSave={handleSaveSettings}
                  isActive={isBotActive}
                  onToggleActive={handleToggleBotActive}
                />
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
};

export default Index;
