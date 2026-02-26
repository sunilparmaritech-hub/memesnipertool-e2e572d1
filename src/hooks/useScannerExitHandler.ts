/**
 * Scanner Exit Handler Hook
 * 
 * Extracted from Scanner.tsx - handles all position exit logic including
 * Jupiter exits, Raydium fallback, partial exits, and error handling.
 */

import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { addBotLog } from '@/components/scanner/BotActivityLog';
import { acquireSellLock, releaseSellLock, isSellLocked } from '@/lib/sellLock';

interface ExitHandlerDeps {
  isDemo: boolean;
  wallet: {
    isConnected: boolean;
    network: string | null;
    address: string | null;
    balance: string | null;
  };
  settings: any;
  solPrice: number;
  // Demo functions
  openDemoPositions: any[];
  closeDemoPosition: (id: string, price: number, reason: string) => void;
  addBalance: (amount: number) => void;
  // Live functions
  realOpenPositions: any[];
  exitPosition: (addr: string, amount: number, wallet: string, sign: any, opts: any) => Promise<any>;
  signAndSendTransaction: (tx: any) => Promise<any>;
  markPositionClosed: (id: string, price: number, txHash?: string) => Promise<boolean>;
  fetchPositions: (force?: boolean) => Promise<void>;
  fetchWaitingPositions: () => Promise<void>;
  refreshBalance: () => void;
  moveToWaitingForLiquidity: (id: string) => Promise<boolean>;
  tryRaydiumSwap: (pos: any, amount: number) => Promise<any>;
  openWalletModal: () => void;
}

