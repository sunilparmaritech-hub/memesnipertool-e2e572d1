/**
 * SOL Delta Parser Module v2.0 - Institutional Grade
 * 
 * Extracts and validates SOL spent/received from on-chain transactions.
 * Uses dual-RPC verification to detect corrupted data.
 * Parses innerInstructions for WSOL wraps/unwraps, rent refunds, temp accounts.
 * 
 * SECURITY: Blocks P&L calculation if wallet balance deviation > 1%
 */

import { Connection, PublicKey, LAMPORTS_PER_SOL, ParsedTransactionWithMeta } from '@solana/web3.js';

// =============================================================================
// CONSTANTS
// =============================================================================

const WSOL_MINT = 'So11111111111111111111111111111111111111112';
const SYSTEM_PROGRAM = '11111111111111111111111111111111';
const TOKEN_PROGRAM = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
const ASSOCIATED_TOKEN_PROGRAM = 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL';

// Rent exemption for token accounts (approximate)
const TOKEN_ACCOUNT_RENT_LAMPORTS = 2039280;
const WSOL_ACCOUNT_RENT_LAMPORTS = 2039280;

// =============================================================================
// TYPES
// =============================================================================

export interface SolDeltaResult {
  solSpent: number;
  solReceived: number;
  netDelta: number;           // Positive = received, negative = spent
  fee: number;                // Transaction fee in SOL
  isValid: boolean;
  isCorrupted: boolean;
  corruptionReason?: string;
  walletBalanceBefore?: number;
  walletBalanceAfter?: number;
  computedBalanceAfter?: number;
  deviationPercent?: number;
  signature: string;
  timestamp: number;
  // New integrity flags
  integrityFlags: IntegrityFlags;
  // Detailed breakdown
  breakdown?: DeltaBreakdown;
}

export interface IntegrityFlags {
  buyWithNoSpend: boolean;      // BUY but solSpent <= 0
  sellWithNoReceive: boolean;   // SELL but solReceived <= 0
  impossibleRoi: boolean;       // ROI > 1000%
  wsolNoiseDetected: boolean;   // WSOL wrap/unwrap detected
  rentRefundDetected: boolean;  // Rent refund detected
  tempAccountDetected: boolean; // Temporary token account detected
}

export interface DeltaBreakdown {
  rawBalanceChange: number;     // postBalance - preBalance
  transactionFee: number;
  wsolWrapped: number;          // SOL wrapped to WSOL
  wsolUnwrapped: number;        // WSOL unwrapped to SOL
  rentPaid: number;             // Rent paid for account creation
  rentRefunded: number;         // Rent refunded from account closure
  tempAccountsCreated: number;
  tempAccountsClosed: number;
}

export interface DeltaExtractionInput {
  signature: string;
  walletAddress: string;
  tradeType: 'buy' | 'sell';
  expectedAmount?: number;      // Expected SOL amount for validation
  entryAmount?: number;         // For ROI calculation on sells
}

// =============================================================================
// RPC CONFIGURATION
// =============================================================================

const RPC_ENDPOINTS = {
  primary: import.meta.env.VITE_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com',
  secondary: 'https://rpc.ankr.com/solana',
  tertiary: 'https://solana.public-rpc.com',
};

const TIMEOUT_MS = 10000;
const DEVIATION_THRESHOLD_PERCENT = 1.0;
const IMPOSSIBLE_ROI_THRESHOLD = 1000; // 1000% = 10x

// =============================================================================
// CONNECTION HELPERS
// =============================================================================

function createConnection(rpcUrl: string): Connection {
  return new Connection(rpcUrl, {
    commitment: 'confirmed',
    confirmTransactionInitialTimeout: TIMEOUT_MS,
  });
}

async function fetchWithTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number = TIMEOUT_MS
): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('RPC timeout')), timeoutMs);
  });
  return Promise.race([promise, timeoutPromise]);
}

// =============================================================================
// BALANCE FETCHING (DUAL-RPC)
// =============================================================================

interface BalanceResult {
  balance: number;
  rpcUrl: string;
  latencyMs: number;
  success: boolean;
  error?: string;
}

