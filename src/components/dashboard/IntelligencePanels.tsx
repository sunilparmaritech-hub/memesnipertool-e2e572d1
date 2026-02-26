import { forwardRef } from "react";
import { Badge } from "@/components/ui/badge";
import { Zap, RefreshCw, TrendingUp, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTrendingTokens } from "@/hooks/useTrendingTokens";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

const IntelligencePanels = forwardRef<HTMLDivElement>(function IntelligencePanels(_, ref) {
  const navigate = useNavigate();
  const { tokens, loading, refetch } = useTrendingTokens();

  const signals = tokens.slice(0, 4).map((token, i) => {
    const isPositive = token.priceChange24h >= 0;
    const signal = isPositive ? (token.priceChange24h > 10 ? 'Buy' : 'Monitor') : 'Exit';
    const confidence = Math.min(99, Math.max(60, 87 - i * 5 + Math.floor(token.priceChange24h)));
    const flagType = isPositive ? 'BULLISH' : 'BEARISH';
    return { ...token, signal, confidence, flagType, isPositive };
  });

  const signalBadge = (signal: string) => {
    const styles = {
      Buy: 'bg-success/15 text-success border-success/30',
      Monitor: 'bg-primary/15 text-primary border-primary/30',
      Exit: 'bg-destructive/15 text-destructive border-destructive/30',
    };
    return styles[signal as keyof typeof styles] || styles.Monitor;
  };

  return (
    <div ref={ref} className="rounded-xl border border-border/30 bg-card/40 overflow-hidden flex flex-col h-[340px]">
      <div className="px-4 py-3 flex items-center justify-between border-b border-border/20">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-accent" />
          <h3 className="text-xs font-bold uppercase tracking-widest text-foreground whitespace-nowrap">Intelligence Panels</h3>
        </div>
        <div className="flex items-center gap-1.5">
          <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => refetch()} disabled={loading}>
            <RefreshCw className={cn("w-3 h-3", loading && "animate-spin")} />
          </Button>
          <Badge variant="outline" className="text-[8px] px-1.5 py-0 bg-success/10 text-success border-success/30">
            Live
          </Badge>
        </div>
      </div>

      <div className="p-3 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Market Signals</span>
          <span className="text-[9px] text-muted-foreground">Confidence %</span>
        </div>

        <div className="space-y-2">
          {signals.length === 0 ? (
            <p className="text-[11px] text-muted-foreground text-center py-4">No signals available</p>
          ) : (
            signals.map((s, i) => (
              <div
                key={s.address + i}
                className="flex items-center justify-between gap-2 p-2.5 rounded-lg hover:bg-secondary/20 transition-colors cursor-pointer"
                onClick={() => navigate(`/token/${s.address}`)}
              >
                <div className="flex items-center gap-2 min-w-0">
                  {s.isPositive ? (
                    <TrendingUp className="w-3.5 h-3.5 text-success shrink-0" />
                  ) : (
                    <AlertTriangle className="w-3.5 h-3.5 text-destructive shrink-0" />
                  )}
                  <div className="min-w-0">
                    <span className="text-xs font-bold text-foreground uppercase truncate block">
                      {s.flagType} FLAG ON {s.symbol}
                    </span>
                    <span className="text-[10px] text-muted-foreground">({s.confidence}%)</span>
                  </div>
                </div>
                <Badge variant="outline" className={`text-[9px] px-2 py-0.5 font-bold shrink-0 ${signalBadge(s.signal)}`}>
                  {s.signal}
                </Badge>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
});

export default IntelligencePanels;
