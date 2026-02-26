/**
 * Production-Grade Jupiter Quote Client
 * 
 * Features:
 * - Parallel endpoint racing (fastest wins)
 * - In-memory caching (30s TTL)
 * - Exponential backoff retry
 * - Circuit breaker pattern
 */

export type JupiterQuoteErrorKind = 'NO_ROUTE' | 'RATE_LIMITED' | 'HTTP_ERROR' | 'NETWORK_ERROR';

export type JupiterQuoteFetchResult =
  | {
      ok: true;
      quote: Record<string, unknown>;
      endpoint: string;
    }
  | {
      ok: false;
      kind: JupiterQuoteErrorKind;
      message: string;
      status?: number;
      endpoint?: string;
    };

// Configuration
const DEFAULT_TIMEOUT_MS = 8000;
const MAX_RETRIES = 2;
const BASE_DELAY_MS = 600;
const CACHE_TTL_MS = 60000; // 60s cache to reduce API calls

// Endpoints (ordered by priority - lite API is faster)
const QUOTE_ENDPOINTS = [
  'https://lite-api.jup.ag/swap/v1/quote',
  'https://quote-api.jup.ag/v6/quote',
];

// Raydium fallback endpoint
const RAYDIUM_QUOTE_URL = 'https://transaction-v1.raydium.io/compute/swap-base-in';

// In-memory cache
const quoteCache = new Map<string, { data: JupiterQuoteFetchResult; timestamp: number }>();

// Circuit breaker
let circuitOpen = false;
let circuitOpenedAt = 0;
const CIRCUIT_RESET_MS = 15000; // 15s instead of 30s - less aggressive
let consecutiveRateLimits = 0;
const CIRCUIT_OPEN_THRESHOLD = 2; // Only open after 2 consecutive full failures

/**
 * Sleep helper for retry backoff
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Fetch Jupiter quote with caching, parallel endpoints, and retry
 */
export async function fetchJupiterQuote(params: {
  inputMint: string;
  outputMint: string;
  amount: string;
  slippageBps: number;
  timeoutMs?: number;
  skipCache?: boolean;
  /** Critical operations (sells/exits) bypass circuit breaker and get extra retries */
  critical?: boolean;
}): Promise<JupiterQuoteFetchResult> {
  const {
    inputMint,
    outputMint,
    amount,
    slippageBps,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    skipCache = false,
    critical = false,
  } = params;

  const cacheKey = `${inputMint}:${outputMint}:${amount}:${slippageBps}`;

  // Check cache
  if (!skipCache) {
    const cached = quoteCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return cached.data;
    }
  }

  // Check circuit breaker - critical operations (sells) bypass it
  if (circuitOpen && !critical) {
    if (Date.now() - circuitOpenedAt > CIRCUIT_RESET_MS) {
      circuitOpen = false;
      consecutiveRateLimits = 0;
    } else {
      return {
        ok: false,
        kind: 'RATE_LIMITED',
        message: 'Rate limit circuit breaker active',
      };
    }
  }
  // Reset circuit if it expired (for critical path too)
  if (circuitOpen && Date.now() - circuitOpenedAt > CIRCUIT_RESET_MS) {
    circuitOpen = false;
    consecutiveRateLimits = 0;
  }

  let lastError: JupiterQuoteFetchResult | null = null;
  const retries = critical ? MAX_RETRIES + 2 : MAX_RETRIES; // Critical gets 5 attempts

  // Retry loop
  for (let attempt = 0; attempt < retries; attempt++) {
    if (attempt > 0) {
      const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
      await sleep(delay);
    }

    const result = await raceEndpoints({ inputMint, outputMint, amount, slippageBps, timeoutMs });

    // Success - cache and return, reset circuit breaker
    if (result.ok === true) {
      quoteCache.set(cacheKey, { data: result, timestamp: Date.now() });
      consecutiveRateLimits = 0;
      return result;
    }

    // Non-retryable error (NO_ROUTE is definitive)
    if (result.kind === 'NO_ROUTE') {
      quoteCache.set(cacheKey, { data: result, timestamp: Date.now() });
      return result;
    }

    lastError = result;

    // Only retry on rate limit
    if (result.kind !== 'RATE_LIMITED') {
      break;
    }
  }

  // All Jupiter retries exhausted - try Raydium fallback
  if (lastError && lastError.ok === false && lastError.kind === 'RATE_LIMITED') {
    console.log('[Jupiter] Rate limited, trying Raydium fallback...');
    const raydiumResult = await fetchRaydiumQuoteFallback({ inputMint, outputMint, amount, slippageBps, timeoutMs });
    if (raydiumResult.ok) {
      quoteCache.set(cacheKey, { data: raydiumResult, timestamp: Date.now() });
      consecutiveRateLimits = 0;
      return raydiumResult;
    }
  }

  const finalResult: JupiterQuoteFetchResult = lastError || {
    ok: false,
    kind: 'RATE_LIMITED',
    message: 'Jupiter rate limited after retries',
  };

  // Open circuit breaker only after repeated full failures (not on first occurrence)
  if (finalResult.ok === false && finalResult.kind === 'RATE_LIMITED') {
    consecutiveRateLimits++;
    if (consecutiveRateLimits >= CIRCUIT_OPEN_THRESHOLD) {
      circuitOpen = true;
      circuitOpenedAt = Date.now();
    }
  }

  return finalResult;
}

