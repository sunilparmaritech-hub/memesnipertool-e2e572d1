-- Allow users to INSERT their own credit transactions (for pending records)
CREATE POLICY "Users can insert own credit transactions"
ON public.credit_transactions
FOR INSERT
WITH CHECK (auth.uid() = user_id);