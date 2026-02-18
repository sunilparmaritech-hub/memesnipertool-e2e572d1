import { useState } from "react";
import { useNavigate } from "react-router-dom";
import AppLayout from "@/components/layout/AppLayout";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { TIER_CONFIGS, SubscriptionTier } from "@/lib/subscription-tiers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Check, Zap, Crown, Star, Sparkles, Tag } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export default function Pricing() {
  const { tier: currentTier, refreshSubscription } = useSubscription();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [billingInterval, setBillingInterval] = useState<'monthly' | 'yearly'>('monthly');
  const [couponCode, setCouponCode] = useState('');
  const [couponApplied, setCouponApplied] = useState<{ code: string; discount: number; type: string } | null>(null);
  const [validatingCoupon, setValidatingCoupon] = useState(false);
  const [upgrading, setUpgrading] = useState<SubscriptionTier | null>(null);

  const tiers: SubscriptionTier[] = ['free', 'pro', 'elite'];
  const tierIcons = { free: Star, pro: Zap, elite: Crown };

  const validateCoupon = async () => {
    if (!couponCode.trim()) return;
    setValidatingCoupon(true);
    try {
      const { data, error } = await supabase
        .from('coupon_codes')
        .select('*')
        .eq('code', couponCode.trim().toUpperCase())
        .eq('is_active', true)
        .single();

      if (error || !data) {
        toast({ title: 'Invalid Coupon', description: 'This coupon code is not valid.', variant: 'destructive' });
        setCouponApplied(null);
        return;
      }

      // Check expiry
      if (data.expires_at && new Date(data.expires_at) < new Date()) {
        toast({ title: 'Expired Coupon', description: 'This coupon has expired.', variant: 'destructive' });
        return;
      }

      // Check max redemptions
      if (data.max_redemptions && data.redemption_count >= data.max_redemptions) {
        toast({ title: 'Coupon Limit Reached', description: 'This coupon has been fully redeemed.', variant: 'destructive' });
        return;
      }

      // Check if user already redeemed
      if (user) {
        const { data: existing } = await supabase
          .from('coupon_redemptions')
          .select('id')
          .eq('coupon_id', data.id)
          .eq('user_id', user.id)
          .single();

        if (existing) {
          toast({ title: 'Already Used', description: 'You have already used this coupon.', variant: 'destructive' });
          return;
        }
      }

      setCouponApplied({
        code: data.code,
        discount: data.discount_value,
        type: data.discount_type,
      });
      toast({ title: 'Coupon Applied!', description: `${data.discount_type === 'percent' ? `${data.discount_value}%` : `$${data.discount_value}`} discount applied.` });
    } catch {
      toast({ title: 'Error', description: 'Failed to validate coupon.', variant: 'destructive' });
    } finally {
      setValidatingCoupon(false);
    }
  };

  const getDiscountedPrice = (price: number) => {
    if (!couponApplied || price === 0) return price;
    if (couponApplied.type === 'percent') {
      return Math.max(0, price * (1 - couponApplied.discount / 100));
    }
    return Math.max(0, price - couponApplied.discount);
  };

  const handleUpgrade = async (targetTier: SubscriptionTier) => {
    if (!user) {
      navigate('/auth');
      return;
    }

    if (targetTier === 'free' || targetTier === currentTier) return;

    setUpgrading(targetTier);
    try {
      // Mock upgrade - in production this would create a Stripe checkout session
      const price = billingInterval === 'monthly'
        ? TIER_CONFIGS[targetTier].monthlyPrice
        : TIER_CONFIGS[targetTier].yearlyPrice;
      
      const finalPrice = getDiscountedPrice(price);

      // Update subscription in DB (mock)
      const { error } = await supabase
        .from('subscriptions')
        .update({
          tier: targetTier as 'free' | 'pro' | 'elite',
          status: 'active' as const,
          billing_interval: billingInterval,
          current_period_start: new Date().toISOString(),
          current_period_end: new Date(Date.now() + (billingInterval === 'monthly' ? 30 : 365) * 86400000).toISOString(),
        })
        .eq('user_id', user.id);

      if (error) throw error;

      // Record billing event
      await supabase.from('billing_events').insert([{
        user_id: user.id,
        event_type: 'subscription_upgraded',
        amount: finalPrice,
        tier: targetTier as 'free' | 'pro' | 'elite',
        metadata: { billing_interval: billingInterval, coupon: couponApplied?.code || null },
      }]);

      // Redeem coupon if applied
      if (couponApplied) {
        const { data: couponData } = await supabase
          .from('coupon_codes')
          .select('id, redemption_count')
          .eq('code', couponApplied.code)
          .single();

        if (couponData) {
          await supabase.from('coupon_redemptions').insert({
            coupon_id: couponData.id,
            user_id: user.id,
            discount_applied: couponApplied.type === 'percent'
              ? price * (couponApplied.discount / 100)
              : couponApplied.discount,
          });
          await supabase
            .from('coupon_codes')
            .update({ redemption_count: couponData.redemption_count + 1 })
            .eq('id', couponData.id);
        }
      }

      await refreshSubscription();
      toast({ title: '🎉 Upgrade Successful!', description: `You're now on the ${TIER_CONFIGS[targetTier].name} plan.` });
      navigate('/');
    } catch (err) {
      toast({ title: 'Upgrade Failed', description: 'Please try again.', variant: 'destructive' });
    } finally {
      setUpgrading(null);
    }
  };

  const tierOrder: SubscriptionTier[] = ['free', 'pro', 'elite'];
  const currentIdx = tierOrder.indexOf(currentTier);

  return (
    <AppLayout>
      <div className="container mx-auto px-4 py-6 max-w-5xl">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Choose Your Edge</h1>
          <p className="text-muted-foreground">Unlock advanced sniping tools and maximize your trading potential</p>
        </div>

        {/* Billing Toggle */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <button
            onClick={() => setBillingInterval('monthly')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              billingInterval === 'monthly' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setBillingInterval('yearly')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors relative ${
              billingInterval === 'yearly' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'
            }`}
          >
            Yearly
            <Badge className="absolute -top-2 -right-2 text-[9px] bg-success text-success-foreground px-1.5">
              Save 17%
            </Badge>
          </button>
        </div>

        {/* Coupon */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="flex items-center gap-2 max-w-xs">
            <Tag className="w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Coupon code"
              value={couponCode}
              onChange={(e) => setCouponCode(e.target.value)}
              className="h-9 text-sm"
            />
            <Button size="sm" variant="outline" onClick={validateCoupon} disabled={validatingCoupon}>
              Apply
            </Button>
          </div>
          {couponApplied && (
            <Badge variant="outline" className="text-success border-success/30">
              <Sparkles className="w-3 h-3 mr-1" />
              {couponApplied.type === 'percent' ? `${couponApplied.discount}% off` : `$${couponApplied.discount} off`}
            </Badge>
          )}
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-3 gap-4">
          {tiers.map((t) => {
            const config = TIER_CONFIGS[t];
            const Icon = tierIcons[t];
            const price = billingInterval === 'monthly' ? config.monthlyPrice : config.yearlyPrice;
            const discountedPrice = getDiscountedPrice(price);
            const isCurrent = t === currentTier;
            const canUpgrade = tierOrder.indexOf(t) > currentIdx;
            const isDowngrade = tierOrder.indexOf(t) < currentIdx;

            return (
              <Card key={t} className={`relative overflow-hidden transition-all ${
                config.popular ? 'border-primary/50 ring-1 ring-primary/20' : 'border-border/50'
              } ${isCurrent ? 'ring-2 ring-success/30 border-success/50' : ''}`}>
                {config.popular && (
                  <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-[10px] font-bold px-3 py-0.5 rounded-bl-lg">
                    MOST POPULAR
                  </div>
                )}
                {isCurrent && (
                  <div className="absolute top-0 left-0 bg-success text-success-foreground text-[10px] font-bold px-3 py-0.5 rounded-br-lg">
                    CURRENT PLAN
                  </div>
                )}

                <CardHeader className="pb-2 pt-6">
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`p-2 rounded-lg ${t === 'elite' ? 'bg-purple-500/10' : t === 'pro' ? 'bg-primary/10' : 'bg-secondary'}`}>
                      <Icon className={`w-5 h-5 ${t === 'elite' ? 'text-purple-400' : t === 'pro' ? 'text-primary' : 'text-muted-foreground'}`} />
                    </div>
                    <CardTitle className="text-lg">{config.name}</CardTitle>
                  </div>
                  <p className="text-xs text-muted-foreground">{config.description}</p>
                </CardHeader>

                <CardContent className="space-y-4">
                  {/* Price */}
                  <div>
                    {discountedPrice !== price && price > 0 ? (
                      <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-bold text-foreground">${discountedPrice.toFixed(0)}</span>
                        <span className="text-sm text-muted-foreground line-through">${price}</span>
                        <span className="text-xs text-muted-foreground">/{billingInterval === 'monthly' ? 'mo' : 'yr'}</span>
                      </div>
                    ) : (
                      <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-bold text-foreground">{price === 0 ? 'Free' : `$${price}`}</span>
                        {price > 0 && <span className="text-xs text-muted-foreground">/{billingInterval === 'monthly' ? 'mo' : 'yr'}</span>}
                      </div>
                    )}
                    {billingInterval === 'yearly' && price > 0 && (
                      <p className="text-[10px] text-success mt-0.5">
                        ${(price / 12).toFixed(0)}/mo — save ${(config.monthlyPrice * 12 - price).toFixed(0)}/year
                      </p>
                    )}
                  </div>

                  {/* Features */}
                  <ul className="space-y-2">
                    {config.features.map((feature, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs">
                        <Check className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0 ${t === 'elite' ? 'text-purple-400' : 'text-success'}`} />
                        <span className="text-foreground">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  {/* CTA */}
                  <Button
                    className="w-full"
                    variant={config.popular ? 'default' : 'outline'}
                    disabled={isCurrent || !!upgrading}
                    onClick={() => canUpgrade ? handleUpgrade(t) : isDowngrade ? navigate('/settings') : null}
                  >
                    {upgrading === t ? 'Processing...' : isCurrent ? 'Current Plan' : canUpgrade ? 'Upgrade' : isDowngrade ? 'Downgrade' : 'Get Started'}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* FAQ */}
        <div className="mt-12 text-center">
          <p className="text-xs text-muted-foreground">
            All plans include email support • Cancel anytime • 3-day grace period on failed payments
          </p>
        </div>
      </div>
    </AppLayout>
  );
}
