/**
 * Feature Access Control Hook
 * 
 * Checks subscription tier permissions AND daily usage limits
 * before allowing gated features like auto-trade, clustering,
 * and capital preservation.
 */

import { useCallback } from "react";
import { useSubscription, type TierLimits } from "./useSubscription";
import { useUsageTracking, type UsageType } from "./useUsageTracking";
import { useToast } from "./use-toast";

export type GatedFeature =
  | "auto_trade"
  | "early_entry"
  | "advanced_clustering"
  | "capital_preservation"
  | "priority_support";

const FEATURE_TO_TIER_KEY: Record<GatedFeature, keyof TierLimits> = {
  auto_trade: "auto_trade",
  early_entry: "early_entry",
  advanced_clustering: "advanced_clustering",
  capital_preservation: "capital_preservation",
  priority_support: "priority_support",
};

const FEATURE_LABELS: Record<GatedFeature, string> = {
  auto_trade: "Auto Trading",
  early_entry: "Early Entry Mode",
  advanced_clustering: "Advanced Clustering",
  capital_preservation: "Capital Preservation",
  priority_support: "Priority Support",
};

// Maps features to their usage counter type (if metered)
const FEATURE_USAGE_TYPE: Partial<Record<GatedFeature, UsageType>> = {
  auto_trade: "auto_execution",
  advanced_clustering: "clustering_call",
};

export interface AccessCheckResult {
  allowed: boolean;
  reason?: string;
  requiredPlan?: string;
  usagePercent?: number;
}

export function useFeatureAccess() {
  const { plan, isPaid, hasFeature, limits } = useSubscription();
  const { canUse, getUsagePercent, incrementUsage } = useUsageTracking();
  const { toast } = useToast();

  /**
   * Check if a gated feature is accessible (tier + usage).
   * Does NOT show a toast or increment counters — pure read.
   */
  const checkAccess = useCallback(
    (feature: GatedFeature): AccessCheckResult => {
      // 1. Tier permission check
      const tierKey = FEATURE_TO_TIER_KEY[feature];
      if (!hasFeature(tierKey)) {
        const minPlan = feature === "advanced_clustering" || feature === "capital_preservation"
          ? "Elite"
          : "Pro";
        return {
          allowed: false,
          reason: `${FEATURE_LABELS[feature]} requires a ${minPlan} plan or higher.`,
          requiredPlan: minPlan,
        };
      }

      // 2. Usage limit check (if metered)
      const usageType = FEATURE_USAGE_TYPE[feature];
      if (usageType) {
        if (!canUse(usageType)) {
          return {
            allowed: false,
            reason: `Daily ${FEATURE_LABELS[feature]} limit reached (${plan} tier).`,
            usagePercent: 100,
          };
        }
        return { allowed: true, usagePercent: getUsagePercent(usageType) };
      }

      return { allowed: true };
    },
    [plan, hasFeature, canUse, getUsagePercent]
  );

  /**
   * Guard a feature call — checks access and shows a toast on denial.
   * Returns true if allowed; false (with toast) if blocked.
   * Optionally increments the usage counter on success.
   */
  const guardFeature = useCallback(
    (feature: GatedFeature, options?: { incrementOnAllow?: boolean }): boolean => {
      const result = checkAccess(feature);
      if (!result.allowed) {
        toast({
          title: `${FEATURE_LABELS[feature]} Locked`,
          description: result.reason,
          variant: "destructive",
        });
        return false;
      }

      // Increment usage counter if requested
      if (options?.incrementOnAllow) {
        const usageType = FEATURE_USAGE_TYPE[feature];
        if (usageType) {
          incrementUsage(usageType);
        }
      }

      return true;
    },
    [checkAccess, toast, incrementUsage]
  );

  /**
   * Silent tier check — no toast, no usage increment.
   * Useful in validation pipelines that don't want UI side-effects.
   */
  const isTierAllowed = useCallback(
    (feature: GatedFeature): boolean => hasFeature(FEATURE_TO_TIER_KEY[feature]),
    [hasFeature]
  );

  return {
    checkAccess,
    guardFeature,
    isTierAllowed,
    plan,
    isPaid,
    limits,
  };
}
