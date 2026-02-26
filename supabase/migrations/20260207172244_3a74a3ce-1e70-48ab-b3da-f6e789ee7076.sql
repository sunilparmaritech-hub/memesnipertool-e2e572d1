-- Add slippage column to trade_history for comprehensive logging
ALTER TABLE public.trade_history ADD COLUMN IF NOT EXISTS slippage numeric;

-- Add comment for clarity
COMMENT ON COLUMN public.trade_history.slippage IS 'Slippage percentage used for the trade execution';