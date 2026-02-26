/**
 * Transaction Integrity Library
 * 
 * Single source of truth for P&L calculations, ROI validation,
 * and wallet reconciliation using on-chain SOL delta.
 * 
 * RULES:
 * - P&L is ALWAYS calculated from SOL delta: solReceived - solSpent
 * - ROI is ONLY shown for confirmed SELL transactions
 * - Never calculate P&L from price math
 * - Never display ROI without confirmed SELL
 */

export interface TransactionRecord {
  id: string;
  user_id: string;
  token_address: string;
  token_symbol: string | null;
  token_name: string | null;
  trade_type: 'buy' | 'sell';
  amount: number;
  // New semantic columns
  sol_spent: number | null;      // BUY: actual SOL deducted, SELL: 0
  sol_received: number | null;   // SELL: actual SOL received, BUY: 0
  token_amount: number | null;   // Actual token delta
  realized_pnl_sol: number | null; // SELL only: solReceived - solSpent
  roi_percent: number | null;    // SELL only: (pnl / solSpent) * 100
  sol_balance_after: number | null;
  // Legacy columns (for backwards compatibility)
  price_sol: number | null;
  price_usd: number | null;
  // Metadata
  buyer_position: number | null;
  liquidity: number | null;
  risk_score: number | null;
  entry_price: number | null;
  exit_price: number | null;
  slippage: number | null;
  // Integrity tracking
  data_source: 'legacy' | 'on_chain' | 'calculated';
  is_corrupted: boolean;
  corruption_reason: string | null;
  matched_buy_tx_hash: string | null;
  // Standard fields
  status: string | null;
  tx_hash: string | null;
  created_at: string;
}

export interface PortfolioMetrics {
  totalInvestedSol: number;       // Sum of all solSpent from confirmed BUYs
  totalRealizedPnlSol: number;    // Sum of all realized_pnl_sol from confirmed SELLs
  unrealizedPnlSol: number;       // Calculated from open positions
  currentHoldings: number;        // Count of open positions
  netSolFlow: number;             // totalSellReceived - totalBuySpent
  averageRoiPercent: number;      // Average ROI of completed trades
  winRate: number;                // Percentage of profitable sells
}

export interface TradeIntegrityCheck {
  passed: boolean;
  issues: string[];
  corrections: { field: string; oldValue: any; newValue: any }[];
}

/**
 * Validate a BUY transaction record
 */
export function validateBuyTransaction(record: TransactionRecord): TradeIntegrityCheck {
  const issues: string[] = [];
  const corrections: TradeIntegrityCheck['corrections'] = [];

  // BUY must have sol_spent > 0
  if (record.sol_spent === null || record.sol_spent <= 0) {
    if (record.price_sol && record.price_sol > 0) {
      corrections.push({ field: 'sol_spent', oldValue: record.sol_spent, newValue: record.price_sol });
    } else {
      issues.push('BUY transaction missing sol_spent');
    }
  }

  // BUY should have sol_received = 0 or null
  if (record.sol_received && record.sol_received > 0) {
    issues.push('BUY transaction has non-zero sol_received');
  }

  // BUY should NOT have realized_pnl_sol
  if (record.realized_pnl_sol !== null) {
    corrections.push({ field: 'realized_pnl_sol', oldValue: record.realized_pnl_sol, newValue: null });
    issues.push('BUY transaction should not have realized P&L');
  }

  // BUY should NOT have roi_percent
  if (record.roi_percent !== null) {
    corrections.push({ field: 'roi_percent', oldValue: record.roi_percent, newValue: null });
    issues.push('BUY transaction should not have ROI');
  }

  return {
    passed: issues.length === 0,
    issues,
    corrections,
  };
}

/**
 * Validate a SELL transaction record
 */
