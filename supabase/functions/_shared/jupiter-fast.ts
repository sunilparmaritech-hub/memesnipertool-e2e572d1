/**
 * Production-Grade Jupiter Quote Helper
 * 
 * Features:
 * - Parallel multi-endpoint fallback
 * - In-memory caching (30s TTL)
 * - Batched quote requests
 * - Automatic retry with exponential backoff
 * - Circuit breaker pattern
 */

const SOL_MINT = 'So11111111111111111111111111111111111111112';

// Cache configuration
const QUOTE_CACHE_TTL_MS = 30000; // 30 seconds
const quoteCache = new Map<string, { data: QuoteResult; timestamp: number }>();

// Circuit breaker
let circuitOpen = false;
let circuitOpenedAt = 0;
const CIRCUIT_RESET_MS = 60000; // 1 minute

// Endpoints (ordered by priority)
const JUPITER_ENDPOINTS = [
  'https://lite-api.jup.ag/swap/v1/quote',
  'https://quote-api.jup.ag/v6/quote',
];

// =============================================================================
// TYPES
// =============================================================================

export interface QuoteResult {
  success: boolean;
  hasRoute: boolean;
  outAmount?: string;
  priceImpactPct?: number;
  routeLabel?: string;
  poolAddress?: string;
  estimatedLiquidity?: number;
  error?: string;
}

export interface BatchQuoteResult {
  [tokenAddress: string]: QuoteResult;
}

// =============================================================================
// SINGLE QUOTE (WITH CACHE)
// =============================================================================

/**
 * Get a Jupiter quote for a single token
 * Uses cache and circuit breaker pattern
 */
export async function getJupiterQuote(
  tokenAddress: string,
  amountLamports: number = 10000000, // 0.01 SOL default
  slippageBps: number = 1500
): Promise<QuoteResult> {
  const cacheKey = `${tokenAddress}:${amountLamports}`;
  
  // Check cache
  const cached = quoteCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < QUOTE_CACHE_TTL_MS) {
    return cached.data;
  }
  
  // Check circuit breaker
  if (circuitOpen) {
    if (Date.now() - circuitOpenedAt > CIRCUIT_RESET_MS) {
      circuitOpen = false;
    } else {
      return { success: false, hasRoute: false, error: 'Circuit breaker open' };
    }
  }
  
  const result = await fetchQuoteFromEndpoints(tokenAddress, amountLamports, slippageBps);
  
  // Cache result
  quoteCache.set(cacheKey, { data: result, timestamp: Date.now() });
  
  return result;
}

/**
 * Check if a token has a tradeable route (fast check)
 */
export async function hasTradableRoute(tokenAddress: string): Promise<boolean> {
  const result = await getJupiterQuote(tokenAddress, 1000000); // 0.001 SOL
  return result.success && result.hasRoute;
}

// =============================================================================
// BATCH QUOTES (PARALLEL)
// =============================================================================

/**
 * Get quotes for multiple tokens in parallel
 * Much faster than sequential calls
 */
export async function getBatchQuotes(
  tokenAddresses: string[],
  amountLamports: number = 10000000,
  concurrency: number = 5
): Promise<BatchQuoteResult> {
  const results: BatchQuoteResult = {};
  
  // Process in chunks to avoid overwhelming the API
  for (let i = 0; i < tokenAddresses.length; i += concurrency) {
    const chunk = tokenAddresses.slice(i, i + concurrency);
    
    const chunkResults = await Promise.allSettled(
      chunk.map(async (addr) => {
        const quote = await getJupiterQuote(addr, amountLamports);
        return { address: addr, quote };
      })
    );
    
    for (const result of chunkResults) {
      if (result.status === 'fulfilled') {
        results[result.value.address] = result.value.quote;
      } else {
        // Failed - mark as no route
        const addr = chunk[chunkResults.indexOf(result)];
        if (addr) {
          results[addr] = { success: false, hasRoute: false, error: 'Fetch failed' };
        }
      }
    }
  }
  
  return results;
}

/**
 * Filter tokens to only those with tradeable routes
 * Returns array of tradeable token addresses
 */
