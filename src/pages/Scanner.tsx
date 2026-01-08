import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTokenScanner, ScannedToken } from "@/hooks/useTokenScanner";
import { useSniperSettings } from "@/hooks/useSniperSettings";
import { 
  Search, 
  RefreshCw, 
  SlidersHorizontal, 
  Sparkles, 
  Shield, 
  TrendingUp, 
  Users, 
  Clock,
  Zap,
  AlertTriangle,
  CheckCircle,
  ExternalLink,
  Loader2,
  Droplets,
  Lock,
} from "lucide-react";
import { useState, useEffect } from "react";
import { formatDistanceToNow } from "date-fns";

const getRiskColor = (score: number) => {
  if (score < 40) return 'text-green-500 bg-green-500/10 border-green-500/30';
  if (score < 70) return 'text-yellow-500 bg-yellow-500/10 border-yellow-500/30';
  return 'text-red-500 bg-red-500/10 border-red-500/30';
};

const getRiskLabel = (score: number) => {
  if (score < 40) return 'Low Risk';
  if (score < 70) return 'Medium Risk';
  return 'High Risk';
};

const getBuyerPositionBadge = (position: number | null) => {
  if (!position) return null;
  if (position <= 3) {
    return (
      <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
        <Zap className="w-3 h-3 mr-1" />
        Position #{position}
      </Badge>
    );
  }
  if (position <= 5) {
    return (
      <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
        Position #{position}
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-muted-foreground">
      Position #{position}
    </Badge>
  );
};

const formatCurrency = (value: number) => {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(2)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(1)}K`;
  return `$${value.toFixed(2)}`;
};

const TokenRow = ({ token }: { token: ScannedToken }) => {
  const createdAgo = token.createdAt 
    ? formatDistanceToNow(new Date(token.createdAt), { addSuffix: true })
    : 'Unknown';

  return (
    <Card className="hover:border-primary/50 transition-all">
      <CardContent className="p-4">
        <div className="flex flex-col lg:flex-row lg:items-center gap-4">
          {/* Token Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-foreground truncate">{token.name}</h3>
              <Badge variant="outline" className="text-xs">{token.symbol}</Badge>
              <Badge variant="outline" className="text-xs capitalize">{token.chain}</Badge>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="font-mono truncate max-w-[120px]">{token.address.slice(0, 8)}...{token.address.slice(-6)}</span>
              <span>•</span>
              <Clock className="w-3 h-3" />
              <span>{createdAgo}</span>
              <span>•</span>
              <span className="text-muted-foreground">{token.source}</span>
            </div>
          </div>

          {/* Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 lg:gap-6">
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Liquidity</p>
              <div className="flex items-center gap-1">
                <Droplets className="w-3 h-3 text-blue-400" />
                <span className="font-semibold text-foreground">{formatCurrency(token.liquidity)}</span>
              </div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Price</p>
              <div className="flex items-center gap-1">
                <span className="font-semibold text-foreground">${token.priceUsd.toFixed(8)}</span>
                <span className={`text-xs ${token.priceChange24h >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {token.priceChange24h >= 0 ? '+' : ''}{token.priceChange24h.toFixed(1)}%
                </span>
              </div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Early Buyers</p>
              <div className="flex items-center gap-1">
                <Users className="w-3 h-3 text-purple-400" />
                <span className="font-semibold text-foreground">{token.earlyBuyers}</span>
              </div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Lock Status</p>
              <div className="flex items-center gap-1">
                {token.liquidityLocked ? (
                  <>
                    <Lock className="w-3 h-3 text-green-500" />
                    <span className="text-green-500 text-sm">{token.lockPercentage}%</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-3 h-3 text-yellow-500" />
                    <span className="text-yellow-500 text-sm">Unlocked</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {getBuyerPositionBadge(token.buyerPosition)}
            <Badge className={getRiskColor(token.riskScore)}>
              <Shield className="w-3 h-3 mr-1" />
              {getRiskLabel(token.riskScore)}
            </Badge>
            <Button size="sm" variant="glow" className="ml-2">
              <Zap className="w-3 h-3 mr-1" />
              Snipe
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

const Scanner = () => {
  const { tokens, loading, lastScan, apiCount, errors, scanTokens, getTopOpportunities } = useTokenScanner();
  const { settings } = useSniperSettings();
  const [searchTerm, setSearchTerm] = useState('');
  const [chainFilter, setChainFilter] = useState('all');
  const [riskFilter, setRiskFilter] = useState('all');

  // Auto-scan on mount
  useEffect(() => {
    if (settings?.min_liquidity) {
      scanTokens(settings.min_liquidity);
    }
  }, [settings?.min_liquidity]);

  const handleScan = () => {
    scanTokens(settings?.min_liquidity || 300, chainFilter === 'all' ? ['solana', 'ethereum', 'bsc'] : [chainFilter]);
  };

  const filteredTokens = tokens.filter(token => {
    const matchesSearch = !searchTerm || 
      token.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      token.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
      token.address.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesChain = chainFilter === 'all' || token.chain === chainFilter;
    
    const matchesRisk = riskFilter === 'all' ||
      (riskFilter === 'low' && token.riskScore < 40) ||
      (riskFilter === 'medium' && token.riskScore >= 40 && token.riskScore < 70) ||
      (riskFilter === 'high' && token.riskScore >= 70);
    
    return matchesSearch && matchesChain && matchesRisk;
  });

  const topOpportunities = getTopOpportunities(3);

  return (
    <div className="min-h-screen bg-background">
      <Header />

      {/* Background Effects */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/3 left-1/4 w-96 h-96 bg-accent/5 rounded-full blur-3xl" />
      </div>

      <main className="relative pt-20 md:pt-24 pb-8">
        <div className="container mx-auto px-4">
          {/* Page Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">
                Meme Token Scanner
              </h1>
              <p className="text-muted-foreground">
                Real-time scanning of new meme tokens • {apiCount} APIs active
                {lastScan && ` • Last scan: ${formatDistanceToNow(new Date(lastScan), { addSuffix: true })}`}
              </p>
            </div>
            <Button
              variant="glow"
              onClick={handleScan}
              disabled={loading}
              className="min-w-[140px]"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              {loading ? "Scanning..." : "Scan Now"}
            </Button>
          </div>

          {/* Top Opportunities Banner */}
          {topOpportunities.length > 0 && (
            <div className="glass rounded-xl p-4 mb-6 border-primary/20 bg-gradient-to-r from-primary/5 to-accent/5">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-primary/20">
                  <Sparkles className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-foreground text-sm mb-2">Top Snipe Opportunities</h3>
                  <div className="flex flex-wrap gap-2">
                    {topOpportunities.map(token => (
                      <Badge key={token.id} variant="outline" className="gap-1">
                        <Zap className="w-3 h-3 text-primary" />
                        {token.symbol} - Position #{token.buyerPosition}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Errors Banner */}
          {errors.length > 0 && (
            <div className="glass rounded-xl p-4 mb-6 border-yellow-500/20 bg-yellow-500/5">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-yellow-500" />
                <div>
                  <p className="text-sm text-yellow-500 font-medium">Some APIs had issues:</p>
                  <p className="text-xs text-muted-foreground">{errors.join(', ')}</p>
                </div>
              </div>
            </div>
          )}

          {/* Filters Bar */}
          <div className="glass rounded-xl p-4 mb-6">
            <div className="flex flex-col lg:flex-row gap-4">
              {/* Search */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search by name, symbol, or contract..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Filter Selects */}
              <div className="flex gap-2">
                <Select value={chainFilter} onValueChange={setChainFilter}>
                  <SelectTrigger className="w-[130px]">
                    <SelectValue placeholder="Chain" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Chains</SelectItem>
                    <SelectItem value="solana">Solana</SelectItem>
                    <SelectItem value="ethereum">Ethereum</SelectItem>
                    <SelectItem value="bsc">BSC</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={riskFilter} onValueChange={setRiskFilter}>
                  <SelectTrigger className="w-[130px]">
                    <SelectValue placeholder="Risk" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Risk</SelectItem>
                    <SelectItem value="low">Low Risk</SelectItem>
                    <SelectItem value="medium">Medium Risk</SelectItem>
                    <SelectItem value="high">High Risk</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Active Filters */}
            <div className="flex flex-wrap items-center gap-2 mt-4 pt-4 border-t border-border">
              <span className="text-sm text-muted-foreground">Active filters:</span>
              <Badge variant="outline" className="text-xs">
                Min Liquidity: {settings?.min_liquidity || 300} SOL
              </Badge>
              {chainFilter !== 'all' && (
                <Badge variant="outline" className="text-xs capitalize">
                  Chain: {chainFilter}
                </Badge>
              )}
              {riskFilter !== 'all' && (
                <Badge variant="outline" className="text-xs capitalize">
                  Risk: {riskFilter}
                </Badge>
              )}
            </div>
          </div>

          {/* Token List */}
          {loading && tokens.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <Loader2 className="w-12 h-12 animate-spin text-primary mb-4" />
              <p className="text-muted-foreground">Scanning for tokens...</p>
            </div>
          ) : filteredTokens.length === 0 ? (
            <div className="text-center py-16">
              <Search className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">No tokens found</h3>
              <p className="text-muted-foreground mb-4">
                {tokens.length === 0 
                  ? "Click 'Scan Now' to search for new token opportunities"
                  : "Try adjusting your filters to see more results"}
              </p>
              <Button onClick={handleScan} disabled={loading}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Scan for Tokens
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredTokens.map((token) => (
                <TokenRow key={token.id} token={token} />
              ))}
            </div>
          )}

          {/* Results Count */}
          {filteredTokens.length > 0 && (
            <div className="text-center mt-6 text-sm text-muted-foreground">
              Showing {filteredTokens.length} of {tokens.length} tokens
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default Scanner;
