import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Jupiter API endpoints
const JUPITER_QUOTE_API = "https://quote-api.jup.ag/v6/quote";
const JUPITER_SWAP_API = "https://quote-api.jup.ag/v6/swap";

// Common token addresses
const SOL_MINT = "So11111111111111111111111111111111111111112";
const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

interface QuoteRequest {
  inputMint: string;
  outputMint: string;
  amount: string; // in lamports or smallest unit
  slippageBps?: number; // basis points (100 = 1%)
  onlyDirectRoutes?: boolean;
}

interface SwapRequest {
  quoteResponse: any;
  userPublicKey: string;
  wrapUnwrapSOL?: boolean;
  computeUnitPriceMicroLamports?: number;
  dynamicComputeUnitLimit?: boolean;
  prioritizationFeeLamports?: number | "auto";
}

interface TradeRequest {
  action: "quote" | "swap" | "execute";
  inputMint?: string;
  outputMint?: string;
  amount?: string;
  slippageBps?: number;
  userPublicKey?: string;
  quoteResponse?: any;
  priorityLevel?: "low" | "medium" | "high" | "veryHigh";
  // Position tracking
  tokenSymbol?: string;
  tokenName?: string;
  profitTakePercent?: number;
  stopLossPercent?: number;
}

// Priority fee levels in microLamports
const PRIORITY_FEES = {
  low: 1000,       // 0.001 lamports
  medium: 10000,   // 0.01 lamports
  high: 100000,    // 0.1 lamports
  veryHigh: 500000, // 0.5 lamports
};

async function getJupiterQuote(request: QuoteRequest): Promise<any> {
  const params = new URLSearchParams({
    inputMint: request.inputMint,
    outputMint: request.outputMint,
    amount: request.amount,
    slippageBps: String(request.slippageBps || 100), // Default 1%
    onlyDirectRoutes: String(request.onlyDirectRoutes || false),
  });

  console.log(`[Jupiter] Fetching quote: ${params.toString()}`);

  const response = await fetch(`${JUPITER_QUOTE_API}?${params}`);
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[Jupiter] Quote error: ${response.status} - ${errorText}`);
    throw new Error(`Jupiter quote failed: ${response.status}`);
  }

  const quote = await response.json();
  console.log(`[Jupiter] Quote received: ${quote.outAmount} output for ${request.amount} input`);
  
  return quote;
}

async function getJupiterSwap(request: SwapRequest): Promise<any> {
  console.log(`[Jupiter] Building swap transaction for ${request.userPublicKey}`);

  const response = await fetch(JUPITER_SWAP_API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      quoteResponse: request.quoteResponse,
      userPublicKey: request.userPublicKey,
      wrapAndUnwrapSol: request.wrapUnwrapSOL ?? true,
      computeUnitPriceMicroLamports: request.computeUnitPriceMicroLamports,
      dynamicComputeUnitLimit: request.dynamicComputeUnitLimit ?? true,
      prioritizationFeeLamports: request.prioritizationFeeLamports,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[Jupiter] Swap build error: ${response.status} - ${errorText}`);
    throw new Error(`Jupiter swap build failed: ${response.status}`);
  }

  const swapData = await response.json();
  console.log(`[Jupiter] Swap transaction built successfully`);
  
  return swapData;
}