async function fetchBalanceFromRpc(
  rpcUrl: string,
  walletAddress: string
): Promise<BalanceResult> {
  const startTime = Date.now();
  
  try {
    const connection = createConnection(rpcUrl);
    const publicKey = new PublicKey(walletAddress);
    
    const balance = await fetchWithTimeout(
      connection.getBalance(publicKey, 'confirmed')
    );
    
    return {
      balance: balance / LAMPORTS_PER_SOL,
      rpcUrl,
      latencyMs: Date.now() - startTime,
      success: true,
    };
  } catch (error: any) {
    return {
      balance: 0,
      rpcUrl,
      latencyMs: Date.now() - startTime,
      success: false,
      error: error.message || 'Unknown error',
    };
  }
}

async function fetchVerifiedBalance(
  walletAddress: string
): Promise<{ balance: number; verified: boolean; deviation: number }> {
  const [primary, secondary] = await Promise.all([
    fetchBalanceFromRpc(RPC_ENDPOINTS.primary, walletAddress),
    fetchBalanceFromRpc(RPC_ENDPOINTS.secondary, walletAddress),
  ]);
  
  if (primary.success && secondary.success) {
    const avg = (primary.balance + secondary.balance) / 2;
    const diff = Math.abs(primary.balance - secondary.balance);
    const deviation = avg > 0 ? (diff / avg) * 100 : 0;
    
    console.log(`[SolDelta] Balance check - Primary: ${primary.balance.toFixed(6)} | Secondary: ${secondary.balance.toFixed(6)} | Deviation: ${deviation.toFixed(3)}%`);
    
    return {
      balance: primary.balance,
      verified: deviation <= DEVIATION_THRESHOLD_PERCENT,
      deviation,
    };
  }
  
  if (primary.success) {
    return { balance: primary.balance, verified: false, deviation: 0 };
  }
  if (secondary.success) {
    return { balance: secondary.balance, verified: false, deviation: 0 };
  }
  
  return { balance: 0, verified: false, deviation: 100 };
}

// =============================================================================
// WALLET INDEX FINDER
// =============================================================================

function findWalletIndex(
  accountKeys: any[],
  walletAddress: string
): number {
  for (let i = 0; i < accountKeys.length; i++) {
    const key = accountKeys[i];
    let pubkeyString: string;
    
    if (typeof key === 'string') {
      pubkeyString = key;
    } else if (key?.pubkey) {
      // ParsedMessageAccount format
      pubkeyString = typeof key.pubkey === 'string' 
        ? key.pubkey 
        : key.pubkey.toBase58?.() || key.pubkey.toString();
    } else if (key?.toBase58) {
      pubkeyString = key.toBase58();
    } else {
      pubkeyString = key.toString();
    }
    
    if (pubkeyString === walletAddress) {
      return i;
    }
  }
  
  return -1;
}

// =============================================================================
// INNER INSTRUCTION PARSER
// =============================================================================

interface InnerInstructionAnalysis {
  wsolWrapped: number;          // Lamports wrapped to WSOL
  wsolUnwrapped: number;        // Lamports unwrapped from WSOL
  rentPaid: number;             // Lamports paid for rent
  rentRefunded: number;         // Lamports refunded from closures
  tempAccountsCreated: number;
  tempAccountsClosed: number;
  walletDebits: number;         // Total lamports debited from wallet
  walletCredits: number;        // Total lamports credited to wallet
}

