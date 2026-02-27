
-- Add missing columns to risk_settings for circuit breaker
ALTER TABLE public.risk_settings
ADD COLUMN IF NOT EXISTS circuit_breaker_trigger_reason TEXT,
ADD COLUMN IF NOT EXISTS circuit_breaker_cooldown_minutes INTEGER DEFAULT 60,
ADD COLUMN IF NOT EXISTS circuit_breaker_requires_admin_override BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS circuit_breaker_rug_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS circuit_breaker_tax_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS circuit_breaker_freeze_count INTEGER DEFAULT 0;

-- Create circuit_breaker_events table
CREATE TABLE IF NOT EXISTS public.circuit_breaker_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  trigger_type TEXT NOT NULL,
  trigger_details JSONB DEFAULT '{}',
  cooldown_expires_at TIMESTAMP WITH TIME ZONE,
  triggered_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  reset_at TIMESTAMP WITH TIME ZONE,
  reset_by UUID,
  reset_reason TEXT
);

ALTER TABLE public.circuit_breaker_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own circuit breaker events" ON public.circuit_breaker_events;
CREATE POLICY "Users can view own circuit breaker events"
ON public.circuit_breaker_events FOR SELECT
USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Service can insert circuit breaker events" ON public.circuit_breaker_events;
CREATE POLICY "Service can insert circuit breaker events"
ON public.circuit_breaker_events FOR INSERT
WITH CHECK (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can update circuit breaker events" ON public.circuit_breaker_events;
CREATE POLICY "Admins can update circuit breaker events"
ON public.circuit_breaker_events FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create deployer_reputation table
CREATE TABLE IF NOT EXISTS public.deployer_reputation (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  wallet_address TEXT NOT NULL UNIQUE,
  tokens_last_7d INTEGER DEFAULT 0,
  total_tokens_created INTEGER DEFAULT 0,
  avg_lp_lifespan_seconds INTEGER,
  avg_liquidity_survival_seconds INTEGER,
  rug_ratio NUMERIC,
  cluster_association_score NUMERIC DEFAULT 0,
  rapid_deploy_flag BOOLEAN DEFAULT false,
  fast_lp_pull_flag BOOLEAN DEFAULT false,
  last_token_deployed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.deployer_reputation ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read deployer reputation" ON public.deployer_reputation;
CREATE POLICY "Anyone can read deployer reputation"
ON public.deployer_reputation FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Admins can manage deployer reputation" ON public.deployer_reputation;
CREATE POLICY "Admins can manage deployer reputation"
ON public.deployer_reputation FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));
