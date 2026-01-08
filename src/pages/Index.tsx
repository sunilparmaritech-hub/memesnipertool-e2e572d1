import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { usePositions, Position } from "@/hooks/usePositions";
import { useTokenScanner, ScannedToken } from "@/hooks/useTokenScanner";
import { useSniperSettings } from "@/hooks/useSniperSettings";
import { useCopyTrades, CopyTrade } from "@/hooks/useCopyTrades";
import { useWallet } from "@/hooks/useWallet";
import { PriceChart, PortfolioChart } from "@/components/charts/PriceCharts";
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Activity, 
  Zap,
  Wallet,
  Shield,
  Clock,
  Users,
  RefreshCw,
  Loader2,
  ArrowUpRight,
  ArrowDownRight,
  Copy,
  ExternalLink,
} from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { formatDistanceToNow } from "date-fns";
import { Link } from "react-router-dom";

const formatCurrency = (value: number) => {
  if (Math.abs(value) >= 1000000) return `$${(value / 1000000).toFixed(2)}M`;
  if (Math.abs(value) >= 1000) return `$${(value / 1000).toFixed(1)}K`;
  return `$${value.toFixed(2)}`;
};

const getRiskBadge = (score: number) => {
  if (score < 40) return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Low Risk</Badge>;
  if (score < 70) return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">Medium</Badge>;
  return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">High Risk</Badge>;
};

// Generate mock chart data for tokens
const generatePriceData = (basePrice: number, positive: boolean) => {
  const data = [];
  let price = basePrice * (positive ? 0.7 : 1.3);
  for (let i = 0; i < 24; i++) {
    const change = (Math.random() - (positive ? 0.3 : 0.7)) * basePrice * 0.1;
    price = Math.max(price + change, basePrice * 0.1);
    data.push({ time: `${i}h`, price });
  }
  return data;
};

