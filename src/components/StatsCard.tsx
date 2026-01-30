import { LucideIcon } from "lucide-react";

interface StatsCardProps {
  title: string;
  value: string;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
  icon: LucideIcon;
}

const StatsCard = ({ title, value, change, changeType = "neutral", icon: Icon }: StatsCardProps) => {
  const changeColors = {
    positive: "text-success",
    negative: "text-destructive",
    neutral: "text-muted-foreground",
  };

  return (
    <div className="bg-card/80 backdrop-blur-sm rounded-lg border border-border/40 p-3 hover:border-primary/30 transition-all duration-200">
      <div className="flex items-start gap-2.5">
        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <Icon className="w-4 h-4 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          {change && (
            <span className={`text-[10px] font-medium block ${changeColors[changeType]}`}>
              {change}
            </span>
          )}
          <p className="text-[10px] text-muted-foreground mb-0.5">{title}</p>
          <p className="text-lg font-bold text-foreground tabular-nums truncate">{value}</p>
        </div>
      </div>
    </div>
  );
};

export default StatsCard;
