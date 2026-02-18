import { useSubscription } from "@/contexts/SubscriptionContext";
import { TIER_CONFIGS } from "@/lib/subscription-tiers";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Zap, AlertTriangle, Crown } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function SubscriptionBanner() {
  const { tier, status, usage, limits, isPastDue, getUsagePercentage } = useSubscription();
  const navigate = useNavigate();
  const config = TIER_CONFIGS[tier];

  const validationPercent = getUsagePercentage('validationsPerDay');
  const isNearLimit = validationPercent >= 80;

  if (tier === 'elite' && status === 'active') return null;

  return (
    <div className={`flex items-center gap-3 p-2.5 rounded-lg border text-xs ${
      isPastDue ? 'bg-destructive/10 border-destructive/30' :
      isNearLimit ? 'bg-warning/10 border-warning/30' :
      'bg-card/50 border-border/50'
    }`}>
      {isPastDue ? (
        <>
          <AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0" />
          <span className="text-destructive font-medium">Payment past due — update billing to keep access</span>
          <Button size="sm" variant="destructive" className="ml-auto h-6 text-[10px]" onClick={() => navigate('/pricing')}>
            Fix Billing
          </Button>
        </>
      ) : (
        <>
          <Badge variant="outline" className="text-[10px] flex-shrink-0">
            {config.badge} {config.name}
          </Badge>
          {limits.validationsPerDay > 0 && (
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <span className="text-muted-foreground whitespace-nowrap">Validations</span>
              <Progress value={validationPercent} className={`h-1.5 flex-1 max-w-[100px] ${isNearLimit ? '[&>div]:bg-warning' : ''}`} />
              <span className={`font-mono ${isNearLimit ? 'text-warning' : 'text-muted-foreground'}`}>
                {usage.validations}/{limits.validationsPerDay}
              </span>
            </div>
          )}
          {tier !== 'elite' && (
            <Button size="sm" variant="outline" className="ml-auto h-6 text-[10px] gap-1" onClick={() => navigate('/pricing')}>
              <Zap className="w-3 h-3" />
              Upgrade
            </Button>
          )}
        </>
      )}
    </div>
  );
}
