/**
 * Volume Authenticity Module (Rule 18)
 * 
 * Detects fake volume through:
 * - Top 5 wallets > 50% volume → penalty -40
 * - Circular trades (buy→sell→buy same wallet)
 * - Same-wallet buy/sell loops
 * - Sub-second repeated trade intervals
 * 
 * Uses Birdeye trade history data.
 */

import { supabase } from '@/integrations/supabase/client';

// =============================================================================
// TYPES
// =============================================================================

export interface TradeRecord {
  wallet: string;
  side: 'buy' | 'sell';
  amount: number;       // In USD
  timestamp: number;    // Unix seconds
  txHash?: string;
}

export interface VolumeAuthenticityResult {
  passed: boolean;
  rule: string;
  reason: string;
  penalty: number;
  details: {
    top5WalletVolumePercent: number;
    circularTradeCount: number;
    sameWalletLoopCount: number;
    subSecondTradeCount: number;
    isWashTrading: boolean;
    volumeScore: number; // 0-100 (100 = authentic)
  };
}

// =============================================================================
// CONSTANTS
// =============================================================================

const TOP5_VOLUME_THRESHOLD = 50;      // 50% from top 5 wallets
const CIRCULAR_TRADE_THRESHOLD = 3;    // 3+ circular patterns
const SAME_WALLET_LOOP_THRESHOLD = 2;  // 2+ buy/sell loops by same wallet
const SUB_SECOND_TRADE_THRESHOLD = 5;  // 5+ trades within <1s intervals
const PENALTY_AMOUNT = 40;

// =============================================================================
// DETECTION FUNCTIONS
// =============================================================================

/**
 * Detect if top 5 wallets dominate volume
 */
