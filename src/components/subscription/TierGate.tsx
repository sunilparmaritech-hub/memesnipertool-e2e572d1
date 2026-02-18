import { ReactNode } from "react";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { TierLimits, SubscriptionTier, TIER_CONFIGS } from "@/lib/subscription-tiers";
import { Lock, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

interface TierGateProps {
  /** Feature key to check */
  feature?: keyof TierLimits;
  /** Minimum tier required */
  requiredTier?: SubscriptionTier;
  /** Usage limit field to check */
  usageField?: keyof TierLimits;
  /** Content to show when allowed */
  children: ReactNode;
  /** Fallback when blocked - defaults to upgrade prompt */
  fallback?: ReactNode;
  /** Show inline lock overlay instead of replacing content */
  overlay?: boolean;
}

const TIER_ORDER: SubscriptionTier[] = ['free', 'pro', 'elite'];

export default function TierGate({ 
  feature, 
  requiredTier, 
  usageField, 
  children, 
  fallback, 
  overlay = false 
}: TierGateProps) {
  const { tier, canUseFeature, isWithinUsageLimit } = useSubscription();
  const navigate = useNavigate();

  let blocked = false;
  let reason = '';

  if (feature && !canUseFeature(feature)) {
    blocked = true;
    reason = `Upgrade to unlock this feature`;
  }

  if (requiredTier) {
    const currentIdx = TIER_ORDER.indexOf(tier);
    const requiredIdx = TIER_ORDER.indexOf(requiredTier);
    if (currentIdx < requiredIdx) {
      blocked = true;
      reason = `Requires ${TIER_CONFIGS[requiredTier].name} plan`;
    }
  }

  if (usageField && !isWithinUsageLimit(usageField)) {
    blocked = true;
    reason = `Daily limit reached`;
  }

  if (!blocked) return <>{children}</>;

  if (fallback) return <>{fallback}</>;

  if (overlay) {
    return (
      <div className="relative">
        <div className="opacity-30 pointer-events-none select-none blur-[2px]">
          {children}
        </div>
        <div className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-sm rounded-lg">
          <div className="text-center space-y-2 p-4">
            <Lock className="w-6 h-6 text-muted-foreground mx-auto" />
            <p className="text-xs text-muted-foreground font-medium">{reason}</p>
            <Button size="sm" variant="outline" onClick={() => navigate('/pricing')} className="text-xs h-7">
              <Zap className="w-3 h-3 mr-1" />
              Upgrade
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center p-6 border border-border/50 rounded-lg bg-card/50">
      <div className="text-center space-y-3">
        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
          <Lock className="w-5 h-5 text-primary" />
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">{reason}</p>
          <p className="text-xs text-muted-foreground mt-1">
            You're on the {TIER_CONFIGS[tier].name} plan
          </p>
        </div>
        <Button size="sm" onClick={() => navigate('/pricing')}>
          <Zap className="w-3 h-3 mr-1" />
          View Plans
        </Button>
      </div>
    </div>
  );
}
