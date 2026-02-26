/**
 * Pre-Execution Gate — Public API
 *
 * Re-exports everything from the refactored sub-modules so that all
 * existing import paths (`from '@/lib/preExecutionGate'`) keep working.
 *
 * The original 1 937-line monolith is now split into:
 *  • types.ts      — shared interfaces, constants
 *  • rules.ts      — synchronous rule checks (Rules 1-9, 13-14)
 *  • multi-rpc.ts  — RPC-level token supply cross-check + Jupiter sell sim
 *  • index.ts      — gate orchestrator, batch helper, state helpers (this file)
 */

// ── Re-exports ──────────────────────────────────────────────────────────────
export type {
  PreExecutionGateInput,
  GateDecision,
  GateRuleResult,
  GateActivityLogEntry,
  MultiRpcSimulationResult,
} from './types';

export { DEFAULT_LIQUIDITY_THRESHOLDS } from './types';
import { DEFAULT_LIQUIDITY_THRESHOLDS as _DEFAULT_LIQUIDITY_THRESHOLDS } from './types';
export { validateMultiRpcSimulation, simulateJupiterSell } from './multi-rpc';

// ── Imports used by the orchestrator ────────────────────────────────────────
import { supabase } from '@/integrations/supabase/client';
import { Connection } from '@solana/web3.js';
import { verifyLpIntegrity } from '@/lib/lpVerification';
import { checkDeployerReputation } from '@/lib/deployerReputation';
import { checkSellTax } from '@/lib/sellTaxDetector';
import { checkRugProbability, RUG_PROBABILITY_BLOCK_THRESHOLD } from '@/lib/rugProbability';
import { checkLiquidityStability } from '@/lib/liquidityMonitor';
import { validateQuoteDepth, doubleQuoteVerification, type DepthValidationResult } from '@/lib/quoteDepthValidator';
import { checkHolderEntropy } from '@/lib/holderEntropy';
import { analyzeVolumeAuthenticity, type VolumeAuthenticityResult } from '@/lib/volumeAuthenticity';
import { detectWalletCluster } from '@/lib/walletClusterDetection';
import { checkLiquidityAging } from '@/lib/liquidityAging';
import { simulateCapitalPreservation } from '@/lib/capitalPreservation';
import { analyzeDeployerBehavior, type DeployerBehaviorResult } from '@/lib/deployerBehavior';
import { applyDynamicRiskCap } from '@/lib/dynamicRiskCap';
import { runObservationDelay, type ObservationResult } from '@/lib/observationDelay';
import { calculateEarlyTrustScore, type EarlyTrustResult } from '@/lib/earlyTrustScore';
import type { ClusterDetectionResult } from '@/lib/buyerClusterDetection';
import type { SellTaxDetectionResult } from '@/lib/sellTaxDetector';
import type { LpVerificationResult } from '@/lib/lpVerification';
import type { DeployerCheckResult } from '@/lib/deployerReputation';
import type { RugProbabilityResult } from '@/lib/rugProbability';
import type { LiquidityMonitorResult } from '@/lib/liquidityMonitor';

import type { PreExecutionGateInput, GateDecision, GateRuleResult, GateActivityLogEntry } from './types';
import {
  checkTimeBuffer,
  checkLiquidityReality,
  checkExecutableSell,
  checkBuyerPosition,
  checkPriceSanity,
  checkSymbolSpoofing,
  checkFreezeAuthority,
  checkBuyerCluster,
  checkLpOwnershipDistribution,
  calculateEnhancedRiskPenalties,
  checkDataCompleteness,
} from './rules';

// ── RPC connection helper ───────────────────────────────────────────────────
const SOLANA_RPC_ENDPOINTS = [
  typeof import.meta !== 'undefined' ? (import.meta as any).env?.VITE_SOLANA_RPC_URL : undefined,
  'https://rpc.ankr.com/solana',
  'https://api.mainnet-beta.solana.com',
].filter(Boolean) as string[];

let rpcIndex = 0;
function getConnection(): Connection {
  const rpcUrl = SOLANA_RPC_ENDPOINTS[rpcIndex] || SOLANA_RPC_ENDPOINTS[0];
  return new Connection(rpcUrl, { commitment: 'confirmed' });
}

// ── Helpers ─────────────────────────────────────────────────────────────────
function skippedResult(rule: string): GateRuleResult {
  return { passed: true, rule, reason: `${rule} check disabled by user` };
}

