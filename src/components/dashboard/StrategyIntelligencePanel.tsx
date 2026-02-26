import { useMemo, useEffect, useState, useRef } from "react";
import { Brain, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";

interface StrategyIntelligencePanelProps {
  winCount: number;
  totalClosed: number;
  closedPositions: {
    profit_loss_percent?: number | null;
    entry_value?: number | null;
    created_at: string;
    closed_at?: string | null;
  }[];
  sharpeRatio: number;
  maxDrawdown: number;
  avgHoldTime: string;
  loading?: boolean;
}

// Animated counter hook
function useAnimatedValue(target: number, duration = 800) {
  const [value, setValue] = useState(0);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number>(0);
  const fromRef = useRef<number>(0);

  useEffect(() => {
    fromRef.current = value;
    startRef.current = performance.now();

    const animate = (time: number) => {
      const elapsed = time - startRef.current;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(fromRef.current + (target - fromRef.current) * eased);
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      }
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [target, duration]);

  return value;
}

function AnimatedMetric({ label, value, suffix, tooltip, color = 'text-foreground', decimals = 1 }: {
  label: string;
  value: number;
  suffix?: string;
  tooltip: string;
  color?: string;
  decimals?: number;
}) {
  const animated = useAnimatedValue(value);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="rounded-xl border border-border/15 p-4 cursor-help transition-all hover:border-border/30 hover:bg-secondary/10" style={{ background: 'linear-gradient(180deg, hsl(220 18% 10%), hsl(220 18% 7%))' }}>
            <div className="flex items-center gap-1.5 mb-2">
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{label}</span>
              <Info className="w-2.5 h-2.5 text-muted-foreground/40" />
            </div>
            <p className={`text-xl sm:text-2xl font-bold tabular-nums leading-none ${color}`}>
              {animated.toFixed(decimals)}{suffix || ''}
            </p>
          </div>
        </TooltipTrigger>
        <TooltipContent className="text-xs max-w-[200px]">{tooltip}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default function StrategyIntelligencePanel({
  winCount, totalClosed, closedPositions, sharpeRatio, maxDrawdown, avgHoldTime, loading,
}: StrategyIntelligencePanelProps) {

  const metrics = useMemo(() => {
    const winRate = totalClosed > 0 ? (winCount / totalClosed) * 100 : 0;

    const gains = closedPositions.filter(p => (p.profit_loss_percent ?? 0) > 0).map(p => p.profit_loss_percent ?? 0);
    const losses = closedPositions.filter(p => (p.profit_loss_percent ?? 0) <= 0).map(p => p.profit_loss_percent ?? 0);
    const avgGain = gains.length > 0 ? gains.reduce((s, v) => s + v, 0) / gains.length : 0;
    const avgLoss = losses.length > 0 ? losses.reduce((s, v) => s + v, 0) / losses.length : 0;
    const rugSurvival = totalClosed > 0 ? ((totalClosed - losses.filter(l => l < -80).length) / totalClosed) * 100 : 100;
    const profitFactor = Math.abs(avgLoss) > 0 ? (gains.reduce((s, v) => s + v, 0)) / Math.abs(losses.reduce((s, v) => s + v, 0) || 1) : 0;

    return [
      { label: "Win Rate", value: winRate, suffix: "%", tooltip: "Percentage of profitable trades", color: winRate >= 50 ? 'text-success' : 'text-destructive' },
      { label: "Avg Gain", value: avgGain, suffix: "%", tooltip: "Average profit on winning trades", color: 'text-success' },
      { label: "Avg Loss", value: avgLoss, suffix: "%", tooltip: "Average loss on losing trades", color: 'text-destructive' },
      { label: "Rug Survival", value: rugSurvival, suffix: "%", tooltip: "Percentage of trades that avoided >80% loss (rugs)", color: rugSurvival >= 80 ? 'text-success' : 'text-warning' },
      { label: "Avg Hold Time", value: parseFloat(avgHoldTime) || 0, suffix: avgHoldTime.includes('h') ? 'h' : 'm', tooltip: "Average duration of closed positions", color: 'text-foreground', decimals: 0 },
      { label: "Max Drawdown", value: Math.abs(maxDrawdown), suffix: "%", tooltip: "Maximum peak-to-trough portfolio decline", color: 'text-warning' },
      { label: "Total Trades", value: totalClosed, suffix: "", tooltip: "Total number of closed trades", color: 'text-foreground', decimals: 0 },
      { label: "Profit Factor", value: profitFactor, suffix: "x", tooltip: "Ratio of gross profits to gross losses. >1 = profitable system", color: profitFactor >= 1 ? 'text-success' : 'text-destructive' },
      { label: "Sharpe Ratio", value: sharpeRatio, suffix: "", tooltip: "Risk-adjusted return. >1 = good, >2 = excellent", color: sharpeRatio >= 1 ? 'text-success' : 'text-foreground' },
    ];
  }, [winCount, totalClosed, closedPositions, sharpeRatio, maxDrawdown, avgHoldTime]);

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-6 w-56" />
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[1,2,3,4,5,6,7,8,9].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Brain className="w-4 h-4 text-accent" />
        <h2 className="text-sm font-bold uppercase tracking-widest text-foreground">Strategy Intelligence</h2>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-9 gap-3">
        {metrics.map(m => (
          <AnimatedMetric
            key={m.label}
            label={m.label}
            value={m.value}
            suffix={m.suffix}
            tooltip={m.tooltip}
            color={m.color}
            decimals={m.decimals ?? 1}
          />
        ))}
      </div>
    </div>
  );
}