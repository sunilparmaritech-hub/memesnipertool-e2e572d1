-- 1. Create RPC function to expose credit cost definitions to all authenticated users
CREATE OR REPLACE FUNCTION public.get_credit_costs()
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    (SELECT setting_value FROM public.admin_settings WHERE setting_key = 'credit_cost_definitions' LIMIT 1),
    '{}'::jsonb
  );
$$;

-- 2. Create the missing trigger for handle_new_user on auth.users
CREATE TRIGGER on_auth_user_created_profile
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
