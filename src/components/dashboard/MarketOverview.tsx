import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Flame, Loader2, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTrendingTokens } from "@/hooks/useTrendingTokens";
import { Button } from "@/components/ui/button";

export default function MarketOverview() {
  const navigate = useNavigate();
  const { tokens, loading, refetch } = useTrendingTokens();

  const handleTokenClick = (token: typeof tokens[0]) => {
    if (token.address) {
      const tokenData = { address: token.address, name: token.name, symbol: token.symbol, priceUsd: token.priceUsd, priceChange24h: token.priceChange24h, volume24h: token.volume24h, liquidity: token.liquidity };
      navigate(`/token/${token.address}?data=${encodeURIComponent(JSON.stringify(tokenData))}`);
    }
  };

  return (
    <div className="rounded-xl border border-border/40 bg-card/60 backdrop-blur-sm overflow-hidden flex flex-col">
      <div className="px-4 py-3 flex items-center justify-between border-b border-border/30">
        <div className="flex items-center gap-2">
          <Flame className="w-4 h-4 text-orange-400" />
          <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground whitespace-nowrap">Market Signals</h3>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => refetch()} disabled={loading}>
            <RefreshCw className={cn("w-3 h-3", loading && "animate-spin")} />
          </Button>
          <Badge variant="outline" className="text-[8px] px-1.5 py-0 bg-orange-500/10 text-orange-400 border-orange-500/30">
            Live
          </Badge>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
          </div>
        ) : tokens.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6">
            <p className="text-[11px] text-muted-foreground">No signals</p>
            <Button variant="ghost" size="sm" onClick={() => refetch()} className="mt-2 h-6 text-[10px]">
              <RefreshCw className="w-3 h-3 mr-1" /> Refresh
            </Button>
          </div>
        ) : (
          <div className="space-y-1">
            {tokens.slice(0, 5).map((token, index) => {
              const isPositive = token.priceChange24h >= 0;
              const signal = isPositive ? (token.priceChange24h > 10 ? 'Buy' : 'Hold') : 'Exit';
              const signalColor = signal === 'Buy' ? 'text-success border-success/30 bg-success/10' : signal === 'Hold' ? 'text-primary border-primary/30 bg-primary/10' : 'text-destructive border-destructive/30 bg-destructive/10';

              return (
                <div
                  key={token.address + index}
                  className="flex items-center justify-between p-2.5 rounded-lg hover:bg-secondary/30 transition-colors cursor-pointer gap-2"
                  onClick={() => handleTokenClick(token)}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {isPositive ? <TrendingUp className="w-3 h-3 text-success shrink-0" /> : <TrendingDown className="w-3 h-3 text-destructive shrink-0" />}
                    <span className="text-xs font-semibold text-foreground uppercase truncate">{token.symbol}</span>
                    <span className={`text-[10px] font-mono tabular-nums ${isPositive ? 'text-success' : 'text-destructive'}`}>
                      {isPositive ? '+' : ''}{token.priceChange24h.toFixed(1)}%
                    </span>
                  </div>
                  <Badge variant="outline" className={`text-[8px] px-1.5 py-0 shrink-0 whitespace-nowrap ${signalColor}`}>
                    {signal}
                  </Badge>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
