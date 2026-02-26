/**
 * Unified formatting utilities for P&L, percentages, and currency values
 * Use these throughout the app for consistent display
 * 
 * CRITICAL: Financial-grade precision handling
 * - No hidden scaling (/1000 or *1000)
 * - No artificial truncation
 * - Preserves significant digits for small values
 */

import {
  formatPreciseUsd,
  formatPreciseSol,
  formatTokenPrice as formatPrecisePrice,
  type FormatPrecisionOptions,
} from './precision';

/**
 * Format percentage value with adaptive decimal places based on magnitude
 * @param value - The percentage value
 * @param showSign - Whether to show +/- sign (default true)
 * @returns Formatted string like "+12.34%" or "-5.00%"
 */
export function formatPercentage(value: number | null | undefined, showSign = true): string {
  const num = value ?? 0;
  if (!Number.isFinite(num)) return showSign ? '+0.00%' : '0.00%';
  
  const sign = showSign && num >= 0 ? '+' : '';
  const absValue = Math.abs(num);
  
  // Adaptive decimals based on magnitude
  let decimals: number;
  if (absValue >= 1000) {
    decimals = 0;
  } else if (absValue >= 100) {
    decimals = 1;
  } else if (absValue >= 1) {
    decimals = 2;
  } else if (absValue >= 0.01) {
    decimals = 3;
  } else if (absValue > 0) {
    decimals = 4;
  } else {
    decimals = 2;
  }
  
  return `${sign}${num.toFixed(decimals)}%`;
}

/**
 * Format currency value with appropriate precision
 * CRITICAL: Preserves significant digits for small values - no artificial truncation
 * @param value - The dollar value
 * @param showSign - Whether to show +/- sign (default true)
 * @returns Formatted string like "+$12.34" or "-$5.00"
 */
export function formatCurrency(value: number | null | undefined, showSign = true): string {
  return formatPreciseUsd(value, { showSign });
}

/**
 * Calculate P&L dollar value from amount and prices
 * CRITICAL: This bypasses stored entry_value which may have unit inconsistencies
 * @param entryValue - The entry value (may be in SOL or USD - unreliable)
 * @param profitLossPercent - The P&L percentage
 * @param entryPrice - Entry price (entry_price_usd preferred, fallback to entry_price)
 * @param amount - Token amount
 * @param currentPrice - Current token price in USD
 * @returns The calculated P&L dollar value
 */
export function calculatePnLValue(
  entryValue: number | null | undefined,
  profitLossPercent: number | null | undefined,
  entryPrice?: number | null,
  amount?: number | null,
  currentPrice?: number | null
): number {
  // If we have all the data for accurate calculation, use it
  if (entryPrice && amount && currentPrice && entryPrice > 0 && amount > 0) {
    const entryValueCalc = entryPrice * amount;
    const currentValueCalc = currentPrice * amount;
    return currentValueCalc - entryValueCalc;
  }
  
  // Fallback: Use percentage-based calculation if we have entry price and amount
  const pnlPercent = profitLossPercent ?? 0;
  if (entryPrice && amount && entryPrice > 0 && amount > 0) {
    const calculatedEntryValue = entryPrice * amount;
    return calculatedEntryValue * (pnlPercent / 100);
  }
  
  // Last resort: use stored entry_value (may be inaccurate)
  if (entryValue && entryValue > 0) {
    return entryValue * (pnlPercent / 100);
  }
  
  return 0;
}

/**
 * Format price with appropriate precision based on magnitude
 * CRITICAL: Token prices can be extremely small - preserve all significant digits
 * @param value - The price value
 * @returns Formatted string like "$0.00012345" or "$123.45"
 */
export function formatPrice(value: number | null | undefined): string {
  return formatPrecisePrice(value);
}

/**
 * Determine if P&L is positive for styling purposes
 * @param value - The P&L percentage or value
 * @returns true if value >= 0
 */
export function isPositivePnL(value: number | null | undefined): boolean {
  return (value ?? 0) >= 0;
}

/**
 * Get a short address format for display
 * @param address - The full address
 * @returns Short format like "4Abc...1Xyz"
 */
export function shortAddress(address: string | null | undefined): string {
  if (!address || address.length < 10) return address || 'TOKEN';
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}

/**
 * Check if a token name/symbol is a placeholder that should be replaced
 * @param value - The token name or symbol
 * @returns true if it's a placeholder
 */
export function isPlaceholderText(value: string | null | undefined): boolean {
  if (!value) return true;
  const v = value.trim();
  if (!v) return true;
  
  const lower = v.toLowerCase();
  
  // Check for common placeholder patterns
  if (/^(unknown|unknown token|token|\?\?\?|n\/a|null|undefined)$/i.test(lower)) return true;
  
  // Check if it starts with "Token " followed by address-like pattern (with regular dots, ellipsis, or any separator)
  if (/^token\s+[a-z0-9]{4}[….\-_][a-z0-9]{4}$/i.test(v)) return true;
  if (/^token\s+[a-z0-9]{4}/i.test(v) && v.length < 20) return true;
  
  // Check if it's just an address shorthand like "8Jx8…pump" or "27G8…idD4"
  if (/^[a-z0-9]{4}[….\-_][a-z0-9]{4}$/i.test(v)) return true;
  
  // Check if it looks like a Solana address (32-44 chars of base58)
  if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/i.test(v)) return true;
  
  // Check if it ends with common suffixes like "pump" after an ellipsis
  if (/^[a-z0-9]{2,6}[….\-_](pump|sol|token)$/i.test(v)) return true;
  
  return false;
}

/**
 * Get display name for a token, using actual name or fallback to formatted address
 * @param tokenName - The token name from database
 * @param tokenAddress - The token address for fallback
 * @returns The display name
 */
export function getTokenDisplayName(
  tokenName: string | null | undefined, 
  tokenAddress: string
): string {
  if (tokenName && !isPlaceholderText(tokenName)) {
    return tokenName;
  }
  return shortAddress(tokenAddress);
}

/**
 * Get display symbol for a token, using actual symbol or fallback to formatted address
 * @param tokenSymbol - The token symbol from database
 * @param tokenAddress - The token address for fallback
 * @returns The display symbol
 */
export function getTokenDisplaySymbol(
  tokenSymbol: string | null | undefined, 
  tokenAddress: string
): string {
  if (tokenSymbol && !isPlaceholderText(tokenSymbol)) {
    return tokenSymbol;
  }
  return shortAddress(tokenAddress);
}
