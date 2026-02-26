import { createClient } from "https://esm.sh/@supabase/supabase-js@2.90.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * TRANSACTION CONFIRMATION & LOGGING
 * 
 * CRITICAL RULES:
 * 1. Only log transactions AFTER on-chain confirmation
 * 2. Use semantic columns: sol_spent (BUY), sol_received (SELL)
 * 3. Calculate P&L using SOL delta, never from price math
 * 4. ROI is ONLY for SELL transactions with matched BUY
 * 5. Token metadata MUST come from same source as positions to ensure consistency
 */

interface ConfirmRequest {
  signature: string;
  positionId?: string;
  action: "buy" | "sell";
  walletAddress?: string; // CRITICAL: Needed for correct SOL delta extraction
  // Semantic SOL values (source of truth)
  solSpent?: number;      // For BUY: actual SOL deducted
  solReceived?: number;   // For SELL: actual SOL received
  // Additional metadata for trade history logging
  tokenAddress?: string;
  tokenSymbol?: string;
  tokenName?: string;
  amount?: number;
  priceUsd?: number;
  priceSol?: number;
  // Extended metadata for comprehensive logging
  buyerPosition?: number;
  liquidity?: number;
  riskScore?: number;
  entryPrice?: number;
  exitPrice?: number;
  slippage?: number;
  // For FIFO P&L matching
  matchedBuySolSpent?: number;
}

/**
 * Fetch token metadata from DexScreener to ensure consistent naming
 */
