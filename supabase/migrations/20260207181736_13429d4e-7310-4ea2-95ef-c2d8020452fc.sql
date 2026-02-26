-- PHASE 1: Add new semantic columns for transaction integrity
-- These columns will store the ACTUAL on-chain SOL delta as source of truth

-- Add sol_spent (for BUY: actual SOL deducted from wallet)
ALTER TABLE public.trade_history 
ADD COLUMN IF NOT EXISTS sol_spent numeric DEFAULT NULL;

-- Add sol_received (for SELL: actual SOL credited to wallet)
ALTER TABLE public.trade_history 
ADD COLUMN IF NOT EXISTS sol_received numeric DEFAULT NULL;

-- Add token_amount column for actual token delta
ALTER TABLE public.trade_history 
ADD COLUMN IF NOT EXISTS token_amount numeric DEFAULT NULL;

-- Add realized_pnl_sol for SOL-based P&L (only valid for SELL transactions)
ALTER TABLE public.trade_history 
ADD COLUMN IF NOT EXISTS realized_pnl_sol numeric DEFAULT NULL;

-- Add roi_percent for ROI (only valid for completed SELL transactions)
ALTER TABLE public.trade_history 
ADD COLUMN IF NOT EXISTS roi_percent numeric DEFAULT NULL;

-- Add sol_balance_after for wallet reconciliation
ALTER TABLE public.trade_history 
ADD COLUMN IF NOT EXISTS sol_balance_after numeric DEFAULT NULL;

-- Add data_source to track where the values came from
ALTER TABLE public.trade_history 
ADD COLUMN IF NOT EXISTS data_source text DEFAULT 'legacy';

-- Add is_corrupted flag for data integrity
ALTER TABLE public.trade_history 
ADD COLUMN IF NOT EXISTS is_corrupted boolean DEFAULT false;

-- Add corruption_reason for audit trail
ALTER TABLE public.trade_history 
ADD COLUMN IF NOT EXISTS corruption_reason text DEFAULT NULL;

-- Add matched_buy_tx_hash for FIFO matching
ALTER TABLE public.trade_history 
ADD COLUMN IF NOT EXISTS matched_buy_tx_hash text DEFAULT NULL;

-- Create index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_trade_history_token_type 
ON public.trade_history(token_address, trade_type);

CREATE INDEX IF NOT EXISTS idx_trade_history_user_created 
ON public.trade_history(user_id, created_at DESC);

-- Add comment explaining the new schema
COMMENT ON COLUMN public.trade_history.sol_spent IS 'For BUY: actual SOL deducted. For SELL: 0. Source of truth for P&L.';
COMMENT ON COLUMN public.trade_history.sol_received IS 'For SELL: actual SOL credited. For BUY: 0. Source of truth for P&L.';
COMMENT ON COLUMN public.trade_history.realized_pnl_sol IS 'SELL only: solReceived - totalSolSpentForToken. Never from price math.';
COMMENT ON COLUMN public.trade_history.roi_percent IS 'SELL only: (realizedPnlSol / totalSolSpent) * 100. Never show for BUY.';