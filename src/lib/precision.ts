/**
 * Financial-Grade Precision Utilities
 * 
 * Provides high-precision math operations for portfolio valuations.
 * All internal calculations use full precision - formatting only at UI layer.
 */

// ============================================================================
// Constants
// ============================================================================

/** Lamports per SOL (10^9) */
export const LAMPORTS_PER_SOL = 1_000_000_000;

/** Default token decimals for SPL tokens */
export const DEFAULT_SPL_DECIMALS = 9;

/** Maximum precision for display before switching to scientific notation */
const MAX_DISPLAY_DECIMALS = 12;

/** Threshold below which scientific notation is used */
const SCIENTIFIC_NOTATION_THRESHOLD = 1e-10;

// ============================================================================
// Core Precision Functions
// ============================================================================

/**
 * Convert raw token amount to normalized balance using token decimals.
 * NO ROUNDING - returns full precision.
 * 
 * @param rawAmount - Raw token amount (e.g., from RPC)
 * @param decimals - Token decimals (fetched from mint metadata)
 * @returns Normalized balance with full precision
 */
export function normalizeTokenBalance(
  rawAmount: number | string | bigint,
  decimals: number
): number {
  const raw = typeof rawAmount === 'bigint' 
    ? Number(rawAmount) 
    : typeof rawAmount === 'string' 
      ? parseFloat(rawAmount) 
      : rawAmount;
  
  if (!Number.isFinite(raw) || raw < 0) return 0;
  if (decimals < 0 || decimals > 30) return raw; // Safety bounds
  
  return raw / Math.pow(10, decimals);
}

/**
 * Convert lamports to SOL.
 * NO ROUNDING - returns full precision.
 * 
 * @param lamports - Amount in lamports
 * @returns Amount in SOL with full precision
 */
export function lamportsToSol(lamports: number | bigint): number {
  const raw = typeof lamports === 'bigint' ? Number(lamports) : lamports;
  if (!Number.isFinite(raw)) return 0;
  return raw / LAMPORTS_PER_SOL;
}

/**
 * Convert SOL to lamports.
 * Uses rounding for transaction purposes.
 * 
 * @param sol - Amount in SOL
 * @returns Amount in lamports (rounded)
 */
export function solToLamports(sol: number): number {
  if (!Number.isFinite(sol) || sol < 0) return 0;
  return Math.round(sol * LAMPORTS_PER_SOL);
}

// ============================================================================
// Open Value Calculation
// ============================================================================

export interface TokenHolding {
  /** Token mint address */
  mint: string;
  /** Normalized token balance (already scaled by decimals) */
  balance: number;
  /** Current live price in USD (from validated swap route) */
  currentPriceUsd: number;
  /** Token decimals (for reference) */
  decimals?: number;
}

/**
 * Calculate the open value of a single token holding.
 * Open Value = normalized balance × current live price
 * 
 * NO ROUNDING - returns full precision.
 * 
 * @param holding - Token holding with balance and current price
 * @returns Open value in USD
 */
export function calculateTokenOpenValue(holding: TokenHolding): number {
  if (!Number.isFinite(holding.balance) || holding.balance <= 0) return 0;
  if (!Number.isFinite(holding.currentPriceUsd) || holding.currentPriceUsd <= 0) return 0;
  
  return holding.balance * holding.currentPriceUsd;
}

/**
 * Calculate the total open value of a portfolio.
 * NO ROUNDING before summation - returns full precision.
 * 
 * @param holdings - Array of token holdings
 * @returns Total open value in USD
 */
export function calculatePortfolioOpenValue(holdings: TokenHolding[]): number {
  return holdings.reduce((total, holding) => {
    return total + calculateTokenOpenValue(holding);
  }, 0);
}

// ============================================================================
// P&L Calculations
// ============================================================================

export interface PositionForPnL {
  /** Normalized token amount */
  amount: number;
  /** Entry price in USD */
  entryPriceUsd: number;
  /** Current price in USD */
  currentPriceUsd: number;
}