function parseInnerInstructions(
  tx: ParsedTransactionWithMeta,
  walletAddress: string,
  walletIndex: number
): InnerInstructionAnalysis {
  const analysis: InnerInstructionAnalysis = {
    wsolWrapped: 0,
    wsolUnwrapped: 0,
    rentPaid: 0,
    rentRefunded: 0,
    tempAccountsCreated: 0,
    tempAccountsClosed: 0,
    walletDebits: 0,
    walletCredits: 0,
  };
  
  if (!tx.meta?.innerInstructions) {
    return analysis;
  }
  
  const accountKeys = tx.transaction.message.accountKeys;
  
  // Track token accounts created/closed in this transaction
  const createdAccounts = new Set<string>();
  const closedAccounts = new Set<string>();
  
  for (const innerGroup of tx.meta.innerInstructions) {
    for (const instruction of innerGroup.instructions) {
      // Handle parsed instructions
      if ('parsed' in instruction && instruction.parsed) {
        const parsed = instruction.parsed as any;
        const programId = instruction.programId?.toString() || '';
        
        // System Program transfers
        if (programId === SYSTEM_PROGRAM || instruction.program === 'system') {
          if (parsed.type === 'transfer') {
            const info = parsed.info;
            const lamports = info.lamports || 0;
            
            if (info.source === walletAddress) {
              analysis.walletDebits += lamports;
            }
            if (info.destination === walletAddress) {
              analysis.walletCredits += lamports;
            }
          }
          
          // Create account (potential rent payment)
          if (parsed.type === 'createAccount') {
            const info = parsed.info;
            const lamports = info.lamports || 0;
            
            if (info.source === walletAddress) {
              analysis.rentPaid += lamports;
              analysis.tempAccountsCreated++;
              createdAccounts.add(info.newAccount);
            }
          }
        }
        
        // Token Program operations
        if (programId === TOKEN_PROGRAM || instruction.program === 'spl-token') {
          // Close account - check for rent refund
          if (parsed.type === 'closeAccount') {
            const info = parsed.info;
            
            if (info.destination === walletAddress) {
              // Rent refund to wallet
              analysis.rentRefunded += TOKEN_ACCOUNT_RENT_LAMPORTS;
              analysis.tempAccountsClosed++;
              closedAccounts.add(info.account);
            }
          }
          
          // Sync native (WSOL unwrap signal)
          if (parsed.type === 'syncNative') {
            // This often precedes WSOL operations
            analysis.wsolUnwrapped += 0; // Will be calculated from balance changes
          }
        }
      }
    }
  }
  
  // Detect WSOL wrap/unwrap from token balance changes
  if (tx.meta.preTokenBalances && tx.meta.postTokenBalances) {
    const preWsol = tx.meta.preTokenBalances
      .filter(b => b.mint === WSOL_MINT && b.owner === walletAddress)
      .reduce((sum, b) => sum + Number(b.uiTokenAmount?.amount || 0), 0);
    
    const postWsol = tx.meta.postTokenBalances
      .filter(b => b.mint === WSOL_MINT && b.owner === walletAddress)
      .reduce((sum, b) => sum + Number(b.uiTokenAmount?.amount || 0), 0);
    
    const wsolDelta = postWsol - preWsol;
    
    if (wsolDelta > 0) {
      // SOL was wrapped to WSOL
      analysis.wsolWrapped = wsolDelta;
    } else if (wsolDelta < 0) {
      // WSOL was unwrapped to SOL
      analysis.wsolUnwrapped = Math.abs(wsolDelta);
    }
  }
  
  console.log(`[SolDelta] Inner analysis: Debits=${analysis.walletDebits} Credits=${analysis.walletCredits} RentPaid=${analysis.rentPaid} RentRefunded=${analysis.rentRefunded} WSOLWrap=${analysis.wsolWrapped} WSOLUnwrap=${analysis.wsolUnwrapped}`);
  
  return analysis;
}

// =============================================================================
// INSTITUTIONAL-GRADE DELTA EXTRACTION
// =============================================================================

