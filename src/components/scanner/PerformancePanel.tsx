import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RefreshCw } from "lucide-react";
import { formatPercentage } from "@/lib/formatters";

interface PerformancePanelProps {
  winRate: number;
  totalPnL: number;
  avgPnL: number;
  bestTrade: number;
  worstTrade: number;
  totalTrades: number;
  wins?: number;
  losses?: number;
}

export default function PerformancePanel({
  winRate = 0,
  totalPnL = 0,
  avgPnL = 0,
  bestTrade = 0,
  worstTrade = 0,
  totalTrades = 0,
  wins = 0,
  losses = 0,
}: Partial<PerformancePanelProps>) {
  // Donut chart visualization
  const radius = 50;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (winRate / 100) * circumference;
  
  return (
    <Card className="bg-card/80 backdrop-blur-sm border-border/40">
      <CardHeader className="pb-2 pt-3 px-3">
        <CardTitle className="text-xs font-medium flex items-center justify-between">
          <span className="text-muted-foreground">PERFORMANCE</span>
          <span className="text-[10px] text-muted-foreground">{wins}W Win Rate</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-3 pb-3">
        <div className="flex items-center gap-4">
          {/* Donut Chart */}
          <div className="relative w-24 h-24 shrink-0">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
              {/* Background circle */}
              <circle
                cx="60"
                cy="60"
                r={radius}
                fill="none"
                stroke="hsl(var(--muted)/0.3)"
                strokeWidth="10"
              />
              {/* Progress circle */}
              <circle
                cx="60"
                cy="60"
                r={radius}
                fill="none"
                stroke="hsl(var(--success))"
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                className="transition-all duration-500"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-[10px] text-muted-foreground">Win Rate</span>
              <span className="text-xl font-bold text-success">{winRate.toFixed(2)}%</span>
            </div>
          </div>
          
          {/* Stats */}
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-success" />
              <span className="text-[10px] text-muted-foreground flex-1">Total PnL</span>
              <span className={`text-sm font-bold tabular-nums ${totalPnL >= 0 ? 'text-success' : 'text-destructive'}`}>
                {totalPnL >= 0 ? '+' : ''}{formatPercentage(totalPnL)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-blue-400" />
              <span className="text-[10px] text-muted-foreground flex-1">Avg Win Trade</span>
              <span className="text-sm font-bold tabular-nums text-success">
                +{formatPercentage(Math.max(0, avgPnL))}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-destructive" />
              <span className="text-[10px] text-muted-foreground flex-1">Avg Loss Trade</span>
              <span className="text-sm font-bold tabular-nums text-destructive">
                {formatPercentage(worstTrade)}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