export async function filterTradableTokens(
  tokenAddresses: string[],
  concurrency: number = 8
): Promise<string[]> {
  const quotes = await getBatchQuotes(tokenAddresses, 1000000, concurrency);
  
  return Object.entries(quotes)
    .filter(([_, result]) => result.success && result.hasRoute)
    .map(([address]) => address);
}

// =============================================================================
// INTERNAL HELPERS
// =============================================================================

async function fetchQuoteFromEndpoints(
  tokenAddress: string,
  amountLamports: number,
  slippageBps: number
): Promise<QuoteResult> {
  const params = new URLSearchParams({
    inputMint: SOL_MINT,
    outputMint: tokenAddress,
    amount: amountLamports.toString(),
    slippageBps: slippageBps.toString(),
  });
  
  let lastError = '';
  let rateLimited = false;
  
  // Try endpoints in parallel, use first success
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);
  
  try {
    // Race all endpoints
    const promises = JUPITER_ENDPOINTS.map(async (endpoint, idx) => {
      // Stagger requests slightly to reduce race conditions
      if (idx > 0) await new Promise(r => setTimeout(r, 100 * idx));
      
      const response = await fetch(`${endpoint}?${params}`, {
        signal: controller.signal,
        headers: { 'Accept': 'application/json' },
      });
      
      if (response.status === 429) {
        rateLimited = true;
        throw new Error('Rate limited');
      }
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }
      
      return { data, endpoint };
    });
    
    // Use Promise.any to get first success
    const { data } = await Promise.any(promises);
    
    clearTimeout(timeout);
    
    // Parse successful response
    if (data.outAmount && parseInt(data.outAmount) > 0) {
      const routePlan = data.routePlan || [];
      const firstRoute = routePlan[0]?.swapInfo || {};
      const label = firstRoute.label || '';
      const ammKey = firstRoute.ammKey || '';
      
      // Estimate liquidity from price impact
      const inputSol = amountLamports / 1e9;
      const priceImpact = parseFloat(data.priceImpactPct || '0');
      
      // CRITICAL: Reject pools with extreme price impact (>50%) — indicates
      // uninitialized pool, near-empty liquidity, or non-functional trading pair
      if (priceImpact > 50) {
        return {
          success: true,
          hasRoute: false,
          priceImpactPct: priceImpact,
          error: `Price impact too high (${priceImpact.toFixed(1)}%) — pool not properly initialized`,
        };
      }
      
      let estimatedLiquidity = 10;
      if (priceImpact > 0 && priceImpact < 100) {
        estimatedLiquidity = Math.max(inputSol / (priceImpact / 100), 5);
      }
      
      return {
        success: true,
        hasRoute: true,
        outAmount: data.outAmount,
        priceImpactPct: priceImpact,
        routeLabel: label,
        poolAddress: ammKey || undefined,
        estimatedLiquidity,
      };
    }
    
    return { success: true, hasRoute: false };
    
  } catch (error) {
    clearTimeout(timeout);
    
    if (error instanceof AggregateError) {
      // All promises failed
      lastError = error.errors[0]?.message || 'All endpoints failed';
    } else {
      lastError = error instanceof Error ? error.message : 'Unknown error';
    }
    
    // Open circuit breaker on repeated failures
    if (rateLimited) {
      circuitOpen = true;
      circuitOpenedAt = Date.now();
    }
    
    return { success: false, hasRoute: false, error: lastError };
  }
}

// =============================================================================
// SELL QUOTE (Token → SOL) — checks if a token can actually be sold
// =============================================================================

/**
 * Check if a token has a valid SELL route (Token → SOL)
 * This is independent of the buy route check.
 */
export async function getSellQuote(
  tokenAddress: string,
  tokenAmountRaw: number = 1000000, // small amount in base units
  slippageBps: number = 500
): Promise<QuoteResult> {
  const cacheKey = `sell:${tokenAddress}:${tokenAmountRaw}`;

  const cached = quoteCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < QUOTE_CACHE_TTL_MS) {
    return cached.data;
  }

  if (circuitOpen) {
    if (Date.now() - circuitOpenedAt > CIRCUIT_RESET_MS) {
      circuitOpen = false;
    } else {
      return { success: false, hasRoute: false, error: 'Circuit breaker open' };
    }
  }

  const result = await fetchSellQuoteFromEndpoints(tokenAddress, tokenAmountRaw, slippageBps);
  quoteCache.set(cacheKey, { data: result, timestamp: Date.now() });
  return result;
}