export function useScannerExitHandler(deps: ExitHandlerDeps) {
  const { toast } = useToast();

  const [exitPreviewPosition, setExitPreviewPosition] = useState<any | null>(null);
  const [showExitPreview, setShowExitPreview] = useState(false);
  const [noRoutePosition, setNoRoutePosition] = useState<any | null>(null);
  const [showNoRouteModal, setShowNoRouteModal] = useState(false);

  const handleOpenExitPreview = useCallback((positionId: string, currentPrice: number) => {
    if (deps.isDemo) {
      deps.closeDemoPosition(positionId, currentPrice, "manual");
      const position = deps.openDemoPositions.find((p: any) => p.id === positionId);
      if (position) {
        const pnlValueUsd = (currentPrice - position.entry_price) * position.amount;
        deps.addBalance((deps.settings?.trade_amount || 0) + (pnlValueUsd / deps.solPrice));
        toast({ title: "Position Closed", description: `${position.token_symbol} manually closed` });
      }
      return;
    }

    const position = deps.realOpenPositions.find((p: any) => p.id === positionId);
    if (!position) {
      toast({ title: "Position not found", description: "This position is no longer active. Refreshing…" });
      deps.fetchPositions(true);
      return;
    }

    setExitPreviewPosition({ ...position, current_price: currentPrice });
    setShowExitPreview(true);
  }, [deps, toast]);

  const handleConfirmExitFromModal = useCallback(async (positionId: string, amountToSell: number, currentPrice: number) => {
    if (!deps.wallet.isConnected || deps.wallet.network !== "solana" || !deps.wallet.address) {
      toast({ title: "Wallet Required", description: "Connect a Solana wallet to confirm the sale.", variant: "destructive" });
      deps.openWalletModal();
      return;
    }

    const position = deps.realOpenPositions.find((p: any) => p.id === positionId);
    if (!position) return;

    if (isSellLocked(position.token_address)) {
      toast({ title: 'Sell Already In Progress', description: `${position.token_symbol} is already being sold.`, variant: 'destructive' });
      return;
    }

    if (!acquireSellLock(position.token_address, 'manual_sell')) {
      toast({ title: 'Sell Already In Progress', description: `${position.token_symbol} is already being sold.`, variant: 'destructive' });
      return;
    }

    const safeExitPrice = Number.isFinite(currentPrice) && currentPrice > 0
      ? currentPrice
      : (position.current_price ?? position.entry_price);

    addBotLog({
      level: 'info', category: 'trade',
      message: 'Exiting position via Jupiter',
      tokenSymbol: position.token_symbol,
      tokenAddress: position.token_address,
      details: `Selling ${amountToSell.toFixed(6)} tokens`,
    });

    const showForceCloseToast = (title: string, description: string) => {
      toast({ title, description, variant: "destructive", duration: 15000 });
    };

    try {
      const result = await deps.exitPosition(
        position.token_address, amountToSell, deps.wallet.address,
        (tx: any) => deps.signAndSendTransaction(tx),
        { slippage: 0.15 }
      );

      if (result.success) {
        // Confirm transaction
        let confirmed = true;
        try {
          let buyerPosition: number | null = null;
          let liquidity: number | null = null;
          let riskScore: number | null = null;
          let entryPriceSol: number | null = null;

          const { data: buyTrade } = await supabase
            .from('trade_history')
            .select('buyer_position, liquidity, risk_score, entry_price, sol_spent')
            .eq('token_address', position.token_address)
            .eq('trade_type', 'buy')
            .order('created_at', { ascending: true })
            .limit(1)
            .maybeSingle();

          if (buyTrade) {
            buyerPosition = buyTrade.buyer_position;
            liquidity = buyTrade.liquidity;
            riskScore = buyTrade.risk_score;
            entryPriceSol = buyTrade.sol_spent || buyTrade.entry_price;
          }

          const { data: confirmData } = await supabase.functions.invoke('confirm-transaction', {
            body: {
              signature: result.txHash, walletAddress: deps.wallet.address,
              action: 'sell', positionId: position.id,
              tokenAddress: position.token_address, tokenSymbol: position.token_symbol,
              tokenName: position.token_name,
              solSpent: 0, solReceived: result.solReceived || position.current_value || 0,
              buyerPosition, liquidity, riskScore,
              entryPrice: position.entry_price_usd, exitPrice: position.current_price,
              priceSol: result.solReceived, slippage: deps.settings?.slippage_tolerance ?? 15,
              matchedBuySolSpent: entryPriceSol,
            },
          });
          confirmed = Boolean((confirmData as any)?.confirmed ?? true);
        } catch { /* ignore */ }

        if (!confirmed) {
          toast({ title: 'Exit Pending Confirmation', description: 'Transaction submitted but not confirmed yet.', variant: 'destructive' });
          await deps.fetchPositions(true);
          releaseSellLock(position.token_address);
          return;
        }

        // Check remaining balance
        let remainingBalance: number | null = null;
        try {
          const { data: meta2 } = await supabase.functions.invoke('token-metadata', {
            body: { mint: position.token_address, owner: deps.wallet.address },
          });
          const bal = Number((meta2 as any)?.balanceUi);
          if (Number.isFinite(bal)) remainingBalance = bal;
        } catch { /* ignore */ }

        const remainingPercent = amountToSell > 0 && remainingBalance !== null
          ? (remainingBalance / amountToSell) * 100 : 0;
        const isSignificant = remainingBalance !== null && remainingBalance > 1e-6 && remainingPercent > 0.01;

        if (isSignificant && remainingPercent < 99) {
          try {
            const retryResult = await deps.exitPosition(
              position.token_address, remainingBalance!, deps.wallet.address!,
              (tx: any) => deps.signAndSendTransaction(tx),
              { slippage: 0.20 }
            );
            if (!retryResult.success) {
              await supabase.from('positions')
                .update({ amount: remainingBalance, updated_at: new Date().toISOString() })
                .eq('id', positionId)
                .eq('user_id', (await supabase.auth.getUser()).data.user?.id);
              toast({ title: 'Partial Exit - Retry Failed', description: `${remainingBalance!.toFixed(6)} ${position.token_symbol} still in wallet.` });
              await deps.fetchPositions(true);
              deps.refreshBalance();
              releaseSellLock(position.token_address);
              return;
            }
          } catch {
            await deps.fetchPositions(true);
            deps.refreshBalance();
            releaseSellLock(position.token_address);
            return;
          }
        }

        const closed = await deps.markPositionClosed(positionId, safeExitPrice, result.txHash);
        if (closed) {
          addBotLog({
            level: 'success', category: 'trade',
            message: 'Position closed successfully',
            tokenSymbol: position.token_symbol,
            details: `Received ${result.solReceived?.toFixed(4)} SOL`,
          });
        } else {
          showForceCloseToast("Exit completed, but position is still open", "The swap went through, but the app couldn't mark it closed.");
        }

        await deps.fetchPositions(true);
        deps.refreshBalance();
        setTimeout(() => deps.refreshBalance(), 8000);
        releaseSellLock(position.token_address);
        return;
      }

      // Handle errors
      const errorMessage = result.error || "Exit failed";
      const isRateLimit = errorMessage.includes("RATE_LIMITED") || errorMessage.includes("429");
      const isNoRoute = errorMessage.includes("NO_ROUTE") || errorMessage.toLowerCase().includes("no route");
      const isAlreadySold = errorMessage.includes("don't have this token") || errorMessage.includes("REQ_INPUT");

      if (isRateLimit) {
        toast({ title: "⏳ Sell temporarily delayed", description: `API busy. Please wait 15-30s and try again.` });
      } else if (isNoRoute) {
        // Try Raydium fallback
        try {
          const raydiumResult = await deps.tryRaydiumSwap(position, amountToSell);
          if (raydiumResult.success && raydiumResult.signature) {
            const closed = await deps.markPositionClosed(positionId, safeExitPrice, raydiumResult.signature);
            if (closed) toast({ title: '💰 Position Closed via Raydium', description: `${position.token_symbol} sold via Raydium` });
            await deps.fetchPositions(true);
            deps.refreshBalance();
            releaseSellLock(position.token_address);
            return;
          }
        } catch { /* fallthrough */ }
        setNoRoutePosition(position);
        setShowNoRouteModal(true);
      } else if (isAlreadySold) {
        showForceCloseToast("Token Not Found", "This position may have been sold externally.");
      } else {
        toast({ title: "Error closing position", description: errorMessage, variant: "destructive" });
      }
      releaseSellLock(position.token_address);
    } catch (err) {
      releaseSellLock(position.token_address);
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("NO_ROUTE") || message.toLowerCase().includes("no route")) {
        setNoRoutePosition(position);
        setShowNoRouteModal(true);
      } else {
        toast({ title: "Error closing position", description: message, variant: "destructive" });
      }
    }
  }, [deps, toast]);

  const handleNoRouteMove = useCallback(async () => {
    if (!noRoutePosition) return;
    const success = await deps.moveToWaitingForLiquidity(noRoutePosition.id);
    if (!success) {
      toast({ title: 'Failed to move position', description: 'Could not update position status.', variant: 'destructive' });
    }
    await Promise.all([deps.fetchPositions(true), deps.fetchWaitingPositions()]);
    setShowNoRouteModal(false);
    setNoRoutePosition(null);
  }, [noRoutePosition, deps, toast]);

  return {
    exitPreviewPosition,
    showExitPreview,
    setShowExitPreview,
    noRoutePosition,
    showNoRouteModal,
    setShowNoRouteModal,
    setNoRoutePosition,
    handleOpenExitPreview,
    handleConfirmExitFromModal,
    handleNoRouteMove,
  };
}
