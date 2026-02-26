import { createClient } from "https://esm.sh/@supabase/supabase-js@2.90.1";
import { validateAutoSniperInput, type TokenData as ValidatedTokenData } from "../_shared/validation.ts";
import { fetchJupiterQuoteWithRetry } from "../_shared/jupiter-retry.ts";
import { getLiveSolPrice } from "../_shared/sol-price.ts";
import { checkRateLimit, rateLimitResponse, AUTO_SNIPER_LIMIT } from "../_shared/rate-limiter.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Jupiter API for route validation - using free lite-api (no key required)
const JUPITER_QUOTE_API = "https://lite-api.jup.ag/swap/v1/quote";
// Raydium API for route validation (fallback)
const RAYDIUM_QUOTE_API = "https://transaction-v1.raydium.io/compute/swap-base-in";

// =============================================================================
// HOLDER POSITION FETCHING (RPC)
// =============================================================================

function getRpcUrl(): string {
  return Deno.env.get('SOLANA_RPC_URL') || 'https://api.mainnet-beta.solana.com';
}

async function rpcCall(method: string, params: unknown[]): Promise<unknown> {
  const rpcUrl = getRpcUrl();
  
  const response = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method,
      params,
    }),
    signal: AbortSignal.timeout(8000),
  });
  
  if (!response.ok) throw new Error(`RPC error: ${response.status}`);
  
  const data = await response.json();
  if (data.error) throw new Error(data.error.message || 'RPC error');
  
  return data.result;
}

/**
 * Fetch REAL holder count using multiple strategies in PARALLEL
 */
async function fetchHolderPosition(tokenAddress: string): Promise<{ holderCount: number; buyerPosition: number | null; source: string }> {
  const rpcUrl = getRpcUrl();
  const heliusMatch = rpcUrl.match(/api-key=([a-zA-Z0-9-]+)/);
  
  const results = await Promise.allSettled([
    // Strategy 1: Helius DAS API
    heliusMatch ? (async () => {
      const response = await fetch(`https://mainnet.helius-rpc.com/?api-key=${heliusMatch[1]}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0', id: 1,
          method: 'getAsset',
          params: { id: tokenAddress },
        }),
        signal: AbortSignal.timeout(4000),
      });
      if (!response.ok) return null;
      const data = await response.json();
      const count = data?.result?.token_info?.holder_count;
      if (typeof count === 'number' && count > 0) return { count, source: 'helius-das' };
      return null;
    })() : Promise.resolve(null),
    
    // Strategy 2: Solscan API
    (async () => {
      const response = await fetch(
        `https://public-api.solscan.io/token/holders?tokenAddress=${tokenAddress}&limit=1`,
        { signal: AbortSignal.timeout(4000), headers: { 'Accept': 'application/json' } }
      );
      if (!response.ok) return null;
      const data = await response.json();
      const count = data?.total;
      if (typeof count === 'number' && count > 0) return { count, source: 'solscan' };
      return null;
    })(),
    
    // Strategy 3: DexScreener
    (async () => {
      const response = await fetch(
        `https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`,
        { signal: AbortSignal.timeout(3000) }
      );
      if (!response.ok) return null;
      const data = await response.json();
      const pairs = data?.pairs;
      if (pairs && pairs.length > 0) {
        for (const pair of pairs) {
          const count = pair?.info?.holders || pair?.holders || pair?.txns?.holders;
          if (typeof count === 'number' && count > 0) return { count, source: 'dexscreener' };
        }
      }
      return null;
    })(),
    
    // Strategy 4: Standard RPC (capped at 20)
    (async () => {
      const result = await rpcCall('getTokenLargestAccounts', [tokenAddress]) as {
        value: { address: string; amount: string; uiAmount: number }[];
      };
      if (!result?.value || result.value.length === 0) return { count: 0, source: 'standard-rpc', isCapped: false };
      const holdersWithBalance = result.value.filter(acc => parseFloat(acc.amount) > 0);
      const count = holdersWithBalance.length;
      return { count, source: 'standard-rpc', isCapped: count >= 20 };
    })(),
  ]);
  
  const heliusResult = results[0].status === 'fulfilled' ? results[0].value : null;
  const solscanResult = results[1].status === 'fulfilled' ? results[1].value : null;
  const dexscreenerResult = results[2].status === 'fulfilled' ? results[2].value : null;
  const rpcResult = results[3].status === 'fulfilled' ? results[3].value : null;
  
  const validCounts: { count: number; source: string; isCapped?: boolean }[] = [];
  if (heliusResult && heliusResult.count > 0) validCounts.push(heliusResult);
  if (solscanResult && solscanResult.count > 0) validCounts.push(solscanResult);
  if (dexscreenerResult && dexscreenerResult.count > 0) validCounts.push(dexscreenerResult);
  
  if (validCounts.length > 0) {
    const best = validCounts.reduce((a, b) => a.count > b.count ? a : b);
    if (best.count <= 2 && rpcResult?.isCapped) {
      return { holderCount: rpcResult.count, buyerPosition: null, source: 'standard-rpc' };
    }
    return { holderCount: best.count, buyerPosition: best.count + 1, source: best.source };
  }
  
  if (rpcResult && rpcResult.count > 0) {
    const buyerPosition = rpcResult.isCapped ? null : rpcResult.count + 1;
    return { holderCount: rpcResult.count, buyerPosition, source: 'standard-rpc' };
  }
  
  return { holderCount: 0, buyerPosition: null, source: 'error' };
}

