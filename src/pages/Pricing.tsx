import { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import PublicLayout from "@/components/layout/PublicLayout";
import AppLayout from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/contexts/AuthContext";
import { useCredits, type CreditPack } from "@/hooks/useCredits";
import { useSolPrice } from "@/hooks/useSolPrice";
import { useWallet } from "@/hooks/useWallet";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  Coins, Zap, Crown, Star, ArrowRight, Loader2, Wallet, Check, ShoppingCart, Sparkles,
  ExternalLink, Clock, XCircle, CheckCircle2, AlertTriangle, HelpCircle, Info,
  ArrowDown, Shield, Rocket,
} from "lucide-react";

const STATUS_CONFIG: Record<string, { icon: React.ReactNode; label: string; color: string; description: string }> = {
  confirmed: {
    icon: <CheckCircle2 className="w-3.5 h-3.5" />,
    label: "Confirmed",
    color: "bg-success/20 text-success border-success/30",
    description: "Transaction verified on-chain and credits added to your account.",
  },
  pending: {
    icon: <Clock className="w-3.5 h-3.5" />,
    label: "Pending",
    color: "bg-warning/20 text-warning border-warning/30",
    description: "Transaction sent but not yet verified. Credits will be added once confirmed on-chain.",
  },
  failed: {
    icon: <XCircle className="w-3.5 h-3.5" />,
    label: "Failed",
    color: "bg-destructive/20 text-destructive border-destructive/30",
    description: "Transaction failed or could not be verified.",
  },
};

