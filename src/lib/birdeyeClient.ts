/**
 * Birdeye API Client (Refactored)
 * 
 * Birdeye is now a FINAL INTELLIGENCE LAYER, not a broad validator.
 * Called only when:
 * - Pre-risk score is in tie-breaker zone (60-74)
 * - Liquidity tier A ($50k+) for cross-check
 * - Quality gate passes (liq ≥$15k, age ≥45s, route confirmed, LP OK)
 * 
 * Consolidates to single /token_overview endpoint.
 * /token_security only called if freeze/mint not confirmed via Helius.
 * 
 * Uses smart tiered caching (60s TTL via validationCache).
 */

import { supabase } from '@/integrations/supabase/client';
import { cacheGet, cacheSet, getCacheStats } from './validationCache';
import { 
  computePreRiskScore, 
  passesQualityGate, 
  getLiquidityTier,
  type PreRiskInput, 
  type PreRiskResult 
} from './preRiskScore';

// =============================================================================
// TYPES
// =============================================================================

export interface BirdeyeTokenOverview {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  liquidity: number;
  volume24h: number;
  volumeChange24h: number;
  priceUsd: number;
  priceChange24h: number;
  marketCap: number;
  fdv: number;
  supply: number;
  holder: number;
  trade24h: number;
  trade24hChangePercent: number;
  uniqueWallet24h: number;
  lastTradeUnixTime: number;
}

export interface BirdeyeTokenSecurity {
  address: string;
  creatorAddress: string | null;
  creatorOwnerAddress: string | null;
  ownerAddress: string | null;
  creationTx: string | null;
  creationTime: number | null;
  mintTx: string | null;
  isToken2022: boolean;
  isTrueToken: boolean;
  mutableMetadata: boolean;
  freezeAuthority: string | null;
  mintAuthority: string | null;
  top10HolderPercent: number;
  top10HolderBalance: number;
  totalSupply: number;
  preMarketHolder: string[];
  lockInfo: {
    isLocked: boolean;
    lockPercent: number;
    unlockTime: number | null;
  } | null;
  transferFeeEnable: boolean;
  transferFeeData: {
    transferFeeConfigAuthority: string | null;
    withdrawWithheldAuthority: string | null;
    olderTransferFee: number;
    newerTransferFee: number;
  } | null;
  isVerified: boolean;
  holderCount: number;
}

export interface BirdeyeValidationData {
  overview: BirdeyeTokenOverview | null;
  security: BirdeyeTokenSecurity | null;
  fetchedAt: number;
  skipped?: boolean;
  skipReason?: string;
}

// =============================================================================
// METRICS
// =============================================================================

let metrics = {
  totalRequests: 0,
  birdeyeCalls: 0,
  skippedByPreRisk: 0,
  skippedByQualityGate: 0,
  skippedByTier: 0,
  cacheHits: 0,
  overviewOnlyCalls: 0,
  fullCalls: 0,
};

export function getBirdeyeMetrics() {
  const total = metrics.totalRequests || 1;
  return {
    ...metrics,
    reductionPercent: ((total - metrics.birdeyeCalls) / total * 100).toFixed(1),
    avgCallsPerToken: (metrics.birdeyeCalls / total).toFixed(2),
    cacheHitRate: getCacheStats().hitRate.toFixed(1),
  };
}

export function resetBirdeyeMetrics() {
  metrics = {
    totalRequests: 0, birdeyeCalls: 0, skippedByPreRisk: 0,
    skippedByQualityGate: 0, skippedByTier: 0, cacheHits: 0,
    overviewOnlyCalls: 0, fullCalls: 0,
  };
}

// =============================================================================
// API CALLS (via Edge Function proxy)
// =============================================================================

async function fetchTokenOverview(tokenAddress: string): Promise<BirdeyeTokenOverview | null> {
  try {
    const { data, error } = await supabase.functions.invoke('birdeye-proxy', {
      body: { endpoint: 'token_overview', tokenAddress },
    });
    if (error || !data?.success) {
      console.error('[Birdeye] Overview fetch error:', error || data?.error);
      return null;
    }
    return data.data as BirdeyeTokenOverview;
  } catch (err) {
    console.error('[Birdeye] Overview unexpected error:', err);
    return null;
  }
}