/**
 * Calculate unrealized P&L for a position.
 * P&L = (currentPrice - entryPrice) × amount
 * 
 * NO ROUNDING - returns full precision.
 * 
 * @param position - Position data with prices and amount
 * @returns Unrealized P&L in USD
 */
export function calculateUnrealizedPnL(position: PositionForPnL): number {
  if (!Number.isFinite(position.amount) || position.amount <= 0) return 0;
  if (!Number.isFinite(position.entryPriceUsd) || position.entryPriceUsd <= 0) return 0;
  if (!Number.isFinite(position.currentPriceUsd) || position.currentPriceUsd < 0) return 0;
  
  return (position.currentPriceUsd - position.entryPriceUsd) * position.amount;
}

/**
 * Calculate P&L percentage for a position.
 * P&L% = ((currentPrice - entryPrice) / entryPrice) × 100
 * 
 * @param entryPrice - Entry price
 * @param currentPrice - Current price
 * @returns P&L percentage
 */
export function calculatePnLPercent(entryPrice: number, currentPrice: number): number {
  if (!Number.isFinite(entryPrice) || entryPrice <= 0) return 0;
  if (!Number.isFinite(currentPrice) || currentPrice < 0) return 0;
  
  return ((currentPrice - entryPrice) / entryPrice) * 100;
}

/**
 * Calculate entry value for a position.
 * Entry Value = amount × entryPriceUsd
 * 
 * @param amount - Token amount
 * @param entryPriceUsd - Entry price in USD
 * @returns Entry value in USD
 */
export function calculateEntryValue(amount: number, entryPriceUsd: number): number {
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  if (!Number.isFinite(entryPriceUsd) || entryPriceUsd <= 0) return 0;
  
  return amount * entryPriceUsd;
}

/**
 * Calculate current value for a position.
 * Current Value = amount × currentPriceUsd
 * 
 * @param amount - Token amount
 * @param currentPriceUsd - Current price in USD
 * @returns Current value in USD
 */
export function calculateCurrentValue(amount: number, currentPriceUsd: number): number {
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  if (!Number.isFinite(currentPriceUsd) || currentPriceUsd < 0) return 0;
  
  return amount * currentPriceUsd;
}

// ============================================================================
// Display Formatting (UI Layer Only)
// ============================================================================

export interface FormatPrecisionOptions {
  /** Whether to show +/- sign */
  showSign?: boolean;
  /** Minimum significant digits to show */
  minSignificantDigits?: number;
  /** Force a specific number of decimals (overrides auto) */
  forceDecimals?: number;
}

/**
 * Format a number with appropriate precision based on magnitude.
 * CRITICAL: Preserves significant digits for small values.
 * 
 * Rules:
 * - If value >= 1: show up to 6 decimal places
 * - If value < 1: show up to 10 decimal places (or enough for significant digits)
 * - If value < 1e-10: use scientific notation
 * - Never truncate to 0.00 if value > 0
 * 
 * @param value - The number to format
 * @param options - Formatting options
 * @returns Formatted string
 */
export function formatPreciseNumber(
  value: number | null | undefined,
  options: FormatPrecisionOptions = {}
): string {
  const { showSign = false, minSignificantDigits = 2 } = options;
  
  const num = value ?? 0;
  if (!Number.isFinite(num)) return showSign ? '+0' : '0';
  
  const sign = showSign && num >= 0 ? '+' : '';
  const absValue = Math.abs(num);
  
  // Handle zero
  if (absValue === 0) {
    return showSign ? '+0' : '0';
  }
  
  // Use scientific notation for extremely small values
  if (absValue < SCIENTIFIC_NOTATION_THRESHOLD) {
    return `${sign}${num.toExponential(minSignificantDigits)}`;
  }
  
  // Calculate decimal places needed for significant digits
  let decimals: number;
  
  if (absValue >= 1000000) {
    decimals = 0;
  } else if (absValue >= 1000) {
    decimals = 2;
  } else if (absValue >= 1) {
    decimals = 6;
  } else {
    // For values < 1, calculate decimals needed for significant digits
    // Find the first significant digit position
    const logValue = Math.floor(Math.log10(absValue));
    decimals = Math.min(-logValue + minSignificantDigits, MAX_DISPLAY_DECIMALS);
  }
  
  // Apply forced decimals if specified
  if (options.forceDecimals !== undefined) {
    decimals = options.forceDecimals;
  }
  
  const formatted = num.toFixed(decimals);
  
  // Remove trailing zeros for cleaner display (but keep at least 2 after decimal)
  const trimmed = formatted.replace(/(\.\d{2,}?)0+$/, '$1');
  
  return `${sign}${trimmed}`;
}