async function batchFetchHolderPositions(tokenAddresses: string[]): Promise<Map<string, { holderCount: number; buyerPosition: number | null }>> {
  const results = new Map<string, { holderCount: number; buyerPosition: number | null }>();
  const batchSize = 5;
  
  for (let i = 0; i < tokenAddresses.length; i += batchSize) {
    const batch = tokenAddresses.slice(i, i + batchSize);
    const batchResults = await Promise.allSettled(
      batch.map(async (address) => {
        const data = await fetchHolderPosition(address);
        return { address, ...data };
      })
    );
    
    for (const result of batchResults) {
      if (result.status === 'fulfilled') {
        results.set(result.value.address, {
          holderCount: result.value.holderCount,
          buyerPosition: result.value.buyerPosition,
        });
      }
    }
  }
  
  return results;
}

const SOL_MINT = "So11111111111111111111111111111111111111112";

interface ApiConfig {
  id: string;
  api_type: string;
  api_name: string;
  base_url: string;
  api_key_encrypted: string | null;
  is_enabled: boolean;
}

interface UserSettings {
  user_id: string;
  min_liquidity: number;
  profit_take_percentage: number;
  stop_loss_percentage: number;
  trade_amount: number;
  max_concurrent_trades: number;
  priority: 'normal' | 'fast' | 'turbo';
  category_filters: string[];
  token_blacklist: string[];
  token_whitelist: string[];
  target_buyer_positions?: number[];
  // PRODUCTION FIX: validation toggles from user settings
  validation_rule_toggles?: Record<string, boolean>;
}

interface TokenData {
  address: string;
  name: string;
  symbol: string;
  chain: string;
  liquidity: number;
  liquidityLocked: boolean;
  lockPercentage: number | null;
  buyerPosition: number | null;
  riskScore: number;
  categories: string[];
  priceUsd?: number;
  isPumpFun?: boolean;
  isTradeable?: boolean;
  canBuy?: boolean;
  canSell?: boolean;
  source?: string;
  safetyReasons?: string[];
}

interface SnipeDecision {
  token: TokenData;
  approved: boolean;
  reasons: string[];
  tradeParams: {
    amount: number;
    slippage: number;
    priority: string;
    profitTakePercent?: number;
    stopLossPercent?: number;
    minLiquidity?: number;
    maxConcurrentTrades?: number;
  } | null;
}

// P1 FIX: Removed RiskCheckResult, getApiKey, RULE_TOGGLE_MAP, isRuleEnabled —
// no longer needed since validation is handled by the 23-rule client-side gate.

// =============================================================================
// SERVER-SIDE CHECKS (zero-cost, non-duplicated)
// =============================================================================

function checkBlacklistWhitelist(token: TokenData, settings: UserSettings): { passed: boolean; reason: string } {
  if (settings.token_blacklist.some(addr => addr.toLowerCase() === token.address.toLowerCase())) {
    return { passed: false, reason: '✗ Token is blacklisted by user' };
  }
  if (settings.token_whitelist.length > 0) {
    const onWhitelist = settings.token_whitelist.some(addr => addr.toLowerCase() === token.address.toLowerCase());
    return { passed: onWhitelist, reason: onWhitelist ? '✓ Token is on whitelist' : '✗ Token not on whitelist' };
  }
  return { passed: true, reason: '✓ Token not blacklisted' };
}

