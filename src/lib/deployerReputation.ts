/**
 * Deployer Reputation Module
 * 
 * Tracks token creator (deployer) history to identify rug pull risks.
 * Integrates with pre-execution gate to block trades from known bad actors.
 * 
 * Scoring Logic:
 * - Base score: 100
 * - rug_ratio > 0.5 → -50
 * - avg_liquidity_survival < 300 sec → -30
 * - total_rugs >= 3 → -40
 * - cluster_id linked to known rugs → -60
 * 
 * Block threshold: reputation_score < 70
 */

import { supabase } from '@/integrations/supabase/client';

// =============================================================================
// TYPES
// =============================================================================

export interface DeployerReputationData {
  wallet_address: string;
  total_tokens_created: number;
  total_rugs: number;
  avg_liquidity_survival_seconds: number | null;
  rug_ratio: number | null;
  cluster_id: string | null;
  reputation_score: number;
  last_updated: string;
  created_at: string;
  // Enhanced behavioral fields
  tokens_last_7d?: number | null;
  avg_lp_lifespan_seconds?: number | null;
  cluster_association_score?: number | null;
  rapid_deploy_flag?: boolean | null;
  last_token_deployed_at?: string | null;
}

export interface DeployerCheckResult {
  passed: boolean;
  rule: string;
  reason: string;
  penalty?: number;
  reputationScore: number;
  reputationData?: DeployerReputationData;
  isNewDeployer: boolean;
}

// Penalty constants - UPGRADED with behavioral penalties
const PENALTIES = {
  HIGH_RUG_RATIO: 50,        // rug_ratio > 0.5
  FAST_LIQUIDITY_PULL: 30,   // avg_liquidity_survival < 300 sec
  MULTIPLE_RUGS: 40,         // total_rugs >= 3
  BAD_CLUSTER: 60,           // cluster_id linked to known rugs
  RAPID_DEPLOYER: 25,        // 3+ tokens in 24h
  HIGH_CLUSTER_SCORE: 20,    // cluster_association_score > 60
  FAST_LP_LIFESPAN: 15,      // avg_lp_lifespan < 300s (behavioral)
} as const;

// Thresholds - UPGRADED
const THRESHOLDS = {
  MIN_REPUTATION_SCORE: 70,
  HIGH_RUG_RATIO: 0.5,
  MIN_LIQUIDITY_SURVIVAL_SECONDS: 300,
  MULTIPLE_RUGS_COUNT: 3,
  RAPID_DEPLOY_TOKENS_24H: 3,
  CLUSTER_SCORE_WARN: 40,
  CLUSTER_SCORE_BLOCK: 60,
} as const;

// Known rug cluster IDs (can be updated via admin)
const KNOWN_RUG_CLUSTERS = new Set<string>([
  // Add known cluster IDs here
  // These are deployer wallets that work together
]);

// =============================================================================
// CORE FUNCTIONS
// =============================================================================

/**
 * Calculate reputation score based on deployer history
 * Starts at 100 and subtracts penalties
 */