function detectTop5Concentration(trades: TradeRecord[]): {
  percent: number;
  suspicious: boolean;
} {
  if (trades.length === 0) return { percent: 0, suspicious: false };
  
  const volumeByWallet = new Map<string, number>();
  let totalVolume = 0;
  
  for (const trade of trades) {
    const current = volumeByWallet.get(trade.wallet) || 0;
    volumeByWallet.set(trade.wallet, current + trade.amount);
    totalVolume += trade.amount;
  }
  
  if (totalVolume === 0) return { percent: 0, suspicious: false };
  
  // Sort wallets by volume desc
  const sorted = [...volumeByWallet.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  
  const top5Volume = sorted.reduce((sum, [, vol]) => sum + vol, 0);
  const percent = (top5Volume / totalVolume) * 100;
  
  return {
    percent,
    suspicious: percent > TOP5_VOLUME_THRESHOLD,
  };
}

/**
 * Detect circular trades (wallet buys, sells, buys again)
 */
function detectCircularTrades(trades: TradeRecord[]): number {
  const walletTrades = new Map<string, TradeRecord[]>();
  
  for (const trade of trades) {
    const existing = walletTrades.get(trade.wallet) || [];
    existing.push(trade);
    walletTrades.set(trade.wallet, existing);
  }
  
  let circularCount = 0;
  
  walletTrades.forEach((wTrades) => {
    if (wTrades.length < 3) return;
    
    // Sort by timestamp
    const sorted = [...wTrades].sort((a, b) => a.timestamp - b.timestamp);
    
    // Look for buy → sell → buy pattern
    for (let i = 0; i < sorted.length - 2; i++) {
      if (
        sorted[i].side === 'buy' &&
        sorted[i + 1].side === 'sell' &&
        sorted[i + 2].side === 'buy'
      ) {
        circularCount++;
      }
    }
  });
  
  return circularCount;
}

/**
 * Detect same-wallet buy/sell loops
 */
function detectSameWalletLoops(trades: TradeRecord[]): number {
  const walletTrades = new Map<string, TradeRecord[]>();
  
  for (const trade of trades) {
    const existing = walletTrades.get(trade.wallet) || [];
    existing.push(trade);
    walletTrades.set(trade.wallet, existing);
  }
  
  let loopCount = 0;
  
  walletTrades.forEach((wTrades) => {
    const hasBuy = wTrades.some(t => t.side === 'buy');
    const hasSell = wTrades.some(t => t.side === 'sell');
    if (hasBuy && hasSell) loopCount++;
  });
  
  return loopCount;
}

/**
 * Detect sub-second repeated trade intervals
 */
function detectSubSecondTrades(trades: TradeRecord[]): number {
  if (trades.length < 2) return 0;
  
  const sorted = [...trades].sort((a, b) => a.timestamp - b.timestamp);
  let subSecondCount = 0;
  
  for (let i = 1; i < sorted.length; i++) {
    const diff = sorted[i].timestamp - sorted[i - 1].timestamp;
    if (diff < 1) { // Less than 1 second
      subSecondCount++;
    }
  }
  
  return subSecondCount;
}

// =============================================================================
// MAIN FUNCTION
// =============================================================================

/**
 * Analyze volume authenticity for a token
 * 
 * @param trades - Recent trade records from Birdeye
 * @returns Volume authenticity result with pass/fail and details
 */
export function analyzeVolumeAuthenticity(trades: TradeRecord[]): VolumeAuthenticityResult {
  const rule = 'VOLUME_AUTHENTICITY';
  
  if (trades.length < 5) {
    return {
      passed: true,
      rule,
      reason: `Only ${trades.length} trades - insufficient data for wash detection`,
      penalty: 0,
      details: {
        top5WalletVolumePercent: 0,
        circularTradeCount: 0,
        sameWalletLoopCount: 0,
        subSecondTradeCount: 0,
        isWashTrading: false,
        volumeScore: 50,
      },
    };
  }
  
  // Run all detections
  const top5 = detectTop5Concentration(trades);
  const circularCount = detectCircularTrades(trades);
  const loopCount = detectSameWalletLoops(trades);
  const subSecondCount = detectSubSecondTrades(trades);
  
  // Determine if wash trading
  const washIndicators = [
    top5.suspicious,
    circularCount >= CIRCULAR_TRADE_THRESHOLD,
    loopCount >= SAME_WALLET_LOOP_THRESHOLD,
    subSecondCount >= SUB_SECOND_TRADE_THRESHOLD,
  ];
  
  const washIndicatorCount = washIndicators.filter(Boolean).length;
  const isWashTrading = washIndicatorCount >= 2; // 2+ indicators = wash trading
  
  // Calculate volume score (0-100, 100 = authentic)
  let volumeScore = 100;
  if (top5.suspicious) volumeScore -= 25;
  if (circularCount >= CIRCULAR_TRADE_THRESHOLD) volumeScore -= 25;
  if (loopCount >= SAME_WALLET_LOOP_THRESHOLD) volumeScore -= 20;
  if (subSecondCount >= SUB_SECOND_TRADE_THRESHOLD) volumeScore -= 30;
  volumeScore = Math.max(0, volumeScore);
  
  // Build reason
  const reasons: string[] = [];
  if (top5.suspicious) reasons.push(`Top 5 wallets: ${top5.percent.toFixed(0)}% volume`);
  if (circularCount >= CIRCULAR_TRADE_THRESHOLD) reasons.push(`${circularCount} circular trades`);
  if (loopCount >= SAME_WALLET_LOOP_THRESHOLD) reasons.push(`${loopCount} buy/sell loops`);
  if (subSecondCount >= SUB_SECOND_TRADE_THRESHOLD) reasons.push(`${subSecondCount} sub-second trades`);
  
  if (isWashTrading) {
    return {
      passed: false,
      rule,
      reason: `Wash trading detected: ${reasons.join(', ')}`,
      penalty: PENALTY_AMOUNT,
      details: {
        top5WalletVolumePercent: top5.percent,
        circularTradeCount: circularCount,
        sameWalletLoopCount: loopCount,
        subSecondTradeCount: subSecondCount,
        isWashTrading: true,
        volumeScore,
      },
    };
  }
  
  if (reasons.length > 0) {
    return {
      passed: true,
      rule,
      reason: `Volume warnings: ${reasons.join(', ')}`,
      penalty: 15,
      details: {
        top5WalletVolumePercent: top5.percent,
        circularTradeCount: circularCount,
        sameWalletLoopCount: loopCount,
        subSecondTradeCount: subSecondCount,
        isWashTrading: false,
        volumeScore,
      },
    };
  }
  
  return {
    passed: true,
    rule,
    reason: `Volume authentic: score ${volumeScore}/100`,
    penalty: 0,
    details: {
      top5WalletVolumePercent: top5.percent,
      circularTradeCount: circularCount,
      sameWalletLoopCount: loopCount,
      subSecondTradeCount: subSecondCount,
      isWashTrading: false,
      volumeScore,
    },
  };
}

/**
 * Cache volume authenticity result to database
 */
export async function cacheVolumeResult(
  tokenAddress: string,
  result: VolumeAuthenticityResult
): Promise<void> {
  try {
    await supabase
      .from('volume_authenticity_cache')
      .insert({
        token_address: tokenAddress,
        top5_wallet_volume_percent: result.details.top5WalletVolumePercent,
        circular_trade_count: result.details.circularTradeCount,
        same_wallet_loop_count: result.details.sameWalletLoopCount,
        sub_second_trade_count: result.details.subSecondTradeCount,
        is_wash_trading: result.details.isWashTrading,
        volume_score: result.details.volumeScore,
      });
  } catch (err) {
    console.error('[VolumeAuthenticity] Cache error:', err);
  }
}
