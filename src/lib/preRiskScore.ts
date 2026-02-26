/**
 * Pre-Risk Score Module
 * 
 * Computes a preliminary risk score (0-100) using ONLY free data sources
 * (RPC + Helius + cached data). This score determines whether expensive
 * Birdeye API calls are warranted.
 * 
 * Score thresholds:
 * - ≥75 → EXECUTE directly (skip Birdeye)
 * - 60–74 → Call Birdeye as tie-breaker
 * - <60 → BLOCK (skip Birdeye entirely)
 * 
 * Data sources used (all free):
 * - Freeze authority (from scanner/RPC)
 * - Mint authority (from scanner/RPC)
 * - LP integrity (from RPC)
 * - Sell route confirmation (Jupiter free API)
 * - Liquidity threshold (from discovery)
 * - Deployer reputation (from DB cache)
 * - Holder count (from Helius)
 * - Pool age (from discovery timestamp)
 */

import { cacheGet, cacheSet } from './validationCache';
import { getSolPriceSync } from '@/hooks/useSolPrice';

// =============================================================================
// TYPES
// =============================================================================

export interface PreRiskInput {
  tokenAddress: string;
  tokenSymbol: string;
  
  // From discovery (free)
  liquidity: number;           // SOL (canonical unit)
  liquidityUnit?: 'SOL' | 'USD'; // Default: 'SOL' — set to 'USD' if passing USD value
  poolCreatedAt?: number;      // Unix ms
  source?: string;
  isPumpFun?: boolean;
  
  // From RPC / Helius (free)
  hasFreezeAuthority?: boolean;
  hasMintAuthority?: boolean;
  holderCount?: number;
  
  // From LP verification (RPC, free)
  lpIntegrityPassed?: boolean;
  lpBurnedPercent?: number;
  
  // From Jupiter free API
  hasJupiterRoute?: boolean;
  
  // From deployer reputation DB
  deployerScore?: number;      // 0-100
  deployerIsKnownRugger?: boolean;
  
  // LP ownership
  lpHolderConcentration?: number;
}

/**
 * Normalize liquidity to USD for tier comparison.
 * Canonical unit is SOL; converted to USD using live price.
 */
function toLiquidityUsd(input: PreRiskInput): number {
  if (input.liquidityUnit === 'USD') return input.liquidity;
  const solPrice = getSolPriceSync();
  return input.liquidity * solPrice;
}

export interface PreRiskResult {
  score: number;               // 0-100 (higher = safer)
  tier: 'EXECUTE' | 'TIEBREAKER' | 'BLOCK';
  shouldCallBirdeye: boolean;
  reasons: string[];
  breakdown: Record<string, { points: number; maxPoints: number; reason: string }>;
  computedAt: number;
}

// =============================================================================
// LIQUIDITY TIERS
// =============================================================================

export type LiquidityTier = 'A' | 'B' | 'C';

export function getLiquidityTier(liquidityUsd: number): LiquidityTier {
  if (liquidityUsd >= 50_000) return 'A';
  if (liquidityUsd >= 15_000) return 'B';
  return 'C';
}

// =============================================================================
// PRE-RISK SCORE COMPUTATION
// =============================================================================

/**
 * Compute pre-risk score using only free data.
 * Returns score 0-100 and whether Birdeye should be called.
 */