export function calculateReputationScore(data: Partial<DeployerReputationData>): number {
  let score = 100;
  
  // Penalty 1: High rug ratio (> 50%)
  if (data.rug_ratio !== null && data.rug_ratio !== undefined) {
    if (data.rug_ratio > THRESHOLDS.HIGH_RUG_RATIO) {
      score -= PENALTIES.HIGH_RUG_RATIO;
      console.log(`[DeployerReputation] -${PENALTIES.HIGH_RUG_RATIO} for high rug ratio: ${(data.rug_ratio * 100).toFixed(1)}%`);
    }
  }
  
  // Penalty 2: Fast liquidity pull (< 300 seconds average)
  if (data.avg_liquidity_survival_seconds !== null && data.avg_liquidity_survival_seconds !== undefined) {
    if (data.avg_liquidity_survival_seconds < THRESHOLDS.MIN_LIQUIDITY_SURVIVAL_SECONDS) {
      score -= PENALTIES.FAST_LIQUIDITY_PULL;
      console.log(`[DeployerReputation] -${PENALTIES.FAST_LIQUIDITY_PULL} for fast LP pull: ${data.avg_liquidity_survival_seconds}s avg`);
    }
  }
  
  // Penalty 3: Multiple rugs (>= 3)
  if (data.total_rugs !== undefined && data.total_rugs >= THRESHOLDS.MULTIPLE_RUGS_COUNT) {
    score -= PENALTIES.MULTIPLE_RUGS;
    console.log(`[DeployerReputation] -${PENALTIES.MULTIPLE_RUGS} for multiple rugs: ${data.total_rugs}`);
  }
  
  // Penalty 4: Part of known rug cluster
  if (data.cluster_id && KNOWN_RUG_CLUSTERS.has(data.cluster_id)) {
    score -= PENALTIES.BAD_CLUSTER;
    console.log(`[DeployerReputation] -${PENALTIES.BAD_CLUSTER} for rug cluster: ${data.cluster_id}`);
  }
  
  // UPGRADED Penalty 5: Rapid deployer (3+ tokens in 24h)
  if (data.rapid_deploy_flag === true) {
    score -= PENALTIES.RAPID_DEPLOYER;
    console.log(`[DeployerReputation] -${PENALTIES.RAPID_DEPLOYER} for rapid deployment pattern`);
  }
  
  // UPGRADED Penalty 6: High cluster association score
  if (data.cluster_association_score !== null && data.cluster_association_score !== undefined) {
    if (data.cluster_association_score > THRESHOLDS.CLUSTER_SCORE_BLOCK) {
      score -= PENALTIES.HIGH_CLUSTER_SCORE;
      console.log(`[DeployerReputation] -${PENALTIES.HIGH_CLUSTER_SCORE} for cluster association: ${data.cluster_association_score}`);
    }
  }
  
  // UPGRADED Penalty 7: Fast LP lifespan from behavioral data
  if (data.avg_lp_lifespan_seconds !== null && data.avg_lp_lifespan_seconds !== undefined) {
    if (data.avg_lp_lifespan_seconds < THRESHOLDS.MIN_LIQUIDITY_SURVIVAL_SECONDS) {
      score -= PENALTIES.FAST_LP_LIFESPAN;
      console.log(`[DeployerReputation] -${PENALTIES.FAST_LP_LIFESPAN} for fast LP lifespan: ${data.avg_lp_lifespan_seconds}s`);
    }
  }
  
  // Ensure score stays in valid range
  return Math.max(0, Math.min(100, score));
}

/**
 * Fetch deployer reputation from database
 */
export async function getDeployerReputation(
  deployerWallet: string
): Promise<DeployerReputationData | null> {
  try {
    const { data, error } = await supabase
      .from('deployer_reputation')
      .select('*')
      .eq('wallet_address', deployerWallet)
      .maybeSingle();
    
    if (error) {
      console.error('[DeployerReputation] Fetch error:', error);
      return null;
    }
    
    return data;
  } catch (err) {
    console.error('[DeployerReputation] Unexpected error:', err);
    return null;
  }
}

/**
 * Check deployer reputation for pre-execution gate
 * Returns a GateRuleResult-compatible object
 */
export async function checkDeployerReputation(
  deployerWallet?: string
): Promise<DeployerCheckResult> {
  const rule = 'DEPLOYER_REPUTATION';
  
  // If no deployer wallet provided, proceed with caution
  if (!deployerWallet) {
    return {
      passed: true,
      rule,
      reason: 'Deployer wallet unknown - proceeding with caution',
      reputationScore: 100,
      isNewDeployer: true,
    };
  }
  
  // Fetch reputation data (now includes behavioral columns)
  const reputationData = await getDeployerReputation(deployerWallet);
  
  // New deployer (no history) - allow but note it
  if (!reputationData) {
    return {
      passed: true,
      rule,
      reason: `New deployer (no history) - ${deployerWallet.slice(0, 8)}...`,
      reputationScore: 100,
      isNewDeployer: true,
    };
  }
  
  // UPGRADED: Calculate unified score from both reputation + behavioral data
  const calculatedScore = calculateReputationScore(reputationData);
  
  // Use the lower of stored vs calculated (most conservative)
  const finalScore = Math.min(reputationData.reputation_score ?? 100, calculatedScore);
  
  // BLOCK if reputation too low
  if (finalScore < THRESHOLDS.MIN_REPUTATION_SCORE) {
    // Build detailed reason with behavioral data
    const reasons: string[] = [];
    
    if (reputationData.rug_ratio && reputationData.rug_ratio > THRESHOLDS.HIGH_RUG_RATIO) {
      reasons.push(`${(reputationData.rug_ratio * 100).toFixed(0)}% rug rate`);
    }
    if (reputationData.total_rugs >= THRESHOLDS.MULTIPLE_RUGS_COUNT) {
      reasons.push(`${reputationData.total_rugs} rugs`);
    }
    if (reputationData.avg_liquidity_survival_seconds && 
        reputationData.avg_liquidity_survival_seconds < THRESHOLDS.MIN_LIQUIDITY_SURVIVAL_SECONDS) {
      reasons.push(`LP pulled in ${reputationData.avg_liquidity_survival_seconds}s avg`);
    }
    if (reputationData.rapid_deploy_flag) {
      reasons.push('rapid deployer');
    }
    if (reputationData.cluster_association_score && 
        reputationData.cluster_association_score > THRESHOLDS.CLUSTER_SCORE_BLOCK) {
      reasons.push(`cluster score ${reputationData.cluster_association_score}`);
    }
    if (reputationData.cluster_id && KNOWN_RUG_CLUSTERS.has(reputationData.cluster_id)) {
      reasons.push('in rug cluster');
    }
    
    const detailReason = reasons.length > 0 ? ` (${reasons.join(', ')})` : '';
    
    return {
      passed: false,
      rule,
      reason: `BLOCKED: Deployer unified score ${finalScore}/100${detailReason}`,
      penalty: 100 - finalScore,
      reputationScore: finalScore,
      reputationData,
      isNewDeployer: false,
    };
  }
  
  // Passed but may have warnings
  const warnings: string[] = [];
  
  if (reputationData.total_rugs > 0 && reputationData.total_rugs < THRESHOLDS.MULTIPLE_RUGS_COUNT) {
    warnings.push(`${reputationData.total_rugs} prior rug(s)`);
  }
  
  if (reputationData.total_tokens_created > 10) {
    warnings.push(`${reputationData.total_tokens_created} tokens created`);
  }
  
  if (reputationData.tokens_last_7d && reputationData.tokens_last_7d > 5) {
    warnings.push(`${reputationData.tokens_last_7d} tokens in 7d`);
  }
  
  if (reputationData.rapid_deploy_flag) {
    warnings.push('rapid deploy pattern');
  }
  
  const warningText = warnings.length > 0 ? ` - ${warnings.join(', ')}` : '';
  
  return {
    passed: true,
    rule,
    reason: `Deployer unified score ${finalScore}/100${warningText}`,
    penalty: finalScore < 85 ? 20 : (finalScore < 90 ? 10 : 0),
    reputationScore: finalScore,
    reputationData,
    isNewDeployer: false,
  };
}