export function validateSellTransaction(
  record: TransactionRecord,
  matchedBuySolSpent: number | null
): TradeIntegrityCheck {
  const issues: string[] = [];
  const corrections: TradeIntegrityCheck['corrections'] = [];

  // SELL must have sol_received >= 0
  if (record.sol_received === null) {
    if (record.price_sol && record.price_sol > 0) {
      corrections.push({ field: 'sol_received', oldValue: record.sol_received, newValue: record.price_sol });
    } else {
      issues.push('SELL transaction missing sol_received');
    }
  }

  // SELL should have sol_spent = 0 or null
  if (record.sol_spent && record.sol_spent > 0) {
    issues.push('SELL transaction has non-zero sol_spent');
  }

  // Validate realized P&L if we have matched buy
  if (matchedBuySolSpent !== null && matchedBuySolSpent > 0) {
    const expectedPnl = (record.sol_received || 0) - matchedBuySolSpent;
    if (record.realized_pnl_sol !== null && Math.abs(record.realized_pnl_sol - expectedPnl) > 0.001) {
      corrections.push({ 
        field: 'realized_pnl_sol', 
        oldValue: record.realized_pnl_sol, 
        newValue: expectedPnl 
      });
      issues.push('SELL transaction P&L mismatch');
    }

    // Validate ROI
    const expectedRoi = (expectedPnl / matchedBuySolSpent) * 100;
    if (record.roi_percent !== null && Math.abs(record.roi_percent - expectedRoi) > 0.1) {
      corrections.push({
        field: 'roi_percent',
        oldValue: record.roi_percent,
        newValue: expectedRoi,
      });
      issues.push('SELL transaction ROI mismatch');
    }
  }

  return {
    passed: issues.length === 0,
    issues,
    corrections,
  };
}

/**
 * Calculate realized P&L for a SELL using on-chain SOL delta (FIFO)
 */
export function calculateRealizedPnl(
  solReceived: number,
  matchedBuySolSpent: number
): { pnlSol: number; roiPercent: number } {
  if (matchedBuySolSpent <= 0) {
    return { pnlSol: 0, roiPercent: 0 };
  }

  const pnlSol = solReceived - matchedBuySolSpent;
  const roiPercent = (pnlSol / matchedBuySolSpent) * 100;

  return { pnlSol, roiPercent };
}

/**
 * Check for impossible/corrupted ROI values
 */
export function isCorruptedRoi(
  roiPercent: number | null,
  solReceived: number | null,
  solSpent: number | null
): { isCorrupted: boolean; reason: string | null } {
  if (roiPercent === null) {
    return { isCorrupted: false, reason: null };
  }

  // ROI > 500% with sol_received < 0.1 SOL is suspicious
  if (roiPercent > 500 && (solReceived || 0) < 0.1) {
    return { 
      isCorrupted: true, 
      reason: `Impossible ROI: ${roiPercent.toFixed(1)}% with only ${solReceived?.toFixed(4)} SOL received` 
    };
  }

  // ROI from price-only math (no sol values) is invalid
  if (solReceived === null && solSpent === null && roiPercent !== 0) {
    return {
      isCorrupted: true,
      reason: 'ROI calculated from price math only, no SOL delta available',
    };
  }

  // sol_received = 0 for a SELL means scam/honeypot
  if (solReceived === 0 && roiPercent !== -100) {
    return {
      isCorrupted: true,
      reason: 'SELL returned 0 SOL but ROI is not -100%',
    };
  }

  return { isCorrupted: false, reason: null };
}

/**
 * Calculate actual slippage from quote vs execution
 */
export function calculateActualSlippage(
  expectedOutput: number,
  actualOutput: number
): number {
  if (expectedOutput <= 0) return 0;
  return ((expectedOutput - actualOutput) / expectedOutput) * 100;
}

/**
 * Match SELL transactions to BUY transactions using FIFO
 */
export function matchSellToBuy(
  sells: TransactionRecord[],
  buys: TransactionRecord[]
): Map<string, TransactionRecord> {
  const matches = new Map<string, TransactionRecord>();
  
  // Sort buys by date ascending (FIFO)
  const sortedBuys = [...buys].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  // Group buys by token
  const buysByToken = new Map<string, TransactionRecord[]>();
  for (const buy of sortedBuys) {
    const existing = buysByToken.get(buy.token_address) || [];
    existing.push(buy);
    buysByToken.set(buy.token_address, existing);
  }

  // Match each sell to the oldest buy for that token
  for (const sell of sells) {
    const tokenBuys = buysByToken.get(sell.token_address) || [];
    if (tokenBuys.length > 0) {
      const matchedBuy = tokenBuys[0]; // FIFO - take oldest
      matches.set(sell.id, matchedBuy);
      tokenBuys.shift(); // Remove matched buy
    }
  }

  return matches;
}

