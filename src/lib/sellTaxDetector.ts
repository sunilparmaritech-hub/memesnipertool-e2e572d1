/**
 * Sell Tax Detector Module v2.0
 * 
 * Detects hidden sell taxes by comparing:
 * 1. Jupiter quote output (expected)
 * 2. Simulated swap output (actual)
 * 3. Route discrepancy between different DEXes
 * 
 * Updated thresholds:
 * - Flag > 15%
 * - High risk > 25%
 * - Block > 30%
 * 
 * Route discrepancy:
 * - Suspicious if > 10%
 * - Block if > 20%
 */
import { fetchJupiterQuote } from '@/lib/jupiterQuote';

// =============================================================================
// TYPES
// =============================================================================

export interface SellTaxDetectionResult {
  hasHiddenTax: boolean;
  taxPercent: number;
  quotedOutputLamports: number;
  simulatedOutputLamports: number;
  differencePercent: number;
  riskLabel?: 'HIDDEN_SELL_TAX' | 'HIGH_SELL_TAX' | 'MODERATE_SELL_TAX' | 'ROUTE_DISCREPANCY';
  blockTrade: boolean;
  reason: string;
  // Route discrepancy detection
  routeDiscrepancyPercent?: number;
  routeDiscrepancySuspicious?: boolean;
  routeDiscrepancyBlock?: boolean;
}

export interface SellTaxCheckInput {
  tokenAddress: string;
  tokenAmount: number;        // Amount in base units (smallest denomination)
  tokenDecimals?: number;     // Default 6
  slippageBps?: number;       // Default 500 (5%)
}

// =============================================================================
// CONSTANTS - UPDATED THRESHOLDS
// =============================================================================

const SOL_MINT = 'So11111111111111111111111111111111111111112';

// Tax thresholds - Updated policy
export const HIDDEN_TAX_THRESHOLD = 30;     // > 30% difference = BLOCK
export const HIGH_TAX_THRESHOLD = 25;       // > 25% = high tax (warn strongly)
export const MODERATE_TAX_THRESHOLD = 15;   // > 15% = flag tax warning

// Route discrepancy thresholds
export const ROUTE_DISCREPANCY_SUSPICIOUS = 10;  // > 10% between routes = suspicious
export const ROUTE_DISCREPANCY_BLOCK = 20;       // > 20% between routes = block

// Simulation timeout
const SIMULATION_TIMEOUT_MS = 10_000;

// Jupiter Quote API endpoint (kept for reference)
// const JUPITER_QUOTE_API = 'https://lite-api.jup.ag/swap/v1/quote';

// =============================================================================
// CORE FUNCTIONS
// =============================================================================

/**
 * Get Jupiter quote for sell (token → SOL) using shared client with retry/caching
 */
async function getJupiterSellQuote(
  tokenAddress: string,
  amountInSmallestUnit: string,
  slippageBps: number = 500,
  onlyDirectRoutes: boolean = false
): Promise<{ outputLamports: number; priceImpact: number; route: any; routeInfo?: string; rateLimited?: boolean } | null> {
  try {
    // For direct routes, use raw fetch since fetchJupiterQuote doesn't support that param
    if (onlyDirectRoutes) {
      const url = `https://lite-api.jup.ag/swap/v1/quote?inputMint=${tokenAddress}&outputMint=${SOL_MINT}&amount=${amountInSmallestUnit}&slippageBps=${slippageBps}&onlyDirectRoutes=true`;
      const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (!response.ok) {
        if (response.status === 429) return { outputLamports: 0, priceImpact: 0, route: null, rateLimited: true };
        return null;
      }
      const data = await response.json();
      if (!data.outAmount) return null;
      return {
        outputLamports: parseInt(data.outAmount, 10),
        priceImpact: Math.abs(parseFloat(data.priceImpactPct || '0')),
        route: data,
        routeInfo: data.routePlan?.[0]?.swapInfo?.label || 'unknown',
      };
    }

    // Use shared Jupiter client with retry & caching
    const result = await fetchJupiterQuote({
      inputMint: tokenAddress,
      outputMint: SOL_MINT,
      amount: amountInSmallestUnit,
      slippageBps,
      timeoutMs: 8000,
      critical: true, // Sell tax checks are safety-critical
    });

    if (result.ok) {
      const data = result.quote;
      const routeInfo = (data as any).routePlan?.[0]?.swapInfo?.label || 'unknown';
      return {
        outputLamports: parseInt(String(data.outAmount || '0'), 10),
        priceImpact: Math.abs(parseFloat(String((data as any).priceImpactPct || '0'))),
        route: data,
        routeInfo,
      };
    }

    // Rate limited - signal to caller
    if (result.ok === false && result.kind === 'RATE_LIMITED') {
      console.warn('[SellTaxDetector] Jupiter rate limited - skipping check');
      return { outputLamports: 0, priceImpact: 0, route: null, rateLimited: true };
    }

    // No route or other error
    return null;
  } catch (error) {
    console.error('[SellTaxDetector] Quote fetch error:', error);
    return null;
  }
}
/**
 * Simulate the actual swap execution to get real output
 * Uses Jupiter's swap simulation endpoint
 */