async function fetchTokenSecurity(tokenAddress: string): Promise<BirdeyeTokenSecurity | null> {
  try {
    const { data, error } = await supabase.functions.invoke('birdeye-proxy', {
      body: { endpoint: 'token_security', tokenAddress },
    });
    if (error || !data?.success) {
      console.error('[Birdeye] Security fetch error:', error || data?.error);
      return null;
    }
    return data.data as BirdeyeTokenSecurity;
  } catch (err) {
    console.error('[Birdeye] Security unexpected error:', err);
    return null;
  }
}

// =============================================================================
// TIERED BIRDEYE CALLING
// =============================================================================

/**
 * Fetch Birdeye validation data with intelligent gating.
 * 
 * Flow:
 * 1. Check cache → return if hit
 * 2. Compute pre-risk score from free data
 * 3. Apply quality gate (liq, age, route, LP)
 * 4. Apply tier-based decision:
 *    - Score ≥75: EXECUTE (skip Birdeye, unless Tier A liquidity)
 *    - Score 60-74: Call Birdeye (tie-breaker)
 *    - Score <60: BLOCK (skip Birdeye)
 * 5. Consolidate endpoints (overview only, security if needed)
 */
export async function fetchBirdeyeValidation(
  tokenAddress: string,
  preRiskInput?: PreRiskInput
): Promise<BirdeyeValidationData> {
  metrics.totalRequests++;

  // ── 1. Check cache ──
  const cached = cacheGet<BirdeyeValidationData>('birdeye', tokenAddress);
  if (cached) {
    metrics.cacheHits++;
    console.log(`[Birdeye] Cache hit for ${tokenAddress.slice(0, 8)}...`);
    return cached;
  }

  // ── 2. Pre-risk gate (if input provided) ──
  if (preRiskInput) {
    const preRisk = computePreRiskScore(preRiskInput);
    
    // Quality gate
    const qualityGate = passesQualityGate(preRiskInput);
    if (!qualityGate.passed) {
      metrics.skippedByQualityGate++;
      const skipped = createSkippedResult(tokenAddress, `Quality gate: ${qualityGate.reason}`);
      cacheSet('birdeye', tokenAddress, skipped, 'quality-gate-skip');
      return skipped;
    }

    // Tier-based decision
    if (!preRisk.shouldCallBirdeye) {
      if (preRisk.tier === 'BLOCK') {
        metrics.skippedByPreRisk++;
        const skipped = createSkippedResult(tokenAddress, `Pre-risk score ${preRisk.score} < 60 (BLOCK)`);
        cacheSet('birdeye', tokenAddress, skipped, 'pre-risk-block');
        return skipped;
      }
      if (preRisk.tier === 'EXECUTE') {
        metrics.skippedByTier++;
        const skipped = createSkippedResult(tokenAddress, `Pre-risk score ${preRisk.score} ≥ 75 (EXECUTE, non-Tier-A)`);
        cacheSet('birdeye', tokenAddress, skipped, 'pre-risk-execute-skip');
        return skipped;
      }
    }
  }

  // ── 3. Determine endpoint strategy ──
  // Consolidate: Only call /token_overview first
  // Call /token_security only if freeze/mint status unknown from RPC
  const needsSecurity = preRiskInput?.hasFreezeAuthority === undefined;

  let overview: BirdeyeTokenOverview | null = null;
  let security: BirdeyeTokenSecurity | null = null;

  if (needsSecurity) {
    // Need both endpoints
    metrics.fullCalls++;
    metrics.birdeyeCalls += 2;
    [overview, security] = await Promise.all([
      fetchTokenOverview(tokenAddress),
      fetchTokenSecurity(tokenAddress),
    ]);
  } else {
    // Overview only (consolidated)
    metrics.overviewOnlyCalls++;
    metrics.birdeyeCalls += 1;
    overview = await fetchTokenOverview(tokenAddress);
  }

  const result: BirdeyeValidationData = {
    overview,
    security,
    fetchedAt: Date.now(),
  };

  cacheSet('birdeye', tokenAddress, result, 'birdeye-api');

  console.log(`[Birdeye] Fetched ${tokenAddress.slice(0, 8)}... overview=${!!overview} security=${!!security} (consolidated=${!needsSecurity})`);

  return result;
}

/**
 * Tie-breaker mode: Call Birdeye only to resolve ambiguous pre-risk scores.
 * Returns adjusted risk score.
 */
