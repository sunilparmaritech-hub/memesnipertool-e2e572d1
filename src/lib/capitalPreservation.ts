/**
 * Capital Preservation Simulation Module (Rule 21)
 * 
 * Simulates worst-case liquidity scenarios:
 * - If liquidity drops 50% instantly
 * - Calculate expected slippage impact
 * - If projected loss > 40% → BLOCK
 * 
 * Protects capital by modelling catastrophic liquidity events
 * before entering a position.
 */

// =============================================================================
// TYPES
// =============================================================================

export interface CapitalPreservationInput {
  tokenAddress: string;
  buyAmountSol: number;
  currentLiquidityUsd: number;
  solPriceUsd: number;
  currentPriceImpact?: number; // From depth validation
  isPumpFun?: boolean;
  source?: string;
}

export interface CapitalPreservationResult {
  passed: boolean;
  rule: string;
  reason: string;
  penalty: number;
  hardBlock: boolean;
  details: {
    projectedLossPercent: number;
    maxAllowedLossPercent: number;
    simulatedLiquidityUsd: number;
    buyAmountUsd: number;
    liquidityBuyRatio: number;
    currentPriceImpact: number;
    stressedPriceImpact: number;
  };
}

// =============================================================================
// CONSTANTS
// =============================================================================

const LIQUIDITY_STRESS_FACTOR = 0.50;  // Simulate 50% instant liquidity drop
const MAX_PROJECTED_LOSS_PERCENT = 40; // Block if projected loss > 40%
const PENALTY_BLOCK = 40;
const PENALTY_WARN = 15;

// =============================================================================
// SIMULATION
// =============================================================================

/**
 * Estimate price impact under stressed liquidity conditions
 * 
 * Uses constant product AMM model: x * y = k
 * When liquidity halves, price impact roughly doubles
 */
function estimateStressedPriceImpact(
  buyAmountUsd: number,
  currentLiquidityUsd: number,
  currentPriceImpact: number
): number {
  if (currentLiquidityUsd <= 0) return 100;
  
  // Stressed liquidity = current * (1 - stress factor)
  const stressedLiquidity = currentLiquidityUsd * (1 - LIQUIDITY_STRESS_FACTOR);
  
  if (stressedLiquidity <= 0) return 100;
  
  // In constant product AMM: price_impact ≈ trade_size / (2 * liquidity)
  // Under stress: impact scales inversely with liquidity
  const currentRatio = buyAmountUsd / currentLiquidityUsd;
  const stressedRatio = buyAmountUsd / stressedLiquidity;
  
  // If we have actual price impact, scale it proportionally
  if (currentPriceImpact > 0) {
    const scaleFactor = stressedRatio / currentRatio;
    return Math.min(100, currentPriceImpact * scaleFactor);
  }
  
  // Estimate: simple constant product model
  // Impact ≈ trade_size / (2 * pool_size) * 100
  const estimatedImpact = (buyAmountUsd / (2 * stressedLiquidity)) * 100;
  return Math.min(100, estimatedImpact);
}

/**
 * Calculate projected total loss under stress scenario
 * 
 * Loss = entry slippage + exit slippage (both impacted by low liquidity)
 */
function calculateProjectedLoss(
  stressedPriceImpact: number,
  buyAmountUsd: number,
  stressedLiquidity: number
): number {
  // Entry loss from price impact
  const entryLoss = stressedPriceImpact;
  
  // Exit would have similar (or worse) impact
  // Selling into stressed pool = even more slippage
  const exitImpact = stressedLiquidity > 0
    ? (buyAmountUsd / (2 * stressedLiquidity)) * 100
    : 100;
  
  // Total projected loss = entry impact + exit impact (partially overlapping)
  // Use geometric average to avoid double-counting
  const totalLoss = entryLoss + exitImpact * 0.7; // 70% of exit impact adds to loss
  
  return Math.min(100, totalLoss);
}

// =============================================================================
// MAIN FUNCTION
// =============================================================================

/**
 * Run capital preservation simulation
 */
export function simulateCapitalPreservation(input: CapitalPreservationInput): CapitalPreservationResult {
  const rule = 'CAPITAL_PRESERVATION';
  
  // Pump.fun exempt
  if (input.isPumpFun || input.source === 'Pump.fun' || input.source === 'pumpfun' || input.source === 'PumpSwap') {
    return {
      passed: true,
      rule,
      reason: 'Pump.fun bonding curve - capital preservation exempt',
      penalty: 0,
      hardBlock: false,
      details: {
        projectedLossPercent: 0,
        maxAllowedLossPercent: MAX_PROJECTED_LOSS_PERCENT,
        simulatedLiquidityUsd: 0,
        buyAmountUsd: 0,
        liquidityBuyRatio: 0,
        currentPriceImpact: 0,
        stressedPriceImpact: 0,
      },
    };
  }
  
  const buyAmountUsd = input.buyAmountSol * input.solPriceUsd;
  const stressedLiquidity = input.currentLiquidityUsd * (1 - LIQUIDITY_STRESS_FACTOR);
  const liquidityBuyRatio = input.currentLiquidityUsd / buyAmountUsd;
  const currentPriceImpact = input.currentPriceImpact || 0;
  
  // Estimate stressed price impact
  const stressedPriceImpact = estimateStressedPriceImpact(
    buyAmountUsd,
    input.currentLiquidityUsd,
    currentPriceImpact
  );
  
  // Calculate projected loss
  const projectedLoss = calculateProjectedLoss(
    stressedPriceImpact,
    buyAmountUsd,
    stressedLiquidity
  );
  
  // BLOCK if projected loss > 40%
  if (projectedLoss > MAX_PROJECTED_LOSS_PERCENT) {
    return {
      passed: false,
      rule,
      reason: `Stress test FAIL: ${projectedLoss.toFixed(1)}% projected loss if liquidity drops 50% (>${MAX_PROJECTED_LOSS_PERCENT}%)`,
      penalty: PENALTY_BLOCK,
      hardBlock: true,
      details: {
        projectedLossPercent: projectedLoss,
        maxAllowedLossPercent: MAX_PROJECTED_LOSS_PERCENT,
        simulatedLiquidityUsd: stressedLiquidity,
        buyAmountUsd,
        liquidityBuyRatio,
        currentPriceImpact,
        stressedPriceImpact,
      },
    };
  }
  
  // Warning if projected loss > 25%
  if (projectedLoss > 25) {
    return {
      passed: true,
      rule,
      reason: `Stress test WARN: ${projectedLoss.toFixed(1)}% projected loss under 50% liquidity drop`,
      penalty: PENALTY_WARN,
      hardBlock: false,
      details: {
        projectedLossPercent: projectedLoss,
        maxAllowedLossPercent: MAX_PROJECTED_LOSS_PERCENT,
        simulatedLiquidityUsd: stressedLiquidity,
        buyAmountUsd,
        liquidityBuyRatio,
        currentPriceImpact,
        stressedPriceImpact,
      },
    };
  }
  
  return {
    passed: true,
    rule,
    reason: `Stress test PASS: ${projectedLoss.toFixed(1)}% projected loss (within ${MAX_PROJECTED_LOSS_PERCENT}% limit)`,
    penalty: 0,
    hardBlock: false,
    details: {
      projectedLossPercent: projectedLoss,
      maxAllowedLossPercent: MAX_PROJECTED_LOSS_PERCENT,
      simulatedLiquidityUsd: stressedLiquidity,
      buyAmountUsd,
      liquidityBuyRatio,
      currentPriceImpact,
      stressedPriceImpact,
    },
  };
}
