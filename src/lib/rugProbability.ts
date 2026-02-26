/**
 * Rug Probability Calculator
 * 
 * Multi-factor risk scoring system for detecting potential rug pulls.
 * Analyzes liquidity ratios, holder distribution, deployer history,
 * funding sources, and buyer patterns to produce a 0-100 probability score.
 * 
 * Scoring Weights:
 * - Liquidity/FDV Ratio: 25%
 * - Holder Entropy: 20%
 * - Deployer Reputation: 25%
 * - Wallet Funding Source: 15%
 * - Buyer Distribution Symmetry: 15%
 * 
 * Block Threshold: rugProbability >= 55%
 * Observe Threshold: rugProbability 40-55%
 * Trade Threshold: rugProbability < 40%
 */

import { checkDeployerReputation, type DeployerCheckResult } from './deployerReputation';
import { calculateHolderEntropy as calculateEntropyFromHolders, type HolderData } from './holderEntropy';

// =============================================================================
// TYPES
// =============================================================================

export interface RugProbabilityInput {
  tokenAddress: string;
  
  // Liquidity data
  liquidityUsd?: number;
  fdvUsd?: number;
  marketCapUsd?: number;
  
  // Holder data
  holderCount?: number;
  topHolders?: {
    address: string;
    percentage: number;
  }[];
  
  // Deployer data
  deployerWallet?: string;
  
  // Funding source data (from on-chain analysis)
  fundingSource?: {
    isFreshWallet: boolean;        // Created < 24h ago
    isCexFunded: boolean;          // Funded from known CEX
    isMixerFunded: boolean;        // Funded from tornado/mixer
    fundingAge: number;            // Age in hours
    initialFundingAmount: number;  // SOL amount
  };
  
  // Buyer distribution
  recentBuyers?: {
    address: string;
    amount: number;
    timestamp: number;
  }[];
  
  // Token metadata
  tokenAge?: number; // seconds since creation
  isPumpFun?: boolean;
}

export interface RugFactorBreakdown {
  liquidityFdvRatio: {
    score: number;      // 0-100 (higher = riskier)
    ratio: number;      // Actual ratio
    weight: number;     // 0.25
    contribution: number;
  };
  holderEntropy: {
    score: number;
    entropy: number;    // Shannon entropy value
    weight: number;     // 0.20
    contribution: number;
  };
  deployerReputation: {
    score: number;
    reputationScore: number;  // Deployer's reputation (0-100, inverted for risk)
    isNewDeployer: boolean;
    weight: number;     // 0.25
    contribution: number;
  };
  fundingSource: {
    score: number;
    flags: string[];    // Risk flags
    weight: number;     // 0.15
    contribution: number;
  };
  buyerDistribution: {
    score: number;
    symmetryScore: number;  // How evenly distributed buyers are
    weight: number;     // 0.15
    contribution: number;
  };
}

