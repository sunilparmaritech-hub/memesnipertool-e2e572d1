-- Add RLS policy to allow users to delete their own trade_history records
-- This is needed for cleaning up fake trades without tx_hash

CREATE POLICY "Users can delete their own trades"
ON public.trade_history
FOR DELETE
USING (auth.uid() = user_id);