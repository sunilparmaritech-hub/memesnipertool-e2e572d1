/**
 * Pre-Execution Gate — Synchronous Rule Checks (Rules 1-9, 13-14)
 * 
 * Each function is a pure, zero-IO check returning a GateRuleResult.
 */

import type { PreExecutionGateInput, GateRuleResult } from './types';
import { PROTECTED_SYMBOLS, OFFICIAL_MINTS } from './types';
import { detectBuyerClusters, type ClusterDetectionInput } from '@/lib/buyerClusterDetection';

// ─── Rule 1: TIME BUFFER ────────────────────────────────────────────────────
export function checkTimeBuffer(input: PreExecutionGateInput): GateRuleResult {
  const rule = 'TIME_BUFFER';
  if (!input.poolCreatedAt) return { passed: true, rule, reason: 'Pool creation time unknown - proceeding with caution' };
  const ageSeconds = (Date.now() - input.poolCreatedAt) / 1000;
  if (ageSeconds < 15) return { passed: false, rule, reason: `Token too new (${ageSeconds.toFixed(1)}s) - instant execution blocked (<15s)` };
  if (ageSeconds < 20) return { passed: false, rule, reason: `Token age ${ageSeconds.toFixed(1)}s below minimum 20s buffer` };
  return { passed: true, rule, reason: `Token age ${ageSeconds.toFixed(1)}s meets 20s minimum` };
}

// ─── Rule 2: LIQUIDITY REALITY ──────────────────────────────────────────────
export function checkLiquidityReality(input: PreExecutionGateInput): GateRuleResult {
  const rule = 'LIQUIDITY_REALITY';
  const autoMinUsd = input.liquidityThresholds?.autoMinUsd ?? 10000;
  const manualMinUsd = input.liquidityThresholds?.manualMinUsd ?? 5000;
  const executionMode = input.executionMode || 'manual';
  const MIN_LIQUIDITY_USD = executionMode === 'auto' ? autoMinUsd : manualMinUsd;

  if (input.liquidity < MIN_LIQUIDITY_USD) {
    return { passed: false, rule, reason: `Liquidity $${input.liquidity.toFixed(0)} below ${executionMode.toUpperCase()} minimum $${MIN_LIQUIDITY_USD}`, penalty: 40 };
  }
  if (input.liquidityAdderWallet && input.deployerWallet && input.liquidityAdderWallet === input.deployerWallet) {
    return { passed: false, rule, reason: 'Liquidity adder same as deployer - high rug risk', penalty: 30 };
  }
  if (input.hasRemoveLiquidityTx) {
    return { passed: false, rule, reason: 'RemoveLiquidity transaction detected before buy - likely rug', penalty: 50 };
  }
  return { passed: true, rule, reason: `Liquidity $${input.liquidity.toFixed(0)} meets ${executionMode.toUpperCase()} minimum ($${MIN_LIQUIDITY_USD})` };
}

// ─── Rule 3: EXECUTABLE SELL ────────────────────────────────────────────────
export function checkExecutableSell(input: PreExecutionGateInput): GateRuleResult {
  const rule = 'EXECUTABLE_SELL';
  const MAX_SLIPPAGE = 0.35;
  if (input.isPumpFun || input.source === 'Pump.fun' || input.source === 'pumpfun' || input.source === 'PumpSwap') {
    return { passed: true, rule, reason: 'Pump.fun bonding curve token - sell via Pump.fun API' };
  }
  if (input.hasJupiterRoute === undefined) {
    return { passed: false, rule, reason: `Route validation REQUIRED - must confirm Jupiter/Raydium route before trading (liquidity: $${input.liquidity?.toFixed(0) || '?'})`, penalty: 40 };
  }
  if (input.hasJupiterRoute === false) {
    return { passed: false, rule, reason: `No Jupiter/Raydium sell route confirmed - token cannot be sold (liquidity: $${input.liquidity?.toFixed(0) || '?'})`, penalty: 60 };
  }
  if (input.jupiterSlippage !== undefined && input.jupiterSlippage > MAX_SLIPPAGE) {
    return { passed: true, rule, reason: `High sell slippage ${(input.jupiterSlippage * 100).toFixed(1)}% - proceed with caution` };
  }
  return { passed: true, rule, reason: input.jupiterSlippage !== undefined ? `Swap route verified with ${(input.jupiterSlippage * 100).toFixed(1)}% slippage` : 'Swap route verified (Jupiter or Raydium)' };
}

