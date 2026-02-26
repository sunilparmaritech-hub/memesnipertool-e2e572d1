/**
 * Smart Validation Cache
 * 
 * Tiered TTL caching for token validation data to reduce external API calls.
 * All data cached in-memory with configurable TTLs per data type.
 * 
 * Cache keys:
 * - token:{mint}:liquidity    → 15 seconds
 * - token:{mint}:holders      → 60 seconds
 * - token:{mint}:volume       → 30 seconds
 * - token:{mint}:security     → 120 seconds
 * - deployer:{wallet}:profile → 10 minutes
 * - token:{mint}:preRisk      → 30 seconds
 * - token:{mint}:birdeye      → 60 seconds
 */

// =============================================================================
// TYPES
// =============================================================================

export interface CacheEntry<T> {
  data: T;
  cachedAt: number;
  expiresAt: number;
  source: string;
}

export type CacheCategory = 
  | 'liquidity'
  | 'holders'
  | 'volume'
  | 'security'
  | 'deployer'
  | 'preRisk'
  | 'birdeye'
  | 'structural';

const CACHE_TTL_MS: Record<CacheCategory, number> = {
  liquidity: 15_000,      // 15 seconds
  holders: 60_000,        // 60 seconds
  volume: 30_000,         // 30 seconds
  security: 120_000,      // 2 minutes
  deployer: 600_000,      // 10 minutes
  preRisk: 30_000,        // 30 seconds
  birdeye: 60_000,        // 60 seconds (increased from 15s)
  structural: 120_000,    // 2 minutes
};

const MAX_CACHE_SIZE = 500;

// =============================================================================
// CACHE STORE
// =============================================================================

const store = new Map<string, CacheEntry<unknown>>();

// Stats tracking
let stats = {
  hits: 0,
  misses: 0,
  sets: 0,
  evictions: 0,
};

function makeKey(category: CacheCategory, identifier: string): string {
  return `${category}:${identifier}`;
}

// =============================================================================
// PUBLIC API
// =============================================================================

/**
 * Get cached value if not expired
 */
export function cacheGet<T>(category: CacheCategory, identifier: string): T | null {
  const key = makeKey(category, identifier);
  const entry = store.get(key);
  
  if (!entry) {
    stats.misses++;
    return null;
  }
  
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    stats.misses++;
    return null;
  }
  
  stats.hits++;
  return entry.data as T;
}

/**
 * Set cache value with category-based TTL
 */
export function cacheSet<T>(
  category: CacheCategory, 
  identifier: string, 
  data: T, 
  source: string = 'unknown'
): void {
  const key = makeKey(category, identifier);
  const ttl = CACHE_TTL_MS[category];
  
  store.set(key, {
    data,
    cachedAt: Date.now(),
    expiresAt: Date.now() + ttl,
    source,
  });
  
  stats.sets++;
  
  // Prune if over max size
  if (store.size > MAX_CACHE_SIZE) {
    pruneExpired();
    // If still over, remove oldest entries
    if (store.size > MAX_CACHE_SIZE) {
      const entries = Array.from(store.entries());
      entries.sort((a, b) => a[1].cachedAt - b[1].cachedAt);
      const toRemove = entries.slice(0, store.size - MAX_CACHE_SIZE + 50);
      for (const [k] of toRemove) {
        store.delete(k);
        stats.evictions++;
      }
    }
  }
}

/**
 * Check if a value exists and is not expired
 */
export function cacheHas(category: CacheCategory, identifier: string): boolean {
  return cacheGet(category, identifier) !== null;
}

/**
 * Remove a specific cache entry
 */
export function cacheDelete(category: CacheCategory, identifier: string): void {
  store.delete(makeKey(category, identifier));
}

/**
 * Clear all entries for a category
 */
export function cacheClearCategory(category: CacheCategory): void {
  const prefix = `${category}:`;
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) {
      store.delete(key);
    }
  }
}

/**
 * Clear entire cache
 */
export function cacheClearAll(): void {
  store.clear();
  stats = { hits: 0, misses: 0, sets: 0, evictions: 0 };
}

/**
 * Get cache statistics
 */
export function getCacheStats(): {
  size: number;
  hits: number;
  misses: number;
  sets: number;
  evictions: number;
  hitRate: number;
} {
  const total = stats.hits + stats.misses;
  return {
    size: store.size,
    ...stats,
    hitRate: total > 0 ? (stats.hits / total) * 100 : 0,
  };
}

/**
 * Remove expired entries
 */
function pruneExpired(): void {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now > entry.expiresAt) {
      store.delete(key);
      stats.evictions++;
    }
  }
}

// Auto-prune every 30 seconds
if (typeof window !== 'undefined') {
  setInterval(pruneExpired, 30_000);
}
