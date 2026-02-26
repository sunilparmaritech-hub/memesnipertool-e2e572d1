/**
 * Observation Delay Module (v2 — Optimized)
 * 
 * Before marking EXECUTABLE, adds a SHORT observation delay.
 * Re-checks:
 * - Liquidity stability
 * - Quote depth consistency (if initial quote provided)
 * 
 * v2 Changes:
 * - Reduced from 10s → 3s for faster entry on fast-moving tokens
 * - Non-blocking: uses cached data where available
 * - Skip for Pump.fun AND high-liquidity tokens (>$50k)
 * - Relaxed thresholds: 20% liquidity change, 15% quote deviation
 */

// =============================================================================
// TYPES
// =============================================================================

export interface ObservationInput {
  tokenAddress: string;
  initialLiquidityUsd: number;
  initialQuoteOutput?: number;
  buyAmountSol?: number;
  maxSlippage?: number;
  isPumpFun?: boolean;
  source?: string;
}

export interface ObservationResult {
  stable: boolean;
  reason: string;
  details: {
    liquidityChangePercent: number;
    quoteDeviationPercent: number;
    observationDurationMs: number;
  };
}

// =============================================================================
// CONSTANTS (v2 — Faster)
// =============================================================================

const OBSERVATION_DELAY_MS = 3_000;       // 3 seconds (was 10s)
const MAX_LIQUIDITY_CHANGE_PERCENT = 20;  // >20% change = unstable (was 15%)
const MAX_QUOTE_DEVIATION_PERCENT = 15;   // >15% quote change = unstable (was 10%)
const HIGH_LIQUIDITY_SKIP_USD = 50_000;   // Skip observation for high-liq tokens

const SOL_MINT = 'So11111111111111111111111111111111111111112';
const LAMPORTS_PER_SOL = 1_000_000_000;

// =============================================================================
// HELPERS
// =============================================================================

async function fetchCurrentLiquidity(tokenAddress: string): Promise<number | null> {
  try {
    const response = await fetch(
      `https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`,
      { signal: AbortSignal.timeout(4000) }
    );
    if (!response.ok) return null;
    const data = await response.json();
    const pair = data.pairs?.find((p: any) => p.chainId === 'solana');
    return pair?.liquidity?.usd ?? null;
  } catch {
    return null;
  }
}

async function fetchQuoteOutput(tokenAddress: string, buyAmountSol: number, maxSlippage: number): Promise<number | null> {
  try {
    const amountLamports = Math.floor(buyAmountSol * LAMPORTS_PER_SOL).toString();
    const slippageBps = Math.floor(maxSlippage * 10000);
    const response = await fetch(
      `https://lite-api.jup.ag/swap/v1/quote?inputMint=${SOL_MINT}&outputMint=${tokenAddress}&amount=${amountLamports}&slippageBps=${slippageBps}`,
      { signal: AbortSignal.timeout(4000) }
    );
    if (!response.ok) return null;
    const data = await response.json();
    return data.outAmount ? parseInt(data.outAmount) : null;
  } catch {
    return null;
  }
}

// =============================================================================
// MAIN FUNCTION
// =============================================================================

/**
 * Run optimized observation delay with stability re-check
 * 
 * v2: 3s delay, skip for pump.fun & high-liq tokens, relaxed thresholds
 */
export async function runObservationDelay(input: ObservationInput): Promise<ObservationResult> {
  const skipResult: ObservationResult = {
    stable: true,
    reason: '',
    details: { liquidityChangePercent: 0, quoteDeviationPercent: 0, observationDurationMs: 0 },
  };

  // Skip for Pump.fun
  if (input.isPumpFun || input.source === 'Pump.fun' || input.source === 'pumpfun' || input.source === 'PumpSwap') {
    skipResult.reason = 'Pump.fun — observation delay skipped';
    return skipResult;
  }
  
  // Skip for high-liquidity tokens — they're stable enough
  if (input.initialLiquidityUsd >= HIGH_LIQUIDITY_SKIP_USD) {
    skipResult.reason = `High liquidity ($${(input.initialLiquidityUsd / 1000).toFixed(0)}k) — observation skipped`;
    return skipResult;
  }
  
  console.log(`[ObservationDelay] Starting 3s observation for ${input.tokenAddress.slice(0, 8)}...`);
  
  // Wait observation period (3s instead of 10s)
  await new Promise(resolve => setTimeout(resolve, OBSERVATION_DELAY_MS));
  
  // Re-check liquidity and quote in parallel
  const [currentLiquidity, currentQuote] = await Promise.all([
    fetchCurrentLiquidity(input.tokenAddress),
    (input.buyAmountSol && input.initialQuoteOutput)
      ? fetchQuoteOutput(input.tokenAddress, input.buyAmountSol, input.maxSlippage || 0.15)
      : Promise.resolve(null),
  ]);

  let liquidityChangePercent = 0;
  if (currentLiquidity !== null && input.initialLiquidityUsd > 0) {
    liquidityChangePercent = Math.abs(
      ((currentLiquidity - input.initialLiquidityUsd) / input.initialLiquidityUsd) * 100
    );
  }
  
  let quoteDeviationPercent = 0;
  if (currentQuote !== null && input.initialQuoteOutput && input.initialQuoteOutput > 0) {
    quoteDeviationPercent = Math.abs(
      ((currentQuote - input.initialQuoteOutput) / input.initialQuoteOutput) * 100
    );
  }
  
  // Determine stability with relaxed thresholds
  const liquidityUnstable = liquidityChangePercent > MAX_LIQUIDITY_CHANGE_PERCENT;
  const quoteUnstable = quoteDeviationPercent > MAX_QUOTE_DEVIATION_PERCENT;
  const stable = !liquidityUnstable && !quoteUnstable;
  
  const reasons: string[] = [];
  if (liquidityUnstable) reasons.push(`Liquidity changed ${liquidityChangePercent.toFixed(1)}%`);
  if (quoteUnstable) reasons.push(`Quote deviated ${quoteDeviationPercent.toFixed(1)}%`);
  
  const reason = stable 
    ? `Stable after 3s observation (liq: ${liquidityChangePercent.toFixed(1)}%, quote: ${quoteDeviationPercent.toFixed(1)}%)`
    : `Unstable: ${reasons.join(', ')}`;
  
  console.log(`[ObservationDelay] ${input.tokenAddress.slice(0, 8)}... result: ${stable ? 'STABLE' : 'UNSTABLE'}`);
  
  return {
    stable,
    reason,
    details: {
      liquidityChangePercent,
      quoteDeviationPercent,
      observationDurationMs: OBSERVATION_DELAY_MS,
    },
  };
}
