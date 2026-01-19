-- Add missing columns to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS is_suspended boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS suspension_reason text;

-- Create admin_settings table
CREATE TABLE IF NOT EXISTS public.admin_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  setting_key text NOT NULL UNIQUE,
  setting_value jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on admin_settings
ALTER TABLE public.admin_settings ENABLE ROW LEVEL SECURITY;

-- Only admins can manage admin_settings
CREATE POLICY "Admins can view admin settings" 
ON public.admin_settings FOR SELECT 
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert admin settings" 
ON public.admin_settings FOR INSERT 
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update admin settings" 
ON public.admin_settings FOR UPDATE 
USING (public.has_role(auth.uid(), 'admin'));

-- Create user_activity_logs table
CREATE TABLE IF NOT EXISTS public.user_activity_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  action text NOT NULL,
  details jsonb,
  ip_address text,
  user_agent text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on user_activity_logs
ALTER TABLE public.user_activity_logs ENABLE ROW LEVEL SECURITY;

-- Users can view their own logs, admins can view all
CREATE POLICY "Users can view their own activity logs" 
ON public.user_activity_logs FOR SELECT 
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- Only system can insert logs (via service role)
CREATE POLICY "Admins can insert activity logs" 
ON public.user_activity_logs FOR INSERT 
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Add trigger for admin_settings updated_at
CREATE TRIGGER update_admin_settings_updated_at
BEFORE UPDATE ON public.admin_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();