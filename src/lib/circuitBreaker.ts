/**
 * Circuit Breaker Module
 * 
 * Advanced trading safety system that automatically halts execution when
 * dangerous patterns are detected. Triggers on:
 * 
 * 1. Wallet drawdown > 20% in 30 minutes
 * 2. 3 rugs detected in last 10 trades
 * 3. 2 hidden tax detections
 * 4. 2 frozen token encounters
 * 
 * Cooldown: 60 minutes auto-lock
 * Reset: Requires manual admin override
 */

import { supabase } from '@/integrations/supabase/client';

// =============================================================================
// TYPES
// =============================================================================

export interface CircuitBreakerConfig {
  enabled: boolean;
  cooldownMinutes: number;           // Default: 60
  drawdownThreshold: number;         // Default: 20%
  drawdownWindowMinutes: number;     // Default: 30
  rugThreshold: number;              // Default: 3 rugs in 10 trades
  hiddenTaxThreshold: number;        // Default: 2 detections
  frozenTokenThreshold: number;      // Default: 2 encounters
  requiresAdminOverride: boolean;    // Default: true
}

export interface CircuitBreakerState {
  triggered: boolean;
  triggeredAt: string | null;
  triggerReason: string | null;
  triggerType: TriggerType | null;
  cooldownExpiresAt: string | null;
  requiresAdminOverride: boolean;
  counters: {
    rugCount: number;
    taxCount: number;
    freezeCount: number;
  };
}

export type TriggerType = 
  | 'drawdown'
  | 'rug_streak'
  | 'hidden_tax'
  | 'frozen_token'
  | 'manual';

export interface CircuitBreakerEvent {
  id: string;
  userId: string;
  triggeredAt: string;
  triggerType: TriggerType;
  triggerDetails: Record<string, unknown>;
  resetAt: string | null;
  resetBy: string | null;
  resetReason: string | null;
  cooldownExpiresAt: string;
}

export interface TriggerCheckResult {
  shouldTrigger: boolean;
  type?: TriggerType;
  reason?: string;
  details?: Record<string, unknown>;
}

// =============================================================================
// CONSTANTS
// =============================================================================

export const DEFAULT_CONFIG: CircuitBreakerConfig = {
  enabled: true,
  cooldownMinutes: 60,
  drawdownThreshold: 20,
  drawdownWindowMinutes: 30,
  rugThreshold: 3,
  hiddenTaxThreshold: 2,
  frozenTokenThreshold: 2,
  requiresAdminOverride: true,
};

const TRADES_WINDOW_FOR_RUG_CHECK = 10;

// =============================================================================
// TRIGGER DETECTION
// =============================================================================

/**
 * Check wallet drawdown in time window
 * Triggers if losses exceed threshold in the specified window
 */
export async function checkDrawdownTrigger(
  userId: string,
  threshold: number,
  windowMinutes: number
): Promise<TriggerCheckResult> {
  try {
    const windowStart = new Date();
    windowStart.setMinutes(windowStart.getMinutes() - windowMinutes);
    
    // Get closed positions in window
    const { data: positions, error } = await supabase
      .from('positions')
      .select('entry_value, profit_loss_value, closed_at')
      .eq('user_id', userId)
      .eq('status', 'closed')
      .gte('closed_at', windowStart.toISOString());
    
    if (error || !positions || positions.length === 0) {
      return { shouldTrigger: false };
    }
    
    // Calculate total entry value and total loss
    const totalEntryValue = positions.reduce((sum, p) => sum + (p.entry_value || 0), 0);
    const totalLoss = positions
      .filter(p => (p.profit_loss_value || 0) < 0)
      .reduce((sum, p) => sum + Math.abs(p.profit_loss_value || 0), 0);
    
    if (totalEntryValue === 0) {
      return { shouldTrigger: false };
    }
    
    const drawdownPercent = (totalLoss / totalEntryValue) * 100;
    
    if (drawdownPercent >= threshold) {
      return {
        shouldTrigger: true,
        type: 'drawdown',
        reason: `Wallet drawdown ${drawdownPercent.toFixed(1)}% exceeds ${threshold}% threshold in ${windowMinutes} min`,
        details: {
          drawdownPercent,
          totalLoss,
          totalEntryValue,
          windowMinutes,
          positionCount: positions.length,
        },
      };
    }
    
    return { shouldTrigger: false };
  } catch (err) {
    console.error('[CircuitBreaker] Drawdown check error:', err);
    return { shouldTrigger: false };
  }
}

/**
 * Check for rug streak in recent trades
 * Triggers if X rugs detected in last Y trades
 */