// Generate mock portfolio history
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
  const { tokens, loading: tokensLoading, scanTokens, getTopOpportunities } = useTokenScanner();
  const { settings } = useSniperSettings();
  const { trades: copyTrades, loading: copyLoading } = useCopyTrades();
  const { wallet, refreshBalance } = useWallet();
  
  const [portfolioData] = useState(generatePortfolioData);

  // Auto-scan on mount
  useEffect(() => {
    if (settings?.min_liquidity) {
      scanTokens(settings.min_liquidity);
    }
  }, [settings?.min_liquidity]);

  // Calculate dashboard stats
  const totalValue = useMemo(() => 
    openPositions.reduce((sum, p) => sum + p.current_value, 0), 
    [openPositions]
  );
  
  const totalPnL = useMemo(() => 
    openPositions.reduce((sum, p) => sum + p.profit_loss_value, 0),
    [openPositions]
  );
  
  const totalPnLPercent = useMemo(() => {
    const entryTotal = openPositions.reduce((sum, p) => sum + p.entry_value, 0);
    return entryTotal > 0 ? (totalPnL / entryTotal) * 100 : 0;
  }, [openPositions, totalPnL]);

  const trendingTokens = useMemo(() => 
    tokens.slice(0, 5).map(t => ({
      ...t,
      chartData: generatePriceData(t.priceUsd, t.priceChange24h >= 0)
    })),
    [tokens]
  );

  const topOpportunities = getTopOpportunities(3);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      {/* Background Effects */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent/5 rounded-full blur-3xl" />
      </div>

      <main className="relative pt-20 md:pt-24 pb-8">
        <div className="container mx-auto px-4">
          {/* Page Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-1">
                Dashboard
              </h1>
              <p className="text-muted-foreground">
                Real-time overview of your trading activity
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={refreshBalance} disabled={!wallet.isConnected}>
                <RefreshCw className="w-4 h-4 mr-1" />
                Refresh
              </Button>
              <Link to="/scanner">
                <Button variant="glow" size="sm">
                  <Zap className="w-4 h-4 mr-1" />
                  Scanner
                </Button>
              </Link>
            </div>
          </div>

          {/* Wallet Info Banner */}
          {wallet.isConnected && (
            <Card className="mb-6 border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
              <CardContent className="p-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/20">
                      <Wallet className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Connected Wallet</p>
                      <p className="font-mono text-sm text-foreground">
                        {wallet.address?.slice(0, 8)}...{wallet.address?.slice(-6)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground">Balance</p>
                      <p className="font-semibold text-foreground">{wallet.balance || '0'}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground">Network</p>
                      <Badge variant="outline" className="capitalize">{wallet.network}</Badge>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Stats Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-500/20">
                    <DollarSign className="w-5 h-5 text-blue-400" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Portfolio Value</p>
                    <p className="text-xl font-bold text-foreground">{formatCurrency(totalValue)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${totalPnL >= 0 ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
                    {totalPnL >= 0 ? (
                      <TrendingUp className="w-5 h-5 text-green-400" />
                    ) : (
                      <TrendingDown className="w-5 h-5 text-red-400" />
                    )}
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Total P&L</p>
                    <p className={`text-xl font-bold ${totalPnL >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                      {totalPnL >= 0 ? '+' : ''}{formatCurrency(totalPnL)}
                      <span className="text-sm ml-1">({totalPnLPercent.toFixed(1)}%)</span>
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/20">
                    <Activity className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Active Trades</p>
                    <p className="text-xl font-bold text-foreground">{openPositions.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-muted">
                    <Clock className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Completed Trades</p>
                    <p className="text-xl font-bold text-foreground">{closedPositions.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid lg:grid-cols-3 gap-6">
            {/* Main Content - Left Column */}
            <div className="lg:col-span-2 space-y-6">
              {/* Portfolio Chart */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-semibold">Portfolio Performance (7D)</CardTitle>
                </CardHeader>
                <CardContent>
                  <PortfolioChart data={portfolioData} height={180} />
                </CardContent>
              </Card>

              {/* Active Trades */}
              <Card>
                <CardHeader className="pb-2 flex flex-row items-center justify-between">
                  <CardTitle className="text-base font-semibold">Active Trades</CardTitle>
                  <Link to="/portfolio">
                    <Button variant="ghost" size="sm">View All</Button>
                  </Link>
                </CardHeader>
                <CardContent>
                  {positionsLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin text-primary" />
                    </div>
                  ) : openPositions.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Activity className="w-10 h-10 mx-auto mb-2 opacity-50" />
                      <p>No active trades</p>
                      <Link to="/scanner">
                        <Button variant="link" size="sm">Start sniping →</Button>
                      </Link>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {openPositions.slice(0, 4).map((position) => {
                        const isProfit = position.profit_loss_percent >= 0;
                        return (
                          <div key={position.id} className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                                <span className="text-xs font-bold text-primary">
                                  {position.token_symbol.slice(0, 2)}
                                </span>
                              </div>
                              <div>
                                <p className="font-medium text-foreground">{position.token_symbol}</p>
                                <p className="text-xs text-muted-foreground">
                                  {formatDistanceToNow(new Date(position.created_at), { addSuffix: true })}
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className={`font-semibold ${isProfit ? 'text-green-500' : 'text-red-500'}`}>
                                {isProfit ? '+' : ''}{position.profit_loss_percent.toFixed(2)}%
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {formatCurrency(position.current_value)}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Completed Trades */}
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
                        const isProfit = position.profit_loss_percent >= 0;
                        return (
                          <div key={position.id} className="flex items-center justify-between p-2 hover:bg-secondary/20 rounded-lg transition-colors">
                            <div className="flex items-center gap-2">
                              {isProfit ? (
                                <ArrowUpRight className="w-4 h-4 text-green-500" />
                              ) : (
                                <ArrowDownRight className="w-4 h-4 text-red-500" />
                              )}
                              <span className="font-medium text-foreground">{position.token_symbol}</span>
                              <Badge variant="outline" className="text-xs">
                                {position.exit_reason?.replace('_', ' ') || 'closed'}
                              </Badge>
                            </div>
                            <div className="text-right">
                              <span className={`font-mono text-sm ${isProfit ? 'text-green-500' : 'text-red-500'}`}>
                                {isProfit ? '+' : ''}{position.profit_loss_percent.toFixed(1)}%
                              </span>
                            </div>
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
              {/* Top Trending Tokens with Charts */}
              <Card>
                <CardHeader className="pb-2 flex flex-row items-center justify-between">
                  <CardTitle className="text-base font-semibold">Trending Memecoins</CardTitle>
                  <Link to="/scanner">
                    <Button variant="ghost" size="sm">See All</Button>
                  </Link>
                </CardHeader>
                <CardContent>
                  {tokensLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin text-primary" />
                    </div>
                  ) : trendingTokens.length === 0 ? (
                    <div className="text-center py-6 text-muted-foreground">
                      <p className="text-sm">Scan for tokens to see trending</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {trendingTokens.map((token) => (
                        <div key={token.id} className="space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-foreground">{token.symbol}</span>
                              {getRiskBadge(token.riskScore)}
                            </div>
                            <div className="text-right">
                              <p className={`text-sm font-mono ${token.priceChange24h >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                {token.priceChange24h >= 0 ? '+' : ''}{token.priceChange24h.toFixed(1)}%
                              </p>
                            </div>
                          </div>
                          <PriceChart 
                            data={token.chartData} 
                            height={60} 
                            color={token.priceChange24h >= 0 ? '#22c55e' : '#ef4444'}
                          />
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>Liq: {formatCurrency(token.liquidity)}</span>
                            <span className="flex items-center gap-1">
                              <Shield className="w-3 h-3" />
                              Risk: {token.riskScore}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Top Snipe Opportunities */}
              {topOpportunities.length > 0 && (
                <Card className="border-green-500/20 bg-green-500/5">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                      <Zap className="w-4 h-4 text-green-500" />
                      Snipe Opportunities
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {topOpportunities.map((token) => (
                        <div key={token.id} className="flex items-center justify-between p-2 bg-green-500/10 rounded-lg">
                          <div>
                            <p className="font-medium text-foreground">{token.symbol}</p>
                            <p className="text-xs text-muted-foreground">Position #{token.buyerPosition}</p>
                          </div>
                          <Link to="/scanner">
                            <Button variant="outline" size="sm">
                              <Zap className="w-3 h-3 mr-1" />
                              Snipe
                            </Button>
                          </Link>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Copy Trading Activity */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <Copy className="w-4 h-4" />
                    Copy Trading Log
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {copyLoading ? (
                    <div className="flex items-center justify-center py-6">
                      <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : copyTrades.length === 0 ? (
                    <div className="text-center py-6 text-muted-foreground">
                      <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No copy trades yet</p>
                      <p className="text-xs">Copy top traders to see activity here</p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[200px] overflow-y-auto">
                      {copyTrades.slice(0, 10).map((trade) => (
                        <div key={trade.id} className="flex items-center justify-between p-2 bg-secondary/30 rounded-lg text-sm">
                          <div className="flex items-center gap-2">
                            <Badge 
                              variant="outline" 
                              className={trade.action === 'buy' ? 'text-green-500 border-green-500/30' : 'text-red-500 border-red-500/30'}
                            >
                              {trade.action.toUpperCase()}
                            </Badge>
                            <span className="font-medium">{trade.token_symbol}</span>
                          </div>
                          <div className="text-right text-xs">
                            <p className="text-muted-foreground">
                              {trade.leader_name || trade.leader_address.slice(0, 6) + '...'}
                            </p>
                            <p className="text-muted-foreground">
                              {formatDistanceToNow(new Date(trade.created_at), { addSuffix: true })}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Index;
