import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.90.1";
import { validateRiskCheckInput } from "../_shared/validation.ts";
import { checkRateLimit, rateLimitResponse, GENERIC_LIMIT } from "../_shared/rate-limiter.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const RISK_CHECK_LIMIT = { ...GENERIC_LIMIT, maxRequests: 15, windowMs: 60_000, functionName: 'risk-check' };

interface RiskSettings {
  emergency_stop_active: boolean;
  circuit_breaker_enabled: boolean;
  circuit_breaker_loss_threshold: number;
  circuit_breaker_time_window_minutes: number;
  circuit_breaker_triggered_at: string | null;
  circuit_breaker_trigger_reason: string | null;
  circuit_breaker_requires_admin_override: boolean;
  circuit_breaker_cooldown_minutes: number;
  circuit_breaker_drawdown_threshold: number;
  circuit_breaker_drawdown_window_minutes: number;
  circuit_breaker_rug_count: number;
  circuit_breaker_tax_count: number;
  circuit_breaker_freeze_count: number;
  max_risk_score: number;
  require_ownership_renounced: boolean;
  require_liquidity_locked: boolean;
  max_tax_percent: number;
}

interface TokenRiskData {
  address: string;
  symbol?: string;
  chain?: string;
}

interface RiskCheckResult {
  token: TokenRiskData;
  passed: boolean;
  riskScore: number;
  checks: {
    honeypot: { passed: boolean; detected: boolean };
    blacklist: { passed: boolean; blacklisted: boolean };
    ownershipRenounced: { passed: boolean; renounced: boolean };
    liquidityLocked: { passed: boolean; locked: boolean; percentage: number | null };
    taxCheck: { passed: boolean; buyTax: number; sellTax: number };
  };
  rejectionReasons: string[];
  circuitBreakerTriggered: boolean;
  emergencyStopActive: boolean;
}

interface CircuitBreakerCheckResult {
  triggered: boolean;
  reason?: string;
  triggerType?: 'drawdown' | 'rug_streak' | 'hidden_tax' | 'frozen_token' | 'cumulative_loss';
  details?: Record<string, unknown>;
}

// Circuit breaker thresholds
const CB_THRESHOLDS = {
  DRAWDOWN_PERCENT: 20,
  DRAWDOWN_WINDOW_MINUTES: 30,
  RUG_COUNT_IN_TRADES: 3,
  TRADES_WINDOW: 10,
  HIDDEN_TAX_COUNT: 2,
  FROZEN_TOKEN_COUNT: 2,
  COOLDOWN_MINUTES: 60,
};

// Get API key from environment (secure) with fallback to database (legacy)
function getApiKey(apiType: string, dbApiKey: string | null): string | null {
  const envKey = Deno.env.get(`${apiType.toUpperCase()}_API_KEY`);
  if (envKey) {
    console.log(`Using secure environment variable for ${apiType}`);
    return envKey;
  }
  if (dbApiKey) {
    console.log(`Warning: Using database-stored API key for ${apiType} - migrate to Supabase Secrets`);
    return dbApiKey;
  }
  return null;
}

// Call Rugcheck/Honeypot API
async function callRugcheckApi(tokenAddress: string, baseUrl: string): Promise<any> {
  try {
    const response = await fetch(`${baseUrl}/v2/IsHoneypot?address=${tokenAddress}`);
    if (!response.ok) throw new Error('Rugcheck API failed');
    return await response.json();
  } catch (error) {
    console.error('Rugcheck API error:', error);
    return null;
  }
}

// Alternative: Call Solana-specific rugcheck
async function callSolanaRugcheck(tokenAddress: string): Promise<any> {
  try {
    const response = await fetch(`https://api.rugcheck.xyz/v1/tokens/${tokenAddress}/report`);
    if (!response.ok) throw new Error('Solana rugcheck failed');
    return await response.json();
  } catch (error) {
    console.error('Solana rugcheck error:', error);
    return null;
  }
}