export async function checkRugStreakTrigger(
  userId: string,
  rugThreshold: number = 3,
  tradesWindow: number = TRADES_WINDOW_FOR_RUG_CHECK
): Promise<TriggerCheckResult> {
  try {
    // Get last N closed positions
    const { data: positions, error } = await supabase
      .from('positions')
      .select('exit_reason, token_symbol, closed_at')
      .eq('user_id', userId)
      .eq('status', 'closed')
      .order('closed_at', { ascending: false })
      .limit(tradesWindow);
    
    if (error || !positions) {
      return { shouldTrigger: false };
    }
    
    // Count rug indicators in exit reasons
    const rugIndicators = ['rug', 'honeypot', 'lp_removed', 'liquidity_removed', 'scam', 'unsellable'];
    
    const ruggedPositions = positions.filter(p => {
      const reason = (p.exit_reason || '').toLowerCase();
      return rugIndicators.some(indicator => reason.includes(indicator));
    });
    
    if (ruggedPositions.length >= rugThreshold) {
      return {
        shouldTrigger: true,
        type: 'rug_streak',
        reason: `${ruggedPositions.length} rugs detected in last ${tradesWindow} trades (threshold: ${rugThreshold})`,
        details: {
          rugCount: ruggedPositions.length,
          tradesChecked: positions.length,
          ruggedTokens: ruggedPositions.map(p => p.token_symbol).filter(Boolean),
        },
      };
    }
    
    return { shouldTrigger: false };
  } catch (err) {
    console.error('[CircuitBreaker] Rug streak check error:', err);
    return { shouldTrigger: false };
  }
}

/**
 * Check hidden tax detection count
 * Triggers if threshold exceeded
 */
export function checkHiddenTaxTrigger(
  taxCount: number,
  threshold: number = 2
): TriggerCheckResult {
  if (taxCount >= threshold) {
    return {
      shouldTrigger: true,
      type: 'hidden_tax',
      reason: `${taxCount} hidden tax tokens detected (threshold: ${threshold})`,
      details: { taxCount, threshold },
    };
  }
  return { shouldTrigger: false };
}

/**
 * Check frozen token encounter count
 * Triggers if threshold exceeded
 */
export function checkFrozenTokenTrigger(
  freezeCount: number,
  threshold: number = 2
): TriggerCheckResult {
  if (freezeCount >= threshold) {
    return {
      shouldTrigger: true,
      type: 'frozen_token',
      reason: `${freezeCount} frozen tokens encountered (threshold: ${threshold})`,
      details: { freezeCount, threshold },
    };
  }
  return { shouldTrigger: false };
}

// =============================================================================
// STATE MANAGEMENT
// =============================================================================

/**
 * Get current circuit breaker state
 */
export async function getCircuitBreakerState(userId: string): Promise<CircuitBreakerState | null> {
  try {
    const { data, error } = await supabase
      .from('risk_settings')
      .select(`
        circuit_breaker_enabled,
        circuit_breaker_triggered_at,
        circuit_breaker_trigger_reason,
        circuit_breaker_requires_admin_override,
        circuit_breaker_cooldown_minutes,
        circuit_breaker_rug_count,
        circuit_breaker_tax_count,
        circuit_breaker_freeze_count
      `)
      .eq('user_id', userId)
      .single();
    
    if (error || !data) {
      return null;
    }
    
    const triggeredAt = data.circuit_breaker_triggered_at;
    let cooldownExpiresAt: string | null = null;
    let isActive = false;
    
    if (triggeredAt) {
      const triggeredTime = new Date(triggeredAt);
      const cooldownMs = (data.circuit_breaker_cooldown_minutes || 60) * 60 * 1000;
      cooldownExpiresAt = new Date(triggeredTime.getTime() + cooldownMs).toISOString();
      isActive = new Date() < new Date(cooldownExpiresAt);
    }
    
    return {
      triggered: isActive,
      triggeredAt,
      triggerReason: data.circuit_breaker_trigger_reason,
      triggerType: null, // Would need to parse from reason or store separately
      cooldownExpiresAt,
      requiresAdminOverride: data.circuit_breaker_requires_admin_override || false,
      counters: {
        rugCount: data.circuit_breaker_rug_count || 0,
        taxCount: data.circuit_breaker_tax_count || 0,
        freezeCount: data.circuit_breaker_freeze_count || 0,
      },
    };
  } catch (err) {
    console.error('[CircuitBreaker] Get state error:', err);
    return null;
  }
}

/**
 * Trigger the circuit breaker
 */
export async function triggerCircuitBreaker(
  userId: string,
  type: TriggerType,
  reason: string,
  details: Record<string, unknown> = {}
): Promise<boolean> {
  try {
    const now = new Date();
    const cooldownMinutes = DEFAULT_CONFIG.cooldownMinutes;
    const cooldownExpiresAt = new Date(now.getTime() + cooldownMinutes * 60 * 1000);
    
    // Update risk_settings
    const { error: updateError } = await supabase
      .from('risk_settings')
      .update({
        circuit_breaker_triggered_at: now.toISOString(),
        circuit_breaker_trigger_reason: reason,
        circuit_breaker_requires_admin_override: true,
      })
      .eq('user_id', userId);
    
    if (updateError) {
      console.error('[CircuitBreaker] Update settings error:', updateError);
      return false;
    }
    
    // Log the event
    const { error: eventError } = await supabase
      .from('circuit_breaker_events')
      .insert([{
        user_id: userId,
        trigger_type: type,
        trigger_details: details as unknown as Record<string, never>,
        cooldown_expires_at: cooldownExpiresAt.toISOString(),
      }]);
    
    if (eventError) {
      console.error('[CircuitBreaker] Log event error:', eventError);
    }
    
    console.log(`[CircuitBreaker] TRIGGERED for user ${userId}: ${reason}`);
    return true;
  } catch (err) {
    console.error('[CircuitBreaker] Trigger error:', err);
    return false;
  }
}

