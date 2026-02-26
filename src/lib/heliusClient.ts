/**
 * Helius API Client
 * 
 * Provides:
 * - Enhanced transaction parsing
 * - 2-layer wallet funding graph
 * - Deployer funding source tracing
 * - Buyer funding source tracing
 * - Wallet age analysis
 * 
 * Results cached for 60 seconds.
 */

import { supabase } from '@/integrations/supabase/client';

// =============================================================================
// TYPES
// =============================================================================

export interface WalletFundingInfo {
  walletAddress: string;
  fundingSource: string | null;     // Immediate funder
  fundingDepth2Source: string | null; // Funder's funder
  isFreshWallet: boolean;           // Created < 24h ago
  isCexFunded: boolean;             // Funded from known CEX
  walletAgeHours: number;
  initialFundingSol: number;
  firstTxTimestamp: number | null;
}

export interface WalletClusterAnalysis {
  wallets: WalletFundingInfo[];
  sharedOriginPercent: number;      // % of wallets sharing same depth-2 origin
  sharedOriginWallet: string | null;
  clusterDetected: boolean;         // >40% share same origin
  clusterSize: number;
  analysisTimestamp: number;
}

export interface HeliusTransaction {
  signature: string;
  timestamp: number;
  type: string;
  source: string;
  fee: number;
  nativeTransfers: Array<{
    fromUserAccount: string;
    toUserAccount: string;
    amount: number;
  }>;
  tokenTransfers: Array<{
    fromUserAccount: string;
    toUserAccount: string;
    mint: string;
    tokenAmount: number;
  }>;
}

// =============================================================================
// KNOWN CEX ADDRESSES
// =============================================================================

const KNOWN_CEX_WALLETS = new Set([
  // Binance
  '5tzFkiKscjHogoZG4S7cjC3v8wSoQ8r4ZX2xNB1VrYCZ',
  '9WzDXwBbmPELPRCEo3F7TiMABZEbExnEXGtjMZSW1mDY',
  // Coinbase
  'H8sMJSCQxfKiFTCfDR3DUg2cw3vm73U3KLGAAcvPYMES',
  // OKX
  '5VCwKtCXgCJ6kit5FybXjvriW3xELsFDhYrPSqtJNmcD',
  // Kraken
  'FWznbcNXWQuHTawe9RxvQ2LdCENssh12dsznf4RiouN5',
  // Bybit
  'AC5RDfQFmDS1deWZos921JfqscXdByf4BKk5r7YdeLXM',
]);

// =============================================================================
// CACHE
// =============================================================================

const CACHE_TTL_MS = 60_000; // 60 seconds
const walletCache = new Map<string, { data: WalletFundingInfo; expiresAt: number }>();

function getCachedWallet(address: string): WalletFundingInfo | null {
  const entry = walletCache.get(address);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    walletCache.delete(address);
    return null;
  }
  return entry.data;
}

function setCacheWallet(address: string, data: WalletFundingInfo): void {
  walletCache.set(address, { data, expiresAt: Date.now() + CACHE_TTL_MS });
  if (walletCache.size > 500) {
    const now = Date.now();
    for (const [key, val] of walletCache) {
      if (now > val.expiresAt) walletCache.delete(key);
    }
  }
}

// =============================================================================
// API CALLS (via Edge Function proxy)
// =============================================================================

/**
 * Fetch wallet transaction history via edge function
 */
async function fetchWalletTransactions(
  walletAddress: string,
  limit: number = 10
): Promise<HeliusTransaction[]> {
  try {
    const { data, error } = await supabase.functions.invoke('helius-proxy', {
      body: { 
        endpoint: 'transactions',
        walletAddress,
        limit,
      },
    });
    
    if (error || !data?.success) {
      console.error('[Helius] Transaction fetch error:', error || data?.error);
      return [];
    }
    
    return data.data as HeliusTransaction[];
  } catch (err) {
    console.error('[Helius] Transaction unexpected error:', err);
    return [];
  }
}

// =============================================================================
// WALLET ANALYSIS
// =============================================================================

/**
 * Analyze a single wallet's funding source (depth 1)
 */
