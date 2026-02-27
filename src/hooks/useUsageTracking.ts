import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription, TIER_CONFIG, SubscriptionPlan } from "./useSubscription";

export type UsageType = "token_validation" | "auto_execution" | "clustering_call" | "api_check";

const USAGE_TYPE_TO_FIELD: Record<UsageType, string> = {
  token_validation: "validations_count",
  auto_execution: "auto_executions_count",
  clustering_call: "clustering_calls_count",
  api_check: "api_intensive_count",
};

const USAGE_TYPE_TO_LIMIT_KEY: Record<UsageType, string> = {
  token_validation: "daily_validations",
  auto_execution: "daily_auto_executions",
  clustering_call: "daily_clustering_calls",
  api_check: "daily_api_checks",
};

export function useUsageTracking() {
  const { user } = useAuth();
  const { plan } = useSubscription();
  const queryClient = useQueryClient();
  const today = new Date().toISOString().split("T")[0];

  const { data: usageData = [] } = useQuery({
    queryKey: ["usage_logs", user?.id, today],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("usage_logs")
        .select("*")
        .eq("user_id", user.id)
        .eq("usage_date", today);

      if (error) {
        console.error("Error fetching usage:", error);
        return [];
      }
      return data || [];
    },
    enabled: !!user,
    staleTime: 30_000,
  });

  const incrementUsage = useMutation({
    mutationFn: async (type: UsageType) => {
      if (!user) throw new Error("Not authenticated");
      const field = USAGE_TYPE_TO_FIELD[type] as "validations_count" | "auto_executions_count" | "clustering_calls_count" | "api_intensive_count";
      await supabase.rpc("increment_usage", {
        _user_id: user.id,
        _field: field.replace("_count", "").replace("auto_executions", "auto_executions").replace("api_intensive", "api_intensive").replace("clustering_calls", "clustering").replace("validations", "validations"),
        _amount: 1,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["usage_logs", user?.id, today] });
    },
  });

  const getUsage = (type: UsageType): number => {
    const field = USAGE_TYPE_TO_FIELD[type];
    const row = (usageData as any[])[0];
    return row?.[field] || 0;
  };

  const getLimit = (type: UsageType): number => {
    const key = USAGE_TYPE_TO_LIMIT_KEY[type];
    return (TIER_CONFIG[plan]?.limits as any)?.[key] || 0;
  };

  const isAtLimit = (type: UsageType): boolean => {
    const limit = getLimit(type);
    return limit !== -1 && limit !== 9999 && getUsage(type) >= limit;
  };

  const canUse = (type: UsageType): boolean => !isAtLimit(type);
  const getUsagePercent = (type: UsageType): number => {
    const limit = getLimit(type);
    if (!limit || limit === 9999 || limit === -1) return 0;
    return Math.min(100, Math.round((getUsage(type) / limit) * 100));
  };

  return {
    incrementUsage: incrementUsage.mutate,
    getUsage,
    getLimit,
    isAtLimit,
    canUse,
    getUsagePercent,
    usageData,
  };
}
