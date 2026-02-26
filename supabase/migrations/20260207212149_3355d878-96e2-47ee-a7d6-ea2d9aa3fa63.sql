-- Add configurable liquidity thresholds to risk_settings
ALTER TABLE public.risk_settings
ADD COLUMN IF NOT EXISTS min_liquidity_auto_usd numeric DEFAULT 10000,
ADD COLUMN IF NOT EXISTS min_liquidity_manual_usd numeric DEFAULT 5000;

-- Add comment for documentation
COMMENT ON COLUMN public.risk_settings.min_liquidity_auto_usd IS 'Minimum liquidity in USD required for AUTO mode trading';
COMMENT ON COLUMN public.risk_settings.min_liquidity_manual_usd IS 'Minimum liquidity in USD required for MANUAL mode trading';