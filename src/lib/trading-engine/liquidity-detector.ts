/**
 * Stage 1: Liquidity Detection (REFACTORED)
 * 
 * IMPORTANT: This module now uses STRICT Raydium-only detection.
 * Pump.fun bonding curve tokens are EXCLUDED - only graduated Raydium pools are considered.
 * 
 * A token is TRADABLE only if ALL conditions pass:
 * 1. Raydium AMM pool exists
 * 2. Base mint is SOL or USDC
 * 3. Both vault balances > 0
 * 4. Liquidity >= minLiquidity
 * 5. Swap simulation succeeds
 * 6. NOT on Pump.fun bonding curve
 */

import { supabase } from '@/integrations/supabase/client';
import type {
  TradingConfig,
  LiquidityInfo,
  LiquidityDetectionResult,
  RiskAssessment,
  TradingEventCallback,
} from './types';
import { API_ENDPOINTS, SOL_MINT, USDC_MINT } from './config';
import { detectTradablePool, type TradablePoolResult, type PoolValidationConfig } from './raydium-pool-detector';

// Valid base mints for tradable pools
const VALID_BASE_MINTS = [SOL_MINT, USDC_MINT];

/**
 * Detect liquidity for a token address
 * NOW USES STRICT RAYDIUM-ONLY DETECTION
 */
export async function detectLiquidity(
  tokenAddress: string,
  config: TradingConfig,
  onEvent?: TradingEventCallback
): Promise<LiquidityDetectionResult> {
  const startTime = Date.now();
  
  try {
    // Convert TradingConfig to PoolValidationConfig
    const poolConfig: PoolValidationConfig = {
      minLiquidity: config.minLiquidity,
      rpcUrl: '', // Will use default endpoints
    };
    
    // Use strict Raydium pool detection
    const poolResult = await detectTradablePool(tokenAddress, poolConfig);
    
    if (poolResult.status === 'DISCARDED') {
      return {
        status: 'LP_NOT_FOUND',
        liquidityInfo: null,
        riskAssessment: null,
        error: poolResult.reason || 'Pool not tradable',
        detectedAt: startTime,
      };
    }
    
    // Pool is TRADABLE - convert to LiquidityInfo
    const liquidityInfo: LiquidityInfo = {
      tokenAddress,
      tokenName: poolResult.tokenName || 'Unknown',
      tokenSymbol: poolResult.tokenSymbol || 'UNKNOWN',
      poolAddress: poolResult.poolAddress || '',
      poolType: 'raydium', // Now always Raydium
      baseMint: poolResult.baseMint || SOL_MINT,
      quoteMint: poolResult.quoteMint || tokenAddress,
      liquidityAmount: poolResult.liquidity || 0,
      lpTokenMint: poolResult.lpTokenMint || null,
      timestamp: poolResult.detectedAt || Date.now(),
      blockHeight: 0,
    };
    
    onEvent?.({ type: 'LIQUIDITY_DETECTED', data: liquidityInfo });
    
    // Verify liquidity meets minimum
    if (liquidityInfo.liquidityAmount < config.minLiquidity) {
      return {
        status: 'LP_INSUFFICIENT',
        liquidityInfo,
        riskAssessment: null,
        error: `Liquidity ${liquidityInfo.liquidityAmount.toFixed(2)} SOL below minimum ${config.minLiquidity} SOL`,
        detectedAt: startTime,
      };
    }
    
    // Run risk assessment
    const riskAssessment = await assessRisk(tokenAddress, config);
    
    if (!riskAssessment.passed) {
      onEvent?.({ type: 'RISK_CHECK_FAILED', data: riskAssessment });
      return {
        status: 'RISK_FAILED',
        liquidityInfo,
        riskAssessment,
        error: `Risk check failed: ${riskAssessment.reasons.join(', ')}`,
        detectedAt: startTime,
      };
    }
    
    onEvent?.({ type: 'RISK_CHECK_PASSED', data: riskAssessment });
    
    return {
      status: 'LP_READY',
      liquidityInfo,
      riskAssessment,
      detectedAt: startTime,
    };
    
  } catch (error) {
    return {
      status: 'ERROR',
      liquidityInfo: null,
      riskAssessment: null,
      error: error instanceof Error ? error.message : 'Unknown error during liquidity detection',
      detectedAt: startTime,
    };
  }
}

/**
 * REMOVED: checkPumpFunLiquidity
 * Pump.fun bonding curve tokens are NO LONGER considered tradable.
 * Only tokens that have graduated to Raydium are accepted.
 */

/**
 * REMOVED: checkRaydiumLiquidity (replaced by detectTradablePool)
 * The new detectTradablePool function provides stricter validation.
 */

