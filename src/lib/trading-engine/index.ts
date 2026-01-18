/**
 * Trading Engine - Modular 3-Stage Solana Sniping
 * 
 * STAGE 1: Strict Raydium Pool Detection (raydium-pool-detector.ts)
 * STAGE 2: Raydium Sniping (raydium-sniper.ts)
 * STAGE 3: Jupiter Trading (jupiter-trader.ts)
 */

// Export all types
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

// Export configuration
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

// Export Stage 1: Raydium Pool Detection (STRICT)
export { 
  detectTradablePool,
  scanForNewRaydiumPools,
  batchValidateTradability,
  type TradablePoolResult,
  type PoolValidationConfig,
} from './raydium-pool-detector';

// Export Stage 1: Legacy Liquidity Detection (now uses strict Raydium detection)
export { detectLiquidity, monitorLiquidity } from './liquidity-detector';

// Export Stage 2: Raydium Sniping
export { executeRaydiumSnipe, getRaydiumPrice, buildRaydiumSwapTransaction } from './raydium-sniper';

// Export Stage 3: Jupiter Trading
export {
  executeJupiterTrade,
  checkJupiterIndex,
  waitForJupiterIndex,
  getJupiterPrice,
  getJupiterRouteInfo,
} from './jupiter-trader';

// Export Controller (Main Entry Points)
export {
  runTradingFlow,
  quickSnipe,
  monitorAndSnipe,
  checkTokenStatus,
  executeExit,
} from './controller';
export type { TradingFlowOptions } from './controller';
