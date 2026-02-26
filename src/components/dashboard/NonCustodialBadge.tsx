import { ShieldCheck, Wallet } from "lucide-react";
import { Link } from "react-router-dom";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export default function NonCustodialBadge() {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-primary/15 bg-primary/5">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1.5 cursor-help">
              <ShieldCheck className="w-4 h-4 text-primary shrink-0" />
              <span className="text-[11px] font-semibold text-primary whitespace-nowrap">Non-Custodial</span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-[250px]">
            <p className="text-xs">Your keys, your crypto. We never store or control your private keys or funds.</p>
          </TooltipContent>
        </Tooltip>
        <div className="hidden sm:flex items-center gap-1.5 text-muted-foreground">
          <Wallet className="w-3 h-3" />
          <span className="text-[10px]">You sign all transactions in your wallet</span>
        </div>
      </div>
      <Link to="/non-custodial-disclosure" className="text-[10px] text-primary/70 hover:text-primary underline shrink-0">
        Learn more
      </Link>
    </div>
  );
}
