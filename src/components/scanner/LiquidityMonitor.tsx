import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScannedToken } from "@/hooks/useTokenScanner";
import { Zap, TrendingUp, TrendingDown, ExternalLink, ShieldCheck, ShieldX, Lock, Loader2, Search } from "lucide-react";
import { Input } from "@/components/ui/input";

interface LiquidityMonitorProps {
  pools: ScannedToken[];
  activeTrades: number;
  loading: boolean;
  apiStatus: 'waiting' | 'active' | 'error' | 'rate_limited';
}

const formatLiquidity = (value: number) => {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
};

const PoolRow = ({ pool, index }: { pool: ScannedToken; index: number }) => {
  const isPositive = pool.priceChange24h >= 0;
  const initials = pool.symbol.slice(0, 2).toUpperCase();
  
  const avatarColors = [
    'bg-primary/20 text-primary',
    'bg-blue-500/20 text-blue-400',
    'bg-purple-500/20 text-purple-400',
    'bg-orange-500/20 text-orange-400',
    'bg-pink-500/20 text-pink-400',
    'bg-cyan-500/20 text-cyan-400',
  ];
  const avatarClass = avatarColors[index % avatarColors.length];

  const getSafetyIcons = () => {
    const honeypotSafe = pool.riskScore < 50;
    const liquidityLocked = pool.liquidityLocked;
    
    return (
      <div className="flex items-center gap-1">
        {honeypotSafe ? (
          <div className="p-1 rounded bg-success/20">
            <ShieldCheck className="w-3 h-3 text-success" />
          </div>
        ) : (
          <div className="p-1 rounded bg-destructive/20">
            <ShieldX className="w-3 h-3 text-destructive" />
          </div>
        )}
        {liquidityLocked && (
          <div className="p-1 rounded bg-success/20">
            <Lock className="w-3 h-3 text-success" />
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex items-center gap-3 p-3 hover:bg-secondary/40 transition-colors border-b border-border/30 last:border-b-0">
      {/* Avatar */}
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold text-xs ${avatarClass}`}>
        {initials}
      </div>
      
      {/* Token Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="font-semibold text-foreground text-sm truncate">{pool.name.slice(0, 12)}</span>
          <span className="text-muted-foreground text-xs">{pool.symbol}</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="font-mono">{pool.address.slice(0, 4)}...{pool.address.slice(-4)}</span>
          <ExternalLink className="w-3 h-3 hover:text-primary cursor-pointer" />
        </div>
      </div>
      
      {/* Safety Icons */}
      {getSafetyIcons()}
      
      {/* Price & Liquidity */}
      <div className="text-right">
        <div className={`flex items-center justify-end gap-1 font-bold text-sm ${isPositive ? 'text-success' : 'text-destructive'}`}>
          {isPositive ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
          {isPositive ? '+' : ''}{pool.priceChange24h.toFixed(1)}%
        </div>
        <div className="text-xs text-muted-foreground">
          {formatLiquidity(pool.liquidity)}
        </div>
      </div>
    </div>
  );
};

export default function LiquidityMonitor({ 
  pools, 
  activeTrades, 
  loading,
  apiStatus = 'waiting'
}: LiquidityMonitorProps) {
  const [activeTab, setActiveTab] = useState("pools");
  const [searchTerm, setSearchTerm] = useState("");
  
  const filteredPools = pools.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.symbol.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusBadge = () => {
    switch (apiStatus) {
      case 'active':
        return <Badge className="bg-success/20 text-success border-success/30">Active</Badge>;
      case 'error':
        return <Badge className="bg-destructive/20 text-destructive border-destructive/30">Error</Badge>;
      case 'rate_limited':
        return <Badge className="bg-warning/20 text-warning border-warning/30">Rate Limited</Badge>;
      default:
        return <Badge className="bg-muted text-muted-foreground">Waiting...</Badge>;
    }
  };

  return (
    <Card className="bg-card/80 backdrop-blur-sm border-border/50 h-full flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border border-primary/20">
              <Zap className="w-5 h-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold">Liquidity Monitor</CardTitle>
              <p className="text-xs text-muted-foreground">
                API rate limited - {apiStatus}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              {pools.length} opportunities
            </Badge>
            {getStatusBadge()}
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col p-0">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
          <div className="px-4">
            <TabsList className="w-full bg-secondary/60">
              <TabsTrigger value="pools" className="flex-1 data-[state=active]:bg-success data-[state=active]:text-success-foreground">
                Pools ({pools.length})
              </TabsTrigger>
              <TabsTrigger value="trades" className="flex-1 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                Active Trades ({activeTrades})
              </TabsTrigger>
            </TabsList>
          </div>
          
          <TabsContent value="pools" className="flex-1 flex flex-col mt-0 data-[state=inactive]:hidden">
            {/* Search */}
            <div className="p-3 border-b border-border/30">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search pools..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-secondary/40 border-border/30 h-9"
                />
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-primary mb-2" />
                  <p className="text-sm text-muted-foreground">Scanning pools...</p>
                </div>
              ) : filteredPools.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Zap className="w-10 h-10 mb-2 opacity-30" />
                  <p className="font-medium mb-1">No pools detected yet</p>
                  <p className="text-xs">Enable the bot to start scanning</p>
                </div>
              ) : (
                filteredPools.map((pool, idx) => (
                  <PoolRow key={pool.id} pool={pool} index={idx} />
                ))
              )}
            </div>
          </TabsContent>
          
          <TabsContent value="trades" className="flex-1 flex flex-col mt-0 data-[state=inactive]:hidden">
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center py-12">
                <TrendingUp className="w-10 h-10 mb-2 opacity-30 mx-auto" />
                <p className="font-medium mb-1">No active trades</p>
                <p className="text-xs">Trades will appear here when executed</p>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
