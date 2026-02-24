import { ReactNode } from "react";
import { useCredits } from "@/contexts/CreditContext";
import { Lock, Coins } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

interface CreditGateProps {
  requiredCredits?: number;
  children: ReactNode;
  fallback?: ReactNode;
  overlay?: boolean;
}

export default function CreditGate({ 
  requiredCredits = 1, 
  children, 
  fallback, 
  overlay = false 
}: CreditGateProps) {
  const { hasCredits } = useCredits();
  const navigate = useNavigate();

  if (hasCredits(requiredCredits)) return <>{children}</>;

  if (fallback) return <>{fallback}</>;

  if (overlay) {
    return (
      <div className="relative">
        <div className="opacity-30 pointer-events-none select-none blur-[2px]">
          {children}
        </div>
        <div className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-sm rounded-lg">
          <div className="text-center space-y-2 p-4">
            <Lock className="w-6 h-6 text-muted-foreground mx-auto" />
            <p className="text-xs text-muted-foreground font-medium">Insufficient credits</p>
            <Button size="sm" variant="outline" onClick={() => navigate('/pricing')} className="text-xs h-7">
              <Coins className="w-3 h-3 mr-1" />
              Buy Credits
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center p-6 border border-border/50 rounded-lg bg-card/50">
      <div className="text-center space-y-3">
        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
          <Coins className="w-5 h-5 text-primary" />
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">Insufficient Credits</p>
          <p className="text-xs text-muted-foreground mt-1">
            You need {requiredCredits} credits for this action
          </p>
        </div>
        <Button size="sm" onClick={() => navigate('/pricing')}>
          <Coins className="w-3 h-3 mr-1" />
          Buy Credits
        </Button>
      </div>
    </div>
  );
}
