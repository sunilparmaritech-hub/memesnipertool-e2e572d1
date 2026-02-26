/**
 * Liquidity Monitor Module
 * 
 * Monitors newly detected pools for the first 120 seconds to detect:
 * - Sudden liquidity drops (rug pull indicator)
 * - Suspicious volume concentration (wash trading/manipulation)
 * - LP withdrawal transactions
 * 
 * Block thresholds:
 * - Liquidity drops > 30% in 2 minutes → BLOCK
 * - Single wallet accounts for > 70% buys → BLOCK
 */

import { supabase } from '@/integrations/supabase/client';

// =============================================================================
// TYPES
// =============================================================================

export interface LiquiditySnapshot {
  timestamp: number;
  liquidityUsd: number;
  priceUsd: number;
  volume24h?: number;
}

export interface VolumeByWallet {
  wallet: string;
  buyVolume: number;
  sellVolume: number;
  txCount: number;
}

export interface LpEventDetection {
  lpWithdrawalDetected: boolean;
  lpMintEventDetected: boolean;
  lpAuthorityChanged: boolean;
  lpSupplyIncreased: boolean;
  deployerLpTransfer: boolean;
  eventDetails?: string;
}

export interface LiquidityMonitorResult {
  stable: boolean;
  liquidityDropPercent: number;
  suspiciousVolume: boolean;
  lpWithdrawalDetected: boolean;
  dominantBuyerPercent: number;
  monitoringDurationMs: number;
  snapshots: LiquiditySnapshot[];
  blockReason?: string;
  // Enhanced LP event detection
  lpEvents?: LpEventDetection;
}

