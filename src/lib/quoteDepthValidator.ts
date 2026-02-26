/**
 * Quote Depth Validator Module
 * 
 * Upgrades 2+3: Depth-based liquidity validation & double-quote verification
 * 
 * Ensures:
 * - Price impact ≤ configured slippage for actual buy amount
 * - Output amount ≥ 90% of theoretical output
 * - Pool liquidity ≥ buyAmount × 5
 * - Two quotes separated by 2-3s have ≤ 5% deviation (anti-flash manipulation)
 */

import { fetchJupiterQuote } from '@/lib/jupiterQuote';

const SOL_MINT = 'So11111111111111111111111111111111111111112';
const LAMPORTS_PER_SOL = 1_000_000_000;

export interface DepthValidationInput {
  tokenAddress: string;
  buyAmountSol: number;        // Configured buy amount in SOL
  maxSlippage: number;         // Configured slippage tolerance (decimal, e.g., 0.15)
  poolLiquidityUsd: number;    // Current pool liquidity in USD
  solPriceUsd?: number;        // Current SOL price for conversion
  isPumpFun?: boolean;
  source?: string;
}

export interface DepthValidationResult {
  passed: boolean;
  rule: string;
  reason: string;
  penalty: number;
  details: {
    priceImpact: number | null;
    outputRatio: number | null;    // actual/theoretical
    liquidityRatio: number | null; // poolLiquidity / (buyAmount * 5)
    doubleQuoteDeviation: number | null;
    quote1Output: number | null;
    quote2Output: number | null;
  };
}

/**
 * Fetch Jupiter quote using the shared client with retry/caching
 */
async function fetchQuote(
  tokenMint: string,
  amountLamports: string,
  slippageBps: number
): Promise<{
  ok: boolean;
  outAmount: number;
  priceImpactPct: number;
  error?: string;
}> {
  const result = await fetchJupiterQuote({
    inputMint: SOL_MINT,
    outputMint: tokenMint,
    amount: amountLamports,
    slippageBps,
    timeoutMs: 8000,
  });

  if (result.ok) {
    const quote = result.quote;
    return {
      ok: true,
      outAmount: parseInt(String(quote.outAmount || '0')),
      priceImpactPct: Math.abs(parseFloat(String(quote.priceImpactPct || '0'))),
    };
  }

  return {
    ok: false,
    outAmount: 0,
    priceImpactPct: 0,
    error: result.ok === false && result.kind === 'RATE_LIMITED' ? 'RATE_LIMITED' : (result.ok === false ? result.message : 'Unknown error'),
  };
}

/**
 * Validate quote depth for the configured buy amount
 * 
 * Rules:
 * - Price impact ≤ configured slippage
 * - Output ≥ 90% of expected theoretical output
 * - Pool liquidity ≥ buyAmount × 5
 */
export async function validateQuoteDepth(input: DepthValidationInput): Promise<DepthValidationResult> {
  const rule = 'QUOTE_DEPTH';
  
  // Pump.fun uses bonding curve - depth check works differently
  if (input.isPumpFun || input.source === 'Pump.fun' || input.source === 'pumpfun' || input.source === 'PumpSwap') {
    return {
      passed: true,
      rule,
      reason: 'Pump.fun bonding curve - depth check skipped',
      penalty: 0,
      details: { priceImpact: null, outputRatio: null, liquidityRatio: null, doubleQuoteDeviation: null, quote1Output: null, quote2Output: null },
    };
  }
  
  // Check pool liquidity ≥ buyAmount × 5
  const solPriceUsd = input.solPriceUsd || 150;
  const buyAmountUsd = input.buyAmountSol * solPriceUsd;
  const requiredLiquidity = buyAmountUsd * 5;
  const liquidityRatio = input.poolLiquidityUsd / requiredLiquidity;
  
  if (input.poolLiquidityUsd < requiredLiquidity) {
    return {
      passed: false,
      rule,
      reason: `Pool liquidity $${input.poolLiquidityUsd.toFixed(0)} < required $${requiredLiquidity.toFixed(0)} (buyAmount × 5)`,
      penalty: 25,
      details: { priceImpact: null, outputRatio: null, liquidityRatio, doubleQuoteDeviation: null, quote1Output: null, quote2Output: null },
    };
  }
  
  // Fetch quote with actual buy amount
  const amountLamports = Math.floor(input.buyAmountSol * LAMPORTS_PER_SOL).toString();
  const slippageBps = Math.floor(input.maxSlippage * 10000);
  
  const quote = await fetchQuote(input.tokenAddress, amountLamports, slippageBps);
  
  if (!quote.ok) {
    // CRITICAL FIX: Don't fail on rate limits - skip check gracefully
    if (quote.error === 'RATE_LIMITED') {
      return {
        passed: true,
        rule,
        reason: `Jupiter rate limited - depth check skipped (will retry next cycle)`,
        penalty: 5,
        details: { priceImpact: null, outputRatio: null, liquidityRatio, doubleQuoteDeviation: null, quote1Output: null, quote2Output: null },
      };
    }
    return {
      passed: false,
      rule,
      reason: `Quote failed for buy amount ${input.buyAmountSol} SOL: ${quote.error}`,
      penalty: 30,
      details: { priceImpact: null, outputRatio: null, liquidityRatio, doubleQuoteDeviation: null, quote1Output: null, quote2Output: null },
    };
  }
  
  // Check price impact ≤ configured slippage
  const priceImpactDecimal = quote.priceImpactPct / 100;
  if (priceImpactDecimal > input.maxSlippage) {
    return {
      passed: false,
      rule,
      reason: `Price impact ${quote.priceImpactPct.toFixed(2)}% exceeds configured slippage ${(input.maxSlippage * 100).toFixed(1)}%`,
      penalty: 20,
      details: { priceImpact: quote.priceImpactPct, outputRatio: null, liquidityRatio, doubleQuoteDeviation: null, quote1Output: quote.outAmount, quote2Output: null },
    };
  }
  
  // Fetch a small quote to determine theoretical price, then compare
  const smallAmountLamports = Math.floor(0.001 * LAMPORTS_PER_SOL).toString();
  const smallQuote = await fetchQuote(input.tokenAddress, smallAmountLamports, slippageBps);
  
  let outputRatio = 1.0;
  if (smallQuote.ok && smallQuote.outAmount > 0) {
    // Scale up small quote to predict full buy output
    const scaleFactor = input.buyAmountSol / 0.001;
    const theoreticalOutput = smallQuote.outAmount * scaleFactor;
    outputRatio = quote.outAmount / theoreticalOutput;
    
    if (outputRatio < 0.90) {
      return {
        passed: false,
        rule,
        reason: `Output ${(outputRatio * 100).toFixed(1)}% of theoretical (< 90%) - thin liquidity`,
        penalty: 20,
        details: { priceImpact: quote.priceImpactPct, outputRatio, liquidityRatio, doubleQuoteDeviation: null, quote1Output: quote.outAmount, quote2Output: null },
      };
    }
  }
  
  return {
    passed: true,
    rule,
    reason: `Depth OK: impact ${quote.priceImpactPct.toFixed(2)}%, output ratio ${(outputRatio * 100).toFixed(1)}%, liquidity ratio ${liquidityRatio.toFixed(1)}x`,
    penalty: 0,
    details: { priceImpact: quote.priceImpactPct, outputRatio, liquidityRatio, doubleQuoteDeviation: null, quote1Output: quote.outAmount, quote2Output: null },
  };
}

