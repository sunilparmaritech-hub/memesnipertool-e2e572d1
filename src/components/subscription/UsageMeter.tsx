import { useSubscription } from "@/contexts/SubscriptionContext";
import { TierLimits, getTierLimits } from "@/lib/subscription-tiers";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle } from "lucide-react";

interface UsageMeterProps {
  field: keyof TierLimits;
  label: string;
  compact?: boolean;
}

export default function UsageMeter({ field, label, compact = false }: UsageMeterProps) {
  const { tier, usage, getUsagePercentage } = useSubscription();
  const limits = getTierLimits(tier);
  const limit = limits[field];

  if (typeof limit !== 'number') return null;

  const usageMap: Record<string, number> = {
    validationsPerDay: usage.validations,
    autoExecutionsPerDay: usage.auto_executions,
    clusteringCallsPerDay: usage.clustering,
    rpcSimulationsPerDay: usage.rpc_simulations,
  };
  
  const current = usageMap[field] || 0;
  const percent = getUsagePercentage(field);
  const isUnlimited = limit === -1;
  const isNearLimit = percent >= 80;
  const isAtLimit = percent >= 100;

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-muted-foreground whitespace-nowrap">{label}</span>
        <Progress 
          value={isUnlimited ? 0 : percent} 
          className={`h-1.5 flex-1 ${isAtLimit ? '[&>div]:bg-destructive' : isNearLimit ? '[&>div]:bg-warning' : ''}`} 
        />
        <span className={`text-[10px] font-mono ${isAtLimit ? 'text-destructive' : isNearLimit ? 'text-warning' : 'text-muted-foreground'}`}>
          {isUnlimited ? '∞' : `${current}/${limit}`}
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className={`text-xs font-mono ${isAtLimit ? 'text-destructive' : isNearLimit ? 'text-warning' : 'text-foreground'}`}>
          {isUnlimited ? `${current} (unlimited)` : `${current} / ${limit}`}
        </span>
      </div>
      {!isUnlimited && (
        <Progress 
          value={percent} 
          className={`h-2 ${isAtLimit ? '[&>div]:bg-destructive' : isNearLimit ? '[&>div]:bg-warning' : ''}`} 
        />
      )}
      {isNearLimit && !isAtLimit && (
        <p className="text-[10px] text-warning flex items-center gap-1">
          <AlertTriangle className="w-3 h-3" />
          Approaching daily limit — consider upgrading
        </p>
      )}
      {isAtLimit && (
        <p className="text-[10px] text-destructive flex items-center gap-1">
          <AlertTriangle className="w-3 h-3" />
          Daily limit reached
        </p>
      )}
    </div>
  );
}
