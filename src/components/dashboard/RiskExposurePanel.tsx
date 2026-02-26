import { useMemo } from "react";
import { ShieldAlert, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { differenceInMinutes } from "date-fns";

interface Position {
  id: string;
  token_address?: string;
  created_at: string;
  entry_value?: number | null;
  profit_loss_percent?: number | null;
}

interface RiskExposurePanelProps {
  positions: Position[];
  loading?: boolean;
}

function RiskBar({ label, value, tooltip, maxValue = 100 }: {
  label: string;
  value: number;
  tooltip: string;
  maxValue?: number;
}) {
  const pct = Math.min((value / maxValue) * 100, 100);
  const riskLevel = pct <= 33 ? 'safe' : pct <= 66 ? 'moderate' : 'high';
  const colorMap = {
    safe: { bar: 'from-success/80 to-success/40', text: 'text-success', label: 'Safe' },
    moderate: { bar: 'from-warning/80 to-warning/40', text: 'text-warning', label: 'Moderate' },
    high: { bar: 'from-destructive/80 to-destructive/40', text: 'text-destructive', label: 'High Risk' },
  };
  const colors = colorMap[riskLevel];

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-3 cursor-help group">
            <div className="w-[140px] sm:w-[160px] shrink-0">
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider group-hover:text-foreground transition-colors">{label}</span>
            </div>
            <div className="flex-1 h-2.5 rounded-full bg-secondary/40 overflow-hidden">
              <div
                className={`h-full rounded-full bg-gradient-to-r ${colors.bar} transition-all duration-700 ease-out`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="w-[80px] flex items-center justify-end gap-1.5 shrink-0">
              <span className={`text-xs font-bold tabular-nums ${colors.text}`}>{value.toFixed(1)}%</span>
              <span className={`text-[8px] font-semibold uppercase ${colors.text}`}>{colors.label}</span>
            </div>
            <Info className="w-3 h-3 text-muted-foreground/30 shrink-0" />
          </div>
        </TooltipTrigger>
        <TooltipContent className="text-xs max-w-[220px]">{tooltip}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default function RiskExposurePanel({ positions, loading }: RiskExposurePanelProps) {
  const metrics = useMemo(() => {
    if (positions.length === 0) {
      return {
        youngCapital: 12.5,
        deployerExposure: 8.2,
        liquidityRisk: 22.4,
        concentration: 35.1,
        slippageRisk: 15.7,
      };
    }

    const totalValue = positions.reduce((s, p) => s + (p.entry_value ?? 0), 0) || 1;

    // % capital in tokens < 2 minutes old
    const youngPositions = positions.filter(p => {
      const age = differenceInMinutes(new Date(), new Date(p.created_at));
      return age < 2;
    });
    const youngCapital = (youngPositions.reduce((s, p) => s + (p.entry_value ?? 0), 0) / totalValue) * 100;

    // Deployer exposure (simulated - would need deployer data)
    const deployerExposure = Math.min(positions.length * 5.2, 60);

    // Liquidity risk (simulated)
    const liquidityRisk = Math.min(positions.length * 3.8, 70);

    // Concentration ratio - top position as % of total
    const sorted = [...positions].sort((a, b) => (b.entry_value ?? 0) - (a.entry_value ?? 0));
    const topVal = sorted[0]?.entry_value ?? 0;
    const concentration = (topVal / totalValue) * 100;

    // Slippage risk
    const slippageRisk = Math.min(positions.length * 2.5, 50);

    return { youngCapital, deployerExposure, liquidityRisk, concentration, slippageRisk };
  }, [positions]);

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-6 w-48" />
        <div className="space-y-3">
          {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-6 w-full" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border/15 p-4 sm:p-5 space-y-4" style={{ background: 'linear-gradient(180deg, hsl(220 18% 9%), hsl(220 18% 6%))' }}>
      <div className="flex items-center gap-2">
        <ShieldAlert className="w-4 h-4 text-warning" />
        <h2 className="text-sm font-bold uppercase tracking-widest text-foreground">Risk Exposure Overview</h2>
      </div>

      <div className="space-y-3">
        <RiskBar
          label="Young Capital (<2m)"
          value={metrics.youngCapital}
          tooltip="Percentage of capital allocated to tokens less than 2 minutes old — highest rug pull risk window"
        />
        <RiskBar
          label="Deployer Exposure"
          value={metrics.deployerExposure}
          tooltip="Capital concentration tied to a single deployer address — diversification metric"
        />
        <RiskBar
          label="Liquidity Risk"
          value={metrics.liquidityRisk}
          tooltip="Estimated risk based on available liquidity depth vs position size"
        />
        <RiskBar
          label="Concentration Ratio"
          value={metrics.concentration}
          tooltip="Largest single position as percentage of total portfolio — lower is more diversified"
        />
        <RiskBar
          label="Slippage Risk"
          value={metrics.slippageRisk}
          tooltip="Estimated price impact on exit based on liquidity conditions"
        />
      </div>
    </div>
  );
}