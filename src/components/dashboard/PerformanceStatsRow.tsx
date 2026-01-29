import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface StatItemProps {
  label: string;
  value: string;
  subValue?: string;
  isPositive?: boolean;
  isNegative?: boolean;
  tooltip?: string;
}

const StatItem = ({ label, value, subValue, isPositive, isNegative, tooltip }: StatItemProps) => (
  <div className="flex flex-col gap-0.5">
    <div className="flex items-center gap-1 text-muted-foreground">
      <span className="text-[10px] uppercase tracking-wider font-medium">{label}</span>
      {tooltip && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>
              <Info className="w-3 h-3 opacity-60" />
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs">{tooltip}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
    <div className="flex items-center gap-1">
      <span className={cn(
        "text-lg font-bold tracking-tight",
        isPositive && "text-success",
        isNegative && "text-destructive",
        !isPositive && !isNegative && "text-foreground"
      )}>
        {value}
      </span>
      {(isPositive || isNegative) && (
        isPositive ? (
          <TrendingUp className="w-3.5 h-3.5 text-success" />
        ) : (
          <TrendingDown className="w-3.5 h-3.5 text-destructive" />
        )
      )}
    </div>
    {subValue && (
      <span className={cn(
        "text-[11px] font-medium",
        isPositive && "text-success/80",
        isNegative && "text-destructive/80",
        !isPositive && !isNegative && "text-muted-foreground"
      )}>
        {subValue}
      </span>
    )}
  </div>
);

interface PerformanceStatsRowProps {
  totalPnL: number;
  totalPnLPercent: number;
  roi: number;
  sharpeRatio: number;
  maxDrawdown: number;
  avgHoldTime: string;
  bestTrade: number;
  worstTrade: number;
}

export default function PerformanceStatsRow({
  totalPnL,
  totalPnLPercent,
  roi,
  sharpeRatio,
  maxDrawdown,
  avgHoldTime,
  bestTrade,
  worstTrade,
}: PerformanceStatsRowProps) {
  return (
    <Card className="border border-border/50 bg-card/80 backdrop-blur-sm">
      <CardContent className="p-3">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 md:gap-4">
          <StatItem
            label="Total P&L"
            value={`${totalPnL >= 0 ? '+' : ''}${totalPnL.toFixed(4)} SOL`}
            subValue={`${totalPnLPercent >= 0 ? '+' : ''}${totalPnLPercent.toFixed(1)}%`}
            isPositive={totalPnL >= 0}
            isNegative={totalPnL < 0}
          />
          <StatItem
            label="ROI %"
            value={`${roi.toFixed(1)}%`}
            isPositive={roi >= 0}
            isNegative={roi < 0}
            tooltip="Return on Investment"
          />
          <StatItem
            label="Sharpe Ratio"
            value={sharpeRatio.toFixed(1)}
            tooltip="Risk-adjusted return"
          />
          <StatItem
            label="Max Drawdown"
            value={`${maxDrawdown.toFixed(1)}%`}
            isNegative={maxDrawdown < 0}
            tooltip="Maximum peak-to-trough decline"
          />
          <StatItem
            label="Avg Hold Time"
            value={avgHoldTime}
            tooltip="Average position duration"
          />
          <StatItem
            label="Best Trade"
            value={`${bestTrade >= 0 ? '+' : ''}${bestTrade.toFixed(4)} SOL`}
            isPositive={bestTrade >= 0}
            tooltip="Highest profit trade"
          />
          <StatItem
            label="Worst Trade"
            value={`${worstTrade.toFixed(4)} SOL`}
            isNegative={worstTrade < 0}
            tooltip="Highest loss trade"
          />
        </div>
      </CardContent>
    </Card>
  );
}
