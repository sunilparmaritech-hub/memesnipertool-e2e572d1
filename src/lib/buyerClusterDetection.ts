/**
 * Buyer Cluster Detection Module
 * 
 * Detects wash trading and fake buyer positioning:
 * - Buyer #1 = deployer check
 * - Cluster detection (buyers funded by same wallet)
 * - Rapid buy timing detection (bot wash trading)
 * - Minimum external buyer requirement
 */

export interface BuyerInfo {
  address: string;
  timestamp: number;       // Unix ms of buy transaction
  fundingWallet?: string;  // Wallet that funded this buyer
  amount?: number;
}

export interface ClusterDetectionInput {
  deployerWallet?: string;
  firstBuyerWallet?: string;
  buyerWallets?: string[];
  recentBuyers?: BuyerInfo[];
  uniqueBuyerCount?: number;
  isPumpFun?: boolean;
  source?: string;
}

export interface ClusterDetectionResult {
  passed: boolean;
  rule: string;
  reason: string;
  penalty: number;
  details: {
    deployerIsBuyer1: boolean;
    clusterDetected: boolean;
    washTradingDetected: boolean;
    externalBuyerCount: number;
    rapidBuyCount: number;
  };
}

/**
 * Detect if first buyer is the deployer (self-buying)
 */
function checkDeployerIsBuyer1(
  deployerWallet?: string,
  firstBuyerWallet?: string
): boolean {
  if (!deployerWallet || !firstBuyerWallet) return false;
  return deployerWallet.toLowerCase() === firstBuyerWallet.toLowerCase();
}

/**
 * Detect if buyers are funded by the same wallet (cluster)
 * Returns the number of clustered buyers
 */
function detectFundingCluster(buyers: BuyerInfo[]): {
  clustered: boolean;
  clusterSize: number;
  clusterWallet: string | null;
} {
  if (buyers.length < 2) return { clustered: false, clusterSize: 0, clusterWallet: null };
  
  // Group buyers by funding wallet
  const fundingGroups = new Map<string, string[]>();
  
  for (const buyer of buyers) {
    if (buyer.fundingWallet) {
      const funder = buyer.fundingWallet.toLowerCase();
      const existing = fundingGroups.get(funder) || [];
      existing.push(buyer.address);
      fundingGroups.set(funder, existing);
    }
  }
  
  // Find largest cluster
  let maxClusterSize = 0;
  let maxClusterWallet: string | null = null;
  
  fundingGroups.forEach((addresses, funder) => {
    if (addresses.length > maxClusterSize) {
      maxClusterSize = addresses.length;
      maxClusterWallet = funder;
    }
  });
  
  // Cluster detected if 2+ buyers funded by same wallet
  return {
    clustered: maxClusterSize >= 2,
    clusterSize: maxClusterSize,
    clusterWallet: maxClusterWallet,
  };
}

/**
 * Detect rapid sequential buys (bot wash trading)
 * If first 2-3 buyers occur within <1 second, likely automated wash
 */
function detectRapidBuys(buyers: BuyerInfo[]): {
  washDetected: boolean;
  rapidBuyCount: number;
} {
  if (buyers.length < 2) return { washDetected: false, rapidBuyCount: 0 };
  
  // Sort by timestamp
  const sorted = [...buyers].sort((a, b) => a.timestamp - b.timestamp);
  
  // Check first 3 buyers for rapid timing
  const RAPID_THRESHOLD_MS = 1000; // 1 second
  let rapidCount = 0;
  
  for (let i = 1; i < Math.min(sorted.length, 4); i++) {
    const timeDiff = sorted[i].timestamp - sorted[i - 1].timestamp;
    if (timeDiff < RAPID_THRESHOLD_MS) {
      rapidCount++;
    }
  }
  
  // Wash trading if 2+ rapid sequential buys in first 3
  return {
    washDetected: rapidCount >= 2,
    rapidBuyCount: rapidCount,
  };
}

/**
 * Count external (non-deployer, non-clustered) unique buyers
 */
function countExternalBuyers(
  buyers: string[],
  deployerWallet?: string,
  clusteredWallets?: Set<string>
): number {
  const deployerLower = deployerWallet?.toLowerCase();
  const unique = new Set<string>();
  
  for (const buyer of buyers) {
    const lower = buyer.toLowerCase();
    // Skip deployer
    if (deployerLower && lower === deployerLower) continue;
    // Skip clustered wallets
    if (clusteredWallets?.has(lower)) continue;
    unique.add(lower);
  }
  
  return unique.size;
}

