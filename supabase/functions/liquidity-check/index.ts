/**
 * Production-Grade Liquidity Check
 * 
 * Streamlined tradability verification:
 * 1. Pump.fun bonding curve check (fast)
 * 2. Jupiter route validation (authoritative)
 * 3. DexScreener enrichment (optional, cached)
 * 
 * Optimizations:
 * - Reduced timeout values
 * - In-memory DexScreener cache
 * - Early exit on success
 * - Parallel endpoint racing
 */

import { getJupiterQuote, type QuoteResult } from "../_shared/jupiter-fast.ts";
import { checkRateLimit, rateLimitResponse, GENERIC_LIMIT } from "../_shared/rate-limiter.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const SOL_MINT = 'So11111111111111111111111111111111111111112';

// DexScreener cache (permanent per instance)
const dexCache = new Map<string, { found: boolean; timestamp: number }>();
const CACHE_TTL_MS = 120000; // 2 minutes

// =============================================================================
// TYPES
// =============================================================================

interface LiquidityCheckRequest {
  tokenAddress: string;
  minLiquidity?: number;
  poolAddress?: string;
}

type TokenStage = 'BONDING' | 'LP_LIVE' | 'INDEXING' | 'LISTED';

interface LiquidityCheckResponse {
  status: 'TRADABLE' | 'DISCARDED';
  source?: 'pump_fun' | 'jupiter' | 'raydium' | 'orca';
  dexId?: string;
  poolAddress?: string;
  baseMint?: string;
  quoteMint?: string;
  liquidity?: number;
  tokenName?: string;
  tokenSymbol?: string;
  reason?: string;
  tokenStatus?: {
    tradable: boolean;
    stage: TokenStage;
    dexScreener: { pairFound: boolean };
  };
}

// =============================================================================
// MAIN HANDLER
// =============================================================================

const LIQUIDITY_LIMIT = { ...GENERIC_LIMIT, maxRequests: 20, windowMs: 60_000, functionName: 'liquidity-check' };

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const authHeader = req.headers.get('Authorization') || '';
    const rateLimitKey = authHeader.replace('Bearer ', '').slice(0, 20) || 'anon';
    const rl = checkRateLimit(rateLimitKey, LIQUIDITY_LIMIT);
    if (!rl.allowed) return rateLimitResponse(rl, corsHeaders);
    const { tokenAddress, minLiquidity = 5, poolAddress }: LiquidityCheckRequest = await req.json();

    if (!tokenAddress) {
      return new Response(
        JSON.stringify({ error: 'tokenAddress is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[LiquidityCheck] Checking ${tokenAddress.slice(0, 8)}...`);

    // PRIORITY 1: Pump.fun bonding curve (fastest check)
    const pumpResult = await checkPumpFun(tokenAddress);
    if (pumpResult.status === 'TRADABLE') {
      console.log(`[LiquidityCheck] ✅ Pump.fun BONDING (${Date.now() - startTime}ms)`);
      return new Response(
        JSON.stringify({
          ...pumpResult,
          tokenStatus: {
            tradable: true,
            stage: 'BONDING',
            dexScreener: { pairFound: false },
          },
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // PRIORITY 2: Jupiter route (authoritative tradability)
    const jupiterResult = await getJupiterQuote(tokenAddress, 10000000, 1500);
    
    if (!jupiterResult.success || !jupiterResult.hasRoute) {
      console.log(`[LiquidityCheck] ❌ No route (${Date.now() - startTime}ms)`);
      return new Response(
        JSON.stringify({
          status: 'DISCARDED',
          reason: jupiterResult.error || 'No tradeable route',
          tokenStatus: {
            tradable: false,
            stage: 'LP_LIVE',
            dexScreener: { pairFound: false },
          },
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Token is tradable via Jupiter
    const finalPoolAddress = jupiterResult.poolAddress || poolAddress || 'jupiter_route';
    
    // Optional: DexScreener enrichment (cached, non-blocking)
    const dexFound = await checkDexScreenerCached(finalPoolAddress);
    const stage: TokenStage = dexFound ? 'LISTED' : 'INDEXING';

    // Determine source DEX from Jupiter route
    let source: 'jupiter' | 'raydium' | 'orca' = 'jupiter';
    let dexId = 'jupiter';
    const label = jupiterResult.routeLabel?.toLowerCase() || '';
    
    if (label.includes('raydium')) {
      source = 'raydium';
      dexId = 'raydium';
    } else if (label.includes('orca')) {
      source = 'orca';
      dexId = 'orca';
    }

    console.log(`[LiquidityCheck] ✅ ${dexId} ${stage} (${Date.now() - startTime}ms)`);

    return new Response(
      JSON.stringify({
        status: 'TRADABLE',
        source,
        dexId,
        poolAddress: finalPoolAddress,
        baseMint: SOL_MINT,
        quoteMint: tokenAddress,
        liquidity: jupiterResult.estimatedLiquidity || 10,
        tokenStatus: {
          tradable: true,
          stage,
          dexScreener: { pairFound: dexFound },
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal error';
    console.error('[LiquidityCheck] Error:', message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// =============================================================================
// PUMP.FUN CHECK
// =============================================================================

async function checkPumpFun(tokenAddress: string): Promise<LiquidityCheckResponse> {
  try {
    const response = await fetch(
      `https://frontend-api.pump.fun/coins/${tokenAddress}`,
      {
        signal: AbortSignal.timeout(5000),
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'MemeSniper/2.0',
        },
      }
    );

    if (!response.ok) {
      return { status: 'DISCARDED', reason: `Pump.fun: ${response.status}` };
    }

    const data = await response.json();

    if (data?.mint === tokenAddress && data.complete === false) {
      const virtualSolReserves = data.virtual_sol_reserves || 0;
      const liquidityInSol = virtualSolReserves / 1e9;

      return {
        status: 'TRADABLE',
        source: 'pump_fun',
        dexId: 'pumpfun',
        poolAddress: 'pumpfun_bonding_curve',
        baseMint: SOL_MINT,
        quoteMint: tokenAddress,
        liquidity: liquidityInSol > 0 ? liquidityInSol : 30,
        tokenName: data.name,
        tokenSymbol: data.symbol,
      };
    }

    return { status: 'DISCARDED', reason: 'Not on Pump.fun curve' };
  } catch {
    return { status: 'DISCARDED', reason: 'Pump.fun unavailable' };
  }
}

// =============================================================================
// DEXSCREENER CACHE CHECK
// =============================================================================

async function checkDexScreenerCached(poolAddress: string): Promise<boolean> {
  if (!poolAddress || poolAddress === 'jupiter_route') return false;
  
  // Check cache
  const cached = dexCache.get(poolAddress);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.found;
  }

  try {
    const response = await fetch(
      `https://api.dexscreener.com/latest/dex/pairs/solana/${poolAddress}`,
      {
        signal: AbortSignal.timeout(2000),
        headers: { 'Accept': 'application/json' },
      }
    );

    if (!response.ok) {
      dexCache.set(poolAddress, { found: false, timestamp: Date.now() });
      return false;
    }

    const data = await response.json();
    const found = !!(data.pair || data.pairs?.length);
    
    dexCache.set(poolAddress, { found, timestamp: Date.now() });
    return found;
  } catch {
    dexCache.set(poolAddress, { found: false, timestamp: Date.now() });
    return false;
  }
}