// ── LP INTEGRITY (Rule 8, async) ────────────────────────────────────────────
async function checkLpIntegrity(input: PreExecutionGateInput): Promise<GateRuleResult> {
  const rule = 'LP_INTEGRITY';
  if (input.isPumpFun || input.source === 'Pump.fun' || input.source === 'pumpfun' || input.source === 'PumpSwap') {
    return { passed: true, rule, reason: 'Pump.fun token - uses bonding curve, LP check skipped' };
  }
  if (!input.lpMintAddress) {
    if (input.liquidity >= 50000) return { passed: true, rule, reason: 'LP mint unknown but high liquidity ($50k+) - proceeding with caution' };
    return { passed: true, rule, reason: 'LP mint address not provided - unable to verify LP safety', penalty: 15 };
  }
  try {
    const connection = getConnection();
    const lpResult = await verifyLpIntegrity(connection, input.lpMintAddress, input.creatorAddress);
    (input as any)._lpVerificationResult = lpResult;
    if (!lpResult.lpLocked) return { passed: false, rule, reason: `LP NOT LOCKED: Only ${lpResult.lpBurnedPercent.toFixed(1)}% burned - rug pull risk`, penalty: 50 };
    if (lpResult.creatorLpPercent > 5) return { passed: false, rule, reason: `CREATOR HOLDS ${lpResult.creatorLpPercent.toFixed(1)}% LP (> 5% blocked) - rug pull risk`, penalty: 40 };
    if (lpResult.mintAuthority !== null) return { passed: false, rule, reason: 'LP MINT AUTHORITY EXISTS - new LP tokens can be minted (rug risk)', penalty: 50 };
    if (lpResult.lpBurnedPercent < 95) return { passed: true, rule, reason: `LP ${lpResult.lpBurnedPercent.toFixed(1)}% burned (< 95%) - minor risk`, penalty: 10 };
    return { passed: true, rule, reason: `LP SAFE: ${lpResult.lpBurnedPercent.toFixed(1)}% burned, no mint authority` };
  } catch (error) {
    console.error('[LP Check] Verification error:', error);
    return { passed: true, rule, reason: 'LP verification failed - proceeding with caution', penalty: 20 };
  }
}

