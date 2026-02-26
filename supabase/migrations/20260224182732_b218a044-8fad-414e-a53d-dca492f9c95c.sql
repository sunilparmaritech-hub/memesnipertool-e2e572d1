
-- Credit packs table (admin configurable)
CREATE TABLE public.credit_packs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  sol_price NUMERIC NOT NULL,
  credits_amount INTEGER NOT NULL,
  bonus_credits INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Payment transactions table
CREATE TABLE public.credit_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  tx_hash TEXT NOT NULL UNIQUE,
  sender_wallet TEXT NOT NULL,
  recipient_wallet TEXT NOT NULL,
  amount_sol NUMERIC NOT NULL,
  credits_added INTEGER NOT NULL DEFAULT 0,
  pack_id UUID REFERENCES public.credit_packs(id),
  status TEXT NOT NULL DEFAULT 'pending',
  failure_reason TEXT,
  memo TEXT,
  slot BIGINT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  confirmed_at TIMESTAMP WITH TIME ZONE
);

-- Credit usage log
CREATE TABLE public.credit_usage_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  action_type TEXT NOT NULL,
  credits_used INTEGER NOT NULL DEFAULT 1,
  reference_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add credit columns to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS credit_balance INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_credits_purchased INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_credits_used INTEGER NOT NULL DEFAULT 0;

-- RLS for credit_packs (everyone can read active packs, admins manage)
ALTER TABLE public.credit_packs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active credit packs"
  ON public.credit_packs FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins can manage credit packs"
  ON public.credit_packs FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS for credit_transactions
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own credit transactions"
  ON public.credit_transactions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all credit transactions"
  ON public.credit_transactions FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service can insert credit transactions"
  ON public.credit_transactions FOR INSERT
  WITH CHECK (true);

-- RLS for credit_usage_log
ALTER TABLE public.credit_usage_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own credit usage"
  ON public.credit_usage_log FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own credit usage"
  ON public.credit_usage_log FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all credit usage"
  ON public.credit_usage_log FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Insert default credit packs
INSERT INTO public.credit_packs (name, sol_price, credits_amount, bonus_credits, sort_order) VALUES
  ('Starter', 0.5, 100, 0, 1),
  ('Growth', 1.0, 250, 25, 2),
  ('Pro', 2.5, 700, 100, 3),
  ('Whale', 5.0, 1500, 300, 4);

-- Updated_at trigger for credit_packs
CREATE TRIGGER update_credit_packs_updated_at
  BEFORE UPDATE ON public.credit_packs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