async function analyzeWalletFunding(walletAddress: string): Promise<WalletFundingInfo> {
  // Check cache
  const cached = getCachedWallet(walletAddress);
  if (cached) return cached;
  
  try {
    const transactions = await fetchWalletTransactions(walletAddress, 5);
    
    if (transactions.length === 0) {
      const info: WalletFundingInfo = {
        walletAddress,
        fundingSource: null,
        fundingDepth2Source: null,
        isFreshWallet: true,
        isCexFunded: false,
        walletAgeHours: 0,
        initialFundingSol: 0,
        firstTxTimestamp: null,
      };
      setCacheWallet(walletAddress, info);
      return info;
    }
    
    // Sort by timestamp ascending to find first transaction
    const sorted = [...transactions].sort((a, b) => a.timestamp - b.timestamp);
    const firstTx = sorted[0];
    const walletAgeHours = (Date.now() / 1000 - firstTx.timestamp) / 3600;
    
    // Find first incoming SOL transfer (funding source)
    let fundingSource: string | null = null;
    let initialFundingSol = 0;
    
    for (const tx of sorted) {
      for (const transfer of tx.nativeTransfers || []) {
        if (transfer.toUserAccount === walletAddress && transfer.amount > 0) {
          fundingSource = transfer.fromUserAccount;
          initialFundingSol = transfer.amount / 1e9; // lamports to SOL
          break;
        }
      }
      if (fundingSource) break;
    }
    
    const isCexFunded = fundingSource ? KNOWN_CEX_WALLETS.has(fundingSource) : false;
    const isFreshWallet = walletAgeHours < 24;
    
    const info: WalletFundingInfo = {
      walletAddress,
      fundingSource,
      fundingDepth2Source: null, // Will be filled by depth-2 analysis
      isFreshWallet,
      isCexFunded,
      walletAgeHours,
      initialFundingSol,
      firstTxTimestamp: firstTx.timestamp,
    };
    
    setCacheWallet(walletAddress, info);
    return info;
  } catch (err) {
    console.error(`[Helius] Wallet analysis error for ${walletAddress.slice(0, 8)}:`, err);
    const fallback: WalletFundingInfo = {
      walletAddress,
      fundingSource: null,
      fundingDepth2Source: null,
      isFreshWallet: false,
      isCexFunded: false,
      walletAgeHours: 0,
      initialFundingSol: 0,
      firstTxTimestamp: null,
    };
    return fallback;
  }
}

/**
 * Perform 2-layer wallet funding analysis
 * Traces: wallet → funder → funder's funder
 */
async function analyzeWalletDepth2(walletAddress: string): Promise<WalletFundingInfo> {
  // Depth 1
  const depth1 = await analyzeWalletFunding(walletAddress);
  
  // Depth 2: trace the funder
  if (depth1.fundingSource && !KNOWN_CEX_WALLETS.has(depth1.fundingSource)) {
    const depth2 = await analyzeWalletFunding(depth1.fundingSource);
    depth1.fundingDepth2Source = depth2.fundingSource;
  }
  
  return depth1;
}

// =============================================================================
// CLUSTER ANALYSIS
// =============================================================================

/**
 * Analyze a group of wallets for shared funding origins
 * Used to detect sybil attacks and wash trading networks
 * 
 * @param wallets - Array of wallet addresses to analyze
 * @param deployerWallet - Optional deployer wallet to include
 * @returns Cluster analysis results
 */
export async function analyzeWalletCluster(
  wallets: string[],
  deployerWallet?: string
): Promise<WalletClusterAnalysis> {
  const allWallets = deployerWallet 
    ? [deployerWallet, ...wallets.filter(w => w !== deployerWallet)]
    : wallets;
  
  // Limit to first 10 wallets + deployer for performance
  const walletsToAnalyze = allWallets.slice(0, 11);
  
  // Analyze all wallets in parallel (depth 2)
  const results = await Promise.all(
    walletsToAnalyze.map(w => analyzeWalletDepth2(w))
  );
  
  // Find shared origins at depth 2
  const originCounts = new Map<string, number>();
  
  for (const info of results) {
    // Check depth-1 funding source
    if (info.fundingSource) {
      originCounts.set(
        info.fundingSource, 
        (originCounts.get(info.fundingSource) || 0) + 1
      );
    }
    // Check depth-2 funding source
    if (info.fundingDepth2Source) {
      originCounts.set(
        info.fundingDepth2Source,
        (originCounts.get(info.fundingDepth2Source) || 0) + 1
      );
    }
  }
  
  // Find the most common origin
  let maxCount = 0;
  let sharedOriginWallet: string | null = null;
  
  originCounts.forEach((count, wallet) => {
    if (count > maxCount) {
      maxCount = count;
      sharedOriginWallet = wallet;
    }
  });
  
  const sharedOriginPercent = walletsToAnalyze.length > 0
    ? (maxCount / walletsToAnalyze.length) * 100
    : 0;
  
  // Cluster detected if >40% share same origin at depth 2
  const clusterDetected = sharedOriginPercent > 40;
  
  console.log(
    `[Helius] Cluster analysis: ${walletsToAnalyze.length} wallets, ` +
    `shared origin: ${sharedOriginPercent.toFixed(1)}%, ` +
    `cluster: ${clusterDetected}`
  );
  
  return {
    wallets: results,
    sharedOriginPercent,
    sharedOriginWallet,
    clusterDetected,
    clusterSize: maxCount,
    analysisTimestamp: Date.now(),
  };
}

/**
 * Quick deployer funding check
 */
export async function checkDeployerFunding(
  deployerWallet: string
): Promise<WalletFundingInfo> {
  return analyzeWalletDepth2(deployerWallet);
}

/**
 * Clear wallet cache (for testing)
 */
export function clearHeliusCache(): void {
  walletCache.clear();
}
