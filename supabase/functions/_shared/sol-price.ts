/**
 * Shared SOL price utility for edge functions.
 * Fetches live SOL/USD price with caching and multiple fallback sources.
 * Replaces all hardcoded $150 estimates.
 */

let cachedPrice: { price: number; timestamp: number } | null = null;
const CACHE_DURATION_MS = 30_000; // 30 seconds
const DEFAULT_FALLBACK = 150;

export async function getLiveSolPrice(): Promise<number> {
  // Return cached value if fresh
  if (cachedPrice && Date.now() - cachedPrice.timestamp < CACHE_DURATION_MS) {
    return cachedPrice.price;
  }

  const sources: Array<() => Promise<number | null>> = [
    // CoinGecko (free, no key)
    async () => {
      const res = await fetch(
        "https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd",
        { signal: AbortSignal.timeout(4000) }
      );
      if (!res.ok) return null;
      const data = await res.json();
      return data?.solana?.usd ?? null;
    },
    // Jupiter Price API
    async () => {
      const res = await fetch(
        "https://price.jup.ag/v6/price?ids=So11111111111111111111111111111111111111112",
        { signal: AbortSignal.timeout(4000) }
      );
      if (!res.ok) return null;
      const data = await res.json();
      return data?.data?.["So11111111111111111111111111111111111111112"]?.price ?? null;
    },
    // Binance
    async () => {
      const res = await fetch(
        "https://api.binance.com/api/v3/ticker/price?symbol=SOLUSDT",
        { signal: AbortSignal.timeout(4000) }
      );
      if (!res.ok) return null;
      const data = await res.json();
      return data?.price ? parseFloat(data.price) : null;
    },
  ];

  for (const source of sources) {
    try {
      const price = await source();
      if (typeof price === "number" && price > 0 && Number.isFinite(price)) {
        cachedPrice = { price, timestamp: Date.now() };
        return price;
      }
    } catch {
      // Try next source
    }
  }

  // Return stale cache if available
  if (cachedPrice) {
    console.warn(`[sol-price] All sources failed, using stale cache: $${cachedPrice.price}`);
    return cachedPrice.price;
  }

  console.warn(`[sol-price] All sources failed, using fallback: $${DEFAULT_FALLBACK}`);
  return DEFAULT_FALLBACK;
}
