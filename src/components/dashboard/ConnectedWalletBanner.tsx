import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Wallet, ExternalLink, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDisplayUnit } from "@/contexts/DisplayUnitContext";

interface ConnectedWalletBannerProps {
  address: string;
  balance: string;
  balanceUsd?: number;
  network: string;
  breakdown?: string;
}

export default function ConnectedWalletBanner({ 
  address, 
  balance, 
  balanceUsd,
  network,
  breakdown = "~ $23.38 USD"
}: ConnectedWalletBannerProps) {
  const [copied, setCopied] = useState(false);
  const { solToUsd } = useDisplayUnit();
  
  const balanceNum = parseFloat(balance) || 0;
  const computedBalanceUsd = balanceUsd ?? solToUsd(balanceNum);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const truncatedAddress = `${address.slice(0, 6)}...${address.slice(-4)}`;

  return (
    <Card className="border border-border/50 bg-card/80 backdrop-blur-sm">
      <CardContent className="py-2.5 px-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Left - Wallet Info */}
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/15 border border-primary/20">
              <Wallet className="w-4 h-4 text-primary" />
            </div>
            
            <div className="space-y-0">
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider block">
                Connected Wallet
              </span>
              <div className="flex items-center gap-1.5">
                <span className="font-mono text-sm font-medium text-foreground">{truncatedAddress}</span>
                <span className="text-xs text-muted-foreground">(SOL)</span>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-5 w-5 text-muted-foreground hover:text-foreground"
                  onClick={handleCopy}
                >
                  {copied ? (
                    <Check className="w-3 h-3 text-success" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                </Button>
                <a 
                  href={`https://solscan.io/account/${address}`} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-primary transition-colors"
                >
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          </div>
          
          {/* Right - Balance and Network */}
          <div className="flex items-center gap-5 md:gap-6">
            {/* Balance */}
            <div className="text-right">
              <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                Balance
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-xl font-bold text-foreground">{balanceNum.toFixed(4)}</span>
                <span className="text-sm font-semibold text-primary">SOL</span>
                <span className="text-xs text-muted-foreground ml-1">(${computedBalanceUsd.toFixed(2)} USD)</span>
              </div>
            </div>
            
            {/* Breakdown */}
            <div className="text-right hidden md:block">
              <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                Breakdown
              </div>
              <div className="text-xs text-muted-foreground">{breakdown}</div>
            </div>
            
            {/* Network */}
            <div className="text-right">
              <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                Network
              </div>
              <Badge 
                variant="outline" 
                className="capitalize bg-success/10 text-success border-success/30 font-medium text-xs"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-success mr-1.5 animate-pulse" />
                {network}
              </Badge>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
