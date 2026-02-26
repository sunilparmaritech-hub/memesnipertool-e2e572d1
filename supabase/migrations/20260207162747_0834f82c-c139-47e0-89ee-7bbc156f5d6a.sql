-- Add missing columns to trade_history for comprehensive logging
ALTER TABLE public.trade_history 
ADD COLUMN IF NOT EXISTS buyer_position integer,
ADD COLUMN IF NOT EXISTS liquidity numeric,
ADD COLUMN IF NOT EXISTS risk_score integer,
ADD COLUMN IF NOT EXISTS entry_price numeric,
ADD COLUMN IF NOT EXISTS exit_price numeric;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_trade_history_user_created 
ON public.trade_history(user_id, created_at DESC);