/**
 * Increment a counter (rug, tax, or freeze)
 */
export async function incrementCounter(
  userId: string,
  counterType: 'rug' | 'tax' | 'freeze'
): Promise<number> {
  try {
    const columnMap = {
      rug: 'circuit_breaker_rug_count',
      tax: 'circuit_breaker_tax_count',
      freeze: 'circuit_breaker_freeze_count',
    };
    
    const column = columnMap[counterType];
    
    // Get current value
    const { data: current, error } = await supabase
      .from('risk_settings')
      .select(column)
      .eq('user_id', userId)
      .single();
    
    if (error || !current) {
      console.error('[CircuitBreaker] Get counter error:', error);
      return 0;
    }
    
    const currentValue = (current as unknown as Record<string, number>)?.[column] || 0;
    const newValue = currentValue + 1;
    
    // Update
    await supabase
      .from('risk_settings')
      .update({ [column]: newValue })
      .eq('user_id', userId);
    
    console.log(`[CircuitBreaker] ${counterType} counter: ${currentValue} → ${newValue}`);
    return newValue;
  } catch (err) {
    console.error('[CircuitBreaker] Increment counter error:', err);
    return 0;
  }
}

/**
 * Reset counters (called after successful trades or cooldown reset)
 */
export async function resetCounters(userId: string): Promise<void> {
  try {
    await supabase
      .from('risk_settings')
      .update({
        circuit_breaker_rug_count: 0,
        circuit_breaker_tax_count: 0,
        circuit_breaker_freeze_count: 0,
      })
      .eq('user_id', userId);
    
    console.log(`[CircuitBreaker] Counters reset for user ${userId}`);
  } catch (err) {
    console.error('[CircuitBreaker] Reset counters error:', err);
  }
}

/**
 * Admin override to reset circuit breaker
 * Requires admin role
 */
export async function adminResetCircuitBreaker(
  adminUserId: string,
  targetUserId: string,
  reason: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Verify admin role
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', adminUserId)
      .eq('role', 'admin')
      .single();
    
    if (!roleData) {
      return { success: false, error: 'Admin role required' };
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
    
    // Update the event record
    await supabase
      .from('circuit_breaker_events')
      .update({
        reset_at: now,
        reset_by: adminUserId,
        reset_reason: reason,
      })
      .eq('user_id', targetUserId)
      .is('reset_at', null)
      .order('triggered_at', { ascending: false })
      .limit(1);
    
    console.log(`[CircuitBreaker] Admin ${adminUserId} reset circuit breaker for ${targetUserId}: ${reason}`);
    return { success: true };
  } catch (err) {
    console.error('[CircuitBreaker] Admin reset error:', err);
    return { success: false, error: 'Reset failed' };
  }
}

// =============================================================================
// COMPREHENSIVE CHECK
// =============================================================================

/**
 * Run all circuit breaker checks
 * Returns true if trading should be blocked
 */
export async function runCircuitBreakerChecks(
  userId: string,
  config: Partial<CircuitBreakerConfig> = {}
): Promise<{
  blocked: boolean;
  reason?: string;
  state: CircuitBreakerState | null;
}> {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  
  if (!cfg.enabled) {
    return { blocked: false, state: null };
  }
  
  // Get current state
  const state = await getCircuitBreakerState(userId);
  
  // Check if already triggered and still in cooldown
  if (state?.triggered) {
    return {
      blocked: true,
      reason: state.triggerReason || 'Circuit breaker active',
      state,
    };
  }
  
  // Run all trigger checks
  const checks = await Promise.all([
    checkDrawdownTrigger(userId, cfg.drawdownThreshold, cfg.drawdownWindowMinutes),
    checkRugStreakTrigger(userId, cfg.rugThreshold, TRADES_WINDOW_FOR_RUG_CHECK),
    checkHiddenTaxTrigger(state?.counters.taxCount || 0, cfg.hiddenTaxThreshold),
    checkFrozenTokenTrigger(state?.counters.freezeCount || 0, cfg.frozenTokenThreshold),
  ]);
  
  // Find first trigger
  const triggered = checks.find(c => c.shouldTrigger);
  
  if (triggered && triggered.type && triggered.reason) {
    // Trigger the circuit breaker
    await triggerCircuitBreaker(userId, triggered.type, triggered.reason, triggered.details || {});
    
    // Get updated state
    const newState = await getCircuitBreakerState(userId);
    
    return {
      blocked: true,
      reason: triggered.reason,
      state: newState,
    };
  }
  
  return { blocked: false, state };
}

/**
 * Check if trading is allowed (quick check)
 */
export async function isTradingAllowed(userId: string): Promise<boolean> {
  const state = await getCircuitBreakerState(userId);
  return !state?.triggered;
}

// =============================================================================
// EXPORTS
// =============================================================================

export {
  TRADES_WINDOW_FOR_RUG_CHECK,
};
