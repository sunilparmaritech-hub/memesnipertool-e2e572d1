
-- Add missing columns to deployer_reputation
ALTER TABLE public.deployer_reputation
ADD COLUMN IF NOT EXISTS total_rugs INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS cluster_id TEXT,
ADD COLUMN IF NOT EXISTS reputation_score NUMERIC DEFAULT 50,
ADD COLUMN IF NOT EXISTS last_updated TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Add missing columns to risk_settings
ALTER TABLE public.risk_settings
ADD COLUMN IF NOT EXISTS min_liquidity_auto_usd NUMERIC DEFAULT 5000,
ADD COLUMN IF NOT EXISTS min_liquidity_manual_usd NUMERIC DEFAULT 1000;

-- Create support_tickets table
CREATE TABLE IF NOT EXISTS public.support_tickets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  ticket_number TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL DEFAULT 'general',
  subject TEXT NOT NULL,
  description TEXT NOT NULL,
  wallet_address TEXT,
  priority TEXT NOT NULL DEFAULT 'normal',
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert own tickets" ON public.support_tickets;
CREATE POLICY "Users can insert own tickets"
ON public.support_tickets FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own tickets" ON public.support_tickets;
CREATE POLICY "Users can view own tickets"
ON public.support_tickets FOR SELECT
USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can manage all tickets" ON public.support_tickets;
CREATE POLICY "Admins can manage all tickets"
ON public.support_tickets FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create referrals table
CREATE TABLE IF NOT EXISTS public.referrals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  referrer_id UUID NOT NULL,
  referred_id UUID NOT NULL,
  bonus_credited BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own referrals" ON public.referrals;
CREATE POLICY "Users can view own referrals"
ON public.referrals FOR SELECT
USING (auth.uid() = referrer_id OR has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Service can insert referrals" ON public.referrals;
CREATE POLICY "Service can insert referrals"
ON public.referrals FOR INSERT
WITH CHECK (auth.uid() = referrer_id);

-- Create volume_authenticity_cache table
CREATE TABLE IF NOT EXISTS public.volume_authenticity_cache (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  token_address TEXT NOT NULL UNIQUE,
  authenticity_score NUMERIC,
  wash_trade_ratio NUMERIC,
  bot_volume_ratio NUMERIC,
  cached_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.volume_authenticity_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read volume cache" ON public.volume_authenticity_cache;
CREATE POLICY "Anyone can read volume cache"
ON public.volume_authenticity_cache FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Anyone can insert volume cache" ON public.volume_authenticity_cache;
CREATE POLICY "Anyone can insert volume cache"
ON public.volume_authenticity_cache FOR INSERT
WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can update volume cache" ON public.volume_authenticity_cache;
CREATE POLICY "Anyone can update volume cache"
ON public.volume_authenticity_cache FOR UPDATE
USING (true);

-- Create get_payment_wallet RPC function
CREATE OR REPLACE FUNCTION public.get_payment_wallet()
RETURNS TEXT
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  wallet TEXT;
BEGIN
  SELECT (setting_value->>'wallet_address') INTO wallet
  FROM public.admin_settings
  WHERE setting_key = 'payment_settings'
  LIMIT 1;
  
  RETURN wallet;
END;
$$;