// Check wallet drawdown in time window
async function checkDrawdownTrigger(
  supabase: any,
  userId: string,
  threshold: number,
  windowMinutes: number
): Promise<CircuitBreakerCheckResult> {
  const windowStart = new Date();
  windowStart.setMinutes(windowStart.getMinutes() - windowMinutes);

  const { data: positions } = await supabase
    .from('positions')
    .select('entry_value, profit_loss_value, closed_at')
    .eq('user_id', userId)
    .eq('status', 'closed')
    .gte('closed_at', windowStart.toISOString());

  if (!positions || positions.length === 0) {
    return { triggered: false };
  }

  const totalEntryValue = positions.reduce((sum: number, p: any) => sum + (p.entry_value || 0), 0);
  const totalLoss = positions
    .filter((p: any) => (p.profit_loss_value || 0) < 0)
    .reduce((sum: number, p: any) => sum + Math.abs(p.profit_loss_value || 0), 0);

  if (totalEntryValue === 0) return { triggered: false };

  const drawdownPercent = (totalLoss / totalEntryValue) * 100;

  if (drawdownPercent >= threshold) {
    return {
      triggered: true,
      triggerType: 'drawdown',
      reason: `Wallet drawdown ${drawdownPercent.toFixed(1)}% exceeds ${threshold}% in ${windowMinutes} min`,
      details: { drawdownPercent, totalLoss, totalEntryValue, windowMinutes },
    };
  }

  return { triggered: false };
}

// Check for rug streak in recent trades
async function checkRugStreakTrigger(
  supabase: any,
  userId: string,
  rugThreshold: number,
  tradesWindow: number
): Promise<CircuitBreakerCheckResult> {
  const { data: positions } = await supabase
    .from('positions')
    .select('exit_reason, token_symbol, closed_at')
    .eq('user_id', userId)
    .eq('status', 'closed')
    .order('closed_at', { ascending: false })
    .limit(tradesWindow);

  if (!positions) return { triggered: false };

  const rugIndicators = ['rug', 'honeypot', 'lp_removed', 'liquidity_removed', 'scam', 'unsellable'];
  const ruggedPositions = positions.filter((p: any) => {
    const reason = (p.exit_reason || '').toLowerCase();
    return rugIndicators.some(indicator => reason.includes(indicator));
  });

  if (ruggedPositions.length >= rugThreshold) {
    return {
      triggered: true,
      triggerType: 'rug_streak',
      reason: `${ruggedPositions.length} rugs in last ${tradesWindow} trades (threshold: ${rugThreshold})`,
      details: { rugCount: ruggedPositions.length, tradesChecked: positions.length },
    };
  }

  return { triggered: false };
}

