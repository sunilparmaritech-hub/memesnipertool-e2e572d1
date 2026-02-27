
-- Add missing columns to positions table
ALTER TABLE public.positions
ADD COLUMN IF NOT EXISTS waiting_for_liquidity_since TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS liquidity_last_checked_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS liquidity_check_count INTEGER DEFAULT 0;

-- Add missing columns to trade_history table  
ALTER TABLE public.trade_history
ADD COLUMN IF NOT EXISTS buyer_position INTEGER,
ADD COLUMN IF NOT EXISTS liquidity NUMERIC,
ADD COLUMN IF NOT EXISTS risk_score INTEGER,
ADD COLUMN IF NOT EXISTS sol_spent NUMERIC,
ADD COLUMN IF NOT EXISTS entry_price NUMERIC;

-- Add missing columns to user_sniper_settings table
ALTER TABLE public.user_sniper_settings
ADD COLUMN IF NOT EXISTS slippage_tolerance INTEGER DEFAULT 15,
ADD COLUMN IF NOT EXISTS validation_rule_toggles JSONB,
ADD COLUMN IF NOT EXISTS target_buyer_positions INTEGER[];

-- Create token_processing_states table for race condition prevention
CREATE TABLE IF NOT EXISTS public.token_processing_states (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  token_address TEXT NOT NULL UNIQUE,
  state TEXT NOT NULL DEFAULT 'IDLE',
  pending_reason TEXT,
  user_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.token_processing_states ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own token states" ON public.token_processing_states;
CREATE POLICY "Users can manage own token states"
ON public.token_processing_states
FOR ALL
USING (auth.uid() = user_id OR user_id IS NULL)
WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- Add referral columns to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS referral_code TEXT,
ADD COLUMN IF NOT EXISTS total_referrals INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS referral_earnings INTEGER DEFAULT 0;

-- Create get_credit_costs RPC function
CREATE OR REPLACE FUNCTION public.get_credit_costs()
RETURNS JSONB
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT setting_value INTO result
  FROM public.admin_settings
  WHERE setting_key = 'credit_costs'
  LIMIT 1;
  
  RETURN COALESCE(result, '{}'::jsonb);
END;
$$;
