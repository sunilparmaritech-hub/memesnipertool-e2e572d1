
-- Portfolio snapshots for historical equity curve data
CREATE TABLE public.portfolio_snapshots (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  snapshot_date date NOT NULL DEFAULT CURRENT_DATE,
  open_positions_count integer NOT NULL DEFAULT 0,
  total_invested_sol numeric NOT NULL DEFAULT 0,
  total_value_sol numeric NOT NULL DEFAULT 0,
  unrealized_pnl_sol numeric NOT NULL DEFAULT 0,
  realized_pnl_sol numeric NOT NULL DEFAULT 0,
  total_pnl_sol numeric NOT NULL DEFAULT 0,
  sol_price_usd numeric,
  win_rate numeric DEFAULT 0,
  closed_trades_count integer DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Unique constraint: one snapshot per user per day
ALTER TABLE public.portfolio_snapshots
  ADD CONSTRAINT portfolio_snapshots_user_date_unique UNIQUE (user_id, snapshot_date);

-- Enable RLS
ALTER TABLE public.portfolio_snapshots ENABLE ROW LEVEL SECURITY;

-- Users can view their own snapshots
CREATE POLICY "Users can view own snapshots"
  ON public.portfolio_snapshots FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert own snapshots
CREATE POLICY "Users can insert own snapshots"
  ON public.portfolio_snapshots FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update own snapshots (for upsert)
CREATE POLICY "Users can update own snapshots"
  ON public.portfolio_snapshots FOR UPDATE
  USING (auth.uid() = user_id);

-- Admins can view all
CREATE POLICY "Admins can view all snapshots"
  ON public.portfolio_snapshots FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Index for fast querying by user + date range
CREATE INDEX idx_portfolio_snapshots_user_date
  ON public.portfolio_snapshots (user_id, snapshot_date DESC);
