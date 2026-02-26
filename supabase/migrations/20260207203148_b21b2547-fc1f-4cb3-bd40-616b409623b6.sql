-- Create deployer_reputation table for tracking token creator history
CREATE TABLE public.deployer_reputation (
  wallet_address TEXT PRIMARY KEY,
  total_tokens_created INTEGER NOT NULL DEFAULT 0,
  total_rugs INTEGER NOT NULL DEFAULT 0,
  avg_liquidity_survival_seconds INTEGER DEFAULT NULL,
  rug_ratio NUMERIC DEFAULT 0,
  cluster_id TEXT DEFAULT NULL,
  reputation_score INTEGER NOT NULL DEFAULT 50,
  last_updated TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add index for faster lookups (primary key already indexed, but adding for cluster_id)
CREATE INDEX idx_deployer_reputation_cluster ON public.deployer_reputation(cluster_id);
CREATE INDEX idx_deployer_reputation_score ON public.deployer_reputation(reputation_score);
CREATE INDEX idx_deployer_reputation_rug_ratio ON public.deployer_reputation(rug_ratio);

-- Enable RLS
ALTER TABLE public.deployer_reputation ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read deployer reputation (public safety data)
CREATE POLICY "Authenticated users can view deployer reputation"
ON public.deployer_reputation
FOR SELECT
TO authenticated
USING (true);

-- Only admins can insert/update/delete reputation data
CREATE POLICY "Admins can manage deployer reputation"
ON public.deployer_reputation
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add comment for documentation
COMMENT ON TABLE public.deployer_reputation IS 'Tracks historical reputation of token deployers to identify rug pull risks';