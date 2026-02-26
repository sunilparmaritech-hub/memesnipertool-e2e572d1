import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Get authenticated user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anonClient = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: authError } = await anonClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid authentication" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { referralCode } = await req.json();
    if (!referralCode || typeof referralCode !== "string") {
      return new Response(JSON.stringify({ error: "Missing referral code" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const code = referralCode.trim().toUpperCase();

    // Check if this user was already referred
    const { data: existingRef } = await supabase
      .from("referrals")
      .select("id")
      .eq("referred_id", user.id)
      .maybeSingle();

    if (existingRef) {
      return new Response(JSON.stringify({ error: "Already referred", alreadyReferred: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find the referrer by code
    const { data: referrer } = await supabase
      .from("profiles")
      .select("user_id, referral_code")
      .eq("referral_code", code)
      .maybeSingle();

    if (!referrer) {
      return new Response(JSON.stringify({ error: "Invalid referral code" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Can't refer yourself
    if (referrer.user_id === user.id) {
      return new Response(JSON.stringify({ error: "Cannot refer yourself" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const BONUS = 50;

    // Create referral record
    await supabase.from("referrals").insert({
      referrer_id: referrer.user_id,
      referred_id: user.id,
      referral_code: code,
      bonus_credited: true,
    });

    // Credit 50 to the referred user (new signup)
    await supabase.rpc("credit_referral_bonus", { target_user_id: user.id, bonus_amount: BONUS });

    // Credit 50 to the referrer
    await supabase.rpc("credit_referral_bonus", { target_user_id: referrer.user_id, bonus_amount: BONUS });

    // Update referrer stats
    await supabase
      .from("profiles")
      .update({
        total_referrals: (await supabase.from("referrals").select("id", { count: "exact" }).eq("referrer_id", referrer.user_id)).count || 0,
        referral_earnings: BONUS,
        referred_by: referrer.user_id,
      })
      .eq("user_id", user.id);

    // Increment referrer's total_referrals and earnings
    const { data: referrerProfile } = await supabase
      .from("profiles")
      .select("total_referrals, referral_earnings")
      .eq("user_id", referrer.user_id)
      .single();

    await supabase
      .from("profiles")
      .update({
        total_referrals: (referrerProfile?.total_referrals || 0) + 1,
        referral_earnings: (referrerProfile?.referral_earnings || 0) + BONUS,
      })
      .eq("user_id", referrer.user_id);

    return new Response(
      JSON.stringify({ success: true, bonus: BONUS }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("process-referral error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
