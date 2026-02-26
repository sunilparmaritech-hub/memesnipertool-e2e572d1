/**
 * Probabilistic Risk-Adjusted Scoring Engine
 *
 * Converts the 23-rule binary engine into a weighted probabilistic model.
 * Five categories with configurable weights produce a composite risk score 0–100.
 * Score determines trade class and position sizing.
 */

// ─── Category weights (admin-configurable via admin_settings) ─────────────
export interface CategoryWeights {
  structural_safety: number;   // 35%
  liquidity_health: number;    // 20%
  deployer_risk: number;       // 15%
  market_authenticity: number; // 15%
  market_positioning: number;  // 15%
}

export const DEFAULT_CATEGORY_WEIGHTS: CategoryWeights = {
  structural_safety:   0.35,
  liquidity_health:    0.20,
  deployer_risk:       0.15,
  market_authenticity: 0.15,
  market_positioning:  0.15,
};

// Rule → category mapping
export const RULE_CATEGORY_MAP: Record<string, keyof CategoryWeights> = {
  FREEZE_AUTHORITY:        'structural_safety',
  EXECUTABLE_SELL:         'structural_safety',
  LP_INTEGRITY:            'structural_safety',
  HIDDEN_SELL_TAX:         'structural_safety',
  DATA_COMPLETENESS:       'structural_safety',

  LIQUIDITY_REALITY:       'liquidity_health',
  LIQUIDITY_STABILITY:     'liquidity_health',
  QUOTE_DEPTH:             'liquidity_health',
  CAPITAL_PRESERVATION:    'liquidity_health',
  LIQUIDITY_AGING:         'liquidity_health',

  DEPLOYER_REPUTATION:     'deployer_risk',
  DEPLOYER_BEHAVIOR:       'deployer_risk',
  RUG_PROBABILITY:         'deployer_risk',

  HOLDER_ENTROPY:          'market_authenticity',
  VOLUME_AUTHENTICITY:     'market_authenticity',
  BUYER_CLUSTER:           'market_authenticity',
  WALLET_CLUSTER:          'market_authenticity',

  BUYER_POSITION:          'market_positioning',
  PRICE_SANITY:            'market_positioning',
  SYMBOL_SPOOFING:         'market_positioning',
  TIME_BUFFER:             'market_positioning',
  DOUBLE_QUOTE:            'market_positioning',
  LP_OWNERSHIP_DISTRIBUTION: 'market_positioning',
};

// ─── Trade classification ─────────────────────────────────────────────────
export type TradeClass =
  | 'STRONG_AUTO'    // 90–100
  | 'AUTO'           // 75–89
  | 'REDUCED_SIZE'   // 60–74
  | 'MANUAL_ONLY'    // 50–59
  | 'BLOCKED';       // <50

export function classifyScore(score: number): TradeClass {
  if (score >= 90) return 'STRONG_AUTO';
  if (score >= 75) return 'AUTO';
  if (score >= 60) return 'REDUCED_SIZE';
  if (score >= 50) return 'MANUAL_ONLY';
  return 'BLOCKED';
}

// ─── Position sizing ──────────────────────────────────────────────────────
/** Returns a multiplier 0–1 to apply to configured trade size */
export function positionSizeMultiplier(score: number): number {
  if (score >= 90) return 1.0;
  if (score >= 80) return 0.75;
  if (score >= 70) return 0.50;
  if (score >= 60) return 0.30;
  return 0;
}

// ─── Data confidence scoring ──────────────────────────────────────────────
export interface ConfidenceResult {
  score: number;        // 0–100
  validated: number;
  total: number;
  missingRules: string[];
  action: 'BLOCK' | 'REDUCE' | 'NORMAL';
}

const CAUTION_PHRASES = [
  'unknown', 'unavailable', 'proceeding with caution', 'not provided',
  'skipped', 'no data', 'data unavailable', 'insufficient',
  'unable to verify', 'failed - proceeding',
];

export function computeConfidenceScore(reasons: string[], totalRules: number): ConfidenceResult {
  let missingCount = 0;
  const missingRules: string[] = [];

  for (const reason of reasons) {
    const lower = reason.toLowerCase();
    if (CAUTION_PHRASES.some(p => lower.includes(p))) {
      missingCount++;
      const match = reason.match(/\[([A-Z_]+)\]/);
      if (match) missingRules.push(match[1]);
    }
  }

  const validated = totalRules - missingCount;
  const score = totalRules > 0 ? Math.round((validated / totalRules) * 100) : 100;

  let action: ConfidenceResult['action'];
  if (score < 65) action = 'BLOCK';
  else if (score < 80) action = 'REDUCE';
  else action = 'NORMAL';

  return { score, validated, total: totalRules, missingRules, action };
}

