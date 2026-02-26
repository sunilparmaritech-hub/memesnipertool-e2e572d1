
-- Drop the overly permissive policy
DROP POLICY "Service role can manage referrals" ON public.referrals;

-- Allow authenticated users to insert their own referrals
CREATE POLICY "Users can insert referrals" ON public.referrals
  FOR INSERT WITH CHECK (auth.uid() = referred_id);

-- Admins can manage all referrals
CREATE POLICY "Admins can manage all referrals" ON public.referrals
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
