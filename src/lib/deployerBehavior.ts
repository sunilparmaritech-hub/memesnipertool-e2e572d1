/**
 * Deployer Behavior Profile Module (Rule 22)
 * 
 * Enhanced deployer analysis beyond basic reputation:
 * - Track tokens created (last 7 days)
 * - Liquidity lifespan average
 * - Rug ratio
 * - Cluster association score
 * 
 * Block conditions:
 * - ≥ 3 tokens deployed in 24 hours (rapid deployer)
 * - Prior token liquidity removed < 5 minutes
 * - Historical rug probability high
 */

import { supabase } from '@/integrations/supabase/client';

// =============================================================================
// TYPES
// =============================================================================

export interface DeployerBehaviorInput {
  deployerWallet?: string;
  isPumpFun?: boolean;
  source?: string;
}

export interface DeployerBehaviorResult {
  passed: boolean;
  rule: string;
  reason: string;
  penalty: number;
  hardBlock: boolean;
  details: {
    tokensLast7d: number;
    tokensLast24h: number;
    avgLpLifespanSeconds: number | null;
    rugRatio: number | null;
    clusterAssociationScore: number;
    rapidDeployFlag: boolean;
    fastLpPullFlag: boolean;
  };
}

// =============================================================================
// CONSTANTS
// =============================================================================

const RAPID_DEPLOY_THRESHOLD_24H = 3;       // ≥ 3 tokens in 24h = suspicious
const FAST_LP_PULL_SECONDS = 300;           // < 5 minutes = suspicious
const HIGH_RUG_RATIO = 0.5;                // > 50% rug ratio = block
const CLUSTER_SCORE_BLOCK = 60;             // High cluster association
const PENALTY_RAPID_DEPLOY = 30;
const PENALTY_FAST_LP_PULL = 35;
const PENALTY_HIGH_RUG = 40;
const PENALTY_CLUSTER = 25;

// =============================================================================
// MAIN FUNCTION
// =============================================================================

/**
 * Analyze deployer behavior profile
 */
