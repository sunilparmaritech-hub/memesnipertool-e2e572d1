import { Card, CardContent } from "@/components/ui/card";
import { DollarSign, Wallet, TrendingUp, Target, Percent, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ScannerStatsRowProps {
  invested: number;
  openValue: number;
  activeCount: number;
  profit: number;
  targetsCount: number;
  winRate: number;
  totalTrades: number;
  solPrice?: number;
}

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  subValue?: string;
  iconBg?: string;
  valueColor?: string;
}

function StatCard({ icon, label, value, subValue, iconBg = "bg-primary/10", valueColor = "text-foreground" }: StatCardProps) {
  return (
    <Card className="bg-card/80 backdrop-blur-sm border-border/40">
      <CardContent className="p-3">
        <div className="flex items-start gap-2.5">
          <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center shrink-0", iconBg)}>
            {icon}
          </div>
          <div className="min-w-0 flex-1">
            {subValue && (
              <span className="text-[10px] text-muted-foreground block">{subValue}</span>
            )}
            <span className="text-xs text-muted-foreground block mb-0.5">{label}</span>
            <span className={cn("text-xl font-bold tabular-nums", valueColor)}>{value}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function ScannerStatsRow({
  invested,
  openValue,
  activeCount,
  profit,
  targetsCount,
  winRate,
  totalTrades,
  solPrice = 150,
}: ScannerStatsRowProps) {
  const investedUsd = (invested * solPrice).toFixed(0);
  const openValueUsd = (openValue * solPrice).toFixed(0);
  const profitLabel = profit >= 0 ? `${profit} profit` : `${Math.abs(profit)} loss`;
  
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
      <StatCard
        icon={<DollarSign className="w-4 h-4 text-primary" />}
        label="Invested"
        value={`${invested.toFixed(4)} SOL`}
        subValue={`$${investedUsd}`}
        iconBg="bg-primary/10"
      />
      <StatCard
        icon={<Wallet className="w-4 h-4 text-success" />}
        label="Open Value"
        value={`${openValue.toFixed(4)} SOL`}
        subValue={`$${openValueUsd}`}
        iconBg="bg-success/10"
        valueColor={openValue > invested ? "text-success" : "text-foreground"}
      />
      <StatCard
        icon={<TrendingUp className="w-4 h-4 text-blue-400" />}
        label="Active"
        value={activeCount}
        subValue="● Active"
        iconBg="bg-blue-500/10"
      />
      <StatCard
        icon={<BarChart3 className="w-4 h-4 text-success" />}
        label="Profit"
        value={profit}
        subValue={profitLabel}
        iconBg="bg-success/10"
        valueColor={profit >= 0 ? "text-success" : "text-destructive"}
      />
      <StatCard
        icon={<Target className="w-4 h-4 text-warning" />}
        label="Targets"
        value={targetsCount}
        iconBg="bg-warning/10"
      />
      <div className="col-span-2 sm:col-span-1 grid grid-cols-2 gap-2 lg:contents">
        <StatCard
          icon={<Percent className="w-4 h-4 text-primary" />}
          label="Win Rate"
          value={`${winRate.toFixed(0)}%`}
          iconBg="bg-primary/10"
          valueColor="text-primary"
        />
        <StatCard
          icon={<BarChart3 className="w-4 h-4 text-muted-foreground" />}
          label="Trades"
          value={totalTrades}
          iconBg="bg-muted/20"
        />
      </div>
    </div>
  );
}
