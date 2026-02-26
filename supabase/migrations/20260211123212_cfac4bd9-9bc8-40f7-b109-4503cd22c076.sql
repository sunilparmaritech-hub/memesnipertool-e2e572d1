
-- Fix overly permissive INSERT policies to require authentication
DROP POLICY IF EXISTS "Authenticated users can insert wallet graph cache" ON public.wallet_graph_cache;
CREATE POLICY "Authenticated users can insert wallet graph cache"
  ON public.wallet_graph_cache FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can insert volume cache" ON public.volume_authenticity_cache;
CREATE POLICY "Authenticated users can insert volume cache"
  ON public.volume_authenticity_cache FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);