// =============================================================================
// UPDATE FUNCTIONS (Called after position close)
// =============================================================================

/**
 * Record a new token deployment
 */
export async function recordTokenDeployment(
  deployerWallet: string,
  tokenAddress: string,
  _tokenSymbol?: string
): Promise<void> {
  try {
    // Check if deployer exists
    const existing = await getDeployerReputation(deployerWallet);
    
    if (existing) {
      // Update existing record
      const newTotal = existing.total_tokens_created + 1;
      const newScore = calculateReputationScore({
        ...existing,
        total_tokens_created: newTotal,
      });
      
      await supabase
        .from('deployer_reputation')
        .update({
          total_tokens_created: newTotal,
          reputation_score: newScore,
          last_updated: new Date().toISOString(),
        })
        .eq('wallet_address', deployerWallet);
        
      console.log(`[DeployerReputation] Updated ${deployerWallet.slice(0, 8)}... tokens: ${newTotal}`);
    } else {
      // Create new record
      await supabase
        .from('deployer_reputation')
        .insert({
          wallet_address: deployerWallet,
          total_tokens_created: 1,
          total_rugs: 0,
          reputation_score: 100,
        });
        
      console.log(`[DeployerReputation] Created new entry for ${deployerWallet.slice(0, 8)}...`);
    }
  } catch (err) {
    console.error('[DeployerReputation] Record deployment error:', err);
  }
}

/**
 * Record a rug pull event
 * Called when a position exits due to rug (liquidity removed, honeypot, etc.)
 */
export async function recordRugPull(
  deployerWallet: string,
  liquiditySurvivalSeconds: number,
  tokenAddress: string
): Promise<void> {
  try {
    const existing = await getDeployerReputation(deployerWallet);
    
    if (existing) {
      const newRugs = existing.total_rugs + 1;
      const newRatio = existing.total_tokens_created > 0 
        ? newRugs / existing.total_tokens_created 
        : 1;
      
      // Calculate new average survival time
      const oldAvg = existing.avg_liquidity_survival_seconds || 0;
      const oldCount = existing.total_rugs || 0;
      const newAvg = oldCount > 0
        ? Math.round((oldAvg * oldCount + liquiditySurvivalSeconds) / (oldCount + 1))
        : liquiditySurvivalSeconds;
      
      const newScore = calculateReputationScore({
        ...existing,
        total_rugs: newRugs,
        rug_ratio: newRatio,
        avg_liquidity_survival_seconds: newAvg,
      });
      
      await supabase
        .from('deployer_reputation')
        .update({
          total_rugs: newRugs,
          rug_ratio: newRatio,
          avg_liquidity_survival_seconds: newAvg,
          reputation_score: newScore,
          last_updated: new Date().toISOString(),
        })
        .eq('wallet_address', deployerWallet);
        
      console.log(`[DeployerReputation] Recorded rug for ${deployerWallet.slice(0, 8)}...: rugs=${newRugs}, ratio=${(newRatio * 100).toFixed(1)}%, score=${newScore}`);
    } else {
      // New deployer with first token being a rug
      await supabase
        .from('deployer_reputation')
        .insert({
          wallet_address: deployerWallet,
          total_tokens_created: 1,
          total_rugs: 1,
          rug_ratio: 1.0,
          avg_liquidity_survival_seconds: liquiditySurvivalSeconds,
          reputation_score: 10, // Very low for first-time rugger
        });
        
      console.log(`[DeployerReputation] Created rugger entry for ${deployerWallet.slice(0, 8)}...`);
    }
  } catch (err) {
    console.error('[DeployerReputation] Record rug error:', err);
  }
}

