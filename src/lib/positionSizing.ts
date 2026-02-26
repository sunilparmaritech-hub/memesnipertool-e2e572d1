/**
 * Dynamic Position Sizing Engine
 *
 * Scales trade size based on probabilistic risk score.
 * Integrates with pre-execution gate output to compute final SOL amount.
 */

import { positionSizeMultiplier, classifyScore, type TradeClass } from './probabilisticScoring';

export interface PositionSizeInput {
  configuredAmountSol: number;   // User's base trade amount
  riskScore: number;             // 0–100 from gate
  tradeClass?: TradeClass;
  maxPositionSol?: number;       // Optional cap
  minPositionSol?: number;       // Default: 0.01
}

export interface PositionSizeResult {
  finalAmountSol: number;
  multiplier: number;
  configuredAmountSol: number;
  riskScore: number;
  tradeClass: TradeClass;
  reducedBy: number;     // Percentage reduction (0–100)
  reason: string;
}

export function computePositionSize(input: PositionSizeInput): PositionSizeResult {
  const minSol = input.minPositionSol ?? 0.005;
  const tradeClass = input.tradeClass ?? classifyScore(input.riskScore);
  const multiplier = positionSizeMultiplier(input.riskScore);

  let finalAmount = input.configuredAmountSol * multiplier;

  // Apply max cap if configured
  if (input.maxPositionSol && finalAmount > input.maxPositionSol) {
    finalAmount = input.maxPositionSol;
  }

  // Enforce minimum (if trade is allowed at all)
  if (multiplier > 0 && finalAmount < minSol) {
    finalAmount = minSol;
  }

  // If multiplier is 0 (blocked), return 0
  if (multiplier === 0) finalAmount = 0;

  const reducedBy = multiplier > 0
    ? Math.round((1 - multiplier) * 100)
    : 100;

  let reason: string;
  switch (tradeClass) {
    case 'STRONG_AUTO':  reason = `Full size — excellent signal (score: ${input.riskScore})`;   break;
    case 'AUTO':         reason = `Full size — good signal (score: ${input.riskScore})`;         break;
    case 'REDUCED_SIZE': reason = `Reduced to ${Math.round(multiplier * 100)}% — moderate risk (score: ${input.riskScore})`; break;
    case 'MANUAL_ONLY':  reason = `Reduced to ${Math.round(multiplier * 100)}% — high risk, manual only (score: ${input.riskScore})`; break;
    case 'BLOCKED':      reason = `Blocked — risk score too low (score: ${input.riskScore})`;   break;
  }

  return {
    finalAmountSol: Math.round(finalAmount * 1e9) / 1e9, // lamport precision
    multiplier,
    configuredAmountSol: input.configuredAmountSol,
    riskScore: input.riskScore,
    tradeClass,
    reducedBy,
    reason,
  };
}

/**
 * Quick helper: is the trade allowed given the risk score?
 */
export function isTradeAllowed(riskScore: number, executionMode: 'auto' | 'manual'): boolean {
  if (executionMode === 'auto') return riskScore >= 60;
  return riskScore >= 50;
}