/**
 * Double-quote temporal verification
 * 
 * Requests two quotes separated by 2-3 seconds.
 * Blocks if deviation > 5% (flash liquidity trap detection).
 */
export async function doubleQuoteVerification(
  tokenAddress: string,
  buyAmountSol: number,
  maxSlippage: number,
  isPumpFun?: boolean,
  source?: string
): Promise<{
  passed: boolean;
  rule: string;
  reason: string;
  penalty: number;
  deviation: number | null;
  quote1Output: number | null;
  quote2Output: number | null;
}> {
  const rule = 'DOUBLE_QUOTE';
  const MAX_DEVIATION_PERCENT = 5;
  
  // Skip for Pump.fun
  if (isPumpFun || source === 'Pump.fun' || source === 'pumpfun' || source === 'PumpSwap') {
    return { passed: true, rule, reason: 'Pump.fun - double quote skipped', penalty: 0, deviation: null, quote1Output: null, quote2Output: null };
  }
  
  const amountLamports = Math.floor(buyAmountSol * LAMPORTS_PER_SOL).toString();
  const slippageBps = Math.floor(maxSlippage * 10000);
  
  // Quote 1
  const quote1 = await fetchQuote(tokenAddress, amountLamports, slippageBps);
  if (!quote1.ok) {
    // Don't fail on rate limits
    if (quote1.error === 'RATE_LIMITED') {
      return { passed: true, rule, reason: 'Jupiter rate limited - double-quote skipped', penalty: 0, deviation: null, quote1Output: null, quote2Output: null };
    }
    return { passed: false, rule, reason: `First quote failed: ${quote1.error}`, penalty: 25, deviation: null, quote1Output: null, quote2Output: null };
  }
  
  // Wait 2-3 seconds
  await new Promise(resolve => setTimeout(resolve, 2500));
  
  // Quote 2
  const quote2 = await fetchQuote(tokenAddress, amountLamports, slippageBps);
  if (!quote2.ok) {
    return { passed: false, rule, reason: `Second quote failed: ${quote2.error}`, penalty: 25, deviation: null, quote1Output: quote1.outAmount, quote2Output: null };
  }
  
  // Calculate deviation
  const avg = (quote1.outAmount + quote2.outAmount) / 2;
  const diff = Math.abs(quote1.outAmount - quote2.outAmount);
  const deviationPercent = avg > 0 ? (diff / avg) * 100 : 0;
  
  console.log(`[DoubleQuote] ${tokenAddress.slice(0, 8)}: Q1=${quote1.outAmount}, Q2=${quote2.outAmount}, deviation=${deviationPercent.toFixed(2)}%`);
  
  if (deviationPercent > MAX_DEVIATION_PERCENT) {
    return {
      passed: false,
      rule,
      reason: `Quote deviation ${deviationPercent.toFixed(1)}% > ${MAX_DEVIATION_PERCENT}% - possible flash liquidity trap`,
      penalty: 20,
      deviation: deviationPercent,
      quote1Output: quote1.outAmount,
      quote2Output: quote2.outAmount,
    };
  }
  
  return {
    passed: true,
    rule,
    reason: `Double-quote verified: ${deviationPercent.toFixed(2)}% deviation (< ${MAX_DEVIATION_PERCENT}%)`,
    penalty: 0,
    deviation: deviationPercent,
    quote1Output: quote1.outAmount,
    quote2Output: quote2.outAmount,
  };
}
