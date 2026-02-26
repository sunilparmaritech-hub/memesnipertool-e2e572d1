import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-CHECKOUT] ${step}${detailsStr}`);
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
      logStep("STRIPE_SECRET_KEY_TEST not set, falling back to live key");
    }

    const liveKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!liveKey) throw new Error("STRIPE_SECRET_KEY is not set");
    return { key: liveKey, mode: "live" };
  } catch (err) {
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
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    logStep("Function started");

    const { key: stripeKey, mode: stripeMode } = await getStripeKey(supabaseAdmin);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { userId: user.id, email: user.email });

    const { priceId } = await req.json();
    if (!priceId) throw new Error("priceId is required");
    logStep("Price ID received", { priceId, stripeMode });

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Check for existing customer
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
      logStep("Existing customer found", { customerId });
    }

    const successUrl = "https://alphamemesniper.com/pricing?checkout=success";
    const cancelUrl = "https://alphamemesniper.com/pricing?checkout=canceled";

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [{ price: priceId, quantity: 1 }],
      mode: "subscription",
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: { user_id: user.id },
    });

    logStep("Checkout session created", { sessionId: session.id, stripeMode });

    return new Response(JSON.stringify({ url: session.url }), {
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
