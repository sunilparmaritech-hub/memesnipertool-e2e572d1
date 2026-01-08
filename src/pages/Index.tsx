import { useState, useEffect, useCallback, useMemo } from "react";
import TradingHeader from "@/components/trading/TradingHeader";
import TokenScannerPanel from "@/components/trading/TokenScannerPanel";
import LiquidityBotPanel from "@/components/trading/LiquidityBotPanel";
import StatsGrid from "@/components/dashboard/StatsGrid";
import WalletBanner from "@/components/dashboard/WalletBanner";
import ActiveTradesCard from "@/components/dashboard/ActiveTradesCard";
import QuickActionsCard from "@/components/dashboard/QuickActionsCard";
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
  let value = 100;
  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const change = (Math.random() - 0.4) * 20;
    value = Math.max(value + change, 50);
    data.push({ 
      date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      value: value,
      pnl: value - 100,
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

  return (
    <div className="min-h-screen bg-background">
      <TradingHeader
        walletConnected={wallet.isConnected}
        walletAddress={wallet.address || undefined}
        network={wallet.network}
        onConnectWallet={handleConnectWallet}
      />
      
      <main className="pt-20 pb-8 px-4">
        <div className="container mx-auto">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <TabsList className="bg-secondary/60 p-1">
                <TabsTrigger value="dashboard" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  <LayoutDashboard className="w-4 h-4" />
                  Dashboard
                </TabsTrigger>
                <TabsTrigger value="scanner" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  <Bot className="w-4 h-4" />
                  Token Scanner
                </TabsTrigger>
              </TabsList>
              
              <Button variant="outline" size="sm" onClick={() => refreshBalance()} disabled={!wallet.isConnected}>
                <RefreshCw className="w-4 h-4 mr-1.5" />
                Refresh
              </Button>
            </div>

            <TabsContent value="dashboard" className="space-y-6 mt-0">
              {wallet.isConnected && wallet.address && (
                <WalletBanner 
                  address={wallet.address} 
                  balance={wallet.balance || '0'} 
                  network={wallet.network} 
                />
              )}

              <StatsGrid
                totalValue={totalValue}
                totalPnL={totalPnL}
                totalPnLPercent={totalPnLPercent}
                openPositionsCount={openPositions.length}
                closedPositionsCount={closedPositions.length}
              />

              <div className="grid lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                  <Card className="bg-card/80 backdrop-blur-sm border-border/50">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base font-semibold flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-primary" />
                        Portfolio Performance (7D)
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <PortfolioChart data={portfolioData} height={200} />
                    </CardContent>
                  </Card>

                  <ActiveTradesCard 
                    positions={openPositions} 
                    loading={positionsLoading}
                    onStartSnipping={() => setActiveTab("scanner")}
                  />
                </div>

                <div className="space-y-6">
                  <Card className="bg-card/80 backdrop-blur-sm border-border/50">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base font-semibold flex items-center gap-2">
                        <Copy className="w-4 h-4 text-purple-400" />
                        Recent Copy Trades
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {copyLoading ? (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 className="w-5 h-5 animate-spin text-primary" />
                        </div>
                      ) : copyTrades.length === 0 ? (
                        <p className="text-center py-6 text-sm text-muted-foreground">No copy trades yet</p>
                      ) : (
                        <div className="space-y-2">
                          {copyTrades.slice(0, 5).map((trade) => (
                            <div key={trade.id} className="flex items-center justify-between p-2.5 bg-secondary/40 rounded-lg">
                              <div>
                                <p className="text-sm font-medium text-foreground">{trade.token_symbol}</p>
                                <p className="text-xs text-muted-foreground">{trade.leader_name || 'Unknown'}</p>
                              </div>
                              <Badge variant={trade.action === 'buy' ? 'default' : 'secondary'} className="text-xs">
                                {trade.action}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <QuickActionsCard onOpenScanner={() => setActiveTab("scanner")} />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="scanner" className="mt-0">
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

                  {/* Recent Completed Trades */}
                  <Card>
                    <CardHeader className="pb-2 flex flex-row items-center justify-between">
                      <CardTitle className="text-base font-semibold">Recent Completed Trades</CardTitle>
                      <Link to="/portfolio">
                        <Button variant="ghost" size="sm">View All</Button>
                      </Link>
                    </CardHeader>
                    <CardContent>
                      {closedPositions.length === 0 ? (
                        <div className="text-center py-6 text-muted-foreground">
                          <p className="text-sm">No completed trades yet</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {closedPositions.slice(0, 5).map((position) => {
                            const isProfit = (position.profit_loss_percent || 0) >= 0;
                            return (
                              <div key={position.id} className="flex items-center justify-between p-2 hover:bg-secondary/20 rounded-lg transition-colors">
                                <div className="flex items-center gap-2">
                                  {isProfit ? (
                                    <ArrowUpRight className="w-4 h-4 text-success" />
                                  ) : (
                                    <ArrowDownRight className="w-4 h-4 text-destructive" />
                                  )}
                                  <span className="font-medium text-foreground">{position.token_symbol}</span>
                                  <Badge variant="outline" className="text-xs">
                                    {position.exit_reason?.replace('_', ' ') || 'closed'}
                                  </Badge>
                                </div>
                                <span className={`font-mono text-sm ${isProfit ? 'text-success' : 'text-destructive'}`}>
                                  {isProfit ? '+' : ''}{(position.profit_loss_percent || 0).toFixed(1)}%
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Right Sidebar */}
                <div className="space-y-6">
                  {/* Copy Trades */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base font-semibold flex items-center gap-2">
                        <Copy className="w-4 h-4" />
                        Recent Copy Trades
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {copyLoading ? (
                        <div className="flex items-center justify-center py-6">
                          <Loader2 className="w-5 h-5 animate-spin text-primary" />
                        </div>
                      ) : copyTrades.length === 0 ? (
                        <div className="text-center py-6 text-muted-foreground">
                          <p className="text-sm">No copy trades</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {copyTrades.slice(0, 5).map((trade) => (
                            <div key={trade.id} className="flex items-center justify-between p-2 bg-secondary/20 rounded-lg">
                              <div>
                                <p className="text-sm font-medium text-foreground">{trade.token_symbol}</p>
                                <p className="text-xs text-muted-foreground">{trade.leader_name || 'Unknown'}</p>
                              </div>
                              <Badge variant={trade.action === 'buy' ? 'default' : 'secondary'}>
                                {trade.action}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Quick Actions */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base font-semibold">Quick Actions</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <Button 
                        variant="outline" 
                        className="w-full justify-start" 
                        onClick={() => setActiveTab("scanner")}
                      >
                        <Bot className="w-4 h-4 mr-2" />
                        Open Token Scanner
                      </Button>
                      <Link to="/sniper-settings" className="block">
                        <Button variant="outline" className="w-full justify-start">
                          <Activity className="w-4 h-4 mr-2" />
                          Configure Bot Settings
                        </Button>
                      </Link>
                      <Link to="/risk" className="block">
                        <Button variant="outline" className="w-full justify-start">
                          <TrendingDown className="w-4 h-4 mr-2" />
                          Risk Management
                        </Button>
                      </Link>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </TabsContent>

            {/* Scanner Tab */}
            <TabsContent value="scanner" className="mt-6">
              <div className="grid lg:grid-cols-[1fr,380px] gap-6 h-[calc(100vh-180px)]">
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