/**
 * REMOVED: checkDexScreenerLiquidity
 * DexScreener discovery is too broad - we only accept verified Raydium pools.
 */

/**
 * Assess token risk using RugCheck and other validators
 */
async function assessRisk(
  tokenAddress: string,
  config: TradingConfig
): Promise<RiskAssessment> {
  const reasons: string[] = [];
  let overallScore = 0;
  let isRugPull = false;
  let isHoneypot = false;
  let hasMintAuthority = false;
  let hasFreezeAuthority = false;
  let holderCount = 0;
  let topHolderPercent = 0;
  
  try {
    // Check RugCheck API
    const response = await fetch(`${API_ENDPOINTS.rugCheck}/${tokenAddress}/report`, {
      signal: AbortSignal.timeout(10000),
    });
    
    if (response.ok) {
      const data = await response.json();
      
      // Extract risk data
      overallScore = data.score || 0;
      
      // Check for specific risks
      if (data.risks) {
        for (const risk of data.risks) {
          const riskName = risk.name?.toLowerCase() || '';
          const riskLevel = risk.level?.toLowerCase() || '';
          
          if (riskName.includes('rug') || riskName.includes('scam')) {
            isRugPull = true;
            reasons.push(`Rug pull risk: ${risk.description || riskName}`);
          }
          
          if (riskName.includes('honeypot') || riskName.includes('sell')) {
            isHoneypot = true;
            reasons.push(`Honeypot risk: ${risk.description || riskName}`);
          }
          
          if (riskName.includes('mint') && riskLevel !== 'none') {
            hasMintAuthority = true;
            if (config.riskFilters.checkMintAuthority) {
              reasons.push('Mint authority not revoked');
            }
          }
          
          if (riskName.includes('freeze') && riskLevel !== 'none') {
            hasFreezeAuthority = true;
            if (config.riskFilters.checkFreezeAuthority) {
              reasons.push('Freeze authority not revoked');
            }
          }
        }
      }
      
      // Check holder distribution
      if (data.topHolders) {
        holderCount = data.totalHolders || data.topHolders.length;
        topHolderPercent = data.topHolders[0]?.pct || 0;
        
        if (holderCount < config.riskFilters.minHolders) {
          reasons.push(`Only ${holderCount} holders (min: ${config.riskFilters.minHolders})`);
        }
        
        if (topHolderPercent > config.riskFilters.maxOwnershipPercent) {
          reasons.push(`Top holder owns ${topHolderPercent.toFixed(1)}% (max: ${config.riskFilters.maxOwnershipPercent}%)`);
        }
      }
    }
  } catch {
    // If RugCheck fails, add a warning but don't fail
    reasons.push('Could not verify token safety (RugCheck unavailable)');
    overallScore = 50; // Neutral score
  }
  
  // Determine if risk check passed
  const passed = 
    overallScore <= config.maxRiskScore &&
    (!config.riskFilters.checkRugPull || !isRugPull) &&
    (!config.riskFilters.checkHoneypot || !isHoneypot) &&
    (!config.riskFilters.checkMintAuthority || !hasMintAuthority) &&
    (!config.riskFilters.checkFreezeAuthority || !hasFreezeAuthority) &&
    holderCount >= config.riskFilters.minHolders &&
    topHolderPercent <= config.riskFilters.maxOwnershipPercent;
  
  return {
    overallScore,
    isRugPull,
    isHoneypot,
    hasMintAuthority,
    hasFreezeAuthority,
    holderCount,
    topHolderPercent,
    passed,
    reasons,
  };
}

/**
 * Monitor for new liquidity events (polling-based)
 * Returns when liquidity is detected or timeout
 */
export async function monitorLiquidity(
  tokenAddress: string,
  config: TradingConfig,
  timeoutMs: number = 300000, // 5 minutes default
  onEvent?: TradingEventCallback
): Promise<LiquidityDetectionResult> {
  const startTime = Date.now();
  const pollInterval = 2000; // Poll every 2 seconds
  
  while (Date.now() - startTime < timeoutMs) {
    const result = await detectLiquidity(tokenAddress, config, onEvent);
    
    if (result.status === 'LP_READY') {
      return result;
    }
    
    if (result.status === 'RISK_FAILED') {
      return result; // Don't retry on risk failure
    }
    
    // Wait before next poll
    await new Promise(resolve => setTimeout(resolve, pollInterval));
  }
  
  return {
    status: 'LP_NOT_FOUND',
    liquidityInfo: null,
    riskAssessment: null,
    error: 'Liquidity monitoring timed out',
    detectedAt: startTime,
  };
}
