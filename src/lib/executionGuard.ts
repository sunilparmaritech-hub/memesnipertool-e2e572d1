/**
 * Execution Guard — Prevents duplicate/invalid trade execution
 * 
 * Features:
 * 1. Token-level cooldown lock (prevent multiple triggers within X seconds)
 * 2. Execution idempotency guard (one active trade per token)
 * 3. Failure counter → auto-blacklist after N failed attempts
 * 4. Mandatory sell simulation before buy
 */

// ============================================================
// 1. Token Execution Cooldown Lock
// ============================================================
const executionCooldowns = new Map<string, number>();
const DEFAULT_COOLDOWN_MS = 120_000; // 2 minutes between execution attempts for same token

export function canExecuteToken(tokenAddress: string, cooldownMs: number = DEFAULT_COOLDOWN_MS): boolean {
  const key = tokenAddress.toLowerCase();
  const lastAttempt = executionCooldowns.get(key);
  if (!lastAttempt) return true;
  return Date.now() - lastAttempt >= cooldownMs;
}

export function recordExecutionAttempt(tokenAddress: string): void {
  executionCooldowns.set(tokenAddress.toLowerCase(), Date.now());
}

export function getExecutionCooldownRemaining(tokenAddress: string, cooldownMs: number = DEFAULT_COOLDOWN_MS): number {
  const key = tokenAddress.toLowerCase();
  const lastAttempt = executionCooldowns.get(key);
  if (!lastAttempt) return 0;
  return Math.max(0, cooldownMs - (Date.now() - lastAttempt));
}

// ============================================================
// 2. Execution Idempotency Guard (one active trade per token)
// ============================================================
const activeExecutions = new Set<string>();

export function acquireExecutionLock(tokenAddress: string): boolean {
  const key = tokenAddress.toLowerCase();
  if (activeExecutions.has(key)) {
    console.log(`[ExecutionGuard] BLOCKED: ${key.slice(0, 8)}... already executing`);
    return false;
  }
  activeExecutions.add(key);
  console.log(`[ExecutionGuard] LOCK ACQUIRED: ${key.slice(0, 8)}...`);
  return true;
}

export function releaseExecutionLock(tokenAddress: string): void {
  const key = tokenAddress.toLowerCase();
  activeExecutions.delete(key);
  console.log(`[ExecutionGuard] LOCK RELEASED: ${key.slice(0, 8)}...`);
}

export function isExecutionActive(tokenAddress: string): boolean {
  return activeExecutions.has(tokenAddress.toLowerCase());
}

// ============================================================
// 3. Failure Counter → Auto-Blacklist
// ============================================================
const failureCounters = new Map<string, { count: number; lastFailure: number; reasons: string[] }>();
const MAX_FAILURES_BEFORE_BLACKLIST = 3;
const FAILURE_WINDOW_MS = 600_000; // 10 minutes — reset counter after this window

const autoBlacklist = new Set<string>();

export function recordSwapFailure(tokenAddress: string, reason: string): { blacklisted: boolean; failureCount: number } {
  const key = tokenAddress.toLowerCase();
  const now = Date.now();
  
  let entry = failureCounters.get(key);
  if (!entry || (now - entry.lastFailure > FAILURE_WINDOW_MS)) {
    entry = { count: 0, lastFailure: now, reasons: [] };
  }
  
  entry.count++;
  entry.lastFailure = now;
  entry.reasons.push(reason.slice(0, 100));
  if (entry.reasons.length > MAX_FAILURES_BEFORE_BLACKLIST) {
    entry.reasons = entry.reasons.slice(-MAX_FAILURES_BEFORE_BLACKLIST);
  }
  failureCounters.set(key, entry);
  
  if (entry.count >= MAX_FAILURES_BEFORE_BLACKLIST) {
    autoBlacklist.add(key);
    console.log(`[ExecutionGuard] AUTO-BLACKLISTED: ${key.slice(0, 8)}... after ${entry.count} failures: ${entry.reasons.join('; ')}`);
    return { blacklisted: true, failureCount: entry.count };
  }
  
  return { blacklisted: false, failureCount: entry.count };
}

export function isAutoBlacklisted(tokenAddress: string): boolean {
  return autoBlacklist.has(tokenAddress.toLowerCase());
}

export function getFailureCount(tokenAddress: string): number {
  const entry = failureCounters.get(tokenAddress.toLowerCase());
  if (!entry) return 0;
  // Reset if outside window
  if (Date.now() - entry.lastFailure > FAILURE_WINDOW_MS) return 0;
  return entry.count;
}

export function clearAutoBlacklist(tokenAddress?: string): void {
  if (tokenAddress) {
    autoBlacklist.delete(tokenAddress.toLowerCase());
    failureCounters.delete(tokenAddress.toLowerCase());
  } else {
    autoBlacklist.clear();
    failureCounters.clear();
  }
}

