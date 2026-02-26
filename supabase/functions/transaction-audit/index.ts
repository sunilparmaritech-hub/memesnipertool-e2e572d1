import { createClient } from "https://esm.sh/@supabase/supabase-js@2.90.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface AuditRequest {
  action: "audit_transactions" | "reconcile_wallet" | "validate_pnl" | "detect_fake_tokens" | "full_audit";
  userId?: string;
  limit?: number;
}

interface TransactionOnChain {
  signature: string;
  blockTime: number | null;
  slot: number;
  err: any;
  meta: {
    preBalances: number[];
    postBalances: number[];
    preTokenBalances: any[];
    postTokenBalances: any[];
    fee: number;
    innerInstructions?: any[];
  } | null;
}

interface AuditResult {
  signature: string;
  status: "VALID" | "MISMATCH" | "NOT_FOUND" | "FAILED";
  issues: string[];
  corrections: Record<string, any>;
  onChainData?: TransactionOnChain | null;
}

interface TokenRiskAssessment {
  tokenAddress: string;
  tokenSymbol: string;
  status: "SAFE" | "RISKY" | "SCAM";
  flags: string[];
}

// Fetch transaction details from Solana RPC
async function getTransactionFromChain(
  rpcUrl: string, 
  signature: string
): Promise<TransactionOnChain | null> {
  try {
    const response = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getTransaction",
        params: [signature, { 
          encoding: "jsonParsed", 
          maxSupportedTransactionVersion: 0 
        }],
      }),
    });

    if (!response.ok) return null;
    
    const data = await response.json();
    if (!data.result) return null;
    
    return {
      signature,
      blockTime: data.result.blockTime,
      slot: data.result.slot,
      err: data.result.meta?.err,
      meta: data.result.meta,
    };
  } catch (error) {
    console.error(`[Audit] Failed to fetch tx ${signature}:`, error);
    return null;
  }
}

// Calculate SOL transferred in transaction
function calculateSolTransfer(tx: TransactionOnChain): { spent: number; received: number } {
  if (!tx.meta) return { spent: 0, received: 0 };
  
  const preBalance = tx.meta.preBalances[0] || 0;
  const postBalance = tx.meta.postBalances[0] || 0;
  const fee = tx.meta.fee || 0;
  
  const diff = (postBalance - preBalance) / 1e9; // Convert lamports to SOL
  
  if (diff < 0) {
    // SOL was spent
    return { spent: Math.abs(diff), received: 0 };
  } else {
    // SOL was received
    return { spent: 0, received: diff + (fee / 1e9) }; // Add fee back for accurate comparison
  }
}

