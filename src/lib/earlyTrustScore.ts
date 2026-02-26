/**
 * Early Trust Score Module (Stage 2.5)
 * 
 * Computes a trust-weighted bonus (0-20 points) for tokens that show
 * strong positive signals. This bonus is ADDED to the risk score to
 * help high-quality early-stage tokens cross execution thresholds.
 * 
 * Trust Signals:
 * 1. Liquidity Strength      — Higher liquidity = more trustworthy (0-4 pts)
 * 2. Buyer Dispersion         — Many unique buyers = organic demand (0-3 pts)
 * 3. Funding Independence     — Buyers funded from diverse sources (0-3 pts)
 * 4. LP Burn %                — Higher burn = lower rug risk (0-3 pts)
 * 5. Sell Route Stability     — Confirmed sell route with low slippage (0-2 pts)
 * 6. Deployer Reputation      — Known good deployer (0-3 pts)
 * 7. Growth Velocity          — Healthy organic growth pattern (0-2 pts)
 * 
 * Maximum bonus: 20 points
 * 
 * This module does NOT replace safety checks — it supplements scoring
 * so that genuinely high-quality tokens aren't blocked by penalty stacking.
 */

// =============================================================================
// TYPES
// =============================================================================

export interface EarlyTrustInput {
  liquidityUsd: number;
  uniqueBuyerCount?: number;
  buyerWallets?: string[];
  fundingSourceDiversity?: number;     // 0-1, how diverse funding sources are
  lpBurnedPercent?: number;            // 0-100
  hasConfirmedSellRoute: boolean;
  sellSlippage?: number;               // 0-1
  deployerReputationScore?: number;    // 0-100 from deployer_reputation table
  holderCount?: number;
  tokenAgeSeconds?: number;
  priceChangePercent?: number;         // Recent price movement
  isPumpFun?: boolean;
}

export interface EarlyTrustResult {
  bonus: number;                       // 0-20 total bonus points
  breakdown: TrustBreakdown;
  signals: string[];                   // Human-readable signal descriptions
}

export interface TrustBreakdown {
  liquidityStrength: number;           // 0-4
  buyerDispersion: number;             // 0-3
  fundingIndependence: number;         // 0-3
  lpBurnQuality: number;              // 0-3
  sellStability: number;              // 0-2
  deployerTrust: number;              // 0-3
  growthVelocity: number;             // 0-2
}

// =============================================================================
// CONSTANTS
// =============================================================================

const MAX_BONUS = 20;

// Liquidity tiers
const LIQ_TIERS = [
  { min: 100_000, pts: 4 },
  { min: 50_000,  pts: 3 },
  { min: 20_000,  pts: 2 },
  { min: 10_000,  pts: 1 },
];

// =============================================================================
// MAIN FUNCTION
// =============================================================================