// =============================================================================
// MAIN GATE FUNCTION
// =============================================================================
export async function preExecutionGate(
  input: PreExecutionGateInput,
  options?: { logActivity?: (entry: GateActivityLogEntry) => void }
): Promise<GateDecision> {
  const timestamp = Date.now();
  const passedRules: string[] = [];
  const failedRules: string[] = [];
  const reasons: string[] = [];
  let riskScore = 100;

  const logActivity = options?.logActivity;
  const toggles = input.validationToggles;
  const tierFeatures = input.tierFeatures;
  const isRuleEnabled = (ruleKey: string): boolean => !toggles || toggles[ruleKey] !== false;

  logActivity?.({ tokenSymbol: input.tokenSymbol, tokenAddress: input.tokenAddress, level: 'info', category: 'evaluate', message: `🔍 Pre-execution gate checking ${input.tokenSymbol}`, details: `Liquidity: $${input.liquidity?.toFixed(0) || '?'} | Source: ${input.source || 'unknown'}` });

  // ── Sync rules (1-7, 13-14) ─────────────────────────────────────────────
  const syncRuleChecks: Array<{ check: GateRuleResult; name: string }> = [
    { check: isRuleEnabled('TIME_BUFFER') ? checkTimeBuffer(input) : skippedResult('TIME_BUFFER'), name: 'Time Buffer' },
    { check: isRuleEnabled('LIQUIDITY_REALITY') ? checkLiquidityReality(input) : skippedResult('LIQUIDITY_REALITY'), name: 'Liquidity' },
    { check: isRuleEnabled('EXECUTABLE_SELL') ? checkExecutableSell(input) : skippedResult('EXECUTABLE_SELL'), name: 'Sell Check' },
    { check: isRuleEnabled('BUYER_POSITION') ? checkBuyerPosition(input) : skippedResult('BUYER_POSITION'), name: 'Buyer Position' },
    { check: isRuleEnabled('BUYER_CLUSTER') ? checkBuyerCluster(input) : skippedResult('BUYER_CLUSTER'), name: 'Buyer Cluster' },
    { check: isRuleEnabled('LP_OWNERSHIP_DISTRIBUTION') ? checkLpOwnershipDistribution(input) : skippedResult('LP_OWNERSHIP_DISTRIBUTION'), name: 'LP Distribution' },
    { check: isRuleEnabled('PRICE_SANITY') ? checkPriceSanity(input) : skippedResult('PRICE_SANITY'), name: 'Price' },
    { check: isRuleEnabled('SYMBOL_SPOOFING') ? checkSymbolSpoofing(input) : skippedResult('SYMBOL_SPOOFING'), name: 'Symbol' },
    { check: isRuleEnabled('FREEZE_AUTHORITY') ? checkFreezeAuthority(input) : skippedResult('FREEZE_AUTHORITY'), name: 'Freeze Authority' },
  ];

  // ── Async rules (8-12) ──────────────────────────────────────────────────
  const lpCheck = isRuleEnabled('LP_INTEGRITY') ? await checkLpIntegrity(input) : skippedResult('LP_INTEGRITY');

  const deployerCheck: GateRuleResult = isRuleEnabled('DEPLOYER_REPUTATION') ? await (async () => {
    const result = await checkDeployerReputation(input.deployerWallet);
    (input as any)._deployerReputationResult = result;
    return { passed: result.passed, rule: result.rule, reason: result.reason, penalty: result.penalty } as GateRuleResult;
  })() : (() => { (input as any)._deployerReputationResult = null; return skippedResult('DEPLOYER_REPUTATION'); })();

  let sellTaxCheck: GateRuleResult;
  if (!isRuleEnabled('HIDDEN_SELL_TAX')) {
    sellTaxCheck = skippedResult('HIDDEN_SELL_TAX');
  } else if (!input.isPumpFun && input.source !== 'Pump.fun' && input.source !== 'pumpfun' && input.source !== 'PumpSwap') {
    const r = await checkSellTax(input.tokenAddress);
    (input as any)._sellTaxResult = (r as any).taxResult;
    sellTaxCheck = { passed: r.passed, rule: r.rule, reason: r.reason, penalty: (r as any).penalty };
  } else {
    sellTaxCheck = { passed: true, rule: 'HIDDEN_SELL_TAX', reason: 'Pump.fun token - tax check skipped' };
  }

  let rugProbGateResult: GateRuleResult;
  if (!isRuleEnabled('RUG_PROBABILITY')) {
    rugProbGateResult = skippedResult('RUG_PROBABILITY');
  } else {
    const rpc = await checkRugProbability({ tokenAddress: input.tokenAddress, liquidityUsd: input.liquidity, fdvUsd: input.fdvUsd, marketCapUsd: input.marketCapUsd, holderCount: input.holderCount, topHolders: input.topHolders, deployerWallet: input.deployerWallet, fundingSource: input.fundingSource, recentBuyers: input.recentBuyers, tokenAge: input.tokenAge, isPumpFun: input.isPumpFun });
    (input as any)._rugProbabilityResult = rpc.result;
    rugProbGateResult = { passed: rpc.passed, rule: rpc.rule, reason: rpc.reason, penalty: rpc.passed ? 0 : Math.min(40, rpc.probability - RUG_PROBABILITY_BLOCK_THRESHOLD) };
  }

  let liquidityStabilityGateResult: GateRuleResult;
  if (!isRuleEnabled('LIQUIDITY_STABILITY')) {
    liquidityStabilityGateResult = skippedResult('LIQUIDITY_STABILITY');
  } else {
    const lsc = await checkLiquidityStability(input.tokenAddress, input.liquidity);
    (input as any)._liquidityStabilityResult = lsc.monitorResult;
    liquidityStabilityGateResult = { passed: lsc.passed, rule: lsc.rule, reason: lsc.reason, penalty: lsc.penalty };
  }

  // ── Quote depth + double-quote (Rules 15-16) ───────────────────────────
  let quoteDepthResult: DepthValidationResult | null = null;
  let doubleQuoteDeviation: number | null = null;
  const isHighLiquidity = input.liquidity >= 50000;

  let quoteDepthGateResult: GateRuleResult = !isRuleEnabled('QUOTE_DEPTH') ? skippedResult('QUOTE_DEPTH') : { passed: true, rule: 'QUOTE_DEPTH', reason: (!input.buyAmountSol || input.buyAmountSol <= 0) ? 'Buy amount not configured — skipped' : 'Quote depth pending' };
  let doubleQuoteGateResult: GateRuleResult = !isRuleEnabled('DOUBLE_QUOTE') ? skippedResult('DOUBLE_QUOTE') : { passed: true, rule: 'DOUBLE_QUOTE', reason: (!input.buyAmountSol || input.buyAmountSol <= 0) ? 'Buy amount not configured — skipped' : 'Double-quote pending' };

  if (input.buyAmountSol && input.buyAmountSol > 0 && isRuleEnabled('QUOTE_DEPTH')) {
    if (isHighLiquidity) {
      quoteDepthGateResult = { passed: true, rule: 'QUOTE_DEPTH', reason: `High liquidity $${(input.liquidity / 1000).toFixed(0)}k — depth check skipped` };
    } else {
      quoteDepthResult = await validateQuoteDepth({ tokenAddress: input.tokenAddress, buyAmountSol: input.buyAmountSol, maxSlippage: input.maxSlippage || 0.15, poolLiquidityUsd: input.liquidity, solPriceUsd: input.solPriceUsd, isPumpFun: input.isPumpFun, source: input.source });
      (input as any)._quoteDepthResult = quoteDepthResult;
      quoteDepthGateResult = { passed: quoteDepthResult.passed, rule: quoteDepthResult.rule, reason: quoteDepthResult.reason, penalty: quoteDepthResult.penalty };
    }

    if (!isHighLiquidity && quoteDepthResult?.passed && isRuleEnabled('DOUBLE_QUOTE') && input.buyAmountSol > 0) {
      const dqResult = await doubleQuoteVerification(input.tokenAddress, input.buyAmountSol, input.maxSlippage || 0.15, input.isPumpFun, input.source);
      doubleQuoteDeviation = dqResult.deviation;
      doubleQuoteGateResult = { passed: dqResult.passed, rule: dqResult.rule, reason: dqResult.reason, penalty: dqResult.penalty };
    } else if (isHighLiquidity && isRuleEnabled('DOUBLE_QUOTE')) {
      doubleQuoteGateResult = { passed: true, rule: 'DOUBLE_QUOTE', reason: 'High liquidity — double-quote skipped' };
    }
  }

  // ── Rules 17-22: Parallel async ────────────────────────────────────────
  let holderEntropyResult: ReturnType<typeof checkHolderEntropy> | null = null;
  if (isRuleEnabled('HOLDER_ENTROPY') && input.holderData && input.holderData.length > 0) {
    holderEntropyResult = checkHolderEntropy(input.holderData);
  }

  let volumeAuthResult: VolumeAuthenticityResult | null = null;
  if (isRuleEnabled('VOLUME_AUTHENTICITY') && input.recentTradeRecords && input.recentTradeRecords.length > 0) {
    volumeAuthResult = analyzeVolumeAuthenticity(input.recentTradeRecords);
  }

  const [walletClusterResult, liquidityAgingResult, capitalPresResult, deployerBehaviorResult] = await Promise.all([
    (async () => {
      // TIER GATE: advanced_clustering required for wallet cluster analysis
      if (tierFeatures && tierFeatures.advanced_clustering === false) return null;
      if (!isRuleEnabled('WALLET_CLUSTER') || !input.buyerWallets || input.buyerWallets.length < 3) return null;
      return detectWalletCluster({ deployerWallet: input.deployerWallet, lpCreatorWallet: input.lpCreatorWallet, buyerWallets: input.buyerWallets, isPumpFun: input.isPumpFun, source: input.source });
    })(),
    (async () => {
      if (!isRuleEnabled('LIQUIDITY_AGING')) return null;
      return checkLiquidityAging({ tokenAddress: input.tokenAddress, poolCreatedAt: input.poolCreatedAt, currentLiquidity: input.liquidity, previousLiquidity: input.previousLiquidityUsd, executionMode: input.executionMode || 'manual', isPumpFun: input.isPumpFun, source: input.source });
    })(),
    (async () => {
      // TIER GATE: capital_preservation required for stress simulation
      if (tierFeatures && tierFeatures.capital_preservation === false) return null;
      if (!isRuleEnabled('CAPITAL_PRESERVATION') || !input.buyAmountSol || !(input.solPriceUsd && input.solPriceUsd > 0)) return null;
      return simulateCapitalPreservation({ tokenAddress: input.tokenAddress, buyAmountSol: input.buyAmountSol, currentLiquidityUsd: input.liquidity, solPriceUsd: input.solPriceUsd, currentPriceImpact: quoteDepthResult?.details?.priceImpact ?? undefined, isPumpFun: input.isPumpFun, source: input.source });
    })(),
    isRuleEnabled('DEPLOYER_BEHAVIOR') ? analyzeDeployerBehavior({ deployerWallet: input.deployerWallet, isPumpFun: input.isPumpFun, source: input.source }) : Promise.resolve({ passed: true, rule: 'DEPLOYER_BEHAVIOR', reason: 'DEPLOYER_BEHAVIOR check disabled by user', penalty: 0, hardBlock: false, details: {} } as DeployerBehaviorResult),
  ]);

  // ── Assemble new rule results ─────────────────────────────────────────
  const newRuleChecks: Array<{ check: GateRuleResult; name: string }> = [];
  const addOrSkip = (enabled: boolean, result: any, rule: string, name: string, noDataReason: string) => {
    if (!enabled) { newRuleChecks.push({ check: skippedResult(rule), name }); return; }
    if (result) { newRuleChecks.push({ check: { passed: result.passed, rule: result.rule, reason: result.reason, penalty: result.penalty }, name }); return; }
    newRuleChecks.push({ check: { passed: true, rule, reason: noDataReason }, name });
  };
  addOrSkip(isRuleEnabled('HOLDER_ENTROPY'), holderEntropyResult, 'HOLDER_ENTROPY', 'Holder Entropy', 'No holder data available - skipped');
  addOrSkip(isRuleEnabled('VOLUME_AUTHENTICITY'), volumeAuthResult, 'VOLUME_AUTHENTICITY', 'Volume Authenticity', 'No trade records available - skipped');
  addOrSkip(isRuleEnabled('WALLET_CLUSTER'), walletClusterResult, 'WALLET_CLUSTER', 'Wallet Cluster', tierFeatures?.advanced_clustering === false ? 'Requires Elite plan — skipped' : 'Insufficient buyer data (<3 wallets) - skipped');
  addOrSkip(isRuleEnabled('LIQUIDITY_AGING'), liquidityAgingResult, 'LIQUIDITY_AGING', 'Liquidity Aging', 'No liquidity aging data - skipped');
  if (!isRuleEnabled('CAPITAL_PRESERVATION')) { newRuleChecks.push({ check: skippedResult('CAPITAL_PRESERVATION'), name: 'Capital Preservation' }); }
  else if (tierFeatures?.capital_preservation === false) { newRuleChecks.push({ check: { passed: true, rule: 'CAPITAL_PRESERVATION', reason: 'Requires Elite plan — skipped' }, name: 'Capital Preservation' }); }
  else if (capitalPresResult) { newRuleChecks.push({ check: { passed: capitalPresResult.passed, rule: capitalPresResult.rule, reason: capitalPresResult.reason, penalty: capitalPresResult.penalty }, name: 'Capital Preservation' }); }
  else { newRuleChecks.push({ check: { passed: true, rule: 'CAPITAL_PRESERVATION', reason: !input.buyAmountSol ? 'Buy amount not configured — skipped' : 'SOL price unavailable — skipped' }, name: 'Capital Preservation' }); }
  newRuleChecks.push({ check: { passed: deployerBehaviorResult.passed, rule: deployerBehaviorResult.rule, reason: deployerBehaviorResult.reason, penalty: deployerBehaviorResult.penalty }, name: 'Deployer Behavior' });

  // ── Combine all 23 rules ──────────────────────────────────────────────
  const ruleChecks: Array<{ check: GateRuleResult; name: string }> = [
    ...syncRuleChecks,
    { check: lpCheck, name: 'LP Integrity' },
    { check: deployerCheck, name: 'Deployer Reputation' },
    { check: sellTaxCheck, name: 'Sell Tax' },
    { check: rugProbGateResult, name: 'Rug Probability' },
    { check: liquidityStabilityGateResult, name: 'Liquidity Stability' },
    { check: quoteDepthGateResult, name: 'Quote Depth' },
    { check: doubleQuoteGateResult, name: 'Double Quote' },
    ...newRuleChecks,
  ];

  // BEHAVIORAL RULES converted to penalties instead of hard blocks:
  // HOLDER_ENTROPY, WALLET_CLUSTER (non-hard), DOUBLE_QUOTE, LIQUIDITY_AGING (non-hard)
  // These were causing most overblocking — now they subtract points but don't block execution
  const BEHAVIORAL_PENALTY_RULES = new Set(['HOLDER_ENTROPY', 'WALLET_CLUSTER', 'DOUBLE_QUOTE', 'LIQUIDITY_AGING']);
  
  // Only structural hard blocks remain: LP integrity, freeze authority, deployer behavior (hard), capital preservation (hard)
  let hasBlockingFailure = !!(capitalPresResult?.hardBlock || deployerBehaviorResult.hardBlock);
  // Wallet cluster and liquidity aging only block if they have a HARD block flag
  if (walletClusterResult?.hardBlock) hasBlockingFailure = true;
  if (liquidityAgingResult?.hardBlock) hasBlockingFailure = true;

  for (const { check, name } of ruleChecks) {
    reasons.push(`[${check.rule}] ${check.reason}`);
    if (check.passed) {
      passedRules.push(check.rule);
      if (check.penalty) riskScore -= (check.penalty as number);
      logActivity?.({ tokenSymbol: input.tokenSymbol, tokenAddress: input.tokenAddress, level: 'success', category: 'evaluate', message: `✓ ${input.tokenSymbol} ${name}: PASS`, details: check.reason });
    } else {
      // CRITICAL: Behavioral rules become weighted penalties, NOT hard blocks
      if (BEHAVIORAL_PENALTY_RULES.has(check.rule)) {
        // Convert to penalty-only: subtract points but DON'T mark as blocking failure
        passedRules.push(check.rule); // Count as "passed with penalty"
        const penalty = (check.penalty as number) || 15;
        riskScore -= penalty;
        logActivity?.({ tokenSymbol: input.tokenSymbol, tokenAddress: input.tokenAddress, level: 'warning', category: 'evaluate', message: `⚠️ ${input.tokenSymbol} ${name}: PENALTY (−${penalty})`, details: `${check.reason} (converted to weighted penalty, not blocking)` });
      } else {
        // Structural rule failure — still a hard block
        failedRules.push(check.rule);
        hasBlockingFailure = true;
        if (check.penalty) riskScore -= (check.penalty as number);
        logActivity?.({ tokenSymbol: input.tokenSymbol, tokenAddress: input.tokenAddress, level: 'warning', category: 'evaluate', message: `✗ ${input.tokenSymbol} ${name}: FAIL`, details: `${check.reason} (−${check.penalty || 0} points)` });
      }
    }
  }

  riskScore -= calculateEnhancedRiskPenalties(input, doubleQuoteDeviation);

  // ── Rule 23: DATA COMPLETENESS (meta-rule) ────────────────────────────
  if (isRuleEnabled('DATA_COMPLETENESS')) {
    const dataCheck = checkDataCompleteness(reasons);
    reasons.push(`[${dataCheck.rule}] ${dataCheck.reason}`);
    if (dataCheck.passed) {
      passedRules.push(dataCheck.rule);
      if (dataCheck.penalty) riskScore -= dataCheck.penalty;
      logActivity?.({ tokenSymbol: input.tokenSymbol, tokenAddress: input.tokenAddress, level: 'success', category: 'evaluate', message: `✓ ${input.tokenSymbol} Data Completeness: PASS`, details: dataCheck.reason });
    } else {
      failedRules.push(dataCheck.rule);
      hasBlockingFailure = true;
      if (dataCheck.penalty) riskScore -= dataCheck.penalty;
      logActivity?.({ tokenSymbol: input.tokenSymbol, tokenAddress: input.tokenAddress, level: 'error', category: 'evaluate', message: `✗ ${input.tokenSymbol} Data Completeness: FAIL`, details: dataCheck.reason });
    }
  }

  // ── Early Trust Score (Stage 2.5) ─────────────────────────────────────
  // Adds bonus points for tokens with strong positive signals
  const lpResult = (input as any)._lpVerificationResult;
  const deployerRepResult = (input as any)._deployerReputationResult;
  const earlyTrustResult = calculateEarlyTrustScore({
    liquidityUsd: input.liquidity,
    uniqueBuyerCount: input.uniqueBuyerCount,
    buyerWallets: input.buyerWallets,
    fundingSourceDiversity: walletClusterResult ? (walletClusterResult.passed ? 0.8 : 0.3) : undefined,
    lpBurnedPercent: lpResult?.lpBurnedPercent,
    hasConfirmedSellRoute: input.hasJupiterRoute === true,
    sellSlippage: input.jupiterSlippage,
    deployerReputationScore: deployerRepResult?.details?.reputationScore,
    holderCount: input.holderCount,
    tokenAgeSeconds: input.tokenAge,
    isPumpFun: input.isPumpFun,
  });
  
  if (earlyTrustResult.bonus > 0) {
    riskScore += earlyTrustResult.bonus;
    reasons.push(`[EARLY_TRUST] +${earlyTrustResult.bonus} bonus (${earlyTrustResult.signals.join(', ')})`);
    logActivity?.({ tokenSymbol: input.tokenSymbol, tokenAddress: input.tokenAddress, level: 'success', category: 'evaluate', message: `🏆 ${input.tokenSymbol} Early Trust: +${earlyTrustResult.bonus}`, details: earlyTrustResult.signals.join(', ') });
  }

  // ── Dynamic risk cap (v2 — graduated) ─────────────────────────────────
  const dynamicCapResult = applyDynamicRiskCap(riskScore, {
    lpConcentration: input.lpHolderConcentration,
    buyerClusterDetected: !!(walletClusterResult && walletClusterResult.hardBlock), // Only hard-block clusters trigger cap
    holderEntropyScore: holderEntropyResult?.result?.entropyScore,
    liquidityAgeSeconds: liquidityAgingResult?.details?.liquidityAgeSeconds,
    volumeWashDetected: !!(volumeAuthResult && !volumeAuthResult.passed && volumeAuthResult.details.isWashTrading),
    walletClusterDetected: !!(walletClusterResult && walletClusterResult.hardBlock), // Only hard-block clusters
  });
  riskScore = Math.max(0, Math.min(100, dynamicCapResult.finalScore));

  if (dynamicCapResult.capped) {
    reasons.push(`[DYNAMIC_CAP] Score capped: ${dynamicCapResult.originalScore} → ${dynamicCapResult.finalScore} (${dynamicCapResult.flagCount} flag${dynamicCapResult.flagCount > 1 ? 's' : ''}: ${dynamicCapResult.capReasons.join(', ')})`);
  }

  const minRiskScore = input.executionMode === 'auto' ? 65 : 55;
  let allowed = !hasBlockingFailure && riskScore >= minRiskScore;
  let state: GateDecision['state'] = allowed ? 'EXECUTABLE' : riskScore > 0 && riskScore < minRiskScore ? 'OBSERVED' : 'BLOCKED';

  // ── Observation delay (v2 — 3s, skips high-liq) ──────────────────────
  let observationResult: ObservationResult | undefined;
  if (state === 'EXECUTABLE') {
    observationResult = await runObservationDelay({ tokenAddress: input.tokenAddress, initialLiquidityUsd: input.liquidity, initialQuoteOutput: quoteDepthResult?.details?.quote1Output ?? undefined, buyAmountSol: input.buyAmountSol, maxSlippage: input.maxSlippage, isPumpFun: input.isPumpFun, source: input.source });
    if (!observationResult.stable) { state = 'OBSERVED'; allowed = false; }
    reasons.push(`[OBSERVATION_DELAY] ${observationResult.reason}`);
  }

  const decision: GateDecision = {
    allowed, riskScore, state, reasons, failedRules, passedRules, timestamp,
    lpVerification: (input as any)._lpVerificationResult,
    deployerReputation: (input as any)._deployerReputationResult,
    sellTaxResult: (input as any)._sellTaxResult,
    rugProbability: (input as any)._rugProbabilityResult,
    liquidityStability: (input as any)._liquidityStabilityResult,
    buyerCluster: (input as any)._buyerClusterResult,
    quoteDepth: quoteDepthResult ?? undefined,
    doubleQuoteDeviation,
    holderEntropy: holderEntropyResult?.result,
    volumeAuthenticity: volumeAuthResult ?? undefined,
    walletCluster: walletClusterResult ?? undefined,
    liquidityAging: liquidityAgingResult ?? undefined,
    capitalPreservation: capitalPresResult ?? undefined,
    deployerBehavior: deployerBehaviorResult,
    dynamicCap: dynamicCapResult,
    observationDelay: observationResult,
  };

  const decisionIcon = allowed ? '✅' : (state === 'BLOCKED' ? '🚫' : '👁️');
  logActivity?.({ tokenSymbol: input.tokenSymbol, tokenAddress: input.tokenAddress, level: allowed ? 'success' : (state === 'BLOCKED' ? 'error' : 'skip'), category: 'evaluate', message: `${decisionIcon} ${input.tokenSymbol}: ${state} (Score: ${riskScore}${dynamicCapResult.capped ? ' CAPPED' : ''})`, details: allowed ? `Passed ${passedRules.length}/${ruleChecks.length} rules - ready for execution` : `Failed: ${failedRules.join(', ')}` });

  console.log(`[PreExecutionGate] ${input.tokenSymbol} (${input.tokenAddress.slice(0, 8)}...):`, { allowed, state, riskScore, capped: dynamicCapResult.capped, failedRules, rulesChecked: ruleChecks.length });

  return decision;
}

