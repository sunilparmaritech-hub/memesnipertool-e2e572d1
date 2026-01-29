-- Create trade_history table for tracking all buy/sell transactions
CREATE TABLE public.trade_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  token_address TEXT NOT NULL,
  token_name TEXT,
  token_symbol TEXT,
  trade_type TEXT NOT NULL CHECK (trade_type IN ('buy', 'sell')),
  amount NUMERIC NOT NULL,
  price_sol NUMERIC,
  price_usd NUMERIC,
  status TEXT DEFAULT 'pending',
  tx_hash TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add entry_price_usd column to positions table
ALTER TABLE public.positions ADD COLUMN IF NOT EXISTS entry_price_usd NUMERIC;

-- Enable RLS
ALTER TABLE public.trade_history ENABLE ROW LEVEL SECURITY;

-- RLS policies for trade_history
CREATE POLICY "Users can view their own trade history"
  ON public.trade_history FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own trade history"
  ON public.trade_history FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own trade history"
  ON public.trade_history FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own trade history"
  ON public.trade_history FOR DELETE
  USING (auth.uid() = user_id);

-- Create index for faster queries
CREATE INDEX idx_trade_history_user_id ON public.trade_history(user_id);
CREATE INDEX idx_trade_history_created_at ON public.trade_history(created_at DESC);