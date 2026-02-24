import AppLayout from "@/components/layout/AppLayout";
import { useCredits } from "@/contexts/CreditContext";
import { Badge } from "@/components/ui/badge";
import { Coins } from "lucide-react";
import BuyCreditsModal from "@/components/credits/BuyCreditsModal";

export default function Pricing() {
  const { credits } = useCredits();

  return (
    <AppLayout>
      <div className="container mx-auto px-4 py-6 max-w-5xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Buy Credits</h1>
          <p className="text-muted-foreground">Power your sniping with SOL-based credit packs</p>
          <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-card border border-border rounded-lg">
            <Coins className="w-4 h-4 text-primary" />
            <span className="text-sm text-muted-foreground">Current Balance:</span>
            <Badge variant="outline" className="text-sm font-bold">
              {credits.credit_balance.toLocaleString()} credits
            </Badge>
          </div>
        </div>

        <div className="flex justify-center">
          <BuyCreditsModal
            trigger={
              <button className="px-8 py-4 bg-primary text-primary-foreground rounded-xl font-semibold text-lg hover:bg-primary/90 transition-colors flex items-center gap-2">
                <Coins className="w-5 h-5" />
                View Credit Packs
              </button>
            }
          />
        </div>
      </div>
    </AppLayout>
  );
}
