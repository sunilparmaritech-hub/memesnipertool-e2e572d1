
-- Create a function to credit referral bonus atomically
CREATE OR REPLACE FUNCTION public.credit_referral_bonus(target_user_id UUID, bonus_amount INTEGER)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.profiles
  SET 
    credit_balance = credit_balance + bonus_amount,
    total_credits_purchased = total_credits_purchased + bonus_amount,
    updated_at = now()
  WHERE user_id = target_user_id;
END;
$function$;
