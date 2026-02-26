import { useMemo } from "react";
import { ShieldAlert, Droplets, Eye, AlertTriangle, BarChart3 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useDisplayUnit } from "@/contexts/DisplayUnitContext";
import { differenceInMinutes } from "date-fns";

interface DashboardRiskSidebarProps {
  positions: {
    id: string;
    created_at: string;
    entry_value?: number | null;
    profit_loss_percent?: number | null;
  }[];
  totalTrades: number;
}

// Mini donut SVG
function MiniDonut({ percent }: { percent: number }) {
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;
  const color = percent <= 33 ? 'hsl(95, 80%, 45%)' : percent <= 66 ? 'hsl(42, 85%, 52%)' : 'hsl(0, 72%, 51%)';

  return (
    <div className="relative w-[72px] h-[72px]">
      <svg width="72" height="72" viewBox="0 0 72 72" className="-rotate-90">
        <circle cx="36" cy="36" r={radius} fill="none" stroke="hsl(140 12% 16%)" strokeWidth="6" />
        <circle
          cx="36" cy="36" r={radius} fill="none"
          stroke={color} strokeWidth="6"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-700"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-sm font-bold tabular-nums text-foreground">{percent}%</span>
      </div>
    </div>
  );
}

export default function DashboardRiskSidebar({ positions, totalTrades }: DashboardRiskSidebarProps) {
  const { formatSolNativeValue } = useDisplayUnit();

  // Calculate real metrics from positions
  const metrics = useMemo(() => {
    const freshPoolCount = positions.filter(p => {
      const ageMin = differenceInMinutes(new Date(), new Date(p.created_at));
      return ageMin < 120; // Less than 2 hours old
    }).length;

    const totalExposure = positions.reduce((s, p) => s + (p.entry_value ?? 0), 0);
    
    // Risk score based on concentration and freshness
    const freshRatio = positions.length > 0 ? (freshPoolCount / positions.length) * 100 : 0;
    const riskScore = positions.length === 0 ? 0 : Math.min(Math.round(freshRatio * 0.5 + positions.length * 3), 100);
    
    const riskLevel = riskScore <= 33 ? 'Low' : riskScore <= 66 ? 'Medium' : 'High';
    const riskColor = riskScore <= 33 ? 'text-success' : riskScore <= 66 ? 'text-warning' : 'text-destructive';

    return { freshPoolCount, totalExposure, riskScore, riskLevel, riskColor };
  }, [positions]);

  const exposureFormatted = formatSolNativeValue(metrics.totalExposure);

  return (
    <div className="rounded-xl border border-border/20 overflow-hidden" style={{ background: 'var(--gradient-card-sidebar)' }}>
      {/* Header */}
      <div className="px-4 py-3 flex items-center justify-between border-b border-border/15">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-warning" />
          <span className="text-xs font-bold uppercase tracking-widest text-foreground">Risk Overview</span>
        </div>
        <Badge variant="outline" className={`text-[8px] px-1.5 py-0 ${metrics.riskColor} border-current/30`}>
          {metrics.riskLevel}
        </Badge>
      </div>

      <div className="p-4 space-y-3">
        {/* Fresh Pools + Risk Score Donut */}
        <div className="flex items-start justify-between">
          <div className="space-y-3 flex-1">
            <div className="flex items-center gap-2">
              <Droplets className="w-3.5 h-3.5 text-primary" />
              <div>
                <p className="text-xs font-semibold text-foreground">Fresh Positions ({metrics.freshPoolCount})</p>
                <p className="text-[10px] text-muted-foreground">&lt; 2 hours old</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Eye className="w-3.5 h-3.5 text-accent" />
              <div>
                <p className="text-xs font-semibold text-foreground">Active Positions ({positions.length})</p>
                <p className="text-[10px] text-muted-foreground">Currently tracked</p>
              </div>
            </div>
          </div>
          <MiniDonut percent={metrics.riskScore} />
        </div>

        {/* Total Exposure */}
        <div className="flex items-center justify-between py-2 border-t border-border/15">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5 text-warning" />
            <span className="text-xs font-semibold text-foreground">Total Exposure</span>
          </div>
          <span className="text-xs font-bold text-foreground tabular-nums">{exposureFormatted.primary}</span>
        </div>

        {/* Total Trades */}
        <div className="flex items-center justify-between py-2 border-t border-border/15">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs font-semibold text-foreground">Closed Trades</span>
          </div>
          <span className="text-xs font-bold text-foreground tabular-nums">{totalTrades}</span>
        </div>
      </div>
    </div>
  );
}