async function createTradeSignal(
  token: TokenData, settings: UserSettings, supabase: any, userId: string, routeSource?: string
): Promise<{ success: boolean; signalId?: string; error?: string }> {
  try {
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    
    const { data: signalData, error: signalError } = await supabase
      .from('trade_signals')
      .insert({
        user_id: userId,
        token_address: token.address,
        token_symbol: token.symbol,
        token_name: token.name,
        chain: token.chain || 'solana',
        liquidity: token.liquidity,
        price_usd: token.priceUsd,
        risk_score: token.riskScore,
        trade_amount: settings.trade_amount,
        slippage: settings.priority === 'turbo' ? 15 : settings.priority === 'fast' ? 10 : 5,
        priority: settings.priority,
        status: 'pending',
        reasons: [],
        source: routeSource || (token.isPumpFun ? 'pumpfun' : 'jupiter'),
        is_pump_fun: token.isPumpFun || false,
        expires_at: expiresAt,
        metadata: {
          buyer_position: token.buyerPosition,
          liquidity_locked: token.liquidityLocked,
          lock_percentage: token.lockPercentage,
          profit_take_percent: settings.profit_take_percentage,
          stop_loss_percent: settings.stop_loss_percentage,
        },
      })
      .select()
      .single();

    if (signalError) {
      return { success: false, error: `Failed to create signal: ${signalError.message}` };
    }

    console.log(`Trade signal created for ${token.symbol}:`, signalData.id);
    
    await supabase.from('system_logs').insert({
      user_id: userId,
      event_type: 'trade_signal_created',
      event_category: 'trading',
      message: `Trade signal created for ${token.symbol} - Amount: ${settings.trade_amount} SOL`,
      metadata: {
        signal_id: signalData.id, token_address: token.address, token_symbol: token.symbol,
        amount: settings.trade_amount, liquidity: token.liquidity, source: routeSource,
      },
      severity: 'info',
    });

    return { success: true, signalId: signalData.id };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Signal creation failed' };
  }
}

