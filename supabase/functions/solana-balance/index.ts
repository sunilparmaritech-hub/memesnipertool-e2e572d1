import { createClient } from "https://esm.sh/@supabase/supabase-js@2.90.1";
import { getApiKey } from "../_shared/api-keys.ts";
import { checkRateLimit, rateLimitResponse, SOL_PRICE_LIMIT } from "../_shared/rate-limiter.ts";

const BALANCE_LIMIT = { ...SOL_PRICE_LIMIT, maxRequests: 20, functionName: 'solana-balance' };

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface BalanceRequest {
  publicKey: string;
}

async function getBalanceLamports(rpcUrl: string, publicKey: string): Promise<number> {
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "getBalance",
      params: [publicKey],
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`RPC error ${response.status}: ${text.slice(0, 120)}`);
  }

  const data = await response.json();
  if (data?.error) {
    throw new Error(data.error?.message || "RPC returned an error");
  }

  const lamports = Number(data?.result?.value ?? 0);
  return Number.isFinite(lamports) ? lamports : 0;
}

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Authorization required" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const token = authHeader.replace("Bearer ", "");
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Verify user - pass token explicitly to avoid HTML error pages
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user?.id) {
      console.error("[SolanaBalance] Auth error:", authError?.message);
      return new Response(JSON.stringify({ error: "Invalid authentication" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = user.id;

    // Per-user rate limiting
    const rl = checkRateLimit(userId, BALANCE_LIMIT);
    if (!rl.allowed) return rateLimitResponse(rl, corsHeaders);

    const body: BalanceRequest = await req.json().catch(() => ({ publicKey: "" }));
    if (!body.publicKey || typeof body.publicKey !== "string") {
      return new Response(JSON.stringify({ error: "Missing required field: publicKey" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const rpcUrl = await getApiKey('rpc_provider') || "https://api.mainnet-beta.solana.com";

    let rpcHost = "unknown";
    try {
      rpcHost = new URL(rpcUrl).host;
    } catch {
      rpcHost = rpcUrl.slice(0, 32);
    }

    console.log(`[SolanaBalance] user=${userId} rpcHost=${rpcHost}`);

    const balanceLamports = await getBalanceLamports(rpcUrl, body.publicKey);
    const balanceSol = balanceLamports / 1e9;

    return new Response(
      JSON.stringify({
        success: true,
        publicKey: body.publicKey,
        balanceLamports,
        balanceSol,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[SolanaBalance] Error:", error);
    return new Response(JSON.stringify({ error: error.message || "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
