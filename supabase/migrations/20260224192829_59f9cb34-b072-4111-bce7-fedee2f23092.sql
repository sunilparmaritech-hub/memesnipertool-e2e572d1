
-- Update handle_new_user to grant 50 free credits on registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
    -- Create profile with 50 free credits
    INSERT INTO public.profiles (user_id, email, credit_balance, total_credits_purchased)
    VALUES (NEW.id, NEW.email, 50, 50);
    
    -- Assign default user role
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'user');
    
    -- Create default sniper settings
    INSERT INTO public.sniper_settings (user_id)
    VALUES (NEW.id);
    
    RETURN NEW;
END;
$function$;
