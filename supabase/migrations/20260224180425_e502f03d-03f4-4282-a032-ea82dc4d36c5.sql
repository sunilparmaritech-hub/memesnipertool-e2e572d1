
-- =============================================
-- SOL Credit-Based Payment System Tables
-- =============================================

-- 1. User Credits (balance tracking)
CREATE TABLE public.user_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  credit_balance INTEGER NOT NULL DEFAULT 0,
  total_credits_purchased INTEGER NOT NULL DEFAULT 0,
  total_credits_used INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_credits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own credits" ON public.user_credits FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own credits" ON public.user_credits FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can view all credits" ON public.user_credits FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update all credits" ON public.user_credits FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));

-- 2. Credit Packs (admin-configurable)
CREATE TABLE public.credit_packs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  sol_price NUMERIC NOT NULL,
  credits INTEGER NOT NULL,
  bonus_credits INTEGER NOT NULL DEFAULT 0,
  features JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  badge TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.credit_packs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active packs" ON public.credit_packs FOR SELECT USING (is_active = true);
CREATE POLICY "Admins can manage packs" ON public.credit_packs FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- 3. Credit Transactions (payment records)
CREATE TYPE public.credit_tx_status AS ENUM ('pending', 'confirmed', 'failed', 'expired');

CREATE TABLE public.credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  pack_id UUID REFERENCES public.credit_packs(id),
  tx_hash TEXT UNIQUE,
  sender_wallet TEXT,
  amount_sol NUMERIC NOT NULL,
  usd_value_at_payment NUMERIC,
  credits_added INTEGER NOT NULL DEFAULT 0,
  status public.credit_tx_status NOT NULL DEFAULT 'pending',
  memo TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  confirmed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own transactions" ON public.credit_transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own transactions" ON public.credit_transactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can view all transactions" ON public.credit_transactions FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update all transactions" ON public.credit_transactions FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));

-- 4. Credit Usage Log
CREATE TABLE public.credit_usage_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  action_type TEXT NOT NULL,
  credits_used INTEGER NOT NULL,
  reference_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.credit_usage_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own usage" ON public.credit_usage_log FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all usage" ON public.credit_usage_log FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

-- 5. Atomic credit deduction function
CREATE OR REPLACE FUNCTION public.deduct_credits(
  _user_id UUID,
  _amount INTEGER,
  _action_type TEXT,
  _reference_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_balance INTEGER;
  new_balance INTEGER;
BEGIN
  -- Lock the row for atomic update
  SELECT credit_balance INTO current_balance
  FROM public.user_credits
  WHERE user_id = _user_id
  FOR UPDATE;

  IF current_balance IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No credit account found', 'balance', 0);
  END IF;

  IF current_balance < _amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient credits', 'balance', current_balance);
  END IF;

  new_balance := current_balance - _amount;

  UPDATE public.user_credits
  SET credit_balance = new_balance,
      total_credits_used = total_credits_used + _amount,
      updated_at = now()
  WHERE user_id = _user_id;

  INSERT INTO public.credit_usage_log (user_id, action_type, credits_used, reference_id)
  VALUES (_user_id, _action_type, _amount, _reference_id);

  RETURN jsonb_build_object('success', true, 'balance', new_balance, 'deducted', _amount);
END;
$$;

-- 6. Add credits function (for verified payments)
CREATE OR REPLACE FUNCTION public.add_credits(
  _user_id UUID,
  _amount INTEGER,
  _tx_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_balance INTEGER;
BEGIN
  -- Upsert user_credits row
  INSERT INTO public.user_credits (user_id, credit_balance, total_credits_purchased)
  VALUES (_user_id, _amount, _amount)
  ON CONFLICT (user_id) DO UPDATE
  SET credit_balance = user_credits.credit_balance + _amount,
      total_credits_purchased = user_credits.total_credits_purchased + _amount,
      updated_at = now()
  RETURNING credit_balance INTO new_balance;

  -- Update transaction if provided
  IF _tx_id IS NOT NULL THEN
    UPDATE public.credit_transactions
    SET status = 'confirmed', credits_added = _amount, confirmed_at = now(), updated_at = now()
    WHERE id = _tx_id;
  END IF;

  RETURN jsonb_build_object('success', true, 'balance', new_balance, 'added', _amount);
END;
$$;

-- 7. Initialize credits for new users (update handle_new_user trigger)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email) VALUES (NEW.id, NEW.email);
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  INSERT INTO public.subscriptions (user_id, tier, status) VALUES (NEW.id, 'free', 'active');
  INSERT INTO public.user_credits (user_id, credit_balance) VALUES (NEW.id, 10);
  RETURN NEW;
END;
$$;

-- 8. Seed default credit packs
INSERT INTO public.credit_packs (name, description, sol_price, credits, bonus_credits, features, sort_order, badge) VALUES
('Starter Pack', 'Get started with basic sniping', 0.5, 500, 0, '["Token scanning", "Basic risk checks", "Manual trading"]'::jsonb, 1, '🟢'),
('Pro Pack', 'Serious trader essentials', 1.0, 1200, 200, '["Auto trading enabled", "Wallet intelligence", "Priority execution", "Early trust mode"]'::jsonb, 2, '🔵'),
('Whale Pack', 'Maximum edge with all features', 3.0, 4000, 500, '["Unlimited validations", "Advanced clustering", "Multi-RPC redundancy", "Capital preservation", "Premium support"]'::jsonb, 3, '🟣');

-- 9. Trigger for updated_at
CREATE TRIGGER update_user_credits_updated_at BEFORE UPDATE ON public.user_credits FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_credit_packs_updated_at BEFORE UPDATE ON public.credit_packs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_credit_transactions_updated_at BEFORE UPDATE ON public.credit_transactions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