async function fetchTokenMetadata(tokenAddress: string): Promise<{ symbol: string; name: string } | null> {
  try {
    const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`);
    if (!response.ok) return null;
    
    const data = await response.json();
    const pairs = data.pairs || [];
    
    for (const pair of pairs) {
      if (pair.chainId === 'solana' && pair.baseToken?.address === tokenAddress) {
        return {
          symbol: pair.baseToken.symbol,
          name: pair.baseToken.name,
        };
      }
    }
    return null;
  } catch (error) {
    console.warn('[Confirm] Failed to fetch token metadata:', error);
    return null;
  }
}

/**
 * Find the wallet's index in the transaction's account keys
 * CRITICAL: Never assume wallet is at index 0 - AMM pools and programs often occupy earlier indices
 */
function findWalletIndexInTx(tx: any, walletAddress: string): number {
  const accountKeys = tx?.transaction?.message?.accountKeys || [];
  for (let i = 0; i < accountKeys.length; i++) {
    const key = accountKeys[i];
    const pubkey = typeof key === 'string' ? key : (key?.pubkey || key?.toString?.() || '');
    if (pubkey === walletAddress) return i;
  }
  return -1;
}

async function confirmTransaction(
  rpcUrl: string,
  signature: string,
  walletAddress?: string,
  maxRetries: number = 30
): Promise<{ confirmed: boolean; slot?: number; error?: string; isSlippageError?: boolean; solDelta?: number }> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(rpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "getSignatureStatuses",
          params: [[signature], { searchTransactionHistory: true }],
        }),
      });

      if (!response.ok) {
        console.error(`[Confirm] RPC error: ${response.status}`);
        await new Promise((r) => setTimeout(r, 1000));
        continue;
      }

      const data = await response.json();
      const status = data.result?.value?.[0];

      if (status) {
        if (status.err) {
          console.error(`[Confirm] Transaction failed:`, status.err);
          
          const errString = JSON.stringify(status.err);
          const isSlippageError = 
            errString.includes('6024') || 
            errString.includes('1771') || 
            errString.toLowerCase().includes('slippage');
          
          return { 
            confirmed: false, 
            error: errString,
            isSlippageError,
          };
        }

        if (status.confirmationStatus === "confirmed" || status.confirmationStatus === "finalized") {
          console.log(`[Confirm] Transaction confirmed at slot ${status.slot}`);
          
          // Fetch actual SOL delta from on-chain transaction
          let solDelta: number | undefined = undefined;
          try {
            const txResponse = await fetch(rpcUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                jsonrpc: "2.0",
                id: 1,
                method: "getTransaction",
                params: [signature, { encoding: "jsonParsed", maxSupportedTransactionVersion: 0 }],
              }),
            });
            
            if (txResponse.ok) {
              const txData = await txResponse.json();
              const tx = txData.result;
              if (tx?.meta?.preBalances && tx?.meta?.postBalances) {
                // CRITICAL FIX: Find the wallet's actual index instead of assuming index 0
                let walletIdx = 0;
                if (walletAddress) {
                  const idx = findWalletIndexInTx(tx, walletAddress);
                  if (idx >= 0) {
                    walletIdx = idx;
                    console.log(`[Confirm] Wallet found at tx index ${walletIdx}`);
                  } else {
                    console.warn(`[Confirm] Wallet ${walletAddress.slice(0,8)}... not found in tx accounts, defaulting to index 0`);
                  }
                }
                const preBal = tx.meta.preBalances[walletIdx] || 0;
                const postBal = tx.meta.postBalances[walletIdx] || 0;
                const fee = tx.meta.fee || 0;
                // Net SOL change excluding tx fee (fee is an infrastructure cost, not trade P&L)
                solDelta = (postBal - preBal + fee) / 1e9;
                console.log(`[Confirm] SOL delta: pre=${(preBal/1e9).toFixed(6)} post=${(postBal/1e9).toFixed(6)} fee=${(fee/1e9).toFixed(6)} delta=${solDelta.toFixed(6)}`);
              }
            }
          } catch (e) {
            console.warn("[Confirm] Could not fetch SOL delta:", e);
          }
          
          return { confirmed: true, slot: status.slot, solDelta };
        }
      }

      await new Promise((r) => setTimeout(r, 500));
    } catch (error: any) {
      console.error(`[Confirm] Polling error:`, error);
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  return { confirmed: false, error: "Confirmation timeout" };
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
    
    // PRODUCTION FIX: Use getClaims for reliable auth in edge environment
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claimsData, error: authError } = await authClient.auth.getClaims(token);
    const userId = claimsData?.claims?.sub as string | undefined;

    if (authError || !userId) {
      return new Response(
        JSON.stringify({ error: authError?.message || "Invalid authentication" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // Create a user-like object for backward compat in the rest of the function
    const user = { id: userId };

    const body: ConfirmRequest = await req.json();
    console.log(`[Confirm] Checking signature: ${body.signature.slice(0, 16)}...`);

    const rpcUrl = Deno.env.get("SOLANA_RPC_URL") || "https://api.mainnet-beta.solana.com";
    console.log(`[Confirm] Using RPC: ${rpcUrl.slice(0, 40)}...`);

    // Confirm the transaction and get on-chain SOL delta
    // Pass walletAddress so we find the correct account index (not assume index 0)
    const result = await confirmTransaction(rpcUrl, body.signature, body.walletAddress);

    if (result.confirmed && body.positionId) {
      if (body.action === "buy") {
        // Fetch position to get token info
        const { data: position } = await supabase
          .from("positions")
          .select("*")
          .eq("id", body.positionId)
          .single();

        await supabase
          .from("positions")
          .update({
            status: "open",
            updated_at: new Date().toISOString(),
          })
          .eq("id", body.positionId)
          .eq("user_id", user.id);

        console.log(`[Confirm] Position ${body.positionId} marked as open`);
        
        // CRITICAL: Log BUY trade with semantic columns
        if (position) {
          const { data: existingTrade } = await supabase
            .from("trade_history")
            .select("id")
            .eq("tx_hash", body.signature)
            .maybeSingle();
            
          if (!existingTrade) {
            // Use on-chain SOL delta as source of truth, fallback to provided value
            const solSpent = body.solSpent ?? (Math.abs(result.solDelta || 0) || position.entry_value || body.priceSol || 0);
            
            // BUYER POSITION: Try provided > token_processing_states > null
            let buyerPosition = body.buyerPosition || null;
            let discoveryLiquidity = body.liquidity || null;
            let discoveryRiskScore = body.riskScore || null;
            
            if (!buyerPosition || !discoveryLiquidity) {
              try {
                const { data: processingState } = await supabase
                  .from("token_processing_states")
                  .select("buyer_position_at_discovery, liquidity_at_discovery, risk_score_at_discovery")
                  .eq("user_id", user.id)
                  .eq("token_address", position.token_address)
                  .order("created_at", { ascending: false })
                  .limit(1)
                  .maybeSingle();
                
                if (processingState) {
                  buyerPosition = buyerPosition || processingState.buyer_position_at_discovery || null;
                  discoveryLiquidity = discoveryLiquidity || processingState.liquidity_at_discovery || null;
                  discoveryRiskScore = discoveryRiskScore || processingState.risk_score_at_discovery || null;
                  console.log(`[Confirm] Enriched from processing_states: buyer#=${buyerPosition} liq=${discoveryLiquidity} risk=${discoveryRiskScore}`);
                }
              } catch (e) {
                console.warn("[Confirm] Failed to lookup processing state:", e);
              }
            }
            
            // METADATA PRIORITY: position > provided > DexScreener > truncated
            let tokenSymbol = position.token_symbol;
            let tokenName = position.token_name;
            
            // Check if position has valid metadata (not placeholder)
            const isPlaceholder = !tokenSymbol || 
              tokenSymbol.includes('…') || 
              tokenSymbol.includes('...') ||
              tokenSymbol.startsWith('Token ');
            
            if (isPlaceholder) {
              // Try provided metadata
              if (body.tokenSymbol && !body.tokenSymbol.includes('…')) {
                tokenSymbol = body.tokenSymbol;
                tokenName = body.tokenName || body.tokenSymbol;
              } else {
                // Fetch from DexScreener as last resort
                const dexMeta = await fetchTokenMetadata(position.token_address);
                if (dexMeta) {
                  tokenSymbol = dexMeta.symbol;
                  tokenName = dexMeta.name;
                  
                  // Also update position to fix metadata mismatch
                  await supabase
                    .from("positions")
                    .update({ token_symbol: dexMeta.symbol, token_name: dexMeta.name })
                    .eq("id", position.id);
                } else {
                  // Fallback to truncated address
                  tokenSymbol = position.token_address.slice(0, 4) + '...' + position.token_address.slice(-4);
                  tokenName = tokenSymbol;
                }
              }
            }
            
            await supabase.from("trade_history").insert({
              user_id: user.id,
              token_address: position.token_address,
              token_symbol: tokenSymbol,
              token_name: tokenName,
              trade_type: "buy",
              amount: position.amount,
              // Semantic columns (source of truth)
              sol_spent: solSpent,
              sol_received: 0, // BUY never receives SOL
              token_amount: position.amount,
              // Legacy compatibility
              price_sol: solSpent,
              price_usd: position.entry_price_usd 
                ? position.entry_price_usd * position.amount 
                : body.priceUsd,
              status: "confirmed",
              tx_hash: body.signature,
              // Extended metadata - enriched from token_processing_states
              buyer_position: buyerPosition,
              liquidity: discoveryLiquidity,
              risk_score: discoveryRiskScore,
              entry_price: position.entry_price_usd || body.entryPrice || null,
              slippage: body.slippage || null,
              // Integrity tracking
              data_source: result.solDelta !== undefined ? "on_chain" : "provided",
              is_corrupted: false,
              // P&L fields are NULL for BUY (never show ROI for buys)
              realized_pnl_sol: null,
              roi_percent: null,
            });
            
            console.log(`[Confirm] Logged BUY: ${body.signature.slice(0, 16)}... ${tokenSymbol} sol_spent=${solSpent.toFixed(4)} buyer#=${buyerPosition || 'N/A'} liq=${discoveryLiquidity || 'N/A'}`);
          }
        }
      } else if (body.action === "sell") {
        // Fetch position before updating
        const { data: position } = await supabase
          .from("positions")
          .select("*")
          .eq("id", body.positionId)
          .single();

        await supabase
          .from("positions")
          .update({
            status: "closed",
            exit_tx_id: body.signature,
            closed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", body.positionId)
          .eq("user_id", user.id);

        console.log(`[Confirm] Position ${body.positionId} closed`);
        
        // CRITICAL: Log SELL trade with semantic columns and calculated P&L
        if (position) {
          // Check for duplicate - use both tx_hash AND trade_type to prevent races
          const { data: existingTrade } = await supabase
            .from("trade_history")
            .select("id")
            .eq("tx_hash", body.signature)
            .eq("trade_type", "sell")
            .maybeSingle();
            
          if (!existingTrade) {
            // CRITICAL: Use on-chain SOL delta as PRIMARY source of truth
            // Only fall back to provided values if on-chain extraction failed
            let solReceived: number;
            let dataSource: string;
            
            if (result.solDelta !== undefined && result.solDelta > 0) {
              // On-chain delta is positive for SELL (wallet received SOL)
              solReceived = result.solDelta;
              dataSource = "on_chain";
              console.log(`[Confirm] Using on-chain SOL delta: ${solReceived.toFixed(6)}`);
            } else if (result.solDelta !== undefined && result.solDelta <= 0) {
              // On-chain shows no SOL received or negative - possible honeypot/scam
              solReceived = 0;
              dataSource = "on_chain";
              console.warn(`[Confirm] On-chain shows non-positive delta for SELL: ${result.solDelta?.toFixed(6)} - possible honeypot`);
            } else {
              // Fallback only if on-chain extraction completely failed
              solReceived = body.solReceived ?? position.current_value ?? body.priceSol ?? 0;
              dataSource = "provided";
              console.warn(`[Confirm] No on-chain delta available, using provided: ${solReceived.toFixed(6)}`);
            }
            
            // Fetch matched BUY for FIFO P&L calculation
            const { data: matchedBuy } = await supabase
              .from("trade_history")
              .select("sol_spent, price_sol, tx_hash")
              .eq("user_id", user.id)
              .eq("token_address", position.token_address)
              .eq("trade_type", "buy")
              .eq("status", "confirmed")
              .order("created_at", { ascending: true })
              .limit(1)
              .maybeSingle();
            
            const matchedBuySolSpent = matchedBuy?.sol_spent ?? matchedBuy?.price_sol ?? position.entry_value ?? body.matchedBuySolSpent ?? 0;
            
            // Calculate P&L from SOL delta (NEVER from price math)
            let realizedPnlSol: number | null = null;
            let roiPercent: number | null = null;
            let isCorrupted = false;
            let corruptionReason: string | null = null;
            
            if (matchedBuySolSpent > 0 && solReceived >= 0) {
              realizedPnlSol = solReceived - matchedBuySolSpent;
              roiPercent = (realizedPnlSol / matchedBuySolSpent) * 100;
              
              // Validate ROI - flag impossible values
              if (Math.abs(roiPercent) > 1000 && dataSource === "on_chain") {
                console.warn(`[Confirm] High ROI ${roiPercent.toFixed(1)}% - marking for review`);
              }
              // If ROI > 1000% but solReceived is very small relative to buy, flag as corrupted
              if (roiPercent > 1000 && solReceived < matchedBuySolSpent * 0.5) {
                isCorrupted = true;
                corruptionReason = `Suspicious ROI ${roiPercent.toFixed(1)}%: received ${solReceived.toFixed(6)} SOL vs spent ${matchedBuySolSpent.toFixed(6)} SOL`;
                console.warn(`[Confirm] CORRUPTED: ${corruptionReason}`);
              }
            }
            
            // METADATA: Resolve token symbol/name
            let tokenSymbol = position.token_symbol;
            let tokenName = position.token_name;
            
            const isPlaceholder = !tokenSymbol || 
              tokenSymbol.includes('…') || 
              tokenSymbol.includes('...') ||
              tokenSymbol.startsWith('Token ');
            
            if (isPlaceholder) {
              if (body.tokenSymbol && !body.tokenSymbol.includes('…')) {
                tokenSymbol = body.tokenSymbol;
                tokenName = body.tokenName || body.tokenSymbol;
              } else {
                const dexMeta = await fetchTokenMetadata(position.token_address);
                if (dexMeta) {
                  tokenSymbol = dexMeta.symbol;
                  tokenName = dexMeta.name;
                } else {
                  tokenSymbol = position.token_address.slice(0, 4) + '...' + position.token_address.slice(-4);
                  tokenName = tokenSymbol;
                }
              }
            }
            
            // METADATA REPAIR: Fix earlier BUY records with truncated/placeholder names
            if (tokenSymbol && !tokenSymbol.includes('…') && !tokenSymbol.includes('...') && !tokenSymbol.startsWith('Token ')) {
              const { data: badBuys } = await supabase
                .from("trade_history")
                .select("id, token_symbol")
                .eq("user_id", user.id)
                .eq("token_address", position.token_address)
                .eq("trade_type", "buy");
              
              if (badBuys) {
                for (const buy of badBuys) {
                  const isBuyPlaceholder = !buy.token_symbol || 
                    buy.token_symbol.includes('…') || 
                    buy.token_symbol.includes('...') ||
                    buy.token_symbol.startsWith('Token ');
                  if (isBuyPlaceholder) {
                    await supabase
                      .from("trade_history")
                      .update({ token_symbol: tokenSymbol, token_name: tokenName })
                      .eq("id", buy.id);
                    console.log(`[Confirm] Repaired BUY metadata: ${buy.token_symbol} → ${tokenSymbol}`);
                  }
                }
              }
            }
            
            // SELL: Inherit buyer_position from matched BUY trade (not from body which is never sent)
            const sellBuyerPosition = matchedBuy 
              ? (await supabase
                  .from("trade_history")
                  .select("buyer_position, liquidity, risk_score")
                  .eq("tx_hash", matchedBuy.tx_hash)
                  .maybeSingle()
                ).data
              : null;

            await supabase.from("trade_history").insert({
              user_id: user.id,
              token_address: position.token_address,
              token_symbol: tokenSymbol,
              token_name: tokenName,
              trade_type: "sell",
              amount: position.amount,
              sol_spent: 0,
              sol_received: solReceived,
              token_amount: position.amount,
              realized_pnl_sol: realizedPnlSol,
              roi_percent: roiPercent,
              matched_buy_tx_hash: matchedBuy?.tx_hash || null,
              price_sol: solReceived,
              price_usd: position.current_price && position.amount 
                ? position.current_price * position.amount 
                : body.priceUsd,
              status: "confirmed",
              tx_hash: body.signature,
              buyer_position: body.buyerPosition || sellBuyerPosition?.buyer_position || null,
              liquidity: body.liquidity || sellBuyerPosition?.liquidity || null,
              risk_score: body.riskScore || sellBuyerPosition?.risk_score || null,
              entry_price: position.entry_price_usd || body.entryPrice || null,
              exit_price: position.current_price || body.exitPrice || null,
              slippage: body.slippage || null,
              data_source: dataSource,
              is_corrupted: isCorrupted,
              corruption_reason: corruptionReason,
            });
            
            console.log(`[Confirm] Logged SELL: ${body.signature.slice(0, 16)}... sol_received=${solReceived.toFixed(6)} pnl=${realizedPnlSol?.toFixed(4) || 'N/A'} roi=${roiPercent?.toFixed(1) || 'N/A'}% source=${dataSource}`);
          }
        }
      }
    } else if (!result.confirmed && body.positionId) {
      // Handle failed transactions
      if (body.action === "sell") {
        console.log(`[Confirm] Sell TX failed - position ${body.positionId} kept OPEN`);
      } else {
        await supabase
          .from("positions")
          .delete()
          .eq("id", body.positionId)
          .eq("user_id", user.id)
          .eq("status", "pending");

        console.log(`[Confirm] Removed pending buy position ${body.positionId}`);
      }
    }

    // Log to system_logs
    await supabase.from("system_logs").insert({
      user_id: user.id,
      event_type: "transaction_confirmation",
      event_category: "trading",
      severity: result.confirmed ? "info" : "error",
      message: result.confirmed
        ? `Transaction confirmed: ${body.signature.slice(0, 16)}...`
        : `Transaction failed: ${result.error}`,
      metadata: {
        signature: body.signature,
        positionId: body.positionId,
        action: body.action,
        slot: result.slot,
        solDelta: result.solDelta,
        error: result.error,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        confirmed: result.confirmed,
        signature: body.signature,
        slot: result.slot,
        solDelta: result.solDelta,
        error: result.error,
        explorerUrl: `https://solscan.io/tx/${body.signature}`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[Confirm] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
