
-- Add validation_rule_toggles JSONB column to user_sniper_settings
-- Each key is a rule name, value is boolean (true = enabled, false = disabled)
-- Default: all rules enabled
ALTER TABLE public.user_sniper_settings
ADD COLUMN IF NOT EXISTS validation_rule_toggles jsonb NOT NULL DEFAULT '{
  "TIME_BUFFER": true,
  "LIQUIDITY_REALITY": true,
  "EXECUTABLE_SELL": true,
  "BUYER_POSITION": true,
  "PRICE_SANITY": true,
  "SYMBOL_SPOOFING": true,
  "FREEZE_AUTHORITY": true,
  "LP_INTEGRITY": true,
  "DEPLOYER_REPUTATION": true,
  "HIDDEN_SELL_TAX": true,
  "RUG_PROBABILITY": true,
  "LIQUIDITY_STABILITY": true,
  "BUYER_CLUSTER": true,
  "LP_OWNERSHIP_DISTRIBUTION": true,
  "QUOTE_DEPTH": true,
  "DOUBLE_QUOTE": true,
  "HOLDER_ENTROPY": true,
  "VOLUME_AUTHENTICITY": true,
  "WALLET_CLUSTER": true,
  "LIQUIDITY_AGING": true,
  "CAPITAL_PRESERVATION": true,
  "DEPLOYER_BEHAVIOR": true
}'::jsonb;
