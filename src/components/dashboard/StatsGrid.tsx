import { TrendingUp, Percent, BarChart3, ChevronDown, Timer, ChevronUp, Info } from "lucide-react";
import { useDisplayUnit } from "@/contexts/DisplayUnitContext";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface StatsGridProps {
  investedSol: number;
  totalValue: number;
  totalPnL: number;
  totalPnLPercent: number;
  openPositionsCount: number;
  closedPositionsCount: number;
  winCount?: number;
  sharpeRatio?: number;
  maxDrawdown?: number;
  avgHoldTime?: string;
  bestTradeSol?: number;
  worstTradeSol?: number;
}

export default function StatsGrid({
  totalPnL,
  totalPnLPercent,
  openPositionsCount,
  closedPositionsCount,
  winCount = 0,
  sharpeRatio = 0,
  maxDrawdown = 0,
  avgHoldTime = '0m',
  bestTradeSol = 0,
  worstTradeSol = 0,
}: StatsGridProps) {
  const { formatSolNativeValue } = useDisplayUnit();

  const pnlFormatted = formatSolNativeValue(totalPnL, { showSign: true });
  const bestFormatted = formatSolNativeValue(bestTradeSol, { showSign: true });
  const worstFormatted = formatSolNativeValue(worstTradeSol, { showSign: true });
  const isPositivePnL = totalPnL >= 0;

  const stats: { label: string; value: string; secondary?: string; sub?: string; type: 'positive' | 'negative' | 'warning' | 'neutral'; tooltip?: string }[] = [
    {
      label: "Total P&L",
      value: pnlFormatted.primary,
      secondary: pnlFormatted.secondary,
      sub: `${totalPnLPercent >= 0 ? '+' : ''}${totalPnLPercent.toFixed(1)}% ↑`,
      type: isPositivePnL ? 'positive' : 'negative',
    },
    { label: "ROI %", value: `${totalPnLPercent.toFixed(1)}%`, type: totalPnLPercent >= 0 ? 'positive' : 'negative', tooltip: "Return on Investment" },
    { label: "Sharpe Ratio", value: sharpeRatio.toFixed(1), type: 'neutral', tooltip: "Risk-adjusted return" },
    { label: "Max Drawdown", value: `${maxDrawdown.toFixed(1)}%`, type: 'warning', tooltip: "Maximum decline" },
    { label: "Avg Hold Time", value: avgHoldTime, type: 'neutral', tooltip: "Average hold duration" },
    { label: "Best Trade", value: bestFormatted.primary, secondary: bestFormatted.secondary, type: 'positive', tooltip: "Best single trade" },
    { label: "Worst Trade", value: worstFormatted.primary, secondary: worstFormatted.secondary, type: 'negative', tooltip: "Worst single trade" },
  ];

  const colorMap = {
    positive: 'text-success',
    negative: 'text-destructive',
    warning: 'text-warning',
    neutral: 'text-foreground',
  };

  return (
    <TooltipProvider>
      <div className="rounded-xl border border-border/30 bg-card/40 overflow-hidden">
        <div className="px-4 py-3 border-b border-border/20">
          <h3 className="text-xs font-bold uppercase tracking-widest text-foreground">Trading Performance</h3>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-1 sm:gap-1.5 p-2 sm:p-2.5">
          {stats.map((s) => (
            <div
              key={s.label}
              className="rounded-lg border border-border/20 bg-secondary/20 px-2.5 py-2 flex flex-col gap-0 text-left min-w-0"
            >
              <div className="flex items-center gap-1 mb-0.5">
                <span className="text-[9px] sm:text-[10px] font-medium text-muted-foreground whitespace-nowrap truncate">{s.label}</span>
                {s.tooltip && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="w-2.5 h-2.5 text-muted-foreground/40 cursor-help shrink-0" />
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-[10px]">{s.tooltip}</TooltipContent>
                  </Tooltip>
                )}
              </div>
              <span className={`text-sm sm:text-base md:text-lg font-bold tabular-nums leading-tight truncate ${colorMap[s.type]}`}>
                {s.value}
              </span>
              {s.secondary && (
                <span className="text-[9px] text-muted-foreground tabular-nums leading-tight truncate">{s.secondary}</span>
              )}
              {s.sub && (
                <span className={`text-[9px] font-medium tabular-nums leading-tight ${colorMap[s.type]}`}>{s.sub}</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </TooltipProvider>
  );
}
