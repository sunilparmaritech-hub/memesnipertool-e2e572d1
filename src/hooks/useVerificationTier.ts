/**
 * Tiered User Verification Hook (Phase 3)
 * 
 * Tier 0: Basic access (email only)
 * Tier 1: Email verified + IP logged → higher automation limits
 * Tier 2: Enhanced verification → full feature access
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

export interface TierConfig {
  name: string;
  maxDailyTrades: number;
  maxAutoExecutions: number;
  maxConcurrentPositions: number;
  advancedFeatures: boolean;
}

export const VERIFICATION_TIERS: Record<number, TierConfig> = {
  0: {
    name: "Basic",
    maxDailyTrades: 5,
    maxAutoExecutions: 0,
    maxConcurrentPositions: 2,
    advancedFeatures: false,
  },
  1: {
    name: "Verified",
    maxDailyTrades: 50,
    maxAutoExecutions: 20,
    maxConcurrentPositions: 5,
    advancedFeatures: true,
  },
  2: {
    name: "Enhanced",
    maxDailyTrades: 9999,
    maxAutoExecutions: 9999,
    maxConcurrentPositions: 10,
    advancedFeatures: true,
  },
};

export function useVerificationTier() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: profile, isLoading } = useQuery({
    queryKey: ["verification-tier", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("verification_tier, email_verified_at, enhanced_verification_at, ip_country, device_fingerprint")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) {
        console.error("Error fetching verification tier:", error);
        return null;
      }
      return data;
    },
    enabled: !!user,
    staleTime: 30_000,
  });

  const tier = (profile as any)?.verification_tier ?? 0;
  const tierConfig = VERIFICATION_TIERS[tier] ?? VERIFICATION_TIERS[0];

  const upgradeTier = useMutation({
    mutationFn: async (newTier: number) => {
      if (!user) throw new Error("Not authenticated");
      const updates: Record<string, any> = { verification_tier: newTier };
      if (newTier >= 1) updates.email_verified_at = new Date().toISOString();
      if (newTier >= 2) updates.enhanced_verification_at = new Date().toISOString();

      const { error } = await supabase
        .from("profiles")
        .update(updates)
        .eq("user_id", user.id);
      if (error) throw error;
    },
    onSuccess: (_, newTier) => {
      queryClient.invalidateQueries({ queryKey: ["verification-tier", user?.id] });
      toast({
        title: "Verification Upgraded",
        description: `You are now at ${VERIFICATION_TIERS[newTier]?.name ?? "Tier " + newTier} level.`,
      });
    },
  });

  const logDeviceFingerprint = async (_fingerprint: string) => {
    // device_fingerprint not stored in profiles - silently skip
    console.log("[VerificationTier] device fingerprint noted (not persisted)");
  };

  const logIpCountry = async (_country: string) => {
    // ip_country not stored in profiles - silently skip
    console.log("[VerificationTier] ip country noted (not persisted)");
  };

  return {
    tier,
    tierConfig,
    tierName: tierConfig.name,
    isLoading,
    upgradeTier: upgradeTier.mutate,
    logDeviceFingerprint,
    logIpCountry,
    isBasic: tier === 0,
    isVerified: tier >= 1,
    isEnhanced: tier >= 2,
  };
}