export async function analyzeDeployerBehavior(input: DeployerBehaviorInput): Promise<DeployerBehaviorResult> {
  const rule = 'DEPLOYER_BEHAVIOR';
  
  if (!input.deployerWallet) {
    return {
      passed: true,
      rule,
      reason: 'Deployer wallet unknown - proceeding with caution',
      penalty: 10,
      hardBlock: false,
      details: {
        tokensLast7d: 0,
        tokensLast24h: 0,
        avgLpLifespanSeconds: null,
        rugRatio: null,
        clusterAssociationScore: 0,
        rapidDeployFlag: false,
        fastLpPullFlag: false,
      },
    };
  }
  
  // Skip for Pump.fun fair launches
  if (input.isPumpFun || input.source === 'Pump.fun' || input.source === 'pumpfun' || input.source === 'PumpSwap') {
    return {
      passed: true,
      rule,
      reason: 'Pump.fun fair launch - deployer behavior check relaxed',
      penalty: 0,
      hardBlock: false,
      details: {
        tokensLast7d: 0,
        tokensLast24h: 0,
        avgLpLifespanSeconds: null,
        rugRatio: null,
        clusterAssociationScore: 0,
        rapidDeployFlag: false,
        fastLpPullFlag: false,
      },
    };
  }
  
  try {
    // Fetch deployer reputation data with new behavioral columns
    const { data, error } = await supabase
      .from('deployer_reputation')
      .select('*')
      .eq('wallet_address', input.deployerWallet)
      .maybeSingle();
    
    if (error || !data) {
      return {
        passed: true,
        rule,
        reason: `New deployer (no history) - ${input.deployerWallet.slice(0, 8)}...`,
        penalty: 5,
        hardBlock: false,
        details: {
          tokensLast7d: 0,
          tokensLast24h: 0,
          avgLpLifespanSeconds: null,
          rugRatio: null,
          clusterAssociationScore: 0,
          rapidDeployFlag: false,
          fastLpPullFlag: false,
        },
      };
    }
    
    // Extract behavioral data (columns now exist in deployer_reputation)
    const tokensLast7d = data.tokens_last_7d || data.total_tokens_created || 0;
    const avgLpLifespan = data.avg_lp_lifespan_seconds || data.avg_liquidity_survival_seconds;
    const rugRatio = data.rug_ratio;
    const clusterScore = data.cluster_association_score || 0;
    const rapidDeploy = data.rapid_deploy_flag || false;
    
    // Estimate 24h tokens
    const lastDeployedAt = data.last_token_deployed_at;
    const tokensLast24h = lastDeployedAt && rapidDeploy ? tokensLast7d : 0;
    
    // Check block conditions
    const reasons: string[] = [];
    let totalPenalty = 0;
    let hardBlock = false;
    
    // Condition 1: Rapid deployment (≥3 tokens in 24h)
    const rapidDeployFlag = tokensLast24h >= RAPID_DEPLOY_THRESHOLD_24H || rapidDeploy;
    if (rapidDeployFlag) {
      reasons.push(`${tokensLast24h || '3+'} tokens in 24h (rapid deployer)`);
      totalPenalty += PENALTY_RAPID_DEPLOY;
      hardBlock = true;
    }
    
    // Condition 2: Fast LP pull (< 5 minutes average)
    const fastLpPullFlag = avgLpLifespan !== null && avgLpLifespan !== undefined && avgLpLifespan < FAST_LP_PULL_SECONDS;
    if (fastLpPullFlag) {
      reasons.push(`LP pulled in ${avgLpLifespan}s avg (<${FAST_LP_PULL_SECONDS}s)`);
      totalPenalty += PENALTY_FAST_LP_PULL;
      hardBlock = true;
    }
    
    // Condition 3: High rug ratio
    if (rugRatio !== null && rugRatio !== undefined && rugRatio > HIGH_RUG_RATIO) {
      reasons.push(`${(rugRatio * 100).toFixed(0)}% rug ratio`);
      totalPenalty += PENALTY_HIGH_RUG;
      hardBlock = true;
    }
    
    // Condition 4: High cluster association
    if (clusterScore > CLUSTER_SCORE_BLOCK) {
      reasons.push(`Cluster association score ${clusterScore}`);
      totalPenalty += PENALTY_CLUSTER;
    }
    
    if (reasons.length > 0) {
      return {
        passed: !hardBlock,
        rule,
        reason: hardBlock 
          ? `DEPLOYER BLOCKED: ${reasons.join(', ')}`
          : `Deployer warnings: ${reasons.join(', ')}`,
        penalty: totalPenalty,
        hardBlock,
        details: {
          tokensLast7d,
          tokensLast24h,
          avgLpLifespanSeconds: avgLpLifespan,
          rugRatio,
          clusterAssociationScore: clusterScore,
          rapidDeployFlag,
          fastLpPullFlag,
        },
      };
    }
    
    return {
      passed: true,
      rule,
      reason: `Deployer behavior OK (${tokensLast7d} tokens/7d, score ${data.reputation_score})`,
      penalty: 0,
      hardBlock: false,
      details: {
        tokensLast7d,
        tokensLast24h,
        avgLpLifespanSeconds: avgLpLifespan,
        rugRatio,
        clusterAssociationScore: clusterScore,
        rapidDeployFlag: false,
        fastLpPullFlag: false,
      },
    };
  } catch (err) {
    console.error('[DeployerBehavior] Error:', err);
    return {
      passed: true,
      rule,
      reason: 'Deployer behavior check failed - proceeding with caution',
      penalty: 10,
      hardBlock: false,
      details: {
        tokensLast7d: 0,
        tokensLast24h: 0,
        avgLpLifespanSeconds: null,
        rugRatio: null,
        clusterAssociationScore: 0,
        rapidDeployFlag: false,
        fastLpPullFlag: false,
      },
    };
  }
}