/**
 * Record a successful token (no rug)
 * Called when a position exits profitably or at stop-loss (but not due to rug)
 */
export async function recordSuccessfulToken(
  deployerWallet: string,
  tokenAddress: string
): Promise<void> {
  try {
    const existing = await getDeployerReputation(deployerWallet);
    
    if (existing) {
      // Recalculate rug ratio (same rugs, but could improve score)
      // This is already accurate from total_rugs / total_tokens_created
      // Just update timestamp
      await supabase
        .from('deployer_reputation')
        .update({
          last_updated: new Date().toISOString(),
        })
        .eq('wallet_address', deployerWallet);
        
      console.log(`[DeployerReputation] Successful exit noted for ${deployerWallet.slice(0, 8)}...`);
    }
    // If no existing record, we don't create one for successful exits
    // (deployer tracking is mainly for rug detection)
  } catch (err) {
    console.error('[DeployerReputation] Record success error:', err);
  }
}

/**
 * Update deployer reputation after position close
 * Determines if exit was a rug or normal and updates accordingly
 */
export async function updateDeployerReputationOnClose(
  deployerWallet: string | undefined,
  tokenAddress: string,
  exitReason: string,
  positionDurationSeconds: number
): Promise<void> {
  if (!deployerWallet) {
    console.log('[DeployerReputation] No deployer wallet for position - skipping update');
    return;
  }
  
  // Determine if this was a rug pull based on exit reason
  const rugIndicators = [
    'rug',
    'honeypot',
    'liquidity_removed',
    'lp_removed',
    'lp_pulled',
    'scam',
    'freeze',
    'frozen',
    'blacklisted',
    'no_route',
    'unsellable',
  ];
  
  const exitReasonLower = exitReason.toLowerCase();
  const isRug = rugIndicators.some(indicator => exitReasonLower.includes(indicator));
  
  if (isRug) {
    await recordRugPull(deployerWallet, positionDurationSeconds, tokenAddress);
  } else {
    await recordSuccessfulToken(deployerWallet, tokenAddress);
  }
}

// =============================================================================
// CLUSTER MANAGEMENT
// =============================================================================

/**
 * Add wallet to rug cluster (admin function)
 */
export async function addWalletToCluster(
  walletAddress: string,
  clusterId: string
): Promise<void> {
  try {
    // Add to known clusters set
    KNOWN_RUG_CLUSTERS.add(clusterId);
    
    // Update database
    await supabase
      .from('deployer_reputation')
      .upsert({
        wallet_address: walletAddress,
        cluster_id: clusterId,
        reputation_score: 10, // Low score for cluster members
        last_updated: new Date().toISOString(),
      }, {
        onConflict: 'wallet_address',
      });
      
    console.log(`[DeployerReputation] Added ${walletAddress.slice(0, 8)}... to cluster ${clusterId}`);
  } catch (err) {
    console.error('[DeployerReputation] Add to cluster error:', err);
  }
}

/**
 * Load known rug clusters from database
 * Call this on app initialization
 */
export async function loadKnownClusters(): Promise<void> {
  try {
    const { data, error } = await supabase
      .from('deployer_reputation')
      .select('cluster_id')
      .not('cluster_id', 'is', null)
      .lt('reputation_score', 30); // Only load clusters with very low scores
    
    if (error) {
      console.error('[DeployerReputation] Load clusters error:', error);
      return;
    }
    
    if (data) {
      data.forEach(row => {
        if (row.cluster_id) {
          KNOWN_RUG_CLUSTERS.add(row.cluster_id);
        }
      });
      
      console.log(`[DeployerReputation] Loaded ${KNOWN_RUG_CLUSTERS.size} rug clusters`);
    }
  } catch (err) {
    console.error('[DeployerReputation] Load clusters unexpected error:', err);
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

export { THRESHOLDS, PENALTIES };
