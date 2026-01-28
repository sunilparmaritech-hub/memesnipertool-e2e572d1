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
              <Info className="w-3 h-3" />
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs">{tooltip}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
    <div className="flex items-center gap-1.5">
      <span className={cn(
        "text-xl font-bold",
        isPositive && "text-success",
        isNegative && "text-destructive",
        !isPositive && !isNegative && "text-foreground"
      )}>
        {value}
      </span>
      {(isPositive || isNegative) && (
        isPositive ? (
          <TrendingUp className="w-4 h-4 text-success" />
        ) : (
          <TrendingDown className="w-4 h-4 text-destructive" />
        )
      )}
    </div>
    {subValue && (
      <span className={cn(
        "text-xs font-medium",
        isPositive && "text-success",
        isNegative && "text-destructive",
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
    <Card className="border-0 bg-gradient-to-br from-card/90 to-card/60 backdrop-blur-xl">
      <CardContent className="p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 md:gap-6">
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