/**
 * Build portfolio metrics from transaction history
 */
export function buildPortfolioMetrics(transactions: TransactionRecord[]): PortfolioMetrics {
  const confirmedTx = transactions.filter(t => t.status === 'confirmed' && !t.is_corrupted);
  
  const buys = confirmedTx.filter(t => t.trade_type === 'buy');
  const sells = confirmedTx.filter(t => t.trade_type === 'sell');

  const totalInvestedSol = buys.reduce((sum, t) => sum + (t.sol_spent || t.price_sol || 0), 0);
  const totalRealizedPnlSol = sells.reduce((sum, t) => sum + (t.realized_pnl_sol || 0), 0);
  const totalSellReceived = sells.reduce((sum, t) => sum + (t.sol_received || t.price_sol || 0), 0);

  // Calculate win rate
  const profitableSells = sells.filter(t => (t.realized_pnl_sol || 0) > 0);
  const winRate = sells.length > 0 ? (profitableSells.length / sells.length) * 100 : 0;

  // Calculate average ROI
  const validRois = sells.filter(t => t.roi_percent !== null && !isCorruptedRoi(t.roi_percent, t.sol_received, t.sol_spent).isCorrupted);
  const averageRoiPercent = validRois.length > 0
    ? validRois.reduce((sum, t) => sum + (t.roi_percent || 0), 0) / validRois.length
    : 0;

  // Count unique open positions (tokens with buy but no sell)
  const soldTokens = new Set(sells.map(t => t.token_address));
  const openPositions = new Set(buys.filter(t => !soldTokens.has(t.token_address)).map(t => t.token_address));

  return {
    totalInvestedSol,
    totalRealizedPnlSol,
    unrealizedPnlSol: 0, // Must be calculated from current prices
    currentHoldings: openPositions.size,
    netSolFlow: totalSellReceived - totalInvestedSol,
    averageRoiPercent,
    winRate,
  };
}

/**
 * Data integrity guards - prevent invalid data from being logged
 */
export const DataIntegrityGuards = {
  // Guard 1: Prevent SELL without prior BUY
  canLogSell(tokenAddress: string, existingBuys: TransactionRecord[]): { allowed: boolean; reason?: string } {
    const hasMatchingBuy = existingBuys.some(
      b => b.token_address === tokenAddress && b.trade_type === 'buy' && b.status === 'confirmed'
    );
    if (!hasMatchingBuy) {
      return { allowed: false, reason: 'Cannot log SELL without prior confirmed BUY for this token' };
    }
    return { allowed: true };
  },

  // Guard 2: Prevent ROI calculation without sol_received
  canCalculateRoi(solReceived: number | null, solSpent: number | null): { allowed: boolean; reason?: string } {
    if (solReceived === null || solReceived === undefined) {
      return { allowed: false, reason: 'Cannot calculate ROI without sol_received' };
    }
    if (solSpent === null || solSpent === undefined || solSpent <= 0) {
      return { allowed: false, reason: 'Cannot calculate ROI without valid sol_spent from matched BUY' };
    }
    return { allowed: true };
  },

  // Guard 3: Prevent logging without confirmed signature
  canLogTransaction(signature: string | null | undefined, confirmed: boolean): { allowed: boolean; reason?: string } {
    if (!signature) {
      return { allowed: false, reason: 'Cannot log transaction without signature' };
    }
    if (!confirmed) {
      return { allowed: false, reason: 'Cannot log transaction without confirmation' };
    }
    return { allowed: true };
  },

  // Guard 4: Prevent negative wallet balance
  isValidBalance(balance: number): { valid: boolean; reason?: string } {
    if (balance < 0) {
      return { valid: false, reason: 'Wallet balance cannot be negative' };
    }
    return { valid: true };
  },

  // Guard 5: Prevent P&L display for unrealized trades
  canShowPnl(tradeType: 'buy' | 'sell', status: string | null): { allowed: boolean; reason?: string } {
    if (tradeType === 'buy') {
      return { allowed: false, reason: 'P&L should not be shown for BUY transactions' };
    }
    if (status !== 'confirmed') {
      return { allowed: false, reason: 'P&L should not be shown for unconfirmed transactions' };
    }
    return { allowed: true };
  },
};