function extractDeltaFromTransaction(
  tx: ParsedTransactionWithMeta,
  walletAddress: string
): {
  solSpent: number;
  solReceived: number;
  fee: number;
  breakdown: DeltaBreakdown;
  integrityFlags: Partial<IntegrityFlags>;
} {
  const defaultResult = {
    solSpent: 0,
    solReceived: 0,
    fee: 0,
    breakdown: {
      rawBalanceChange: 0,
      transactionFee: 0,
      wsolWrapped: 0,
      wsolUnwrapped: 0,
      rentPaid: 0,
      rentRefunded: 0,
      tempAccountsCreated: 0,
      tempAccountsClosed: 0,
    },
    integrityFlags: {
      wsolNoiseDetected: false,
      rentRefundDetected: false,
      tempAccountDetected: false,
    },
  };
  
  if (!tx.meta) {
    console.warn('[SolDelta] No transaction metadata');
    return defaultResult;
  }
  
  // Step 1: Find wallet index in account keys
  const accountKeys = tx.transaction.message.accountKeys;
  const walletIndex = findWalletIndex(accountKeys, walletAddress);
  
  if (walletIndex === -1) {
    console.warn('[SolDelta] Wallet not found in transaction accounts');
    return defaultResult;
  }
  
  console.log(`[SolDelta] Wallet found at index ${walletIndex}`);
  
  // Step 2: Extract pre/post balances at wallet index
  const preBalances = tx.meta.preBalances || [];
  const postBalances = tx.meta.postBalances || [];
  
  const preBalanceLamports = preBalances[walletIndex] || 0;
  const postBalanceLamports = postBalances[walletIndex] || 0;
  const feeLamports = tx.meta.fee || 0;
  
  // Step 3: Parse inner instructions for WSOL, rent, temp accounts
  const innerAnalysis = parseInnerInstructions(tx, walletAddress, walletIndex);
  
  // Step 4: Calculate TRUE SOL movement
  const rawBalanceChangeLamports = postBalanceLamports - preBalanceLamports;
  
  // The raw balance change includes:
  // - Transaction fee (deducted)
  // - SOL spent on swap (deducted)
  // - SOL received from swap (credited)
  // - Rent for new accounts (deducted)
  // - Rent refunds from closed accounts (credited)
  // - WSOL wrap noise (deducted then credited back)
  
  // For a BUY: rawDelta = -fee - solSpent - rentPaid + rentRefunded
  // For a SELL: rawDelta = -fee + solReceived - rentPaid + rentRefunded
  
  // Calculate effective SOL movement excluding rent noise
  const rentNet = innerAnalysis.rentRefunded - innerAnalysis.rentPaid;
  
  // The actual SOL delta for the trade (excluding fee and rent)
  const tradeDeltaLamports = rawBalanceChangeLamports + feeLamports - rentNet;
  
  let solSpent = 0;
  let solReceived = 0;
  
  if (tradeDeltaLamports < 0) {
    // Net outflow = SOL spent on trade
    solSpent = Math.abs(tradeDeltaLamports) / LAMPORTS_PER_SOL;
  } else {
    // Net inflow = SOL received from trade
    solReceived = tradeDeltaLamports / LAMPORTS_PER_SOL;
  }
  
  const breakdown: DeltaBreakdown = {
    rawBalanceChange: rawBalanceChangeLamports / LAMPORTS_PER_SOL,
    transactionFee: feeLamports / LAMPORTS_PER_SOL,
    wsolWrapped: innerAnalysis.wsolWrapped / LAMPORTS_PER_SOL,
    wsolUnwrapped: innerAnalysis.wsolUnwrapped / LAMPORTS_PER_SOL,
    rentPaid: innerAnalysis.rentPaid / LAMPORTS_PER_SOL,
    rentRefunded: innerAnalysis.rentRefunded / LAMPORTS_PER_SOL,
    tempAccountsCreated: innerAnalysis.tempAccountsCreated,
    tempAccountsClosed: innerAnalysis.tempAccountsClosed,
  };
  
  const integrityFlags: Partial<IntegrityFlags> = {
    wsolNoiseDetected: innerAnalysis.wsolWrapped > 0 || innerAnalysis.wsolUnwrapped > 0,
    rentRefundDetected: innerAnalysis.rentRefunded > 0,
    tempAccountDetected: innerAnalysis.tempAccountsCreated > 0 || innerAnalysis.tempAccountsClosed > 0,
  };
  
  console.log(`[SolDelta] Pre: ${(preBalanceLamports / LAMPORTS_PER_SOL).toFixed(6)} | Post: ${(postBalanceLamports / LAMPORTS_PER_SOL).toFixed(6)} | Raw: ${(rawBalanceChangeLamports / LAMPORTS_PER_SOL).toFixed(6)} | Fee: ${(feeLamports / LAMPORTS_PER_SOL).toFixed(6)}`);
  console.log(`[SolDelta] Trade delta: ${(tradeDeltaLamports / LAMPORTS_PER_SOL).toFixed(6)} | Spent: ${solSpent.toFixed(6)} | Received: ${solReceived.toFixed(6)}`);
  
  return {
    solSpent,
    solReceived,
    fee: feeLamports / LAMPORTS_PER_SOL,
    breakdown,
    integrityFlags,
  };
}

// =============================================================================
// MAIN PARSER
// =============================================================================