export default function Pricing() {
  const { user } = useAuth();
  const { balance, packs, packsLoading, refetchCredits, transactions, CREDIT_COSTS } = useCredits();
  const { price: solPrice } = useSolPrice();
  const { wallet, connectPhantom } = useWallet();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [purchasingPack, setPurchasingPack] = useState<string | null>(null);
  const [txStatus, setTxStatus] = useState<"idle" | "signing" | "confirming" | "success" | "error">("idle");

  const Layout = user ? AppLayout : PublicLayout;

  useEffect(() => {
    const status = searchParams.get("payment");
    if (status === "success") {
      toast({ title: "🎉 Credits Added!", description: "Your credits have been added to your account." });
      refetchCredits();
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams, toast, refetchCredits]);

  // Fetch admin receiving wallet
  const [adminWallet, setAdminWallet] = useState<string | null>(null);
  useEffect(() => {
    supabase.rpc("get_payment_wallet").then(({ data }) => {
      if (data) {
        console.log("[Pricing] Admin wallet loaded:", data.slice(0, 8) + "...");
        setAdminWallet(data);
      } else {
        console.warn("[Pricing] No admin wallet returned from RPC");
      }
    });
  }, []);

  const handlePurchase = useCallback(async (pack: CreditPack) => {
    if (!user) { navigate("/auth"); return; }
    if (!wallet.isConnected) { await connectPhantom(); return; }
    if (!adminWallet) {
      toast({ title: "Payment Not Available", description: "Admin wallet not configured. Please try again later.", variant: "destructive" });
      return;
    }
    if (wallet.address === adminWallet) {
      toast({ title: "Configuration Error", description: "Cannot send payment to your own wallet. Please contact support.", variant: "destructive" });
      return;
    }

    setPurchasingPack(pack.id);
    setTxStatus("signing");

    try {
      const { PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } = await import("@solana/web3.js");

      const senderPubkey = new PublicKey(wallet.address!);
      const recipientPubkey = new PublicKey(adminWallet);
      const lamports = Math.round(pack.sol_price * LAMPORTS_PER_SOL);
      const memo = `AMS-${user.id}-${pack.id}-${Date.now()}`;

      const transaction = new Transaction();
      transaction.add(
        SystemProgram.transfer({
          fromPubkey: senderPubkey,
          toPubkey: recipientPubkey,
          lamports,
        })
      );

      const MEMO_PROGRAM_ID = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");
      transaction.add({
        keys: [{ pubkey: senderPubkey, isSigner: true, isWritable: false }],
        programId: MEMO_PROGRAM_ID,
        data: new TextEncoder().encode(memo) as unknown as Buffer,
      });

      const { data: bhData, error: bhError } = await supabase.functions.invoke("get-blockhash");
      if (bhError || !bhData?.success) throw new Error(bhData?.error || "Failed to get blockhash");
      
      transaction.recentBlockhash = bhData.blockhash;
      transaction.feePayer = senderPubkey;

      const provider = (window as any).solana || (window as any).phantom?.solana;
      if (!provider) throw new Error("Wallet not found");

      let finalTxHash: string;
      try {
        const { signature } = await provider.signAndSendTransaction(transaction);
        finalTxHash = signature;
      } catch (signAndSendErr: any) {
        console.warn("signAndSendTransaction failed, using fallback:", signAndSendErr.message);
        const signed = await provider.signTransaction(transaction);
        const rawTx = signed.serialize();
        const base64Tx = btoa(String.fromCharCode(...new Uint8Array(rawTx)));
        const { data: sendData, error: sendErr } = await supabase.functions.invoke("send-transaction", {
          body: { transaction: base64Tx },
        });
        if (sendErr || !sendData?.success) throw new Error(sendData?.error || "Failed to send transaction");
        finalTxHash = sendData.txHash;
      }

      setTxStatus("confirming");
      toast({ title: "Payment Sent!", description: "Verifying transaction on-chain..." });

      try {
        await supabase.from("credit_transactions").insert({
          user_id: user.id,
          tx_hash: finalTxHash,
          sender_wallet: wallet.address!,
          recipient_wallet: adminWallet,
          amount_sol: pack.sol_price,
          credits_added: 0,
          pack_id: pack.id,
          status: "pending",
          memo,
        });
      } catch (recordErr) {
        console.warn("Could not record pending tx:", recordErr);
      }

      const { data: confirmData, error: confirmErr } = await supabase.functions.invoke("confirm-payment", {
        body: { txHash: finalTxHash, packId: pack.id, memo },
      });

      if (confirmErr || !confirmData?.success) {
        setTxStatus("success");
        toast({
          title: "⏳ Payment Sent",
          description: "Transaction sent but verification is taking longer. Credits will be added automatically.",
        });
        let attempts = 0;
        const pollInterval = setInterval(async () => {
          attempts++;
          refetchCredits();
          if (attempts >= 20) clearInterval(pollInterval);
        }, 5000);
      } else {
        setTxStatus("success");
        toast({
          title: "🎉 Credits Added!",
          description: `${confirmData.creditsAdded} credits have been added to your account.`,
        });
        refetchCredits();
      }
    } catch (err: any) {
      setTxStatus("error");
      const raw = err.message || String(err);
      if (raw.includes("User rejected") || raw.includes("user rejected")) {
        toast({ title: "Transaction Canceled", description: "You canceled the transaction." });
        return;
      }
      let friendly = "Something went wrong. Please try again.";
      if (raw.includes("Insufficient") || raw.includes("insufficient") || raw.includes("0x1")) {
        friendly = "Insufficient SOL balance. Make sure your wallet has enough SOL plus ~0.001 SOL for fees.";
      } else if (raw.includes("timeout")) {
        friendly = "Transaction timed out. Check your wallet — the payment may still go through.";
      } else if (raw.includes("blockhash")) {
        friendly = "Could not connect to the Solana network. Try again shortly.";
      } else if (raw.includes("not found")) {
        friendly = "Wallet not detected. Make sure Phantom is installed and unlocked.";
      }
      toast({ title: "Payment Failed", description: friendly, variant: "destructive" });
    } finally {
      setPurchasingPack(null);
      setTimeout(() => setTxStatus("idle"), 5000);
    }
  }, [user, wallet, adminWallet, connectPhantom, navigate, toast, refetchCredits]);

  const COST_EXAMPLES = [
    { action: "Token Scan", cost: CREDIT_COSTS.token_validation, icon: <Zap className="w-4 h-4" /> },
    { action: "Auto Snipe", cost: CREDIT_COSTS.auto_execution, icon: <Crown className="w-4 h-4" /> },
    { action: "Clustering", cost: CREDIT_COSTS.clustering_call, icon: <Sparkles className="w-4 h-4" /> },
    { action: "API Check", cost: CREDIT_COSTS.api_check, icon: <Info className="w-4 h-4" /> },
    { action: "Manual Trade", cost: CREDIT_COSTS.manual_trade, icon: <Coins className="w-4 h-4" /> },
  ];

  const STEPS = [
    { icon: <Wallet className="w-5 h-5" />, title: "Choose a Pack", desc: "Select a credit pack that fits your trading volume." },
    { icon: <Shield className="w-5 h-5" />, title: "Pay with SOL", desc: "Sign the transaction in your wallet. SOL is sent directly on-chain." },
    { icon: <Rocket className="w-5 h-5" />, title: "Credits Instantly Added", desc: "Verified on the blockchain in ~30s. Credits are auto-credited to your account." },
  ];

  // Find best value pack
  const bestValueIdx = packs.length > 0 ? packs.reduce((best, pack, idx) => {
    const totalCredits = pack.credits_amount + pack.bonus_credits;
    const costPer = pack.sol_price / totalCredits;
    const bestTotal = packs[best].credits_amount + packs[best].bonus_credits;
    const bestCostPer = packs[best].sol_price / bestTotal;
    return costPer < bestCostPer ? idx : best;
  }, 0) : -1;

  return (
    <Layout>
      <div className="container mx-auto max-w-[1400px] px-3 sm:px-4 md:px-6 py-4 sm:py-6 space-y-8">
        {/* Hero Header */}
        <div className="text-center space-y-4">
          <Badge variant="outline" className="text-primary border-primary/30">
            <Star className="w-3 h-3 mr-1" /> Credit Packs
          </Badge>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
            Power Your <span className="text-primary">Sniper</span>
          </h1>
          <p className="text-muted-foreground max-w-xl mx-auto text-sm sm:text-base">
            Purchase credits with SOL. Credits are deducted per action — no subscriptions, no recurring billing.
          </p>

          {user && (
            <div className="inline-flex items-center gap-3 px-5 py-3 rounded-xl glass border border-primary/20">
              <Coins className="w-5 h-5 text-primary" />
              <div className="text-left">
                <p className="text-xs text-muted-foreground">Your Balance</p>
                <p className="text-xl font-bold text-foreground">{balance.toLocaleString()} credits</p>
              </div>
            </div>
          )}
        </div>

        {/* How It Works - Top, modern horizontal stepper */}
        <div className="rounded-2xl border border-border/30 overflow-hidden" style={{ background: 'linear-gradient(135deg, hsl(var(--primary) / 0.05), hsl(var(--accent) / 0.03))' }}>
          <div className="px-5 py-3 border-b border-border/20 flex items-center gap-2">
            <HelpCircle className="w-4 h-4 text-primary" />
            <span className="text-sm font-bold text-foreground">How It Works</span>
          </div>
          <div className="p-5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {STEPS.map((step, idx) => (
                <div key={idx} className="flex items-start gap-3 p-4 rounded-xl bg-secondary/30 border border-border/20 hover:border-primary/20 transition-all">
                  <div className="w-10 h-10 rounded-xl bg-primary/15 text-primary flex items-center justify-center shrink-0 font-bold text-sm">
                    {idx + 1}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground mb-0.5">{step.title}</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">{step.desc}</p>
                  </div>
                  {idx < STEPS.length - 1 && (
                    <ArrowRight className="w-4 h-4 text-muted-foreground/30 hidden sm:block self-center ml-auto shrink-0" />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Transaction Status Banner */}
        {txStatus === "confirming" && (
          <div className="flex items-center justify-center gap-3 py-4 px-6 rounded-xl bg-primary/10 border border-primary/20 max-w-md mx-auto animate-pulse">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
            <span className="text-sm text-foreground">Verifying on blockchain…</span>
          </div>
        )}
        {txStatus === "success" && (
          <div className="flex items-center justify-center gap-3 py-4 px-6 rounded-xl bg-success/10 border border-success/20 max-w-md mx-auto">
            <Check className="w-5 h-5 text-success" />
            <span className="text-sm text-foreground">Transaction confirmed! Credits added.</span>
          </div>
        )}

        {/* Credit Pack Cards - Modern redesign */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {packsLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-border/30 p-5 h-72 animate-pulse bg-card/50" />
            ))
          ) : (
            packs.map((pack, idx) => {
              const isBest = idx === bestValueIdx;
              const totalCredits = pack.credits_amount + pack.bonus_credits;
              const usdValue = (pack.sol_price * solPrice).toFixed(2);
              const perCredit = (pack.sol_price / totalCredits * 1000).toFixed(3);
              const isLoading = purchasingPack === pack.id;
              const packIcons = [<Zap className="w-5 h-5" />, <Coins className="w-5 h-5" />, <Crown className="w-5 h-5" />, <Sparkles className="w-5 h-5" />];

              return (
                <div
                  key={pack.id}
                  className={`relative rounded-2xl border p-5 flex flex-col transition-all hover:scale-[1.02] hover:shadow-lg ${
                    isBest 
                      ? "border-primary/50 ring-1 ring-primary/20 bg-gradient-to-b from-primary/5 to-transparent" 
                      : "border-border/30 bg-card/50 hover:border-border/60"
                  }`}
                >
                  {isBest && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <Badge className="bg-primary text-primary-foreground text-[10px] px-3 py-0.5 shadow-lg">
                        <Star className="w-3 h-3 mr-1" /> Best Value
                      </Badge>
                    </div>
                  )}

                  <div className="flex items-center gap-2.5 mb-4">
                    <div className={`p-2 rounded-xl ${isBest ? "bg-primary/20 text-primary" : "bg-secondary/60 text-muted-foreground"}`}>
                      {packIcons[idx % 4]}
                    </div>
                    <h3 className="font-bold text-foreground text-base">{pack.name}</h3>
                  </div>

                  <div className="mb-4">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-3xl font-black text-foreground tabular-nums">{pack.sol_price}</span>
                      <span className="text-sm font-medium text-muted-foreground">SOL</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">≈ ${usdValue} USD</p>
                  </div>

                  <div className="mb-5 space-y-2">
                    <div className="flex items-center gap-2">
                      <Coins className="w-4 h-4 text-primary shrink-0" />
                      <span className="text-lg font-bold text-primary">{pack.credits_amount.toLocaleString()}</span>
                      <span className="text-sm text-muted-foreground">credits</span>
                    </div>
                    {pack.bonus_credits > 0 && (
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-success shrink-0" />
                        <Badge className="bg-success/15 text-success border-success/30 text-[10px] px-2">
                          +{pack.bonus_credits} bonus
                        </Badge>
                      </div>
                    )}
                    <p className="text-[10px] text-muted-foreground/70">{perCredit} SOL per 1k credits</p>
                  </div>

                  <div className="mt-auto">
                    <Button
                      variant={isBest ? "glow" : "default"}
                      className="w-full h-10"
                      disabled={isLoading || txStatus === "confirming"}
                      onClick={() => handlePurchase(pack)}
                    >
                      {isLoading ? (
                        <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> {txStatus === "signing" ? "Sign in Wallet…" : "Confirming…"}</>
                      ) : !user ? (
                        <>Sign In <ArrowRight className="w-4 h-4 ml-1" /></>
                      ) : !wallet.isConnected ? (
                        <><Wallet className="w-4 h-4 mr-1" /> Connect Wallet</>
                      ) : (
                        <><ShoppingCart className="w-4 h-4 mr-1" /> Buy Now</>
                      )}
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Credit Cost Breakdown */}
        <div className="rounded-2xl border border-border/30 bg-card/50 overflow-hidden">
          <div className="px-5 py-3 border-b border-border/20 flex items-center gap-2">
            <Coins className="w-4 h-4 text-primary" />
            <span className="text-sm font-bold text-foreground">Credit Costs Per Action</span>
          </div>
          <div className="p-5">
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {COST_EXAMPLES.map((item) => (
                <div key={item.action} className="p-3 rounded-xl bg-secondary/30 border border-border/20 text-center space-y-1.5 hover:border-primary/20 transition-colors">
                  <div className="flex justify-center text-primary">{item.icon}</div>
                  <p className="text-lg font-black text-primary tabular-nums">{item.cost}</p>
                  <p className="text-[11px] text-muted-foreground font-medium">{item.action}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Purchase History - Modern table design */}
        {user && transactions.length > 0 && (
          <div className="rounded-2xl border border-border/30 bg-card/50 overflow-hidden">
            <div className="px-5 py-3 border-b border-border/20 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary" />
                <span className="text-sm font-bold text-foreground">Purchase History</span>
                <Badge variant="outline" className="text-[10px] text-muted-foreground border-border/40">{transactions.length}</Badge>
              </div>
              <Tooltip>
                <TooltipTrigger>
                  <HelpCircle className="w-3.5 h-3.5 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs text-xs">
                  <p className="font-semibold mb-1">Status Guide:</p>
                  <ul className="space-y-1">
                    <li><span className="text-success font-medium">Confirmed</span> — Verified, credits added.</li>
                    <li><span className="text-warning font-medium">Pending</span> — Awaiting verification (30-60s).</li>
                    <li><span className="text-destructive font-medium">Failed</span> — Verification failed.</li>
                  </ul>
                </TooltipContent>
              </Tooltip>
            </div>

            {/* Table Header */}
            <div className="hidden sm:grid grid-cols-[1fr_100px_90px_100px_120px_80px] gap-3 px-5 py-2.5 text-[10px] uppercase tracking-wider text-muted-foreground/60 font-medium border-b border-border/15">
              <div>Transaction</div>
              <div className="text-right">SOL</div>
              <div className="text-right">Credits</div>
              <div className="text-center">Status</div>
              <div className="text-right">Date</div>
              <div className="text-center">Link</div>
            </div>

            <div className="divide-y divide-border/10 max-h-[400px] overflow-y-auto">
              {transactions.slice(0, 20).map((tx) => {
                const cfg = STATUS_CONFIG[tx.status] || STATUS_CONFIG.pending;
                return (
                  <div key={tx.id} className="grid grid-cols-1 sm:grid-cols-[1fr_100px_90px_100px_120px_80px] gap-2 sm:gap-3 px-5 py-3.5 hover:bg-secondary/20 transition-colors items-center">
                    {/* TX Hash */}
                    <div className="min-w-0">
                      <span className="text-xs font-mono text-foreground/80 truncate block">
                        {tx.tx_hash.slice(0, 12)}...{tx.tx_hash.slice(-6)}
                      </span>
                      {/* Mobile: show inline data */}
                      <div className="flex items-center gap-2 mt-1 sm:hidden text-[11px] text-muted-foreground">
                        <span>{Number(tx.amount_sol).toFixed(4)} SOL</span>
                        <span>•</span>
                        <span className={tx.credits_added > 0 ? "text-success font-semibold" : ""}>
                          {tx.credits_added > 0 ? `+${tx.credits_added}` : "0"} credits
                        </span>
                        <span>•</span>
                        <Badge className={`text-[9px] px-1.5 py-0 ${cfg.color} border`}>
                          {cfg.label}
                        </Badge>
                      </div>
                      {/* Failure/pending messages */}
                      {tx.status === "pending" && (
                        <p className="text-[10px] text-warning mt-1 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3 shrink-0" />
                          Awaiting on-chain confirmation. If pending &gt;5min, contact support.
                        </p>
                      )}
                      {(tx as any).failure_reason && (
                        <p className="text-[10px] text-destructive mt-1 flex items-center gap-1">
                          <XCircle className="w-3 h-3 shrink-0" />
                          {(tx as any).failure_reason}
                        </p>
                      )}
                      {tx.status === "confirmed" && tx.credits_added === 0 && (
                        <p className="text-[10px] text-warning mt-1">
                          ⚠️ Confirmed but 0 credits — contact support with TX hash.
                        </p>
                      )}
                    </div>

                    {/* SOL */}
                    <div className="hidden sm:block text-right text-xs font-mono text-foreground tabular-nums">
                      {Number(tx.amount_sol).toFixed(4)}
                    </div>

                    {/* Credits */}
                    <div className={`hidden sm:block text-right text-xs font-semibold tabular-nums ${tx.credits_added > 0 ? "text-success" : "text-muted-foreground"}`}>
                      {tx.credits_added > 0 ? `+${tx.credits_added}` : "—"}
                    </div>

                    {/* Status */}
                    <div className="hidden sm:flex justify-center">
                      <Badge className={`text-[10px] px-2 py-0.5 ${cfg.color} border gap-1`}>
                        {cfg.icon}
                        {cfg.label}
                      </Badge>
                    </div>

                    {/* Date */}
                    <div className="hidden sm:block text-right text-[11px] text-muted-foreground">
                      {new Date(tx.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </div>

                    {/* Solscan */}
                    <div className="hidden sm:flex justify-center">
                      <a
                        href={`https://solscan.io/tx/${tx.tx_hash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 rounded-lg hover:bg-primary/10 transition-colors"
                      >
                        <ExternalLink className="w-3.5 h-3.5 text-muted-foreground hover:text-primary" />
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
