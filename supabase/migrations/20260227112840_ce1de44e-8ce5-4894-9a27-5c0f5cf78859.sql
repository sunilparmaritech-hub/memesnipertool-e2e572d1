
-- Fix overly permissive RLS policies for volume_authenticity_cache
-- These should only be writable by authenticated users
DROP POLICY IF EXISTS "Anyone can insert volume cache" ON public.volume_authenticity_cache;
CREATE POLICY "Authenticated can insert volume cache"
ON public.volume_authenticity_cache FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Anyone can update volume cache" ON public.volume_authenticity_cache;
CREATE POLICY "Authenticated can update volume cache"
ON public.volume_authenticity_cache FOR UPDATE
USING (auth.uid() IS NOT NULL);