// Extract token amounts from transaction
function extractTokenAmounts(tx: TransactionOnChain): { 
  tokenAddress: string | null;
  amountReceived: number;
  amountSent: number;
} {
  if (!tx.meta) return { tokenAddress: null, amountReceived: 0, amountSent: 0 };
  
  const preTokens = tx.meta.preTokenBalances || [];
  const postTokens = tx.meta.postTokenBalances || [];
  
  // Find token changes (exclude SOL)
  const tokenChanges: Record<string, { pre: number; post: number; mint: string }> = {};
  
  for (const pre of preTokens) {
    if (pre.mint) {
      tokenChanges[pre.mint] = tokenChanges[pre.mint] || { pre: 0, post: 0, mint: pre.mint };
      tokenChanges[pre.mint].pre = parseFloat(pre.uiTokenAmount?.uiAmount || 0);
    }
  }
  
  for (const post of postTokens) {
    if (post.mint) {
      tokenChanges[post.mint] = tokenChanges[post.mint] || { pre: 0, post: 0, mint: post.mint };
      tokenChanges[post.mint].post = parseFloat(post.uiTokenAmount?.uiAmount || 0);
    }
  }
  
  // Find the main token change (largest absolute change)
  let maxChange = 0;
  let mainToken: { tokenAddress: string | null; amountReceived: number; amountSent: number } = {
    tokenAddress: null,
    amountReceived: 0,
    amountSent: 0,
  };
  
  for (const [mint, change] of Object.entries(tokenChanges)) {
    const diff = change.post - change.pre;
    if (Math.abs(diff) > Math.abs(maxChange)) {
      maxChange = diff;
      mainToken = {
        tokenAddress: mint,
        amountReceived: diff > 0 ? diff : 0,
        amountSent: diff < 0 ? Math.abs(diff) : 0,
      };
    }
  }
  
  return mainToken;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    const rpcUrl = Deno.env.get("SOLANA_RPC_URL") || "https://api.mainnet-beta.solana.com";

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

    const body: AuditRequest = await req.json();
    const limit = body.limit || 100;
    const targetUserId = body.userId || user.id;

    console.log(`[Audit] Starting ${body.action} for user ${targetUserId}`);

    const auditResults: {
      transactions: AuditResult[];
      pnlCorrections: any[];
      walletReconciliation: any;
      fakeTokens: TokenRiskAssessment[];
      summary: {
        totalAudited: number;
        valid: number;
        mismatches: number;
        notFound: number;
        failed: number;
        correctionsApplied: number;
      };
    } = {
      transactions: [],
      pnlCorrections: [],
      walletReconciliation: null,
      fakeTokens: [],
      summary: {
        totalAudited: 0,
        valid: 0,
        mismatches: 0,
        notFound: 0,
        failed: 0,
        correctionsApplied: 0,
      },
    };

    // ========================================
    // PHASE 1: TRANSACTION INTEGRITY AUDIT
    // ========================================
    if (body.action === "audit_transactions" || body.action === "full_audit") {
      console.log("[Audit] Phase 1: Transaction Integrity");
      
      const { data: trades } = await supabase
        .from("trade_history")
        .select("*")
        .eq("user_id", targetUserId)
        .not("tx_hash", "is", null)
        .order("created_at", { ascending: false })
        .limit(limit);

      for (const trade of trades || []) {
        if (!trade.tx_hash) continue;
        
        auditResults.summary.totalAudited++;
        
        const onChainTx = await getTransactionFromChain(rpcUrl, trade.tx_hash);
        
        if (!onChainTx) {
          auditResults.transactions.push({
            signature: trade.tx_hash,
            status: "NOT_FOUND",
            issues: ["Transaction not found on chain - may be expired or invalid"],
            corrections: {},
          });
          auditResults.summary.notFound++;
          continue;
        }
        
        if (onChainTx.err) {
          auditResults.transactions.push({
            signature: trade.tx_hash,
            status: "FAILED",
            issues: ["Transaction failed on-chain: " + JSON.stringify(onChainTx.err)],
            corrections: {},
            onChainData: onChainTx,
          });
          auditResults.summary.failed++;
          continue;
        }
        
        const issues: string[] = [];
        const corrections: Record<string, any> = {};
        
        // Compare SOL amounts
        const solTransfer = calculateSolTransfer(onChainTx);
        const loggedSol = trade.price_sol || 0;
        
        if (trade.trade_type === "buy") {
          const tolerance = 0.001; // 0.001 SOL tolerance for fees
          if (Math.abs(solTransfer.spent - loggedSol) > tolerance) {
            issues.push(`SOL spent mismatch: logged ${loggedSol} vs on-chain ${solTransfer.spent.toFixed(6)}`);
            corrections.price_sol = solTransfer.spent;
          }
        } else if (trade.trade_type === "sell") {
          const tolerance = 0.001;
          if (Math.abs(solTransfer.received - loggedSol) > tolerance) {
            issues.push(`SOL received mismatch: logged ${loggedSol} vs on-chain ${solTransfer.received.toFixed(6)}`);
            corrections.price_sol = solTransfer.received;
          }
        }
        
        // Compare token amounts
        const tokenData = extractTokenAmounts(onChainTx);
        const loggedAmount = trade.amount || 0;
        
        if (tokenData.tokenAddress) {
          const tokenChange = trade.trade_type === "buy" 
            ? tokenData.amountReceived 
            : tokenData.amountSent;
          
          if (tokenChange > 0 && Math.abs(tokenChange - loggedAmount) / Math.max(tokenChange, loggedAmount) > 0.01) {
            issues.push(`Token amount mismatch: logged ${loggedAmount} vs on-chain ${tokenChange}`);
            corrections.amount = tokenChange;
          }
          
          // Verify token address matches
          if (tokenData.tokenAddress !== trade.token_address) {
            issues.push(`Token address mismatch: logged ${trade.token_address} vs on-chain ${tokenData.tokenAddress}`);
            // Don't auto-correct token address - flag for manual review
          }
        }
        
        // Compare timestamp
        if (onChainTx.blockTime) {
          const onChainDate = new Date(onChainTx.blockTime * 1000);
          const loggedDate = new Date(trade.created_at);
          const diffMinutes = Math.abs(onChainDate.getTime() - loggedDate.getTime()) / 60000;
          
          if (diffMinutes > 5) {
            issues.push(`Timestamp drift: logged ${loggedDate.toISOString()} vs on-chain ${onChainDate.toISOString()}`);
          }
        }
        
        // Apply corrections if any
        if (Object.keys(corrections).length > 0) {
          const { error: updateError } = await supabase
            .from("trade_history")
            .update(corrections)
            .eq("id", trade.id);
          
          if (!updateError) {
            auditResults.summary.correctionsApplied++;
          }
          
          auditResults.transactions.push({
            signature: trade.tx_hash,
            status: "MISMATCH",
            issues,
            corrections,
            onChainData: onChainTx,
          });
          auditResults.summary.mismatches++;
        } else {
          auditResults.transactions.push({
            signature: trade.tx_hash,
            status: "VALID",
            issues,
            corrections: {},
          });
          auditResults.summary.valid++;
        }
        
        // Rate limit RPC calls
        await new Promise(r => setTimeout(r, 100));
      }
    }

    // ========================================
    // PHASE 2: P&L VALIDATION
    // ========================================
    if (body.action === "validate_pnl" || body.action === "full_audit") {
      console.log("[Audit] Phase 2: P&L Validation");
      
      // Get all trades grouped by token
      const { data: allTrades } = await supabase
        .from("trade_history")
        .select("*")
        .eq("user_id", targetUserId)
        .eq("status", "confirmed")
        .order("created_at", { ascending: true });
      
      // Group by token address
      const tradesByToken: Record<string, typeof allTrades> = {};
      for (const trade of allTrades || []) {
        if (!tradesByToken[trade.token_address]) {
          tradesByToken[trade.token_address] = [];
        }
        tradesByToken[trade.token_address]!.push(trade);
      }
      
      // Calculate realized P&L for each token using FIFO
      for (const [tokenAddress, trades] of Object.entries(tradesByToken)) {
        const buys = trades!.filter(t => t.trade_type === "buy" && t.price_sol && t.price_sol > 0);
        const sells = trades!.filter(t => t.trade_type === "sell" && t.price_sol && t.price_sol > 0);
        
        if (sells.length === 0) continue;
        
        let totalRealizedPnl = 0;
        let buyIndex = 0;
        let remainingBuyAmount = buys[0]?.amount || 0;
        let remainingBuyCost = buys[0]?.price_sol || 0;
        
        for (const sell of sells) {
          if (!sell.price_sol || sell.price_sol <= 0) continue;
          
          const sellSol = sell.price_sol;
          let sellAmount = sell.amount;
          
          // Match with buys using FIFO
          while (sellAmount > 0 && buyIndex < buys.length) {
            if (remainingBuyAmount <= 0) {
              buyIndex++;
              if (buyIndex < buys.length) {
                remainingBuyAmount = buys[buyIndex].amount;
                remainingBuyCost = buys[buyIndex].price_sol || 0;
              }
              continue;
            }
            
            const matchAmount = Math.min(sellAmount, remainingBuyAmount);
            const costRatio = matchAmount / remainingBuyAmount;
            const matchCost = remainingBuyCost * costRatio;
            
            // P&L = (sell value portion) - (buy cost portion)
            const sellRatio = matchAmount / sell.amount;
            const sellValue = sellSol * sellRatio;
            
            totalRealizedPnl += sellValue - matchCost;
            
            sellAmount -= matchAmount;
            remainingBuyAmount -= matchAmount;
            remainingBuyCost -= matchCost;
          }
        }
        
        // Check if stored P&L matches calculated
        const { data: positions } = await supabase
          .from("positions")
          .select("*")
          .eq("user_id", targetUserId)
          .eq("token_address", tokenAddress)
          .eq("status", "closed");
        
        for (const pos of positions || []) {
          const storedPnl = pos.profit_loss_value || 0;
          
          if (Math.abs(storedPnl - totalRealizedPnl) > 0.001) {
            auditResults.pnlCorrections.push({
              positionId: pos.id,
              tokenAddress,
              tokenSymbol: pos.token_symbol,
              storedPnl,
              calculatedPnl: totalRealizedPnl,
              difference: totalRealizedPnl - storedPnl,
              status: "P&L_CORRECTED",
            });
            
            // Apply correction
            await supabase
              .from("positions")
              .update({ profit_loss_value: totalRealizedPnl })
              .eq("id", pos.id);
          }
        }
      }
    }

    // ========================================
    // PHASE 5: FAKE TOKEN DETECTION
    // ========================================
    if (body.action === "detect_fake_tokens" || body.action === "full_audit") {
      console.log("[Audit] Phase 5: Fake Token Detection");
      
      const { data: positions } = await supabase
        .from("positions")
        .select("*")
        .eq("user_id", targetUserId)
        .eq("status", "closed");
      
      const tokenGroups: Record<string, typeof positions> = {};
      for (const pos of positions || []) {
        if (!tokenGroups[pos.token_address]) {
          tokenGroups[pos.token_address] = [];
        }
        tokenGroups[pos.token_address]!.push(pos);
      }
      
      for (const [tokenAddress, tokenPositions] of Object.entries(tokenGroups)) {
        const flags: string[] = [];
        let status: "SAFE" | "RISKY" | "SCAM" = "SAFE";
        const firstPos = tokenPositions![0];
        
        // Check 1: SELL returned near-zero SOL
        const totalExitValue = tokenPositions!.reduce((sum, p) => sum + (p.current_value || 0), 0);
        const totalEntryValue = tokenPositions!.reduce((sum, p) => sum + (p.entry_value || 0), 0);
        
        if (totalExitValue < 0.0001 && totalEntryValue > 0.01) {
          flags.push("SELL returned near-zero SOL (possible rug)");
          status = "SCAM";
        }
        
        // Check 2: Massive loss (>95%)
        const pnlPercent = totalEntryValue > 0 
          ? ((totalExitValue - totalEntryValue) / totalEntryValue) * 100 
          : 0;
        
        if (pnlPercent < -95) {
          flags.push(`Catastrophic loss: ${pnlPercent.toFixed(1)}%`);
          status = status === "SCAM" ? "SCAM" : "RISKY";
        }
        
        // Check 3: Price was 0 or NaN at any point
        for (const pos of tokenPositions!) {
          if (!pos.entry_price || pos.entry_price === 0 || isNaN(pos.entry_price)) {
            flags.push("Invalid entry price (0 or NaN)");
            status = "RISKY";
          }
          if (pos.current_price === 0 || (pos.current_price && isNaN(pos.current_price))) {
            flags.push("Price dropped to 0");
            status = status === "SCAM" ? "SCAM" : "RISKY";
          }
        }
        
        // Check 4: Suspiciously high gains (>500% in short time)
        if (pnlPercent > 500) {
          const firstEntry = new Date(tokenPositions![0].created_at);
          const lastExit = tokenPositions!
            .filter(p => p.closed_at)
            .sort((a, b) => new Date(b.closed_at!).getTime() - new Date(a.closed_at!).getTime())[0];
          
          if (lastExit) {
            const durationHours = (new Date(lastExit.closed_at!).getTime() - firstEntry.getTime()) / 3600000;
            if (durationHours < 24) {
              flags.push(`Suspicious gain: ${pnlPercent.toFixed(0)}% in ${durationHours.toFixed(1)} hours`);
              status = "RISKY";
            }
          }
        }
        
        if (flags.length > 0) {
          auditResults.fakeTokens.push({
            tokenAddress,
            tokenSymbol: firstPos?.token_symbol || "UNKNOWN",
            status,
            flags,
          });
        }
      }
    }

    // ========================================
    // PHASE 3: WALLET RECONCILIATION (Basic)
    // ========================================
    if (body.action === "reconcile_wallet" || body.action === "full_audit") {
      console.log("[Audit] Phase 3: Wallet Reconciliation (summary only)");
      
      // Calculate expected SOL from trades
      const { data: buys } = await supabase
        .from("trade_history")
        .select("price_sol")
        .eq("user_id", targetUserId)
        .eq("trade_type", "buy")
        .eq("status", "confirmed");
      
      const { data: sells } = await supabase
        .from("trade_history")
        .select("price_sol")
        .eq("user_id", targetUserId)
        .eq("trade_type", "sell")
        .eq("status", "confirmed");
      
      const totalSpent = (buys || []).reduce((sum, t) => sum + (t.price_sol || 0), 0);
      const totalReceived = (sells || []).reduce((sum, t) => sum + (t.price_sol || 0), 0);
      const netFlow = totalReceived - totalSpent;
      
      auditResults.walletReconciliation = {
        totalSolSpent: totalSpent,
        totalSolReceived: totalReceived,
        netSolFlow: netFlow,
        note: "Actual wallet balance check requires wallet address",
      };
    }

    // Log audit results
    await supabase.from("system_logs").insert({
      user_id: user.id,
      event_type: "transaction_audit",
      event_category: "audit",
      severity: auditResults.summary.mismatches > 0 ? "warn" : "info",
      message: `Audit complete: ${auditResults.summary.valid} valid, ${auditResults.summary.mismatches} corrected`,
      metadata: {
        action: body.action,
        summary: auditResults.summary,
        pnlCorrectionsCount: auditResults.pnlCorrections.length,
        fakeTokensCount: auditResults.fakeTokens.length,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        ...auditResults,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[Audit] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Audit failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
