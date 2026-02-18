import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { 
  SubscriptionTier, 
  SubscriptionStatus, 
  TierLimits, 
  getTierLimits, 
  isFeatureAllowed, 
  isWithinLimit, 
  getUsagePercent 
} from "@/lib/subscription-tiers";

interface UsageData {
  validations: number;
  api_intensive: number;
  auto_executions: number;
  clustering: number;
  rpc_simulations: number;
}

interface SubscriptionData {
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  billing_interval: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  grace_period_end: string | null;
}

interface SubscriptionContextType {
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  subscription: SubscriptionData | null;
  usage: UsageData;
  limits: TierLimits;
  loading: boolean;
  // Access checks
  canUseFeature: (feature: keyof TierLimits) => boolean;
  isWithinUsageLimit: (field: keyof TierLimits) => boolean;
  getUsagePercentage: (field: keyof TierLimits) => number;
  isActive: boolean;
  isPastDue: boolean;
  // Actions
  incrementUsage: (field: string) => Promise<number | null>;
  refreshSubscription: () => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

export const useSubscription = () => {
  const context = useContext(SubscriptionContext);
  if (!context) throw new Error("useSubscription must be used within SubscriptionProvider");
  return context;
};

export const SubscriptionProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [usage, setUsage] = useState<UsageData>({
    validations: 0,
    api_intensive: 0,
    auto_executions: 0,
    clustering: 0,
    rpc_simulations: 0,
  });
  const [loading, setLoading] = useState(true);

  const tier = subscription?.tier || 'free';
  const status = subscription?.status || 'active';
  const limits = getTierLimits(tier);

  const isActive = status === 'active' || status === 'trialing';
  const isPastDue = status === 'past_due';

  const fetchSubscription = useCallback(async () => {
    if (!user) {
      setSubscription(null);
      setUsage({ validations: 0, api_intensive: 0, auto_executions: 0, clustering: 0, rpc_simulations: 0 });
      setLoading(false);
      return;
    }

    try {
      // Fetch subscription
      const { data: subData } = await supabase
        .from('subscriptions')
        .select('tier, status, billing_interval, current_period_end, cancel_at_period_end, grace_period_end')
        .eq('user_id', user.id)
        .single();

      if (subData) {
        setSubscription(subData as unknown as SubscriptionData);
      } else {
        // Create free subscription if none exists
        const { data: newSub } = await supabase
          .from('subscriptions')
          .insert({ user_id: user.id, tier: 'free', status: 'active' })
          .select('tier, status, billing_interval, current_period_end, cancel_at_period_end, grace_period_end')
          .single();
        if (newSub) setSubscription(newSub as unknown as SubscriptionData);
      }

      // Fetch today's usage
      const today = new Date().toISOString().split('T')[0];
      const { data: usageData } = await supabase
        .from('usage_logs')
        .select('validations_count, api_intensive_count, auto_executions_count, clustering_calls_count, rpc_simulations_count')
        .eq('user_id', user.id)
        .eq('usage_date', today)
        .single();

      if (usageData) {
        setUsage({
          validations: usageData.validations_count,
          api_intensive: usageData.api_intensive_count,
          auto_executions: usageData.auto_executions_count,
          clustering: usageData.clustering_calls_count,
          rpc_simulations: usageData.rpc_simulations_count,
        });
      }
    } catch (err) {
      console.error('[Subscription] Fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchSubscription();
  }, [fetchSubscription]);

  const canUseFeature = useCallback((feature: keyof TierLimits): boolean => {
    if (!isActive && !isPastDue) return false;
    return isFeatureAllowed(tier, feature);
  }, [tier, isActive, isPastDue]);

  const isWithinUsageLimit = useCallback((field: keyof TierLimits): boolean => {
    const usageMap: Record<string, number> = {
      validationsPerDay: usage.validations,
      autoExecutionsPerDay: usage.auto_executions,
      clusteringCallsPerDay: usage.clustering,
      rpcSimulationsPerDay: usage.rpc_simulations,
    };
    return isWithinLimit(tier, field, usageMap[field] || 0);
  }, [tier, usage]);

  const getUsagePercentage = useCallback((field: keyof TierLimits): number => {
    const usageMap: Record<string, number> = {
      validationsPerDay: usage.validations,
      autoExecutionsPerDay: usage.auto_executions,
      clusteringCallsPerDay: usage.clustering,
      rpcSimulationsPerDay: usage.rpc_simulations,
    };
    return getUsagePercent(tier, field, usageMap[field] || 0);
  }, [tier, usage]);

  const incrementUsage = useCallback(async (field: string): Promise<number | null> => {
    if (!user) return null;
    try {
      const { data, error } = await supabase.rpc('increment_usage', {
        _user_id: user.id,
        _field: field,
        _amount: 1,
      });
      if (error) throw error;
      
      // Update local state
      const fieldMap: Record<string, keyof UsageData> = {
        validations: 'validations',
        api_intensive: 'api_intensive',
        auto_executions: 'auto_executions',
        clustering: 'clustering',
        rpc_simulations: 'rpc_simulations',
      };
      const key = fieldMap[field];
      if (key) {
        setUsage(prev => ({ ...prev, [key]: data as number }));
      }
      return data as number;
    } catch (err) {
      console.error('[Subscription] Usage increment error:', err);
      return null;
    }
  }, [user]);

  return (
    <SubscriptionContext.Provider value={{
      tier,
      status,
      subscription,
      usage,
      limits,
      loading,
      canUseFeature,
      isWithinUsageLimit,
      getUsagePercentage,
      isActive,
      isPastDue,
      incrementUsage,
      refreshSubscription: fetchSubscription,
    }}>
      {children}
    </SubscriptionContext.Provider>
  );
};
