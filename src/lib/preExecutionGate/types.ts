/**
 * Pre-Execution Gate Types
 * Shared types for the gate module.
 */

import type { LpVerificationResult } from '@/lib/lpVerification';
import type { DeployerCheckResult } from '@/lib/deployerReputation';
import type { SellTaxDetectionResult } from '@/lib/sellTaxDetector';
import type { RugProbabilityResult } from '@/lib/rugProbability';
import type { LiquidityMonitorResult } from '@/lib/liquidityMonitor';
import type { ClusterDetectionResult } from '@/lib/buyerClusterDetection';
import type { DepthValidationResult } from '@/lib/quoteDepthValidator';
import type { EntropyResult } from '@/lib/holderEntropy';
import type { VolumeAuthenticityResult, TradeRecord } from '@/lib/volumeAuthenticity';
import type { WalletClusterResult } from '@/lib/walletClusterDetection';
import type { LiquidityAgingResult } from '@/lib/liquidityAging';
import type { CapitalPreservationResult } from '@/lib/capitalPreservation';
import type { DeployerBehaviorResult } from '@/lib/deployerBehavior';
import type { DynamicCapResult } from '@/lib/dynamicRiskCap';
import type { ObservationResult } from '@/lib/observationDelay';

export type { TradeRecord };

export interface PreExecutionGateInput {
  tokenAddress: string;
  tokenSymbol: string;
  tokenName: string;
  liquidity: number;
  poolCreatedAt?: number;
  priceUsd?: number;
  previousPriceUsd?: number;
  lifetimeHighPrice?: number;
  deployerWallet?: string;
  liquidityAdderWallet?: string;
  firstBuyerWallet?: string;
  uniqueBuyerCount?: number;
  buyerWallets?: string[];
  buyerPosition?: number;
  targetBuyerPositions?: number[]; // User's selected target positions (empty = disabled/allow any)
  hasJupiterRoute?: boolean;
  jupiterSlippage?: number;
  hasRemoveLiquidityTx?: boolean;
  hasFreezeAuthority?: boolean;
  source?: string;
  isPumpFun?: boolean;
  lpMintAddress?: string;
  creatorAddress?: string;
  fdvUsd?: number;
  marketCapUsd?: number;
  holderCount?: number;
  topHolders?: { address: string; percentage: number }[];
  fundingSource?: {
    isFreshWallet: boolean;
    isCexFunded: boolean;
    isMixerFunded: boolean;
    fundingAge: number;
    initialFundingAmount: number;
  };
  recentBuyers?: { address: string; amount: number; timestamp: number }[];
  tokenAge?: number;
  executionMode?: 'auto' | 'manual';
  liquidityThresholds?: {
    autoMinUsd: number;
    manualMinUsd: number;
  };
  buyerTimestamps?: { address: string; timestamp: number; fundingWallet?: string }[];
  buyAmountSol?: number;
  maxSlippage?: number;
  holderData?: { address: string; percentage: number }[];
  recentTradeRecords?: TradeRecord[];
  lpCreatorWallet?: string;
  previousLiquidityUsd?: number;
  solPriceUsd?: number;
  lpHolderConcentration?: number;
  lpOwnerIsDeployer?: boolean;
  lpRecentlyMinted?: boolean;
  lpRecentlyTransferred?: boolean;
  liquidityAgeSeconds?: number;
  validationToggles?: Record<string, boolean>;
  /** Subscription-tier feature flags — controls which premium rules run */
  tierFeatures?: {
    advanced_clustering?: boolean;
    capital_preservation?: boolean;
  };
}

export interface GateDecision {
  allowed: boolean;
  riskScore: number;
  state: 'OBSERVED' | 'EXECUTABLE' | 'BLOCKED';
  reasons: string[];
  failedRules: string[];
  passedRules: string[];
  timestamp: number;
  lpVerification?: LpVerificationResult;
  deployerReputation?: DeployerCheckResult;
  sellTaxResult?: SellTaxDetectionResult;
  rugProbability?: RugProbabilityResult;
  liquidityStability?: LiquidityMonitorResult;
  buyerCluster?: ClusterDetectionResult;
  quoteDepth?: DepthValidationResult;
  doubleQuoteDeviation?: number | null;
  holderEntropy?: EntropyResult;
  volumeAuthenticity?: VolumeAuthenticityResult;
  walletCluster?: WalletClusterResult;
  liquidityAging?: LiquidityAgingResult;
  capitalPreservation?: CapitalPreservationResult;
  deployerBehavior?: DeployerBehaviorResult;
  dynamicCap?: DynamicCapResult;
  observationDelay?: ObservationResult;
}

export interface GateRuleResult {
  passed: boolean;
  rule: string;
  reason: string;
  penalty?: number;
  [key: string]: unknown;
}

export interface GateActivityLogEntry {
  tokenSymbol: string;
  tokenAddress: string;
  level: 'info' | 'success' | 'warning' | 'error' | 'skip';
  category: 'scan' | 'evaluate' | 'trade' | 'exit' | 'system';
  message: string;
  details?: string;
}

export interface MultiRpcSimulationResult {
  passed: boolean;
  rule: string;
  reason: string;
  penalty?: number;
  primarySlot?: number;
  secondarySlot?: number;
  slotDifference?: number;
  primarySupply?: number;
  secondarySupply?: number;
  supplyDeviationPercent?: number;
}

export const DEFAULT_LIQUIDITY_THRESHOLDS = {
  autoMinUsd: 10000,
  manualMinUsd: 5000,
};

// Protected symbols
export const PROTECTED_SYMBOLS = [
  'SOL', 'USDC', 'USDT', 'BTC', 'ETH', 'TRX', 'BNB', 'XRP',
  'DOGE', 'SHIB', 'MATIC', 'AVAX', 'DOT', 'LINK', 'UNI',
  'WBTC', 'WETH', 'WSOL'
];

export const OFFICIAL_MINTS: Record<string, string> = {
  'SOL': 'So11111111111111111111111111111111111111112',
  'USDC': 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  'USDT': 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
};
