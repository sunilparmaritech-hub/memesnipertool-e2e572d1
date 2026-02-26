import { createClient } from "https://esm.sh/@supabase/supabase-js@2.90.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface TokenMetadata {
  address: string;
  symbol: string;
  name: string;
}

async function fetchTokenMetadataFromDexScreener(addresses: string[]): Promise<Map<string, TokenMetadata>> {
  const result = new Map<string, TokenMetadata>();
  
  // DexScreener allows up to 30 addresses per request
  const chunks = [];
  for (let i = 0; i < addresses.length; i += 30) {
    chunks.push(addresses.slice(i, i + 30));
  }
  
  for (const chunk of chunks) {
    try {
      const url = `https://api.dexscreener.com/latest/dex/tokens/${chunk.join(',')}`;
      const response = await fetch(url);
      
      if (!response.ok) {
        console.error(`DexScreener error: ${response.status}`);
        continue;
      }
      
      const data = await response.json();
      const pairs = data.pairs || [];
      
      // Get unique tokens from pairs
      for (const pair of pairs) {
        if (pair.chainId !== 'solana') continue;
        
        const baseToken = pair.baseToken;
        if (baseToken && chunk.includes(baseToken.address)) {
          result.set(baseToken.address, {
            address: baseToken.address,
            symbol: baseToken.symbol,
            name: baseToken.name,
          });
        }
        
        const quoteToken = pair.quoteToken;
        if (quoteToken && chunk.includes(quoteToken.address)) {
          result.set(quoteToken.address, {
            address: quoteToken.address,
            symbol: quoteToken.symbol,
            name: quoteToken.name,
          });
        }
      }
      
      // Rate limit
      await new Promise(r => setTimeout(r, 200));
    } catch (error) {
      console.error("DexScreener fetch error:", error);
    }
  }
  
  return result;
}

function isPlaceholderSymbol(symbol: string | null): boolean {
  if (!symbol) return true;
  // Check for truncated addresses like "BrRf…tERd" or "7tAi...dmX4"
  return symbol.includes('…') || symbol.includes('...') || 
    /^[A-Za-z0-9]{4}[…\.]+[A-Za-z0-9]{4}$/.test(symbol);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid authentication" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[FixMetadata] Starting for user ${user.id}`);

    // Get all trades with placeholder symbols
    const { data: trades } = await supabase
      .from("trade_history")
      .select("id, token_address, token_symbol, token_name")
      .eq("user_id", user.id);

    // Filter to those needing fixes
    const needsFix = (trades || []).filter(t => isPlaceholderSymbol(t.token_symbol));
    console.log(`[FixMetadata] Found ${needsFix.length} trades with placeholder symbols`);

    if (needsFix.length === 0) {
      return new Response(
        JSON.stringify({ success: true, fixed: 0, message: "No placeholder symbols to fix" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get unique addresses
    const addresses = [...new Set(needsFix.map(t => t.token_address))];
    console.log(`[FixMetadata] Fetching metadata for ${addresses.length} unique tokens`);

    // Fetch from DexScreener
    const metadata = await fetchTokenMetadataFromDexScreener(addresses);
    console.log(`[FixMetadata] Got metadata for ${metadata.size} tokens`);

    // Update records
    let fixedCount = 0;
    for (const trade of needsFix) {
      const meta = metadata.get(trade.token_address);
      if (meta) {
        const { error } = await supabase
          .from("trade_history")
          .update({
            token_symbol: meta.symbol,
            token_name: meta.name,
          })
          .eq("id", trade.id);

        if (!error) {
          fixedCount++;
        }
      }
    }

    // Also fix positions table
    const { data: positions } = await supabase
      .from("positions")
      .select("id, token_address, token_symbol, token_name")
      .eq("user_id", user.id);

    const positionsNeedsFix = (positions || []).filter(p => isPlaceholderSymbol(p.token_symbol));
    let positionsFixed = 0;
    
    for (const pos of positionsNeedsFix) {
      const meta = metadata.get(pos.token_address);
      if (meta) {
        const { error } = await supabase
          .from("positions")
          .update({
            token_symbol: meta.symbol,
            token_name: meta.name,
          })
          .eq("id", pos.id);

        if (!error) {
          positionsFixed++;
        }
      }
    }

    console.log(`[FixMetadata] Fixed ${fixedCount} trades, ${positionsFixed} positions`);

    return new Response(
      JSON.stringify({
        success: true,
        tradesFixed: fixedCount,
        positionsFixed: positionsFixed,
        totalTokensLookedUp: metadata.size,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[FixMetadata] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to fix metadata" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
