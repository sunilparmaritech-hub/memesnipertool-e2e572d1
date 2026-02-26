
-- Create referrals table to track referral relationships
CREATE TABLE public.referrals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  referrer_id UUID NOT NULL,
  referred_id UUID NOT NULL,
  referral_code TEXT NOT NULL,
  bonus_credited BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add unique constraint so a user can only be referred once
ALTER TABLE public.referrals ADD CONSTRAINT referrals_referred_id_unique UNIQUE (referred_id);

-- Add referral_code column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referral_code TEXT;

-- Add referred_by column to profiles  
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referred_by UUID;

-- Add total_referrals counter to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS total_referrals INTEGER NOT NULL DEFAULT 0;

-- Add referral_earnings counter to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referral_earnings INTEGER NOT NULL DEFAULT 0;

-- Enable RLS on referrals table
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

-- Users can view their own referrals (as referrer)
CREATE POLICY "Users can view own referrals" ON public.referrals
  FOR SELECT USING (auth.uid() = referrer_id OR auth.uid() = referred_id);

-- System inserts referrals (via edge function)
CREATE POLICY "Service role can manage referrals" ON public.referrals
  FOR ALL USING (true) WITH CHECK (true);

-- Admins can view all referrals
CREATE POLICY "Admins can view all referrals" ON public.referrals
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

-- Update handle_new_user to generate referral code
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
    -- Create profile with 50 free credits and a unique referral code
    INSERT INTO public.profiles (user_id, email, credit_balance, total_credits_purchased, referral_code)
    VALUES (NEW.id, NEW.email, 50, 50, UPPER(SUBSTRING(NEW.id::text FROM 1 FOR 8)));
    
    -- Assign default user role
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'user');
    
    -- Create default sniper settings
    INSERT INTO public.sniper_settings (user_id)
    VALUES (NEW.id);
    
    RETURN NEW;
END;
$function$;
