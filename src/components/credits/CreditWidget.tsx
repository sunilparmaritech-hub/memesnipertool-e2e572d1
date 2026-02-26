import { useCredits } from "@/hooks/useCredits";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Coins, AlertTriangle, ShoppingCart, Crown, Zap, BarChart3 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useMemo } from "react";

export default function CreditWidget() {
  const { balance, credits, creditsLoading, isAdmin, CREDIT_COSTS } = useCredits();
  const navigate = useNavigate();

  const estimatedSnipes = useMemo(() => {
    const cost = CREDIT_COSTS.auto_execution || 5;
    return Math.floor(balance / cost);
  }, [balance, CREDIT_COSTS]);

  const totalPurchased = credits?.total_credits_purchased ?? 0;
  const totalUsed = credits?.total_credits_used ?? 0;
  const usedPct = totalPurchased > 0 ? Math.min(100, Math.round((totalUsed / totalPurchased) * 100)) : 0;
  const isLow = balance < 50 && balance > 0;
  const isEmpty = balance <= 0;

  if (creditsLoading) return null;

  // Admin: show unlimited badge
  if (isAdmin) {
    return (
      <div className="glass rounded-xl p-4 space-y-3 border border-primary/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Crown className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Admin Access</h3>
          </div>
          <Badge className="bg-primary/20 text-primary border-primary/30 text-[10px]">Unlimited</Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          Admin accounts have unlimited credits. No deductions applied.
        </p>
      </div>
    );
  }

  return (
    <div className={`glass rounded-xl p-4 space-y-3 ${isEmpty ? "border border-destructive/30" : isLow ? "border border-warning/30" : "border border-border/20"}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Coins className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Credits</h3>
        </div>
        {isEmpty ? (
          <Badge variant="destructive" className="text-[10px]">
            <AlertTriangle className="w-3 h-3 mr-1" /> Empty
          </Badge>
        ) : isLow ? (
          <Badge className="bg-warning/20 text-warning border-warning/30 text-[10px]">
            <AlertTriangle className="w-3 h-3 mr-1" /> Low
          </Badge>
        ) : (
          <Badge className="bg-success/20 text-success border-success/30 text-[10px]">Active</Badge>
        )}
      </div>

      {/* Balance */}
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-bold text-foreground">{balance.toLocaleString()}</span>
        <span className="text-xs text-muted-foreground">credits remaining</span>
      </div>

      {/* Usage Progress */}
      <div className="space-y-1">
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">Usage</span>
          <span className={usedPct >= 90 ? "text-destructive font-medium" : "text-muted-foreground"}>
            {totalUsed.toLocaleString()} used / {totalPurchased.toLocaleString()} total
          </span>
        </div>
        <Progress value={usedPct} className="h-1.5" />
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="p-2 rounded-lg bg-secondary/50">
          <span className="text-muted-foreground">Est. Snipes</span>
          <p className="font-semibold text-foreground">{estimatedSnipes}</p>
        </div>
        <div className="p-2 rounded-lg bg-secondary/50">
          <span className="text-muted-foreground">Total Used</span>
          <p className="font-semibold text-foreground">{totalUsed.toLocaleString()}</p>
        </div>
      </div>

      {/* Credit Capacity Per Action */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-1.5">
          <BarChart3 className="w-3 h-3 text-muted-foreground" />
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Credit Capacity</span>
        </div>
        <div className="grid grid-cols-1 gap-1.5 text-[10px]">
          {[
            { label: "Token Scan", key: "token_validation" },
            { label: "Auto Snipe", key: "auto_execution" },
            { label: "Clustering", key: "clustering_call" },
            { label: "API Check", key: "api_check" },
            { label: "Manual Trade", key: "manual_trade" },
          ].map((item) => {
            const cost = CREDIT_COSTS[item.key] ?? 1;
            const totalCapacity = totalPurchased > 0 ? Math.floor(totalPurchased / cost) : 0;
            const usedCapacity = totalUsed > 0 ? Math.floor(totalUsed / cost) : 0;
            const remainingCapacity = Math.floor(balance / cost);
            const capacityPct = totalCapacity > 0 ? Math.min(100, Math.round((usedCapacity / totalCapacity) * 100)) : 0;
            return (
              <div key={item.key} className="px-2 py-1.5 rounded bg-secondary/30 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">{item.label} <span className="text-[9px] opacity-60">({cost} cr)</span></span>
                  <span className="font-semibold text-primary">{remainingCapacity}/{totalCapacity}</span>
                </div>
                <Progress value={capacityPct} className="h-1" />
              </div>
            );
          })}
        </div>
      </div>

      {/* Warnings */}
      {isLow && !isEmpty && (
        <div className="p-2 rounded-lg bg-warning/10 border border-warning/20 text-xs text-warning">
          ⚠️ Credits running low. Top up to avoid interruptions.
        </div>
      )}

      {isEmpty && (
        <div className="p-2 rounded-lg bg-destructive/10 border border-destructive/20 text-xs text-destructive">
          🚫 Bot paused — no credits remaining. Scanner & trading disabled.
        </div>
      )}

      <Button
        variant={isEmpty ? "glow" : "outline"}
        size="sm"
        className="w-full text-xs"
        onClick={() => navigate("/pricing")}
      >
        <ShoppingCart className="w-3 h-3 mr-1" />
        {isEmpty ? "Buy Credits Now" : "Buy More Credits"}
      </Button>
    </div>
  );
}
