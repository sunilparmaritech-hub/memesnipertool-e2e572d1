// Sol price endpoint - no auth required

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Cache SOL price for 30 seconds in memory
let cachedPrice: { price: number; timestamp: number } | null = null;
const CACHE_DURATION = 30000;

async function fetchSolPrice(): Promise<number | null> {
  // Check cache first
  if (cachedPrice && Date.now() - cachedPrice.timestamp < CACHE_DURATION) {
    return cachedPrice.price;
  }

  // Try multiple price sources
  const sources = [
    // CoinGecko
    async (): Promise<number | null> => {
      try {
        const res = await fetch(
          "https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd",
          { signal: AbortSignal.timeout(5000) }
        );
        if (!res.ok) return null;
        const data = await res.json();
        return data?.solana?.usd ?? null;
      } catch {
        return null;
      }
    },
    // Jupiter
    async (): Promise<number | null> => {
      try {
        const res = await fetch(
          "https://price.jup.ag/v6/price?ids=So11111111111111111111111111111111111111112",
          { signal: AbortSignal.timeout(5000) }
        );
        if (!res.ok) return null;
        const data = await res.json();
        return data?.data?.["So11111111111111111111111111111111111111112"]?.price ?? null;
      } catch {
        return null;
      }
    },
    // Binance
    async (): Promise<number | null> => {
      try {
        const res = await fetch(
          "https://api.binance.com/api/v3/ticker/price?symbol=SOLUSDT",
          { signal: AbortSignal.timeout(5000) }
        );
        if (!res.ok) return null;
        const data = await res.json();
        return data?.price ? parseFloat(data.price) : null;
      } catch {
        return null;
      }
    },
  ];

  for (const source of sources) {
    const price = await source();
    if (typeof price === "number" && price > 0 && Number.isFinite(price)) {
      cachedPrice = { price, timestamp: Date.now() };
      return price;
    }
  }

  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth is optional for price fetching - skip validation entirely
    // Price data is non-sensitive and should always be available

    const price = await fetchSolPrice();

    if (price === null) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "All price sources unavailable",
          price: 150, // Default fallback
        }),
        { 
          status: 503,
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        price,
        timestamp: Date.now(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[sol-price] Error:", error);
    return new Response(
      JSON.stringify({ 
        error: error.message || "Internal server error",
        price: 150, // Default fallback
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});
