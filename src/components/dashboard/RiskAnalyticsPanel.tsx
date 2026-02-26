import { useMemo } from "react";
import { Brain, TrendingUp, BarChart3 } from "lucide-react";
import { useDisplayUnit } from "@/contexts/DisplayUnitContext";
import { Skeleton } from "@/components/ui/skeleton";

interface RiskAnalyticsPanelProps {
  winCount: number;
  totalClosed: number;
  closedPositions: {
    profit_loss_percent?: number | null;
    entry_value?: number | null;
    created_at: string;
    closed_at?: string | null;
  }[];
  maxDrawdown: number;
  loading?: boolean;
}

export default function RiskAnalyticsPanel({
  winCount, totalClosed, closedPositions, maxDrawdown, loading,
}: RiskAnalyticsPanelProps) {
  const { formatSolNativeValue } = useDisplayUnit();

  const metrics = useMemo(() => {
    const winRate = totalClosed > 0 ? (winCount / totalClosed) * 100 : 0;
    const gains = closedPositions.filter(p => (p.profit_loss_percent ?? 0) > 0).map(p => p.profit_loss_percent ?? 0);
    const losses = closedPositions.filter(p => (p.profit_loss_percent ?? 0) < 0).map(p => p.profit_loss_percent ?? 0);
    const avgGain = gains.length > 0 ? gains.reduce((s, v) => s + v, 0) / gains.length : 0;
    const avgLoss = losses.length > 0 ? losses.reduce((s, v) => s + v, 0) / losses.length : 0;
    
    const avgGainSol = closedPositions.reduce((s, p) => {
      const pnl = p.profit_loss_percent ?? 0;
      if (pnl <= 0) return s;
      return s + (p.entry_value ?? 0) * (pnl / 100);
    }, 0);
    
    const maxDrawdownSol = closedPositions.reduce((s, p) => {
      const pnl = p.profit_loss_percent ?? 0;
      if (pnl >= 0) return s;
      return s + Math.abs((p.entry_value ?? 0) * (pnl / 100));
    }, 0);

    return {
      winRate,
      totalTrades: totalClosed,
      avgGainPercent: avgGain,
      avgGainSol,
      avgLossPercent: avgLoss,
      maxDrawdown: Math.abs(maxDrawdown),
      maxDrawdownSol,
    };
  }, [winCount, totalClosed, closedPositions, maxDrawdown]);

  const avgGainFormatted = formatSolNativeValue(metrics.avgGainSol, { showSign: true });
  const drawdownFormatted = formatSolNativeValue(metrics.maxDrawdownSol, { showSign: true });

  if (loading) {
    return (
      <div className="rounded-xl border border-border/20 p-4">
        <Skeleton className="h-6 w-40 mb-3" />
        <div className="grid grid-cols-2 gap-3">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-20 rounded-lg" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border/20 overflow-hidden" style={{ background: 'var(--gradient-card-sidebar)' }}>
      {/* Header */}
      <div className="px-4 py-3 flex items-center justify-between border-b border-border/15">
        <div className="flex items-center gap-2">
          <Brain className="w-4 h-4 text-accent" />
          <span className="text-xs font-bold uppercase tracking-widest text-foreground">Risk Analytics</span>
        </div>
        <div className="flex gap-1">
          <div className="w-2 h-2 rounded-full bg-success" />
          <div className="w-2 h-2 rounded-full bg-primary" />
          <div className="w-2 h-2 rounded-full bg-muted" />
        </div>
      </div>

      <div className="p-4 grid grid-cols-2 gap-4">
        {/* Win Rate */}
        <div>
          <div className="flex items-center gap-1.5 mb-1">
            <div className="w-2 h-2 rounded-full bg-primary/40" />
            <span className="text-[10px] font-medium text-muted-foreground">Win Rate</span>
          </div>
          <span className="text-2xl font-bold tabular-nums text-foreground">{metrics.winRate.toFixed(0)}%</span>
          <p className="text-[9px] text-muted-foreground mt-0.5">{winCount} of {totalClosed} trades</p>
        </div>

        {/* Total Trades */}
        <div>
          <div className="flex items-center gap-1.5 mb-1">
            <div className="w-2 h-2 rounded-full bg-accent/40" />
            <span className="text-[10px] font-medium text-muted-foreground">Total Trades</span>
          </div>
          <span className="text-2xl font-bold tabular-nums text-foreground">{metrics.totalTrades}</span>
          <p className="text-[9px] text-muted-foreground mt-0.5">Closed positions</p>
        </div>

        {/* Avg Gain */}
        <div>
          <div className="flex items-center gap-1.5 mb-1">
            <TrendingUp className="w-3 h-3 text-success" />
            <span className="text-[10px] font-medium text-muted-foreground">Avg Gain</span>
          </div>
          <span className="text-2xl font-bold tabular-nums text-success">
            {metrics.avgGainPercent > 0 ? '+' : ''}{metrics.avgGainPercent.toFixed(0)}%
          </span>
          <p className="text-[9px] text-success tabular-nums mt-0.5">{avgGainFormatted.primary}</p>
        </div>

        {/* Max Drawdown */}
        <div>
          <div className="flex items-center gap-1.5 mb-1">
            <BarChart3 className="w-3 h-3 text-destructive" />
            <span className="text-[10px] font-medium text-muted-foreground">Max Drawdown</span>
          </div>
          <span className="text-2xl font-bold tabular-nums text-destructive">
            -{metrics.maxDrawdown.toFixed(1)}%
          </span>
          <p className="text-[9px] text-destructive tabular-nums mt-0.5">{drawdownFormatted.primary}</p>
        </div>
      </div>
    </div>
  );
}
