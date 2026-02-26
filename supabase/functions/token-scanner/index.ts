/**
 * Production-Grade Token Scanner v3
 * 
 * OPTIMIZED for sub-second token detection with HARD DISCOVERY FILTERS:
 * 
 * STAGE 1 - Fast Discovery: Racing parallel APIs (first response wins)
 * STAGE 1.5 - HARD FILTERS: Reject unsafe tokens BEFORE storage
 * STAGE 2 - Tradability: High-concurrency Jupiter verification
 * 
 * HARD DISCOVERY FILTERS (enforced before NEW state):
 * - Liquidity >= $5000 (≈33 SOL)
 * - Holder count >= 5
 * - Pool age >= 60 seconds
 * - No freeze authority
 * - No mint authority
 * 
 * Performance Target: <2s full scan
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.90.1";
import { validateTokenScannerInput } from "../_shared/validation.ts";
import { getBatchQuotes, getBatchSellQuotes, type QuoteResult } from "../_shared/jupiter-fast.ts";
import { raceDiscovery, fastBatchQuotes, type DiscoveredPool } from "../_shared/fast-discovery.ts";
import { getApiKey } from "../_shared/api-keys.ts";
import { getLiveSolPrice } from "../_shared/sol-price.ts";
import { checkRateLimit, rateLimitResponse, TOKEN_SCANNER_LIMIT } from "../_shared/rate-limiter.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const SOL_MINT = "So11111111111111111111111111111111111111112";
const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const RUGCHECK_API = "https://api.rugcheck.xyz/v1";

// =============================================================================
// HARD DISCOVERY FILTER THRESHOLDS
// =============================================================================

const HARD_FILTERS = {
  MIN_LIQUIDITY_USD: 5000,      // $5000 minimum
  // MIN_LIQUIDITY_SOL is computed dynamically from live SOL price in the handler
  MIN_HOLDER_COUNT: 5,          // At least 5 holders
  MIN_POOL_AGE_SECONDS: 60,     // Pool must be 60+ seconds old
  REJECT_FREEZE_AUTHORITY: true,
  REJECT_MINT_AUTHORITY: true,
};

// =============================================================================
// TYPES
// =============================================================================

interface DiscoveredToken {
  address: string;
  name: string;
  symbol: string;
  chain: string;
  liquidity: number;
  liquidityUsd: number;
  priceUsd: number;
  volume24h: number;
  marketCap: number;
  source: string;
  pairAddress: string;
  poolCreatedAt: string;
  dexId: string;
  holderCount?: number;
  buyerPosition?: number;
}

interface HardFilterResult {
  passed: boolean;
  rejectionReason?: string;
  rejectionDetails?: {
    liquidity?: number;
    holderCount?: number;
    poolAgeSeconds?: number;
    hasFreezeAuthority?: boolean;
    hasMintAuthority?: boolean;
  };
}

interface AuthorityCheckResult {
  freezeAuthority: string | null;
  mintAuthority: string | null;
  isHoneypot: boolean;
  riskScore: number;
  // Deployer & LP enrichment (extracted from RugCheck report)
  creatorAddress: string | null;
  lpMintAddress: string | null;
  lpLockedPercent: number | null;
  topHolders: { address: string; pct: number }[];
}

interface TradableToken extends DiscoveredToken {
  id: string;
  riskScore: number;
  isTradeable: boolean;
  canBuy: boolean;
  canSell: boolean;
  freezeAuthority: string | null;
  mintAuthority: string | null;
  safetyReasons: string[];
  holders?: number;
  // Deployer & LP enrichment
  deployerWallet: string | null;
  lpMintAddress: string | null;
  creatorAddress: string | null;
  lpLockedPercent: number | null;
  rugcheckTopHolders: { address: string; pct: number }[];
  tokenStatus: {
    tradable: boolean;
    stage: 'DISCOVERED' | 'PENDING' | 'TRADEABLE' | 'REJECTED';
    jupiterIndexed: boolean;
    lastChecked: string;
  };
}

interface PendingToken {
  address: string;
  symbol: string;
  name: string;
  liquidity: number;
  source: string;
  reason: string;
}

interface RejectedToken {
  address: string;
  symbol: string;
  name: string;
  liquidity: number;
  source: string;
  reason: string;
}

// =============================================================================
// HELPERS
// =============================================================================

function shortAddress(address: string | null | undefined): string {
  if (!address || address.length < 10) return 'TOKEN';
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}

function safeTokenName(name: string | null | undefined, address: string): string {
  if (name?.trim() && !/^(unknown|unknown token|token|\?\?\?|n\/a)$/i.test(name.trim())) {
    return name.trim();
  }
  return `Token ${shortAddress(address)}`;
}

function safeTokenSymbol(symbol: string | null | undefined, address: string): string {
  if (symbol?.trim() && !/^(unknown|\?\?\?|n\/a)$/i.test(symbol.trim())) {
    return symbol.trim();
  }
  return shortAddress(address);
}

function getPoolAgeSeconds(poolCreatedAt: string | undefined): number {
  if (!poolCreatedAt) return 0;
  try {
    const createdTime = new Date(poolCreatedAt).getTime();
    const now = Date.now();
    return Math.max(0, Math.floor((now - createdTime) / 1000));
  } catch {
    return 0;
  }
}

// =============================================================================
// HARD DISCOVERY FILTERS (PRE-STORAGE VALIDATION)
// =============================================================================

function applyHardFilters(
  token: DiscoveredToken,
  holderCount: number | undefined,
  authorityCheck: AuthorityCheckResult | null
): HardFilterResult {
  const details: HardFilterResult['rejectionDetails'] = {};
  const reasons: string[] = [];

  // 1. Liquidity check ($5000 minimum)
  // liquidityUsd is calculated in the caller using live SOL price; never fall back to hardcoded $150
  const liquidityUsd = token.liquidityUsd || 0;
  details.liquidity = liquidityUsd;
  
  if (liquidityUsd < HARD_FILTERS.MIN_LIQUIDITY_USD) {
    reasons.push(`Liquidity $${liquidityUsd.toFixed(0)} < $${HARD_FILTERS.MIN_LIQUIDITY_USD}`);
  }

  // 2. Holder count check (minimum 5)
  details.holderCount = holderCount ?? 0;
  
  if (holderCount !== undefined && holderCount < HARD_FILTERS.MIN_HOLDER_COUNT) {
    reasons.push(`Holders ${holderCount} < ${HARD_FILTERS.MIN_HOLDER_COUNT}`);
  }

  // 3. Pool age check (minimum 60 seconds)
  const poolAgeSeconds = getPoolAgeSeconds(token.poolCreatedAt);
  details.poolAgeSeconds = poolAgeSeconds;
  
  if (poolAgeSeconds < HARD_FILTERS.MIN_POOL_AGE_SECONDS) {
    reasons.push(`Pool age ${poolAgeSeconds}s < ${HARD_FILTERS.MIN_POOL_AGE_SECONDS}s`);
  }

  // 4. Freeze authority check
  if (authorityCheck?.freezeAuthority && HARD_FILTERS.REJECT_FREEZE_AUTHORITY) {
    details.hasFreezeAuthority = true;
    reasons.push('Freeze authority present');
  }

  // 5. Mint authority check
  if (authorityCheck?.mintAuthority && HARD_FILTERS.REJECT_MINT_AUTHORITY) {
    details.hasMintAuthority = true;
    reasons.push('Mint authority present');
  }

  // 6. Honeypot check
  if (authorityCheck?.isHoneypot) {
    reasons.push('Detected as honeypot');
  }

  return {
    passed: reasons.length === 0,
    rejectionReason: reasons.length > 0 ? reasons.join('; ') : undefined,
    rejectionDetails: details,
  };
}

// =============================================================================
// BATCH AUTHORITY CHECK (PARALLEL RUGCHECK CALLS)
// =============================================================================

async function batchCheckAuthorities(
  tokenAddresses: string[]
): Promise<Record<string, AuthorityCheckResult>> {
  const results: Record<string, AuthorityCheckResult> = {};
  
  if (tokenAddresses.length === 0) return results;

  // Parallel fetch with 3s timeout (increased from 1.5s to get deployer/LP data)
  const checks = await Promise.allSettled(
    tokenAddresses.map(async (address) => {
      try {
        const response = await fetch(`${RUGCHECK_API}/tokens/${address}/report`, {
          signal: AbortSignal.timeout(3000),
        });
        
        if (!response.ok) {
          return { address, result: null };
        }
        
        const data = await response.json();
        
        const freezeAuthority = data.token?.freezeAuthority || null;
        const mintAuthority = data.token?.mintAuthority || null;
        
        // Extract deployer/creator address from RugCheck report
        // RugCheck uses 'creator' at top level for the deployer wallet
        const creatorAddress = data.creator || data.token?.creator || data.token?.owner || data.creatorAddress || null;
        
        // Extract LP info from markets array
        const markets = data.markets || [];
        let lpMintAddress: string | null = null;
        let lpLockedPercent: number | null = null;
        for (const m of markets) {
          // RugCheck markets have lp.lpMint and lp.lpLockedPct or lpLockedPct at market level
          const lpMint = m?.lp?.lpMint || m?.lpMint || m?.lp?.mint || null;
          const lockedPct = m?.lp?.lpLockedPct ?? m?.lpLockedPct ?? m?.lp?.lockedPct ?? null;
          if (lpMint && !lpMintAddress) lpMintAddress = lpMint;
          if (lockedPct !== null && lpLockedPercent === null) lpLockedPercent = lockedPct;
          if (lpMintAddress && lpLockedPercent !== null) break;
        }
        
        // Extract top holders
        const topHolders: { address: string; pct: number }[] = [];
        const rawHolders = data.topHolders || [];
        for (const h of rawHolders.slice(0, 10)) {
          if (h.address && typeof h.pct === 'number') {
            topHolders.push({ address: h.address, pct: h.pct });
          }
        }
        
        let isHoneypot = false;
        let riskScore = 50;
        
        if (data.risks) {
          const honeypotRisk = data.risks.find((r: { name?: string; level?: string }) =>
            r.name?.toLowerCase().includes("honeypot") && (r.level === "danger" || r.level === "warn")
          );
          if (honeypotRisk) {
            isHoneypot = true;
            riskScore = 100;
          }
        }
        
        if (freezeAuthority) riskScore = Math.min(riskScore + 20, 100);
        if (mintAuthority) riskScore = Math.min(riskScore + 15, 100);
        
        return {
          address,
          result: { freezeAuthority, mintAuthority, isHoneypot, riskScore, creatorAddress, lpMintAddress, lpLockedPercent, topHolders },
        };
      } catch {
        return { address, result: null };
      }
    })
  );

  for (const check of checks) {
    if (check.status === 'fulfilled' && check.value.result) {
      results[check.value.address] = check.value.result;
    }
  }

  console.log(`[HardFilter] Authority check: ${Object.keys(results).length}/${tokenAddresses.length} tokens`);
  return results;
}

// =============================================================================
// MAIN HANDLER
// =============================================================================

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    // Auth validation
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: authError } = await authClient.auth.getClaims(token);
    const userId = claimsData?.claims?.sub as string | undefined;

    if (authError || !userId) {
      const errMsg = authError?.message || 'Invalid token';
      const status = errMsg.toLowerCase().includes('expired') ? 401 : 401;
      return new Response(JSON.stringify({ error: errMsg }), {
        status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Per-user rate limiting
    const rateCheck = checkRateLimit(userId, TOKEN_SCANNER_LIMIT);
    if (!rateCheck.allowed) {
      return rateLimitResponse(rateCheck, corsHeaders);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Parse request
    const rawBody = await req.json().catch(() => ({}));
    const validationResult = validateTokenScannerInput(rawBody);
    
    if (!validationResult.success) {
      return new Response(JSON.stringify({ error: validationResult.error }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { minLiquidity, chains } = validationResult.data!;
    const stage = rawBody.stage || 'both';

    if (!chains.includes('solana')) {
      return new Response(JSON.stringify({
        tokens: [],
        errors: ['Only Solana chain supported'],
        timestamp: new Date().toISOString(),
        stats: { total: 0, tradeable: 0, pending: 0 },
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ==========================================================================
    // STAGE 1: FAST PARALLEL RACING DISCOVERY
    // ==========================================================================
    
    console.log('[Pipeline] STAGE 1: Fast racing discovery...');
    const discoveryStart = Date.now();
    const errors: string[] = [];
    
    // Fetch live SOL price for accurate USD conversions
    const solPrice = await getLiveSolPrice();
    console.log(`[Pipeline] Using live SOL price: $${solPrice.toFixed(2)}`);
    
    // Race all sources - returns in ~500-1500ms
    const racedPools = await raceDiscovery(1, 3000);
    
    // Convert to our token format with liquidityUsd
    const discoveredTokens = new Map<string, DiscoveredToken>();
    for (const pool of racedPools) {
      if (!discoveredTokens.has(pool.tokenMint)) {
        const liquiditySol = pool.liquidity;
        const liquidityUsd = pool.liquidityUsd || (liquiditySol * solPrice);
        
        discoveredTokens.set(pool.tokenMint, {
          address: pool.tokenMint,
          name: pool.tokenName,
          symbol: pool.tokenSymbol,
          chain: 'solana',
          liquidity: liquiditySol,
          liquidityUsd,
          priceUsd: pool.priceUsd,
          volume24h: pool.volume24h,
          marketCap: liquidityUsd * 10,
          source: `${pool.dexId} (${pool.source})`,
          pairAddress: pool.address,
          poolCreatedAt: pool.createdAt,
          dexId: pool.dexId,
        });
      }
    }

    // Also fetch pending tokens for retry (non-blocking, parallel)
    const pendingPromise = supabase
      .from('token_processing_states')
      .select('token_address')
      .eq('user_id', userId)
      .eq('state', 'PENDING')
      .lt('retry_count', 5)
      .limit(20);

    const pendingResult = await pendingPromise;
    let pendingAddresses: string[] = [];
    if (pendingResult.data) {
      pendingAddresses = pendingResult.data.map((s: { token_address: string }) => s.token_address);
      console.log(`[Pipeline] Found ${pendingAddresses.length} PENDING tokens for retry`);
    }

    // Enrich pending tokens via fast lookup
    if (pendingAddresses.length > 0) {
      await enrichFromDexScreener(pendingAddresses, discoveredTokens);
    }

    const uniqueTokens = Array.from(discoveredTokens.values());
    const discoveryMs = Date.now() - discoveryStart;
    console.log(`[Pipeline] STAGE 1 complete: ${uniqueTokens.length} tokens in ${discoveryMs}ms`);

    // ==========================================================================
    // STAGE 1.5: HARD DISCOVERY FILTERS (PRE-STORAGE REJECTION)
    // ==========================================================================
    
    console.log('[Pipeline] STAGE 1.5: Hard discovery filters...');
    const filterStart = Date.now();
    
    // Pre-filter by basic liquidity (instant) - reject obvious junk
    const potentialTokens = uniqueTokens.filter(t => t.liquidity >= 1); // At least 1 SOL
    const instantRejects = uniqueTokens.filter(t => t.liquidity < 1);
    
    console.log(`[HardFilter] Pre-filter: ${potentialTokens.length} potential, ${instantRejects.length} instant rejects (<1 SOL)`);
    
    // Parallel fetch: holders + authority checks for potential tokens
    const tokensToFilter = potentialTokens.slice(0, 40);
    const tokenAddresses = tokensToFilter.map(t => t.address);
    
    // Build liquidity map for tiered Birdeye calling
    const tokenLiquidityMap: Record<string, number> = {};
    for (const t of tokensToFilter) {
      tokenLiquidityMap[t.address] = t.liquidity || 0;
    }
    
    const [holderData, authorityData] = await Promise.all([
      fetchHolderDataBatch(tokenAddresses, tokenLiquidityMap),
      batchCheckAuthorities(tokenAddresses),
    ]);
    
    // Apply hard filters to each token
    const passedTokens: DiscoveredToken[] = [];
    const rejectedTokens: RejectedToken[] = [];
    
    for (const token of tokensToFilter) {
      const holderCount = holderData[token.address]?.holderCount;
      const authorityCheck = authorityData[token.address] || null;
      
      // Enrich token with holder data
      token.holderCount = holderCount;
      token.buyerPosition = holderData[token.address]?.buyerPosition;
      
      const filterResult = applyHardFilters(token, holderCount, authorityCheck);
      
      if (filterResult.passed) {
        passedTokens.push(token);
      } else {
        rejectedTokens.push({
          address: token.address,
          symbol: token.symbol,
          name: token.name,
          liquidity: token.liquidity,
          source: token.source,
          reason: filterResult.rejectionReason || 'Failed hard filters',
        });
        
        console.log(`[HardFilter] REJECTED ${token.symbol}: ${filterResult.rejectionReason}`);
      }
    }
    
    // Add instant rejects
    for (const token of instantRejects.slice(0, 10)) {
      rejectedTokens.push({
        address: token.address,
        symbol: token.symbol,
        name: token.name,
        liquidity: token.liquidity,
        source: token.source,
        reason: `Liquidity ${(token.liquidity * solPrice).toFixed(0)} < $${HARD_FILTERS.MIN_LIQUIDITY_USD}`,
      });
    }
    
    const filterMs = Date.now() - filterStart;
    console.log(`[Pipeline] STAGE 1.5 complete: ${passedTokens.length} passed, ${rejectedTokens.length} rejected in ${filterMs}ms`);

    // Store rejected tokens (fire-and-forget)
    if (rejectedTokens.length > 0) {
      const now = new Date().toISOString();
      const rejectUpserts = rejectedTokens.slice(0, 50).map(t => ({
        user_id: userId,
        token_address: t.address.toLowerCase(),
        token_symbol: t.symbol,
        token_name: t.name,
        state: 'REJECTED',
        source: t.source,
        liquidity_at_discovery: t.liquidity,
        rejection_reason: t.reason,
        rejected_at: now,
      }));
      
      (async () => {
        try {
          await supabase
            .from('token_processing_states')
            .upsert(rejectUpserts, { onConflict: 'user_id,token_address' });
        } catch {
          // Ignore DB errors for non-blocking writes
        }
      })();
    }

    // Discovery-only mode - return after hard filters
    if (stage === 'discovery') {
      const discoveredRecords = passedTokens.slice(0, 50).map(t => ({
        user_id: userId,
        token_address: t.address.toLowerCase(),
        token_symbol: t.symbol,
        token_name: t.name,
        state: 'NEW',
        source: t.source,
        liquidity_at_discovery: t.liquidity,
        risk_score_at_discovery: authorityData[t.address]?.riskScore || 50,
        buyer_position_at_discovery: t.buyerPosition,
      }));

      if (discoveredRecords.length > 0) {
        await supabase
          .from('token_processing_states')
          .upsert(discoveredRecords, { onConflict: 'user_id,token_address', ignoreDuplicates: true });
      }

      return new Response(JSON.stringify({
        stage: 'discovery',
        discoveredTokens: passedTokens,
        rejectedTokens,
        tokens: [],
        pendingTokens: [],
        timestamp: new Date().toISOString(),
        stats: {
          discovered: uniqueTokens.length,
          passed: passedTokens.length,
          rejected: rejectedTokens.length,
          total: passedTokens.length,
          tradeable: 0,
          pending: passedTokens.length,
        },
        executionMs: Date.now() - startTime,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ==========================================================================
    // STAGE 2: HIGH-SPEED TRADABILITY VERIFICATION
    // ==========================================================================
    
    console.log('[Pipeline] STAGE 2: High-speed tradability check...');
    const tradabilityStart = Date.now();

    // Filter by user's liquidity threshold
    const liquidityFiltered = passedTokens.filter(t => t.liquidity >= minLiquidity);
    const lowLiquidity = passedTokens.filter(t => t.liquidity < minLiquidity);

    // Use fast batch quotes with 10x concurrency
    // CRITICAL: Check BOTH buy (SOL→Token) AND sell (Token→SOL) directions independently
    const tokensToCheck = liquidityFiltered.slice(0, 30);
    const quoteAddresses = tokensToCheck.map(t => t.address);
    
    const [fastQuotes, buyQuoteResults, sellQuoteResults] = await Promise.all([
      fastBatchQuotes(quoteAddresses, 10),
      getBatchQuotes(quoteAddresses, 10000000, 10),      // BUY: SOL → Token
      getBatchSellQuotes(quoteAddresses, 1000000, 10),    // SELL: Token → SOL
    ]);

    // Process results
    const tradeableTokens: TradableToken[] = [];
    const pendingTokens: PendingToken[] = [];

    for (const token of tokensToCheck) {
      const buyQuote = buyQuoteResults[token.address];
      const sellQuote = sellQuoteResults[token.address];
      const now = new Date().toISOString();
      const authorityCheck = authorityData[token.address];
      
      // Determine canBuy and canSell from ACTUAL route checks
      const canBuy = !!(buyQuote?.success && buyQuote?.hasRoute);
      const canSell = !!(sellQuote?.success && sellQuote?.hasRoute);
      const isTradeable = canBuy && canSell;
      
      const tradable: TradableToken = {
        ...token,
        id: `${token.dexId}-${token.address.slice(0, 8)}`,
        riskScore: authorityCheck?.riskScore || 50,
        isTradeable,
        canBuy,
        canSell,
        freezeAuthority: authorityCheck?.freezeAuthority || null,
        mintAuthority: authorityCheck?.mintAuthority || null,
        safetyReasons: [],
        holders: token.holderCount,
        deployerWallet: authorityCheck?.creatorAddress || null,
        lpMintAddress: authorityCheck?.lpMintAddress || null,
        creatorAddress: authorityCheck?.creatorAddress || null,
        lpLockedPercent: authorityCheck?.lpLockedPercent ?? null,
        rugcheckTopHolders: authorityCheck?.topHolders || [],
        tokenStatus: {
          tradable: isTradeable,
          stage: isTradeable ? 'TRADEABLE' : (canBuy ? 'PENDING' : 'DISCOVERED'),
          jupiterIndexed: canBuy || canSell,
          lastChecked: now,
        },
      };

      if (isTradeable) {
        // Both buy AND sell routes confirmed
        tradable.safetyReasons.push(`✅ ${token.source} (${token.liquidity.toFixed(1)} SOL)`);
        if (token.holderCount) {
          tradable.safetyReasons.push(`👥 ${token.holderCount} holders`);
        }
      } else if (canBuy && !canSell) {
        // Can buy but CANNOT sell — potential honeypot
        tradable.safetyReasons.push(`⚠️ No sell route — potential honeypot`);
        pendingTokens.push({
          address: token.address,
          symbol: token.symbol,
          name: token.name,
          liquidity: token.liquidity,
          source: token.source,
          reason: `No sell route (Token→SOL) — ${sellQuote?.error || 'sell not executable'}`,
        });
      } else {
        tradable.safetyReasons.push(`⏳ ${buyQuote?.error || 'Awaiting Jupiter index'}`);
        pendingTokens.push({
          address: token.address,
          symbol: token.symbol,
          name: token.name,
          liquidity: token.liquidity,
          source: token.source,
          reason: buyQuote?.error || 'No buy route available',
        });
      }

      // Always include in tokens array so UI shows accurate canBuy/canSell status
      tradeableTokens.push(tradable);
    }

    // Add low-liquidity tokens to pending (below user threshold but passed hard filters)
    for (const token of lowLiquidity.slice(0, 10)) {
      pendingTokens.push({
        address: token.address,
        symbol: token.symbol,
        name: token.name,
        liquidity: token.liquidity,
        source: token.source,
        reason: `Liquidity ${token.liquidity.toFixed(1)} SOL < ${minLiquidity} SOL threshold`,
      });
    }

    // Sort by liquidity
    tradeableTokens.sort((a, b) => b.liquidity - a.liquidity);

    // Persist pending states (non-blocking)
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 5 * 60 * 1000);

    const pendingUpserts = pendingTokens.slice(0, 30).map(t => ({
      user_id: userId,
      token_address: t.address.toLowerCase(),
      token_symbol: t.symbol,
      token_name: t.name,
      state: 'PENDING',
      source: t.source,
      liquidity_at_discovery: t.liquidity,
      pending_since: now.toISOString(),
      pending_reason: t.reason,
      retry_expires_at: expiresAt.toISOString(),
    }));

    // Store tradeable tokens as NEW (passed all checks)
    const tradeableUpserts = tradeableTokens.slice(0, 30).map(t => ({
      user_id: userId,
      token_address: t.address.toLowerCase(),
      token_symbol: t.symbol,
      token_name: t.name,
      state: 'NEW',
      source: t.source,
      liquidity_at_discovery: t.liquidity,
      risk_score_at_discovery: t.riskScore,
      buyer_position_at_discovery: t.buyerPosition,
    }));

    // Fire-and-forget database writes
    if (pendingUpserts.length > 0 || tradeableUpserts.length > 0) {
      (async () => {
        try {
          if (pendingUpserts.length > 0) {
            await supabase
              .from('token_processing_states')
              .upsert(pendingUpserts, { onConflict: 'user_id,token_address' });
          }
          if (tradeableUpserts.length > 0) {
            await supabase
              .from('token_processing_states')
              .upsert(tradeableUpserts, { onConflict: 'user_id,token_address' });
          }
        } catch {
          // Ignore DB errors for non-blocking writes
        }
      })();
    }

    const actualTradeable = tradeableTokens.filter(t => t.isTradeable);
    const executionMs = Date.now() - startTime;
    console.log(`[Pipeline] STAGE 2 complete: ${actualTradeable.length} tradeable, ${tradeableTokens.length - actualTradeable.length} non-tradeable, ${pendingTokens.length} pending (${executionMs}ms total)`);

    return new Response(JSON.stringify({
      stage: 'both',
      tokens: tradeableTokens,
      pendingTokens,
      rejectedTokens,
      discoveredTokens: passedTokens.slice(0, 50),
      errors,
      timestamp: new Date().toISOString(),
      executionMs,
      stats: {
        discovered: uniqueTokens.length,
        passed: passedTokens.length,
        rejected: rejectedTokens.length,
        total: tokensToCheck.length,
        tradeable: actualTradeable.length,
        pending: pendingTokens.length,
        stages: {
          discovered: uniqueTokens.length,
          filtered: passedTokens.length,
          rejected: rejectedTokens.length,
          pending: pendingTokens.length,
          tradeable: actualTradeable.length,
        },
        hardFilters: HARD_FILTERS,
      },
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Internal error';
    console.error('[Pipeline] Error:', error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// =============================================================================
// DISCOVERY FUNCTIONS
// =============================================================================

async function enrichFromDexScreener(addresses: string[], tokens: Map<string, DiscoveredToken>): Promise<void> {
  if (addresses.length === 0) return;
  
  try {
    const addressList = addresses.slice(0, 30).join(',');
    const endpoint = `https://api.dexscreener.com/latest/dex/tokens/${addressList}`;
    
    const response = await fetch(endpoint, {
      signal: AbortSignal.timeout(4000),
      headers: { 'Accept': 'application/json' },
    });
    
    if (!response.ok) return;
    
    const data = await response.json();
    const pairs = data.pairs || [];
    
    for (const pair of pairs) {
      const tokenAddress = pair.baseToken?.address || pair.quoteToken?.address || '';
      if (!tokenAddress || tokens.has(tokenAddress)) continue;
      
      const dexId = pair.dexId || '';
      const isRaydium = dexId.toLowerCase().includes('raydium');
      const isOrca = dexId.toLowerCase().includes('orca');
      
      if (!isRaydium && !isOrca) continue;
      
      const liquidityUsd = parseFloat(pair.liquidity?.usd || 0);
      const liquidity = liquidityUsd / 150;
      
      tokens.set(tokenAddress, {
        address: tokenAddress,
        name: safeTokenName(pair.baseToken?.name, tokenAddress),
        symbol: safeTokenSymbol(pair.baseToken?.symbol, tokenAddress),
        chain: 'solana',
        liquidity,
        liquidityUsd,
        priceUsd: parseFloat(pair.priceUsd || 0),
        volume24h: parseFloat(pair.volume?.h24 || 0),
        marketCap: parseFloat(pair.fdv || 0),
        source: `${isRaydium ? 'Raydium' : 'Orca'} (DexScreener)`,
        pairAddress: pair.pairAddress || '',
        poolCreatedAt: pair.pairCreatedAt ? new Date(pair.pairCreatedAt).toISOString() : new Date().toISOString(),
        dexId: isRaydium ? 'raydium' : 'orca',
      });
    }
    
    console.log(`[Discovery] DexScreener lookup: enriched ${pairs.length} pairs`);
  } catch (e) {
    console.log('[Discovery] DexScreener lookup error:', e);
  }
}

// =============================================================================
// HOLDER DATA FETCHING (INLINE DURING SCAN)
// =============================================================================

interface HolderResult {
  holderCount: number;
  buyerPosition?: number;
  source?: string;
}

/**
 * Fetch accurate holder counts using prioritized APIs:
 * 
 * REFACTORED: Birdeye deprioritized to reduce paid API usage by ~60%.
 * 
 * Priority order (cheapest first):
 * 1. Helius getTokenAccounts (free with Helius key, accurate)
 * 2. Helius DAS getAsset (free, may have holder_count)
 * 3. Birdeye Token Overview (PAID - only for high-liquidity tokens as fallback)
 * 4. RPC getTokenLargestAccounts (free, capped at 20)
 * 
 * Birdeye is ONLY called when:
 * - Helius strategies fail or return 0
 * - Token has liquidity data suggesting it's worth the API cost
 */
