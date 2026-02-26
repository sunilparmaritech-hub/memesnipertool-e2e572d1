import { useCredits } from "@/hooks/useCredits";
import { Progress } from "@/components/ui/progress";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowUpRight, Coins } from "lucide-react";

export default function UsageMeter() {
  const { balance, credits, CREDIT_COSTS } = useCredits();
  const navigate = useNavigate();

  const estimatedSnipes = Math.floor(balance / (CREDIT_COSTS.auto_execution || 5));
  const totalPurchased = credits?.total_credits_purchased ?? 1;
  const usedPct = totalPurchased > 0 ? Math.min(100, Math.round(((credits?.total_credits_used ?? 0) / totalPurchased) * 100)) : 0;

  return (
    <div className="glass rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Coins className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Credits</h3>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="text-xs text-primary h-6 px-2"
          onClick={() => navigate("/pricing")}
        >
          Buy More <ArrowUpRight className="w-3 h-3 ml-1" />
        </Button>
      </div>

      <div className="flex items-baseline gap-1">
        <span className="text-xl font-bold text-foreground">{balance.toLocaleString()}</span>
        <span className="text-xs text-muted-foreground">remaining</span>
      </div>

      <div className="space-y-1">
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">Usage</span>
          <span className={usedPct >= 90 ? "text-destructive font-medium" : "text-muted-foreground"}>
            {credits?.total_credits_used ?? 0} used / {totalPurchased} total
          </span>
        </div>
        <Progress value={usedPct} className="h-1.5" />
      </div>

      <div className="text-xs text-muted-foreground">
        ~{estimatedSnipes} snipes remaining
      </div>
    </div>
  );
}