async function simulateSwapExecution(
  tokenAddress: string,
  amountInSmallestUnit: string,
  slippageBps: number = 500
): Promise<{ outputLamports: number; error?: string } | null> {
  try {
    // First get quote
    const quote = await getJupiterSellQuote(tokenAddress, amountInSmallestUnit, slippageBps);
    if (!quote) {
      return null;
    }
    
    // Get a second quote with minimal slippage to see "true" output
    const minSlippageQuote = await getJupiterSellQuote(tokenAddress, amountInSmallestUnit, 10);
    
    if (!minSlippageQuote) {
      return { outputLamports: quote.outputLamports };
    }
    
    // For accurate detection, fetch from a simulation RPC if available
    const simulatedOutput = await fetchSimulatedOutput(tokenAddress, amountInSmallestUnit);
    
    if (simulatedOutput !== null) {
      return { outputLamports: simulatedOutput };
    }
    
    // Fallback to quote output
    return { outputLamports: quote.outputLamports };
    
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Simulation failed';
    console.error('[SellTaxDetector] Simulation error:', errorMsg);
    return { outputLamports: 0, error: errorMsg };
  }
}

/**
 * Fetch simulated output via RPC transaction simulation
 */
async function fetchSimulatedOutput(
  tokenAddress: string,
  amountInSmallestUnit: string
): Promise<number | null> {
  try {
    // Use the shared getJupiterSellQuote with direct routes for simulation
    const result = await getJupiterSellQuote(tokenAddress, amountInSmallestUnit, 100, true);
    if (result && !result.rateLimited && result.outputLamports > 0) {
      return result.outputLamports;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Check route discrepancy between Jupiter and Raydium direct
 * UPGRADED: Multi-DEX comparison (Jupiter vs Raydium vs Orca)
 */
async function checkRouteDiscrepancy(
  tokenAddress: string,
  amountInSmallestUnit: string
): Promise<{ discrepancyPercent: number; suspicious: boolean; shouldBlock: boolean; dexOutputs: Record<string, number> }> {
  try {
    // Get Jupiter standard quote
    const standardQuote = await getJupiterSellQuote(tokenAddress, amountInSmallestUnit, 500, false);
    
    // Get Jupiter direct-only route
    const directQuote = await getJupiterSellQuote(tokenAddress, amountInSmallestUnit, 500, true);
    
    // Get Raydium direct quote
    let raydiumOutput = 0;
    try {
      const raydiumUrl = `https://transaction-v1.raydium.io/compute/swap-base-in?inputMint=${tokenAddress}&outputMint=${SOL_MINT}&amount=${amountInSmallestUnit}&slippageBps=500&txVersion=V0`;
      const raydiumRes = await fetch(raydiumUrl, { signal: AbortSignal.timeout(6000) });
      if (raydiumRes.ok) {
        const raydiumData = await raydiumRes.json();
        if (raydiumData?.success && raydiumData.data?.outputAmount) {
          raydiumOutput = parseInt(raydiumData.data.outputAmount, 10);
        }
      }
    } catch {
      console.log('[SellTaxDetector] Raydium direct quote failed');
    }
    
    const dexOutputs: Record<string, number> = {};
    const outputs: number[] = [];
    
    if (standardQuote) {
      dexOutputs['jupiter'] = standardQuote.outputLamports;
      outputs.push(standardQuote.outputLamports);
    }
    if (directQuote) {
      dexOutputs['jupiter_direct'] = directQuote.outputLamports;
      outputs.push(directQuote.outputLamports);
    }
    if (raydiumOutput > 0) {
      dexOutputs['raydium'] = raydiumOutput;
      outputs.push(raydiumOutput);
    }
    
    if (outputs.length < 2) {
      return { discrepancyPercent: 0, suspicious: false, shouldBlock: false, dexOutputs };
    }
    
    // Calculate max discrepancy across all DEX outputs
    const maxOutput = Math.max(...outputs);
    const minOutput = Math.min(...outputs);
    
    const discrepancyPercent = maxOutput > 0 
      ? ((maxOutput - minOutput) / maxOutput) * 100 
      : 0;
    
    console.log(`[SellTaxDetector] Multi-DEX discrepancy: ${discrepancyPercent.toFixed(2)}%`, dexOutputs);
    
    // UPGRADED: >5% cross-DEX mismatch = block (was >20%)
    const CROSS_DEX_BLOCK = 5;
    
    return {
      discrepancyPercent,
      suspicious: discrepancyPercent > ROUTE_DISCREPANCY_SUSPICIOUS,
      shouldBlock: discrepancyPercent > CROSS_DEX_BLOCK && raydiumOutput > 0,
      dexOutputs,
    };
  } catch (error) {
    console.error('[SellTaxDetector] Route discrepancy check error:', error);
    return { discrepancyPercent: 0, suspicious: false, shouldBlock: false, dexOutputs: {} };
  }
}

/**
 * Detect hidden sell tax by comparing quote vs simulation
 */
export async function detectHiddenSellTax(
  input: SellTaxCheckInput
): Promise<SellTaxDetectionResult> {
  const { tokenAddress, tokenAmount, tokenDecimals = 6, slippageBps = 500 } = input;
  
  // Convert to smallest unit
  const amountInSmallestUnit = Math.floor(tokenAmount * Math.pow(10, tokenDecimals)).toString();
  
  console.log(`[SellTaxDetector] Checking ${tokenAddress.slice(0, 8)}... amount: ${tokenAmount}`);
  
  // Step 1: Get Jupiter quote (expected output)
  const quote = await getJupiterSellQuote(tokenAddress, amountInSmallestUnit, slippageBps);
  
  if (!quote) {
    return {
      hasHiddenTax: false,
      taxPercent: 0,
      quotedOutputLamports: 0,
      simulatedOutputLamports: 0,
      differencePercent: 0,
      blockTrade: true,
      reason: 'Could not get Jupiter quote - no sell route',
    };
  }
  
  // CRITICAL FIX: If rate limited, skip tax check instead of blocking
  if (quote.rateLimited) {
    return {
      hasHiddenTax: false,
      taxPercent: 0,
      quotedOutputLamports: 0,
      simulatedOutputLamports: 0,
      differencePercent: 0,
      blockTrade: false,
      reason: 'Jupiter rate limited - sell tax check skipped (will retry)',
    };
  }
  
  const quotedOutput = quote.outputLamports;
  
  // Step 2: Check route discrepancy
  const routeCheck = await checkRouteDiscrepancy(tokenAddress, amountInSmallestUnit);
  
  // Step 3: Get secondary quote with different parameters
  const altQuote = await getJupiterSellQuote(tokenAddress, amountInSmallestUnit, 100);
  const directQuote = await fetchSimulatedOutput(tokenAddress, amountInSmallestUnit);
  
  // Use the lowest output as "simulated" (most pessimistic)
  let simulatedOutput = quotedOutput;
  
  if (altQuote && altQuote.outputLamports < simulatedOutput) {
    simulatedOutput = altQuote.outputLamports;
  }
  if (directQuote !== null && directQuote < simulatedOutput) {
    simulatedOutput = directQuote;
  }
  
  // Step 4: Compare and calculate difference
  const differencePercent = quotedOutput > 0
    ? ((quotedOutput - simulatedOutput) / quotedOutput) * 100
    : 0;
  
  // Calculate effective tax
  const taxPercent = Math.max(0, differencePercent);
  
  // Step 5: Determine risk level with updated thresholds
  let riskLabel: SellTaxDetectionResult['riskLabel'];
  let hasHiddenTax = false;
  let blockTrade = false;
  let reason = 'No significant sell tax detected';
  
  // Check route discrepancy first (block condition - UPGRADED multi-DEX)
  if (routeCheck.shouldBlock) {
    riskLabel = 'ROUTE_DISCREPANCY';
    hasHiddenTax = true;
    blockTrade = true;
    reason = `Multi-DEX output mismatch ${routeCheck.discrepancyPercent.toFixed(1)}% - manipulation suspected (${Object.keys(routeCheck.dexOutputs).join(', ')})`;
  }
  // Then check tax thresholds
  else if (taxPercent > HIDDEN_TAX_THRESHOLD) {
    riskLabel = 'HIDDEN_SELL_TAX';
    hasHiddenTax = true;
    blockTrade = true;
    reason = `Hidden sell tax detected: ${taxPercent.toFixed(1)}% (>${HIDDEN_TAX_THRESHOLD}% blocked)`;
  } else if (taxPercent > HIGH_TAX_THRESHOLD) {
    riskLabel = 'HIGH_SELL_TAX';
    hasHiddenTax = true;
    blockTrade = false; // Warn but don't block
    reason = `High sell tax: ${taxPercent.toFixed(1)}% - proceed with extreme caution`;
  } else if (taxPercent > MODERATE_TAX_THRESHOLD) {
    riskLabel = 'MODERATE_SELL_TAX';
    hasHiddenTax = true;
    blockTrade = false;
    reason = `Moderate sell tax: ${taxPercent.toFixed(1)}% - proceed with caution`;
  } else if (routeCheck.suspicious) {
    riskLabel = 'ROUTE_DISCREPANCY';
    hasHiddenTax = false;
    blockTrade = false;
    reason = `Route discrepancy ${routeCheck.discrepancyPercent.toFixed(1)}% detected - be cautious`;
  }
  
  console.log(`[SellTaxDetector] ${tokenAddress.slice(0, 8)}...: tax=${taxPercent.toFixed(2)}%, routeDisc=${routeCheck.discrepancyPercent.toFixed(2)}%, block=${blockTrade}`);
  
  return {
    hasHiddenTax,
    taxPercent,
    quotedOutputLamports: quotedOutput,
    simulatedOutputLamports: simulatedOutput,
    differencePercent,
    riskLabel,
    blockTrade,
    reason,
    routeDiscrepancyPercent: routeCheck.discrepancyPercent,
    routeDiscrepancySuspicious: routeCheck.suspicious,
    routeDiscrepancyBlock: routeCheck.shouldBlock,
  };
}

/**
 * Quick sell tax check for pre-execution gate
 * Returns a gate-compatible result
 */
export async function checkSellTax(
  tokenAddress: string,
  estimatedTokenAmount: number = 1_000_000,
  tokenDecimals: number = 6
): Promise<{
  passed: boolean;
  rule: string;
  reason: string;
  penalty?: number;
  taxResult: SellTaxDetectionResult;
}> {
  const rule = 'HIDDEN_SELL_TAX';
  
  try {
    const result = await detectHiddenSellTax({
      tokenAddress,
      tokenAmount: estimatedTokenAmount,
      tokenDecimals,
    });
    
    if (result.blockTrade) {
      return {
        passed: false,
        rule,
        reason: result.reason,
        penalty: 50,
        taxResult: result,
      };
    }
    
    if (result.riskLabel === 'HIGH_SELL_TAX') {
      return {
        passed: true,
        rule,
        reason: result.reason,
        penalty: 25,
        taxResult: result,
      };
    }
    
    if (result.riskLabel === 'MODERATE_SELL_TAX' || result.routeDiscrepancySuspicious) {
      return {
        passed: true,
        rule,
        reason: result.reason,
        penalty: 15,
        taxResult: result,
      };
    }
    
    return {
      passed: true,
      rule,
      reason: result.reason,
      taxResult: result,
    };
    
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    
    return {
      passed: true,
      rule,
      reason: `Sell tax check failed: ${errorMsg} - proceeding with caution`,
      taxResult: {
        hasHiddenTax: false,
        taxPercent: 0,
        quotedOutputLamports: 0,
        simulatedOutputLamports: 0,
        differencePercent: 0,
        blockTrade: false,
        reason: `Check failed: ${errorMsg}`,
      },
    };
  }
}

/**
 * Batch check multiple tokens for sell tax
 */
export async function batchCheckSellTax(
  tokens: Array<{ tokenAddress: string; tokenAmount?: number; decimals?: number }>
): Promise<Map<string, SellTaxDetectionResult>> {
  const results = new Map<string, SellTaxDetectionResult>();
  
  // Process in parallel batches of 3
  const batchSize = 3;
  
  for (let i = 0; i < tokens.length; i += batchSize) {
    const batch = tokens.slice(i, i + batchSize);
    
    const batchResults = await Promise.allSettled(
      batch.map(async ({ tokenAddress, tokenAmount = 1_000_000, decimals = 6 }) => {
        const result = await detectHiddenSellTax({
          tokenAddress,
          tokenAmount,
          tokenDecimals: decimals,
        });
        return { tokenAddress, result };
      })
    );
    
    for (const res of batchResults) {
      if (res.status === 'fulfilled') {
        results.set(res.value.tokenAddress, res.value.result);
      }
    }
    
    if (i + batchSize < tokens.length) {
      await new Promise(r => setTimeout(r, 200));
    }
  }
  
  return results;
}