async function fetchHolderDataBatch(
  tokenAddresses: string[],
  tokenLiquidityMap?: Record<string, number>
): Promise<Record<string, HolderResult>> {
  const results: Record<string, HolderResult> = {};
  
  if (tokenAddresses.length === 0) return results;
  
  // Use shared getApiKey - checks admin-saved DB key first, then env fallback
  const rpcUrl = await getApiKey('rpc_provider') || 'https://api.mainnet-beta.solana.com';
  const heliusApiKey = await getApiKey('helius');
  const birdeyeApiKey = await getApiKey('birdeye');
  
  // Track Birdeye calls for metrics
  let birdeyeCallCount = 0;
  let heliusHitCount = 0;
  let rpcHitCount = 0;
  
  // Minimum liquidity to warrant a Birdeye call (Tier B threshold)
  const BIRDEYE_MIN_LIQUIDITY_USD = 15000;
  
  // Process tokens in parallel batches of 10
  const batchSize = 10;
  
  for (let i = 0; i < tokenAddresses.length; i += batchSize) {
    const batch = tokenAddresses.slice(i, i + batchSize);
    
    const batchResults = await Promise.allSettled(
      batch.map(async (address): Promise<{ address: string } & HolderResult> => {
        try {
          // ── Strategy 1: Helius getTokenAccounts (FREE, accurate) ──
          if (heliusApiKey) {
            try {
              const heliusRes = await fetch(`https://mainnet.helius-rpc.com/?api-key=${heliusApiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  jsonrpc: '2.0',
                  id: 1,
                  method: 'getTokenAccounts',
                  params: {
                    mint: address,
                    limit: 1000,
                    options: { showZeroBalance: false },
                  },
                }),
                signal: AbortSignal.timeout(4000),
              });
              
              if (heliusRes.ok) {
                const hData = await heliusRes.json();
                const accounts = hData?.result?.token_accounts;
                if (Array.isArray(accounts)) {
                  const activeHolders = accounts.filter(
                    (a: { amount?: number }) => a.amount && a.amount > 0
                  );
                  const holderCount = activeHolders.length;
                  
                  if (holderCount > 0) {
                    heliusHitCount++;
                    return {
                      address,
                      holderCount,
                      buyerPosition: holderCount + 1,
                      source: 'helius',
                    };
                  }
                }
              }
            } catch {
              // Helius failed, continue
            }
          }

          // ── Strategy 2: Helius DAS getAsset (FREE, may have holder_count) ──
          if (heliusApiKey) {
            try {
              const dasRes = await fetch(`https://mainnet.helius-rpc.com/?api-key=${heliusApiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  jsonrpc: '2.0',
                  id: 1,
                  method: 'getAsset',
                  params: { id: address },
                }),
                signal: AbortSignal.timeout(3000),
              });
              
              if (dasRes.ok) {
                const data = await dasRes.json();
                const holderCount = data?.result?.token_info?.holder_count;
                if (typeof holderCount === 'number' && holderCount > 0) {
                  heliusHitCount++;
                  return { address, holderCount, buyerPosition: holderCount + 1, source: 'helius-das' };
                }
              }
            } catch {
              // DAS failed, continue
            }
          }

          // ── Strategy 3: Birdeye (PAID - only for high-liquidity tokens) ──
          // Only call Birdeye if:
          // - API key exists
          // - Token liquidity >= $15,000 (Tier B+) OR liquidity unknown
          const tokenLiquidity = tokenLiquidityMap?.[address];
          const shouldCallBirdeye = birdeyeApiKey && (
            tokenLiquidity === undefined || 
            tokenLiquidity >= BIRDEYE_MIN_LIQUIDITY_USD
          );
          
          if (shouldCallBirdeye) {
            try {
              const birdeyeRes = await fetch(
                `https://public-api.birdeye.so/defi/token_overview?address=${address}`,
                {
                  headers: {
                    'X-API-KEY': birdeyeApiKey!,
                    'x-chain': 'solana',
                    'Accept': 'application/json',
                  },
                  signal: AbortSignal.timeout(3000),
                }
              );
              
              if (birdeyeRes.ok) {
                const bData = await birdeyeRes.json();
                const overview = bData?.data;
                const holderCount = overview?.holder 
                  ?? overview?.uniqueWallet24h 
                  ?? overview?.uniqueWallet30m;
                
                if (typeof holderCount === 'number' && holderCount > 0) {
                  birdeyeCallCount++;
                  return { 
                    address, 
                    holderCount, 
                    buyerPosition: holderCount + 1,
                    source: 'birdeye',
                  };
                }
              }
              birdeyeCallCount++; // Count even failed calls
            } catch {
              birdeyeCallCount++;
              // Birdeye failed, continue to RPC fallback
            }
          }

          // ── Strategy 4: RPC getTokenLargestAccounts (FREE, capped at 20) ──
          const rpcResponse = await fetch(rpcUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              jsonrpc: '2.0',
              id: 1,
              method: 'getTokenLargestAccounts',
              params: [address],
            }),
            signal: AbortSignal.timeout(3000),
          });
          
          if (rpcResponse.ok) {
            const data = await rpcResponse.json();
            const accounts = data?.result?.value?.filter(
              (acc: { amount: string }) => parseFloat(acc.amount) > 0
            ) || [];
            const count = accounts.length;
            const isCapped = count >= 20;
            rpcHitCount++;
            
            return { 
              address, 
              holderCount: count,
              buyerPosition: count > 0 ? count + 1 : 1,
              source: isCapped ? 'rpc-capped' : 'rpc',
            };
          }
          
          return { address, holderCount: 0, buyerPosition: 1, source: 'none' };
        } catch {
          return { address, holderCount: 0, buyerPosition: 1, source: 'error' };
        }
      })
    );
    
    for (const result of batchResults) {
      if (result.status === 'fulfilled' && result.value) {
        const { address, holderCount, buyerPosition, source } = result.value;
        results[address] = { holderCount, buyerPosition, source };
      }
    }
  }
  
  // Log source distribution and Birdeye usage reduction
  const sources: Record<string, number> = {};
  for (const r of Object.values(results)) {
    const s = (r as { source?: string }).source || 'unknown';
    sources[s] = (sources[s] || 0) + 1;
  }
  const totalTokens = tokenAddresses.length;
  const birdeyeReduction = totalTokens > 0 
    ? ((totalTokens - birdeyeCallCount) / totalTokens * 100).toFixed(0) 
    : '100';
  console.log(`[HardFilter] Holder data: ${Object.keys(results).length}/${totalTokens} tokens | Birdeye calls: ${birdeyeCallCount} (${birdeyeReduction}% reduction) | Helius: ${heliusHitCount} | RPC: ${rpcHitCount} | Sources:`, sources);
  return results;
}
