import { useCredits } from "@/contexts/CreditContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Coins, AlertTriangle, Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function CreditBanner() {
  const { credits, usageToday, loading } = useCredits();
  const navigate = useNavigate();

  if (loading) return null;

  const isLow = credits.credit_balance > 0 && credits.credit_balance <= 50;
  const isEmpty = credits.credit_balance <= 0;
  const estimatedSnipes = Math.floor(credits.credit_balance / 5);

  return (
    <div className={`flex items-center gap-3 p-2.5 rounded-lg border text-xs ${
      isEmpty ? 'bg-destructive/10 border-destructive/30' :
      isLow ? 'bg-warning/10 border-warning/30' :
      'bg-card/50 border-border/50'
    }`}>
      {isEmpty ? (
        <>
          <AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0" />
          <span className="text-destructive font-medium">No credits remaining — bot functionality paused</span>
          <Button size="sm" variant="destructive" className="ml-auto h-6 text-[10px]" onClick={() => navigate('/pricing')}>
            Buy Credits
          </Button>
        </>
      ) : (
        <>
          <Badge variant="outline" className="text-[10px] flex-shrink-0 gap-1">
            <Coins className="w-3 h-3" />
            {credits.credit_balance.toLocaleString()} credits
          </Badge>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="text-muted-foreground whitespace-nowrap">Today: {usageToday}</span>
            <span className="text-muted-foreground">•</span>
            <span className="text-muted-foreground whitespace-nowrap">~{estimatedSnipes} snipes left</span>
          </div>
          {isLow && (
            <span className="text-warning text-[10px] font-medium whitespace-nowrap">Low balance!</span>
          )}
          <Button size="sm" variant="outline" className="ml-auto h-6 text-[10px] gap-1" onClick={() => navigate('/pricing')}>
            <Zap className="w-3 h-3" />
            Buy Credits
          </Button>
        </>
      )}
    </div>
  );
}