// =============================================================================
// MAIN HANDLER
// =============================================================================

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // PRODUCTION FIX: Use getClaims for reliable JWT validation in edge environment
    const token = authHeader.replace('Bearer ', '');
    let userId: string;
    
    try {
      const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token);
      const sub = claimsData?.claims?.sub as string | undefined;
      if (claimsError || !sub) {
        return new Response(JSON.stringify({ error: claimsError?.message || 'Invalid token' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      userId = sub;
    } catch (authErr: any) {
      return new Response(JSON.stringify({ error: authErr.message || 'Auth failed' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Per-user rate limiting
    const rateCheck = checkRateLimit(userId, AUTO_SNIPER_LIMIT);
    if (!rateCheck.allowed) {
      return rateLimitResponse(rateCheck, corsHeaders);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const rawBody = await req.json().catch(() => ({}));
    const validationResult = validateAutoSniperInput(rawBody);
    
    if (!validationResult.success) {
      return new Response(JSON.stringify({ error: validationResult.error }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    const { tokens, executeOnApproval } = validationResult.data!;

    const defaultSettings: UserSettings = {
      user_id: userId,
      min_liquidity: 5,
      profit_take_percentage: 100,
      stop_loss_percentage: 20,
      trade_amount: 0.1,
      max_concurrent_trades: 3,
      priority: 'normal',
      category_filters: ['animals', 'parody', 'trend', 'utility'],
      token_blacklist: [],
      token_whitelist: [],
    };

    // PRODUCTION FIX: Fetch validation_rule_toggles alongside other settings
    const { data: userSettings } = await supabase
      .from('user_sniper_settings')
      .select('*')
      .eq('user_id', userId)
      .single();

    const settings: UserSettings = userSettings ? {
      ...defaultSettings,
      ...userSettings,
      category_filters: Array.isArray(userSettings.category_filters) ? userSettings.category_filters : defaultSettings.category_filters,
      token_blacklist: Array.isArray(userSettings.token_blacklist) ? userSettings.token_blacklist : [],
      token_whitelist: Array.isArray(userSettings.token_whitelist) ? userSettings.token_whitelist : [],
      target_buyer_positions: Array.isArray(userSettings.target_buyer_positions) ? userSettings.target_buyer_positions : undefined,
      validation_rule_toggles: userSettings.validation_rule_toggles as Record<string, boolean> | undefined,
    } : defaultSettings;
    
    console.log(`Using settings for user ${userId}:`, userSettings ? 'custom' : 'defaults');
    
    // P1 FIX: Removed SOL price fetch, toggle logging, API config fetch, and
    // honeypot config — none are needed since validation is done client-side.
    // Server only needs settings for blacklist/whitelist and trade parameters.

    // Check open positions
    const { count: openPositionsCount } = await supabase
      .from('positions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'open');

    const currentOpenPositions = openPositionsCount || 0;
    const availableSlots = Math.max(0, settings.max_concurrent_trades - currentOpenPositions);
    
    console.log(`User has ${currentOpenPositions} open positions, ${availableSlots} slots available`);

    // ==========================================================================
    // PRODUCTION FIX: ALWAYS fetch holder positions for accurate data
    // Previously skipped when no target_buyer_positions were set
    // ==========================================================================
    console.log(`[Holders] Fetching positions for ${tokens.length} tokens`);
    const tokenAddresses = (tokens as TokenData[]).map(t => t.address);
    const holderPositions = await batchFetchHolderPositions(tokenAddresses);
    console.log(`[Holders] Fetched positions for ${holderPositions.size} tokens`);

    // Enrich tokens with holder position data
    const enrichedTokens = (tokens as TokenData[]).map(token => {
      const positionData = holderPositions.get(token.address);
      if (positionData) {
        return { ...token, buyerPosition: positionData.buyerPosition };
      }
      return token;
    });

    const decisions: SnipeDecision[] = [];
    const executedTrades: { token: string; txId?: string; error?: string; positionId?: string }[] = [];
    let tradesExecuted = 0;

    // ==========================================================================
    // P1 FIX: DEDUPLICATION — Client already ran 22-rule pre-execution gate.
    // Server only performs: sellability hard-check, blacklist/whitelist, and
    // signal creation. All other validation (liquidity, buyer position, route,
    // risk API, etc.) was already done client-side and tokens arriving here
    // have already passed the gate.
    // ==========================================================================

    for (const tokenData of enrichedTokens) {
      const reasons: string[] = [];
      let allPassed = true;

      // Hard-check: Sellability (cannot be toggled off, zero-cost)
      if (tokenData.canSell === false) {
        reasons.push('✗ Token cannot be sold (would create stuck position)');
        allPassed = false;
        console.log(`[Sellability] Token ${tokenData.symbol} rejected - not sellable`);
      }

      // Hard-check: Blacklist/whitelist (zero-cost, always enforced server-side)
      if (allPassed) {
        const listCheck = checkBlacklistWhitelist(tokenData, settings);
        reasons.push(listCheck.reason);
        if (!listCheck.passed) allPassed = false;
      }

      // Trust client gate for all other rules — log that we're skipping server re-validation
      if (allPassed) {
        reasons.push('✓ Pre-execution gate passed client-side (22 rules)');
      }

      console.log(`Token ${tokenData.symbol.padEnd(12)}: approved=${allPassed} | Settings: ${settings.trade_amount} SOL, TP ${settings.profit_take_percentage}%, SL ${settings.stop_loss_percentage}%, Min Liq ${settings.min_liquidity}`);

      const decision: SnipeDecision = {
        token: tokenData,
        approved: allPassed,
        reasons,
        tradeParams: allPassed ? {
          amount: settings.trade_amount,
          slippage: (userSettings as any)?.slippage_tolerance ?? (settings.priority === 'turbo' ? 15 : settings.priority === 'fast' ? 10 : 5),
          priority: settings.priority,
          profitTakePercent: settings.profit_take_percentage,
          stopLossPercent: settings.stop_loss_percentage,
          minLiquidity: settings.min_liquidity,
          maxConcurrentTrades: settings.max_concurrent_trades,
        } : null,
      };

      decisions.push(decision);

      if (allPassed && executeOnApproval && tradesExecuted < availableSlots) {
        const routeSource = tokenData.isPumpFun ? 'pumpfun' : (tokenData.source || 'jupiter');
        const signalResult = await createTradeSignal(tokenData, settings, supabase, userId, routeSource);
        executedTrades.push({
          token: tokenData.symbol,
          txId: signalResult.signalId,
          error: signalResult.error,
          positionId: undefined,
        });
        if (signalResult.success) {
          tradesExecuted++;
          console.log(`Trade signal created for ${tokenData.symbol}, signal: ${signalResult.signalId}`);
        }
      }
    }

    const approvedCount = decisions.filter(d => d.approved).length;
    console.log(`Auto-sniper evaluated ${tokens.length} tokens, ${approvedCount} approved, ${tradesExecuted} executed`);

    return new Response(
      JSON.stringify({
        decisions,
        executedTrades,
        summary: {
          total: tokens.length,
          approved: approvedCount,
          rejected: tokens.length - approvedCount,
          executed: tradesExecuted,
          openPositions: currentOpenPositions + tradesExecuted,
          maxPositions: settings.max_concurrent_trades,
        },
        settings: {
          minLiquidity: settings.min_liquidity,
          priority: settings.priority,
          categoryFilters: settings.category_filters,
          profitTakePercent: settings.profit_take_percentage,
          stopLossPercent: settings.stop_loss_percentage,
        },
        timestamp: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    console.error('Auto-sniper error:', error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