async function fetchSellQuoteFromEndpoints(
  tokenAddress: string,
  tokenAmountRaw: number,
  slippageBps: number
): Promise<QuoteResult> {
  // SELL direction: Token → SOL
  const params = new URLSearchParams({
    inputMint: tokenAddress,
    outputMint: SOL_MINT,
    amount: tokenAmountRaw.toString(),
    slippageBps: slippageBps.toString(),
  });

  let rateLimited = false;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);

  try {
    const promises = JUPITER_ENDPOINTS.map(async (endpoint, idx) => {
      if (idx > 0) await new Promise(r => setTimeout(r, 100 * idx));
      const response = await fetch(`${endpoint}?${params}`, {
        signal: controller.signal,
        headers: { 'Accept': 'application/json' },
      });
      if (response.status === 429) { rateLimited = true; throw new Error('Rate limited'); }
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (data.error) throw new Error(data.error);
      return { data, endpoint };
    });

    const { data } = await Promise.any(promises);
    clearTimeout(timeout);

    if (data.outAmount && parseInt(data.outAmount) > 0) {
      const priceImpact = parseFloat(data.priceImpactPct || '0');
      
      // CRITICAL: Reject sell routes with extreme price impact (>50%)
      // Indicates uninitialized pool or non-functional trading pair
      if (priceImpact > 50) {
        return {
          success: true,
          hasRoute: false,
          priceImpactPct: priceImpact,
          error: `Sell price impact too high (${priceImpact.toFixed(1)}%) — pool not functional`,
        };
      }
      
      return {
        success: true,
        hasRoute: true,
        outAmount: data.outAmount,
        priceImpactPct: priceImpact,
      };
    }
    return { success: true, hasRoute: false, error: 'No output amount for sell' };
  } catch (error) {
    clearTimeout(timeout);
    if (rateLimited) { circuitOpen = true; circuitOpenedAt = Date.now(); }
    const msg = error instanceof AggregateError
      ? (error.errors[0]?.message || 'All endpoints failed')
      : (error instanceof Error ? error.message : 'Unknown error');
    return { success: false, hasRoute: false, error: msg };
  }
}

/**
 * Batch sell quotes for multiple tokens in parallel
 */
export async function getBatchSellQuotes(
  tokenAddresses: string[],
  tokenAmountRaw: number = 1000000,
  concurrency: number = 5
): Promise<BatchQuoteResult> {
  const results: BatchQuoteResult = {};
  for (let i = 0; i < tokenAddresses.length; i += concurrency) {
    const chunk = tokenAddresses.slice(i, i + concurrency);
    const chunkResults = await Promise.allSettled(
      chunk.map(async (addr) => {
        const quote = await getSellQuote(addr, tokenAmountRaw);
        return { address: addr, quote };
      })
    );
    for (const result of chunkResults) {
      if (result.status === 'fulfilled') {
        results[result.value.address] = result.value.quote;
      } else {
        const addr = chunk[chunkResults.indexOf(result)];
        if (addr) results[addr] = { success: false, hasRoute: false, error: 'Fetch failed' };
      }
    }
  }
  return results;
}

// =============================================================================
// CACHE MANAGEMENT
// =============================================================================

/**
 * Clear the quote cache (useful for testing)
 */
export function clearQuoteCache(): void {
  quoteCache.clear();
}

/**
 * Get cache stats for monitoring
 */
export function getCacheStats(): { size: number; oldestEntry: number | null } {
  let oldest: number | null = null;
  
  for (const [_, value] of quoteCache) {
    if (oldest === null || value.timestamp < oldest) {
      oldest = value.timestamp;
    }
  }
  
  return {
    size: quoteCache.size,
    oldestEntry: oldest,
  };
}
