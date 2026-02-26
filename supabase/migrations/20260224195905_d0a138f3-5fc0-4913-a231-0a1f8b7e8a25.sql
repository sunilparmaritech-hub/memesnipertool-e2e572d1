
CREATE OR REPLACE FUNCTION public.get_payment_wallet()
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT (setting_value->>'receiving_wallet')::text
  FROM public.admin_settings
  WHERE setting_key = 'payment_settings'
  LIMIT 1;
$$;
