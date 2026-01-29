import { Coins } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useDisplayUnit } from "@/contexts/DisplayUnitContext";

export default function SolTradesBanner() {
  const { solPrice, solPriceLoading } = useDisplayUnit();

  return (
    <div className="flex items-center justify-between px-3 py-1.5 bg-gradient-to-r from-primary/8 via-transparent to-accent/8 rounded-lg border border-border/40">
      <div className="flex items-center gap-2">
        <Coins className="w-3.5 h-3.5 text-primary" />
        <span className="text-[10px] font-medium text-muted-foreground">
          All trades executed in SOL
        </span>
      </div>
      <Badge 
        variant="outline" 
        className="text-[10px] bg-background/50 border-border/50 py-0.5"
      >
        <span className="text-muted-foreground mr-1">SOL:</span>
        <span className="text-foreground font-mono">
          {solPriceLoading ? '...' : `$${solPrice.toFixed(2)}`}
        </span>
      </Badge>
    </div>
  );
}
