import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, TrendingDown, DollarSign, Activity, Clock } from "lucide-react";

interface StatsGridProps {
  totalValue: number;
  totalPnL: number;
  totalPnLPercent: number;
  openPositionsCount: number;
  closedPositionsCount: number;
}

const formatCurrency = (value: number) => {
  if (Math.abs(value) >= 1000000) return `$${(value / 1000000).toFixed(2)}M`;
  if (Math.abs(value) >= 1000) return `$${(value / 1000).toFixed(1)}K`;
  return `$${value.toFixed(2)}`;
};

export default function StatsGrid({
  totalValue,
  totalPnL,
  totalPnLPercent,
  openPositionsCount,
  closedPositionsCount,
}: StatsGridProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <Card className="bg-card/80 backdrop-blur-sm border-border/50">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-500/20">
              <DollarSign className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Portfolio Value</p>
              <p className="text-xl font-bold text-foreground">{formatCurrency(totalValue)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card/80 backdrop-blur-sm border-border/50">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${totalPnL >= 0 ? 'bg-success/20' : 'bg-destructive/20'}`}>
              {totalPnL >= 0 ? (
                <TrendingUp className="w-5 h-5 text-success" />
              ) : (
                <TrendingDown className="w-5 h-5 text-destructive" />
              )}
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Total P&L</p>
              <p className={`text-xl font-bold ${totalPnL >= 0 ? 'text-success' : 'text-destructive'}`}>
                {totalPnL >= 0 ? '+' : ''}{formatCurrency(totalPnL)}
                <span className="text-sm ml-1 opacity-80">({totalPnLPercent.toFixed(1)}%)</span>
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card/80 backdrop-blur-sm border-border/50">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/20">
              <Activity className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Active Trades</p>
              <p className="text-xl font-bold text-foreground">{openPositionsCount}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card/80 backdrop-blur-sm border-border/50">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-muted">
              <Clock className="w-5 h-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Completed</p>
              <p className="text-xl font-bold text-foreground">{closedPositionsCount}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
