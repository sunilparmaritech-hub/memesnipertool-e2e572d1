import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const log = (step: string, details?: any) =>
  console.log(`[CONFIRM-PAYMENT] ${step}${details ? ` - ${JSON.stringify(details)}` : ""}`);

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    // Authenticate the caller
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      log("No auth header");
      return new Response(JSON.stringify({ error: "Authorization required" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const token = authHeader.replace("Bearer ", "");
    
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false },
    });
    const { data: userData, error: authError } = await authClient.auth.getUser();
    const userId = userData?.user?.id;
    
    if (authError || !userId) {
      log("Auth failed", { error: authError?.message });
      return new Response(JSON.stringify({ error: "Invalid authentication" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    log("Authenticated", { userId: userId.slice(0, 8) });

    const { txHash, packId, memo } = await req.json();
    if (!txHash || !packId) {
      return new Response(JSON.stringify({ error: "txHash and packId are required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    log("Starting verification", { txHash: txHash.slice(0, 16), packId });

    // Idempotency: check if already confirmed
    const { data: existing } = await supabase
      .from("credit_transactions")
      .select("id, status")
      .eq("tx_hash", txHash)
      .maybeSingle();

    if (existing?.status === "confirmed") {
      log("Already confirmed");
      return new Response(JSON.stringify({ success: true, alreadyConfirmed: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch pack details
    const { data: pack, error: packErr } = await supabase
      .from("credit_packs")
      .select("*")
      .eq("id", packId)
      .eq("is_active", true)
      .maybeSingle();

    if (!pack) {
      log("Pack not found", { packId, packErr });
      return new Response(JSON.stringify({ error: "Credit pack not found or inactive" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    log("Pack found", { name: pack.name, price: pack.sol_price });

    // Fetch admin wallet
    const { data: adminWallet, error: walletErr } = await supabase.rpc("get_payment_wallet");
    if (!adminWallet) {
      log("No admin wallet", { walletErr });
      return new Response(JSON.stringify({ error: "Payment wallet not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    log("Admin wallet", { wallet: adminWallet.slice(0, 8) });

    // Verify transaction on-chain via RPC
    const rpcUrl = Deno.env.get("SOLANA_RPC_URL") || "https://api.mainnet-beta.solana.com";

    // Poll for confirmation (up to 60s)
    let rpcTx: any = null;
    for (let attempt = 0; attempt < 20; attempt++) {
      try {
        const rpcResponse = await fetch(rpcUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0", id: 1,
            method: "getTransaction",
            params: [txHash, { encoding: "jsonParsed", maxSupportedTransactionVersion: 0 }],
          }),
        });
        const rpcResult = await rpcResponse.json();
        rpcTx = rpcResult?.result;
        if (rpcTx) break;
      } catch (rpcErr) {
        log("RPC fetch error", { attempt, error: String(rpcErr) });
      }
      log("TX not yet on-chain", { attempt });
      await new Promise(r => setTimeout(r, 3000));
    }

    if (!rpcTx) {
      log("TX not found after polling");
      // Update pending record with failure
      if (existing) {
        await supabase.from("credit_transactions").update({
          status: "failed", failure_reason: "Transaction not found on-chain after 60s",
        }).eq("id", existing.id);
      }
      return new Response(JSON.stringify({ error: "Transaction not found on-chain. Please wait and try again." }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (rpcTx.meta?.err) {
      log("TX failed on-chain", { err: rpcTx.meta.err });
      if (existing) {
        await supabase.from("credit_transactions").update({
          status: "failed", failure_reason: "Transaction failed on-chain",
        }).eq("id", existing.id);
      }
      return new Response(JSON.stringify({ error: "Transaction failed on-chain" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify SOL was received by admin wallet
    const preBalances = rpcTx.meta?.preBalances || [];
    const postBalances = rpcTx.meta?.postBalances || [];
    const accountKeys = rpcTx.transaction?.message?.accountKeys || [];

    log("TX account keys", { count: accountKeys.length, adminWallet: adminWallet.slice(0, 8) });

    let recipientIdx = -1;
    for (let i = 0; i < accountKeys.length; i++) {
      const pubkey = typeof accountKeys[i] === "string" ? accountKeys[i] : accountKeys[i]?.pubkey;
      if (pubkey === adminWallet) { recipientIdx = i; break; }
    }

    if (recipientIdx === -1) {
      log("Admin wallet not in tx accounts", { 
        keys: accountKeys.map((k: any) => typeof k === "string" ? k.slice(0, 8) : k?.pubkey?.slice(0, 8)),
        adminWallet: adminWallet.slice(0, 8)
      });
      if (existing) {
        await supabase.from("credit_transactions").update({
          status: "failed", failure_reason: "Payment was not sent to the correct admin wallet",
        }).eq("id", existing.id);
      }
      return new Response(JSON.stringify({ error: "Payment was not sent to the correct wallet" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const transferLamports = (postBalances[recipientIdx] || 0) - (preBalances[recipientIdx] || 0);
    const amountSol = transferLamports / 1_000_000_000;

    log("Transfer amount", { amountSol, expectedSol: pack.sol_price });

    if (amountSol <= 0) {
      if (existing) {
        await supabase.from("credit_transactions").update({
          status: "failed", failure_reason: "No SOL received by payment wallet",
        }).eq("id", existing.id);
      }
      return new Response(JSON.stringify({ error: "No SOL received by payment wallet" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Allow 1% tolerance
    const expectedSol = Number(pack.sol_price);
    if (amountSol < expectedSol * 0.99) {
      if (existing) {
        await supabase.from("credit_transactions").update({
          status: "failed", failure_reason: `Insufficient payment: sent ${amountSol.toFixed(6)} SOL, required ${expectedSol} SOL`,
        }).eq("id", existing.id);
      }
      return new Response(JSON.stringify({ error: `Insufficient payment` }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find sender
    const senderKey = typeof accountKeys[0] === "string" ? accountKeys[0] : accountKeys[0]?.pubkey;

    // ALL CHECKS PASSED — CREDIT THE USER
    const totalCredits = pack.credits_amount + (pack.bonus_credits || 0);
    log("Crediting user", { userId: userId.slice(0, 8), totalCredits, amountSol });

    // Update profile balance
    const { data: profile } = await supabase
      .from("profiles")
      .select("credit_balance, total_credits_purchased")
      .eq("user_id", userId)
      .maybeSingle();

    if (profile) {
      const { error: updateErr } = await supabase.from("profiles").update({
        credit_balance: (profile.credit_balance || 0) + totalCredits,
        total_credits_purchased: (profile.total_credits_purchased || 0) + totalCredits,
        updated_at: new Date().toISOString(),
      }).eq("user_id", userId);
      
      if (updateErr) {
        log("Profile update error", { error: updateErr.message });
      }
    } else {
      log("Profile not found for user", { userId: userId.slice(0, 8) });
    }

    // Record or update credit transaction
    const txRecord = {
      user_id: userId,
      tx_hash: txHash,
      sender_wallet: senderKey || "unknown",
      recipient_wallet: adminWallet,
      amount_sol: amountSol,
      credits_added: totalCredits,
      pack_id: packId,
      status: "confirmed",
      memo: memo || null,
      slot: rpcTx.slot,
      confirmed_at: new Date().toISOString(),
    };

    if (existing) {
      await supabase.from("credit_transactions").update(txRecord).eq("id", existing.id);
    } else {
      await supabase.from("credit_transactions").insert(txRecord);
    }

    // Send notification
    await supabase.from("notifications").insert({
      user_id: userId,
      title: "Credits Added!",
      message: `${totalCredits} credits added from ${pack.name} pack (${amountSol.toFixed(6)} SOL)`,
      type: "success",
    });

    log("SUCCESS", { credits: totalCredits });

    return new Response(JSON.stringify({ success: true, creditsAdded: totalCredits }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    log("ERROR", { message: String(error), stack: (error as Error).stack });
    return new Response(JSON.stringify({ error: "Something went wrong. Please contact support." }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
