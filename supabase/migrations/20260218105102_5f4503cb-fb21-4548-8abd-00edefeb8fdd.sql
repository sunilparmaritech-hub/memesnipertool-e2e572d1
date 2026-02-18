
-- Subscription tier enum
CREATE TYPE public.subscription_tier AS ENUM ('free', 'pro', 'elite');

-- Subscription status enum
CREATE TYPE public.subscription_status AS ENUM ('active', 'trialing', 'past_due', 'canceled', 'unpaid', 'expired');

-- Coupon discount type enum
CREATE TYPE public.coupon_discount_type AS ENUM ('percent', 'flat');

-- Coupon duration enum
CREATE TYPE public.coupon_duration AS ENUM ('once', 'three_months', 'lifetime');

-- ========== SUBSCRIPTIONS TABLE ==========
CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  tier subscription_tier NOT NULL DEFAULT 'free',
  status subscription_status NOT NULL DEFAULT 'active',
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  billing_interval TEXT DEFAULT 'monthly' CHECK (billing_interval IN ('monthly', 'yearly')),
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT false,
  grace_period_end TIMESTAMPTZ,
  trial_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own subscription" ON public.subscriptions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own subscription" ON public.subscriptions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own subscription" ON public.subscriptions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all subscriptions" ON public.subscriptions FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update all subscriptions" ON public.subscriptions FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ========== USAGE LOGS TABLE ==========
CREATE TABLE public.usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  usage_date DATE NOT NULL DEFAULT CURRENT_DATE,
  validations_count INTEGER NOT NULL DEFAULT 0,
  api_intensive_count INTEGER NOT NULL DEFAULT 0,
  auto_executions_count INTEGER NOT NULL DEFAULT 0,
  clustering_calls_count INTEGER NOT NULL DEFAULT 0,
  rpc_simulations_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, usage_date)
);

ALTER TABLE public.usage_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own usage" ON public.usage_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own usage" ON public.usage_logs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own usage" ON public.usage_logs FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all usage" ON public.usage_logs FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_usage_logs_user_date ON public.usage_logs(user_id, usage_date);

CREATE TRIGGER update_usage_logs_updated_at BEFORE UPDATE ON public.usage_logs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ========== COUPON CODES TABLE ==========
CREATE TABLE public.coupon_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  discount_type coupon_discount_type NOT NULL DEFAULT 'percent',
  discount_value NUMERIC NOT NULL CHECK (discount_value > 0),
  duration coupon_duration NOT NULL DEFAULT 'once',
  max_redemptions INTEGER,
  redemption_count INTEGER NOT NULL DEFAULT 0,
  tier_restriction subscription_tier,
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.coupon_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage coupons" ON public.coupon_codes FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can view active coupons for validation" ON public.coupon_codes FOR SELECT USING (is_active = true);

CREATE TRIGGER update_coupon_codes_updated_at BEFORE UPDATE ON public.coupon_codes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ========== COUPON REDEMPTIONS TABLE ==========
CREATE TABLE public.coupon_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id UUID NOT NULL REFERENCES public.coupon_codes(id),
  user_id UUID NOT NULL,
  discount_applied NUMERIC NOT NULL,
  redeemed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(coupon_id, user_id)
);

ALTER TABLE public.coupon_redemptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own redemptions" ON public.coupon_redemptions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own redemptions" ON public.coupon_redemptions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can view all redemptions" ON public.coupon_redemptions FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- ========== BILLING EVENTS TABLE ==========
CREATE TABLE public.billing_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  event_type TEXT NOT NULL,
  stripe_event_id TEXT,
  amount NUMERIC,
  currency TEXT DEFAULT 'usd',
  tier subscription_tier,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.billing_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own billing events" ON public.billing_events FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all billing events" ON public.billing_events FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can insert billing events" ON public.billing_events FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_billing_events_user ON public.billing_events(user_id);
CREATE INDEX idx_billing_events_type ON public.billing_events(event_type);

-- ========== ATOMIC USAGE INCREMENT FUNCTION ==========
CREATE OR REPLACE FUNCTION public.increment_usage(
  _user_id UUID,
  _field TEXT,
  _amount INTEGER DEFAULT 1
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_val INTEGER;
BEGIN
  INSERT INTO public.usage_logs (user_id, usage_date)
  VALUES (_user_id, CURRENT_DATE)
  ON CONFLICT (user_id, usage_date) DO NOTHING;

  IF _field = 'validations' THEN
    UPDATE public.usage_logs SET validations_count = validations_count + _amount, updated_at = now()
    WHERE user_id = _user_id AND usage_date = CURRENT_DATE
    RETURNING validations_count INTO current_val;
  ELSIF _field = 'api_intensive' THEN
    UPDATE public.usage_logs SET api_intensive_count = api_intensive_count + _amount, updated_at = now()
    WHERE user_id = _user_id AND usage_date = CURRENT_DATE
    RETURNING api_intensive_count INTO current_val;
  ELSIF _field = 'auto_executions' THEN
    UPDATE public.usage_logs SET auto_executions_count = auto_executions_count + _amount, updated_at = now()
    WHERE user_id = _user_id AND usage_date = CURRENT_DATE
    RETURNING auto_executions_count INTO current_val;
  ELSIF _field = 'clustering' THEN
    UPDATE public.usage_logs SET clustering_calls_count = clustering_calls_count + _amount, updated_at = now()
    WHERE user_id = _user_id AND usage_date = CURRENT_DATE
    RETURNING clustering_calls_count INTO current_val;
  ELSIF _field = 'rpc_simulations' THEN
    UPDATE public.usage_logs SET rpc_simulations_count = rpc_simulations_count + _amount, updated_at = now()
    WHERE user_id = _user_id AND usage_date = CURRENT_DATE
    RETURNING rpc_simulations_count INTO current_val;
  ELSE
    RAISE EXCEPTION 'Invalid usage field: %', _field;
  END IF;

  RETURN current_val;
END;
$$;

-- ========== AUTO-CREATE FREE SUBSCRIPTION ON NEW USER ==========
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
  RETURN NEW;
END;
$$;

-- ========== GET SUBSCRIPTION WITH LIMITS FUNCTION ==========
CREATE OR REPLACE FUNCTION public.get_subscription_with_usage(_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sub RECORD;
  usage RECORD;
  result JSONB;
BEGIN
  SELECT * INTO sub FROM public.subscriptions WHERE user_id = _user_id LIMIT 1;
  SELECT * INTO usage FROM public.usage_logs WHERE user_id = _user_id AND usage_date = CURRENT_DATE LIMIT 1;

  result := jsonb_build_object(
    'tier', COALESCE(sub.tier::text, 'free'),
    'status', COALESCE(sub.status::text, 'active'),
    'billing_interval', sub.billing_interval,
    'current_period_end', sub.current_period_end,
    'cancel_at_period_end', COALESCE(sub.cancel_at_period_end, false),
    'grace_period_end', sub.grace_period_end,
    'usage', jsonb_build_object(
      'validations', COALESCE(usage.validations_count, 0),
      'api_intensive', COALESCE(usage.api_intensive_count, 0),
      'auto_executions', COALESCE(usage.auto_executions_count, 0),
      'clustering', COALESCE(usage.clustering_calls_count, 0),
      'rpc_simulations', COALESCE(usage.rpc_simulations_count, 0)
    )
  );

  RETURN result;
END;
$$;