/**
 * Format a USD value with appropriate precision.
 * CRITICAL: Preserves significant digits for small values.
 * 
 * @param value - USD value
 * @param options - Formatting options
 * @returns Formatted USD string (e.g., "$0.00012345" or "$123.45")
 */
export function formatPreciseUsd(
  value: number | null | undefined,
  options: FormatPrecisionOptions = {}
): string {
  const { showSign = false } = options;
  
  const num = value ?? 0;
  if (!Number.isFinite(num)) return showSign ? '+$0' : '$0';
  
  const sign = showSign && num >= 0 ? '+' : '';
  const absValue = Math.abs(num);
  
  // Handle zero
  if (absValue === 0) {
    return showSign ? '+$0.00' : '$0.00';
  }
  
  // Use scientific notation for extremely small values
  if (absValue < SCIENTIFIC_NOTATION_THRESHOLD) {
    return `${sign}$${num.toExponential(2)}`;
  }
  
  // CRITICAL: Show exact values up to $10M to avoid confusion
  // Only use K/M suffix for very large amounts (>$100K)
  if (absValue >= 1000000) {
    return `${sign}$${(num / 1000000).toFixed(2)}M`;
  }
  if (absValue >= 100000) {
    return `${sign}$${(num / 1000).toFixed(1)}K`;
  }
  // Show exact amounts below $100K - NO scaling
  if (absValue >= 1000) {
    return `${sign}$${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  
  // Format based on magnitude
  if (absValue >= 100) {
    return `${sign}$${num.toFixed(2)}`;
  }
  if (absValue >= 1) {
    return `${sign}$${num.toFixed(4)}`;
  }
  if (absValue >= 0.01) {
    return `${sign}$${num.toFixed(6)}`;
  }
  if (absValue >= 0.0001) {
    return `${sign}$${num.toFixed(8)}`;
  }
  
  // Very small values: show up to 10 decimals
  return `${sign}$${num.toFixed(10).replace(/0+$/, '')}`;
}

/**
 * Format a SOL value with appropriate precision.
 * CRITICAL: Preserves significant digits for small values.
 * 
 * @param value - SOL value
 * @param options - Formatting options
 * @returns Formatted SOL string (e.g., "0.00012345 SOL" or "123.45 SOL")
 */
export function formatPreciseSol(
  value: number | null | undefined,
  options: FormatPrecisionOptions = {}
): string {
  const { showSign = false } = options;
  
  const num = value ?? 0;
  if (!Number.isFinite(num)) return showSign ? '+0 SOL' : '0 SOL';
  
  const sign = showSign && num >= 0 ? '+' : '';
  const absValue = Math.abs(num);
  
  // Handle zero
  if (absValue === 0) {
    return showSign ? '+0.00 SOL' : '0.00 SOL';
  }
  
  // Use scientific notation for extremely small values
  if (absValue < SCIENTIFIC_NOTATION_THRESHOLD) {
    return `${sign}${num.toExponential(2)} SOL`;
  }
  
  // Format based on magnitude
  if (absValue >= 10000) {
    return `${sign}${(num).toFixed(1)} SOL`;
  }
  if (absValue >= 1000) {
    return `${sign}${num.toFixed(2)} SOL`;
  }
  if (absValue >= 100) {
    return `${sign}${num.toFixed(3)} SOL`;
  }
  if (absValue >= 1) {
    return `${sign}${num.toFixed(4)} SOL`;
  }
  if (absValue >= 0.001) {
    return `${sign}${num.toFixed(6)} SOL`;
  }
  if (absValue >= 0.000001) {
    return `${sign}${num.toFixed(9)} SOL`;
  }
  
  // Very small values: show full precision
  return `${sign}${num.toFixed(12).replace(/0+$/, '')} SOL`;
}

/**
 * Format a token price with appropriate precision.
 * CRITICAL: Token prices can be extremely small - preserve all significant digits.
 * 
 * @param value - Price value
 * @returns Formatted price string (e.g., "$0.00000123" or "$1.2345")
 */
export function formatTokenPrice(value: number | null | undefined): string {
  const num = value ?? 0;
  if (!Number.isFinite(num) || num === 0) return '$0.00';
  
  const absValue = Math.abs(num);
  
  // Scientific notation for extremely small values
  if (absValue < 1e-12) {
    return `$${num.toExponential(2)}`;
  }
  
  // Determine precision based on magnitude
  if (absValue >= 1000) {
    return `$${num.toFixed(2)}`;
  }
  if (absValue >= 100) {
    return `$${num.toFixed(3)}`;
  }
  if (absValue >= 1) {
    return `$${num.toFixed(4)}`;
  }
  if (absValue >= 0.01) {
    return `$${num.toFixed(6)}`;
  }
  if (absValue >= 0.0001) {
    return `$${num.toFixed(8)}`;
  }
  if (absValue >= 0.000001) {
    return `$${num.toFixed(10)}`;
  }
  
  // Very small: up to 12 decimals, strip trailing zeros
  return `$${num.toFixed(12).replace(/0+$/, '').replace(/\.$/, '')}`;
}

// ============================================================================
// Validation Utilities
// ============================================================================

/**
 * Check if a value appears to have scaling errors.
 * Detects common ×1000 or ÷1000 distortions.
 * 
 * @param value - The value to check
 * @param expectedRange - Expected range [min, max]
 * @returns True if value looks distorted
 */
export function detectScalingError(
  value: number,
  expectedRange: [number, number]
): { hasError: boolean; likelyFactor?: number } {
  const [min, max] = expectedRange;
  
  if (value >= min && value <= max) {
    return { hasError: false };
  }
  
  // Check if ÷1000 would bring into range
  if (value / 1000 >= min && value / 1000 <= max) {
    return { hasError: true, likelyFactor: 1000 };
  }
  
  // Check if ×1000 would bring into range
  if (value * 1000 >= min && value * 1000 <= max) {
    return { hasError: true, likelyFactor: 0.001 };
  }
  
  return { hasError: false };
}

/**
 * Validate that portfolio values are internally consistent.
 * 
 * @param openValue - Calculated open value
 * @param entryValue - Total entry value
 * @param unrealizedPnL - Calculated unrealized P&L
 * @returns Validation result
 */
export function validatePortfolioConsistency(
  openValue: number,
  entryValue: number,
  unrealizedPnL: number
): { isValid: boolean; discrepancy?: number; message?: string } {
  // Open Value should equal Entry Value + Unrealized P&L
  const expectedOpenValue = entryValue + unrealizedPnL;
  const discrepancy = Math.abs(openValue - expectedOpenValue);
  
  // Allow for floating point imprecision (0.01% tolerance)
  const tolerance = Math.max(openValue, entryValue) * 0.0001;
  
  if (discrepancy > tolerance) {
    return {
      isValid: false,
      discrepancy,
      message: `Open Value (${openValue.toFixed(6)}) != Entry Value (${entryValue.toFixed(6)}) + P&L (${unrealizedPnL.toFixed(6)})`
    };
  }
  
  return { isValid: true };
}
