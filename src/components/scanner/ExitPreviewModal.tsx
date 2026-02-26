import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertTriangle, ExternalLink, Wallet, CheckCircle2, XCircle, ArrowRight, Coins, TrendingUp, TrendingDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { formatPrice, getTokenDisplayName, getTokenDisplaySymbol } from "@/lib/formatters";
import { useSolPrice } from "@/hooks/useSolPrice";

interface Position {
  id: string;
  token_name: string;
  token_symbol: string;
  token_address: string;
  amount: number;
  entry_price: number;
  current_price: number;
  profit_loss_percent: number | null;
}

interface ExitPreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  position: Position | null;
  walletAddress: string;
  onConfirmExit: (positionId: string, amountToSell: number, currentPrice: number) => Promise<void>;
}

interface OnChainData {
  balanceUi: number;
  decimals: number;
  loading: boolean;
  error: string | null;
}

export default function ExitPreviewModal({
  open,
  onOpenChange,
  position,
  walletAddress,
  onConfirmExit,
}: ExitPreviewModalProps) {
  const [onChainData, setOnChainData] = useState<OnChainData>({
    balanceUi: 0,
    decimals: 6,
    loading: true,
    error: null,
  });
  const [isExiting, setIsExiting] = useState(false);
  const [exitStatus, setExitStatus] = useState<'idle' | 'pending' | 'confirming' | 'success' | 'failed'>('idle');
  
  // Get real-time SOL price for accurate conversion
  const { price: solPrice } = useSolPrice();

  // Fetch on-chain balance when modal opens
  useEffect(() => {
    if (!open || !position || !walletAddress) {
      setOnChainData({ balanceUi: 0, decimals: 6, loading: false, error: null });
      setExitStatus('idle');
      return;
    }

    const fetchOnChainData = async () => {
      setOnChainData(prev => ({ ...prev, loading: true, error: null }));
      
      try {
        const { data, error } = await supabase.functions.invoke('token-metadata', {
          body: { mint: position.token_address, owner: walletAddress },
        });

        if (error) {
          throw new Error(error.message || 'Failed to fetch token metadata');
        }

        const balanceUi = Number((data as any)?.balanceUi);
        const decimals = Number((data as any)?.decimals);

        if (!Number.isFinite(balanceUi)) {
          throw new Error('Invalid balance returned');
        }

        setOnChainData({
          balanceUi,
          decimals: Number.isFinite(decimals) ? decimals : 6,
          loading: false,
          error: null,
        });
      } catch (err) {
        setOnChainData({
          balanceUi: 0,
          decimals: 6,
          loading: false,
          error: err instanceof Error ? err.message : 'Failed to fetch on-chain data',
        });
      }
    };

    fetchOnChainData();
  }, [open, position, walletAddress]);

  const handleConfirmExit = useCallback(async () => {
    if (!position || onChainData.balanceUi <= 0) return;

    setIsExiting(true);
    setExitStatus('pending');

    try {
      await onConfirmExit(position.id, onChainData.balanceUi, position.current_price);
      setExitStatus('success');
      // Close modal after short delay on success
      setTimeout(() => {
        onOpenChange(false);
      }, 1500);
    } catch (err) {
      setExitStatus('failed');
    } finally {
      setIsExiting(false);
    }
  }, [position, onChainData.balanceUi, onConfirmExit, onOpenChange]);

  if (!position) return null;

  // Calculate values properly
  const currentValueUsd = onChainData.balanceUi * position.current_price;
  const estimatedSolReceived = solPrice > 0 ? currentValueUsd / solPrice : 0;
  const pnlPercent = position.profit_loss_percent ?? 0;
  const isPositive = pnlPercent >= 0;
  
  // Get proper display names
  const displayName = getTokenDisplayName(position.token_name, position.token_address);
  const displaySymbol = getTokenDisplaySymbol(position.token_symbol, position.token_address);
  
  // Use percentage-based tolerance (5%) to ignore minor rounding differences
  const percentDiff = position.amount > 0 
    ? Math.abs(onChainData.balanceUi - position.amount) / position.amount 
    : 0;
  const absoluteDiff = Math.abs(onChainData.balanceUi - position.amount);
  const balanceMismatch = percentDiff > 0.05 && absoluteDiff > 1;
  
  const hasNoBalance = onChainData.balanceUi <= 0 && !onChainData.loading;
  
  // Format token amount with appropriate precision
  const formatTokenAmount = (amount: number) => {
    if (amount >= 1000000) return `${(amount / 1000000).toFixed(2)}M`;
    if (amount >= 1000) return `${(amount / 1000).toFixed(2)}K`;
    if (amount >= 1) return amount.toFixed(4);
    return amount.toFixed(6);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md border-border/50 bg-background/95 backdrop-blur-sm">
        <DialogHeader className="pb-2">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <div className="p-2 rounded-lg bg-destructive/10 border border-destructive/20">
              <Wallet className="w-4 h-4 text-destructive" />
            </div>
            Confirm Exit
          </DialogTitle>
          <DialogDescription className="text-xs">
            Review on-chain data before selling
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Token Header Card */}
          <div className="p-4 rounded-xl bg-gradient-to-br from-secondary/50 to-secondary/20 border border-border/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center font-bold text-sm text-primary">
                  {displaySymbol.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">{displayName}</h3>
                  <p className="text-xs text-muted-foreground">{displaySymbol}</p>
                </div>
              </div>
              <a
                href={`https://solscan.io/token/${position.token_address}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary flex items-center gap-1 hover:underline px-2 py-1 rounded-md hover:bg-primary/10 transition-colors"
              >
                Solscan
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>

          {/* On-Chain Data */}
          {onChainData.loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-primary mr-2" />
              <span className="text-sm text-muted-foreground">Fetching wallet balance...</span>
            </div>
          ) : onChainData.error ? (
            <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-destructive">Failed to fetch data</p>
                  <p className="text-xs text-muted-foreground mt-1">{onChainData.error}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Holdings & Value Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-secondary/30 border border-border/20">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Coins className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-[11px] text-muted-foreground uppercase tracking-wide">Holdings</span>
                  </div>
                  <p className="font-mono font-bold text-lg tabular-nums">
                    {formatTokenAmount(onChainData.balanceUi)}
                  </p>
                  <p className="text-[11px] text-muted-foreground">tokens</p>
                </div>
                
                <div className="p-3 rounded-xl bg-secondary/30 border border-border/20">
                  <div className="flex items-center gap-1.5 mb-1">
                    <TrendingUp className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-[11px] text-muted-foreground uppercase tracking-wide">Current Price</span>
                  </div>
                  <p className="font-mono font-bold text-lg tabular-nums">
                    {formatPrice(position.current_price)}
                  </p>
                  <p className="text-[11px] text-muted-foreground">USD</p>
                </div>
              </div>

              {/* Estimated Returns - Highlight Card */}
              <div className="p-4 rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 border border-primary/30">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-foreground">Estimated Returns</span>
                  <Badge 
                    variant="outline" 
                    className={cn(
                      "text-xs font-medium",
                      isPositive 
                        ? "border-success/40 text-success bg-success/10" 
                        : "border-destructive/40 text-destructive bg-destructive/10"
                    )}
                  >
                    {isPositive ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingDown className="w-3 h-3 mr-1" />}
                    {isPositive ? '+' : ''}{pnlPercent.toFixed(2)}%
                  </Badge>
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-2xl font-bold font-mono tabular-nums text-primary">
                      {estimatedSolReceived.toFixed(4)} SOL
                    </p>
                    <p className="text-sm text-muted-foreground font-mono tabular-nums">
                      ≈ ${currentValueUsd.toFixed(2)} USD
                    </p>
                  </div>
                  <div className="text-right text-xs text-muted-foreground">
                    <p>SOL @ ${solPrice.toFixed(2)}</p>
                    <p>Dec: {onChainData.decimals}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Warnings */}
          {balanceMismatch && !onChainData.loading && !onChainData.error && (
            <div className="p-3 rounded-xl bg-warning/10 border border-warning/30">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-warning mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-warning">Balance Mismatch</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Expected {position.amount.toLocaleString()}, found {onChainData.balanceUi.toLocaleString()}. Using on-chain balance.
                  </p>
                </div>
              </div>
            </div>
          )}

          {hasNoBalance && (
            <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/30">
              <div className="flex items-start gap-2">
                <XCircle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-destructive">No Token Balance</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Wallet doesn't hold this token. It may have been sold already.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Exit Status */}
          {exitStatus !== 'idle' && (
            <div className={cn(
              "p-3 rounded-xl border flex items-center gap-3",
              exitStatus === 'success' ? 'bg-success/10 border-success/30' :
              exitStatus === 'failed' ? 'bg-destructive/10 border-destructive/30' :
              'bg-primary/10 border-primary/30'
            )}>
              {exitStatus === 'pending' && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
              {exitStatus === 'confirming' && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
              {exitStatus === 'success' && <CheckCircle2 className="w-4 h-4 text-success" />}
              {exitStatus === 'failed' && <XCircle className="w-4 h-4 text-destructive" />}
              <span className="text-sm font-medium">
                {exitStatus === 'pending' && 'Waiting for wallet approval...'}
                {exitStatus === 'confirming' && 'Confirming transaction...'}
                {exitStatus === 'success' && 'Position closed successfully!'}
                {exitStatus === 'failed' && 'Exit failed. Please try again.'}
              </span>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-2 pt-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isExiting}
            className="flex-1 sm:flex-none"
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirmExit}
            disabled={onChainData.loading || hasNoBalance || isExiting || exitStatus === 'success'}
            className="flex-1 sm:flex-none gap-2"
          >
            {isExiting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Selling...
              </>
            ) : (
              <>
                <ArrowRight className="w-4 h-4" />
                Sell for {estimatedSolReceived.toFixed(4)} SOL
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