export interface RugProbabilityResult {
  rugProbability: number;       // 0-100
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  breakdown: RugFactorBreakdown;
  blockTrade: boolean;
  blockReason?: string;
  warnings: string[];
  calculatedAt: string;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const WEIGHTS = {
  LIQUIDITY_FDV: 0.25,
  HOLDER_ENTROPY: 0.20,
  DEPLOYER_REPUTATION: 0.25,
  FUNDING_SOURCE: 0.15,
  BUYER_DISTRIBUTION: 0.15,
} as const;

// Thresholds - Probabilistic scoring policy (upgraded)
const RUG_PROBABILITY_BLOCK_THRESHOLD = 70;   // Hard block if >= 70%
const RUG_PROBABILITY_REDUCE_THRESHOLD = 55;  // Reduced size if 55–69%
const RUG_PROBABILITY_OBSERVE_THRESHOLD = 40; // Observe if 40-54%, Trade if < 40%

const LIQUIDITY_FDV_THRESHOLDS = {
  HEALTHY: 0.1,      // > 10% is healthy
  CONCERNING: 0.03,  // 3-10% is concerning
  DANGEROUS: 0.01,   // < 1% is very dangerous
} as const;

const HOLDER_THRESHOLDS = {
  MIN_HOLDERS: 10,
  HEALTHY_TOP10_PERCENT: 50,  // Top 10 holders < 50% is healthy
  DANGEROUS_TOP10_PERCENT: 80, // Top 10 holders > 80% is dangerous
} as const;

// =============================================================================
// SCORING FUNCTIONS
// =============================================================================

/**
 * Calculate risk score from Liquidity/FDV ratio
 * Low ratio = higher rug risk (easier to drain)
 */
function scoreLiquidityFdvRatio(liquidityUsd?: number, fdvUsd?: number): {
  score: number;
  ratio: number;
} {
  if (!liquidityUsd || !fdvUsd || fdvUsd === 0) {
    return { score: 50, ratio: 0 }; // Unknown = moderate risk
  }
  
  const ratio = liquidityUsd / fdvUsd;
  
  let score: number;
  
  if (ratio >= LIQUIDITY_FDV_THRESHOLDS.HEALTHY) {
    // Healthy ratio: 0-20 risk
    score = Math.max(0, 20 - (ratio - 0.1) * 100);
  } else if (ratio >= LIQUIDITY_FDV_THRESHOLDS.CONCERNING) {
    // Concerning: 20-60 risk
    score = 20 + ((LIQUIDITY_FDV_THRESHOLDS.HEALTHY - ratio) / 
      (LIQUIDITY_FDV_THRESHOLDS.HEALTHY - LIQUIDITY_FDV_THRESHOLDS.CONCERNING)) * 40;
  } else if (ratio >= LIQUIDITY_FDV_THRESHOLDS.DANGEROUS) {
    // Dangerous: 60-85 risk
    score = 60 + ((LIQUIDITY_FDV_THRESHOLDS.CONCERNING - ratio) / 
      (LIQUIDITY_FDV_THRESHOLDS.CONCERNING - LIQUIDITY_FDV_THRESHOLDS.DANGEROUS)) * 25;
  } else {
    // Extremely dangerous: 85-100 risk
    score = 85 + Math.min(15, (LIQUIDITY_FDV_THRESHOLDS.DANGEROUS - ratio) * 1500);
  }
  
  return {
    score: Math.min(100, Math.max(0, score)),
    ratio,
  };
}

/**
 * Score holder entropy using dedicated entropy module
 * Lower entropy = more concentrated = higher risk
 */
function scoreHolderEntropy(topHolders?: { address: string; percentage: number }[]): {
  score: number;
  entropy: number;
} {
  if (!topHolders || topHolders.length === 0) {
    return { score: 50, entropy: 0 }; // Unknown = moderate risk
  }
  
  // Convert to HolderData format for entropy module
  const holderData: HolderData[] = topHolders.map(h => ({
    address: h.address,
    percentage: h.percentage,
  }));
  
  // Use dedicated entropy calculator
  const entropyResult = calculateEntropyFromHolders(holderData);
  
  // Convert entropy score (0-1, higher = better) to risk score (0-100, higher = riskier)
  // Invert: low entropy = high risk
  const riskScore = (1 - entropyResult.entropyScore) * 100;
  
  // Add penalty for extreme concentration
  let finalScore = riskScore;
  if (entropyResult.top10Concentration > HOLDER_THRESHOLDS.DANGEROUS_TOP10_PERCENT) {
    finalScore = Math.max(finalScore, 80);
  }
  
  return {
    score: Math.min(100, Math.max(0, finalScore)),
    entropy: entropyResult.entropyScore,
  };
}

/**
 * Score deployer reputation
 * Uses existing deployer reputation system
 */
async function scoreDeployerReputation(deployerWallet?: string): Promise<{
  score: number;
  reputationScore: number;
  isNewDeployer: boolean;
  deployerResult?: DeployerCheckResult;
}> {
  if (!deployerWallet) {
    return {
      score: 40, // Unknown deployer = moderate-high risk
      reputationScore: 50,
      isNewDeployer: true,
    };
  }
  
  const deployerResult = await checkDeployerReputation(deployerWallet);
  
  // Invert reputation score for risk (high reputation = low risk)
  const riskScore = 100 - deployerResult.reputationScore;
  
  // New deployers get moderate risk
  let score = deployerResult.isNewDeployer ? 40 : riskScore;
  
  // If deployer was blocked, maximum risk
  if (!deployerResult.passed) {
    score = 100;
  }
  
  return {
    score: Math.min(100, Math.max(0, score)),
    reputationScore: deployerResult.reputationScore,
    isNewDeployer: deployerResult.isNewDeployer,
    deployerResult,
  };
}

/**
 * Score wallet funding source
 * Fresh wallets, mixer-funded = higher risk
 */
function scoreFundingSource(fundingSource?: RugProbabilityInput['fundingSource']): {
  score: number;
  flags: string[];
} {
  if (!fundingSource) {
    return { score: 30, flags: ['unknown_funding'] }; // Unknown = moderate risk
  }
  
  let score = 0;
  const flags: string[] = [];
  
  // Mixer funded is extremely suspicious
  if (fundingSource.isMixerFunded) {
    score += 60;
    flags.push('mixer_funded');
  }
  
  // Fresh wallet is suspicious
  if (fundingSource.isFreshWallet) {
    score += 30;
    flags.push('fresh_wallet');
    
    // Even riskier if fresh AND well-funded
    if (fundingSource.initialFundingAmount > 10) {
      score += 10;
      flags.push('large_initial_funding');
    }
  }
  
  // CEX funded is slightly less suspicious (has KYC)
  if (fundingSource.isCexFunded && !fundingSource.isFreshWallet) {
    score -= 10;
    flags.push('cex_funded');
  }
  
  // Very old wallet with history is good
  if (fundingSource.fundingAge > 720) { // > 30 days
    score -= 20;
    flags.push('established_wallet');
  }
  
  return {
    score: Math.min(100, Math.max(0, score)),
    flags,
  };
}

/**
 * Score buyer distribution symmetry
 * Asymmetric buying (few large, many small) can indicate wash trading
 */
function scoreBuyerDistribution(recentBuyers?: RugProbabilityInput['recentBuyers']): {
  score: number;
  symmetryScore: number;
} {
  if (!recentBuyers || recentBuyers.length < 3) {
    return { score: 40, symmetryScore: 0.5 }; // Unknown = moderate risk
  }
  
  const amounts = recentBuyers.map(b => b.amount);
  const totalAmount = amounts.reduce((sum, a) => sum + a, 0);
  
  if (totalAmount === 0) {
    return { score: 40, symmetryScore: 0.5 };
  }
  
  // Calculate coefficient of variation (std dev / mean)
  const mean = totalAmount / amounts.length;
  const variance = amounts.reduce((sum, a) => sum + Math.pow(a - mean, 2), 0) / amounts.length;
  const stdDev = Math.sqrt(variance);
  const cv = mean > 0 ? stdDev / mean : 0;
  
  // Calculate Gini coefficient for inequality
  amounts.sort((a, b) => a - b);
  let giniSum = 0;
  for (let i = 0; i < amounts.length; i++) {
    giniSum += (2 * (i + 1) - amounts.length - 1) * amounts[i];
  }
  const gini = amounts.length > 1 ? giniSum / (amounts.length * totalAmount) : 0;
  
  // Symmetry score: 1 = perfectly symmetric, 0 = completely asymmetric
  const symmetryScore = Math.max(0, 1 - gini);
  
  // Check for single dominant buyer
  const maxBuyerPercent = (Math.max(...amounts) / totalAmount) * 100;
  
  let score: number;
  
  if (symmetryScore > 0.7 && maxBuyerPercent < 30) {
    // Well distributed buying: low risk
    score = 20;
  } else if (symmetryScore > 0.4) {
    // Moderate distribution
    score = 20 + ((0.7 - symmetryScore) / 0.3) * 40;
  } else {
    // Asymmetric: high risk
    score = 60 + ((0.4 - symmetryScore) / 0.4) * 30;
  }
  
  // Extra penalty for dominant buyer
  if (maxBuyerPercent > 50) {
    score += 15;
  }
  
  return {
    score: Math.min(100, Math.max(0, score)),
    symmetryScore,
  };
}

// =============================================================================
// MAIN CALCULATOR
// =============================================================================

/**
 * Calculate comprehensive rug probability score
 */
export async function calculateRugProbability(
  input: RugProbabilityInput
): Promise<RugProbabilityResult> {
  const warnings: string[] = [];
  
  // Calculate individual scores
  const liquidityFdv = scoreLiquidityFdvRatio(input.liquidityUsd, input.fdvUsd);
  const holderEntropy = scoreHolderEntropy(input.topHolders);
  const deployerRep = await scoreDeployerReputation(input.deployerWallet);
  const funding = scoreFundingSource(input.fundingSource);
  const buyerDist = scoreBuyerDistribution(input.recentBuyers);
  
  // Build breakdown
  const breakdown: RugFactorBreakdown = {
    liquidityFdvRatio: {
      score: liquidityFdv.score,
      ratio: liquidityFdv.ratio,
      weight: WEIGHTS.LIQUIDITY_FDV,
      contribution: liquidityFdv.score * WEIGHTS.LIQUIDITY_FDV,
    },
    holderEntropy: {
      score: holderEntropy.score,
      entropy: holderEntropy.entropy,
      weight: WEIGHTS.HOLDER_ENTROPY,
      contribution: holderEntropy.score * WEIGHTS.HOLDER_ENTROPY,
    },
    deployerReputation: {
      score: deployerRep.score,
      reputationScore: deployerRep.reputationScore,
      isNewDeployer: deployerRep.isNewDeployer,
      weight: WEIGHTS.DEPLOYER_REPUTATION,
      contribution: deployerRep.score * WEIGHTS.DEPLOYER_REPUTATION,
    },
    fundingSource: {
      score: funding.score,
      flags: funding.flags,
      weight: WEIGHTS.FUNDING_SOURCE,
      contribution: funding.score * WEIGHTS.FUNDING_SOURCE,
    },
    buyerDistribution: {
      score: buyerDist.score,
      symmetryScore: buyerDist.symmetryScore,
      weight: WEIGHTS.BUYER_DISTRIBUTION,
      contribution: buyerDist.score * WEIGHTS.BUYER_DISTRIBUTION,
    },
  };
  
  // Calculate weighted total
  const rugProbability = Math.round(
    breakdown.liquidityFdvRatio.contribution +
    breakdown.holderEntropy.contribution +
    breakdown.deployerReputation.contribution +
    breakdown.fundingSource.contribution +
    breakdown.buyerDistribution.contribution
  );
  
  // Determine risk level — new probabilistic thresholds:
  // < 40% = SAFE (full trade)
  // 40–54% = OBSERVE (warn, allow with normal size)
  // 55–69% = REDUCED SIZE (allow but penalise position size)
  // >= 70% = HARD BLOCK
  let riskLevel: RugProbabilityResult['riskLevel'];
  if (rugProbability < 40) {
    riskLevel = 'LOW';      // SAFE
  } else if (rugProbability < 55) {
    riskLevel = 'MEDIUM';   // OBSERVE
  } else if (rugProbability < 70) {
    riskLevel = 'HIGH';     // REDUCED SIZE
  } else {
    riskLevel = 'CRITICAL'; // HARD BLOCK
  }
  
  // Generate warnings
  if (liquidityFdv.ratio < 0.03) {
    warnings.push(`Low liquidity/FDV ratio: ${(liquidityFdv.ratio * 100).toFixed(1)}%`);
  }
  if (holderEntropy.entropy < 0.4) {
    warnings.push('Highly concentrated holder distribution');
  }
  if (deployerRep.isNewDeployer) {
    warnings.push('New deployer with no history');
  }
  if (funding.flags.includes('mixer_funded')) {
    warnings.push('Deployer wallet funded via mixer');
  }
  if (funding.flags.includes('fresh_wallet')) {
    warnings.push('Deployer is a fresh wallet');
  }
  if (buyerDist.symmetryScore < 0.3) {
    warnings.push('Asymmetric buyer distribution');
  }
  
  // Determine if trade should be blocked (>= 55%)
  const blockTrade = rugProbability >= RUG_PROBABILITY_BLOCK_THRESHOLD;
  
  let blockReason: string | undefined;
  if (blockTrade) {
    // Find the top contributing factor
    const contributions = [
      { name: 'Liquidity/FDV', value: breakdown.liquidityFdvRatio.contribution },
      { name: 'Holder concentration', value: breakdown.holderEntropy.contribution },
      { name: 'Deployer reputation', value: breakdown.deployerReputation.contribution },
      { name: 'Funding source', value: breakdown.fundingSource.contribution },
      { name: 'Buyer distribution', value: breakdown.buyerDistribution.contribution },
    ].sort((a, b) => b.value - a.value);
    
    blockReason = `Rug probability ${rugProbability}% (main factor: ${contributions[0].name})`;
  }
  
  console.log(`[RugProbability] Token ${input.tokenAddress.slice(0, 8)}... = ${rugProbability}% (${riskLevel})`);
  
  return {
    rugProbability,
    riskLevel,
    breakdown,
    blockTrade,
    blockReason,
    warnings,
    calculatedAt: new Date().toISOString(),
  };
}

/**
 * Quick rug check with minimal data
 * For fast pre-screening before full analysis
 */
export async function quickRugCheck(
  tokenAddress: string,
  liquidityUsd?: number,
  fdvUsd?: number,
  deployerWallet?: string
): Promise<{ 
  probability: number; 
  shouldBlock: boolean;
  riskLevel: string;
}> {
  const result = await calculateRugProbability({
    tokenAddress,
    liquidityUsd,
    fdvUsd,
    deployerWallet,
  });
  
  return {
    probability: result.rugProbability,
    shouldBlock: result.blockTrade,
    riskLevel: result.riskLevel,
  };
}

/**
 * Check if token should be blocked based on rug probability
 * For integration with pre-execution gate
 */
export async function checkRugProbability(
  input: RugProbabilityInput
): Promise<{
  passed: boolean;
  rule: string;
  reason: string;
  probability: number;
  riskLevel: string;
  result: RugProbabilityResult;
}> {
  const result = await calculateRugProbability(input);
  
  return {
    passed: !result.blockTrade,
    rule: 'RUG_PROBABILITY',
    reason: result.blockTrade 
      ? result.blockReason || `Rug probability ${result.rugProbability}% exceeds threshold`
      : `Rug probability ${result.rugProbability}% (${result.riskLevel})`,
    probability: result.rugProbability,
    riskLevel: result.riskLevel,
    result,
  };
}

// =============================================================================
// EXPORTS
// =============================================================================

export {
  RUG_PROBABILITY_BLOCK_THRESHOLD,
  RUG_PROBABILITY_OBSERVE_THRESHOLD,
  WEIGHTS as RUG_PROBABILITY_WEIGHTS,
  LIQUIDITY_FDV_THRESHOLDS,
  HOLDER_THRESHOLDS,
};

// Helper to determine action based on rug probability
export function getRugAction(probability: number): 'TRADE' | 'OBSERVE' | 'BLOCK' {
  if (probability < RUG_PROBABILITY_OBSERVE_THRESHOLD) {
    return 'TRADE';
  } else if (probability < RUG_PROBABILITY_BLOCK_THRESHOLD) {
    return 'OBSERVE';
  }
  return 'BLOCK';
}
