// Subscription tier configuration - single source of truth
export type SubscriptionTier = 'free' | 'pro' | 'elite';
export type SubscriptionStatus = 'active' | 'trialing' | 'past_due' | 'canceled' | 'unpaid' | 'expired';

export interface TierLimits {
  validationsPerDay: number;
  autoTrading: boolean;
  earlyTrustMode: boolean;
  walletIntelligence: boolean;
  advancedClustering: boolean;
  priorityExecution: boolean;
  multiRpc: boolean;
  advancedRiskTuning: boolean;
  capitalPreservation: boolean;
  feedDelay: number; // seconds
  autoExecutionsPerDay: number;
  clusteringCallsPerDay: number;
  rpcSimulationsPerDay: number;
}

export interface TierConfig {
  name: string;
  tier: SubscriptionTier;
  monthlyPrice: number;
  yearlyPrice: number;
  description: string;
  limits: TierLimits;
  features: string[];
  badge?: string;
  popular?: boolean;
}

export const TIER_CONFIGS: Record<SubscriptionTier, TierConfig> = {
  free: {
    name: 'Free',
    tier: 'free',
    monthlyPrice: 0,
    yearlyPrice: 0,
    description: 'Get started with limited discovery',
    badge: '🟢',
    limits: {
      validationsPerDay: 5,
      autoTrading: false,
      earlyTrustMode: false,
      walletIntelligence: false,
      advancedClustering: false,
      priorityExecution: false,
      multiRpc: false,
      advancedRiskTuning: false,
      capitalPreservation: false,
      feedDelay: 30,
      autoExecutionsPerDay: 0,
      clusteringCallsPerDay: 0,
      rpcSimulationsPerDay: 0,
    },
    features: [
      'Limited discovery view',
      '5 token validations/day',
      'Delayed feed (30s)',
      'Community access',
    ],
  },
  pro: {
    name: 'Pro',
    tier: 'pro',
    monthlyPrice: 49,
    yearlyPrice: 490, // ~2 months free
    description: 'Real-time trading with automation',
    badge: '🔵',
    popular: true,
    limits: {
      validationsPerDay: 200,
      autoTrading: true,
      earlyTrustMode: true,
      walletIntelligence: true,
      advancedClustering: false,
      priorityExecution: false,
      multiRpc: false,
      advancedRiskTuning: false,
      capitalPreservation: false,
      feedDelay: 0,
      autoExecutionsPerDay: 50,
      clusteringCallsPerDay: 20,
      rpcSimulationsPerDay: 10,
    },
    features: [
      'Real-time discovery',
      'Auto trading enabled',
      '200 validations/day',
      'Early Trust Mode',
      'Basic wallet intelligence',
      'Email support',
    ],
  },
  elite: {
    name: 'Elite',
    tier: 'elite',
    monthlyPrice: 149,
    yearlyPrice: 1490, // ~2 months free
    description: 'Maximum edge with all features',
    badge: '🟣',
    limits: {
      validationsPerDay: -1, // unlimited
      autoTrading: true,
      earlyTrustMode: true,
      walletIntelligence: true,
      advancedClustering: true,
      priorityExecution: true,
      multiRpc: true,
      advancedRiskTuning: true,
      capitalPreservation: true,
      feedDelay: 0,
      autoExecutionsPerDay: -1, // unlimited
      clusteringCallsPerDay: -1,
      rpcSimulationsPerDay: -1,
    },
    features: [
      'Unlimited validations',
      'Advanced wallet clustering',
      'Priority execution queue',
      'Multi-RPC redundancy',
      'Advanced risk tuning',
      'Capital preservation mode',
      'Premium support',
    ],
  },
};

export function getTierLimits(tier: SubscriptionTier): TierLimits {
  return TIER_CONFIGS[tier].limits;
}

export function isFeatureAllowed(tier: SubscriptionTier, feature: keyof TierLimits): boolean {
  const limits = getTierLimits(tier);
  const value = limits[feature];
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  return false;
}

export function isWithinLimit(tier: SubscriptionTier, field: keyof TierLimits, currentUsage: number): boolean {
  const limit = getTierLimits(tier)[field];
  if (typeof limit !== 'number') return true;
  if (limit === -1) return true; // unlimited
  return currentUsage < limit;
}

export function getUsagePercent(tier: SubscriptionTier, field: keyof TierLimits, currentUsage: number): number {
  const limit = getTierLimits(tier)[field];
  if (typeof limit !== 'number' || limit <= 0) return 0;
  return Math.min(100, (currentUsage / limit) * 100);
}