export function calculateEarlyTrustScore(input: EarlyTrustInput): EarlyTrustResult {
  const signals: string[] = [];
  const breakdown: TrustBreakdown = {
    liquidityStrength: 0,
    buyerDispersion: 0,
    fundingIndependence: 0,
    lpBurnQuality: 0,
    sellStability: 0,
    deployerTrust: 0,
    growthVelocity: 0,
  };

  // 1. Liquidity Strength (0-4 pts)
  for (const tier of LIQ_TIERS) {
    if (input.liquidityUsd >= tier.min) {
      breakdown.liquidityStrength = tier.pts;
      signals.push(`Liquidity $${(input.liquidityUsd / 1000).toFixed(0)}k (+${tier.pts})`);
      break;
    }
  }

  // 2. Buyer Dispersion (0-3 pts)
  const buyers = input.uniqueBuyerCount ?? input.buyerWallets?.length ?? 0;
  if (buyers >= 20) {
    breakdown.buyerDispersion = 3;
    signals.push(`${buyers} unique buyers (+3)`);
  } else if (buyers >= 10) {
    breakdown.buyerDispersion = 2;
    signals.push(`${buyers} unique buyers (+2)`);
  } else if (buyers >= 5) {
    breakdown.buyerDispersion = 1;
    signals.push(`${buyers} unique buyers (+1)`);
  }

  // 3. Funding Independence (0-3 pts)
  if (input.fundingSourceDiversity !== undefined) {
    if (input.fundingSourceDiversity >= 0.8) {
      breakdown.fundingIndependence = 3;
      signals.push('High funding diversity (+3)');
    } else if (input.fundingSourceDiversity >= 0.5) {
      breakdown.fundingIndependence = 2;
      signals.push('Moderate funding diversity (+2)');
    } else if (input.fundingSourceDiversity >= 0.3) {
      breakdown.fundingIndependence = 1;
      signals.push('Some funding diversity (+1)');
    }
  }

  // 4. LP Burn Quality (0-3 pts)
  if (input.lpBurnedPercent !== undefined) {
    if (input.lpBurnedPercent >= 99) {
      breakdown.lpBurnQuality = 3;
      signals.push(`LP ${input.lpBurnedPercent.toFixed(0)}% burned (+3)`);
    } else if (input.lpBurnedPercent >= 95) {
      breakdown.lpBurnQuality = 2;
      signals.push(`LP ${input.lpBurnedPercent.toFixed(0)}% burned (+2)`);
    } else if (input.lpBurnedPercent >= 80) {
      breakdown.lpBurnQuality = 1;
      signals.push(`LP ${input.lpBurnedPercent.toFixed(0)}% burned (+1)`);
    }
  } else if (input.isPumpFun) {
    // Pump.fun uses bonding curve — no LP burn needed
    breakdown.lpBurnQuality = 2;
    signals.push('Pump.fun bonding curve (+2)');
  }

  // 5. Sell Route Stability (0-2 pts)
  if (input.hasConfirmedSellRoute) {
    if (input.sellSlippage !== undefined && input.sellSlippage < 0.05) {
      breakdown.sellStability = 2;
      signals.push(`Sell route confirmed, ${(input.sellSlippage * 100).toFixed(1)}% slippage (+2)`);
    } else {
      breakdown.sellStability = 1;
      signals.push('Sell route confirmed (+1)');
    }
  }

  // 6. Deployer Trust (0-3 pts)
  if (input.deployerReputationScore !== undefined) {
    if (input.deployerReputationScore >= 85) {
      breakdown.deployerTrust = 3;
      signals.push(`Deployer rep ${input.deployerReputationScore} (+3)`);
    } else if (input.deployerReputationScore >= 70) {
      breakdown.deployerTrust = 2;
      signals.push(`Deployer rep ${input.deployerReputationScore} (+2)`);
    } else if (input.deployerReputationScore >= 55) {
      breakdown.deployerTrust = 1;
      signals.push(`Deployer rep ${input.deployerReputationScore} (+1)`);
    }
  }

  // 7. Growth Velocity (0-2 pts)
  // Healthy growth = moderate price increase with age
  if (input.tokenAgeSeconds !== undefined && input.tokenAgeSeconds > 60) {
    const holders = input.holderCount ?? buyers;
    if (holders >= 15 && input.tokenAgeSeconds < 600) {
      breakdown.growthVelocity = 2;
      signals.push(`Fast organic growth: ${holders} holders in ${Math.floor(input.tokenAgeSeconds / 60)}m (+2)`);
    } else if (holders >= 8) {
      breakdown.growthVelocity = 1;
      signals.push(`Healthy holder growth (+1)`);
    }
  }

  // Sum up bonus (capped at MAX_BONUS)
  const rawBonus = 
    breakdown.liquidityStrength +
    breakdown.buyerDispersion +
    breakdown.fundingIndependence +
    breakdown.lpBurnQuality +
    breakdown.sellStability +
    breakdown.deployerTrust +
    breakdown.growthVelocity;

  const bonus = Math.min(rawBonus, MAX_BONUS);

  if (bonus > 0) {
    console.log(`[EarlyTrust] Bonus: +${bonus} (${signals.join(', ')})`);
  }

  return { bonus, breakdown, signals };
}
