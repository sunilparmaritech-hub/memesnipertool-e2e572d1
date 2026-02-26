/**
 * Per-User Rate Limiter for Edge Functions
 * 
 * Uses in-memory sliding window to prevent API quota exhaustion
 * from malfunctioning clients or attackers.
 * 
 * NOTE: In-memory limits reset on function cold starts.
 * For persistent rate limiting, use database-backed approach.
 */

interface RateLimitEntry {
  timestamps: number[];
}

// In-memory store (per Deno isolate)
const userLimits = new Map<string, RateLimitEntry>();

// Cleanup stale entries every 5 minutes
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
let lastCleanup = Date.now();

function cleanupStaleEntries(windowMs: number): void {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;
  
  const cutoff = now - windowMs;
  for (const [key, entry] of userLimits.entries()) {
    entry.timestamps = entry.timestamps.filter(t => t > cutoff);
    if (entry.timestamps.length === 0) {
      userLimits.delete(key);
    }
  }
}

export interface RateLimitConfig {
  /** Maximum requests per window */
  maxRequests: number;
  /** Window size in milliseconds */
  windowMs: number;
  /** Function name for namespacing */
  functionName: string;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetMs: number;
}

/**
 * Check if a user is within their rate limit
 */
export function checkRateLimit(
  userId: string,
  config: RateLimitConfig
): RateLimitResult {
  const now = Date.now();
  const key = `${config.functionName}:${userId}`;
  
  cleanupStaleEntries(config.windowMs);
  
  let entry = userLimits.get(key);
  if (!entry) {
    entry = { timestamps: [] };
    userLimits.set(key, entry);
  }
  
  // Remove expired timestamps
  const cutoff = now - config.windowMs;
  entry.timestamps = entry.timestamps.filter(t => t > cutoff);
  
  const remaining = Math.max(0, config.maxRequests - entry.timestamps.length);
  const oldestInWindow = entry.timestamps.length > 0 ? entry.timestamps[0] : now;
  const resetMs = oldestInWindow + config.windowMs - now;
  
  if (entry.timestamps.length >= config.maxRequests) {
    return { allowed: false, remaining: 0, resetMs };
  }
  
  // Record this request
  entry.timestamps.push(now);
  
  return { allowed: true, remaining: remaining - 1, resetMs };
}

/**
 * Create a rate-limited response with proper headers
 */
export function rateLimitResponse(
  result: RateLimitResult,
  corsHeaders: Record<string, string>
): Response {
  return new Response(
    JSON.stringify({
      error: 'Rate limit exceeded',
      retryAfterMs: result.resetMs,
    }),
    {
      status: 429,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Retry-After': Math.ceil(result.resetMs / 1000).toString(),
        'X-RateLimit-Remaining': result.remaining.toString(),
      },
    }
  );
}

// =============================================================================
// PRESET CONFIGURATIONS
// =============================================================================

/** Auto-sniper: 10 requests per 30 seconds per user */
export const AUTO_SNIPER_LIMIT: RateLimitConfig = {
  maxRequests: 10,
  windowMs: 30_000,
  functionName: 'auto-sniper',
};

/** Token scanner: 20 requests per 60 seconds per user */
export const TOKEN_SCANNER_LIMIT: RateLimitConfig = {
  maxRequests: 20,
  windowMs: 60_000,
  functionName: 'token-scanner',
};

/** Trade execution: 5 requests per 30 seconds per user */
export const TRADE_EXECUTION_LIMIT: RateLimitConfig = {
  maxRequests: 5,
  windowMs: 30_000,
  functionName: 'trade-execution',
};

/** Sol price: 30 requests per 60 seconds per user */
export const SOL_PRICE_LIMIT: RateLimitConfig = {
  maxRequests: 30,
  windowMs: 60_000,
  functionName: 'sol-price',
};

/** Generic: 15 requests per 60 seconds */
export const GENERIC_LIMIT: RateLimitConfig = {
  maxRequests: 15,
  windowMs: 60_000,
  functionName: 'generic',
};