async function getPriorityFeeEstimate(connection: string): Promise<number> {
  // Fetch recent priority fees from RPC
  try {
    const response = await fetch(connection, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getRecentPrioritizationFees",
        params: [],
      }),
    });

    if (response.ok) {
      const data = await response.json();
      if (data.result && data.result.length > 0) {
        // Get median fee from recent transactions
        const fees = data.result.map((f: any) => f.prioritizationFee).sort((a: number, b: number) => a - b);
        const medianFee = fees[Math.floor(fees.length / 2)];
        console.log(`[Priority] Median priority fee: ${medianFee} microLamports`);
        return Math.max(medianFee, PRIORITY_FEES.low);
      }
    }
  } catch (error) {
    console.error("[Priority] Failed to fetch priority fees:", error);
  }
  
  return PRIORITY_FEES.medium;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get auth token from request
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify user
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid authentication" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: TradeRequest = await req.json();
    console.log(`[Trade] Action: ${body.action}, User: ${user.id}`);

    // Get RPC URL from environment or use public fallback
    const rpcUrl = Deno.env.get("SOLANA_RPC_URL") || "https://api.mainnet-beta.solana.com";

    let rpcHost = "unknown";
    try {
      rpcHost = new URL(rpcUrl).host;
    } catch {
      rpcHost = rpcUrl.slice(0, 32);
    }

    console.log(`[Trade] Using RPC host: ${rpcHost}`);

    // Handle different actions
    switch (body.action) {
      case "quote": {
        if (!body.inputMint || !body.outputMint || !body.amount) {
          return new Response(
            JSON.stringify({ error: "Missing required fields: inputMint, outputMint, amount" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const quote = await getJupiterQuote({
          inputMint: body.inputMint,
          outputMint: body.outputMint,
          amount: body.amount,
          slippageBps: body.slippageBps || 100,
        });

        // Calculate price impact and other metrics
        const inputAmount = parseInt(body.amount);
        const outputAmount = parseInt(quote.outAmount);
        const priceImpactPct = parseFloat(quote.priceImpactPct || "0");

        return new Response(
          JSON.stringify({
            success: true,
            quote: {
              ...quote,
              inputAmount,
              outputAmount,
              priceImpactPct,
              slippageBps: body.slippageBps || 100,
            },
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "swap": {
        if (!body.quoteResponse || !body.userPublicKey) {
          return new Response(
            JSON.stringify({ error: "Missing required fields: quoteResponse, userPublicKey" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Calculate priority fee based on level
        let priorityFee: number;
        if (body.priorityLevel) {
          priorityFee = PRIORITY_FEES[body.priorityLevel];
        } else {
          priorityFee = await getPriorityFeeEstimate(rpcUrl);
        }

        console.log(`[Trade] Using priority fee: ${priorityFee} microLamports`);

        const swapData = await getJupiterSwap({
          quoteResponse: body.quoteResponse,
          userPublicKey: body.userPublicKey,
          wrapUnwrapSOL: true,
          computeUnitPriceMicroLamports: priorityFee,
          dynamicComputeUnitLimit: true,
        });

        return new Response(
          JSON.stringify({
            success: true,
            swapTransaction: swapData.swapTransaction,
            lastValidBlockHeight: swapData.lastValidBlockHeight,
            priorityFeeUsed: priorityFee,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "execute": {
        // Full execution flow: quote -> swap -> return transaction
        if (!body.inputMint || !body.outputMint || !body.amount || !body.userPublicKey) {
          return new Response(
            JSON.stringify({ 
              error: "Missing required fields: inputMint, outputMint, amount, userPublicKey" 
            }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Step 1: Get quote
        const quote = await getJupiterQuote({
          inputMint: body.inputMint,
          outputMint: body.outputMint,
          amount: body.amount,
          slippageBps: body.slippageBps || 100,
        });

        // Step 2: Calculate priority fee
        let priorityFee: number;
        if (body.priorityLevel) {
          priorityFee = PRIORITY_FEES[body.priorityLevel];
        } else {
          priorityFee = await getPriorityFeeEstimate(rpcUrl);
        }

        // Step 3: Build swap transaction
        const swapData = await getJupiterSwap({
          quoteResponse: quote,
          userPublicKey: body.userPublicKey,
          wrapUnwrapSOL: true,
          computeUnitPriceMicroLamports: priorityFee,
          dynamicComputeUnitLimit: true,
        });

        // Step 4: Create pending position in database (will be confirmed after tx)
        const inputAmountLamports = parseInt(body.amount);
        const outputAmountLamports = parseInt(quote.outAmount);
        const inputDecimals = body.inputMint === SOL_MINT ? 9 : 6;
        const outputDecimals = body.outputMint === SOL_MINT ? 9 : 6;
        
        const inputAmountDecimal = inputAmountLamports / Math.pow(10, inputDecimals);
        const outputAmountDecimal = outputAmountLamports / Math.pow(10, outputDecimals);
        const entryPrice = inputAmountDecimal / outputAmountDecimal;

        // Create pending position
        const { data: position, error: posError } = await supabase
          .from("positions")
          .insert({
            user_id: user.id,
            token_address: body.outputMint,
            token_symbol: body.tokenSymbol || "TOKEN",
            token_name: body.tokenName || "Unknown Token",
            chain: "solana",
            entry_price: entryPrice,
            current_price: entryPrice,
            amount: outputAmountDecimal,
            entry_value: inputAmountDecimal,
            current_value: inputAmountDecimal,
            profit_take_percent: body.profitTakePercent || 50,
            stop_loss_percent: body.stopLossPercent || 20,
            status: "pending",
          })
          .select()
          .single();

        if (posError) {
          console.error("[Trade] Failed to create position:", posError);
        }

        return new Response(
          JSON.stringify({
            success: true,
            quote: {
              inputAmount: inputAmountLamports,
              outputAmount: outputAmountLamports,
              inputAmountDecimal,
              outputAmountDecimal,
              priceImpactPct: parseFloat(quote.priceImpactPct || "0"),
              slippageBps: body.slippageBps || 100,
              route: quote.routePlan?.map((r: any) => r.swapInfo?.label).join(" → "),
            },
            swapTransaction: swapData.swapTransaction,
            lastValidBlockHeight: swapData.lastValidBlockHeight,
            priorityFeeUsed: priorityFee,
            positionId: position?.id,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: "Invalid action. Use: quote, swap, or execute" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
  } catch (error: any) {
    console.error("[Trade] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
