
-- =============================================
-- 1. Add missing enum values to position_status
-- =============================================
ALTER TYPE public.position_status ADD VALUE IF NOT EXISTS 'waiting_for_liquidity';
ALTER TYPE public.position_status ADD VALUE IF NOT EXISTS 'frozen';

-- =============================================
-- 2. Add missing api_type enum values
-- =============================================
ALTER TYPE public.api_type ADD VALUE IF NOT EXISTS 'helius';
ALTER TYPE public.api_type ADD VALUE IF NOT EXISTS 'pumpfun';
ALTER TYPE public.api_type ADD VALUE IF NOT EXISTS 'jupiter';

-- =============================================
-- 3. Create portfolio_snapshots table
-- =============================================
CREATE TABLE IF NOT EXISTS public.portfolio_snapshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
  open_positions_count INTEGER NOT NULL DEFAULT 0,
  total_invested_sol NUMERIC NOT NULL DEFAULT 0,
  total_value_sol NUMERIC NOT NULL DEFAULT 0,
  unrealized_pnl_sol NUMERIC NOT NULL DEFAULT 0,
  realized_pnl_sol NUMERIC NOT NULL DEFAULT 0,
  total_pnl_sol NUMERIC NOT NULL DEFAULT 0,
  sol_price_usd NUMERIC,
  win_rate NUMERIC,
  closed_trades_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, snapshot_date)
);

ALTER TABLE public.portfolio_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own snapshots"
  ON public.portfolio_snapshots
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all snapshots"
  ON public.portfolio_snapshots
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- =============================================
-- 4. Create trade_signals table
-- =============================================
CREATE TABLE IF NOT EXISTS public.trade_signals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  token_address TEXT NOT NULL,
  token_symbol TEXT NOT NULL DEFAULT '',
  token_name TEXT NOT NULL DEFAULT '',
  chain TEXT NOT NULL DEFAULT 'solana',
  liquidity NUMERIC NOT NULL DEFAULT 0,
  price_usd NUMERIC,
  risk_score INTEGER NOT NULL DEFAULT 50,
  trade_amount NUMERIC NOT NULL DEFAULT 0.1,
  slippage INTEGER NOT NULL DEFAULT 15,
  priority TEXT NOT NULL DEFAULT 'normal',
  status TEXT NOT NULL DEFAULT 'pending',
  reasons TEXT[] NOT NULL DEFAULT '{}',
  source TEXT,
  is_pump_fun BOOLEAN NOT NULL DEFAULT false,
  tx_signature TEXT,
  executed_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + INTERVAL '5 minutes'),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'
);

ALTER TABLE public.trade_signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own trade signals"
  ON public.trade_signals
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all trade signals"
  ON public.trade_signals
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_trade_signals_user_status ON public.trade_signals(user_id, status);
CREATE INDEX IF NOT EXISTS idx_trade_signals_expires_at ON public.trade_signals(expires_at);
CREATE INDEX IF NOT EXISTS idx_portfolio_snapshots_user_date ON public.portfolio_snapshots(user_id, snapshot_date DESC);

-- Enable realtime for trade_signals
ALTER PUBLICATION supabase_realtime ADD TABLE public.trade_signals;
