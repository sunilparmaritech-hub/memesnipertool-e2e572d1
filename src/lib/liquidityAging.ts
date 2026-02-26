/**
 * Liquidity Aging Window Module (Rule 20)
 * 
 * For AUTO mode:
 * - Require liquidity age ≥ 120 seconds
 * - AND liquidity drop ≤ 10% during 10-second observation window
 * 
 * For MANUAL mode:
 * - Liquidity age ≥ 60 seconds minimum
 */

// =============================================================================
// TYPES
// =============================================================================

export interface LiquidityAgingInput {
  tokenAddress: string;
  poolCreatedAt?: number;      // Unix ms
  currentLiquidity: number;    // USD
  previousLiquidity?: number;  // USD (10s ago)
  executionMode: 'auto' | 'manual';
  isPumpFun?: boolean;
  source?: string;
}

export interface LiquidityAgingResult {
  passed: boolean;
  rule: string;
  reason: string;
  penalty: number;
  hardBlock: boolean;
  details: {
    liquidityAgeSeconds: number;
    requiredAgeSeconds: number;
    liquidityDropPercent: number;
    maxAllowedDropPercent: number;
    observationWindowPassed: boolean;
  };
}

// =============================================================================
// CONSTANTS
// =============================================================================

const AUTO_MIN_AGE_SECONDS = 120;
const MANUAL_MIN_AGE_SECONDS = 60;
const MAX_LIQUIDITY_DROP_PERCENT = 10; // During 10s observation
const PENALTY_HARD_BLOCK = 50;
const PENALTY_SOFT = 20;

// =============================================================================
// MAIN FUNCTION
// =============================================================================

/**
 * Check liquidity aging requirements
 */
export function checkLiquidityAging(input: LiquidityAgingInput): LiquidityAgingResult {
  const rule = 'LIQUIDITY_AGING';
  
  // Pump.fun has bonding curve — different mechanics
  if (input.isPumpFun || input.source === 'Pump.fun' || input.source === 'pumpfun' || input.source === 'PumpSwap') {
    return {
      passed: true,
      rule,
      reason: 'Pump.fun bonding curve - liquidity aging exempt',
      penalty: 0,
      hardBlock: false,
      details: {
        liquidityAgeSeconds: 0,
        requiredAgeSeconds: 0,
        liquidityDropPercent: 0,
        maxAllowedDropPercent: MAX_LIQUIDITY_DROP_PERCENT,
        observationWindowPassed: true,
      },
    };
  }
  
  // If pool creation time is unknown, allow with warning (data unavailable)
  if (!input.poolCreatedAt) {
    return {
      passed: true,
      rule,
      reason: 'Pool creation time unavailable — skipping age check',
      penalty: 0,
      hardBlock: false,
      details: {
        liquidityAgeSeconds: -1,
        requiredAgeSeconds: input.executionMode === 'auto' ? AUTO_MIN_AGE_SECONDS : MANUAL_MIN_AGE_SECONDS,
        liquidityDropPercent: 0,
        maxAllowedDropPercent: MAX_LIQUIDITY_DROP_PERCENT,
        observationWindowPassed: true,
      },
    };
  }

  // Calculate liquidity age
  const now = Date.now();
  const poolCreatedAt = input.poolCreatedAt;
  const ageSeconds = (now - poolCreatedAt) / 1000;
  
  const requiredAge = input.executionMode === 'auto' 
    ? AUTO_MIN_AGE_SECONDS 
    : MANUAL_MIN_AGE_SECONDS;
  
  // Check age requirement
  if (ageSeconds < requiredAge) {
    return {
      passed: false,
      rule,
      reason: `Liquidity age ${ageSeconds.toFixed(0)}s < required ${requiredAge}s (${input.executionMode.toUpperCase()} mode)`,
      penalty: PENALTY_HARD_BLOCK,
      hardBlock: input.executionMode === 'auto',
      details: {
        liquidityAgeSeconds: ageSeconds,
        requiredAgeSeconds: requiredAge,
        liquidityDropPercent: 0,
        maxAllowedDropPercent: MAX_LIQUIDITY_DROP_PERCENT,
        observationWindowPassed: false,
      },
    };
  }
  
  // Check liquidity stability during observation window
  let liquidityDropPercent = 0;
  let observationWindowPassed = true;
  
  if (input.previousLiquidity && input.previousLiquidity > 0) {
    liquidityDropPercent = ((input.previousLiquidity - input.currentLiquidity) / input.previousLiquidity) * 100;
    
    if (liquidityDropPercent > MAX_LIQUIDITY_DROP_PERCENT) {
      observationWindowPassed = false;
      
      return {
        passed: false,
        rule,
        reason: `Liquidity dropped ${liquidityDropPercent.toFixed(1)}% during observation (>${MAX_LIQUIDITY_DROP_PERCENT}% blocked)`,
        penalty: PENALTY_SOFT,
        hardBlock: false,
        details: {
          liquidityAgeSeconds: ageSeconds,
          requiredAgeSeconds: requiredAge,
          liquidityDropPercent,
          maxAllowedDropPercent: MAX_LIQUIDITY_DROP_PERCENT,
          observationWindowPassed: false,
        },
      };
    }
  }
  
  return {
    passed: true,
    rule,
    reason: `Liquidity age ${ageSeconds.toFixed(0)}s ≥ ${requiredAge}s, stable (${liquidityDropPercent.toFixed(1)}% drop)`,
    penalty: 0,
    hardBlock: false,
    details: {
      liquidityAgeSeconds: ageSeconds,
      requiredAgeSeconds: requiredAge,
      liquidityDropPercent,
      maxAllowedDropPercent: MAX_LIQUIDITY_DROP_PERCENT,
      observationWindowPassed,
    },
  };
}
