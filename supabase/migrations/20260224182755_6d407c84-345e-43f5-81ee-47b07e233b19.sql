
-- Fix the overly permissive INSERT policy on credit_transactions
DROP POLICY IF EXISTS "Service can insert credit transactions" ON public.credit_transactions;
