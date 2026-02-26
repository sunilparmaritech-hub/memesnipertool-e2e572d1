/**
 * Holder Entropy Module
 * 
 * Calculates Shannon entropy for token holder distributions.
 * Low entropy indicates centralized control (few wallets hold most supply).
 * 
 * Shannon Entropy Formula:
 * H(X) = -Σ p(x) * log2(p(x))
 * 
 * Where p(x) is the probability (percentage) of each holder.
 * 
 * Normalized entropy ranges 0-1:
 * - 0 = Single holder (maximum centralization)
 * - 1 = Perfectly even distribution
 * 
 * Block Threshold: entropy < 0.35 (highly centralized)
 */

// =============================================================================
// TYPES
// =============================================================================

export interface HolderData {
  address: string;
  percentage: number;  // 0-100 percentage of total supply
  balance?: number;    // Optional raw balance
}

export interface EntropyResult {
  entropyScore: number;        // Normalized 0-1 (higher = more distributed)
  rawEntropy: number;          // Raw Shannon entropy value
  maxPossibleEntropy: number;  // Maximum entropy for N holders
  centralized: boolean;        // True if below threshold
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  blockTrade: boolean;         // True if should block execution
  holderCount: number;         // Number of holders analyzed
  top10Concentration: number;  // Percentage held by top 10
  largestHolder: number;       // Largest single holder percentage
  details: EntropyDetails;
}

export interface EntropyDetails {
  effectiveHolders: number;    // Holders with meaningful stake (> 0.1%)
  giniCoefficient: number;     // 0 = equal, 1 = one holder has all
  herfindahlIndex: number;     // Market concentration index
  distributionType: 'UNIFORM' | 'NORMAL' | 'POWER_LAW' | 'CONCENTRATED';
}

// =============================================================================
// CONSTANTS
// =============================================================================

// Entropy thresholds (normalized 0-1)
export const ENTROPY_THRESHOLDS = {
  BLOCK: 0.35,         // < 0.35 = BLOCK trade (highly centralized)
  HIGH_RISK: 0.45,     // < 0.45 = HIGH risk
  MEDIUM_RISK: 0.55,   // < 0.55 = MEDIUM risk
  LOW_RISK: 0.70,      // >= 0.70 = LOW risk (well distributed)
} as const;

// Concentration thresholds
export const CONCENTRATION_THRESHOLDS = {
  TOP10_BLOCK: 85,         // Top 10 holders > 85% = BLOCK
  SINGLE_HOLDER_BLOCK: 50, // Single holder > 50% = BLOCK
  TOP10_WARNING: 70,       // Top 10 holders > 70% = WARNING
} as const;

// Minimum holders for reliable analysis
const MIN_HOLDERS_FOR_ANALYSIS = 3;

// =============================================================================
// CORE ENTROPY CALCULATION
// =============================================================================

/**
 * Calculate raw Shannon entropy
 * H(X) = -Σ p(x) * log2(p(x))
 */
function calculateShannonEntropy(percentages: number[]): number {
  if (percentages.length === 0) return 0;
  
  // Filter out zero values and normalize to probabilities (0-1)
  const probabilities = percentages
    .filter(p => p > 0)
    .map(p => p / 100);
  
  if (probabilities.length === 0) return 0;
  
  // Ensure probabilities sum to 1 (normalize if needed)
  const total = probabilities.reduce((sum, p) => sum + p, 0);
  const normalized = total > 0 
    ? probabilities.map(p => p / total)
    : probabilities;
  
  // Calculate entropy
  let entropy = 0;
  for (const p of normalized) {
    if (p > 0) {
      entropy -= p * Math.log2(p);
    }
  }
  
  return entropy;
}

/**
 * Calculate maximum possible entropy for N holders
 * Max entropy = log2(N) when all holders have equal share
 */
function calculateMaxEntropy(holderCount: number): number {
  if (holderCount <= 1) return 0;
  return Math.log2(holderCount);
}

/**
 * Calculate Gini coefficient for inequality measure
 * 0 = perfect equality, 1 = perfect inequality
 */
function calculateGiniCoefficient(percentages: number[]): number {
  if (percentages.length <= 1) return 0;
  
  const sorted = [...percentages].sort((a, b) => a - b);
  const n = sorted.length;
  const total = sorted.reduce((sum, v) => sum + v, 0);
  
  if (total === 0) return 0;
  
  let giniSum = 0;
  for (let i = 0; i < n; i++) {
    giniSum += (2 * (i + 1) - n - 1) * sorted[i];
  }
  
  return giniSum / (n * total);
}