export interface MonitoringSession {
  tokenAddress: string;
  poolAddress?: string;
  startTime: number;
  initialLiquidity: number;
  snapshots: LiquiditySnapshot[];
  volumeByWallet: Map<string, VolumeByWallet>;
  lpWithdrawals: number;
  lpMintEvents: number;
  lpAuthorityChanges: number;
  lpSupplyChanges: number;
  deployerLpTransfers: number;
  isActive: boolean;
  deployerWallet?: string;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const MONITORING_DURATION_MS = 120_000; // 2 minutes
const SNAPSHOT_INTERVAL_MS = 10_000;    // Check every 10 seconds
const MAX_LIQUIDITY_DROP_PERCENT = 30;  // Block if drops > 30%
const MAX_SINGLE_WALLET_BUY_PERCENT = 70; // Block if one wallet > 70% of buys

// Active monitoring sessions
const activeSessions = new Map<string, MonitoringSession>();

// =============================================================================
// CORE FUNCTIONS
// =============================================================================

/**
 * Start monitoring a newly detected pool
 */
export function startLiquidityMonitoring(
  tokenAddress: string,
  initialLiquidity: number,
  initialPrice: number,
  options?: { poolAddress?: string; deployerWallet?: string }
): void {
  // Don't start duplicate sessions
  if (activeSessions.has(tokenAddress)) {
    console.log(`[LiquidityMonitor] Session already active for ${tokenAddress.slice(0, 8)}...`);
    return;
  }
  
  const session: MonitoringSession = {
    tokenAddress,
    poolAddress: options?.poolAddress,
    startTime: Date.now(),
    initialLiquidity,
    snapshots: [{
      timestamp: Date.now(),
      liquidityUsd: initialLiquidity,
      priceUsd: initialPrice,
    }],
    volumeByWallet: new Map(),
    lpWithdrawals: 0,
    lpMintEvents: 0,
    lpAuthorityChanges: 0,
    lpSupplyChanges: 0,
    deployerLpTransfers: 0,
    isActive: true,
    deployerWallet: options?.deployerWallet,
  };
  
  activeSessions.set(tokenAddress, session);
  console.log(`[LiquidityMonitor] Started monitoring ${tokenAddress.slice(0, 8)}... (initial: $${initialLiquidity.toFixed(0)})`);
}

/**
 * Add a liquidity snapshot to an active session
 */
export function addLiquiditySnapshot(
  tokenAddress: string,
  liquidityUsd: number,
  priceUsd: number,
  volume24h?: number
): void {
  const session = activeSessions.get(tokenAddress);
  if (!session || !session.isActive) return;
  
  session.snapshots.push({
    timestamp: Date.now(),
    liquidityUsd,
    priceUsd,
    volume24h,
  });
  
  // Check for significant drop
  const dropPercent = ((session.initialLiquidity - liquidityUsd) / session.initialLiquidity) * 100;
  if (dropPercent > 10) {
    console.log(`[LiquidityMonitor] ${tokenAddress.slice(0, 8)}... liquidity dropped ${dropPercent.toFixed(1)}%`);
  }
}

/**
 * Record a buy/sell transaction for volume tracking
 */
export function recordTransaction(
  tokenAddress: string,
  walletAddress: string,
  isBuy: boolean,
  volumeUsd: number
): void {
  const session = activeSessions.get(tokenAddress);
  if (!session || !session.isActive) return;
  
  const existing = session.volumeByWallet.get(walletAddress) || {
    wallet: walletAddress,
    buyVolume: 0,
    sellVolume: 0,
    txCount: 0,
  };
  
  if (isBuy) {
    existing.buyVolume += volumeUsd;
  } else {
    existing.sellVolume += volumeUsd;
  }
  existing.txCount += 1;
  
  session.volumeByWallet.set(walletAddress, existing);
}

/**
 * Record an LP withdrawal event
 */
export function recordLpWithdrawal(tokenAddress: string): void {
  const session = activeSessions.get(tokenAddress);
  if (!session || !session.isActive) return;
  
  session.lpWithdrawals += 1;
  console.log(`[LiquidityMonitor] LP withdrawal detected for ${tokenAddress.slice(0, 8)}... (count: ${session.lpWithdrawals})`);
}

/**
 * Record LP mint event (new LP tokens minted)
 */
export function recordLpMintEvent(tokenAddress: string): void {
  const session = activeSessions.get(tokenAddress);
  if (!session || !session.isActive) return;
  
  session.lpMintEvents += 1;
  console.log(`[LiquidityMonitor] LP mint event detected for ${tokenAddress.slice(0, 8)}... (count: ${session.lpMintEvents})`);
}

/**
 * Record LP authority change
 */
export function recordLpAuthorityChange(tokenAddress: string): void {
  const session = activeSessions.get(tokenAddress);
  if (!session || !session.isActive) return;
  
  session.lpAuthorityChanges += 1;
  console.log(`[LiquidityMonitor] LP authority change for ${tokenAddress.slice(0, 8)}...`);
}

/**
 * Record LP supply change (increase detected)
 */
export function recordLpSupplyChange(tokenAddress: string): void {
  const session = activeSessions.get(tokenAddress);
  if (!session || !session.isActive) return;
  
  session.lpSupplyChanges += 1;
  console.log(`[LiquidityMonitor] LP supply increase for ${tokenAddress.slice(0, 8)}...`);
}

/**
 * Record deployer LP transfer
 */
export function recordDeployerLpTransfer(tokenAddress: string): void {
  const session = activeSessions.get(tokenAddress);
  if (!session || !session.isActive) return;
  
  session.deployerLpTransfers += 1;
  console.log(`[LiquidityMonitor] Deployer LP transfer for ${tokenAddress.slice(0, 8)}...`);
}

/**
 * Stop monitoring a token
 */
export function stopMonitoring(tokenAddress: string): void {
  const session = activeSessions.get(tokenAddress);
  if (session) {
    session.isActive = false;
    activeSessions.delete(tokenAddress);
    console.log(`[LiquidityMonitor] Stopped monitoring ${tokenAddress.slice(0, 8)}...`);
  }
}

/**
 * Check if a token is currently being monitored
 */
export function isBeingMonitored(tokenAddress: string): boolean {
  const session = activeSessions.get(tokenAddress);
  if (!session) return false;
  
  // Auto-expire old sessions
  const elapsed = Date.now() - session.startTime;
  if (elapsed > MONITORING_DURATION_MS) {
    session.isActive = false;
    return false;
  }
  
  return session.isActive;
}

/**
 * Get the current monitoring result for a token
 */
export function getMonitoringResult(tokenAddress: string): LiquidityMonitorResult | null {
  const session = activeSessions.get(tokenAddress);
  if (!session) return null;
  
  return evaluateSession(session);
}

/**
 * Evaluate a monitoring session and determine if trade should be blocked
 */
function evaluateSession(session: MonitoringSession): LiquidityMonitorResult {
  const elapsed = Date.now() - session.startTime;
  const snapshots = session.snapshots;
  
  // Calculate liquidity drop
  const currentLiquidity = snapshots.length > 0 
    ? snapshots[snapshots.length - 1].liquidityUsd 
    : session.initialLiquidity;
  
  const liquidityDropPercent = session.initialLiquidity > 0
    ? ((session.initialLiquidity - currentLiquidity) / session.initialLiquidity) * 100
    : 0;
  
  // Calculate volume concentration
  let totalBuyVolume = 0;
  let maxSingleWalletBuy = 0;
  let dominantWallet = '';
  
  session.volumeByWallet.forEach((data, wallet) => {
    totalBuyVolume += data.buyVolume;
    if (data.buyVolume > maxSingleWalletBuy) {
      maxSingleWalletBuy = data.buyVolume;
      dominantWallet = wallet;
    }
  });
  
  const dominantBuyerPercent = totalBuyVolume > 0
    ? (maxSingleWalletBuy / totalBuyVolume) * 100
    : 0;
  
  // Determine if volume is suspicious
  const suspiciousVolume = dominantBuyerPercent > MAX_SINGLE_WALLET_BUY_PERCENT;
  
  // Build LP events detection
  const lpEvents: LpEventDetection = {
    lpWithdrawalDetected: session.lpWithdrawals > 0,
    lpMintEventDetected: session.lpMintEvents > 0,
    lpAuthorityChanged: session.lpAuthorityChanges > 0,
    lpSupplyIncreased: session.lpSupplyChanges > 0,
    deployerLpTransfer: session.deployerLpTransfers > 0,
  };
  
  // Determine stability - now includes LP events
  const lpWithdrawalDetected = session.lpWithdrawals > 0;
  const liquidityUnstable = liquidityDropPercent > MAX_LIQUIDITY_DROP_PERCENT;
  const hasLpManipulation = lpEvents.lpMintEventDetected || 
                            lpEvents.lpAuthorityChanged || 
                            lpEvents.lpSupplyIncreased ||
                            lpEvents.deployerLpTransfer;
  
  const stable = !liquidityUnstable && !suspiciousVolume && !lpWithdrawalDetected && !hasLpManipulation;
  
  // Build block reason
  let blockReason: string | undefined;
  if (!stable) {
    const reasons: string[] = [];
    if (liquidityUnstable) {
      reasons.push(`Liquidity dropped ${liquidityDropPercent.toFixed(1)}% (>${MAX_LIQUIDITY_DROP_PERCENT}%)`);
    }
    if (suspiciousVolume) {
      reasons.push(`Single wallet (${dominantWallet.slice(0, 8)}...) has ${dominantBuyerPercent.toFixed(0)}% of buys`);
    }
    if (lpWithdrawalDetected) {
      reasons.push(`${session.lpWithdrawals} LP withdrawal(s) detected`);
    }
    if (lpEvents.lpMintEventDetected) {
      reasons.push('LP mint event detected');
    }
    if (lpEvents.lpAuthorityChanged) {
      reasons.push('LP authority changed');
    }
    if (lpEvents.lpSupplyIncreased) {
      reasons.push('LP supply increased');
    }
    if (lpEvents.deployerLpTransfer) {
      reasons.push('Deployer transferred LP tokens');
    }
    blockReason = reasons.join('; ');
    lpEvents.eventDetails = blockReason;
  }
  
  return {
    stable,
    liquidityDropPercent,
    suspiciousVolume,
    lpWithdrawalDetected,
    dominantBuyerPercent,
    monitoringDurationMs: elapsed,
    snapshots,
    blockReason,
    lpEvents,
  };
}

// =============================================================================
// ASYNC MONITORING FUNCTIONS
// =============================================================================

/**
 * Fetch current liquidity from DexScreener
 */
async function fetchCurrentLiquidity(tokenAddress: string): Promise<{
  liquidity: number;
  price: number;
  volume24h: number;
} | null> {
  try {
    const response = await fetch(
      `https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`,
      { signal: AbortSignal.timeout(5000) }
    );
    
    if (!response.ok) return null;
    
    const data = await response.json();
    const pair = data.pairs?.find((p: any) => p.chainId === 'solana');
    
    if (!pair) return null;
    
    return {
      liquidity: pair.liquidity?.usd || 0,
      price: parseFloat(pair.priceUsd || '0'),
      volume24h: pair.volume?.h24 || 0,
    };
  } catch (error) {
    console.error('[LiquidityMonitor] Fetch error:', error);
    return null;
  }
}

/**
 * Run a full monitoring cycle for a token
 * Monitors for MONITORING_DURATION_MS and returns final result
 */
export async function runFullMonitoringCycle(
  tokenAddress: string,
  initialLiquidity: number,
  initialPrice: number,
  onUpdate?: (result: LiquidityMonitorResult) => void
): Promise<LiquidityMonitorResult> {
  startLiquidityMonitoring(tokenAddress, initialLiquidity, initialPrice);
  
  const session = activeSessions.get(tokenAddress);
  if (!session) {
    return {
      stable: true,
      liquidityDropPercent: 0,
      suspiciousVolume: false,
      lpWithdrawalDetected: false,
      dominantBuyerPercent: 0,
      monitoringDurationMs: 0,
      snapshots: [],
    };
  }
  
  // Run monitoring loop
  const startTime = Date.now();
  
  while (Date.now() - startTime < MONITORING_DURATION_MS && session.isActive) {
    // Wait for next snapshot interval
    await new Promise(resolve => setTimeout(resolve, SNAPSHOT_INTERVAL_MS));
    
    // Fetch current data
    const currentData = await fetchCurrentLiquidity(tokenAddress);
    
    if (currentData) {
      addLiquiditySnapshot(
        tokenAddress,
        currentData.liquidity,
        currentData.price,
        currentData.volume24h
      );
      
      // Notify caller of update
      const result = getMonitoringResult(tokenAddress);
      if (result && onUpdate) {
        onUpdate(result);
      }
      
      // Early exit if clearly unstable
      if (result && !result.stable) {
        console.log(`[LiquidityMonitor] Early exit for ${tokenAddress.slice(0, 8)}...: ${result.blockReason}`);
        break;
      }
    }
  }
  
  // Get final result
  const finalResult = evaluateSession(session);
  
  // Cleanup
  stopMonitoring(tokenAddress);
  
  return finalResult;
}

/**
 * Quick liquidity check (single snapshot comparison)
 * Use for fast pre-trade validation without full monitoring cycle
 */
export async function quickLiquidityCheck(
  tokenAddress: string,
  expectedLiquidity: number
): Promise<LiquidityMonitorResult> {
  const currentData = await fetchCurrentLiquidity(tokenAddress);
  
  if (!currentData) {
    // Can't verify - proceed with caution
    return {
      stable: true,
      liquidityDropPercent: 0,
      suspiciousVolume: false,
      lpWithdrawalDetected: false,
      dominantBuyerPercent: 0,
      monitoringDurationMs: 0,
      snapshots: [],
      blockReason: undefined,
    };
  }
  
  const liquidityDropPercent = expectedLiquidity > 0
    ? ((expectedLiquidity - currentData.liquidity) / expectedLiquidity) * 100
    : 0;
  
  const stable = liquidityDropPercent <= MAX_LIQUIDITY_DROP_PERCENT;
  
  return {
    stable,
    liquidityDropPercent,
    suspiciousVolume: false, // Can't determine from single check
    lpWithdrawalDetected: false, // Can't determine from single check
    dominantBuyerPercent: 0,
    monitoringDurationMs: 0,
    snapshots: [{
      timestamp: Date.now(),
      liquidityUsd: currentData.liquidity,
      priceUsd: currentData.price,
      volume24h: currentData.volume24h,
    }],
    blockReason: stable ? undefined : `Liquidity dropped ${liquidityDropPercent.toFixed(1)}% since discovery`,
  };
}

/**
 * Check liquidity stability for pre-execution gate
 * Returns a gate-compatible result
 */
export async function checkLiquidityStability(
  tokenAddress: string,
  discoveryLiquidity: number
): Promise<{
  passed: boolean;
  rule: string;
  reason: string;
  penalty?: number;
  monitorResult: LiquidityMonitorResult;
}> {
  const rule = 'LIQUIDITY_STABILITY';
  
  // Check if already being monitored
  if (isBeingMonitored(tokenAddress)) {
    const result = getMonitoringResult(tokenAddress);
    if (result) {
      if (!result.stable) {
        return {
          passed: false,
          rule,
          reason: result.blockReason || 'Liquidity unstable',
          penalty: 40,
          monitorResult: result,
        };
      }
      return {
        passed: true,
        rule,
        reason: `Liquidity stable (${result.monitoringDurationMs / 1000}s monitored)`,
        monitorResult: result,
      };
    }
  }
  
  // Quick check for non-monitored tokens
  const result = await quickLiquidityCheck(tokenAddress, discoveryLiquidity);
  
  if (!result.stable) {
    return {
      passed: false,
      rule,
      reason: result.blockReason || `Liquidity dropped ${result.liquidityDropPercent.toFixed(1)}%`,
      penalty: 40,
      monitorResult: result,
    };
  }
  
  return {
    passed: true,
    rule,
    reason: 'Liquidity check passed',
    monitorResult: result,
  };
}

// =============================================================================
// CLEANUP
// =============================================================================

/**
 * Clean up expired monitoring sessions
 * Call periodically to prevent memory leaks
 */
export function cleanupExpiredSessions(): number {
  const now = Date.now();
  let cleaned = 0;
  
  activeSessions.forEach((session, tokenAddress) => {
    if (now - session.startTime > MONITORING_DURATION_MS * 2) {
      activeSessions.delete(tokenAddress);
      cleaned++;
    }
  });
  
  if (cleaned > 0) {
    console.log(`[LiquidityMonitor] Cleaned up ${cleaned} expired sessions`);
  }
  
  return cleaned;
}

/**
 * Get count of active monitoring sessions
 */
export function getActiveSessionCount(): number {
  return activeSessions.size;
}

// Auto-cleanup every 5 minutes
setInterval(cleanupExpiredSessions, 300_000);
