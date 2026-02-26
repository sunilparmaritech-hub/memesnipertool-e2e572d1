/**
 * 2-Layer Wallet Cluster Detection Module (Rule 19)
 * 
 * Using Helius Enhanced API:
 * - Traces funding source of deployer
 * - Traces funding source of first 10 buyers
 * - Traces funding source of LP creator
 * - If >40% share same origin wallet (depth 2) → HARD BLOCK
 * 
 * Cache: 60 seconds per wallet graph result
 */

import { analyzeWalletCluster, type WalletClusterAnalysis } from './heliusClient';

// =============================================================================
// TYPES
// =============================================================================

export interface WalletClusterInput {
  deployerWallet?: string;
  lpCreatorWallet?: string;
  buyerWallets: string[];
  isPumpFun?: boolean;
  source?: string;
}

export interface WalletClusterResult {
  passed: boolean;
  rule: string;
  reason: string;
  penalty: number;
  hardBlock: boolean;
  details: {
    sharedOriginPercent: number;
    sharedOriginWallet: string | null;
    clusterSize: number;
    walletsAnalyzed: number;
    freshWalletCount: number;
    freshWalletPercent: number;
  };
  clusterAnalysis?: WalletClusterAnalysis;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const SHARED_ORIGIN_BLOCK_THRESHOLD = 40;  // >40% = HARD BLOCK
const FRESH_WALLET_WARN_THRESHOLD = 50;    // >50% fresh wallets = warning
const FRESH_WALLET_BLOCK_THRESHOLD = 80;   // >80% fresh wallets among buyers = suspicious

// =============================================================================
// MAIN FUNCTION
// =============================================================================

/**
 * Perform 2-layer wallet cluster detection
 * 
 * @param input - Wallets to analyze
 * @returns Cluster detection result with hard block decision
 */
export async function detectWalletCluster(input: WalletClusterInput): Promise<WalletClusterResult> {
  const rule = 'WALLET_CLUSTER_2LAYER';
  
  // Skip for Pump.fun (fair launches have different patterns)
  if (input.isPumpFun || input.source === 'Pump.fun' || input.source === 'pumpfun' || input.source === 'PumpSwap') {
    return {
      passed: true,
      rule,
      reason: 'Pump.fun fair launch - 2-layer cluster check exempt',
      penalty: 0,
      hardBlock: false,
      details: {
        sharedOriginPercent: 0,
        sharedOriginWallet: null,
        clusterSize: 0,
        walletsAnalyzed: 0,
        freshWalletCount: 0,
        freshWalletPercent: 0,
      },
    };
  }
  
  // Collect all wallets to analyze
  const allWallets = [
    ...(input.lpCreatorWallet ? [input.lpCreatorWallet] : []),
    ...input.buyerWallets.slice(0, 10), // First 10 buyers
  ].filter(Boolean);
  
  if (allWallets.length < 3) {
    return {
      passed: true,
      rule,
      reason: `Only ${allWallets.length} wallets available - insufficient for cluster analysis`,
      penalty: 5,
      hardBlock: false,
      details: {
        sharedOriginPercent: 0,
        sharedOriginWallet: null,
        clusterSize: 0,
        walletsAnalyzed: allWallets.length,
        freshWalletCount: 0,
        freshWalletPercent: 0,
      },
    };
  }
  
  try {
    // Run Helius cluster analysis
    const analysis = await analyzeWalletCluster(allWallets, input.deployerWallet);
    
    // Count fresh wallets
    const freshWalletCount = analysis.wallets.filter(w => w.isFreshWallet).length;
    const freshWalletPercent = (freshWalletCount / analysis.wallets.length) * 100;
    
    // Check for HARD BLOCK: >40% share same origin
    if (analysis.clusterDetected) {
      return {
        passed: false,
        rule,
        reason: `HARD BLOCK: ${analysis.sharedOriginPercent.toFixed(0)}% of wallets share same funding origin (>${SHARED_ORIGIN_BLOCK_THRESHOLD}%)`,
        penalty: 50,
        hardBlock: true,
        details: {
          sharedOriginPercent: analysis.sharedOriginPercent,
          sharedOriginWallet: analysis.sharedOriginWallet,
          clusterSize: analysis.clusterSize,
          walletsAnalyzed: analysis.wallets.length,
          freshWalletCount,
          freshWalletPercent,
        },
        clusterAnalysis: analysis,
      };
    }
    
    // Check for fresh wallet concentration
    if (freshWalletPercent > FRESH_WALLET_BLOCK_THRESHOLD) {
      return {
        passed: false,
        rule,
        reason: `${freshWalletPercent.toFixed(0)}% of buyers are fresh wallets (<24h old) - sybil attack likely`,
        penalty: 35,
        hardBlock: false,
        details: {
          sharedOriginPercent: analysis.sharedOriginPercent,
          sharedOriginWallet: analysis.sharedOriginWallet,
          clusterSize: analysis.clusterSize,
          walletsAnalyzed: analysis.wallets.length,
          freshWalletCount,
          freshWalletPercent,
        },
        clusterAnalysis: analysis,
      };
    }
    
    // Warning for moderate fresh wallet concentration
    if (freshWalletPercent > FRESH_WALLET_WARN_THRESHOLD) {
      return {
        passed: true,
        rule,
        reason: `${freshWalletPercent.toFixed(0)}% fresh wallets among buyers - elevated risk`,
        penalty: 15,
        hardBlock: false,
        details: {
          sharedOriginPercent: analysis.sharedOriginPercent,
          sharedOriginWallet: analysis.sharedOriginWallet,
          clusterSize: analysis.clusterSize,
          walletsAnalyzed: analysis.wallets.length,
          freshWalletCount,
          freshWalletPercent,
        },
        clusterAnalysis: analysis,
      };
    }
    
    // All clear
    return {
      passed: true,
      rule,
      reason: `No funding cluster detected (${analysis.sharedOriginPercent.toFixed(0)}% shared origin, ${freshWalletCount} fresh)`,
      penalty: 0,
      hardBlock: false,
      details: {
        sharedOriginPercent: analysis.sharedOriginPercent,
        sharedOriginWallet: analysis.sharedOriginWallet,
        clusterSize: analysis.clusterSize,
        walletsAnalyzed: analysis.wallets.length,
        freshWalletCount,
        freshWalletPercent,
      },
      clusterAnalysis: analysis,
    };
    
  } catch (err) {
    console.error('[WalletCluster] Analysis error:', err);
    return {
      passed: true,
      rule,
      reason: 'Wallet cluster analysis failed - proceeding with caution',
      penalty: 10,
      hardBlock: false,
      details: {
        sharedOriginPercent: 0,
        sharedOriginWallet: null,
        clusterSize: 0,
        walletsAnalyzed: 0,
        freshWalletCount: 0,
        freshWalletPercent: 0,
      },
    };
  }
}