/**
 * Calculate Herfindahl-Hirschman Index (HHI)
 * Market concentration measure: sum of squared market shares
 * Range: 1/N (perfect competition) to 1 (monopoly)
 */
function calculateHerfindahlIndex(percentages: number[]): number {
  if (percentages.length === 0) return 1;
  
  const total = percentages.reduce((sum, p) => sum + p, 0);
  if (total === 0) return 1;
  
  // Normalize and calculate sum of squared shares
  let hhi = 0;
  for (const p of percentages) {
    const share = p / total;
    hhi += share * share;
  }
  
  return hhi;
}

/**
 * Determine distribution type based on entropy and concentration
 */
function classifyDistribution(
  normalizedEntropy: number,
  gini: number,
  top10Percent: number
): EntropyDetails['distributionType'] {
  // Uniform: high entropy, low gini
  if (normalizedEntropy > 0.8 && gini < 0.3) {
    return 'UNIFORM';
  }
  
  // Concentrated: low entropy or very high top 10
  if (normalizedEntropy < 0.4 || top10Percent > 80) {
    return 'CONCENTRATED';
  }
  
  // Power law: moderate entropy with high gini (few big, many small)
  if (gini > 0.6 && normalizedEntropy > 0.4) {
    return 'POWER_LAW';
  }
  
  // Normal: moderate distribution
  return 'NORMAL';
}

// =============================================================================
// MAIN FUNCTIONS
// =============================================================================

/**
 * Calculate holder entropy and centralization risk
 * 
 * @param holders - Array of holder data with addresses and percentages
 * @returns EntropyResult with scores, risk level, and block decision
 */
export function calculateHolderEntropy(holders: HolderData[]): EntropyResult {
  // Handle empty or minimal holder data
  if (!holders || holders.length === 0) {
    return createDefaultResult(0, 'Unknown holder distribution');
  }
  
  // Extract percentages
  const percentages = holders.map(h => h.percentage).filter(p => p > 0);
  
  if (percentages.length < MIN_HOLDERS_FOR_ANALYSIS) {
    return createDefaultResult(
      percentages.length,
      `Only ${percentages.length} holders detected`
    );
  }
  
  // Calculate raw entropy
  const rawEntropy = calculateShannonEntropy(percentages);
  const maxEntropy = calculateMaxEntropy(percentages.length);
  
  // Normalize entropy to 0-1 range
  const entropyScore = maxEntropy > 0 ? rawEntropy / maxEntropy : 0;
  
  // Calculate concentration metrics
  const sortedPercentages = [...percentages].sort((a, b) => b - a);
  const top10Concentration = sortedPercentages.slice(0, 10).reduce((sum, p) => sum + p, 0);
  const largestHolder = sortedPercentages[0] || 0;
  
  // Calculate additional metrics
  const giniCoefficient = calculateGiniCoefficient(percentages);
  const herfindahlIndex = calculateHerfindahlIndex(percentages);
  const effectiveHolders = percentages.filter(p => p >= 0.1).length;
  
  // Determine distribution type
  const distributionType = classifyDistribution(entropyScore, giniCoefficient, top10Concentration);
  
  // Determine risk level and block decision
  let riskLevel: EntropyResult['riskLevel'];
  let blockTrade = false;
  let centralized = false;
  
  // Check hard block conditions
  if (largestHolder > CONCENTRATION_THRESHOLDS.SINGLE_HOLDER_BLOCK) {
    riskLevel = 'CRITICAL';
    blockTrade = true;
    centralized = true;
  } else if (top10Concentration > CONCENTRATION_THRESHOLDS.TOP10_BLOCK) {
    riskLevel = 'CRITICAL';
    blockTrade = true;
    centralized = true;
  } else if (entropyScore < ENTROPY_THRESHOLDS.BLOCK) {
    riskLevel = 'CRITICAL';
    blockTrade = true;
    centralized = true;
  } else if (entropyScore < ENTROPY_THRESHOLDS.HIGH_RISK) {
    riskLevel = 'HIGH';
    centralized = true;
  } else if (entropyScore < ENTROPY_THRESHOLDS.MEDIUM_RISK) {
    riskLevel = 'MEDIUM';
    centralized = false;
  } else {
    riskLevel = 'LOW';
    centralized = false;
  }
  
  const result: EntropyResult = {
    entropyScore,
    rawEntropy,
    maxPossibleEntropy: maxEntropy,
    centralized,
    riskLevel,
    blockTrade,
    holderCount: percentages.length,
    top10Concentration,
    largestHolder,
    details: {
      effectiveHolders,
      giniCoefficient,
      herfindahlIndex,
      distributionType,
    },
  };
  
  console.log(`[HolderEntropy] Score: ${(entropyScore * 100).toFixed(1)}% | ` +
    `Top10: ${top10Concentration.toFixed(1)}% | ` +
    `Risk: ${riskLevel} | ` +
    `Block: ${blockTrade}`);
  
  return result;
}