/**
 * Full cluster detection analysis
 * 
 * Checks:
 * 1. Buyer #1 ≠ deployer
 * 2. ≥ 2 unique external buyers
 * 3. No funding cluster (buyers funded by same wallet)
 * 4. No rapid wash buying (first 2-3 buys within <1s)
 * 5. Allow entry at buyer #2, #3, #4 (or #5 if delayed safely)
 */
export function detectBuyerClusters(input: ClusterDetectionInput): ClusterDetectionResult {
  const rule = 'BUYER_CLUSTER';
  
  // Pump.fun fair launches are exempt from strict cluster checks
  if (input.isPumpFun || input.source === 'Pump.fun' || input.source === 'pumpfun' || input.source === 'PumpSwap') {
    return {
      passed: true,
      rule,
      reason: 'Pump.fun fair launch - cluster check exempt',
      penalty: 0,
      details: {
        deployerIsBuyer1: false,
        clusterDetected: false,
        washTradingDetected: false,
        externalBuyerCount: input.uniqueBuyerCount || 0,
        rapidBuyCount: 0,
      },
    };
  }
  
  // 1. Check if deployer is buyer #1
  const deployerIsBuyer1 = checkDeployerIsBuyer1(input.deployerWallet, input.firstBuyerWallet);
  if (deployerIsBuyer1) {
    return {
      passed: false,
      rule,
      reason: 'Buyer #1 is the deployer (self-buying) - high rug risk',
      penalty: 30,
      details: {
        deployerIsBuyer1: true,
        clusterDetected: false,
        washTradingDetected: false,
        externalBuyerCount: 0,
        rapidBuyCount: 0,
      },
    };
  }
  
  // 2. Check for funding clusters
  let clusterDetected = false;
  let clusterSize = 0;
  
  if (input.recentBuyers && input.recentBuyers.length >= 2) {
    const clusterResult = detectFundingCluster(input.recentBuyers);
    clusterDetected = clusterResult.clustered;
    clusterSize = clusterResult.clusterSize;
    
    if (clusterDetected) {
      return {
        passed: false,
        rule,
        reason: `${clusterSize} buyers funded by same wallet - wash trading detected`,
        penalty: 25,
        details: {
          deployerIsBuyer1: false,
          clusterDetected: true,
          washTradingDetected: false,
          externalBuyerCount: 0,
          rapidBuyCount: clusterSize,
        },
      };
    }
  }
  
  // 3. Check for rapid wash buying
  if (input.recentBuyers && input.recentBuyers.length >= 2) {
    const rapidResult = detectRapidBuys(input.recentBuyers);
    if (rapidResult.washDetected) {
      return {
        passed: false,
        rule,
        reason: `First ${rapidResult.rapidBuyCount + 1} buys within <1 second - bot wash trading`,
        penalty: 20,
        details: {
          deployerIsBuyer1: false,
          clusterDetected: false,
          washTradingDetected: true,
          externalBuyerCount: 0,
          rapidBuyCount: rapidResult.rapidBuyCount,
        },
      };
    }
  }
  
  // 4. Require ≥ 2 unique external buyers
  const externalCount = input.buyerWallets 
    ? countExternalBuyers(input.buyerWallets, input.deployerWallet)
    : (input.uniqueBuyerCount || 0);
  
  // CRITICAL FIX: If we have NO buyer data at all, pass with penalty instead of blocking
  // Missing data ≠ cluster detected. Block only when we have data proving < 2 buyers.
  const hasAnyBuyerData = (input.buyerWallets && input.buyerWallets.length > 0) || 
                           (input.uniqueBuyerCount !== undefined && input.uniqueBuyerCount > 0);
  
  if (externalCount < 2 && hasAnyBuyerData) {
    return {
      passed: false,
      rule,
      reason: `Only ${externalCount} external buyer(s) - need ≥ 2 unique external buyers`,
      penalty: 15,
      details: {
        deployerIsBuyer1: false,
        clusterDetected: false,
        washTradingDetected: false,
        externalBuyerCount: externalCount,
        rapidBuyCount: 0,
      },
    };
  }
  
  if (externalCount < 2 && !hasAnyBuyerData) {
    return {
      passed: true,
      rule,
      reason: 'Buyer data unavailable - proceeding with caution',
      penalty: 10,
      details: {
        deployerIsBuyer1: false,
        clusterDetected: false,
        washTradingDetected: false,
        externalBuyerCount: 0,
        rapidBuyCount: 0,
      },
    };
  }
  
  // All checks passed
  return {
    passed: true,
    rule,
    reason: `${externalCount} external buyers verified, no clusters detected`,
    penalty: 0,
    details: {
      deployerIsBuyer1: false,
      clusterDetected: false,
      washTradingDetected: false,
      externalBuyerCount: externalCount,
      rapidBuyCount: 0,
    },
  };
}