// ─── Rule 4: BUYER POSITION ────────────────────────────────────────────────
export function checkBuyerPosition(input: PreExecutionGateInput): GateRuleResult {
  const rule = 'BUYER_POSITION';
  const isAuto = input.executionMode === 'auto';

  // If targetBuyerPositions is an empty array, the user disabled the target positions check — allow any position
  if (Array.isArray(input.targetBuyerPositions) && input.targetBuyerPositions.length === 0) {
    return { passed: true, rule, reason: 'Target Positions disabled by user — any position allowed' };
  }

  // CRITICAL: Target positions enforcement MUST happen BEFORE any exemptions (liquidity, pumpfun, unknown position)
  // Otherwise tokens bypass the target check via exemption paths
  if (Array.isArray(input.targetBuyerPositions) && input.targetBuyerPositions.length > 0) {
    // When target positions are enabled, unknown position = BLOCK (can't confirm match)
    if (input.buyerPosition === undefined || input.buyerPosition === null) {
      return { 
        passed: false, 
        rule, 
        reason: `Buyer position unknown — cannot confirm match with target positions [${input.targetBuyerPositions.join(', ')}]`, 
        penalty: 30 
      };
    }
    if (!input.targetBuyerPositions.includes(input.buyerPosition)) {
      return { 
        passed: false, 
        rule, 
        reason: `Buyer position #${input.buyerPosition} not in target positions [${input.targetBuyerPositions.join(', ')}]`, 
        penalty: 25 
      };
    }
    return { passed: true, rule, reason: `Buyer position #${input.buyerPosition} matches target positions` };
  }

  // Below: fallback logic when no target positions are configured
  if (input.isPumpFun || input.source === 'Pump.fun' || input.source === 'pumpfun' || input.source === 'PumpSwap') {
    return { passed: true, rule, reason: 'Pump.fun fair launch - position check exempt' };
  }
  if (input.liquidity >= 50000) return { passed: true, rule, reason: `High liquidity ($${input.liquidity.toFixed(0)}) - position check exempt` };
  if (input.buyerPosition === undefined || input.buyerPosition === null) {
    return { passed: true, rule, reason: 'Buyer position unknown - proceeding with caution', penalty: isAuto ? 10 : 5 };
  }

  // Fallback: generic position thresholds when no target positions configured
  const holderCount = input.holderCount ?? input.uniqueBuyerCount ?? 0;
  let maxPosition: number;
  if (holderCount >= 50) {
    maxPosition = isAuto ? 200 : 500;
  } else if (holderCount >= 10) {
    maxPosition = isAuto ? 50 : 100;
  } else {
    maxPosition = isAuto ? 20 : 50;
  }
  if (input.buyerPosition > maxPosition) {
    return { passed: false, rule, reason: `Buyer position #${input.buyerPosition} exceeds ${isAuto ? 'AUTO' : 'MANUAL'} limit (>#${maxPosition}, holders: ${holderCount})`, penalty: 20 + Math.min(20, Math.floor((input.buyerPosition - maxPosition) / 5) * 5) };
  }
  if (input.uniqueBuyerCount !== undefined && input.uniqueBuyerCount < 3) {
    return { passed: false, rule, reason: `Only ${input.uniqueBuyerCount} unique holders - insufficient market participation`, penalty: 15 };
  }
  if (input.buyerPosition <= 5) return { passed: true, rule, reason: `Top-5 buyer position #${input.buyerPosition} - excellent entry` };
  if (input.buyerPosition <= 10) return { passed: true, rule, reason: `Early buyer position #${input.buyerPosition} - strong entry`, penalty: isAuto ? 5 : 0 };
  if (input.buyerPosition <= 20) {
    return { passed: true, rule, reason: `Buyer position #${input.buyerPosition} - acceptable range`, penalty: isAuto ? 10 + Math.floor((input.buyerPosition - 10) / 5) * 5 : 5 };
  }
  const penalty = 10 + Math.floor((input.buyerPosition - 20) / 10) * 5;
  return { passed: true, rule, reason: `Buyer position #${input.buyerPosition} - late entry risk`, penalty: Math.min(penalty, 25) };
}