// Comprehensive circuit breaker check
async function checkCircuitBreaker(
  supabase: any,
  userId: string,
  settings: RiskSettings
): Promise<CircuitBreakerCheckResult> {
  if (!settings.circuit_breaker_enabled) {
    return { triggered: false };
  }

  // Check if already triggered and still in cooldown
  if (settings.circuit_breaker_triggered_at) {
    const triggeredTime = new Date(settings.circuit_breaker_triggered_at);
    const cooldownMs = (settings.circuit_breaker_cooldown_minutes || CB_THRESHOLDS.COOLDOWN_MINUTES) * 60 * 1000;
    const cooldownExpiresAt = new Date(triggeredTime.getTime() + cooldownMs);
    
    if (new Date() < cooldownExpiresAt) {
      // Check if admin override is required
      if (settings.circuit_breaker_requires_admin_override) {
        return {
          triggered: true,
          reason: `Circuit breaker active - requires admin override (expires ${cooldownExpiresAt.toISOString()})`,
          triggerType: 'cumulative_loss',
        };
      }
      return {
        triggered: true,
        reason: settings.circuit_breaker_trigger_reason || 'Circuit breaker still active',
      };
    }
    
    // Cooldown expired but requires admin override
    if (settings.circuit_breaker_requires_admin_override) {
      return {
        triggered: true,
        reason: 'Circuit breaker cooldown expired - awaiting admin override to reset',
      };
    }
  }

  // Run all trigger checks in parallel
  const [drawdownResult, rugResult] = await Promise.all([
    checkDrawdownTrigger(
      supabase,
      userId,
      settings.circuit_breaker_drawdown_threshold || CB_THRESHOLDS.DRAWDOWN_PERCENT,
      settings.circuit_breaker_drawdown_window_minutes || CB_THRESHOLDS.DRAWDOWN_WINDOW_MINUTES
    ),
    checkRugStreakTrigger(
      supabase,
      userId,
      CB_THRESHOLDS.RUG_COUNT_IN_TRADES,
      CB_THRESHOLDS.TRADES_WINDOW
    ),
  ]);

  // Check counter-based triggers
  const taxCount = settings.circuit_breaker_tax_count || 0;
  const freezeCount = settings.circuit_breaker_freeze_count || 0;

  let triggeredResult: CircuitBreakerCheckResult | null = null;

  if (drawdownResult.triggered) {
    triggeredResult = drawdownResult;
  } else if (rugResult.triggered) {
    triggeredResult = rugResult;
  } else if (taxCount >= CB_THRESHOLDS.HIDDEN_TAX_COUNT) {
    triggeredResult = {
      triggered: true,
      triggerType: 'hidden_tax',
      reason: `${taxCount} hidden tax tokens detected (threshold: ${CB_THRESHOLDS.HIDDEN_TAX_COUNT})`,
      details: { taxCount },
    };
  } else if (freezeCount >= CB_THRESHOLDS.FROZEN_TOKEN_COUNT) {
    triggeredResult = {
      triggered: true,
      triggerType: 'frozen_token',
      reason: `${freezeCount} frozen tokens encountered (threshold: ${CB_THRESHOLDS.FROZEN_TOKEN_COUNT})`,
      details: { freezeCount },
    };
  }

  // If triggered, update the database
  if (triggeredResult?.triggered) {
    const now = new Date();
    const cooldownMs = CB_THRESHOLDS.COOLDOWN_MINUTES * 60 * 1000;
    const cooldownExpiresAt = new Date(now.getTime() + cooldownMs);

    // Update risk_settings
    await supabase
      .from('risk_settings')
      .update({
        circuit_breaker_triggered_at: now.toISOString(),
        circuit_breaker_trigger_reason: triggeredResult.reason,
        circuit_breaker_requires_admin_override: true,
      })
      .eq('user_id', userId);

    // Log the event
    await supabase
      .from('circuit_breaker_events')
      .insert({
        user_id: userId,
        trigger_type: triggeredResult.triggerType || 'unknown',
        trigger_details: triggeredResult.details || {},
        cooldown_expires_at: cooldownExpiresAt.toISOString(),
      });

    console.log(`[CircuitBreaker] TRIGGERED for ${userId}: ${triggeredResult.reason}`);
  }

  return triggeredResult || { triggered: false };
}

// Increment counter and check if should trigger
async function incrementAndCheckCounter(
  supabase: any,
  userId: string,
  counterType: 'tax' | 'freeze',
  settings: RiskSettings
): Promise<{ newCount: number; triggered: boolean }> {
  const columnMap = {
    tax: 'circuit_breaker_tax_count',
    freeze: 'circuit_breaker_freeze_count',
  };
  const thresholdMap = {
    tax: CB_THRESHOLDS.HIDDEN_TAX_COUNT,
    freeze: CB_THRESHOLDS.FROZEN_TOKEN_COUNT,
  };

  const column = columnMap[counterType];
  const currentValue = (settings as any)[column] || 0;
  const newValue = currentValue + 1;

  await supabase
    .from('risk_settings')
    .update({ [column]: newValue })
    .eq('user_id', userId);

  return {
    newCount: newValue,
    triggered: newValue >= thresholdMap[counterType],
  };
}

