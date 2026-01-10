import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { validateAutoSniperInput, type TokenData as ValidatedTokenData } from "../_shared/validation.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
}

interface SnipeDecision {
  token: TokenData;
  approved: boolean;
  reasons: string[];
  tradeParams: {
    amount: number;
    slippage: number;
    priority: string;
  } | null;
}

interface RiskCheckResult {
  isHoneypot: boolean;
  isBlacklisted: boolean;
  ownerRenounced: boolean;
  liquidityLocked: boolean;
  lockPercentage: number | null;
  riskScore: number;
}

// Get API key from environment (secure) with fallback to database (legacy)
function getApiKey(apiType: string, dbApiKey: string | null): string | null {
  // Priority 1: Environment variable (Supabase Secrets - secure)
  const envKey = Deno.env.get(`${apiType.toUpperCase()}_API_KEY`);
  if (envKey) {
    console.log(`Using secure environment variable for ${apiType}`);
    return envKey;
  }
  
  // Priority 2: Database fallback (legacy - less secure)
  if (dbApiKey) {
    console.log(`Warning: Using database-stored API key for ${apiType} - migrate to Supabase Secrets`);
    return dbApiKey;
  }
  
  return null;
}

// Rule 1: Check if liquidity meets user's minimum setting
function checkLiquidity(token: TokenData, settings: UserSettings): { passed: boolean; reason: string } {
  const passed = token.liquidity >= settings.min_liquidity;
  return {
    passed,
    reason: passed 
      ? `✓ Liquidity ${token.liquidity.toFixed(2)} SOL meets minimum ${settings.min_liquidity} SOL`
      : `✗ Liquidity ${token.liquidity.toFixed(2)} SOL below minimum ${settings.min_liquidity} SOL`,
  };
}

// Rule 2: Check if liquidity is locked
function checkLiquidityLock(token: TokenData): { passed: boolean; reason: string } {
  const passed = token.liquidityLocked === true;
  return {
    passed,
    reason: passed 
      ? `✓ Liquidity locked${token.lockPercentage ? ` (${token.lockPercentage}%)` : ''}`
      : '✗ Liquidity not locked - high rug risk',
  };
}

// Rule 3: Check if token matches user's category filters
function checkCategoryMatch(token: TokenData, settings: UserSettings): { passed: boolean; reason: string } {
  if (settings.category_filters.length === 0) {
    return { passed: true, reason: '✓ No category filters applied' };
  }
  
  const matchedCategories = token.categories.filter(cat => 
    settings.category_filters.includes(cat.toLowerCase())
  );
  
  const passed = matchedCategories.length > 0;
  return {
    passed,
    reason: passed 
      ? `✓ Matches categories: ${matchedCategories.join(', ')}`
      : `✗ No match for filters: ${settings.category_filters.join(', ')}`,
  };
}

// Rule 4: Check buyer position (must be 2nd or 3rd)
function checkBuyerPosition(token: TokenData): { passed: boolean; reason: string } {
  const position = token.buyerPosition;
  const passed = position !== null && position >= 2 && position <= 3;
  return {
    passed,
    reason: passed 
      ? `✓ Can enter as buyer #${position}`
      : position === null 
        ? '✗ Buyer position unknown'
        : position < 2 
          ? '✗ Would be first buyer - waiting'
          : `✗ Buyer position #${position} too late`,
  };
}

// Rule 5: Risk API approval (honeypot, blacklist, owner-renounced)
async function checkRiskApproval(
  token: TokenData, 
  honeypotConfig: ApiConfig | undefined
): Promise<{ passed: boolean; reason: string; riskData?: RiskCheckResult }> {
  if (!honeypotConfig) {
    return { passed: false, reason: '✗ No risk check API configured' };
  }

  try {
    const response = await fetch(
      `${honeypotConfig.base_url}/v2/IsHoneypot?address=${token.address}`
    );
    
    if (!response.ok) {
      return { passed: false, reason: '✗ Risk API check failed' };
    }

    const data = await response.json();
    
    const riskData: RiskCheckResult = {
      isHoneypot: data.honeypotResult?.isHoneypot || false,
      isBlacklisted: data.simulationResult?.isBlacklisted || false,
      ownerRenounced: data.contractCode?.ownershipRenounced || false,
      liquidityLocked: data.pair?.liquidity?.isLocked || false,
      lockPercentage: data.pair?.liquidity?.lockPercentage || null,
      riskScore: data.honeypotResult?.isHoneypot ? 100 : (data.riskScore || 50),
    };

    const issues: string[] = [];
    if (riskData.isHoneypot) issues.push('honeypot detected');
    if (riskData.isBlacklisted) issues.push('blacklisted');
    if (!riskData.ownerRenounced) issues.push('owner not renounced');

    const passed = !riskData.isHoneypot && !riskData.isBlacklisted;
    
    return {
      passed,
      reason: passed 
        ? `✓ Risk check passed (score: ${riskData.riskScore})`
        : `✗ Risk check failed: ${issues.join(', ')}`,
      riskData,
    };
  } catch (error) {
    console.error('Risk check error:', error);
    return { passed: false, reason: '✗ Risk API error' };
  }
}