// ─── Rule 5: PRICE SANITY ──────────────────────────────────────────────────
export function checkPriceSanity(input: PreExecutionGateInput): GateRuleResult {
  const rule = 'PRICE_SANITY';
  if (input.priceUsd === undefined || input.priceUsd === 0) {
    return { passed: true, rule, reason: 'Price data unavailable - proceeding with caution' };
  }
  if (input.previousPriceUsd !== undefined && input.previousPriceUsd > 0) {
    const shortTermMultiple = input.priceUsd / input.previousPriceUsd;
    if (shortTermMultiple > 50) return { passed: false, rule, reason: `Price jumped ${shortTermMultiple.toFixed(0)}x recently (>50x blocked)`, penalty: 20 };
  }
  if (input.lifetimeHighPrice !== undefined && input.lifetimeHighPrice > 0) {
    const percentOfHigh = (input.priceUsd / input.lifetimeHighPrice) * 100;
    if (percentOfHigh > 95) return { passed: true, rule, reason: `Price at ${percentOfHigh.toFixed(0)}% of ATH - high entry risk` };
  }
  return { passed: true, rule, reason: `Price $${input.priceUsd.toFixed(8)} passes sanity checks` };
}

// ─── Rule 6: SYMBOL SPOOFING ──────────────────────────────────────────────
export function checkSymbolSpoofing(input: PreExecutionGateInput): GateRuleResult {
  const rule = 'SYMBOL_SPOOFING';
  const symbol = input.tokenSymbol.toUpperCase();
  if (PROTECTED_SYMBOLS.includes(symbol)) {
    const officialMint = OFFICIAL_MINTS[symbol];
    if (officialMint && input.tokenAddress !== officialMint) return { passed: false, rule, reason: `Symbol "${symbol}" spoofing detected - not official mint`, penalty: 15 };
    if (!officialMint) return { passed: false, rule, reason: `Symbol "${symbol}" is protected - likely spoofing`, penalty: 15 };
  }
  const nameLower = input.tokenName.toLowerCase();
  const suspiciousPatterns = ['elon', 'trump', 'biden', 'musk', 'official', 'real', 'verified', 'original', 'authentic', 'legit'];
  for (const pattern of suspiciousPatterns) {
    if (nameLower.includes(pattern) && !input.isPumpFun) {
      return { passed: true, rule, reason: `Token name contains "${pattern}" - verify authenticity` };
    }
  }
  return { passed: true, rule, reason: 'Symbol/name verification passed' };
}

// ─── Rule 7: FREEZE AUTHORITY ──────────────────────────────────────────────
export function checkFreezeAuthority(input: PreExecutionGateInput): GateRuleResult {
  const rule = 'FREEZE_AUTHORITY';
  if (input.hasFreezeAuthority === undefined) return { passed: true, rule, reason: 'Freeze authority status unknown - proceeding with caution' };
  if (input.hasFreezeAuthority === true) return { passed: false, rule, reason: 'Token has active freeze authority - owner can lock all transfers', penalty: 50 };
  return { passed: true, rule, reason: 'No freeze authority - token is safe' };
}

// ─── Rule 13: BUYER CLUSTER ───────────────────────────────────────────────
export function checkBuyerCluster(input: PreExecutionGateInput): GateRuleResult {
  const clusterInput: ClusterDetectionInput = {
    deployerWallet: input.deployerWallet,
    firstBuyerWallet: input.firstBuyerWallet,
    buyerWallets: input.buyerWallets,
    uniqueBuyerCount: input.uniqueBuyerCount,
    isPumpFun: input.isPumpFun,
    source: input.source,
    recentBuyers: input.buyerTimestamps?.map(b => ({ address: b.address, timestamp: b.timestamp, fundingWallet: b.fundingWallet })),
  };
  const result = detectBuyerClusters(clusterInput);
  (input as any)._buyerClusterResult = result;
  return { passed: result.passed, rule: result.rule, reason: result.reason, penalty: result.penalty };
}

