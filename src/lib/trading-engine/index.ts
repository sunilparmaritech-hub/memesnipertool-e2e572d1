/**
 * Trading Engine Module
 * Modular 3-stage Solana sniping engine
 * 
 * Usage:
 * ```typescript
 * import { 
 *   runTradingFlow, 
 *   quickSnipe, 
 *   checkTokenStatus,
 *   createTradingConfig 
 * } from '@/lib/trading-engine';
 * 
 * // Quick snipe a token
 * const result = await quickSnipe('TokenAddress...', {
 *   walletAddress: 'YourWallet...',
 *   signTransaction: async (tx) => wallet.signAndSend(tx),
 *   config: { buyAmount: 0.5, slippage: 0.1 },
 * });
 * 
 * // Check token status without trading
 * const { liquidity, jupiterStatus } = await checkTokenStatus('TokenAddress...');
 * ```
 */

// Types
export type {
  // Configuration
  TradingConfig,
  RiskFilters,
  
  // Stage 1: Liquidity Detection
  LiquidityInfo,
  LiquidityDetectionResult,
  RiskAssessment,
  
  // Stage 2: Raydium Sniping
  RaydiumSnipeParams,
  RaydiumSnipeResult,
  
  // Stage 3: Jupiter Trading
  TradeMode,
  JupiterTradeParams,
  JupiterTradeResult,
  JupiterIndexStatus,
  
  // Controller
  TradingFlowResult,
  PositionInfo,
  
  // Events
  TradingEvent,
  TradingEventCallback,
  
  // Transactions
  UnsignedTransaction,
  SignedTransactionResult,
} from './types';

// Configuration
export {
  DEFAULT_TRADING_CONFIG,
  DEFAULT_RISK_FILTERS,
  createTradingConfig,
  validateConfig,
  SOL_MINT,
  USDC_MINT,
  API_ENDPOINTS,
  PROGRAM_IDS,
} from './config';

// Stage 1: Liquidity Detection (Raydium-only)
export {
  detectLiquidity,
  monitorLiquidity,
  detectTradablePool,
} from './liquidity-detector';
export type { TradablePoolResult } from './liquidity-detector';

// RPC-Based Pool Validation (NO Raydium HTTP dependency)
export {
  detectTradablePoolRPC,
  waitForPoolReadiness,
  simulateRaydiumSwapRPC,
  simulateSwapWithRetry,
  isPoolReadyForExecution,
} from './rpc-pool-validator';
export type { PoolReadinessResult, SwapSimulationResult as RpcSwapSimulationResult } from './rpc-pool-validator';

// Stage 2: Raydium Sniping
export {
  executeRaydiumSnipe,
  getRaydiumPrice,
  buildRaydiumSwapTransaction,
} from './raydium-sniper';

// Stage 3: Jupiter Trading
export {
  executeJupiterTrade,
  checkJupiterIndex,
  waitForJupiterIndex,
  getJupiterPrice,
  getJupiterRouteInfo,
} from './jupiter-trader';

// Controller (Main Entry Points)
export {
  runTradingFlow,
  quickSnipe,
  monitorAndSnipe,
  checkTokenStatus,
  executeExit,
} from './controller';
export type { TradingFlowOptions } from './controller';

// Pre-Execution Gate (CRITICAL SAFETY LAYER)
export {
  preExecutionGate,
  simulateJupiterSell,
  batchPreExecutionGate,
  filterExecutableTokens,
  updateTokenState,
  fetchLiquidityThresholds,
  getMinLiquidityForMode,
  DEFAULT_LIQUIDITY_THRESHOLDS,
} from '../preExecutionGate';
export type { 
  PreExecutionGateInput, 
  GateDecision, 
  GateRuleResult,
  GateActivityLogEntry,
} from '../preExecutionGate';

// Deployer Reputation (RUG DETECTION)
export {
  checkDeployerReputation,
  calculateReputationScore,
  getDeployerReputation,
  recordTokenDeployment,
  recordRugPull,
  recordSuccessfulToken,
  updateDeployerReputationOnClose,
  loadKnownClusters,
} from '../deployerReputation';
export type {
  DeployerReputationData,
  DeployerCheckResult,
} from '../deployerReputation';

// Liquidity Monitor (REAL-TIME STABILITY CHECK)
export {
  startLiquidityMonitoring,
  addLiquiditySnapshot,
  recordTransaction,
  recordLpWithdrawal,
  stopMonitoring,
  isBeingMonitored,
  getMonitoringResult,
  runFullMonitoringCycle,
  quickLiquidityCheck,
  checkLiquidityStability,
  cleanupExpiredSessions,
  getActiveSessionCount,
} from '../liquidityMonitor';
export type {
  LiquiditySnapshot,
  VolumeByWallet,
  LiquidityMonitorResult,
  MonitoringSession,
} from '../liquidityMonitor';

// SOL Delta Parser (DUAL-RPC VALIDATION + INSTITUTIONAL GRADE)
export {
  parseSolDelta,
  verifyDeltaWithBalance,
  shouldBlockPnlCalculation,
  getPreTradeBalanceSnapshot,
  hasIntegrityWarnings,
  getIntegritySummary,
} from '../solDeltaParser';
export type {
  SolDeltaResult,
  DeltaExtractionInput,
  IntegrityFlags,
  DeltaBreakdown,
} from '../solDeltaParser';

// Sell Tax Detector (HIDDEN TAX DETECTION)
export {
  detectHiddenSellTax,
  checkSellTax,
  batchCheckSellTax,
  HIDDEN_TAX_THRESHOLD,
  HIGH_TAX_THRESHOLD,
  MODERATE_TAX_THRESHOLD,
} from '../sellTaxDetector';
export type {
  SellTaxDetectionResult,
  SellTaxCheckInput,
} from '../sellTaxDetector';

// Rug Probability Calculator (MULTI-FACTOR RUG DETECTION)
export {
  calculateRugProbability,
  quickRugCheck,
  checkRugProbability,
  RUG_PROBABILITY_BLOCK_THRESHOLD,
  RUG_PROBABILITY_WEIGHTS,
  LIQUIDITY_FDV_THRESHOLDS,
  HOLDER_THRESHOLDS,
} from '../rugProbability';
export type {
  RugProbabilityInput,
  RugFactorBreakdown,
  RugProbabilityResult,
} from '../rugProbability';

// Holder Entropy Calculator (DISTRIBUTION ANALYSIS)
export {
  calculateHolderEntropy,
  checkHolderEntropy,
  calculateEntropyFromBalances,
  formatEntropyScore,
  getEntropyRiskColor,
  calculateShannonEntropy,
  calculateGiniCoefficient,
  calculateHerfindahlIndex,
  ENTROPY_THRESHOLDS,
  CONCENTRATION_THRESHOLDS,
} from '../holderEntropy';
export type {
  HolderData,
  EntropyResult,
  EntropyDetails,
} from '../holderEntropy';
