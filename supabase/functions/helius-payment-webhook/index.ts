import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const log = (step: string, details?: any) => {
  console.log(`[HELIUS-PAYMENT] ${step}${details ? ` - ${JSON.stringify(details)}` : ""}`);
};

const MEMO_PATTERN = /^AMS-([a-f0-9-]{36})-([a-f0-9-]{36})-(\d+)$/;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } }
  );

  try {
    // Validate webhook auth token from admin_settings
    const { data: webhookSetting } = await supabase
      .from("admin_settings")
      .select("setting_value")
      .eq("setting_key", "payment_settings")
      .maybeSingle();

    const paymentConfig = webhookSetting?.setting_value as any || {};
    const webhookSecret = paymentConfig.helius_webhook_secret;

    // Validate auth header if webhook secret is configured
    const authToken = req.headers.get("authorization")?.replace("Bearer ", "");
    if (webhookSecret && authToken !== webhookSecret) {
      log("UNAUTHORIZED", { hasToken: !!authToken });
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const transactions = Array.isArray(body) ? body : [body];
    log("Webhook received", { count: transactions.length });

    const adminWallet = paymentConfig.receiving_wallet;
    if (!adminWallet) {
      log("ERROR: No receiving wallet configured");
      return new Response(JSON.stringify({ error: "Receiving wallet not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const rpcUrl = Deno.env.get("SOLANA_RPC_URL") || "https://api.mainnet-beta.solana.com";
    const requiredConfirmations = paymentConfig.required_confirmations || 1;
    let processed = 0;

    for (const tx of transactions) {
      try {
        const signature = tx.signature || tx.transaction?.signatures?.[0];
        if (!signature) continue;

        // Check if already confirmed (idempotency)
        const { data: existing } = await supabase
          .from("credit_transactions")
          .select("id, status")
          .eq("tx_hash", signature)
          .maybeSingle();

        if (existing && existing.status === "confirmed") {
          log("TX already confirmed", { signature });
          continue;
        }

        // ── RPC DOUBLE VERIFICATION ────────────────────────────────
        log("RPC verification starting", { signature });

        const rpcResponse = await fetch(rpcUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "getTransaction",
            params: [signature, { encoding: "jsonParsed", maxSupportedTransactionVersion: 0 }],
          }),
        });

        const rpcResult = await rpcResponse.json();
        const rpcTx = rpcResult?.result;

        if (!rpcTx) {
          log("TX not found on RPC", { signature });
          await insertFailedTx(supabase, signature, "Transaction not found on-chain");
          continue;
        }

        if (rpcTx.meta?.err) {
          log("TX failed on-chain", { signature, err: rpcTx.meta.err });
          await insertFailedTx(supabase, signature, "Transaction failed on-chain");
          continue;
        }

        // Check confirmations
        const slot = rpcTx.slot;
        const statusResp = await fetch(rpcUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: 2,
            method: "getSlot",
            params: [{ commitment: "confirmed" }],
          }),
        });
        const slotResult = await statusResp.json();
        const currentSlot = slotResult?.result || 0;
        const confirmations = currentSlot - slot;

        if (confirmations < requiredConfirmations) {
          log("Insufficient confirmations", { signature, confirmations, required: requiredConfirmations });
          await insertFailedTx(supabase, signature, `Only ${confirmations} confirmations (need ${requiredConfirmations})`);
          continue;
        }

        // Parse SOL transfer
        const preBalances = rpcTx.meta?.preBalances || [];
        const postBalances = rpcTx.meta?.postBalances || [];
        const accountKeys = rpcTx.transaction?.message?.accountKeys || [];

        let recipientIdx = -1;
        let senderIdx = -1;
        let transferLamports = 0;

        for (let i = 0; i < accountKeys.length; i++) {
          const pubkey = typeof accountKeys[i] === "string" ? accountKeys[i] : accountKeys[i]?.pubkey;
          if (pubkey === adminWallet) {
            recipientIdx = i;
            break;
          }
        }

        if (recipientIdx === -1) {
          log("Admin wallet not found in tx", { signature, adminWallet });
          await insertFailedTx(supabase, signature, "Recipient is not admin wallet");
          continue;
        }

        // Calculate how much the admin wallet received
        transferLamports = (postBalances[recipientIdx] || 0) - (preBalances[recipientIdx] || 0);
        const amountSol = transferLamports / 1_000_000_000;

        if (amountSol <= 0) {
          log("No positive transfer to admin", { signature, amountSol });
          await insertFailedTx(supabase, signature, "No SOL received by admin wallet");
          continue;
        }

        // Find sender (first signer)
        const senderKey = typeof accountKeys[0] === "string" ? accountKeys[0] : accountKeys[0]?.pubkey;

        // Parse memo
        let userId: string | null = null;
        let packId: string | null = null;
        let memoStr = "";

        // Try to find memo in log messages
        const logMessages = rpcTx.meta?.logMessages || [];
        for (const msg of logMessages) {
          const memoMatch = msg.match(/Memo.*?:\s*"(.+?)"/);
          if (memoMatch) {
            memoStr = memoMatch[1];
            break;
          }
        }

        // Also check instructions for memo program
        const instructions = rpcTx.transaction?.message?.instructions || [];
        for (const ix of instructions) {
          if (ix.programId === "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr" ||
              ix.programId === "Memo1UhkJBfCR6MNhJBZNZCECLGmpvHqWcErECDMmsR") {
            memoStr = ix.parsed || ix.data || "";
            break;
          }
        }

        const memoMatch = memoStr.match(MEMO_PATTERN);
        if (memoMatch) {
          userId = memoMatch[1];
          packId = memoMatch[2];
        }

        if (!userId || !packId) {
          log("Invalid memo format", { signature, memo: memoStr });
          await insertFailedTx(supabase, signature, `Invalid memo: ${memoStr}`);
          continue;
        }

        // Validate pack exists and price matches
        const { data: pack } = await supabase
          .from("credit_packs")
          .select("*")
          .eq("id", packId)
          .eq("is_active", true)
          .maybeSingle();

        if (!pack) {
          log("Pack not found", { packId });
          await insertFailedTx(supabase, signature, "Credit pack not found or inactive");
          continue;
        }

        // Allow 1% tolerance for price matching (network fees)
        const expectedSol = Number(pack.sol_price);
        if (amountSol < expectedSol * 0.99) {
          log("Insufficient payment", { signature, amountSol, expectedSol });
          await insertFailedTx(supabase, signature, `Payment ${amountSol} SOL < required ${expectedSol} SOL`);
          continue;
        }

        // ── ALL CHECKS PASSED — CREDIT THE USER ────────────────────
        const totalCredits = pack.credits_amount + (pack.bonus_credits || 0);

        // Atomic credit update
        const { error: profileError } = await supabase.rpc("add_user_credits_atomic", {
          p_user_id: userId,
          p_credits: totalCredits,
        });

        // If the RPC doesn't exist, fallback to manual update
        if (profileError) {
          log("RPC fallback - manual update", { error: profileError.message });
          const { data: profile } = await supabase
            .from("profiles")
            .select("credit_balance, total_credits_purchased")
            .eq("user_id", userId)
            .maybeSingle();

          if (profile) {
            await supabase
              .from("profiles")
              .update({
                credit_balance: (profile.credit_balance || 0) + totalCredits,
                total_credits_purchased: (profile.total_credits_purchased || 0) + totalCredits,
                updated_at: new Date().toISOString(),
              })
              .eq("user_id", userId);
          }
        }

        // Record or update the transaction
        if (existing) {
          // Update existing pending record
          await supabase.from("credit_transactions").update({
            sender_wallet: senderKey,
            recipient_wallet: adminWallet,
            amount_sol: amountSol,
            credits_added: totalCredits,
            pack_id: packId,
            status: "confirmed",
            memo: memoStr,
            slot,
            confirmed_at: new Date().toISOString(),
          }).eq("id", existing.id);
        } else {
          await supabase.from("credit_transactions").insert({
            user_id: userId,
            tx_hash: signature,
            sender_wallet: senderKey,
            recipient_wallet: adminWallet,
            amount_sol: amountSol,
            credits_added: totalCredits,
            pack_id: packId,
            status: "confirmed",
            memo: memoStr,
            slot,
            confirmed_at: new Date().toISOString(),
          });
        }

        // Send notification
        await supabase.from("notifications").insert({
          user_id: userId,
          title: "Credits Added!",
          message: `${totalCredits} credits added from ${pack.name} pack (${amountSol.toFixed(4)} SOL)`,
          type: "success",
        });

        log("Credits added successfully", { userId, credits: totalCredits, signature });
        processed++;
      } catch (txError) {
        log("Error processing tx", { error: String(txError) });
      }
    }

    return new Response(JSON.stringify({ processed, total: transactions.length }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    log("ERROR", { message: String(error) });
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function insertFailedTx(supabase: any, txHash: string, reason: string) {
  try {
    await supabase.from("credit_transactions").insert({
      user_id: "00000000-0000-0000-0000-000000000000",
      tx_hash: txHash,
      sender_wallet: "unknown",
      recipient_wallet: "unknown",
      amount_sol: 0,
      credits_added: 0,
      status: "failed",
      failure_reason: reason,
    }).onConflict("tx_hash").ignore();
  } catch {
    // Ignore duplicate insert errors
  }
}
