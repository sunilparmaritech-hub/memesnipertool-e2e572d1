
-- Wallet graph cache for 2-layer funding analysis
CREATE TABLE public.wallet_graph_cache (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  wallet_address TEXT NOT NULL,
  funding_source TEXT,
  funding_depth INTEGER DEFAULT 1,
  is_fresh_wallet BOOLEAN DEFAULT false,
  wallet_age_hours NUMERIC,
  initial_funding_sol NUMERIC,
  cluster_id TEXT,
  analyzed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + INTERVAL '60 seconds'),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_wallet_graph_cache_wallet ON public.wallet_graph_cache(wallet_address);
CREATE INDEX idx_wallet_graph_cache_expires ON public.wallet_graph_cache(expires_at);
CREATE INDEX idx_wallet_graph_cache_cluster ON public.wallet_graph_cache(cluster_id);

ALTER TABLE public.wallet_graph_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view wallet graph cache"
  ON public.wallet_graph_cache FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can insert wallet graph cache"
  ON public.wallet_graph_cache FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete expired cache"
  ON public.wallet_graph_cache FOR DELETE
  USING (expires_at < now());

-- Volume authenticity cache for wash trading detection
CREATE TABLE public.volume_authenticity_cache (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  token_address TEXT NOT NULL,
  top5_wallet_volume_percent NUMERIC DEFAULT 0,
  circular_trade_count INTEGER DEFAULT 0,
  same_wallet_loop_count INTEGER DEFAULT 0,
  sub_second_trade_count INTEGER DEFAULT 0,
  is_wash_trading BOOLEAN DEFAULT false,
  volume_score NUMERIC DEFAULT 100,
  analyzed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + INTERVAL '15 seconds'),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_volume_auth_token ON public.volume_authenticity_cache(token_address);
CREATE INDEX idx_volume_auth_expires ON public.volume_authenticity_cache(expires_at);

ALTER TABLE public.volume_authenticity_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view volume cache"
  ON public.volume_authenticity_cache FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can insert volume cache"
  ON public.volume_authenticity_cache FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete expired volume cache"
  ON public.volume_authenticity_cache FOR DELETE
  USING (expires_at < now());

-- Expand deployer_reputation with new behavioral columns
ALTER TABLE public.deployer_reputation
  ADD COLUMN IF NOT EXISTS tokens_last_7d INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS avg_lp_lifespan_seconds INTEGER,
  ADD COLUMN IF NOT EXISTS cluster_association_score NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_token_deployed_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS rapid_deploy_flag BOOLEAN DEFAULT false;