// Admin reset circuit breaker
async function adminResetCircuitBreaker(
  supabase: any,
  adminUserId: string,
  targetUserId: string,
  reason: string
): Promise<{ success: boolean; error?: string }> {
  // Verify admin role
  const { data: roleData } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', adminUserId)
    .eq('role', 'admin')
    .single();

  if (!roleData) {
    return { success: false, error: 'Admin role required for circuit breaker reset' };
  }

  const now = new Date().toISOString();

  // Reset the circuit breaker
  await supabase
    .from('risk_settings')
    .update({
      circuit_breaker_triggered_at: null,
      circuit_breaker_trigger_reason: null,
      circuit_breaker_requires_admin_override: false,
      circuit_breaker_rug_count: 0,
      circuit_breaker_tax_count: 0,
      circuit_breaker_freeze_count: 0,
    })
    .eq('user_id', targetUserId);

  // Update the most recent event record
  const { data: events } = await supabase
    .from('circuit_breaker_events')
    .select('id')
    .eq('user_id', targetUserId)
    .is('reset_at', null)
    .order('triggered_at', { ascending: false })
    .limit(1);

  if (events && events.length > 0) {
    await supabase
      .from('circuit_breaker_events')
      .update({
        reset_at: now,
        reset_by: adminUserId,
        reset_reason: reason,
      })
      .eq('id', events[0].id);
  }

  console.log(`[CircuitBreaker] Admin ${adminUserId} reset for ${targetUserId}: ${reason}`);
  return { success: true };
}