export function computePreRiskScore(input: PreRiskInput): PreRiskResult {
  // Check cache first
  const cached = cacheGet<PreRiskResult>('preRisk', input.tokenAddress);
  if (cached) {
    return cached;
  }

  // Normalize liquidity to USD for tier comparisons
  const liquidityUsd = toLiquidityUsd(input);

  let score = 0;
  const maxScore = 100;
  const reasons: string[] = [];
  const breakdown: Record<string, { points: number; maxPoints: number; reason: string }> = {};

  // ── 1. Freeze Authority (20 points max) ──
  const freezeMax = 20;
  if (input.hasFreezeAuthority === false) {
    score += freezeMax;
    breakdown.freezeAuthority = { points: freezeMax, maxPoints: freezeMax, reason: 'No freeze authority' };
  } else if (input.hasFreezeAuthority === true) {
    breakdown.freezeAuthority = { points: 0, maxPoints: freezeMax, reason: 'FREEZE AUTHORITY ACTIVE' };
    reasons.push('Freeze authority active');
  } else {
    score += 5; // Unknown = partial credit
    breakdown.freezeAuthority = { points: 5, maxPoints: freezeMax, reason: 'Freeze status unknown' };
  }

  // ── 2. LP Integrity (15 points max) ──
  const lpMax = 15;
  if (input.lpIntegrityPassed === true) {
    const burnBonus = input.lpBurnedPercent && input.lpBurnedPercent > 95 ? lpMax : 10;
    score += burnBonus;
    breakdown.lpIntegrity = { points: burnBonus, maxPoints: lpMax, reason: `LP integrity passed (${input.lpBurnedPercent?.toFixed(0) || '?'}% burned)` };
  } else if (input.lpIntegrityPassed === false) {
    breakdown.lpIntegrity = { points: 0, maxPoints: lpMax, reason: 'LP integrity FAILED' };
    reasons.push('LP integrity failed');
  } else if (input.isPumpFun) {
    score += lpMax; // Pump.fun uses bonding curve
    breakdown.lpIntegrity = { points: lpMax, maxPoints: lpMax, reason: 'Pump.fun bonding curve (no LP)' };
  } else {
    score += 5;
    breakdown.lpIntegrity = { points: 5, maxPoints: lpMax, reason: 'LP data unavailable' };
  }

  // ── 3. Sell Route (20 points max) ──
  const routeMax = 20;
  if (input.hasJupiterRoute === true) {
    score += routeMax;
    breakdown.sellRoute = { points: routeMax, maxPoints: routeMax, reason: 'Sell route confirmed' };
  } else if (input.hasJupiterRoute === false) {
    breakdown.sellRoute = { points: 0, maxPoints: routeMax, reason: 'NO SELL ROUTE' };
    reasons.push('No sell route');
  } else if (input.isPumpFun) {
    score += routeMax;
    breakdown.sellRoute = { points: routeMax, maxPoints: routeMax, reason: 'Pump.fun bonding curve sell' };
  } else {
    score += 5;
    breakdown.sellRoute = { points: 5, maxPoints: routeMax, reason: 'Route status unknown' };
  }

  // ── 4. Liquidity Threshold (15 points max) ──
  const liqMax = 15;
  if (liquidityUsd >= 50_000) {
    score += liqMax;
    breakdown.liquidity = { points: liqMax, maxPoints: liqMax, reason: `High liquidity: ${input.liquidity.toFixed(1)} SOL (~$${liquidityUsd.toFixed(0)})` };
  } else if (liquidityUsd >= 15_000) {
    score += 10;
    breakdown.liquidity = { points: 10, maxPoints: liqMax, reason: `Moderate liquidity: ${input.liquidity.toFixed(1)} SOL (~$${liquidityUsd.toFixed(0)})` };
  } else if (liquidityUsd >= 5_000) {
    score += 5;
    breakdown.liquidity = { points: 5, maxPoints: liqMax, reason: `Low liquidity: ${input.liquidity.toFixed(1)} SOL (~$${liquidityUsd.toFixed(0)})` };
  } else {
    breakdown.liquidity = { points: 0, maxPoints: liqMax, reason: `Insufficient liquidity: ${input.liquidity.toFixed(1)} SOL (~$${liquidityUsd.toFixed(0)})` };
    reasons.push(`Liquidity below ~$5k (${input.liquidity.toFixed(1)} SOL)`);
  }

  // ── 5. Deployer Reputation (15 points max) ──
  const deployerMax = 15;
  if (input.deployerIsKnownRugger === true) {
    breakdown.deployer = { points: 0, maxPoints: deployerMax, reason: 'KNOWN RUGGER' };
    reasons.push('Known rug deployer');
  } else if (input.deployerScore !== undefined) {
    if (input.deployerScore >= 70) {
      score += deployerMax;
      breakdown.deployer = { points: deployerMax, maxPoints: deployerMax, reason: `Clean deployer (score: ${input.deployerScore})` };
    } else if (input.deployerScore >= 50) {
      score += 8;
      breakdown.deployer = { points: 8, maxPoints: deployerMax, reason: `Neutral deployer (score: ${input.deployerScore})` };
    } else {
      score += 3;
      breakdown.deployer = { points: 3, maxPoints: deployerMax, reason: `Risky deployer (score: ${input.deployerScore})` };
      reasons.push('Low deployer reputation');
    }
  } else {
    score += 7; // Unknown deployer = half credit
    breakdown.deployer = { points: 7, maxPoints: deployerMax, reason: 'Deployer reputation unknown' };
  }

  // ── 6. Pool Age (10 points max) ──
  const ageMax = 10;
  if (input.poolCreatedAt) {
    const ageSec = (Date.now() - input.poolCreatedAt) / 1000;
    if (ageSec >= 120) {
      score += ageMax;
      breakdown.poolAge = { points: ageMax, maxPoints: ageMax, reason: `Pool age: ${ageSec.toFixed(0)}s (>120s)` };
    } else if (ageSec >= 45) {
      score += 6;
      breakdown.poolAge = { points: 6, maxPoints: ageMax, reason: `Pool age: ${ageSec.toFixed(0)}s (>45s)` };
    } else {
      score += 2;
      breakdown.poolAge = { points: 2, maxPoints: ageMax, reason: `Pool age: ${ageSec.toFixed(0)}s (<45s)` };
      reasons.push('Pool too new');
    }
  } else {
    score += 4;
    breakdown.poolAge = { points: 4, maxPoints: ageMax, reason: 'Pool age unknown' };
  }

  // ── 7. Holder Count (5 points max) ──
  const holderMax = 5;
  if (input.holderCount !== undefined) {
    if (input.holderCount >= 20) {
      score += holderMax;
      breakdown.holders = { points: holderMax, maxPoints: holderMax, reason: `${input.holderCount} holders` };
    } else if (input.holderCount >= 5) {
      score += 3;
      breakdown.holders = { points: 3, maxPoints: holderMax, reason: `${input.holderCount} holders (low)` };
    } else {
      breakdown.holders = { points: 0, maxPoints: holderMax, reason: `Only ${input.holderCount} holders` };
      reasons.push('Very few holders');
    }
  } else {
    score += 2;
    breakdown.holders = { points: 2, maxPoints: holderMax, reason: 'Holder count unknown' };
  }

  // ── Determine tier ──
  const liquidityTier = getLiquidityTier(liquidityUsd);
  let tier: 'EXECUTE' | 'TIEBREAKER' | 'BLOCK';
  let shouldCallBirdeye: boolean;

  if (score >= 75) {
    tier = 'EXECUTE';
    // Tier A always calls Birdeye for cross-check; others skip
    shouldCallBirdeye = liquidityTier === 'A';
  } else if (score >= 60) {
    tier = 'TIEBREAKER';
    // Tier C never calls Birdeye; Tier A/B call it
    shouldCallBirdeye = liquidityTier !== 'C';
  } else {
    tier = 'BLOCK';
    shouldCallBirdeye = false;
  }

  const result: PreRiskResult = {
    score,
    tier,
    shouldCallBirdeye,
    reasons,
    breakdown,
    computedAt: Date.now(),
  };

  // Cache result
  cacheSet('preRisk', input.tokenAddress, result, 'preRiskScore');

  console.log(`[PreRisk] ${input.tokenSymbol} (${input.tokenAddress.slice(0, 8)}...): score=${score}/${maxScore} tier=${tier} birdeye=${shouldCallBirdeye} liqTier=${liquidityTier}`);

  return result;
}

/**
 * Quality gate check before allowing Birdeye call.
 * Returns false if token doesn't meet minimum requirements.
 */
export function passesQualityGate(input: PreRiskInput): { passed: boolean; reason: string } {
  const liquidityUsd = toLiquidityUsd(input);
  
  // Liquidity must be >= $15,000
  if (liquidityUsd < 15_000) {
    return { passed: false, reason: `Liquidity ${input.liquidity.toFixed(1)} SOL (~$${liquidityUsd.toFixed(0)}) < $15,000 minimum` };
  }

  // Pool age must be >= 45 seconds
  if (input.poolCreatedAt) {
    const ageSec = (Date.now() - input.poolCreatedAt) / 1000;
    if (ageSec < 45) {
      return { passed: false, reason: `Pool age ${ageSec.toFixed(0)}s < 45s minimum` };
    }
  }

  // Sell route must be confirmed
  if (input.hasJupiterRoute === false && !input.isPumpFun) {
    return { passed: false, reason: 'No sell route confirmed' };
  }

  // LP integrity must pass (if data available)
  if (input.lpIntegrityPassed === false) {
    return { passed: false, reason: 'LP integrity check failed' };
  }

  return { passed: true, reason: 'Quality gate passed' };
}