// ─── Rule 14: LP OWNERSHIP DISTRIBUTION ──────────────────────────────────
export function checkLpOwnershipDistribution(input: PreExecutionGateInput): GateRuleResult {
  const rule = 'LP_OWNERSHIP_DISTRIBUTION';
  const isPump = input.isPumpFun || input.source === 'Pump.fun' || input.source === 'pumpfun' || input.source === 'PumpSwap';

  if (input.lpHolderConcentration !== undefined && input.lpHolderConcentration > 85) {
    return { passed: false, rule, reason: `HARD BLOCK: ${input.lpHolderConcentration.toFixed(1)}% LP tokens held by single wallet (>85%)`, penalty: 50 };
  }
  if (input.lpHolderConcentration !== undefined && input.lpHolderConcentration > 75) {
    const isAuto = input.executionMode === 'auto';
    return { passed: !isAuto, rule, reason: isAuto ? `BLOCKED (AUTO): ${input.lpHolderConcentration.toFixed(1)}% LP concentration too high for auto-snipe (>75%)` : `HIGH RISK: ${input.lpHolderConcentration.toFixed(1)}% LP concentration (>75%)`, penalty: isAuto ? 40 : 30 };
  }
  if (input.lpHolderConcentration !== undefined && input.lpHolderConcentration > 60) {
    return { passed: true, rule, reason: `LP concentration ${input.lpHolderConcentration.toFixed(1)}% elevated (>60%)`, penalty: 15 };
  }
  if (input.lpOwnerIsDeployer === true && !isPump) {
    return { passed: false, rule, reason: 'LP owner is the deployer - high rug pull risk', penalty: 35 };
  }
  if (input.lpRecentlyMinted === true) {
    return { passed: false, rule, reason: 'LP tokens minted within last 60 seconds - possible fake liquidity injection', penalty: 25 };
  }
  if (input.lpRecentlyTransferred === true) {
    return { passed: true, rule, reason: 'LP tokens recently transferred - monitor closely', penalty: 20 };
  }
  if (input.lpHolderConcentration === undefined && input.lpOwnerIsDeployer === undefined) {
    return { passed: true, rule, reason: 'LP distribution data unavailable - proceeding with caution', penalty: input.executionMode === 'auto' ? 10 : 5 };
  }
  return { passed: true, rule, reason: `LP distribution OK${input.lpHolderConcentration !== undefined ? ` (top holder: ${input.lpHolderConcentration.toFixed(1)}%)` : ''}` };
}

// ─── Rule 23: DATA COMPLETENESS ──────────────────────────────────────────
/**
 * Meta-rule: counts how many rules passed ONLY because data was unavailable.
 * If too many rules have "unknown" / "unavailable" / "proceeding with caution" passes,
 * the token is likely a scam exploiting data gaps.
 * 
 * RCA: GoldPippin-type tokens pass all 23 rules when:
 * - hasFreezeAuthority = undefined → passes
 * - lpMintAddress = undefined → passes with small penalty
 * - deployerWallet = undefined → skipped
 * - holderData = empty → skipped
 * - recentTradeRecords = empty → skipped
 * - buyerWallets < 3 → skipped
 * 
 * This rule catches that pattern: if 5+ rules passed due to missing data, BLOCK.
 */
export function checkDataCompleteness(allReasons: string[]): GateRuleResult {
  const rule = 'DATA_COMPLETENESS';
  const CAUTION_PHRASES = [
    'unknown', 'unavailable', 'proceeding with caution', 'not provided',
    'skipped', 'no data', 'data unavailable', 'insufficient',
  ];

  let cautionCount = 0;
  const cautionRules: string[] = [];

  for (const reason of allReasons) {
    const lower = reason.toLowerCase();
    if (CAUTION_PHRASES.some(phrase => lower.includes(phrase))) {
      cautionCount++;
      // Extract rule name from [RULE_NAME] prefix
      const match = reason.match(/\[([A-Z_]+)\]/);
      if (match) cautionRules.push(match[1]);
    }
  }

  if (cautionCount >= 6) {
    return {
      passed: false,
      rule,
      reason: `HARD BLOCK: ${cautionCount} rules passed only due to missing data (${cautionRules.slice(0, 4).join(', ')}...) — insufficient verification to trade safely`,
      penalty: 40,
    };
  }
  if (cautionCount >= 4) {
    return {
      passed: false,
      rule,
      reason: `BLOCKED: ${cautionCount} rules had insufficient data (${cautionRules.join(', ')}) — token cannot be adequately verified`,
      penalty: 30,
    };
  }
  if (cautionCount >= 2) {
    return {
      passed: true,
      rule,
      reason: `${cautionCount} rules had partial data — proceeding with elevated caution`,
      penalty: 10 + cautionCount * 3,
    };
  }

  return { passed: true, rule, reason: `Data completeness OK — ${cautionCount} rules with missing data` };
}

// ─── Enhanced risk penalty calculator ────────────────────────────────────
export function calculateEnhancedRiskPenalties(input: PreExecutionGateInput, doubleQuoteDeviation?: number | null): number {
  let penalty = 0;
  if (input.lpHolderConcentration !== undefined && input.lpHolderConcentration > 80) penalty += 30;
  if (input.liquidityAgeSeconds !== undefined && input.liquidityAgeSeconds < 30) penalty += 25;
  const clusterResult = (input as any)._buyerClusterResult;
  if (clusterResult?.details?.clusterDetected) penalty += 20;
  if (doubleQuoteDeviation !== undefined && doubleQuoteDeviation !== null && doubleQuoteDeviation > 3) penalty += 20;
  return penalty;
}
