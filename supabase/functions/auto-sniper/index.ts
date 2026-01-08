import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

// Execute trade via third-party API
async function executeTradeViaApi(
  token: TokenData,
  settings: UserSettings,
  tradeExecutionConfig: ApiConfig
): Promise<{ success: boolean; txId?: string; error?: string }> {
  try {
    console.log(`Executing trade for ${token.symbol} via ${tradeExecutionConfig.api_name}`);
    
    const tradePayload = {
      tokenAddress: token.address,
      chain: token.chain,
      action: 'buy',
      amount: settings.trade_amount,
      slippage: settings.priority === 'turbo' ? 15 : settings.priority === 'fast' ? 10 : 5,
      priority: settings.priority,
      takeProfitPercent: settings.profit_take_percentage,
      stopLossPercent: settings.stop_loss_percentage,
    };

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    if (tradeExecutionConfig.api_key_encrypted) {
      headers['Authorization'] = `Bearer ${tradeExecutionConfig.api_key_encrypted}`;
    }

    const response = await fetch(`${tradeExecutionConfig.base_url}/trade/execute`, {
      method: 'POST',
      headers,
      body: JSON.stringify(tradePayload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, error: `Trade API error: ${errorText}` };
    }

    const result = await response.json();
    return { 
      success: true, 
      txId: result.transactionId || result.txId || 'pending',
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

    const body = await req.json().catch(() => ({}));
    const { tokens = [], executeOnApproval = false } = body;

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

    const decisions: SnipeDecision[] = [];
    const executedTrades: { token: string; txId?: string; error?: string }[] = [];

    // Evaluate each token against the rules
    for (const token of tokens as TokenData[]) {
      const reasons: string[] = [];
      let allPassed = true;

      // Rule 1: Liquidity check
      const liquidityCheck = checkLiquidity(token, settings);
      reasons.push(liquidityCheck.reason);
      if (!liquidityCheck.passed) allPassed = false;

      // Rule 2: Liquidity lock check
      const lockCheck = checkLiquidityLock(token);
      reasons.push(lockCheck.reason);
      if (!lockCheck.passed) allPassed = false;

      // Rule 3: Category filter check
      const categoryCheck = checkCategoryMatch(token, settings);
      reasons.push(categoryCheck.reason);
      if (!categoryCheck.passed) allPassed = false;

      // Rule 4: Buyer position check
      const positionCheck = checkBuyerPosition(token);
      reasons.push(positionCheck.reason);
      if (!positionCheck.passed) allPassed = false;

      // Check blacklist/whitelist
      const listCheck = checkBlacklistWhitelist(token, settings);
      reasons.push(listCheck.reason);
      if (!listCheck.passed) allPassed = false;

      // Rule 5: Risk API check (only if other rules pass to save API calls)
      if (allPassed) {
        const riskCheck = await checkRiskApproval(token, honeypotConfig);
        reasons.push(riskCheck.reason);
        if (!riskCheck.passed) allPassed = false;

        // Update token with risk data
        if (riskCheck.riskData) {
          token.liquidityLocked = riskCheck.riskData.liquidityLocked;
          token.lockPercentage = riskCheck.riskData.lockPercentage;
          token.riskScore = riskCheck.riskData.riskScore;
        }
      }

      const decision: SnipeDecision = {
        token,
        approved: allPassed,
        reasons,
        tradeParams: allPassed ? {
          amount: settings.trade_amount,
          slippage: settings.priority === 'turbo' ? 15 : settings.priority === 'fast' ? 10 : 5,
          priority: settings.priority,
        } : null,
      };

      decisions.push(decision);

      // Execute trade if approved and execution is enabled
      if (allPassed && executeOnApproval && tradeExecutionConfig) {
        const tradeResult = await executeTradeViaApi(token, settings, tradeExecutionConfig);
        executedTrades.push({
          token: token.symbol,
          txId: tradeResult.txId,
          error: tradeResult.error,
        });
      }
    }

    const approvedCount = decisions.filter(d => d.approved).length;
    console.log(`Auto-sniper evaluated ${tokens.length} tokens, ${approvedCount} approved`);

    return new Response(
      JSON.stringify({
        decisions,
        executedTrades,
        summary: {
          total: tokens.length,
          approved: approvedCount,
          rejected: tokens.length - approvedCount,
          executed: executedTrades.filter(t => t.txId).length,
        },
        settings: {
          minLiquidity: settings.min_liquidity,
          priority: settings.priority,
          categoryFilters: settings.category_filters,
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