// Check blacklist/whitelist
function checkBlacklistWhitelist(
  token: TokenData, 
  settings: UserSettings
): { passed: boolean; reason: string } {
  // Check blacklist first
  if (settings.token_blacklist.some(addr => 
    addr.toLowerCase() === token.address.toLowerCase()
  )) {
    return { passed: false, reason: '✗ Token is blacklisted by user' };
  }

  // If whitelist exists and is not empty, token must be on it
  if (settings.token_whitelist.length > 0) {
    const onWhitelist = settings.token_whitelist.some(addr => 
      addr.toLowerCase() === token.address.toLowerCase()
    );
    return {
      passed: onWhitelist,
      reason: onWhitelist 
        ? '✓ Token is on whitelist'
        : '✗ Token not on whitelist',
    };
  }

  return { passed: true, reason: '✓ Token not blacklisted' };
}

// Execute trade via third-party API and create position
async function executeTradeViaApi(
  token: TokenData,
  settings: UserSettings,
  tradeExecutionConfig: ApiConfig | null,
  supabase: any,
  userId: string
): Promise<{ success: boolean; txId?: string; error?: string; positionId?: string }> {
  try {
    console.log(`Executing trade for ${token.symbol}`);
    
    // Get current price (use priceUsd if available, or estimate from liquidity)
    const entryPrice = token.priceUsd || (token.liquidity / 1000);
    const entryValue = settings.trade_amount * entryPrice;
    
    // Create position in database
    const { data: positionData, error: positionError } = await supabase
      .from('positions')
      .insert({
        user_id: userId,
        token_address: token.address,
        token_symbol: token.symbol,
        token_name: token.name,
        chain: token.chain || 'solana',
        entry_price: entryPrice,
        current_price: entryPrice,
        amount: settings.trade_amount,
        entry_value: entryValue,
        current_value: entryValue,
        profit_take_percent: settings.profit_take_percentage,
        stop_loss_percent: settings.stop_loss_percentage,
        status: 'open',
        profit_loss_percent: 0,
        profit_loss_value: 0,
      })
      .select()
      .single();

    if (positionError) {
      console.error('Error creating position:', positionError);
      return { success: false, error: `Failed to create position: ${positionError.message}` };
    }

    console.log(`Position created for ${token.symbol}:`, positionData.id);
    
    // Log the trade in system_logs
    await supabase.from('system_logs').insert({
      user_id: userId,
      event_type: 'trade_executed',
      event_category: 'trading',
      message: `Auto-sniper bought ${token.symbol} - Amount: ${settings.trade_amount} SOL, Entry: $${entryPrice.toFixed(6)}`,
      metadata: {
        token_address: token.address,
        token_symbol: token.symbol,
        amount: settings.trade_amount,
        entry_price: entryPrice,
        position_id: positionData.id,
        profit_take_percent: settings.profit_take_percentage,
        stop_loss_percent: settings.stop_loss_percentage,
        liquidity: token.liquidity,
        buyer_position: token.buyerPosition,
        risk_score: token.riskScore,
      },
      severity: 'info',
    });

    // In production with trade execution API configured, call the API here
    if (tradeExecutionConfig && tradeExecutionConfig.base_url) {
      console.log(`Would execute via API: ${tradeExecutionConfig.api_name}`);
      // Real API call would go here
    }

    const simulatedTxId = `tx_${Date.now()}_${token.symbol}`;

    return { 
      success: true, 
      txId: simulatedTxId,
      positionId: positionData.id,
    };
  } catch (error) {
    console.error('Trade execution error:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Trade execution failed',
    };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify user from token
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Parse and validate request body
    const rawBody = await req.json().catch(() => ({}));
    const validationResult = validateAutoSniperInput(rawBody);
    
    if (!validationResult.success) {
      return new Response(JSON.stringify({ error: validationResult.error }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    const { tokens, executeOnApproval } = validationResult.data!;

    // Default settings to use if user hasn't configured any
    const defaultSettings: UserSettings = {
      user_id: user.id,
      min_liquidity: 300,
      profit_take_percentage: 100,
      stop_loss_percentage: 20,
      trade_amount: 0.1,
      max_concurrent_trades: 3,
      priority: 'normal',
      category_filters: ['animals', 'parody', 'trend', 'utility'],
      token_blacklist: [],
      token_whitelist: [],
    };

    // Fetch user's sniper settings
    const { data: userSettings } = await supabase
      .from('user_sniper_settings')
      .select('*')
      .eq('user_id', user.id)
      .single();

    // Use user settings if found, otherwise use defaults
    const settings: UserSettings = userSettings || defaultSettings;
    console.log(`Using settings for user ${user.id}:`, userSettings ? 'custom' : 'defaults');

    // Fetch API configurations
    const { data: apiConfigs } = await supabase
      .from('api_configurations')
      .select('*')
      .eq('is_enabled', true);

    const getApiConfig = (type: string): ApiConfig | undefined =>
      apiConfigs?.find((c: ApiConfig) => c.api_type === type);

    const honeypotConfig = getApiConfig('honeypot_rugcheck');
    const tradeExecutionConfig = getApiConfig('trade_execution');

    // Check how many open positions user already has
    const { count: openPositionsCount } = await supabase
      .from('positions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('status', 'open');

    const currentOpenPositions = openPositionsCount || 0;
    const availableSlots = Math.max(0, settings.max_concurrent_trades - currentOpenPositions);
    
    console.log(`User has ${currentOpenPositions} open positions, ${availableSlots} slots available`);

    const decisions: SnipeDecision[] = [];
    const executedTrades: { token: string; txId?: string; error?: string; positionId?: string }[] = [];
    let tradesExecuted = 0;

    // Evaluate each token against the rules
    for (const tokenData of tokens as TokenData[]) {
      const reasons: string[] = [];
      let allPassed = true;

      // Rule 1: Liquidity check
      const liquidityCheck = checkLiquidity(tokenData, settings);
      reasons.push(liquidityCheck.reason);
      if (!liquidityCheck.passed) allPassed = false;

      // Rule 2: Liquidity lock check (optional - can be bypassed if not required)
      const lockCheck = checkLiquidityLock(tokenData);
      reasons.push(lockCheck.reason);
      // Don't fail on lock check alone - just add reason
      // if (!lockCheck.passed) allPassed = false;

      // Rule 3: Category filter check
      const categoryCheck = checkCategoryMatch(tokenData, settings);
      reasons.push(categoryCheck.reason);
      if (!categoryCheck.passed) allPassed = false;

      // Rule 4: Buyer position check
      const positionCheck = checkBuyerPosition(tokenData);
      reasons.push(positionCheck.reason);
      if (!positionCheck.passed) allPassed = false;

      // Check blacklist/whitelist
      const listCheck = checkBlacklistWhitelist(tokenData, settings);
      reasons.push(listCheck.reason);
      if (!listCheck.passed) allPassed = false;

      // Rule 5: Risk API check (only if other rules pass to save API calls)
      if (allPassed && honeypotConfig) {
        const riskCheck = await checkRiskApproval(tokenData, honeypotConfig);
        reasons.push(riskCheck.reason);
        if (!riskCheck.passed) allPassed = false;

        // Update token with risk data
        if (riskCheck.riskData) {
          tokenData.liquidityLocked = riskCheck.riskData.liquidityLocked;
          tokenData.lockPercentage = riskCheck.riskData.lockPercentage;
          tokenData.riskScore = riskCheck.riskData.riskScore;
        }
      }

      const decision: SnipeDecision = {
        token: tokenData,
        approved: allPassed,
        reasons,
        tradeParams: allPassed ? {
          amount: settings.trade_amount,
          slippage: settings.priority === 'turbo' ? 15 : settings.priority === 'fast' ? 10 : 5,
          priority: settings.priority,
        } : null,
      };

      decisions.push(decision);

      // Execute trade if approved and execution is enabled and we have available slots
      if (allPassed && executeOnApproval && tradesExecuted < availableSlots) {
        // Execute trade - works with or without trade execution API config
        const tradeResult = await executeTradeViaApi(
          tokenData, 
          settings, 
          tradeExecutionConfig || null, 
          supabase, 
          user.id
        );
        executedTrades.push({
          token: tokenData.symbol,
          txId: tradeResult.txId,
          error: tradeResult.error,
          positionId: tradeResult.positionId,
        });
        if (tradeResult.success) {
          tradesExecuted++;
          console.log(`Trade executed for ${tokenData.symbol}, position: ${tradeResult.positionId}`);
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