// ─── Age-adaptive rule relaxation ────────────────────────────────────────
export interface AgeAdaptiveConfig {
  relaxHolderEntropy: boolean;
  relaxVolumeAuthenticity: boolean;
  relaxBuyerCluster: boolean;
  relaxWalletCluster: boolean;
  strictLpIntegrity: boolean;
  strictSellRoute: boolean;
  strictFreeze: boolean;
  preventMatureTokens: boolean;
}

export function getAgeAdaptiveConfig(tokenAgeSeconds?: number): AgeAdaptiveConfig {
  if (!tokenAgeSeconds) {
    // Unknown age — use moderate settings
    return {
      relaxHolderEntropy: false,
      relaxVolumeAuthenticity: false,
      relaxBuyerCluster: false,
      relaxWalletCluster: false,
      strictLpIntegrity: true,
      strictSellRoute: true,
      strictFreeze: true,
      preventMatureTokens: false,
    };
  }

  const ageMinutes = tokenAgeSeconds / 60;

  if (ageMinutes < 2) {
    // Very new token — relax behavioral checks, focus on structural
    return {
      relaxHolderEntropy: true,
      relaxVolumeAuthenticity: true,
      relaxBuyerCluster: true,
      relaxWalletCluster: true,
      strictLpIntegrity: true,
      strictSellRoute: true,
      strictFreeze: true,
      preventMatureTokens: false,
    };
  }

  if (ageMinutes < 30) {
    // Recent token — enable volume and entropy checks
    return {
      relaxHolderEntropy: false,
      relaxVolumeAuthenticity: false,
      relaxBuyerCluster: false,
      relaxWalletCluster: false,
      strictLpIntegrity: true,
      strictSellRoute: true,
      strictFreeze: true,
      preventMatureTokens: false,
    };
  }

  // Mature token (>30min) — full validation, prevent sniper entry
  return {
    relaxHolderEntropy: false,
    relaxVolumeAuthenticity: false,
    relaxBuyerCluster: false,
    relaxWalletCluster: false,
    strictLpIntegrity: true,
    strictSellRoute: true,
    strictFreeze: true,
    preventMatureTokens: ageMinutes > 60, // Block if >60min old
  };
}

// ─── Category score breakdown ─────────────────────────────────────────────
export interface CategoryBreakdown {
  structural_safety: { score: number; rules: string[]; weight: number };
  liquidity_health: { score: number; rules: string[]; weight: number };
  deployer_risk: { score: number; rules: string[]; weight: number };
  market_authenticity: { score: number; rules: string[]; weight: number };
  market_positioning: { score: number; rules: string[]; weight: number };
}

export interface ProbabilisticDecision {
  compositeScore: number;           // 0–100
  tradeClass: TradeClass;
  positionMultiplier: number;       // 0–1
  confidence: ConfidenceResult;
  categoryBreakdown: CategoryBreakdown;
  ageAdaptive: AgeAdaptiveConfig;
  killSwitchTriggered: boolean;
  killSwitchReason?: string;
  rugThresholdAdjusted: boolean;    // True if rug score 55–69 (reduced size)
}

/**
 * Kill-switch rules — always hard block regardless of score
 */
const KILL_SWITCH_RULES = new Set([
  'FREEZE_AUTHORITY',   // hasFreezeAuthority = true
  'EXECUTABLE_SELL',    // no sell route confirmed
  'LP_INTEGRITY',       // LP not locked
  'RUG_PROBABILITY',    // rug >= 70
  'DATA_COMPLETENESS',  // severe data gap
  'DEPLOYER_BEHAVIOR',  // hard block deployer
]);

/**
 * Compute the full probabilistic decision from rule results
 */
