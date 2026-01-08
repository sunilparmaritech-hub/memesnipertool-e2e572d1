import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Wallet } from "lucide-react";

interface WalletBannerProps {
  address: string;
  balance: string;
  network: string;
}

export default function WalletBanner({ address, balance, network }: WalletBannerProps) {
  return (
    <Card className="border-primary/20 bg-gradient-to-r from-primary/5 via-primary/3 to-transparent backdrop-blur-sm">
      <CardContent className="p-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/20">
              <Wallet className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Connected Wallet</p>
              <p className="font-mono text-sm text-foreground">
                {address.slice(0, 8)}...{address.slice(-6)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-center sm:text-right">
              <p className="text-xs text-muted-foreground font-medium">Balance</p>
              <p className="font-semibold text-foreground">{balance || '0'} SOL</p>
            </div>
            <div className="text-center sm:text-right">
              <p className="text-xs text-muted-foreground font-medium">Network</p>
              <Badge variant="outline" className="capitalize mt-0.5">{network}</Badge>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
