/**
 * Token Holders Edge Function v2
 * 
 * Fetches REAL holder count using multiple strategies:
 * 1. Helius DAS API (most accurate, requires API key)
 * 2. Helius getTokenAccounts (accurate count via enhanced RPC)
 * 3. Standard RPC getTokenLargestAccounts (fallback, capped at 20)
 * 
 * IMPORTANT: Standard RPC only returns top 20 holders, so we use
 * Helius DAS API for accurate counts when available.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.90.1";
import { getApiKey } from "../_shared/api-keys.ts";
import { checkRateLimit, rateLimitResponse, GENERIC_LIMIT } from "../_shared/rate-limiter.ts";

const HOLDER_LIMIT = { ...GENERIC_LIMIT, maxRequests: 60, windowMs: 60_000, functionName: 'token-holders' };

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface HolderData {
  tokenAddress: string;
  holderCount: number;
  topHolders: {
    address: string;
    balance: number;
    percentage: number;
  }[];
  buyerPosition?: number;
  calculatedAt: string;
  source: 'helius-das' | 'helius-rpc' | 'standard-rpc' | 'dexscreener';
}

interface TokenHolderRequest {
  tokenAddresses: string[];
  includePosition?: boolean;
  walletAddress?: string;
}

// =============================================================================
// RPC HELPERS
// =============================================================================

async function getRpcUrl(): Promise<string> {
  return await getApiKey('rpc_provider') || 'https://api.mainnet-beta.solana.com';
}

async function getHeliusApiKey(): Promise<string | null> {
  // Check admin-saved key first via shared module
  const key = await getApiKey('helius');
  if (key) return key;
  
  // Also try extracting from RPC URL  
  const rpcUrl = await getRpcUrl();
  const match = rpcUrl.match(/api-key=([a-zA-Z0-9-]+)/);
  return match ? match[1] : null;
}

async function rpcCall(method: string, params: unknown[]): Promise<unknown> {
  const rpcUrl = await getRpcUrl();
  
  const response = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method,
      params,
    }),
    signal: AbortSignal.timeout(10000),
  });
  
  if (!response.ok) throw new Error(`RPC error: ${response.status}`);
  
  const data = await response.json();
  if (data.error) throw new Error(data.error.message || 'RPC error');
  
  return data.result;
}

// =============================================================================
// STRATEGY 1: HELIUS DAS API (MOST ACCURATE)
// =============================================================================

async function getHolderCountHeliusDAS(tokenAddress: string): Promise<number | null> {
  const apiKey = await getHeliusApiKey();
  if (!apiKey) return null;
  
  try {
    // Helius DAS getAsset endpoint provides holder_count
    const response = await fetch(`https://mainnet.helius-rpc.com/?api-key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getAsset',
        params: { id: tokenAddress },
      }),
      signal: AbortSignal.timeout(8000),
    });
    
    if (!response.ok) return null;
    
    const data = await response.json();
    
    // Helius returns holder_count in token_info
    const holderCount = data?.result?.token_info?.holder_count;
    
    if (typeof holderCount === 'number' && holderCount > 0) {
      console.log(`[Helius DAS] ${tokenAddress.slice(0, 8)}... has ${holderCount} holders`);
      return holderCount;
    }
    
    return null;
  } catch (e) {
    console.log(`[Helius DAS] Error for ${tokenAddress.slice(0, 8)}...:`, e);
    return null;
  }
}

// =============================================================================
// STRATEGY 2: SOLSCAN API (FREE, ACCURATE)
// =============================================================================

async function getHolderCountSolscan(tokenAddress: string): Promise<number | null> {
  try {
    const response = await fetch(
      `https://public-api.solscan.io/token/holders?tokenAddress=${tokenAddress}&limit=1`,
      { 
        signal: AbortSignal.timeout(5000),
        headers: {
          'Accept': 'application/json',
        }
      }
    );
    
    if (!response.ok) return null;
    
    const data = await response.json();
    
    // Solscan returns total in response header or data
    const total = data?.total;
    if (typeof total === 'number' && total > 0) {
      console.log(`[Solscan] ${tokenAddress.slice(0, 8)}... has ${total} holders`);
      return total;
    }
    
    return null;
  } catch {
    return null;
  }
}

// =============================================================================
// STRATEGY 3: DEXSCREENER API (FAST, WIDELY AVAILABLE)
// =============================================================================

async function getHolderCountDexScreener(tokenAddress: string): Promise<number | null> {
  try {
    const response = await fetch(
      `https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`,
      { signal: AbortSignal.timeout(5000) }
    );
    
    if (!response.ok) return null;
    
    const data = await response.json();
    const pairs = data?.pairs;
    
    if (!pairs || pairs.length === 0) return null;
    
    // DexScreener provides holder count in pair info (various fields)
    for (const pair of pairs) {
      // Check multiple possible fields for holder data
      const holderCount = pair?.info?.holders || pair?.holders || pair?.txns?.holders;
      if (typeof holderCount === 'number' && holderCount > 0) {
        console.log(`[DexScreener] ${tokenAddress.slice(0, 8)}... has ${holderCount} holders`);
        return holderCount;
      }
    }
    
    return null;
  } catch {
    return null;
  }
}

// =============================================================================
// STRATEGY 4: STANDARD RPC (FALLBACK, CAPPED AT 20)
// =============================================================================

async function getHolderCountStandardRPC(tokenAddress: string): Promise<{ 
  count: number; 
  topHolders: HolderData['topHolders'];
  isCapped: boolean;
}> {
  try {
    const result = await rpcCall('getTokenLargestAccounts', [tokenAddress]) as {
      value: { address: string; amount: string; decimals: number; uiAmount: number }[];
    };
    
    if (!result?.value) {
      return { count: 0, topHolders: [], isCapped: false };
    }
    
    const accounts = result.value.filter(acc => parseFloat(acc.amount) > 0);
    const totalSupply = accounts.reduce((sum, acc) => sum + parseFloat(acc.amount), 0);
    
    const topHolders = accounts.slice(0, 10).map(acc => ({
      address: acc.address,
      balance: acc.uiAmount || 0,
      percentage: totalSupply > 0 ? (parseFloat(acc.amount) / totalSupply) * 100 : 0,
    }));
    
    // Standard RPC caps at 20 accounts
    const isCapped = accounts.length >= 20;
    const count = accounts.length;
    
    console.log(`[Standard RPC] ${tokenAddress.slice(0, 8)}... has ${count}${isCapped ? '+' : ''} holders`);
    
    return { count, topHolders, isCapped };
  } catch (error) {
    console.error(`[Standard RPC] Error for ${tokenAddress}:`, error);
    return { count: 0, topHolders: [], isCapped: false };
  }
}

// =============================================================================
// COMBINED HOLDER FETCHER (MULTI-STRATEGY)
// =============================================================================

async function getHolderData(tokenAddress: string): Promise<HolderData> {
  const now = new Date().toISOString();
  
  // Run all strategies in parallel for maximum speed
  const [heliusDAS, solscan, dexScreener, standardRPC] = await Promise.all([
    getHolderCountHeliusDAS(tokenAddress),
    getHolderCountSolscan(tokenAddress),
    getHolderCountDexScreener(tokenAddress),
    getHolderCountStandardRPC(tokenAddress),
  ]);
  
  // Priority: Helius DAS > Solscan > DexScreener > Standard RPC
  // CRITICAL: Only trust counts > 2 from non-RPC sources
  // If a source returns 1-2, it's likely incomplete data
  let holderCount = 0;
  let source: HolderData['source'] = 'standard-rpc';
  
  // Collect all valid counts to pick the BEST one
  const validCounts: { count: number; source: HolderData['source'] }[] = [];
  
  if (heliusDAS !== null && heliusDAS > 0) {
    validCounts.push({ count: heliusDAS, source: 'helius-das' });
  }
  if (solscan !== null && solscan > 0) {
    validCounts.push({ count: solscan, source: 'dexscreener' }); // Use dexscreener type for Solscan
  }
  if (dexScreener !== null && dexScreener > 0) {
    validCounts.push({ count: dexScreener, source: 'dexscreener' });
  }
  
  // If we have external API counts, use the highest one (most accurate)
  // Very low counts (1-2) from APIs are likely incomplete
  if (validCounts.length > 0) {
    // Pick the highest count (more accurate for tokens with many holders)
    const best = validCounts.reduce((a, b) => a.count > b.count ? a : b);
    
    // If best count is very low but RPC shows 20+ (capped), prefer to indicate uncertainty
    if (best.count <= 2 && standardRPC.isCapped) {
      // RPC capped at 20 means there are likely MORE than 20 holders
      // Use RPC count but mark position as uncertain
      holderCount = standardRPC.count;
      source = 'standard-rpc';
      console.log(`[Holders] ${tokenAddress.slice(0, 8)}... API returned ${best.count} but RPC capped at 20+ - using RPC`);
    } else {
      holderCount = best.count;
      source = best.source;
    }
  } else if (standardRPC.count > 0) {
    holderCount = standardRPC.count;
    source = 'standard-rpc';
  }
  
  // Calculate buyer position:
  // - If RPC is capped (20+), we can't determine exact position - return null to indicate uncertainty
  // - Otherwise, position = holderCount + 1
  let buyerPosition: number | undefined;
  
  if (source === 'standard-rpc' && standardRPC.isCapped) {
    // Position is UNKNOWN when RPC capped and no API data
    buyerPosition = undefined;
    console.log(`[Holders] ${tokenAddress.slice(0, 8)}... → ${holderCount}+ holders (position UNKNOWN - RPC capped)`);
  } else {
    buyerPosition = holderCount > 0 ? holderCount + 1 : 1;
    console.log(`[Holders] ${tokenAddress.slice(0, 8)}... → ${holderCount} holders (position #${buyerPosition}) via ${source}`);
  }
  
  return {
    tokenAddress,
    holderCount,
    topHolders: standardRPC.topHolders,
    buyerPosition,
    calculatedAt: now,
    source,
  };
}

// =============================================================================
// BATCH PROCESSING
// =============================================================================

async function batchGetHolderData(tokenAddresses: string[]): Promise<Map<string, HolderData>> {
  const results = new Map<string, HolderData>();
  
  // Process in parallel batches of 5
  const batchSize = 5;
  
  for (let i = 0; i < tokenAddresses.length; i += batchSize) {
    const batch = tokenAddresses.slice(i, i + batchSize);
    
    const batchResults = await Promise.allSettled(
      batch.map(address => getHolderData(address))
    );
    
    for (const result of batchResults) {
      if (result.status === 'fulfilled') {
        results.set(result.value.tokenAddress, result.value);
      }
    }
  }
  
  return results;
}

// =============================================================================
// MAIN HANDLER
// =============================================================================

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  const startTime = Date.now();
  
  try {
    // Auth check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    
     const { data: { user }, error: authError } = await authClient.auth.getUser();
     if (authError || !user?.id) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Per-user rate limiting
    const rl = checkRateLimit(user.id, HOLDER_LIMIT);
    if (!rl.allowed) return rateLimitResponse(rl, corsHeaders);
    
    // Parse request
    const body = await req.json().catch(() => ({})) as TokenHolderRequest;
    
    const { tokenAddresses } = body;
    
    if (!tokenAddresses || !Array.isArray(tokenAddresses) || tokenAddresses.length === 0) {
      return new Response(JSON.stringify({ error: 'tokenAddresses array required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    // Limit to 20 tokens per request
    const limitedAddresses = tokenAddresses.slice(0, 20);
    
    console.log(`[Holders] Fetching data for ${limitedAddresses.length} tokens`);
    
    // Fetch holder data using multi-strategy approach
    const holderData = await batchGetHolderData(limitedAddresses);
    
    // Convert Map to object for response
    const holders: Record<string, HolderData> = {};
    for (const [address, data] of holderData) {
      holders[address] = data;
    }
    
    const executionMs = Date.now() - startTime;
    console.log(`[Holders] Complete: ${holderData.size} tokens in ${executionMs}ms`);
    
    return new Response(JSON.stringify({
      holders,
      executionMs,
      timestamp: new Date().toISOString(),
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Internal error';
    console.error('[Holders] Error:', error);
    
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