// Perform comprehensive risk check on a token
async function performRiskCheck(
  token: TokenRiskData,
  settings: RiskSettings,
  honeypotApiUrl: string | null
): Promise<Omit<RiskCheckResult, 'circuitBreakerTriggered' | 'emergencyStopActive'>> {
  const rejectionReasons: string[] = [];
  let riskScore = 0;

  const checks = {
    honeypot: { passed: true, detected: false },
    blacklist: { passed: true, blacklisted: false },
    ownershipRenounced: { passed: true, renounced: true },
    liquidityLocked: { passed: true, locked: true, percentage: null as number | null },
    taxCheck: { passed: true, buyTax: 0, sellTax: 0 },
  };

  let apiData: any = null;
  
  if (honeypotApiUrl) {
    apiData = await callRugcheckApi(token.address, honeypotApiUrl);
  }
  
  if (!apiData && (!token.chain || token.chain === 'solana')) {
    apiData = await callSolanaRugcheck(token.address);
  }

  if (apiData) {
    const isHoneypot = apiData.honeypotResult?.isHoneypot || apiData.is_honeypot || false;
    checks.honeypot.detected = isHoneypot;
    checks.honeypot.passed = !isHoneypot;
    if (isHoneypot) {
      rejectionReasons.push('HONEYPOT DETECTED - Token cannot be sold');
      riskScore += 100;
    }

    const isBlacklisted = apiData.simulationResult?.isBlacklisted || 
                          apiData.is_blacklisted || 
                          apiData.risks?.some((r: any) => r.name === 'Blacklisted') || 
                          false;
    checks.blacklist.blacklisted = isBlacklisted;
    checks.blacklist.passed = !isBlacklisted;
    if (isBlacklisted) {
      rejectionReasons.push('Token is BLACKLISTED');
      riskScore += 50;
    }

    const ownerRenounced = apiData.contractCode?.ownershipRenounced || 
                           apiData.ownership_renounced || 
                           apiData.mint_authority === null ||
                           false;
    checks.ownershipRenounced.renounced = ownerRenounced;
    checks.ownershipRenounced.passed = !settings.require_ownership_renounced || ownerRenounced;
    if (settings.require_ownership_renounced && !ownerRenounced) {
      rejectionReasons.push('Owner NOT RENOUNCED - Rug pull risk');
      riskScore += 30;
    }

    const liquidityLocked = apiData.pair?.liquidity?.isLocked || 
                            apiData.liquidity_locked || 
                            false;
    const lockPercentage = apiData.pair?.liquidity?.lockPercentage || 
                           apiData.lock_percentage || 
                           null;
    checks.liquidityLocked.locked = liquidityLocked;
    checks.liquidityLocked.percentage = lockPercentage;
    checks.liquidityLocked.passed = !settings.require_liquidity_locked || liquidityLocked;
    if (settings.require_liquidity_locked && !liquidityLocked) {
      rejectionReasons.push('Liquidity NOT LOCKED - High rug risk');
      riskScore += 25;
    }

    const buyTax = apiData.simulationResult?.buyTax || apiData.buy_tax || 0;
    const sellTax = apiData.simulationResult?.sellTax || apiData.sell_tax || 0;
    checks.taxCheck.buyTax = buyTax;
    checks.taxCheck.sellTax = sellTax;
    const maxTax = Math.max(buyTax, sellTax);
    checks.taxCheck.passed = maxTax <= settings.max_tax_percent;
    if (maxTax > settings.max_tax_percent) {
      rejectionReasons.push(`HIGH TAX DETECTED - Buy: ${buyTax}%, Sell: ${sellTax}%`);
      riskScore += 20;
    }

    if (apiData.riskScore !== undefined) {
      riskScore = Math.max(riskScore, apiData.riskScore);
    } else if (apiData.score !== undefined) {
      riskScore = Math.max(riskScore, 100 - apiData.score);
    }
  } else {
    riskScore = 75;
    rejectionReasons.push('Unable to verify token - Risk APIs unavailable');
    checks.honeypot.passed = false;
  }

  const passed = riskScore <= settings.max_risk_score && rejectionReasons.length === 0;
  if (riskScore > settings.max_risk_score && !rejectionReasons.includes('Risk score exceeds threshold')) {
    rejectionReasons.push(`Risk score ${riskScore} exceeds maximum ${settings.max_risk_score}`);
  }

  return {
    token,
    passed,
    riskScore: Math.min(riskScore, 100),
    checks,
    rejectionReasons,
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Per-user rate limiting
    const rl = checkRateLimit(user.id, RISK_CHECK_LIMIT);
    if (!rl.allowed) return rateLimitResponse(rl, corsHeaders);

    const rawBody = await req.json().catch(() => ({}));
    const validationResult = validateRiskCheckInput(rawBody);
    
    if (!validationResult.success) {
      return new Response(JSON.stringify({ error: validationResult.error }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    const { action, tokens, updates, active, limit, targetUserId, reason } = validationResult.data!;

    // Fetch user's risk settings
    let { data: riskSettings, error: settingsError } = await supabase
      .from('risk_settings')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (settingsError || !riskSettings) {
      const { data: newSettings } = await supabase
        .from('risk_settings')
        .insert({ user_id: user.id })
        .select()
        .single();
      riskSettings = newSettings;
    }

    const settings = riskSettings as RiskSettings;

    // Handle different actions
    if (action === 'get_settings') {
      return new Response(JSON.stringify({ settings }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'update_settings') {
      const { data: updatedSettings, error: updateError } = await supabase
        .from('risk_settings')
        .update(updates || {})
        .eq('user_id', user.id)
        .select()
        .single();

      if (updateError) throw updateError;

      return new Response(JSON.stringify({ settings: updatedSettings }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'emergency_stop') {
      await supabase
        .from('risk_settings')
        .update({ emergency_stop_active: active })
        .eq('user_id', user.id);

      console.log(`Emergency stop ${active ? 'ACTIVATED' : 'DEACTIVATED'} for user ${user.id}`);

      return new Response(JSON.stringify({ 
        success: true, 
        emergency_stop_active: active,
        message: active ? 'EMERGENCY STOP ACTIVATED - All trading halted' : 'Emergency stop deactivated'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'reset_circuit_breaker') {
      // Check if admin override is required
      if (settings.circuit_breaker_requires_admin_override) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'Admin override required to reset circuit breaker',
          requiresAdmin: true,
        }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      await supabase
        .from('risk_settings')
        .update({
          circuit_breaker_triggered_at: null,
          circuit_breaker_trigger_reason: null,
          circuit_breaker_rug_count: 0,
          circuit_breaker_tax_count: 0,
          circuit_breaker_freeze_count: 0,
        })
        .eq('user_id', user.id);

      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Circuit breaker reset' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Admin reset endpoint
    if (action === 'admin_reset_circuit_breaker') {
      const resetResult = await adminResetCircuitBreaker(
        supabase,
        user.id,
        targetUserId || user.id,
        reason || 'Admin override'
      );

      if (!resetResult.success) {
        return new Response(JSON.stringify({ error: resetResult.error }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Circuit breaker reset by admin' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Increment counter endpoint
    if (action === 'increment_counter') {
      const counterType = rawBody.counterType as 'tax' | 'freeze';
      if (!counterType || !['tax', 'freeze'].includes(counterType)) {
        return new Response(JSON.stringify({ error: 'Invalid counter type' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const result = await incrementAndCheckCounter(supabase, user.id, counterType, settings);

      if (result.triggered) {
        // Re-check circuit breaker to trigger it
        await checkCircuitBreaker(supabase, user.id, settings);
      }

      return new Response(JSON.stringify({ 
        success: true,
        newCount: result.newCount,
        triggered: result.triggered,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'check_tokens' && tokens && Array.isArray(tokens)) {
      // Check emergency stop
      if (settings.emergency_stop_active) {
        return new Response(JSON.stringify({
          canTrade: false,
          reason: 'EMERGENCY STOP ACTIVE - All trading halted',
          results: [],
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Check circuit breaker (comprehensive check)
      const circuitBreakerStatus = await checkCircuitBreaker(supabase, user.id, settings);
      if (circuitBreakerStatus.triggered) {
        return new Response(JSON.stringify({
          canTrade: false,
          reason: circuitBreakerStatus.reason,
          circuitBreakerTriggered: true,
          triggerType: circuitBreakerStatus.triggerType,
          requiresAdminOverride: settings.circuit_breaker_requires_admin_override,
          results: [],
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Fetch honeypot API config
      const { data: apiConfigs } = await supabase
        .from('api_configurations')
        .select('*')
        .eq('api_type', 'honeypot_rugcheck')
        .eq('is_enabled', true)
        .limit(1);

      const honeypotApiUrl = apiConfigs?.[0]?.base_url || null;

      // Check each token
      const results: RiskCheckResult[] = [];
      for (const tokenData of tokens) {
        const checkResult = await performRiskCheck(tokenData, settings, honeypotApiUrl);
        
        await supabase.from('risk_check_logs').insert({
          user_id: user.id,
          token_address: tokenData.address,
          token_symbol: tokenData.symbol || null,
          chain: tokenData.chain || 'solana',
          is_honeypot: checkResult.checks.honeypot.detected,
          is_blacklisted: checkResult.checks.blacklist.blacklisted,
          owner_renounced: checkResult.checks.ownershipRenounced.renounced,
          liquidity_locked: checkResult.checks.liquidityLocked.locked,
          lock_percentage: checkResult.checks.liquidityLocked.percentage,
          buy_tax: checkResult.checks.taxCheck.buyTax,
          sell_tax: checkResult.checks.taxCheck.sellTax,
          risk_score: checkResult.riskScore,
          passed_checks: checkResult.passed,
          rejection_reasons: checkResult.rejectionReasons,
        });

        results.push({
          ...checkResult,
          circuitBreakerTriggered: false,
          emergencyStopActive: false,
        });
      }

      const allPassed = results.every(r => r.passed);
      
      return new Response(JSON.stringify({
        canTrade: allPassed,
        reason: allPassed ? 'All tokens passed risk checks' : 'One or more tokens failed risk checks',
        results,
        settings: {
          maxRiskScore: settings.max_risk_score,
          requireOwnershipRenounced: settings.require_ownership_renounced,
          requireLiquidityLocked: settings.require_liquidity_locked,
          maxTaxPercent: settings.max_tax_percent,
        },
        timestamp: new Date().toISOString(),
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'get_logs') {
      const queryLimit = limit ?? 50;
      const { data: logs } = await supabase
        .from('risk_check_logs')
        .select('*')
        .eq('user_id', user.id)
        .order('checked_at', { ascending: false })
        .limit(queryLimit);

      return new Response(JSON.stringify({ logs: logs || [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get circuit breaker events
    if (action === 'get_circuit_breaker_events') {
      const queryLimit = limit ?? 20;
      const { data: events } = await supabase
        .from('circuit_breaker_events')
        .select('*')
        .eq('user_id', user.id)
        .order('triggered_at', { ascending: false })
        .limit(queryLimit);

      return new Response(JSON.stringify({ events: events || [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    console.error('Risk check error:', error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