// =============================================================================
// BATCH + STATE HELPERS
// =============================================================================

export async function batchPreExecutionGate(
  tokens: PreExecutionGateInput[],
  options?: { logActivity?: (entry: GateActivityLogEntry) => void }
): Promise<Array<PreExecutionGateInput & { gateDecision: GateDecision }>> {
  const results: Array<PreExecutionGateInput & { gateDecision: GateDecision }> = [];

  options?.logActivity?.({ tokenSymbol: 'BATCH', tokenAddress: '', level: 'info', category: 'evaluate', message: `🔄 Pre-execution gate: Evaluating ${tokens.length} token(s)`, details: 'Processing in batches of 5...' });

  const batchSize = 5;
  for (let i = 0; i < tokens.length; i += batchSize) {
    const batch = tokens.slice(i, i + batchSize);
    const batchResults = await Promise.allSettled(batch.map(async (token) => ({ ...token, gateDecision: await preExecutionGate(token, options) })));
    for (const result of batchResults) {
      if (result.status === 'fulfilled') results.push(result.value);
    }
  }

  const executable = results.filter(r => r.gateDecision.allowed).length;
  const blocked = results.filter(r => r.gateDecision.state === 'BLOCKED').length;
  const observed = results.filter(r => r.gateDecision.state === 'OBSERVED').length;
  options?.logActivity?.({ tokenSymbol: 'SUMMARY', tokenAddress: '', level: executable > 0 ? 'success' : 'info', category: 'evaluate', message: `📊 Gate complete: ${executable} executable, ${observed} observed, ${blocked} blocked`, details: `Out of ${tokens.length} tokens evaluated` });

  return results;
}

