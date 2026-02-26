/**
 * Dynamic Risk Cap Module (v2 — Graduated Scaling)
 * 
 * Instead of a binary cap at 60, applies graduated caps based on
 * the number of risk flags detected:
 * 
 *   1 flag  → cap at 75  (Manual OK, Auto OK if other scores high)
 *   2 flags → cap at 65  (Auto borderline, Manual OK)
 *   3+ flags → cap at 55 (Manual only)
 * 
 * This prevents a single minor behavioral flag from blocking
 * otherwise high-quality tokens from auto-execution.
 * 
 * Cap Conditions (each counts as one flag):
 * - LP concentration > 80%
 * - Buyer cluster detected (hard block variant only)
 * - Holder entropy low (< 0.25 — lowered from 0.35)
 * - Liquidity age < 30s (lowered from 60s — new tokens need faster entry)
 * - Volume wash trading detected
 * - Wallet funding cluster detected (hard block variant only)
 */

// =============================================================================
// TYPES
// =============================================================================

export interface DynamicCapInput {
  lpConcentration?: number;           // % of LP held by single wallet
  buyerClusterDetected: boolean;      // Only hard-block clusters, not minor overlaps
  holderEntropyScore?: number;        // 0-1 (from holderEntropy module)
  liquidityAgeSeconds?: number;
  volumeWashDetected: boolean;
  walletClusterDetected: boolean;     // Only hard-block clusters
}

export interface DynamicCapResult {
  capped: boolean;
  maxScore: number;
  originalScore: number;
  finalScore: number;
  capReasons: string[];
  flagCount: number;
}

// =============================================================================
// CONSTANTS (v2 — Graduated)
// =============================================================================

const GRADUATED_CAPS: Record<number, number> = {
  1: 75,  // Single flag: mild cap
  2: 65,  // Two flags: auto-mode borderline
  3: 55,  // Three+ flags: manual only
};

const LP_CONCENTRATION_CAP = 80;       // >80% triggers flag
const ENTROPY_CAP_THRESHOLD = 0.25;    // <0.25 triggers flag (lowered from 0.35)
const LIQUIDITY_AGE_CAP_SECONDS = 30;  // <30s triggers flag (lowered from 60s)

// =============================================================================
// MAIN FUNCTION
// =============================================================================

/**
 * Apply graduated dynamic risk score cap
 * 
 * @param currentScore - Current risk score (0-100)
 * @param input - Risk indicator inputs
 * @returns Capped result with final score and flag count
 */
export function applyDynamicRiskCap(
  currentScore: number,
  input: DynamicCapInput
): DynamicCapResult {
  const capReasons: string[] = [];
  
  // Check each cap condition
  if (input.lpConcentration !== undefined && input.lpConcentration > LP_CONCENTRATION_CAP) {
    capReasons.push(`LP concentration ${input.lpConcentration.toFixed(0)}% > ${LP_CONCENTRATION_CAP}%`);
  }
  
  // Only count hard-block buyer clusters, not minor overlaps
  if (input.buyerClusterDetected) {
    capReasons.push('Buyer cluster detected (hard block)');
  }
  
  if (input.holderEntropyScore !== undefined && input.holderEntropyScore < ENTROPY_CAP_THRESHOLD) {
    capReasons.push(`Holder entropy ${(input.holderEntropyScore * 100).toFixed(0)}% < ${ENTROPY_CAP_THRESHOLD * 100}%`);
  }
  
  if (input.liquidityAgeSeconds !== undefined && input.liquidityAgeSeconds < LIQUIDITY_AGE_CAP_SECONDS) {
    capReasons.push(`Liquidity age ${input.liquidityAgeSeconds.toFixed(0)}s < ${LIQUIDITY_AGE_CAP_SECONDS}s`);
  }
  
  if (input.volumeWashDetected) {
    capReasons.push('Volume wash trading detected');
  }
  
  // Only count hard-block wallet clusters
  if (input.walletClusterDetected) {
    capReasons.push('Wallet funding cluster detected (hard block)');
  }
  
  const flagCount = capReasons.length;
  const capped = flagCount > 0;
  
  // Graduated cap: more flags = lower cap
  let maxScore = 100;
  if (capped) {
    const cappedLevel = Math.min(flagCount, 3); // 3+ all use the same cap
    maxScore = GRADUATED_CAPS[cappedLevel] ?? 55;
  }
  
  const finalScore = capped ? Math.min(currentScore, maxScore) : currentScore;
  
  if (capped) {
    console.log(`[DynamicCap] Score capped: ${currentScore} → ${finalScore} (${flagCount} flag${flagCount > 1 ? 's' : ''}: ${capReasons.join(', ')})`);
  }
  
  return {
    capped,
    maxScore,
    originalScore: currentScore,
    finalScore,
    capReasons,
    flagCount,
  };
}