/**
 * Quick entropy check for pre-execution gate integration
 */
export function checkHolderEntropy(holders: HolderData[]): {
  passed: boolean;
  rule: string;
  reason: string;
  penalty?: number;
  result: EntropyResult;
} {
  const result = calculateHolderEntropy(holders);
  const rule = 'HOLDER_ENTROPY';
  
  if (result.blockTrade) {
    let reason = `Holder entropy ${(result.entropyScore * 100).toFixed(0)}% below ${ENTROPY_THRESHOLDS.BLOCK * 100}% threshold`;
    
    if (result.largestHolder > CONCENTRATION_THRESHOLDS.SINGLE_HOLDER_BLOCK) {
      reason = `Single holder owns ${result.largestHolder.toFixed(1)}% (>${CONCENTRATION_THRESHOLDS.SINGLE_HOLDER_BLOCK}% blocked)`;
    } else if (result.top10Concentration > CONCENTRATION_THRESHOLDS.TOP10_BLOCK) {
      reason = `Top 10 holders own ${result.top10Concentration.toFixed(1)}% (>${CONCENTRATION_THRESHOLDS.TOP10_BLOCK}% blocked)`;
    }
    
    return {
      passed: false,
      rule,
      reason,
      penalty: 40,
      result,
    };
  }
  
  // Passed but may have warnings
  let reason = `Holder entropy ${(result.entropyScore * 100).toFixed(0)}% (${result.riskLevel})`;
  let penalty = 0;
  
  if (result.riskLevel === 'HIGH') {
    penalty = 20;
    reason += ' - elevated concentration risk';
  } else if (result.riskLevel === 'MEDIUM') {
    penalty = 10;
    reason += ' - moderate concentration';
  }
  
  return {
    passed: true,
    rule,
    reason,
    penalty,
    result,
  };
}

/**
 * Calculate entropy from raw holder counts/balances
 * Converts balances to percentages first
 */
export function calculateEntropyFromBalances(
  holders: { address: string; balance: number }[]
): EntropyResult {
  const totalBalance = holders.reduce((sum, h) => sum + h.balance, 0);
  
  if (totalBalance === 0) {
    return createDefaultResult(0, 'Zero total balance');
  }
  
  const holdersWithPercentages: HolderData[] = holders.map(h => ({
    address: h.address,
    balance: h.balance,
    percentage: (h.balance / totalBalance) * 100,
  }));
  
  return calculateHolderEntropy(holdersWithPercentages);
}

/**
 * Create default result for edge cases
 */
function createDefaultResult(holderCount: number, _reason?: string): EntropyResult {
  const isCritical = holderCount < MIN_HOLDERS_FOR_ANALYSIS;
  
  return {
    entropyScore: isCritical ? 0 : 0.5,
    rawEntropy: 0,
    maxPossibleEntropy: 0,
    centralized: isCritical,
    riskLevel: isCritical ? 'HIGH' : 'MEDIUM',
    blockTrade: false, // Don't block on missing data, just warn
    holderCount,
    top10Concentration: 100,
    largestHolder: 100,
    details: {
      effectiveHolders: holderCount,
      giniCoefficient: 1,
      herfindahlIndex: 1,
      distributionType: 'CONCENTRATED',
    },
  };
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Format entropy result for display
 */
export function formatEntropyScore(result: EntropyResult): string {
  const percentScore = (result.entropyScore * 100).toFixed(0);
  const riskEmoji = {
    'LOW': '🟢',
    'MEDIUM': '🟡',
    'HIGH': '🟠',
    'CRITICAL': '🔴',
  }[result.riskLevel];
  
  return `${riskEmoji} ${percentScore}% (${result.riskLevel})`;
}

/**
 * Get risk color for UI display
 */
export function getEntropyRiskColor(riskLevel: EntropyResult['riskLevel']): string {
  switch (riskLevel) {
    case 'LOW': return 'text-success';
    case 'MEDIUM': return 'text-warning';
    case 'HIGH': return 'text-warning';
    case 'CRITICAL': return 'text-destructive';
    default: return 'text-muted-foreground';
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

export {
  calculateShannonEntropy,
  calculateGiniCoefficient,
  calculateHerfindahlIndex,
};