export async function birdeyeTieBreaker(
  tokenAddress: string,
  currentScore: number,
  preRiskInput: PreRiskInput
): Promise<{ adjustedScore: number; birdeyeCalled: boolean; adjustment: number }> {
  // Only call in tie-breaker zone
  if (currentScore >= 75 || currentScore < 60) {
    return { adjustedScore: currentScore, birdeyeCalled: false, adjustment: 0 };
  }

  const data = await fetchBirdeyeValidation(tokenAddress, preRiskInput);
  
  if (data.skipped || !data.overview) {
    return { adjustedScore: currentScore, birdeyeCalled: false, adjustment: 0 };
  }

  // Birdeye intelligence adjustments
  let adjustment = 0;

  // Real liquidity cross-check
  if (data.overview.liquidity > 0) {
    const discoveryLiq = preRiskInput.liquidity;
    const birdeyeLiq = data.overview.liquidity;
    const liqRatio = birdeyeLiq / Math.max(discoveryLiq, 1);
    
    if (liqRatio < 0.5) {
      adjustment -= 15; // Liquidity inflated in discovery
    } else if (liqRatio >= 0.8) {
      adjustment += 5; // Liquidity confirmed
    }
  }

  // 24h volume check
  if (data.overview.volume24h > 10000) {
    adjustment += 5;
  } else if (data.overview.volume24h < 1000) {
    adjustment -= 5;
  }

  // Unique traders
  if (data.overview.uniqueWallet24h >= 50) {
    adjustment += 5;
  } else if (data.overview.uniqueWallet24h < 10) {
    adjustment -= 5;
  }

  // Security flags (if fetched)
  if (data.security) {
    if (data.security.top10HolderPercent > 80) {
      adjustment -= 10;
    }
    if (data.security.freezeAuthority) {
      adjustment -= 15;
    }
    if (data.security.transferFeeEnable) {
      adjustment -= 10;
    }
  }

  const adjustedScore = Math.max(0, Math.min(100, currentScore + adjustment));

  console.log(`[Birdeye TieBreaker] ${tokenAddress.slice(0, 8)}...: ${currentScore} → ${adjustedScore} (adj: ${adjustment >= 0 ? '+' : ''}${adjustment})`);

  return { adjustedScore, birdeyeCalled: true, adjustment };
}

// =============================================================================
// HELPERS
// =============================================================================

function createSkippedResult(tokenAddress: string, reason: string): BirdeyeValidationData {
  console.log(`[Birdeye] SKIPPED ${tokenAddress.slice(0, 8)}...: ${reason}`);
  return {
    overview: null,
    security: null,
    fetchedAt: Date.now(),
    skipped: true,
    skipReason: reason,
  };
}

/**
 * Extract validation-relevant fields from Birdeye data
 * Maps to PreExecutionGateInput fields
 */
export function extractBirdeyeGateFields(data: BirdeyeValidationData): {
  liquidity: number;
  holderCount: number;
  top10HolderPercent: number;
  fdvUsd: number;
  marketCapUsd: number;
  hasFreezeAuthority: boolean;
  volume24h: number;
  uniqueWallets24h: number;
  deployerWallet: string | null;
  isToken2022: boolean;
  transferFeeEnabled: boolean;
} {
  return {
    liquidity: data.overview?.liquidity ?? 0,
    holderCount: data.security?.holderCount ?? data.overview?.holder ?? 0,
    top10HolderPercent: data.security?.top10HolderPercent ?? 0,
    fdvUsd: data.overview?.fdv ?? 0,
    marketCapUsd: data.overview?.marketCap ?? 0,
    hasFreezeAuthority: !!data.security?.freezeAuthority,
    volume24h: data.overview?.volume24h ?? 0,
    uniqueWallets24h: data.overview?.uniqueWallet24h ?? 0,
    deployerWallet: data.security?.creatorAddress ?? null,
    isToken2022: data.security?.isToken2022 ?? false,
    transferFeeEnabled: data.security?.transferFeeEnable ?? false,
  };
}

/**
 * Clear cache (for testing)
 */
export function clearBirdeyeCache(): void {
  // Clear birdeye category from validation cache
  import('./validationCache').then(m => m.cacheClearCategory('birdeye'));
}
