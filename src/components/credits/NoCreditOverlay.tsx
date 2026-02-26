import { AlertTriangle, ShoppingCart, Coins } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

interface NoCreditOverlayProps {
  feature: "scanner" | "bot" | "validation" | "trade";
  className?: string;
}

const FEATURE_MESSAGES: Record<string, { title: string; description: string }> = {
  scanner: {
    title: "Token Scanner Paused",
    description: "You need credits to scan for new tokens. Purchase credits to resume scanning.",
  },
  bot: {
    title: "Auto-Sniper Bot Paused",
    description: "The bot requires credits to execute trades automatically. Top up your balance to continue.",
  },
  validation: {
    title: "Token Validation Unavailable",
    description: "Credit balance is empty. Validation checks require credits to run.",
  },
  trade: {
    title: "Trading Disabled",
    description: "You need credits to execute trades. Purchase a credit pack to start trading.",
  },
};

export function NoCreditOverlay({ feature, className = "" }: NoCreditOverlayProps) {
  const navigate = useNavigate();
  const msg = FEATURE_MESSAGES[feature] || FEATURE_MESSAGES.scanner;

  return (
    <div className={`relative rounded-xl border border-destructive/30 bg-destructive/5 backdrop-blur-sm p-6 ${className}`}>
      <div className="flex flex-col items-center text-center space-y-4">
        <div className="p-3 rounded-full bg-destructive/10 border border-destructive/20">
          <AlertTriangle className="w-8 h-8 text-destructive" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-foreground">{msg.title}</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-md">{msg.description}</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Coins className="w-4 h-4" />
          <span>Credit Balance: <strong className="text-destructive">0</strong></span>
        </div>
        <Button variant="glow" onClick={() => navigate("/pricing")} className="mt-2">
          <ShoppingCart className="w-4 h-4 mr-2" />
          Buy Credits Now
        </Button>
      </div>
    </div>
  );
}
