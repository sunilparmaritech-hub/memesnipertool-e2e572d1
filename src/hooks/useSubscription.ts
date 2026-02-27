/**
 * Credits-based access control hook.
 * Replaces the old Stripe subscription model with a SOL credit system.
 * Retained the same export interface so existing consumers don't break.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCallback } from "react";

export type SubscriptionPlan = "free" | "pro" | "elite" | "enterprise";
export type SubscriptionStatus = "active" | "past_due" | "canceled" | "expired" | "trialing";

export interface Subscription {
  id: string;
  user_id: string;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  billing_interval: "monthly" | "yearly";
  created_at: string;
  updated_at: string;
}

export interface TierLimits {
  daily_validations: number;
  daily_auto_executions: number;
  daily_clustering_calls: number;
  daily_api_checks: number;
  auto_trade: boolean;
  early_entry: boolean;
  advanced_clustering: boolean;
  capital_preservation: boolean;
  priority_support: boolean;
}

/**
 * Credit-based tiers: Users with credits > 0 get full access.
 * The "plan" is now derived from the user's credit balance.
 */
export const TIER_CONFIG: Record<SubscriptionPlan, { name: string; limits: TierLimits; price_monthly: number; price_yearly: number }> = {
  free: {
    name: "Free",
    limits: {
      daily_validations: 5,
      daily_auto_executions: 0,
      daily_clustering_calls: 2,
      daily_api_checks: 10,
      auto_trade: false,
      early_entry: false,
      advanced_clustering: false,
      capital_preservation: false,
      priority_support: false,
    },
    price_monthly: 0,
    price_yearly: 0,
  },
  pro: {
    name: "Active",
    limits: {
      daily_validations: 9999,
      daily_auto_executions: 9999,
      daily_clustering_calls: 9999,
      daily_api_checks: 9999,
      auto_trade: true,
      early_entry: true,
      advanced_clustering: true,
      capital_preservation: true,
      priority_support: false,
    },
    price_monthly: 0,
    price_yearly: 0,
  },
  elite: {
    name: "Active",
    limits: {
      daily_validations: 9999,
      daily_auto_executions: 9999,
      daily_clustering_calls: 9999,
      daily_api_checks: 9999,
      auto_trade: true,
      early_entry: true,
      advanced_clustering: true,
      capital_preservation: true,
      priority_support: true,
    },
    price_monthly: 0,
    price_yearly: 0,
  },
  enterprise: {
    name: "Active",
    limits: {
      daily_validations: 9999,
      daily_auto_executions: 9999,
      daily_clustering_calls: 9999,
      daily_api_checks: 9999,
      auto_trade: true,
      early_entry: true,
      advanced_clustering: true,
      capital_preservation: true,
      priority_support: true,
    },
    price_monthly: 0,
    price_yearly: 0,
  },
};

export function useSubscription() {
  const { user, isAdmin } = useAuth();

  // Read credit balance from user_credits table
  const { data: profile, isLoading, refetch } = useQuery({
    queryKey: ["subscription-credits", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("user_credits")
        .select("credit_balance, total_credits_purchased")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) {
        console.error("Error fetching credit balance:", error);
        return null;
      }
      return data;
    },
    enabled: !!user,
    staleTime: 15_000,
    refetchInterval: 30_000,
  });

  const creditBalance = profile?.credit_balance ?? 0;
  const hasCredits = creditBalance > 0;

  // Admin always gets full access regardless of credit balance
  // Derive plan from credits: has credits = "pro" (all features), no credits = "free"
  const plan: SubscriptionPlan = (isAdmin || hasCredits) ? "pro" : "free";
  const status: SubscriptionStatus = "active";
  const tierConfig = TIER_CONFIG[plan];
  const limits = tierConfig.limits;
  const isActive = true;
  const isPaid = isAdmin || hasCredits;

  const hasFeature = (feature: keyof TierLimits): boolean => {
    const value = limits[feature];
    return typeof value === "boolean" ? value : (value as number) > 0;
  };

  // These are kept for backward compatibility but now redirect to pricing page
  const startCheckout = useCallback(async () => {
    window.location.href = "/pricing";
  }, []);

  const openCustomerPortal = useCallback(async () => {
    window.location.href = "/pricing";
  }, []);

  return {
    subscription: null as Subscription | null,
    plan,
    status,
    tierConfig,
    limits,
    isActive,
    isPaid,
    isLoading,
    hasFeature,
    creditBalance,
    refetch,
    startCheckout,
    openCustomerPortal,
  };
}
