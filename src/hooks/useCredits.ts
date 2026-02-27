import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useCallback } from "react";

export interface CreditPack {
  id: string;
  name: string;
  sol_price: number;
  credits: number;
  credits_amount?: number; // alias for credits for backward compat
  bonus_credits: number;
  is_active: boolean;
  sort_order: number;
  description?: string | null;
  badge?: string | null;
}

export interface CreditTransaction {
  id: string;
  user_id: string;
  tx_hash: string | null;
  sender_wallet: string | null;
  amount_sol: number;
  credits_added: number;
  status: string;
  memo: string | null;
  created_at: string;
  confirmed_at: string | null;
  pack_id?: string | null;
  usd_value_at_payment?: number | null;
}

export interface UserCredits {
  credit_balance: number;
  total_credits_purchased: number;
  total_credits_used: number;
}

// Default credit costs per action type (overridden by admin settings)
const DEFAULT_CREDIT_COSTS: Record<string, number> = {
  token_validation: 1,
  auto_execution: 5,
  clustering_call: 2,
  api_check: 1,
  manual_trade: 3,
};

export function useCredits() {
  const { user, isAdmin } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch admin-configured credit cost definitions via RPC (bypasses RLS)
  const { data: adminCreditCosts } = useQuery({
    queryKey: ["credit-cost-definitions"],
    queryFn: async () => {
      const { data } = await supabase.rpc("get_credit_costs");
      if (data && typeof data === "object" && !Array.isArray(data)) {
        return data as Record<string, number>;
      }
      return null;
    },
    staleTime: 60_000,
  });

  // Merged credit costs: admin overrides > defaults
  const CREDIT_COSTS: Record<string, number> = {
    ...DEFAULT_CREDIT_COSTS,
    ...(adminCreditCosts || {}),
  };

  // Fetch user credit balance from user_credits table
  const { data: credits, isLoading: creditsLoading } = useQuery({
    queryKey: ["user-credits", user?.id],
    queryFn: async (): Promise<UserCredits> => {
      if (!user) return { credit_balance: 0, total_credits_purchased: 0, total_credits_used: 0 };
      const { data, error } = await supabase
        .from("user_credits")
        .select("credit_balance, total_credits_purchased, total_credits_used")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) {
        console.error("Error fetching credits:", error);
        return { credit_balance: 0, total_credits_purchased: 0, total_credits_used: 0 };
      }
      return {
        credit_balance: data?.credit_balance ?? 0,
        total_credits_purchased: data?.total_credits_purchased ?? 0,
        total_credits_used: data?.total_credits_used ?? 0,
      };
    },
    enabled: !!user,
    staleTime: 10_000,
    refetchInterval: 15_000,
  });

  // Fetch available credit packs
  const { data: packs = [], isLoading: packsLoading } = useQuery({
    queryKey: ["credit-packs"],
    queryFn: async (): Promise<CreditPack[]> => {
      const { data, error } = await supabase
        .from("credit_packs")
        .select("*")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });

      if (error) {
        console.error("Error fetching packs:", error);
        return [];
      }
      return (data || []) as CreditPack[];
    },
    staleTime: 60_000,
  });

  // Fetch transaction history
  const { data: transactions = [], isLoading: txLoading } = useQuery({
    queryKey: ["credit-transactions", user?.id],
    queryFn: async (): Promise<CreditTransaction[]> => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("credit_transactions")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) {
        console.error("Error fetching transactions:", error);
        return [];
      }
      return (data || []) as CreditTransaction[];
    },
    enabled: !!user,
    staleTime: 15_000,
  });

  // Deduct credits (admins are exempt)
  const deductCredits = useMutation({
    mutationFn: async ({ actionType, amount, referenceId }: { actionType: string; amount?: number; referenceId?: string }) => {
      if (!user) throw new Error("Not authenticated");
      
      // Admin bypass - no credit deduction
      if (isAdmin) return;

      const cost = amount ?? CREDIT_COSTS[actionType] ?? 1;
      const currentBalance = credits?.credit_balance ?? 0;

      if (currentBalance < cost) {
        throw new Error("Insufficient credits");
      }

      // Update balance
      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          credit_balance: currentBalance - cost,
          total_credits_used: (credits?.total_credits_used ?? 0) + cost,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id);

      if (updateError) throw updateError;

      // Log usage
      await supabase.from("credit_usage_log").insert({
        user_id: user.id,
        action_type: actionType,
        credits_used: cost,
        reference_id: referenceId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-credits", user?.id] });
    },
    onError: (err: Error) => {
      if (err.message === "Insufficient credits") {
        toast({
          title: "Insufficient Credits",
          description: "You don't have enough credits. Please purchase more to continue.",
          variant: "destructive",
        });
      }
    },
  });

  const canAfford = useCallback(
    (actionType: string, amount?: number): boolean => {
      // Admin always can afford
      if (isAdmin) return true;
      const cost = amount ?? CREDIT_COSTS[actionType] ?? 1;
      return (credits?.credit_balance ?? 0) >= cost;
    },
    [credits, isAdmin, CREDIT_COSTS]
  );

  const hasCredits = isAdmin || (credits?.credit_balance ?? 0) > 0;
  const balance = credits?.credit_balance ?? 0;

  return {
    balance,
    credits,
    packs,
    transactions,
    creditsLoading,
    packsLoading,
    txLoading,
    canAfford,
    hasCredits,
    isAdmin,
    deductCredits: deductCredits.mutate,
    deductCreditsAsync: deductCredits.mutateAsync,
    refetchCredits: () => queryClient.invalidateQueries({ queryKey: ["user-credits", user?.id] }),
    CREDIT_COSTS,
  };
}

// Re-export for backward compatibility
export { DEFAULT_CREDIT_COSTS as CREDIT_COSTS };
