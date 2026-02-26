-- Upgrade circuit breaker with advanced triggers and admin override requirement
-- Add new columns to track specific trigger conditions

-- Add new trigger tracking columns to risk_settings
ALTER TABLE public.risk_settings 
ADD COLUMN IF NOT EXISTS circuit_breaker_trigger_reason text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS circuit_breaker_rug_count integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS circuit_breaker_tax_count integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS circuit_breaker_freeze_count integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS circuit_breaker_requires_admin_override boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS circuit_breaker_cooldown_minutes integer DEFAULT 60,
ADD COLUMN IF NOT EXISTS circuit_breaker_drawdown_threshold numeric DEFAULT 20,
ADD COLUMN IF NOT EXISTS circuit_breaker_drawdown_window_minutes integer DEFAULT 30;

-- Create table to track circuit breaker events
CREATE TABLE IF NOT EXISTS public.circuit_breaker_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  triggered_at timestamp with time zone NOT NULL DEFAULT now(),
  trigger_type text NOT NULL, -- 'drawdown', 'rug_streak', 'hidden_tax', 'frozen_token'
  trigger_details jsonb DEFAULT '{}'::jsonb,
  reset_at timestamp with time zone DEFAULT NULL,
  reset_by uuid DEFAULT NULL, -- admin who reset it
  reset_reason text DEFAULT NULL,
  cooldown_expires_at timestamp with time zone NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.circuit_breaker_events ENABLE ROW LEVEL SECURITY;

-- Users can view their own events
CREATE POLICY "Users can view their own circuit breaker events"
ON public.circuit_breaker_events
FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own events (triggered by system)
CREATE POLICY "Users can insert circuit breaker events"
ON public.circuit_breaker_events
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Only admins can update/reset events
CREATE POLICY "Admins can manage circuit breaker events"
ON public.circuit_breaker_events
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_circuit_breaker_events_user_triggered 
ON public.circuit_breaker_events(user_id, triggered_at DESC);

CREATE INDEX IF NOT EXISTS idx_circuit_breaker_events_cooldown 
ON public.circuit_breaker_events(cooldown_expires_at) 
WHERE reset_at IS NULL;