// ============================================================
// 4. Mandatory Sell Simulation
// ============================================================
export async function verifySellRoute(
  tokenAddress: string,
  timeoutMs: number = 6000
): Promise<{ canSell: boolean; source: 'jupiter' | 'raydium' | 'none'; error?: string }> {
  const SOL_MINT = 'So11111111111111111111111111111111111111112';
  
  // Try Jupiter first
  try {
    const { fetchJupiterQuote } = await import('@/lib/jupiterQuote');
    const result = await fetchJupiterQuote({
      inputMint: tokenAddress,
      outputMint: SOL_MINT,
      amount: '100000',
      slippageBps: 500,
      timeoutMs,
      critical: true,
    });
    
    if (result.ok) {
      return { canSell: true, source: 'jupiter' };
    }
  } catch (err) {
    console.log('[ExecutionGuard] Jupiter sell check failed:', err);
  }
  
  // Try Raydium fallback
  try {
    const raydiumUrl = `https://transaction-v1.raydium.io/compute/swap-base-in?inputMint=${tokenAddress}&outputMint=${SOL_MINT}&amount=100000&slippageBps=500&txVersion=V0`;
    const res = await fetch(raydiumUrl, { signal: AbortSignal.timeout(timeoutMs) });
    if (res.ok) {
      const data = await res.json();
      if (data?.success && data?.data) {
        return { canSell: true, source: 'raydium' };
      }
    }
  } catch (err) {
    console.log('[ExecutionGuard] Raydium sell check failed:', err);
  }
  
  return { canSell: false, source: 'none', error: 'No sell route on Jupiter or Raydium' };
}

// ============================================================
// 5. Suspicious Token Name Detection
// ============================================================
const SCAM_NAME_PATTERNS = [
  /\s{2,}/,              // Multiple consecutive spaces (e.g., "Sloplana  ")
  /^\s|\s$/,             // Leading/trailing whitespace
  /[\u200B-\u200F\uFEFF]/, // Zero-width chars (invisible Unicode)
  /^.{1,2}$/,            // Extremely short names (1-2 chars)
  /(.)\1{4,}/,           // Repeated chars (e.g., "AAAAAAA")
  /^Token\s/,            // Generic "Token XXXX" names
  /test|fake|scam|rug/i, // Obvious scam keywords
];

export function isScamTokenName(name: string | null | undefined, symbol: string | null | undefined): { suspicious: boolean; reason?: string } {
  const checkValue = (val: string | null | undefined, label: string) => {
    if (!val) return null;
    for (const pattern of SCAM_NAME_PATTERNS) {
      if (pattern.test(val)) {
        return `${label} matches scam pattern: ${pattern.toString()} ("${val.trim()}")`;
      }
    }
    return null;
  };

  const nameIssue = checkValue(name, 'Name');
  if (nameIssue) return { suspicious: true, reason: nameIssue };

  const symbolIssue = checkValue(symbol, 'Symbol');
  if (symbolIssue) return { suspicious: true, reason: symbolIssue };

  return { suspicious: false };
}

// ============================================================
// 6. Combined Pre-Execution Check
// ============================================================
export interface PreExecutionCheckResult {
  allowed: boolean;
  reason?: string;
  sellRouteSource?: string;
}

export async function runPreExecutionCheck(
  tokenAddress: string,
  options?: { skipSellSimulation?: boolean; cooldownMs?: number; tokenName?: string; tokenSymbol?: string }
): Promise<PreExecutionCheckResult> {
  const addr = tokenAddress.toLowerCase();
  
  // Check auto-blacklist
  if (isAutoBlacklisted(tokenAddress)) {
    return { allowed: false, reason: `Auto-blacklisted after ${MAX_FAILURES_BEFORE_BLACKLIST}+ failed swaps` };
  }
  
  // Check cooldown
  if (!canExecuteToken(tokenAddress, options?.cooldownMs)) {
    const remaining = getExecutionCooldownRemaining(tokenAddress, options?.cooldownMs);
    return { allowed: false, reason: `Cooldown active — ${Math.ceil(remaining / 1000)}s remaining` };
  }
  
  // Check idempotency (already executing)
  if (isExecutionActive(tokenAddress)) {
    return { allowed: false, reason: 'Already executing trade for this token' };
  }
  
  // Check suspicious name patterns
  const scamCheck = isScamTokenName(options?.tokenName, options?.tokenSymbol);
  if (scamCheck.suspicious) {
    return { allowed: false, reason: `Suspicious token name blocked: ${scamCheck.reason}` };
  }
  
  // Mandatory sell simulation
  if (!options?.skipSellSimulation) {
    const sellResult = await verifySellRoute(tokenAddress);
    if (!sellResult.canSell) {
      return { allowed: false, reason: `Sell route not available: ${sellResult.error}` };
    }
    return { allowed: true, sellRouteSource: sellResult.source };
  }
  
  return { allowed: true };
}

// ============================================================
// Cleanup
// ============================================================
export function cleanupExpiredCooldowns(): void {
  const now = Date.now();
  for (const [key, ts] of executionCooldowns.entries()) {
    if (now - ts > DEFAULT_COOLDOWN_MS * 2) {
      executionCooldowns.delete(key);
    }
  }
}