/**
 * Race all endpoints in parallel - fastest success wins
 */
async function raceEndpoints(params: {
  inputMint: string;
  outputMint: string;
  amount: string;
  slippageBps: number;
  timeoutMs: number;
}): Promise<JupiterQuoteFetchResult> {
  const { inputMint, outputMint, amount, slippageBps, timeoutMs } = params;

  const queryParams = new URLSearchParams({
    inputMint,
    outputMint,
    amount,
    slippageBps: String(slippageBps),
  });

  let sawRateLimit = false;

  // Create promises for all endpoints
  const promises = QUOTE_ENDPOINTS.map(async (endpoint, idx) => {
    // Slight stagger to reduce simultaneous hits
    if (idx > 0) await sleep(50 * idx);

    const url = `${endpoint}?${queryParams}`;

    const response = await fetch(url, {
      signal: AbortSignal.timeout(timeoutMs),
      headers: { Accept: 'application/json' },
    });

    if (response.status === 429) {
      sawRateLimit = true;
      throw new Error('Rate limited');
    }

    if (!response.ok) {
      if (response.status === 400 || response.status === 404) {
        const text = await response.text().catch(() => '');
        if (text.includes('No route') || text.includes('Could not find')) {
          // This is a definitive "no route" - propagate it
          return {
            ok: false as const,
            kind: 'NO_ROUTE' as const,
            status: response.status,
            endpoint,
            message: 'No route available',
          };
        }
      }
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    if (data.error) {
      if (String(data.error).toLowerCase().includes('no route')) {
        return {
          ok: false as const,
          kind: 'NO_ROUTE' as const,
          endpoint,
          message: data.error,
        };
      }
      throw new Error(data.error);
    }

    if (!data.outAmount || parseInt(data.outAmount) === 0) {
      return {
        ok: false as const,
        kind: 'NO_ROUTE' as const,
        endpoint,
        message: 'Quote returned no output',
      };
    }

    // CRITICAL: Reject quotes with extreme price impact (>50%)
    // Indicates uninitialized pool or non-functional trading pair
    const quoteImpact = parseFloat(data.priceImpactPct || '0');
    if (quoteImpact > 50) {
      return {
        ok: false as const,
        kind: 'NO_ROUTE' as const,
        endpoint,
        message: `Price impact ${quoteImpact.toFixed(1)}% — pool not properly initialized`,
      };
    }

    return { ok: true as const, quote: data, endpoint };
  });

  try {
    // Race endpoints - use allSettled and find first success
    const results = await Promise.allSettled(promises);
    
    // Find first fulfilled success result
    for (const result of results) {
      if (result.status === 'fulfilled') {
        return result.value;
      }
    }
    
    // All failed
    if (sawRateLimit) {
      return {
        ok: false,
        kind: 'RATE_LIMITED',
        message: 'Jupiter rate limited',
      };
    }

    return {
      ok: false,
      kind: 'NETWORK_ERROR',
      message: 'All endpoints failed',
    };
  } catch (error) {
    return {
      ok: false,
      kind: 'NETWORK_ERROR',
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Quick check if a token has a tradeable route
 */
export async function hasJupiterRoute(tokenMint: string): Promise<boolean> {
  const result = await fetchJupiterQuote({
    inputMint: 'So11111111111111111111111111111111111111112',
    outputMint: tokenMint,
    amount: '1000000', // 0.001 SOL
    slippageBps: 1500,
    timeoutMs: 5000,
  });
  return result.ok;
}

/**
 * Raydium quote fallback when Jupiter is rate limited
 */
async function fetchRaydiumQuoteFallback(params: {
  inputMint: string;
  outputMint: string;
  amount: string;
  slippageBps: number;
  timeoutMs: number;
}): Promise<JupiterQuoteFetchResult> {
  const { inputMint, outputMint, amount, slippageBps, timeoutMs } = params;
  try {
    const url = `${RAYDIUM_QUOTE_URL}?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=${slippageBps}&txVersion=V0`;
    const response = await fetch(url, {
      signal: AbortSignal.timeout(timeoutMs),
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      return { ok: false, kind: 'NETWORK_ERROR', message: `Raydium HTTP ${response.status}`, endpoint: 'raydium' };
    }

    const data = await response.json();
    if (!data.success || !data.data) {
      return { ok: false, kind: 'NO_ROUTE', message: data.msg || 'No Raydium route', endpoint: 'raydium' };
    }

    // Normalize to Jupiter-compatible shape
    const outAmount = String(data.data.outputAmount || data.data.outAmount || '0');
    if (!outAmount || outAmount === '0') {
      return { ok: false, kind: 'NO_ROUTE', message: 'Raydium returned no output', endpoint: 'raydium' };
    }

    return {
      ok: true,
      quote: {
        inputMint,
        outputMint,
        inAmount: amount,
        outAmount,
        priceImpactPct: String(data.data.priceImpact || '0'),
        routePlan: [{ label: 'Raydium' }],
        _source: 'raydium-fallback',
      },
      endpoint: 'raydium-fallback',
    };
  } catch {
    return { ok: false, kind: 'NETWORK_ERROR', message: 'Raydium fallback failed' };
  }
}

/**
 * Clear the quote cache
 */
export function clearJupiterCache(): void {
  quoteCache.clear();
}
