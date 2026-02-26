import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { transaction } = await req.json();
    if (!transaction) throw new Error("Missing transaction payload");

    const rpcUrl = Deno.env.get("SOLANA_RPC_URL") || "https://api.mainnet-beta.solana.com";

    const res = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "sendTransaction",
        params: [transaction, { encoding: "base64", skipPreflight: false, preflightCommitment: "confirmed" }],
      }),
    });

    const data = await res.json();

    if (data.error) {
      const msg = data.error.message || "Transaction failed";
      // Map common Solana errors to friendly messages
      if (msg.includes("insufficient") || msg.includes("0x1")) {
        throw new Error("Insufficient SOL balance for this transaction");
      }
      throw new Error(msg);
    }

    return new Response(
      JSON.stringify({ success: true, txHash: data.result }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