export function filterExecutableTokens(tokensWithDecisions: Array<PreExecutionGateInput & { gateDecision: GateDecision }>): Array<PreExecutionGateInput & { gateDecision: GateDecision }> {
  return tokensWithDecisions.filter(t => t.gateDecision.allowed && t.gateDecision.state === 'EXECUTABLE');
}

export async function updateTokenState(tokenAddress: string, state: 'OBSERVED' | 'EXECUTABLE' | 'BLOCKED', rejectionReason?: string): Promise<void> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const updateData: Record<string, unknown> = { state, updated_at: new Date().toISOString() };
    if (state === 'BLOCKED' && rejectionReason) { updateData.rejection_reason = rejectionReason; updateData.rejected_at = new Date().toISOString(); }
    await supabase.from('token_processing_states').update(updateData).eq('token_address', tokenAddress).eq('user_id', session.user.id);
  } catch (error) { console.error('[UpdateTokenState] Error:', error); }
}

export async function fetchLiquidityThresholds(userId?: string): Promise<{ autoMinUsd: number; manualMinUsd: number }> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const targetUserId = userId || session?.user?.id;
    if (!targetUserId) return _DEFAULT_LIQUIDITY_THRESHOLDS;
    const { data, error } = await supabase.from('risk_settings').select('min_liquidity_auto_usd, min_liquidity_manual_usd').eq('user_id', targetUserId).single();
    if (error || !data) return _DEFAULT_LIQUIDITY_THRESHOLDS;
    return { autoMinUsd: Number(data.min_liquidity_auto_usd) || _DEFAULT_LIQUIDITY_THRESHOLDS.autoMinUsd, manualMinUsd: Number(data.min_liquidity_manual_usd) || _DEFAULT_LIQUIDITY_THRESHOLDS.manualMinUsd };
  } catch { return _DEFAULT_LIQUIDITY_THRESHOLDS; }
}

export function getMinLiquidityForMode(thresholds: { autoMinUsd: number; manualMinUsd: number }, mode: 'auto' | 'manual'): number {
  return mode === 'auto' ? thresholds.autoMinUsd : thresholds.manualMinUsd;
}
