import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription, TIER_CONFIG, SubscriptionPlan } from "./useSubscription";

export type UsageType = "token_validation" | "auto_execution" | "clustering_call" | "api_check";

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
      return data;
    },
    enabled: !!user,
    staleTime: 30_000,
  });

  const incrementUsage = useMutation({
    mutationFn: async (type: UsageType) => {
      if (!user) throw new Error("Not authenticated");

      const { data: existing } = await supabase
        .from("usage_logs")
        .select("id, count")
        .eq("user_id", user.id)
        .eq("usage_type", type)
        .eq("usage_date", today)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("usage_logs")
          .update({ count: existing.count + 1 })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("usage_logs")
          .insert({ user_id: user.id, usage_type: type, usage_date: today, count: 1 });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["usage_logs", user?.id, today] });
    },
  });

  const getUsage = (type: UsageType): number => {
    const entry = usageData.find((u: any) => u.usage_type === type);
    return entry?.count || 0;
  };

  const getLimit = (type: UsageType): number => {
    const key = USAGE_TYPE_TO_LIMIT_KEY[type];
    return (TIER_CONFIG[plan]?.limits as any)?.[key] || 0;
  };

  const canUse = (type: UsageType): boolean => {
    return getUsage(type) < getLimit(type);
  };

  const getUsagePercent = (type: UsageType): number => {
    const limit = getLimit(type);
    if (limit === 0) return 100;
    return Math.min(100, Math.round((getUsage(type) / limit) * 100));
  };

  return {
    usageData,
    getUsage,
    getLimit,
    canUse,
    getUsagePercent,
    incrementUsage: incrementUsage.mutate,
  };
}