export function computeProbabilisticDecision(params: {
  ruleResults: Array<{ rule: string; passed: boolean; penalty: number; isKillSwitch?: boolean }>;
  reasons: string[];
  baseScore: number;
  tokenAgeSeconds?: number;
  weights?: CategoryWeights;
  rugProbability?: number;
}): ProbabilisticDecision {
  const weights = params.weights ?? DEFAULT_CATEGORY_WEIGHTS;
  const ageAdaptive = getAgeAdaptiveConfig(params.tokenAgeSeconds);

  // ── Check kill switches ─────────────────────────────────────────────
  let killSwitchTriggered = false;
  let killSwitchReason: string | undefined;

  for (const r of params.ruleResults) {
    if (!r.passed && (r.isKillSwitch || KILL_SWITCH_RULES.has(r.rule))) {
      killSwitchTriggered = true;
      killSwitchReason = r.rule;
      break;
    }
  }

  // ── Rug probability adjusted threshold ─────────────────────────────
  let rugThresholdAdjusted = false;
  if (params.rugProbability !== undefined) {
    if (params.rugProbability >= 70) {
      killSwitchTriggered = true;
      killSwitchReason = 'RUG_PROBABILITY_HARD_BLOCK';
    } else if (params.rugProbability >= 55) {
      // 55–69: reduce size but allow
      rugThresholdAdjusted = true;
    }
  }

  // ── Category scoring ────────────────────────────────────────────────
  const categoryScores: Record<keyof CategoryWeights, { total: number; count: number; rules: string[] }> = {
    structural_safety:   { total: 0, count: 0, rules: [] },
    liquidity_health:    { total: 0, count: 0, rules: [] },
    deployer_risk:       { total: 0, count: 0, rules: [] },
    market_authenticity: { total: 0, count: 0, rules: [] },
    market_positioning:  { total: 0, count: 0, rules: [] },
  };

  for (const r of params.ruleResults) {
    const cat = RULE_CATEGORY_MAP[r.rule];
    if (!cat) continue;

    // Age-adaptive: relax certain rules for very new tokens
    let effectivePenalty = r.penalty;
    if (ageAdaptive.relaxHolderEntropy && r.rule === 'HOLDER_ENTROPY') effectivePenalty = Math.min(effectivePenalty, 5);
    if (ageAdaptive.relaxVolumeAuthenticity && r.rule === 'VOLUME_AUTHENTICITY') effectivePenalty = Math.min(effectivePenalty, 5);
    if (ageAdaptive.relaxBuyerCluster && r.rule === 'BUYER_CLUSTER') effectivePenalty = Math.min(effectivePenalty, 5);
    if (ageAdaptive.relaxWalletCluster && r.rule === 'WALLET_CLUSTER') effectivePenalty = Math.min(effectivePenalty, 5);

    // Category contribution: start at 100, subtract penalty
    const contribution = Math.max(0, 100 - effectivePenalty);
    categoryScores[cat].total += contribution;
    categoryScores[cat].count++;
    categoryScores[cat].rules.push(r.rule);
  }

  // Compute category averages
  const breakdown: CategoryBreakdown = {} as CategoryBreakdown;
  let compositeScore = 0;

  for (const [cat, data] of Object.entries(categoryScores) as Array<[keyof CategoryWeights, typeof categoryScores[keyof CategoryWeights]]>) {
    const avg = data.count > 0 ? data.total / data.count : 100;
    (breakdown as any)[cat] = { score: Math.round(avg), rules: data.rules, weight: weights[cat] };
    compositeScore += avg * weights[cat];
  }

  compositeScore = Math.max(0, Math.min(100, Math.round(compositeScore)));

  // ── Confidence scoring ──────────────────────────────────────────────
  const confidence = computeConfidenceScore(params.reasons, params.ruleResults.length);

  // Apply confidence reduction to score
  if (confidence.action === 'REDUCE') {
    compositeScore = Math.round(compositeScore * 0.85);
  } else if (confidence.action === 'BLOCK') {
    killSwitchTriggered = true;
    killSwitchReason = killSwitchReason ?? 'LOW_DATA_CONFIDENCE';
  }

  // ── Rug reduced-size penalty ─────────────────────────────────────────
  if (rugThresholdAdjusted) {
    compositeScore = Math.round(compositeScore * 0.75);
  }

  // ── Age: prevent mature token sniping ───────────────────────────────
  if (ageAdaptive.preventMatureTokens && !killSwitchTriggered) {
    killSwitchTriggered = true;
    killSwitchReason = 'TOKEN_TOO_OLD_FOR_SNIPER';
  }

  const tradeClass = killSwitchTriggered ? 'BLOCKED' : classifyScore(compositeScore);
  const positionMultiplier = killSwitchTriggered ? 0 : positionSizeMultiplier(compositeScore);

  return {
    compositeScore,
    tradeClass,
    positionMultiplier,
    confidence,
    categoryBreakdown: breakdown,
    ageAdaptive,
    killSwitchTriggered,
    killSwitchReason,
    rugThresholdAdjusted,
  };
}

// ─── Helpers for UI ───────────────────────────────────────────────────────
export function tradeClassLabel(tc: TradeClass): string {
  switch (tc) {
    case 'STRONG_AUTO': return 'Strong Auto Trade';
    case 'AUTO':        return 'Auto Trade';
    case 'REDUCED_SIZE': return 'Reduced Size';
    case 'MANUAL_ONLY': return 'Manual Only';
    case 'BLOCKED':     return 'Blocked';
  }
}

export function tradeClassColor(tc: TradeClass): string {
  switch (tc) {
    case 'STRONG_AUTO': return 'text-success';
    case 'AUTO':        return 'text-success';
    case 'REDUCED_SIZE': return 'text-warning';
    case 'MANUAL_ONLY': return 'text-yellow-400';
    case 'BLOCKED':     return 'text-destructive';
  }
}

export function riskScoreColor(score: number): string {
  if (score >= 75) return 'text-success';
  if (score >= 60) return 'text-warning';
  if (score >= 50) return 'text-yellow-400';
  return 'text-destructive';
}

export function riskScoreLabel(score: number): string {
  if (score >= 90) return 'Excellent';
  if (score >= 75) return 'Good';
  if (score >= 60) return 'Moderate';
  if (score >= 50) return 'Risky';
  return 'Dangerous';
}
