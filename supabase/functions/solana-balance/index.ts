import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface BalanceRequest {
  publicKey: string;
}

const FALLBACK_RPCS = [
  "https://api.mainnet-beta.solana.com",
  "https://solana-mainnet.g.alchemy.com/v2/demo",
  "https://rpc.ankr.com/solana",
];

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

async function getBalanceWithFallback(primaryRpc: string, publicKey: string): Promise<{ balanceLamports: number; usedRpc: string }> {
  const rpcsToTry = [primaryRpc, ...FALLBACK_RPCS.filter(r => r !== primaryRpc)];
  
  for (const rpcUrl of rpcsToTry) {
    try {
      const balanceLamports = await getBalanceLamports(rpcUrl, publicKey);
      return { balanceLamports, usedRpc: rpcUrl };
    } catch (err: any) {
      const isRateLimit = err.message?.includes("429") || err.message?.includes("max usage");
      console.warn(`[SolanaBalance] RPC failed (${rpcUrl.slice(0, 40)}): ${err.message?.slice(0, 80)}`);
      if (!isRateLimit && rpcsToTry.indexOf(rpcUrl) === rpcsToTry.length - 1) {
        throw err; // Last RPC failed with non-rate-limit error
      }
    }
  }
  
  throw new Error("All RPC endpoints failed or rate-limited");
}

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Authorization required" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify user
    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid authentication" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body: BalanceRequest = await req.json().catch(() => ({ publicKey: "" }));
    if (!body.publicKey || typeof body.publicKey !== "string") {
      return new Response(JSON.stringify({ error: "Missing required field: publicKey" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const rpcUrl = Deno.env.get("SOLANA_RPC_URL") || "https://api.mainnet-beta.solana.com";

    let rpcHost = "unknown";
    try {
      rpcHost = new URL(rpcUrl).host;
    } catch {
      rpcHost = rpcUrl.slice(0, 32);
    }

    console.log(`[SolanaBalance] user=${user.id} primaryRpc=${rpcHost}`);

    const { balanceLamports, usedRpc } = await getBalanceWithFallback(rpcUrl, body.publicKey);
    const balanceSol = balanceLamports / 1e9;

    console.log(`[SolanaBalance] Success via ${usedRpc.slice(0, 40)} balance=${balanceSol}`);

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
