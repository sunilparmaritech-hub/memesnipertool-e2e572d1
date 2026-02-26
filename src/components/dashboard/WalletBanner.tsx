import React, { forwardRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Wallet, ExternalLink, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDisplayUnit } from "@/contexts/DisplayUnitContext";

interface WalletBannerProps {
  address: string;
  balance: string;
  network: string;
}

const WalletBanner = forwardRef<HTMLDivElement, WalletBannerProps>(function WalletBanner({ address, balance, network }, ref) {
  const [copied, setCopied] = useState(false);
  const { solPrice, solToUsd } = useDisplayUnit();

  const balanceNum = parseFloat(balance) || 0;
  const balanceUsd = solToUsd(balanceNum);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div ref={ref} className="relative overflow-hidden rounded-xl border border-border/30 bg-card/40">
      <div className="px-4 sm:px-5 py-3 sm:py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Left: Wallet Info */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20 shrink-0">
            <Wallet className="w-4 h-4 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest mb-0.5">Connected Wallet</p>
            <div className="flex items-center gap-1.5 flex-wrap">
              <p className="font-mono text-sm font-semibold text-foreground whitespace-nowrap">
                {address.slice(0, 6)}...{address.slice(-4)}
              </p>
              {/* Network label removed */}
              <Button variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground hover:text-foreground" onClick={handleCopy}>
                {copied ? <Check className="w-3 h-3 text-success" /> : <Copy className="w-3 h-3" />}
              </Button>
              <a href={`https://solscan.io/account/${address}`} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors">
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </div>

        {/* Right: Balance + Breakdown + Network */}
        <div className="flex items-center gap-4 sm:gap-6 shrink-0">
          <div className="text-right">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest mb-0.5">Balance</p>
            <div className="flex items-baseline gap-1">
              <span className="text-xl sm:text-2xl font-bold text-foreground tabular-nums">{balanceNum.toFixed(4)}</span>
              <span className="text-xs font-semibold text-primary">SOL</span>
              <span className="text-xs text-muted-foreground font-mono ml-1">(${balanceUsd.toFixed(2)} USD)</span>
            </div>
          </div>
          <div className="hidden sm:block h-8 w-px bg-border/30" />
          <div className="hidden sm:block text-right">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest mb-0.5">Breakdown</p>
            <p className="text-sm text-muted-foreground font-mono">~ ${(balanceUsd * 0.1).toFixed(2)} USD</p>
          </div>
          {/* Network section removed per user request */}
        </div>
      </div>
    </div>
  );
});

export default WalletBanner;
