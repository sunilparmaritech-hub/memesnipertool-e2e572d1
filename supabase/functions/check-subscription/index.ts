import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CHECK-SUBSCRIPTION] ${step}${detailsStr}`);
};

// Map Stripe product IDs to plan names
const PRODUCT_TO_PLAN: Record<string, string> = {
  "prod_U1OvIsYlYn0uMB": "pro",
  "prod_U1OvlL9C0PfgIQ": "elite",
  "prod_U1OwxRIOwD5kLU": "pro",
  "prod_U1OwlSvDIRZQHH": "elite",
};

async function getStripeKey(supabaseAdmin: any): Promise<{ key: string; mode: string }> {
  try {
    const { data } = await supabaseAdmin
      .from("admin_settings")
      .select("setting_value")
      .eq("setting_key", "stripe_mode")
      .maybeSingle();

    const mode = data?.setting_value?.mode || "live";
    logStep("Stripe mode resolved", { mode });

    if (mode === "sandbox") {
      const testKey = Deno.env.get("STRIPE_SECRET_KEY_TEST");
      if (testKey) return { key: testKey, mode: "sandbox" };
    }

    const liveKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!liveKey) throw new Error("STRIPE_SECRET_KEY is not set");
    return { key: liveKey, mode: "live" };
  } catch {
    const liveKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!liveKey) throw new Error("STRIPE_SECRET_KEY is not set");
    return { key: liveKey, mode: "live" };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    logStep("Function started");

    const { key: stripeKey, mode: stripeMode } = await getStripeKey(supabaseClient);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { userId: user.id, email: user.email, stripeMode });

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });

    if (customers.data.length === 0) {
      logStep("No Stripe customer found");
      await supabaseClient.from("subscriptions").upsert({
        user_id: user.id,
        plan: "free",
        status: "active",
      }, { onConflict: "user_id" });

      return new Response(JSON.stringify({ subscribed: false, plan: "free" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const customerId = customers.data[0].id;
    logStep("Found Stripe customer", { customerId });

    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "active",
      limit: 1,
    });

    const hasActiveSub = subscriptions.data.length > 0;
    let plan = "free";
    let subscriptionEnd = null;
    let stripeSubscriptionId = null;
    let billingInterval = "monthly";

    if (hasActiveSub) {
      const subscription = subscriptions.data[0];
      stripeSubscriptionId = subscription.id;
      try {
        subscriptionEnd = new Date(subscription.current_period_end * 1000).toISOString();
      } catch {
        subscriptionEnd = null;
        logStep("Warning: could not parse current_period_end", { raw: subscription.current_period_end });
      }
      const productId = subscription.items.data[0].price.product as string;
      plan = PRODUCT_TO_PLAN[productId] || "pro";
      billingInterval = subscription.items.data[0].price.recurring?.interval === "year" ? "yearly" : "monthly";
      logStep("Active subscription found", { plan, subscriptionEnd, billingInterval });
    } else {
      logStep("No active subscription");
    }

    // Sync to subscriptions table
    await supabaseClient.from("subscriptions").upsert({
      user_id: user.id,
      plan,
      status: hasActiveSub ? "active" : "expired",
      stripe_customer_id: customerId,
      stripe_subscription_id: stripeSubscriptionId,
      current_period_end: subscriptionEnd,
      billing_interval: billingInterval,
    }, { onConflict: "user_id" });

    return new Response(JSON.stringify({
      subscribed: hasActiveSub,
      plan,
      subscription_end: subscriptionEnd,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