export async function parseSolDelta(input: DeltaExtractionInput): Promise<SolDeltaResult> {
  const { signature, walletAddress, tradeType, entryAmount } = input;
  const timestamp = Date.now();
  
  console.log(`[SolDelta] Parsing ${tradeType.toUpperCase()} tx: ${signature.slice(0, 12)}...`);
  
  const defaultFlags: IntegrityFlags = {
    buyWithNoSpend: false,
    sellWithNoReceive: false,
    impossibleRoi: false,
    wsolNoiseDetected: false,
    rentRefundDetected: false,
    tempAccountDetected: false,
  };
  
  try {
    // Step 1: Fetch transaction from primary RPC
    const primaryConnection = createConnection(RPC_ENDPOINTS.primary);
    
    const tx = await fetchWithTimeout(
      primaryConnection.getParsedTransaction(signature, {
        maxSupportedTransactionVersion: 0,
        commitment: 'confirmed',
      })
    );
    
    if (!tx) {
      return {
        solSpent: 0,
        solReceived: 0,
        netDelta: 0,
        fee: 0,
        isValid: false,
        isCorrupted: true,
        corruptionReason: 'Transaction not found on primary RPC',
        signature,
        timestamp,
        integrityFlags: defaultFlags,
      };
    }
    
    // Step 2: Extract SOL delta with institutional-grade parsing
    const { solSpent, solReceived, fee, breakdown, integrityFlags: partialFlags } = 
      extractDeltaFromTransaction(tx, walletAddress);
    
    const netDelta = solReceived - solSpent;
    
    // Step 3: Build integrity flags
    const integrityFlags: IntegrityFlags = {
      ...defaultFlags,
      ...partialFlags,
      buyWithNoSpend: tradeType === 'buy' && solSpent <= 0,
      sellWithNoReceive: tradeType === 'sell' && solReceived <= 0,
      impossibleRoi: false, // Calculate below
    };
    
    // Check for impossible ROI on sells
    if (tradeType === 'sell' && entryAmount && entryAmount > 0) {
      const roiPercent = ((solReceived - entryAmount) / entryAmount) * 100;
      if (roiPercent > IMPOSSIBLE_ROI_THRESHOLD) {
        integrityFlags.impossibleRoi = true;
        console.warn(`[SolDelta] ⚠️ Impossible ROI detected: ${roiPercent.toFixed(1)}%`);
      }
    }
    
    // Step 4: Get wallet balances from transaction
    const accountKeys = tx.transaction.message.accountKeys;
    const walletIndex = findWalletIndex(accountKeys, walletAddress);
    
    const walletBalanceBefore = walletIndex >= 0 
      ? (tx.meta?.preBalances?.[walletIndex] || 0) / LAMPORTS_PER_SOL 
      : undefined;
    const walletBalanceAfter = walletIndex >= 0 
      ? (tx.meta?.postBalances?.[walletIndex] || 0) / LAMPORTS_PER_SOL 
      : undefined;
    
    // Step 5: Dual-RPC verification
    const currentBalance = await fetchVerifiedBalance(walletAddress);
    
    // Step 6: Determine corruption status
    let isCorrupted = false;
    let corruptionReason: string | undefined;
    let deviationPercent: number | undefined;
    
    // Integrity flag violations
    if (integrityFlags.buyWithNoSpend) {
      isCorrupted = true;
      corruptionReason = 'BUY transaction shows no SOL spent';
    }
    
    if (integrityFlags.sellWithNoReceive && !isCorrupted) {
      isCorrupted = true;
      corruptionReason = 'SELL transaction shows no SOL received';
    }
    
    if (integrityFlags.impossibleRoi && !isCorrupted) {
      isCorrupted = true;
      corruptionReason = `Impossible ROI detected (>${IMPOSSIBLE_ROI_THRESHOLD}%)`;
    }
    
    // RPC deviation check
    if (!currentBalance.verified && currentBalance.deviation > DEVIATION_THRESHOLD_PERCENT && !isCorrupted) {
      isCorrupted = true;
      corruptionReason = `RPC balance mismatch: ${currentBalance.deviation.toFixed(2)}% deviation`;
      deviationPercent = currentBalance.deviation;
    }
    
    // Step 7: Validate expected amount if provided
    if (input.expectedAmount !== undefined && !isCorrupted) {
      const actualAmount = tradeType === 'buy' ? solSpent : solReceived;
      const expectedDiff = Math.abs(actualAmount - input.expectedAmount);
      const expectedDeviation = input.expectedAmount > 0 
        ? (expectedDiff / input.expectedAmount) * 100 
        : 0;
      
      if (expectedDeviation > 10) {
        console.warn(`[SolDelta] Amount deviation: expected ${input.expectedAmount}, got ${actualAmount} (${expectedDeviation.toFixed(1)}%)`);
      }
    }
    
    const result: SolDeltaResult = {
      solSpent,
      solReceived,
      netDelta,
      fee,
      isValid: !isCorrupted && (solSpent > 0 || solReceived > 0),
      isCorrupted,
      corruptionReason,
      walletBalanceBefore,
      walletBalanceAfter,
      computedBalanceAfter: walletBalanceAfter,
      deviationPercent,
      signature,
      timestamp,
      integrityFlags,
      breakdown,
    };
    
    if (isCorrupted) {
      console.error(`[SolDelta] ⚠️ CORRUPTED: ${corruptionReason}`);
    } else {
      console.log(`[SolDelta] ✓ Valid: Spent ${solSpent.toFixed(6)} | Received ${solReceived.toFixed(6)} | Fee ${fee.toFixed(6)}`);
    }
    
    return result;
    
  } catch (error: any) {
    console.error('[SolDelta] Parse error:', error);
    
    return {
      solSpent: 0,
      solReceived: 0,
      netDelta: 0,
      fee: 0,
      isValid: false,
      isCorrupted: true,
      corruptionReason: error.message || 'Failed to parse transaction',
      signature,
      timestamp,
      integrityFlags: defaultFlags,
    };
  }
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

export async function verifyDeltaWithBalance(
  walletAddress: string,
  expectedDelta: number,
  balanceBefore: number
): Promise<{ verified: boolean; actualDelta: number; deviation: number }> {
  const currentBalance = await fetchVerifiedBalance(walletAddress);
  
  if (!currentBalance.verified) {
    console.warn('[SolDelta] Balance verification incomplete - RPCs disagree');
  }
  
  const actualDelta = currentBalance.balance - balanceBefore;
  const diff = Math.abs(actualDelta - expectedDelta);
  const deviation = Math.abs(expectedDelta) > 0 
    ? (diff / Math.abs(expectedDelta)) * 100 
    : (diff > 0 ? 100 : 0);
  
  const verified = deviation <= DEVIATION_THRESHOLD_PERCENT;
  
  console.log(`[SolDelta] Delta verification: Expected ${expectedDelta.toFixed(6)} | Actual ${actualDelta.toFixed(6)} | Deviation ${deviation.toFixed(2)}%`);
  
  return { verified, actualDelta, deviation };
}

export function shouldBlockPnlCalculation(result: SolDeltaResult): boolean {
  if (result.isCorrupted) return true;
  if (result.deviationPercent !== undefined && result.deviationPercent > DEVIATION_THRESHOLD_PERCENT) return true;
  if (!result.isValid) return true;
  if (result.integrityFlags.buyWithNoSpend) return true;
  if (result.integrityFlags.sellWithNoReceive) return true;
  if (result.integrityFlags.impossibleRoi) return true;
  return false;
}

export async function getPreTradeBalanceSnapshot(
  walletAddress: string
): Promise<{ balance: number; verified: boolean; timestamp: number }> {
  const result = await fetchVerifiedBalance(walletAddress);
  
  return {
    balance: result.balance,
    verified: result.verified,
    timestamp: Date.now(),
  };
}

/**
 * Check if a delta result has any integrity warnings (non-blocking)
 */
export function hasIntegrityWarnings(result: SolDeltaResult): boolean {
  return (
    result.integrityFlags.wsolNoiseDetected ||
    result.integrityFlags.rentRefundDetected ||
    result.integrityFlags.tempAccountDetected
  );
}

/**
 * Get a human-readable summary of integrity flags
 */
export function getIntegritySummary(flags: IntegrityFlags): string[] {
  const warnings: string[] = [];
  
  if (flags.buyWithNoSpend) warnings.push('BUY with no SOL spent');
  if (flags.sellWithNoReceive) warnings.push('SELL with no SOL received');
  if (flags.impossibleRoi) warnings.push('Impossible ROI (>1000%)');
  if (flags.wsolNoiseDetected) warnings.push('WSOL wrap/unwrap detected');
  if (flags.rentRefundDetected) warnings.push('Rent refund detected');
  if (flags.tempAccountDetected) warnings.push('Temporary accounts used');
  
  return warnings;
}
