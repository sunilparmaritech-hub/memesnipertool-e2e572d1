/**
 * Validation Rule Configuration
 * 
 * Defines all pre-execution gate rules with metadata for the settings UI.
 * These toggles control which validation checks run before trade execution.
 */

export type TuningLevel = 'never_disable' | 'safe_to_relax' | 'optional';

export interface ValidationRuleConfig {
  key: string;
  label: string;
  description: string;
  category: 'safety' | 'liquidity' | 'market' | 'advanced';
  critical?: boolean; // If true, show warning when disabling
  tuning: TuningLevel; // Professional tuning recommendation
  tuningNote: string;  // Short explanation for the recommendation
}

export const VALIDATION_RULES: ValidationRuleConfig[] = [
  // Safety category
  {
    key: 'TIME_BUFFER',
    label: 'Time Buffer',
    description: 'Reject tokens younger than 20 seconds to avoid instant execution traps',
    category: 'safety',
    tuning: 'safe_to_relax',
    tuningNote: 'Can disable for faster sniping, but increases exposure to honeypots',
  },
  {
    key: 'FREEZE_AUTHORITY',
    label: 'Freeze Authority',
    description: 'Block tokens where the owner can freeze all transfers',
    category: 'safety',
    critical: true,
    tuning: 'never_disable',
    tuningNote: 'Disabling risks permanent fund lock — owner can freeze your tokens at any time',
  },
  {
    key: 'SYMBOL_SPOOFING',
    label: 'Symbol Spoofing',
    description: 'Detect tokens impersonating official tokens (SOL, USDC, etc.)',
    category: 'safety',
    tuning: 'safe_to_relax',
    tuningNote: 'Low risk to disable — mostly catches copycat tokens with official tickers',
  },
  {
    key: 'PRICE_SANITY',
    label: 'Price Sanity',
    description: 'Block tokens with suspicious price jumps (>50x in <1 minute)',
    category: 'safety',
    tuning: 'safe_to_relax',
    tuningNote: 'Can disable for volatile meme launches, but watch for pump-and-dump setups',
  },
  {
    key: 'RUG_PROBABILITY',
    label: 'Rug Probability',
    description: 'Multi-factor rug probability scoring — blocks scores ≥55',
    category: 'safety',
    critical: true,
    tuning: 'never_disable',
    tuningNote: 'Core safety layer — disabling exposes you to high-probability rug pulls',
  },
  {
    key: 'DEPLOYER_REPUTATION',
    label: 'Deployer Reputation',
    description: 'Check deployer wallet history for known ruggers and serial deployers',
    category: 'safety',
    critical: true,
    tuning: 'never_disable',
    tuningNote: 'Blocks known scammers — disabling lets repeat offenders through',
  },
  {
    key: 'DEPLOYER_BEHAVIOR',
    label: 'Deployer Behavior',
    description: 'Profile deployer wallet patterns for suspicious activity',
    category: 'safety',
    tuning: 'optional',
    tuningNote: 'Can disable in competitive mode — adds latency with moderate protection',
  },

  // Liquidity category
  {
    key: 'LIQUIDITY_REALITY',
    label: 'Min Liquidity',
    description: 'Enforce minimum pool liquidity threshold before trading',
    category: 'liquidity',
    tuning: 'safe_to_relax',
    tuningNote: 'Can lower threshold for early entries, but increases slippage risk',
  },
  {
    key: 'LP_INTEGRITY',
    label: 'LP Integrity',
    description: 'Verify LP tokens are burned/locked with no mint authority',
    category: 'liquidity',
    critical: true,
    tuning: 'never_disable',
    tuningNote: 'Unlocked LP = instant rug pull possible — never disable this',
  },
  {
    key: 'LP_OWNERSHIP_DISTRIBUTION',
    label: 'LP Ownership',
    description: 'Block if single wallet holds >85% of LP tokens',
    category: 'liquidity',
    tuning: 'safe_to_relax',
    tuningNote: 'Can relax for new launches where LP is naturally concentrated',
  },
  {
    key: 'LIQUIDITY_STABILITY',
    label: 'Liquidity Stability',
    description: 'Monitor liquidity for sudden drops or removals',
    category: 'liquidity',
    tuning: 'safe_to_relax',
    tuningNote: 'Safe to disable for speed — post-buy monitor still watches liquidity',
  },
  {
    key: 'LIQUIDITY_AGING',
    label: 'Liquidity Aging',
    description: 'Require liquidity to be stable for a minimum observation window',
    category: 'liquidity',
    tuning: 'optional',
    tuningNote: 'Disable for faster entries — adds 10-120s delay waiting for stability',
  },

  // Market category
  {
    key: 'EXECUTABLE_SELL',
    label: 'Sell Route Check',
    description: 'Verify a Jupiter/Raydium sell route exists before buying',
    category: 'market',
    critical: true,
    tuning: 'never_disable',
    tuningNote: 'Without sell route verification, you cannot exit — risk of stuck positions',
  },
  {
    key: 'BUYER_POSITION',
    label: 'Buyer Position',
    description: 'Validate entry position relative to other buyers',
    category: 'market',
    tuning: 'optional',
    tuningNote: 'Disable for more opportunities — late entries carry higher risk',
  },
  {
    key: 'HIDDEN_SELL_TAX',
    label: 'Hidden Sell Tax',
    description: 'Detect hidden contract-level fees by comparing quote vs simulation',
    category: 'market',
    tuning: 'safe_to_relax',
    tuningNote: 'Can disable if experiencing rate limits — degrades gracefully with penalty',
  },
  {
    key: 'QUOTE_DEPTH',
    label: 'Quote Depth',
    description: 'Validate trade size against available pool depth and slippage',
    category: 'market',
    tuning: 'safe_to_relax',
    tuningNote: 'Safe to disable for small trades (<0.1 SOL) — important for larger positions',
  },
  {
    key: 'DOUBLE_QUOTE',
    label: 'Double Quote',
    description: 'Compare two quotes 2.5s apart to detect manipulation',
    category: 'market',
    tuning: 'optional',
    tuningNote: 'Adds ~3s latency per token — disable for speed in competitive sniping',
  },
  {
    key: 'CAPITAL_PRESERVATION',
    label: 'Capital Preservation',
    description: 'Simulate worst-case exit to ensure capital can be recovered',
    category: 'market',
    tuning: 'safe_to_relax',
    tuningNote: 'Can disable for small positions — important for trades >0.5 SOL',
  },

  // Advanced category
  {
    key: 'BUYER_CLUSTER',
    label: 'Buyer Cluster',
    description: 'Detect coordinated buying from related wallets',
    category: 'advanced',
    tuning: 'optional',
    tuningNote: 'Disable for speed — adds API calls with moderate protection value',
  },
  {
    key: 'HOLDER_ENTROPY',
    label: 'Holder Entropy',
    description: 'Analyze holder distribution — low entropy = concentrated ownership',
    category: 'advanced',
    tuning: 'optional',
    tuningNote: 'Disable for new tokens with naturally few holders',
  },
  {
    key: 'VOLUME_AUTHENTICITY',
    label: 'Volume Authenticity',
    description: 'Detect wash trading and fake volume patterns',
    category: 'advanced',
    tuning: 'optional',
    tuningNote: 'Disable for speed — useful but adds latency analyzing trade history',
  },
  {
    key: 'WALLET_CLUSTER',
    label: 'Wallet Cluster',
    description: '2-layer wallet cluster detection via shared funding sources',
    category: 'advanced',
    tuning: 'optional',
    tuningNote: 'Most expensive check — disable first when optimizing for speed',
  },

  // Meta-rule: data completeness
  {
    key: 'DATA_COMPLETENESS',
    label: 'Data Completeness',
    description: 'Block tokens when too many rules passed only because data was unavailable — prevents scam tokens from exploiting missing data',
    category: 'safety',
    critical: true,
    tuning: 'never_disable',
    tuningNote: 'Core safety layer — disabling lets tokens with no verifiable data through all checks',
  },
];

export type ValidationRuleToggles = Record<string, boolean>;

export const DEFAULT_VALIDATION_TOGGLES: ValidationRuleToggles = Object.fromEntries(
  VALIDATION_RULES.map(r => [r.key, true])
);

export const CATEGORY_LABELS: Record<string, { label: string; icon: string }> = {
  safety: { label: 'Safety & Integrity', icon: '🛡️' },
  liquidity: { label: 'Liquidity Checks', icon: '💧' },
  market: { label: 'Market & Routing', icon: '📊' },
  advanced: { label: 'Advanced Detection', icon: '🔬' },
};
