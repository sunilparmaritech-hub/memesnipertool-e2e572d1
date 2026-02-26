
-- Add verification tier and related columns to profiles
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS verification_tier integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ip_country text,
  ADD COLUMN IF NOT EXISTS device_fingerprint text,
  ADD COLUMN IF NOT EXISTS email_verified_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS enhanced_verification_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS wallet_risk_score integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS wallet_screening_status text DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS last_screened_at timestamp with time zone;

-- Wallet screening results table
CREATE TABLE IF NOT EXISTS public.wallet_screening_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address text NOT NULL,
  user_id uuid NOT NULL,
  risk_score integer NOT NULL DEFAULT 0,
  risk_level text NOT NULL DEFAULT 'unknown',
  is_sanctioned boolean DEFAULT false,
  is_illicit boolean DEFAULT false,
  screening_source text DEFAULT 'placeholder',
  flags jsonb DEFAULT '[]'::jsonb,
  raw_response jsonb DEFAULT '{}'::jsonb,
  screened_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone NOT NULL DEFAULT (now() + interval '24 hours'),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.wallet_screening_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own screening results"
  ON public.wallet_screening_results FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own screening results"
  ON public.wallet_screening_results FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can manage all screening results"
  ON public.wallet_screening_results FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_wallet_screening_wallet ON public.wallet_screening_results(wallet_address);
CREATE INDEX IF NOT EXISTS idx_wallet_screening_user ON public.wallet_screening_results(user_id);
