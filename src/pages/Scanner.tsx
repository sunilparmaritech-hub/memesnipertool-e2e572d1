import React, { forwardRef, useState, useEffect, useCallback, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/layout/AppLayout";
import LiquidityBotPanel from "@/components/trading/LiquidityBotPanel";
import SniperDecisionPanel from "@/components/trading/SniperDecisionPanel";
import { TradeSignalPanel } from "@/components/trading/TradeSignalPanel";
import LiquidityMonitor from "@/components/scanner/LiquidityMonitor";
import PerformancePanel from "@/components/scanner/PerformancePanel";
import ValidationSummaryPanel from "@/components/scanner/ValidationSummaryPanel";

import BotActivityLog, { addBotLog, clearBotLogs } from "@/components/scanner/BotActivityLog";
import RecoveryControls from "@/components/scanner/RecoveryControls";
import ApiHealthWidget from "@/components/scanner/ApiHealthWidget";
import PaidApiAlert from "@/components/scanner/PaidApiAlert";
import BotPreflightCheck from "@/components/scanner/BotPreflightCheck";
import ExitPreviewModal from "@/components/scanner/ExitPreviewModal";
import NoRouteExitModal from "@/components/scanner/NoRouteExitModal";
import StatsCard from "@/components/StatsCard";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useTokenScanner } from "@/hooks/useTokenScanner";
import { useSniperSettings } from "@/hooks/useSniperSettings";
import { useAutoSniper, TokenData } from "@/hooks/useAutoSniper";
import { useAutoExit } from "@/hooks/useAutoExit";
import { useDemoAutoExit } from "@/hooks/useDemoAutoExit";
import { useLiquidityRetryWorker } from "@/hooks/useLiquidityRetryWorker";
import { useWalletTokens } from "@/hooks/useWalletTokens";
import { useWallet } from "@/hooks/useWallet";
import { useAuth } from "@/contexts/AuthContext";
import { useWalletModal } from "@/hooks/useWalletModal";
import { useTradeExecution, SOL_MINT, type TradeParams, type PriorityLevel } from "@/hooks/useTradeExecution";
import { useTradingEngine } from "@/hooks/useTradingEngine";
import { usePositions } from "@/hooks/usePositions";
import { useToast } from "@/hooks/use-toast";
import { useNotifications } from "@/hooks/useNotifications";
import { useAppMode } from "@/contexts/AppModeContext";
import { useDemoPortfolio } from "@/contexts/DemoPortfolioContext";
import { useBotContext } from "@/contexts/BotContext";
import { useDisplayUnit } from "@/contexts/DisplayUnitContext";
import { useTokenStateManager } from "@/hooks/useTokenStateManager";
import { useTokenHolders, type TokenHolderData } from "@/hooks/useTokenHolders";
import { reconcilePositionsWithPools } from "@/lib/positionMetadataReconciler";
import { fetchDexScreenerTokenMetadata } from "@/lib/dexscreener";
import { isPlaceholderText } from "@/lib/formatters";
import { acquireSellLock, releaseSellLock, isSellLocked } from "@/lib/sellLock";
import { Wallet, TrendingUp, Zap, Activity, AlertTriangle, X, FlaskConical, Coins, RotateCcw, DollarSign } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ToastAction } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { useCredits } from "@/hooks/useCredits";
import { NoCreditOverlay } from "@/components/credits/NoCreditOverlay";
import { useScannerStore } from "@/stores/scannerStore";

const Scanner = forwardRef<HTMLDivElement, object>(function Scanner(_props, ref) {
  const { tokens, loading, scanTokens, errors, apiErrors, isDemo, cleanup, lastScanStats } = useTokenScanner();
  const { settings, saving, saveSettings, updateField } = useSniperSettings();
  const { hasCredits } = useCredits();
  const { evaluateTokens, result: sniperResult, loading: sniperLoading } = useAutoSniper();
  const { startAutoExitMonitor, stopAutoExitMonitor, isMonitoring } = useAutoExit();
  const {
    waitingPositions,
    checking: checkingLiquidity,
    fetchWaitingPositions,
    runRetryCheck: runLiquidityRetryCheck,
    moveToWaitingForLiquidity,
    moveBackToOpen,
    checkAndExecutePosition: tryExecuteWaitingPosition,
    startRetryWorker: startLiquidityRetryWorker,
    stopRetryWorker: stopLiquidityRetryWorker,
    isRunning: isLiquidityRetryRunning,
  } = useLiquidityRetryWorker();
  const { tokens: walletTokens, loading: loadingWalletTokens, refetch: refetchWalletTokens } = useWalletTokens({ minValueUsd: 0.01 });
  const { executeTrade, sellPosition } = useTradeExecution();
  const { snipeToken, exitPosition, status: engineStatus, isExecuting: engineExecuting } = useTradingEngine();
  const { wallet, connectPhantom, disconnect, signAndSendTransaction, refreshBalance } = useWallet();
  const { isAdmin } = useAuth();
  const { openModal: openWalletModal } = useWalletModal();
  
  // Token holders hook for on-chain holder data
  const { 
    holders: tokenHolders, 
    fetchHolders: fetchTokenHolders, 
    loading: loadingHolders 
  } = useTokenHolders({ walletAddress: wallet.address ?? undefined });
  const { openPositions: realOpenPositions, allActivePositions: realAllActivePositions, closedPositions: realClosedPositions, fetchPositions, closePosition: markPositionClosed } = usePositions();
  const { toast } = useToast();
  const { addNotification } = useNotifications();
  const { mode } = useAppMode();
  
  // Display unit context for consistent formatting
  const { formatDualValue, formatSolNativeValue, solPrice } = useDisplayUnit();
  
  // Demo portfolio context
  const {
    demoBalance,
    deductBalance,
    addBalance,
    addDemoPosition,
    updateDemoPosition,
    closeDemoPosition,
    openDemoPositions,
    closedDemoPositions,
    totalValue: demoTotalValue,
    totalPnL: demoTotalPnL,
    totalPnLPercent: demoTotalPnLPercent,
    resetDemoPortfolio,
    // Performance stats
    winRate: demoWinRate,
    avgPnL: demoAvgPnL,
    bestTrade: demoBestTrade,
    worstTrade: demoWorstTrade,
    totalTrades: demoTotalTrades,
    wins: demoWins,
    losses: demoLosses,
  } = useDemoPortfolio();
  
  // Demo auto-exit monitor
  const { startDemoMonitor, stopDemoMonitor } = useDemoAutoExit();

  // Bot context for persistent state across navigation
  const { 
    botState, 
    isRunning,
    startBot, 
    stopBot, 
    pauseBot, 
    resumeBot,
    toggleAutoEntry,
    toggleAutoExit,
    setScanSpeed: setBotScanSpeed,
    recordTrade,
  } = useBotContext();

  // PERSISTENT TOKEN STATE MANAGER - survives restarts, prevents duplicate trades
  const {
    initialized: tokenStatesInitialized,
    canTradeToken,
    filterTradeableTokens,
    registerTokensBatch,
    markTraded,
    markPending,
    markRejected,
    cleanupExpiredPending,
    clearRejectedTokens,
    getStateCounts,
  } = useTokenStateManager();

  // Local aliases from bot context for easier access
  const isBotActive = botState.isBotActive;
  const autoEntryEnabled = botState.autoEntryEnabled;
  const autoExitEnabled = botState.autoExitEnabled;
  const scanSpeed = botState.scanSpeed;
  const isPaused = botState.isPaused;
  
  const [showApiErrors, setShowApiErrors] = useState(true);
  
  // Confirmation dialogs
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showBotActivateConfirm, setShowBotActivateConfirm] = useState(false);
  const [showSwitchToLiveConfirm, setShowSwitchToLiveConfirm] = useState(false);
  const [showCleanupConfirm, setShowCleanupConfirm] = useState(false);
  const [cleaningUpPositions, setCleaningUpPositions] = useState(false);
  const [pendingBotAction, setPendingBotAction] = useState<boolean | null>(null);
  
  // Exit Preview Modal state
  const [exitPreviewPosition, setExitPreviewPosition] = useState<any | null>(null);
  const [showExitPreview, setShowExitPreview] = useState(false);
  
  // Sync Positions state
  const [syncingPositions, setSyncingPositions] = useState(false);
  
  // No Route Exit Modal state
  const [noRoutePosition, setNoRoutePosition] = useState<any | null>(null);
  const [showNoRouteModal, setShowNoRouteModal] = useState(false);
  
  // Pool scanning pause state (separate from bot pause)
  const [isPoolScanningPaused, setIsPoolScanningPaused] = useState(false);
  
  // Get setMode from AppModeContext
  const { setMode } = useAppMode();
  
  // Refs for tracking
  const lastSniperRunRef = useRef<number>(0);
  const processedTokensRef = useRef<Set<string>>(new Set());
  const liveTradeInFlightRef = useRef(false);
  
  // CRITICAL: Separate ref for tokens that have been TRADED (never cleared during bot session)
  // This prevents the same token from being bought multiple times
  const tradedTokensRef = useRef<Set<string>>(new Set());

  // Use demo or real positions based on mode
  // CRITICAL: Reconcile position metadata with pool data to ensure token names match
  const rawOpenPositions = isDemo ? openDemoPositions : realOpenPositions;
  const openPositions = useMemo(() => {
    // Convert tokens to pool data format for reconciliation
    const poolData = tokens.map(t => ({
      address: t.address,
      symbol: t.symbol,
      name: t.name,
    }));
    return reconcilePositionsWithPools(rawOpenPositions, poolData);
  }, [rawOpenPositions, tokens]);
  
  // All non-closed positions (open, pending, waiting_for_liquidity) for proper wallet token exclusion
  // In demo mode, all demo positions are "active" (no waiting_for_liquidity state)
  const rawAllActivePositions = isDemo ? openDemoPositions : realAllActivePositions;
  const allActivePositions = useMemo(() => {
    const poolData = tokens.map(t => ({
      address: t.address,
      symbol: t.symbol,
      name: t.name,
    }));
    return reconcilePositionsWithPools(rawAllActivePositions, poolData);
  }, [rawAllActivePositions, tokens]);
  
  const closedPositions = isDemo ? closedDemoPositions : realClosedPositions;

  // Fetch holder data for displayed tokens (hybrid approach - fast count + background position)
  const holderDataMap = useMemo(() => {
    const map = new Map<string, { holderCount: number; buyerPosition?: number }>();
    tokenHolders.forEach((data, address) => {
      map.set(address, {
        holderCount: data.holderCount,
        buyerPosition: data.buyerPosition,
      });
    });
    return map;
  }, [tokenHolders]);

  // Holder data is now fetched inline by token-scanner edge function
  // No separate background fetch needed

  const fallbackSolPrice = Number.isFinite(solPrice) && solPrice > 0 ? solPrice : 150;

  const decimalToBaseUnits = useCallback((amountDecimal: number, mint: string) => {
    const decimals = mint === SOL_MINT ? 9 : 6;
    const fixed = Math.max(0, amountDecimal).toFixed(decimals);
    const [whole, frac = ""] = fixed.split(".");
    return BigInt(`${whole}${frac}`).toString();
  }, []);

  // Raydium swap fallback for when Jupiter has no route
  const tryRaydiumSwap = useCallback(async (
    position: { token_address: string; token_symbol?: string | null },
    tokenAmount: number
  ): Promise<{ success: boolean; signature?: string; error?: string }> => {
    if (!wallet.address) {
      return { success: false, error: 'Wallet not connected' };
    }

    const SOL_OUTPUT = 'So11111111111111111111111111111111111111112';
    const RAYDIUM_QUOTE_API = 'https://transaction-v1.raydium.io/compute/swap-base-in';
    const RAYDIUM_SWAP_API = 'https://transaction-v1.raydium.io/transaction/swap-base-in';

    try {
      // Get token decimals
      let decimals = 6;
      try {
        const { data: meta } = await supabase.functions.invoke('token-metadata', {
          body: { mint: position.token_address, owner: wallet.address },
        });
        if (meta?.decimals) decimals = meta.decimals;
      } catch {
        // Use default
      }

      const amountInBaseUnits = Math.floor(tokenAmount * Math.pow(10, decimals)).toString();

      // Get Raydium quote
      const quoteParams = new URLSearchParams({
        inputMint: position.token_address,
        outputMint: SOL_OUTPUT,
        amount: amountInBaseUnits,
        slippageBps: '1500', // 15% slippage
        txVersion: 'V0',
      });

      const quoteRes = await fetch(`${RAYDIUM_QUOTE_API}?${quoteParams}`, {
        signal: AbortSignal.timeout(10000),
      });

      if (!quoteRes.ok) {
        return { success: false, error: 'Raydium quote failed' };
      }

      const quoteData = await quoteRes.json();
      if (!quoteData.success) {
        return { success: false, error: quoteData.msg || 'No Raydium route' };
      }

      // Derive the user's Associated Token Account (ATA) for the input token
      // Raydium requires inputAccount when swapping non-SOL tokens
      const { PublicKey: PK } = await import('@solana/web3.js');
      const TOKEN_PROGRAM_ID = new PK('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
      const ASSOCIATED_TOKEN_PROGRAM_ID = new PK('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');
      const [inputAccount] = PK.findProgramAddressSync(
        [new PK(wallet.address).toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), new PK(position.token_address).toBuffer()],
        ASSOCIATED_TOKEN_PROGRAM_ID
      );

      // Build swap transaction
      const swapRes = await fetch(RAYDIUM_SWAP_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          swapResponse: quoteData,
          wallet: wallet.address,
          txVersion: 'V0',
          wrapSol: false,
          unwrapSol: true,
          inputAccount: inputAccount.toBase58(),
          computeUnitPriceMicroLamports: '500000',
        }),
      });

      if (!swapRes.ok) {
        return { success: false, error: 'Failed to build Raydium swap' };
      }

      const swapData = await swapRes.json();
      if (!swapData.success || !swapData.data?.transaction) {
        return { success: false, error: swapData.msg || 'Raydium swap build failed' };
      }

      // Decode and sign
      const txBytes = Uint8Array.from(atob(swapData.data.transaction), c => c.charCodeAt(0));
      const { VersionedTransaction } = await import('@solana/web3.js');
      const transaction = VersionedTransaction.deserialize(txBytes);

      const result = await signAndSendTransaction(transaction);
      return result.success 
        ? { success: true, signature: result.signature }
        : { success: false, error: result.error };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Raydium swap failed' };
    }
  }, [wallet.address, signAndSendTransaction]);

  // Handler to open the exit preview modal instead of exiting directly
  const handleOpenExitPreview = useCallback((positionId: string, currentPrice: number) => {
    if (isDemo) {
      closeDemoPosition(positionId, currentPrice, "manual");
      const position = openDemoPositions.find((p) => p.id === positionId);
      if (position) {
        const pnlValueUsd = (currentPrice - position.entry_price) * position.amount;
        addBalance((settings?.trade_amount || 0) + (pnlValueUsd / fallbackSolPrice));
        toast({
          title: "Position Closed",
          description: `${position.token_symbol} manually closed`,
        });
      }
      return;
    }

    // Find the position first - don't check wallet here, check in modal confirm
    const position = realOpenPositions.find((p) => p.id === positionId);
    if (!position) {
      toast({
        title: "Position not found",
        description: "This position is no longer active. Refreshing…",
      });
      fetchPositions(true);
      return;
    }

    // Open the exit preview modal (wallet check happens on confirm)
    setExitPreviewPosition({
      ...position,
      current_price: currentPrice,
    });
    setShowExitPreview(true);
  }, [
    isDemo,
    closeDemoPosition,
    openDemoPositions,
    addBalance,
    settings?.trade_amount,
    toast,
    realOpenPositions,
    fetchPositions,
    fallbackSolPrice,
  ]);

  // Actual exit execution - called from modal
  const handleConfirmExitFromModal = useCallback(async (positionId: string, amountToSell: number, currentPrice: number) => {
    // Check wallet connection before proceeding with the actual sale
    if (!wallet.isConnected || wallet.network !== "solana" || !wallet.address) {
      toast({
        title: "Wallet Required",
        description: "Connect a Solana wallet to confirm the sale.",
        variant: "destructive",
      });
      openWalletModal();
      return;
    }
    
    const position = realOpenPositions.find((p) => p.id === positionId);
    if (!position) return;

    // CRITICAL: Check if this token is already being sold
    if (isSellLocked(position.token_address)) {
      toast({
        title: 'Sell Already In Progress',
        description: `${position.token_symbol} is already being sold by another process. Please wait.`,
        variant: 'destructive',
      });
      return;
    }

    // Acquire sell lock to prevent duplicate transactions
    if (!acquireSellLock(position.token_address, 'manual_sell')) {
      toast({
        title: 'Sell Already In Progress',
        description: `${position.token_symbol} is already being sold. Please wait.`,
        variant: 'destructive',
      });
      return;
    }

    const safeExitPrice = Number.isFinite(currentPrice) && currentPrice > 0
      ? currentPrice
      : (position.current_price ?? position.entry_price);

    // Use the on-chain balance passed from the modal
    const tokenAmountToSell = amountToSell;

    // Use 3-stage engine for Jupiter exit (better routing)
    addBotLog({
      level: 'info',
      category: 'trade',
      message: 'Exiting position via Jupiter',
      tokenSymbol: position.token_symbol,
      tokenAddress: position.token_address,
      details: `Selling ${tokenAmountToSell.toFixed(6)} tokens`,
    });

    const showForceCloseToast = (title: string, description: string) => {
      toast({
        title,
        description,
        duration: 15000,
        variant: "destructive",
        action: (
          <ToastAction
            altText="Force close"
            onClick={async () => {
              const closed = await markPositionClosed(positionId, safeExitPrice);
              if (closed) {
                toast({
                  title: "Position Marked Closed",
                  description: `${position.token_symbol} removed from active positions`,
                });
                await fetchPositions(true);
              } else {
                toast({
                  title: "Force Close Failed",
                  description: "Couldn't update the position status. Please try again.",
                  variant: "destructive",
                });
              }
            }}
          >
            Force Close
          </ToastAction>
        ),
      });
    };

    try {
      const result = await exitPosition(
        position.token_address,
        tokenAmountToSell,
        wallet.address,
        (tx) => signAndSendTransaction(tx),
        { slippage: 0.15 } // 15% slippage for exits
      );

      if (result.success) {
        // Confirm, then verify remaining balance before closing.
        // Prevents closing DB position if only a partial sell happened.
        let confirmed = true;
        try {
          // Fetch original BUY transaction metadata for this position
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
              signature: result.txHash, 
              walletAddress: wallet.address,
              action: 'sell',
              positionId: position.id,
              tokenAddress: position.token_address,
              tokenSymbol: position.token_symbol,
              tokenName: position.token_name,
              // SEMANTIC SOL VALUES (source of truth for P&L)
              solSpent: 0, // SELL never spends SOL
              solReceived: result.solReceived || position.current_value || 0,
              // Extended metadata - inherited from BUY trade
              buyerPosition: buyerPosition,
              liquidity: liquidity,
              riskScore: riskScore,
              entryPrice: position.entry_price_usd,
              exitPrice: position.current_price,
              priceSol: result.solReceived,
              slippage: settings?.slippage_tolerance ?? 15,
              // For FIFO matching
              matchedBuySolSpent: entryPriceSol,
            },
          });
          confirmed = Boolean((confirmData as any)?.confirmed ?? true);
        } catch {
          // ignore
        }

        if (!confirmed) {
          toast({
            title: 'Exit Pending Confirmation',
            description: 'Transaction was submitted but not confirmed yet. Try again in a few seconds.',
            variant: 'destructive',
          });
          await fetchPositions(true);
          releaseSellLock(position.token_address);
          return;
        }

        let remainingBalance: number | null = null;
        try {
          const { data: meta2 } = await supabase.functions.invoke('token-metadata', {
            body: { mint: position.token_address, owner: wallet.address },
          });
          const bal = Number((meta2 as any)?.balanceUi);
          if (Number.isFinite(bal)) remainingBalance = bal;
        } catch {
          // ignore
        }

        // FIXED: Much tighter threshold - only consider partial if remaining balance is significant
        // Use a tiny dust threshold (0.0001% of original) to account for rounding
        // Most "partial exits" are just rounding dust from swaps - treat as full exit
        const DUST_THRESHOLD = 1e-6;
        const DUST_PERCENT_THRESHOLD = 0.01; // 0.01% = practically dust
        
        const remainingPercent = tokenAmountToSell > 0 && remainingBalance !== null 
          ? (remainingBalance / tokenAmountToSell) * 100 
          : 0;
        
        // Only treat as partial if:
        // 1. Remaining balance is above absolute dust AND
        // 2. Remaining is more than 0.01% of original (meaningful amount)
        const isSignificantRemaining = remainingBalance !== null && 
          remainingBalance > DUST_THRESHOLD && 
          remainingPercent > DUST_PERCENT_THRESHOLD;
        
        if (isSignificantRemaining && remainingPercent < 99) {
          // Significant remaining balance - try to sell remaining automatically
          addBotLog({
            level: 'info',
            category: 'trade',
            message: `Remaining balance detected, auto-selling remaining ${remainingBalance.toFixed(6)} tokens...`,
            tokenSymbol: position.token_symbol,
          });

          // Attempt to sell remaining balance automatically (like bot does)
          try {
            const retryResult = await exitPosition(
              position.token_address,
              remainingBalance,
              wallet.address!,
              (tx) => signAndSendTransaction(tx),
              { slippage: 0.20 } // Higher slippage for cleanup
            );

            if (retryResult.success) {
              addBotLog({
                level: 'success',
                category: 'trade',
                message: `✅ Sold remaining ${position.token_symbol} tokens`,
                tokenSymbol: position.token_symbol,
                details: `TX: ${retryResult.txHash?.slice(0, 12)}...`,
              });
              // Continue to mark as closed below
            } else {
              // Couldn't sell remaining - update position with remaining balance
              await supabase
                .from('positions')
                .update({ amount: remainingBalance, updated_at: new Date().toISOString() })
                .eq('id', positionId)
                .eq('user_id', (await supabase.auth.getUser()).data.user?.id);

              const soldAmount = tokenAmountToSell - remainingBalance;
              const soldPercent = tokenAmountToSell > 0 ? ((soldAmount / tokenAmountToSell) * 100).toFixed(1) : '0';

              toast({
                title: 'Partial Exit - Retry Failed',
                description: `Sold ${soldPercent}%. ${remainingBalance.toFixed(6)} ${position.token_symbol} still in wallet. Try again manually.`,
              });

              await fetchPositions(true);
              refreshBalance();
              releaseSellLock(position.token_address);
              return;
            }
          } catch (retryErr) {
            // Retry failed - update position with remaining
            await supabase
              .from('positions')
              .update({ amount: remainingBalance, updated_at: new Date().toISOString() })
              .eq('id', positionId)
              .eq('user_id', (await supabase.auth.getUser()).data.user?.id);

            const soldAmount = tokenAmountToSell - remainingBalance;
            toast({
              title: 'Partial Exit Completed',
              description: `Sold ${soldAmount.toFixed(6)} tokens. ${remainingBalance.toFixed(6)} remaining.`,
            });

            await fetchPositions(true);
            refreshBalance();
            releaseSellLock(position.token_address);
            return;
          }
        }

        // IMPORTANT: A successful on-chain sell does NOT automatically update our positions table.
        // Mark the position closed so it is removed from Active Trades immediately.
        // CRITICAL FIX: Pass the transaction hash so it's recorded in the database
        const closed = await markPositionClosed(positionId, safeExitPrice, result.txHash);

        if (closed) {
          addBotLog({
            level: 'success',
            category: 'trade',
            message: 'Position closed successfully',
            tokenSymbol: position.token_symbol,
            details: `Received ${result.solReceived?.toFixed(4)} SOL | TX: ${result.txHash?.slice(0, 12)}...`,
          });
          
          // Log to trade_history for Transaction History display
          // NOTE: Trade history is now logged centrally in confirm-transaction edge function
          // This prevents duplicate entries and ensures only confirmed on-chain transactions are recorded
        } else {
          addBotLog({
            level: 'warning',
            category: 'trade',
            message: 'Swap succeeded but failed to update position',
            tokenSymbol: position.token_symbol,
            details: 'Use Force Close to remove it from Active Trades',
          });

          showForceCloseToast(
            "Exit completed, but position is still open",
            "The swap went through, but the app couldn't mark it closed. Force close it?"
          );
        }

        await fetchPositions(true);
        refreshBalance();
        setTimeout(() => refreshBalance(), 8000);
        releaseSellLock(position.token_address);
        return;
      }

      const errorMessage = result.error || "Exit failed";
      
      // Check if this is a rate limit error
      const isRateLimitError =
        errorMessage.includes("RATE_LIMITED") ||
        errorMessage.toLowerCase().includes("rate limit") ||
        errorMessage.includes("429");

      // Check if this is a "no route" error - indicates liquidity issue
      const isNoRouteError =
        errorMessage.includes("NO_ROUTE") ||
        errorMessage.toLowerCase().includes("no route") ||
        errorMessage.toLowerCase().includes("no liquidity") ||
        errorMessage.toLowerCase().includes("route not found");
      
      // Check if token was already sold externally
      const isAlreadySoldError =
        errorMessage.includes("don't have this token") ||
        errorMessage.includes("already been sold") ||
        errorMessage.includes("REQ_INPUT");

      if (isRateLimitError) {
        // Rate limited - show friendly message and suggest retry
        addBotLog({
          level: 'warning',
          category: 'exit',
          message: `⏳ API temporarily busy, retrying ${position.token_symbol} exit...`,
          tokenSymbol: position.token_symbol,
        });
        toast({
          title: "⏳ Sell temporarily delayed",
          description: `The trading API is busy right now. Please wait 15-30 seconds and try again. Your ${position.token_symbol} position is safe.`,
        });
        releaseSellLock(position.token_address);
      } else if (isNoRouteError) {
        // Jupiter failed with NO_ROUTE - try Raydium as fallback
        addBotLog({
          level: 'warning',
          category: 'exit',
          message: `Jupiter has no route for ${position.token_symbol}, trying Raydium...`,
          tokenSymbol: position.token_symbol,
        });

        try {
          // Try Raydium swap directly
          const raydiumResult = await tryRaydiumSwap(position, tokenAmountToSell);
          
          if (raydiumResult.success && raydiumResult.signature) {
            // Raydium swap succeeded!
            addBotLog({
              level: 'success',
              category: 'exit',
              message: `✅ Sold ${position.token_symbol} via Raydium fallback`,
              tokenSymbol: position.token_symbol,
              details: `TX: ${raydiumResult.signature}`,
            });

            const closed = await markPositionClosed(positionId, safeExitPrice, raydiumResult.signature);
            if (closed) {
              toast({
                title: '💰 Position Closed via Raydium',
                description: `${position.token_symbol} sold successfully using Raydium fallback`,
              });

              // Log to trade_history
              // NOTE: Trade history is now logged centrally in confirm-transaction edge function
              // This prevents duplicate entries and ensures only confirmed on-chain transactions are recorded
            }
            
            await fetchPositions(true);
            refreshBalance();
            releaseSellLock(position.token_address);
            return;
          }
        } catch (raydiumErr) {
          console.log('[Exit] Raydium fallback also failed:', raydiumErr);
        }

        // Both Jupiter and Raydium failed - show the WAITING_FOR_LIQUIDITY modal
        addBotLog({
          level: 'warning',
          category: 'exit',
          message: `❌ No swap route available for ${position.token_symbol}`,
          tokenSymbol: position.token_symbol,
          details: 'Neither Jupiter nor Raydium can trade this token. Offering to move to Waiting Pool.',
        });

        setNoRoutePosition(position);
        setShowNoRouteModal(true);
        releaseSellLock(position.token_address);
      } else if (isAlreadySoldError) {
        showForceCloseToast(
          "Token Not Found",
          "This position may have been sold externally. Mark it as closed?"
        );
        releaseSellLock(position.token_address);
      } else {
        toast({
          title: "Error closing position",
          description: errorMessage,
          variant: "destructive",
        });
        releaseSellLock(position.token_address);
      }
    } catch (err) {
      releaseSellLock(position.token_address);
      const message = err instanceof Error ? err.message : String(err);
      
      const isRateLimitError2 =
        message.includes("RATE_LIMITED") ||
        message.toLowerCase().includes("rate limit") ||
        message.includes("429");

      const isNoRouteError =
        message.includes("NO_ROUTE") ||
        message.toLowerCase().includes("no route") ||
        message.toLowerCase().includes("no liquidity");
      
      const isAlreadySoldError =
        message.includes("don't have this token") ||
        message.includes("already been sold") ||
        message.includes("REQ_INPUT");

      if (isRateLimitError2) {
        toast({
          title: "⏳ Sell temporarily delayed",
          description: `The trading API is busy. Please wait 15-30 seconds and try again. Your position is safe.`,
        });
      } else if (isNoRouteError) {
        // Show the waiting for liquidity modal
        setNoRoutePosition(position);
        setShowNoRouteModal(true);
      } else if (isAlreadySoldError) {
        showForceCloseToast(
          "Token Not Found",
          "This position may have been sold externally. Mark it as closed?"
        );
      } else {
        toast({
          title: "Error closing position",
          description: message,
          variant: "destructive",
        });
      }
      
      // Always release lock on error paths
      releaseSellLock(position.token_address);
    }
  }, [
    realOpenPositions,
    wallet.address,
    exitPosition,
    signAndSendTransaction,
    fetchPositions,
    refreshBalance,
    markPositionClosed,
    toast,
    tryRaydiumSwap,
  ]);

  // Calculate stats based on mode
  // All values are in SOL (entry_value is SOL spent per trade)
  
  // Total SOL invested (what the user actually spent)
  const totalInvestedSol = useMemo(() => {
    if (isDemo) {
      return openDemoPositions.length * (settings?.trade_amount || 0.1);
    }
    return realOpenPositions.reduce((sum, p) => {
      return sum + (p.entry_value ?? (settings?.trade_amount || 0.04));
    }, 0);
  }, [isDemo, openDemoPositions.length, realOpenPositions, settings?.trade_amount]);
  
  // Open Value in SOL = sum of entry_value × (current_price / entry_price) for each position
  // This is the same formula used in the Active tab's TradeRow
  const totalValueSol = useMemo(() => {
    if (isDemo) {
      return demoTotalValue;
    }
    return realOpenPositions.reduce((sum, p) => {
      const entryVal = p.entry_value ?? 0;
      const entryPriceUsd = p.entry_price_usd ?? p.entry_price ?? 0;
      const currentPrice = p.current_price ?? entryPriceUsd;
      if (entryVal <= 0 || entryPriceUsd <= 0) return sum + entryVal;
      return sum + (entryVal * (currentPrice / entryPriceUsd));
    }, 0);
  }, [isDemo, demoTotalValue, realOpenPositions]);
  
  // Open P&L in SOL (unrealized)
  const openPnLSol = useMemo(() => totalValueSol - totalInvestedSol, [totalValueSol, totalInvestedSol]);
  
  // Closed P&L in SOL (realized) - use entry_value-based calculation for consistency
  const closedPnLSol = useMemo(() => {
    if (isDemo) {
      return closedDemoPositions.reduce((sum, p) => {
        const exitPrice = p.exit_price ?? p.current_price ?? p.entry_price ?? 0;
        const entryPrice = p.entry_price ?? 0;
        const entryVal = p.entry_value || 0;
        if (entryPrice <= 0 || entryVal <= 0) return sum;
        const exitVal = entryVal * (exitPrice / entryPrice);
        return sum + (exitVal - entryVal);
      }, 0);
    }
    return realClosedPositions.reduce((sum, p) => {
      const exitPrice = p.exit_price ?? p.current_price ?? p.entry_price ?? 0;
      const entryPriceUsd = p.entry_price_usd ?? p.entry_price ?? 0;
      const entryVal = p.entry_value ?? 0;
      if (entryPriceUsd <= 0 || entryVal <= 0) return sum;
      const exitVal = entryVal * (exitPrice / entryPriceUsd);
      return sum + (exitVal - entryVal);
    }, 0);
  }, [isDemo, closedDemoPositions, realClosedPositions]);
  
  // TOTAL P&L in SOL = Open P&L + Closed P&L
  const totalPnLSol = useMemo(() => {
    if (isDemo) {
      return demoTotalPnL;
    }
    return openPnLSol + closedPnLSol;
  }, [isDemo, demoTotalPnL, openPnLSol, closedPnLSol]);
  
  // Total invested across ALL positions for percentage
  const closedInvestedSol = useMemo(() => {
    if (isDemo) {
      return closedDemoPositions.length * (settings?.trade_amount || 0.1);
    }
    return realClosedPositions.reduce((sum, p) => {
      return sum + (p.entry_value ?? (settings?.trade_amount || 0.04));
    }, 0);
  }, [isDemo, closedDemoPositions.length, realClosedPositions, settings?.trade_amount]);
  
  const allInvestedSol = useMemo(() => {
    return totalInvestedSol + closedInvestedSol;
  }, [totalInvestedSol, closedInvestedSol]);
  
  const totalPnLPercent = useMemo(() => {
    if (isDemo) {
      return demoTotalPnLPercent;
    }
    return allInvestedSol > 0 ? (totalPnLSol / allInvestedSol) * 100 : 0;
  }, [isDemo, demoTotalPnLPercent, allInvestedSol, totalPnLSol]);

  // Resume monitors when navigating back to Scanner with bot still active
  // CRITICAL: Also start auto-exit when there are open positions in live mode
  useEffect(() => {
    if (isDemo) {
      // Demo mode: only run demo monitor when bot is active
      if (isBotActive && !isPaused) {
        startDemoMonitor(5000);
      }
    } else {
      // Live mode: ALWAYS run auto-exit monitor when there are open positions OR bot is active with autoExit
      const hasOpenLivePositions = realOpenPositions.length > 0;
      const hasWaitingPositions = waitingPositions.length > 0;
      const shouldRunAutoExit = hasOpenLivePositions || (isBotActive && !isPaused && autoExitEnabled);
      
      if (shouldRunAutoExit && wallet.isConnected) {
        console.log(`[Scanner] Starting auto-exit monitor: ${realOpenPositions.length} open positions, bot=${isBotActive}, autoExit=${autoExitEnabled}`);
        startAutoExitMonitor(15000); // Check every 15 seconds for faster response
      }
      
      // NOTE: Liquidity retry worker is NOT auto-started
      // Users must manually click "Check" button in Waiting tab to check routes
    }
    
    return () => {
      // Don't stop bot on unmount - just stop monitors (bot state persists)
      stopDemoMonitor();
      stopAutoExitMonitor();
    };
  }, [isBotActive, isPaused, isDemo, autoExitEnabled, startDemoMonitor, stopDemoMonitor, startAutoExitMonitor, stopAutoExitMonitor, realOpenPositions.length, wallet.isConnected]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  // Auto-scan on mount (only if not paused)
  useEffect(() => {
    if (settings?.min_liquidity && !isPaused && !isPoolScanningPaused) {
      scanTokens(settings.min_liquidity);
    }
  }, [settings?.min_liquidity]);

  // Periodic scanning based on speed - optimized intervals
  // Respects both bot pause (isPaused) and pool scanning pause (isPoolScanningPaused)
  useEffect(() => {
    if (isPaused || isPoolScanningPaused) return;
    
    // Demo mode uses faster intervals since no real API calls
    const intervals = isDemo 
      ? { slow: 20000, normal: 10000, fast: 5000 }
      : { slow: 60000, normal: 30000, fast: 15000 };
    
    const interval = setInterval(() => {
      if (settings?.min_liquidity) {
        scanTokens(settings.min_liquidity);
      }
    }, intervals[scanSpeed]);
    
    return () => clearInterval(interval);
  }, [scanSpeed, isPaused, isPoolScanningPaused, settings?.min_liquidity, scanTokens, isDemo]);

  // Log scan stats to bot activity when they update
  useEffect(() => {
    if (!lastScanStats || !isBotActive) return;
    
    const { total, tradeable, stages } = lastScanStats;
    
    // Build stage summary (Raydium-only pipeline - no bonding stage)
    const stageParts: string[] = [];
    if (stages.lpLive > 0) stageParts.push(`🏊 ${stages.lpLive} LP Live`);
    if (stages.indexing > 0) stageParts.push(`⏳ ${stages.indexing} Indexing`);
    if (stages.listed > 0) stageParts.push(`✅ ${stages.listed} Listed`);
    
    addBotLog({
      level: tradeable > 0 ? 'success' : 'info',
      category: 'scan',
      message: `🔍 Pool Discovery: ${tradeable}/${total} tradeable`,
      details: stageParts.length > 0 
        ? `Pool Status: ${stageParts.join(' | ')}\nSources: GeckoTerminal, DexScreener, CoinGecko` 
        : 'Sources: GeckoTerminal, DexScreener, CoinGecko',
    });
  }, [lastScanStats, isBotActive]);

  // Log API errors with specific context so BotActivityLog can show helpful messages
  useEffect(() => {
    if (apiErrors.length === 0 || !isBotActive) return;
    
    // Dedupe by API type to avoid log spam
    const loggedTypes = new Set<string>();
    
    apiErrors.forEach(error => {
      if (loggedTypes.has(error.apiType)) return;
      loggedTypes.add(error.apiType);
      
      // Create descriptive message that includes API name for pattern matching
      const apiName = error.apiName || error.apiType || 'Unknown API';
      const errorCode = error.errorMessage?.match(/\d{3}/)?.[0] || '';
      
      // Build message with API name for regex matching
      let message = `${apiName} ${errorCode}`.trim();
      if (error.errorMessage?.includes('fallback')) {
        message += ' using fallback';
      }
      
      addBotLog({
        level: 'warning',
        category: 'system',
        message,
        details: error.errorMessage,
      });
    });
  }, [apiErrors, isBotActive]);

  // ============================================
  // PRODUCTION-GRADE BOT EVALUATION LOOP
  // Runs continuously while bot is active
  // ============================================
  
  // Continuous evaluation interval ref
  const evaluationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  
  // Clear processed tokens periodically to allow re-evaluation of old tokens
  useEffect(() => {
    if (!isBotActive || isPaused) return;
    
    const cleanupInterval = setInterval(() => {
      const oldSize = processedTokensRef.current.size;
      if (oldSize > 100) {
        const tokensArray = Array.from(processedTokensRef.current);
        processedTokensRef.current = new Set(tokensArray.slice(-50));
        addBotLog({
          level: 'info',
          category: 'system',
          message: `Cleared ${oldSize - 50} old tokens from cache`,
        });
      }
    }, 120000);
    
    return () => clearInterval(cleanupInterval);
  }, [isBotActive, isPaused]);
  
  // Main evaluation function - extracted for reuse
  // Bot can run if active and not paused - autoEntryEnabled only controls NEW trade entries
  const runBotEvaluation = useCallback(async () => {
    // Bot must be active to run evaluations, but autoEntry only gates new trades
    if (!isBotActive || tokens.length === 0 || !settings) {
      return;
    }
    
    // CRITICAL: Wait for persistent token states to load before processing
    if (!isDemo && !tokenStatesInitialized) {
      console.log('[Scanner] Waiting for token states to initialize...');
      return;
    }
    
    // If autoEntry is disabled, skip new trade evaluations (but bot can still run for other features)
    if (!autoEntryEnabled) {
      return;
    }
    
    // Periodically clean up expired PENDING tokens (move to REJECTED)
    if (!isDemo) {
      cleanupExpiredPending();
    }
    
    // Build set of active position addresses for deduplication
    const activePositionAddresses = new Set(
      openPositions.map(p => p.token_address.toLowerCase())
    );
    
    // Filter for tokens we haven't processed yet AND haven't traded AND not in active positions
    // In LIVE mode, also check persistent database state via canTradeToken
    const unseenTokens = tokens.filter(t => {
      const addrLower = t.address.toLowerCase();
      
      // Skip if already processed this session (in-memory cache)
      if (processedTokensRef.current.has(t.address)) return false;
      
      // Skip if already traded this session (in-memory cache)
      if (tradedTokensRef.current.has(t.address)) return false;
      
      // CRITICAL: Skip if token already has an active position in database
      if (activePositionAddresses.has(addrLower)) {
        console.log(`[Scanner] Filtered out ${t.symbol} - already in active positions`);
        return false;
      }
      
      // CRITICAL (LIVE MODE): Check persistent database state - prevents duplicate trades across restarts
      if (!isDemo && !canTradeToken(t.address)) {
        console.log(`[Scanner] Filtered out ${t.symbol} - persistent state: TRADED or REJECTED`);
        return false;
      }
      
      return true;
    });

    if (unseenTokens.length === 0) {
      // No new tokens - this is normal, just wait for next scan
      return;
    }

    const blacklist = new Set(settings.token_blacklist || []);
    const sellRouteEnabled = settings.validation_rule_toggles?.EXECUTABLE_SELL !== false;
    const candidates = unseenTokens.filter((t) => {
      if (!t.address) return false;
      if (blacklist.has(t.address)) return false;
      if (t.symbol?.toUpperCase() === 'SOL' && t.address !== SOL_MINT) return false;
      // Only enforce canSell hard filter if the EXECUTABLE_SELL validation rule is enabled
      if (sellRouteEnabled && t.canSell === false) {
        // Mark non-sellable tokens as REJECTED in persistent state
        if (!isDemo) {
          markRejected(t.address, 'not_sellable');
        }
        return false;
      }
      // Double-check against traded tokens
      if (tradedTokensRef.current.has(t.address)) return false;
      // CRITICAL: Double-check against active positions
      if (activePositionAddresses.has(t.address.toLowerCase())) return false;
      return true;
    });

    if (candidates.length === 0) return;
    
    // Register new tokens in persistent state (LIVE mode only)
    if (!isDemo && candidates.length > 0) {
      await registerTokensBatch(candidates.map(t => ({
        address: t.address,
        symbol: t.symbol,
        name: t.name,
        source: t.source,
        liquidity: t.liquidity,
        riskScore: t.riskScore,
        buyerPosition: t.buyerPosition,
      })));
    }

    const batchSize = isDemo ? 10 : 20;
    const batch = candidates.slice(0, batchSize);

    // Holder data is now fetched inline by token-scanner edge function
    // No separate call needed - data comes with scanned tokens

    // Build token data with holder information from scanned tokens
    const tokenData: TokenData[] = batch.map(t => {
      // Holder data now comes directly from token scanner
      const buyerPos = t.buyerPosition;
      
      return {
        address: t.address,
        name: t.name,
        symbol: t.symbol,
        chain: t.chain,
        liquidity: t.liquidity,
        liquidityLocked: t.liquidityLocked,
        lockPercentage: t.lockPercentage,
        buyerPosition: buyerPos,
        riskScore: t.riskScore,
        categories: [],
        priceUsd: t.priceUsd,
        isPumpFun: t.isPumpFun,
        isTradeable: t.isTradeable,
        canBuy: t.canBuy,
        canSell: t.canSell,
        source: t.source,
        safetyReasons: t.safetyReasons,
        // Gate-critical fields - pass through from scanner
        poolCreatedAt: (t as any).poolCreatedAt || t.createdAt,
        freezeAuthority: t.freezeAuthority,
        mintAuthority: t.mintAuthority,
        holders: t.holders,
        holderCount: t.holders,
      };
    });

    // Removed generic "Evaluating X tokens" log - per-token validation logs are preferred

    // Demo mode execution
    if (isDemo) {
      batch.forEach(t => processedTokensRef.current.add(t.address));
      
      // Use more lenient matching for demo mode
      const targetPositions = settings.target_buyer_positions || [];
      const targetPositionsEnabled = targetPositions.length > 0;
      const minLiq = settings.min_liquidity || 5;
      const maxRisk = settings.max_risk_score || 70;
      
      const approvedToken = tokenData.find(t => 
        // Target Positions: when enabled, enforce match; when disabled (empty), allow any position
        (!targetPositionsEnabled || t.buyerPosition === null || (t.buyerPosition && targetPositions.includes(t.buyerPosition))) && 
        t.riskScore < maxRisk &&
        t.liquidity >= minLiq &&
        t.isTradeable !== false && // Must be tradeable
        t.canBuy !== false && // Must be buyable
        t.canSell !== false // CRITICAL: Must be sellable to avoid stuck positions
      );
      
      if (approvedToken && settings.trade_amount && demoBalance >= settings.trade_amount) {
        // CRITICAL: Mark token as traded BEFORE execution to prevent race conditions
        tradedTokensRef.current.add(approvedToken.address);
        
        deductBalance(settings.trade_amount);
        const tradeAmountInDollars = settings.trade_amount * solPrice;
        const entryPrice = approvedToken.priceUsd || 0.0001;
        const amount = tradeAmountInDollars / entryPrice;
        
        const newPosition = addDemoPosition({
          token_address: approvedToken.address,
          token_symbol: approvedToken.symbol,
          token_name: approvedToken.name,
          chain: approvedToken.chain,
          entry_price: entryPrice,
          current_price: entryPrice,
          amount,
          entry_value: tradeAmountInDollars,
          current_value: tradeAmountInDollars,
          profit_loss_percent: 0,
          profit_loss_value: 0,
          profit_take_percent: settings.profit_take_percentage,
          stop_loss_percent: settings.stop_loss_percentage,
          status: 'open',
          exit_reason: null,
          exit_price: null,
          exit_tx_id: null,
          closed_at: null,
        });
        
        addBotLog({
          level: 'success',
          category: 'trade',
          message: `Demo trade executed: ${approvedToken.symbol}`,
          tokenSymbol: approvedToken.symbol,
          details: `Entry: $${entryPrice.toFixed(6)} | Amount: ${settings.trade_amount} SOL`,
        });
        
        toast({
          title: '🎯 Demo Trade Executed!',
          description: `Bought ${approvedToken.symbol} at $${entryPrice.toFixed(6)}`,
        });
        
        // Simulate price movement
        setTimeout(() => {
          const priceChange = (Math.random() - 0.3) * 0.5;
          const newPrice = entryPrice * (1 + priceChange);
          const newValue = amount * newPrice;
          const pnlPercent = priceChange * 100;
          const pnlValue = newValue - tradeAmountInDollars;
          
          updateDemoPosition(newPosition.id, {
            current_price: newPrice,
            current_value: newValue,
            profit_loss_percent: pnlPercent,
            profit_loss_value: pnlValue,
          });
          
          if (pnlPercent >= settings.profit_take_percentage) {
            closeDemoPosition(newPosition.id, newPrice, 'take_profit');
            addBalance(settings.trade_amount + (pnlValue / solPrice));
            toast({ title: '💰 Take Profit Hit!', description: `Closed ${approvedToken.symbol} at +${pnlPercent.toFixed(1)}%` });
          } else if (pnlPercent <= -settings.stop_loss_percentage) {
            closeDemoPosition(newPosition.id, newPrice, 'stop_loss');
            addBalance(settings.trade_amount + (pnlValue / solPrice));
            toast({ title: '🛑 Stop Loss Hit', description: `Closed ${approvedToken.symbol} at ${pnlPercent.toFixed(1)}%`, variant: 'destructive' });
          }
        }, 5000 + Math.random() * 10000);
      } else if (approvedToken && demoBalance < (settings.trade_amount || 0)) {
        addBotLog({ level: 'warning', category: 'trade', message: 'Insufficient demo balance' });
      }
      return;
    }

    // Live mode execution
    if (!wallet.isConnected || wallet.network !== 'solana' || !wallet.address) {
      addBotLog({ level: 'warning', category: 'trade', message: 'Connect wallet to enable live trading' });
      // CRITICAL: Open wallet modal to prompt user connection
      openWalletModal();
      return;
    }

    const balanceSol = parseFloat(String(wallet.balance || '').replace(/[^\d.]/g, '')) || 0;
    const tradeAmountSol = settings.trade_amount || 0;
    const feeBufferSol = 0.01;

    if (tradeAmountSol <= 0 || balanceSol < tradeAmountSol + feeBufferSol) {
      if (balanceSol < tradeAmountSol + feeBufferSol) {
        addBotLog({ 
          level: 'warning', 
          category: 'trade', 
          message: 'Insufficient SOL balance',
          details: `Have: ${balanceSol.toFixed(4)} SOL | Need: ${(tradeAmountSol + feeBufferSol).toFixed(4)} SOL`,
        });
      }
      return;
    }

    if (liveTradeInFlightRef.current) {
      return; // Trade already in progress
    }

    // Evaluate tokens
    const evaluation = await evaluateTokens(tokenData, false, undefined, { suppressOpportunityToast: true });
    if (!evaluation) {
      return;
    }

    batch.forEach(t => processedTokensRef.current.add(t.address));
    const approved = evaluation.decisions?.filter((d) => d.approved) || [];
    
    // Log each token's validation result individually
    const allDecisions = evaluation.decisions || [];
    for (const decision of allDecisions) {
      const { token, approved: isApproved, reasons } = decision;
      const validationSteps = reasons.slice(0, 4).join(' | ');
      
      if (isApproved) {
        addBotLog({
          level: 'success',
          category: 'evaluate',
          message: `✅ ${token.symbol} passed validation`,
          tokenSymbol: token.symbol,
          tokenAddress: token.address,
          details: `${validationSteps}\n💧 Liq: $${token.liquidity?.toLocaleString() || 'N/A'} | 🛡️ Safety: ${100 - (token.riskScore || 0)}/100`,
        });
      } else {
        const failReason = reasons.find(r => r.startsWith('✗')) || reasons[0] || 'Did not meet criteria';
        addBotLog({
          level: 'skip',
          category: 'evaluate',
          message: `⏭️ ${token.symbol} skipped`,
          tokenSymbol: token.symbol,
          tokenAddress: token.address,
          details: failReason,
        });
      }
    }
    
    if (approved.length === 0) {
      return;
    }

    const availableSlots = Math.max(0, (settings.max_concurrent_trades || 0) - openPositions.length);
    if (availableSlots <= 0) {
      addBotLog({ level: 'skip', category: 'trade', message: 'Max positions reached' });
      return;
    }

    const maxAffordableTrades = Math.max(0, Math.floor((balanceSol - feeBufferSol) / tradeAmountSol));
    const tradesThisCycle = Math.min(availableSlots, maxAffordableTrades, 3, approved.length);

    if (tradesThisCycle <= 0) return;

    const toExecute = approved.slice(0, tradesThisCycle);
    
    addBotLog({
      level: 'info',
      category: 'trade',
      message: `🚀 Executing ${toExecute.length} live trade(s)`,
      details: `Tokens: ${toExecute.map(t => t.token.symbol).join(', ')}\n⚙️ Settings: ${tradeAmountSol} SOL | Slippage: ${settings.slippage_tolerance || 15}% | TP: ${settings.profit_take_percentage}% | SL: ${settings.stop_loss_percentage}% | Min Liq: ${settings.min_liquidity} SOL`,
    });

    liveTradeInFlightRef.current = true;
    try {
      for (const next of toExecute) {
        // Pre-validate token is sellable before executing buy (respects EXECUTABLE_SELL toggle)
        const sellCheckEnabled = settings.validation_rule_toggles?.EXECUTABLE_SELL !== false;
        if (sellCheckEnabled && next.token.canSell === false) {
          addBotLog({
            level: 'warning',
            category: 'trade',
            message: `⚠️ Skipped: ${next.token.symbol} (not sellable)`,
            tokenSymbol: next.token.symbol,
            tokenAddress: next.token.address,
            details: `Token rejected - cannot be sold after purchase\n💧 Liquidity: $${next.token.liquidity?.toLocaleString() || 'N/A'} | 🛡️ Safety: ${100 - (next.token.riskScore || 0)}/100`,
          });
          continue;
        }
        
        // CRITICAL: Mark token as traded BEFORE execution to prevent race conditions
        tradedTokensRef.current.add(next.token.address);
        
        const buyerPos = next.token.buyerPosition ? `#${next.token.buyerPosition}` : 'N/A';
        const safetyScore = next.token.riskScore != null ? `${100 - next.token.riskScore}/100` : 'N/A';
        const liqText = next.token.liquidity ? `$${next.token.liquidity.toLocaleString()}` : 'N/A';
        
        // Priority fee mapping - configurable based on user's priority setting
        const priorityFeeMap: Record<string, number> = {
          turbo: 500000,  // 0.0005 SOL
          fast: 200000,   // 0.0002 SOL
          normal: 100000, // 0.0001 SOL
        };
        const priorityFee = priorityFeeMap[settings.priority] || priorityFeeMap.normal;
        
        // Log detailed validation steps
        addBotLog({
          level: 'info',
          category: 'trade',
          message: `🔎 Validating: ${next.token.symbol}`,
          tokenSymbol: next.token.symbol,
          tokenAddress: next.token.address,
          details: `Step 1: ✅ Liquidity Check - ${liqText}\nStep 2: ✅ Safety Score - ${safetyScore}\nStep 3: ✅ Buyer Position - ${buyerPos}\nStep 4: 🔄 Preparing swap transaction...`,
        });
        
        addBotLog({
          level: 'info',
          category: 'trade',
          message: `📝 Executing BUY: ${next.token.symbol}`,
          tokenSymbol: next.token.symbol,
          tokenAddress: next.token.address,
          details: `💰 Amount: ${tradeAmountSol} SOL | Slippage: ${settings.slippage_tolerance || 15}%\n⚡ Priority: ${settings.priority} | Fee: ${priorityFee / 1e9} SOL`,
        });

        // Use user settings for slippage and priority, with sensible defaults
        const slippagePct = next.tradeParams?.slippage ?? settings.slippage_tolerance ?? 15;

        const result = await snipeToken(
          next.token.address,
          wallet.address,
          (tx) => signAndSendTransaction(tx),
          {
            buyAmount: tradeAmountSol,
            slippage: slippagePct / 100,
            priorityFee,
            minLiquidity: settings.min_liquidity,
            // Use user's max risk score from settings, default to 70
            maxRiskScore: settings.max_risk_score ?? 70,
            // Skip risk check for pre-verified tokens from scanner
            skipRiskCheck: true,
            // Pass user's TP/SL settings for position persistence
            profitTakePercent: settings.profit_take_percentage,
            stopLossPercent: settings.stop_loss_percentage,
          },
          // CRITICAL: Pass token metadata for pre-execution gate and history logging
          {
            symbol: next.token.symbol,
            name: next.token.name,
            liquidity: next.token.liquidity,
            priceUsd: next.token.priceUsd,
            buyerPosition: next.token.buyerPosition ?? undefined,
            riskScore: next.token.riskScore,
            isPumpFun: next.token.isPumpFun,
            source: next.token.source,
          }
        );

        if (result?.status === 'SUCCESS' && result.position) {
          // CRITICAL: Mark token as TRADED in persistent state (survives restarts)
          await markTraded(next.token.address, result.position.entryTxHash);
          
          const entryVal = (result.position.entryPrice || 0) * (result.position.tokenAmount || 0);
          addBotLog({ 
            level: 'success', 
            category: 'trade', 
            message: `✅ BUY FILLED: ${next.token.symbol}`,
            tokenSymbol: next.token.symbol,
            tokenAddress: next.token.address,
            details: `💧 Liquidity: ${liqText} | 👤 Buyer Pos: ${buyerPos} | 🛡️ Safety: ${safetyScore}\n📊 Entry: $${result.position.entryPrice?.toFixed(8)} | Tokens: ${result.position.tokenAmount?.toLocaleString(undefined, { maximumFractionDigits: 2 })} | Value: $${entryVal.toFixed(4)} | SOL: ${result.position.solSpent?.toFixed(4)}\n⚙️ TP: ${settings.profit_take_percentage}% | SL: ${settings.stop_loss_percentage}%\n🔗 TX: ${result.position.entryTxHash || 'N/A'}`,
          });
          recordTrade(true);
          await fetchPositions();
          refreshBalance();
          await new Promise(r => setTimeout(r, 500));
        } else {
          const failReason = result?.error || 'Trade failed - unknown error';
          
          // Check if failure is due to no liquidity/route - mark as PENDING for retry
          const isLiquidityIssue = failReason.toLowerCase().includes('no route') || 
            failReason.toLowerCase().includes('no liquidity') ||
            failReason.toLowerCase().includes('insufficient liquidity');
          
          if (isLiquidityIssue) {
            // Mark as PENDING - will retry within time window
            await markPending(next.token.address, 'no_route');
            addBotLog({ 
              level: 'warning', 
              category: 'trade', 
              message: `⏳ PENDING: ${next.token.symbol} (no route - will retry)`,
              tokenSymbol: next.token.symbol,
              tokenAddress: next.token.address,
              details: `💧 Liquidity: ${liqText} | 👤 Buyer Pos: ${buyerPos}\n❗ Reason: ${failReason}\n🔄 Will retry within 5 minutes`,
            });
          } else {
            // Mark as REJECTED for permanent failures
            await markRejected(next.token.address, failReason.slice(0, 100));
            addBotLog({ 
              level: 'error', 
              category: 'trade', 
              message: `❌ REJECTED: ${next.token.symbol}`,
              tokenSymbol: next.token.symbol,
              tokenAddress: next.token.address,
              details: `💧 Liquidity: ${liqText} | 👤 Buyer Pos: ${buyerPos} | 🛡️ Safety: ${safetyScore}\n❗ Reason: ${failReason}\n⚙️ Attempted: ${tradeAmountSol} SOL | Slippage: ${settings.slippage_tolerance || 15}%\n📍 Token: ${next.token.address}`,
            });
          }
          
          recordTrade(false);
          break; // Stop on first failure
        }
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      addBotLog({ level: 'error', category: 'trade', message: `Trade error: ${errorMsg}` });
      toast({ title: 'Trade Error', description: errorMsg, variant: 'destructive' });
    } finally {
      liveTradeInFlightRef.current = false;
    }
  }, [
    tokens, isBotActive, autoEntryEnabled, settings, isDemo, openPositions.length,
    wallet.isConnected, wallet.network, wallet.address, wallet.balance,
    demoBalance, solPrice, evaluateTokens, snipeToken, recordTrade,
    signAndSendTransaction, refreshBalance, fetchPositions, toast,
    deductBalance, addBalance, addDemoPosition, updateDemoPosition, closeDemoPosition,
    // Persistent token state manager functions
    tokenStatesInitialized, canTradeToken, cleanupExpiredPending, registerTokensBatch,
    markTraded, markPending, markRejected,
  ]);

  // Continuous evaluation loop - runs on interval
  useEffect(() => {
    if (!isBotActive || isPaused) {
      if (evaluationIntervalRef.current) {
        clearInterval(evaluationIntervalRef.current);
        evaluationIntervalRef.current = null;
      }
      return;
    }

    // Run immediately on activation
    runBotEvaluation();

    // Set up interval for continuous evaluation
    const intervalMs = isDemo ? 8000 : 10000; // 8s demo, 10s live
    evaluationIntervalRef.current = setInterval(() => {
      runBotEvaluation();
    }, intervalMs);

    // Bot activation is indicated by the status badge - no need to log it

    return () => {
      if (evaluationIntervalRef.current) {
        clearInterval(evaluationIntervalRef.current);
        evaluationIntervalRef.current = null;
      }
    };
  }, [isBotActive, isPaused, isDemo, runBotEvaluation]);

  const handleConnectWallet = async () => {
    if (wallet.isConnected) {
      await disconnect();
    } else {
      await connectPhantom();
    }
  };

  const handleSaveSettings = async () => {
    if (!settings) return;
    try {
      await saveSettings(settings);
    } catch {
      // Error handled in hook
    }
  };

  const handleToggleBotActive = (active: boolean) => {
    if (active) {
      // Clear processed and traded tokens when activating bot (fresh session)
      processedTokensRef.current.clear();
      tradedTokensRef.current.clear();
      
      if (isDemo) {
        // Start demo auto-exit monitor
        startDemoMonitor(5000); // Check every 5 seconds for demo
        toast({
          title: "Demo Mode Active",
          description: `Bot running with ${demoBalance.toFixed(0)} SOL demo balance. No real trades.`,
          variant: "default",
        });
      } else {
        // Start auto-exit monitor for live mode (only if Auto Exit is enabled)
        if (autoExitEnabled) {
          startAutoExitMonitor(30000); // Check every 30 seconds
        }
      }
      
      addNotification({
        title: 'Bot Activated',
        message: isDemo 
          ? `Liquidity bot started in demo mode with ${demoBalance.toFixed(0)} SOL balance`
          : 'Liquidity bot started - will auto-trade and auto-exit when conditions are met',
        type: 'success',
      });
    } else {
      // Stop auto-exit monitors
      if (isDemo) {
        stopDemoMonitor();
      } else {
        stopAutoExitMonitor();
      }
      
      addNotification({
        title: 'Bot Deactivated',
        message: 'Liquidity bot has been stopped',
        type: 'info',
      });
    }
    
    // Use BotContext to persist state
    if (active) {
      startBot();
    } else {
      stopBot();
    }
  };
  
  // Reset demo balance handler - with confirmation
  const handleResetDemo = () => {
    setShowResetConfirm(true);
  };

  const confirmResetDemo = () => {
    resetDemoPortfolio();
    setShowResetConfirm(false);
    toast({
      title: "Demo Reset",
      description: "Demo balance reset to 5,000 SOL. All positions cleared.",
    });
  };

  // Bot activation with confirmation for live mode
  const handleToggleBotActiveWithConfirm = (active: boolean) => {
    if (active && !isDemo) {
      // Show confirmation for live mode activation
      setPendingBotAction(active);
      setShowBotActivateConfirm(true);
    } else if (active && isDemo && wallet.isConnected && wallet.network === 'solana') {
      // User is in demo mode but has wallet connected - prompt to switch to live
      setPendingBotAction(active);
      setShowSwitchToLiveConfirm(true);
    } else {
      handleToggleBotActive(active);
    }
  };

  const confirmBotActivation = () => {
    if (pendingBotAction !== null) {
      handleToggleBotActive(pendingBotAction);
      setPendingBotAction(null);
    }
    setShowBotActivateConfirm(false);
  };
  
  const handleSwitchToLiveAndActivate = () => {
    setMode('live');
    setShowSwitchToLiveConfirm(false);
    // Show confirmation for live mode after switching
    setPendingBotAction(true);
    setShowBotActivateConfirm(true);
  };
  
  const handleContinueDemo = () => {
    setShowSwitchToLiveConfirm(false);
    if (pendingBotAction !== null) {
      handleToggleBotActive(pendingBotAction);
      setPendingBotAction(null);
    }
  };

  // Recovery control handlers
  const handleForceScan = useCallback(() => {
    addBotLog({ level: 'info', category: 'system', message: 'Force scan triggered' });
    if (settings?.min_liquidity) {
      scanTokens(settings.min_liquidity);
    }
  }, [settings?.min_liquidity, scanTokens]);

  const handleForceEvaluate = useCallback(() => {
    addBotLog({ level: 'info', category: 'system', message: 'Force evaluate triggered' });
    // Clear the last eval timestamp to bypass throttle
    processedTokensRef.current.clear();
  }, []);

  const handleClearProcessed = useCallback(() => {
    const count = processedTokensRef.current.size;
    processedTokensRef.current.clear();
    addBotLog({ level: 'info', category: 'system', message: `Cleared ${count} processed tokens from cache` });
    toast({ title: 'Cache Cleared', description: `Cleared ${count} tokens from processed cache` });
  }, [toast]);

  // Cleanup stuck positions - moves them to waiting_for_liquidity instead of force-closing
  const handleCleanupStuckPositions = useCallback(async () => {
    if (isDemo) {
      toast({ title: 'Not Available', description: 'Cleanup is only available in Live mode', variant: 'destructive' });
      return;
    }

    const stuckPositions = realOpenPositions.filter(p => 
      p.status === 'open' || p.status === 'pending'
    );

    if (stuckPositions.length === 0) {
      toast({ title: 'No Stuck Positions', description: 'All positions are already closed or in waiting list.' });
      return;
    }

    setShowCleanupConfirm(true);
  }, [isDemo, realOpenPositions, toast]);

  const confirmCleanupPositions = useCallback(async () => {
    setShowCleanupConfirm(false);
    setCleaningUpPositions(true);

    const stuckPositions = realOpenPositions.filter(p => 
      p.status === 'open' || p.status === 'pending'
    );

    let movedCount = 0;
    let failedCount = 0;

    for (const position of stuckPositions) {
      try {
        const success = await moveToWaitingForLiquidity(position.id);
        if (success) {
          movedCount++;
          addBotLog({
            level: 'success',
            category: 'trade',
            message: `Moved to waiting: ${position.token_symbol}`,
            tokenAddress: position.token_address,
          });
        } else {
          failedCount++;
        }
      } catch (err) {
        failedCount++;
        console.error('Failed to move position to waiting:', position.id, err);
      }
    }

    setCleaningUpPositions(false);

    // Force refresh to sync UI
    await fetchPositions(true);

    if (movedCount > 0) {
      toast({
        title: 'Positions Moved to Waiting',
        description: `Successfully moved ${movedCount} position${movedCount > 1 ? 's' : ''} to waiting list${failedCount > 0 ? `. ${failedCount} failed.` : '.'}`,
      });
    } else if (failedCount > 0) {
      toast({
        title: 'Cleanup Failed',
        description: `Failed to move ${failedCount} position${failedCount > 1 ? 's' : ''}. Try again.`,
        variant: 'destructive',
      });
    }
  }, [realOpenPositions, moveToWaitingForLiquidity, fetchPositions, toast]);

  const handleResetBot = useCallback(() => {
    stopBot();
    processedTokensRef.current.clear();
    clearBotLogs();
    if (isDemo) {
      stopDemoMonitor();
    } else {
      stopAutoExitMonitor();
    }
    addBotLog({ level: 'warning', category: 'system', message: 'Bot reset - all state cleared' });
    toast({ title: 'Bot Reset', description: 'Bot deactivated and cache cleared' });
  }, [isDemo, stopDemoMonitor, stopAutoExitMonitor, stopBot, toast]);

  // Sync all open positions with on-chain wallet balances
  const handleSyncPositions = useCallback(async () => {
    if (isDemo || !wallet.address) {
      toast({ title: 'Not Available', description: 'Sync is only available in Live mode with a connected wallet', variant: 'destructive' });
      return;
    }

    setSyncingPositions(true);
    addBotLog({ level: 'info', category: 'system', message: `Syncing ${realOpenPositions.length} positions with on-chain balances and metadata...` });

    let updatedCount = 0;
    let closedCount = 0;
    let metadataUpdated = 0;
    let errorCount = 0;

    // Collect addresses that need metadata enrichment
    const addressesNeedingMetadata = realOpenPositions
      .filter(p => isPlaceholderText(p.token_symbol) || isPlaceholderText(p.token_name))
      .map(p => p.token_address);

    // Fetch metadata from DexScreener for all tokens needing enrichment
    let metadataMap = new Map<string, { name: string; symbol: string }>();
    if (addressesNeedingMetadata.length > 0) {
      try {
        const fetchedMeta = await fetchDexScreenerTokenMetadata(addressesNeedingMetadata);
        for (const [addr, meta] of fetchedMeta.entries()) {
          if (meta.name && meta.symbol) {
            metadataMap.set(addr, { name: meta.name, symbol: meta.symbol });
          }
        }
        addBotLog({ level: 'info', category: 'system', message: `Fetched metadata for ${metadataMap.size} tokens from DexScreener` });
      } catch (err) {
        console.error('DexScreener metadata fetch error:', err);
      }
    }

    for (const position of realOpenPositions) {
      try {
        const { data, error } = await supabase.functions.invoke('token-metadata', {
          body: { mint: position.token_address, owner: wallet.address },
        });

        if (error) {
          errorCount++;
          continue;
        }

        const balanceUi = Number((data as any)?.balanceUi);
        const DUST = 1e-6;

        // Build update payload
        const updatePayload: Record<string, unknown> = {};
        let hasBalanceChange = false;
        let hasMetadataChange = false;

        // Check if balance needs update
        if (!Number.isFinite(balanceUi) || balanceUi <= DUST) {
          // No balance - mark as sold externally
          await markPositionClosed(position.id, position.current_price ?? position.entry_price);
          closedCount++;
          addBotLog({
            level: 'warning',
            category: 'trade',
            message: `Closed ${position.token_symbol} - no on-chain balance`,
            tokenAddress: position.token_address,
          });
          continue; // Skip metadata update for closed positions
        } else if (Math.abs(balanceUi - position.amount) > DUST) {
          updatePayload.amount = balanceUi;
          hasBalanceChange = true;
        }

        // Check if metadata needs enrichment
        const meta = metadataMap.get(position.token_address);
        if (meta) {
          if (isPlaceholderText(position.token_name) && meta.name && !isPlaceholderText(meta.name)) {
            updatePayload.token_name = meta.name;
            hasMetadataChange = true;
          }
          if (isPlaceholderText(position.token_symbol) && meta.symbol && !isPlaceholderText(meta.symbol)) {
            updatePayload.token_symbol = meta.symbol;
            hasMetadataChange = true;
          }
        }

        // Apply updates if any
        if (hasBalanceChange || hasMetadataChange) {
          updatePayload.updated_at = new Date().toISOString();
          await supabase
            .from('positions')
            .update(updatePayload)
            .eq('id', position.id);
          
          if (hasBalanceChange) {
            updatedCount++;
            addBotLog({
              level: 'info',
              category: 'trade',
              message: `Updated ${meta?.symbol || position.token_symbol}: ${position.amount.toFixed(4)} → ${balanceUi.toFixed(4)}`,
              tokenAddress: position.token_address,
            });
          }
          if (hasMetadataChange) {
            metadataUpdated++;
            addBotLog({
              level: 'info',
              category: 'system',
              message: `Enriched metadata: ${position.token_symbol} → ${meta?.symbol}`,
              tokenAddress: position.token_address,
            });
          }
        }
      } catch (err) {
        errorCount++;
        console.error('Sync error for position:', position.id, err);
      }
    }

    setSyncingPositions(false);
    await fetchPositions(true);

    const summary: string[] = [];
    if (updatedCount > 0) summary.push(`${updatedCount} amounts synced`);
    if (metadataUpdated > 0) summary.push(`${metadataUpdated} names fixed`);
    if (closedCount > 0) summary.push(`${closedCount} closed`);
    if (errorCount > 0) summary.push(`${errorCount} errors`);

    toast({
      title: 'Sync Complete',
      description: summary.length > 0 ? summary.join(', ') : 'All positions are in sync',
    });

    addBotLog({
      level: 'success',
      category: 'system',
      message: `Sync complete: ${summary.join(', ') || 'all in sync'}`,
    });
  }, [isDemo, wallet.address, realOpenPositions, markPositionClosed, fetchPositions, toast]);

  // Win rate calculation
  const winRate = closedPositions.length > 0 
    ? (closedPositions.filter(p => (p.profit_loss_percent || 0) > 0).length / closedPositions.length) * 100 
    : 0;

  return (
    <ErrorBoundary>
      {/* Confirmation Dialogs */}
      <ConfirmDialog
        open={showResetConfirm}
        onOpenChange={setShowResetConfirm}
        title="Reset Demo Portfolio?"
        description="This will reset your demo balance to 5,000 SOL and close all demo positions. This action cannot be undone."
        confirmLabel="Reset Demo"
        variant="warning"
        onConfirm={confirmResetDemo}
      />
      
      <ConfirmDialog
        open={showBotActivateConfirm}
        onOpenChange={setShowBotActivateConfirm}
        title="Activate Live Trading Bot?"
        description="This will enable automatic trading with real funds from your connected wallet. The bot will execute trades based on your configured settings. Make sure you understand the risks before proceeding."
        confirmLabel="Activate Bot"
        variant="destructive"
        onConfirm={confirmBotActivation}
      />
      
      {/* Switch to Live Mode Dialog */}
      <ConfirmDialog
        open={showSwitchToLiveConfirm}
        onOpenChange={setShowSwitchToLiveConfirm}
        title="Wallet Connected - Switch to Live Mode?"
        description={`You have a Solana wallet connected with ${wallet.balance || '0 SOL'}. Would you like to switch to Live mode to trade with real funds, or continue in Demo mode with simulated trades?`}
        confirmLabel="Switch to Live Mode"
        cancelLabel="Continue Demo"
        variant="default"
        onConfirm={handleSwitchToLiveAndActivate}
        onCancel={handleContinueDemo}
      />
      
      {/* Cleanup Stuck Positions Dialog */}
      <ConfirmDialog
        open={showCleanupConfirm}
        onOpenChange={setShowCleanupConfirm}
        title="Move Stuck Positions to Waiting List?"
        description={`This will move ${realOpenPositions.filter(p => p.status === 'open' || p.status === 'pending').length} stuck position(s) to the Waiting List. The bot will auto-retry selling when liquidity becomes available.`}
        confirmLabel={cleaningUpPositions ? "Moving..." : "Move All to Waiting"}
        variant="default"
        onConfirm={confirmCleanupPositions}
      />
      
      {/* Exit Preview Modal */}
      <ExitPreviewModal
        open={showExitPreview}
        onOpenChange={setShowExitPreview}
        position={exitPreviewPosition}
        walletAddress={wallet.address || ''}
        onConfirmExit={handleConfirmExitFromModal}
      />
      
      {/* No Route Exit Modal */}
      <NoRouteExitModal
        open={showNoRouteModal}
        onOpenChange={setShowNoRouteModal}
        tokenSymbol={noRoutePosition?.token_symbol || ''}
        tokenName={noRoutePosition?.token_name || ''}
        onMoveToWaiting={async () => {
          if (noRoutePosition) {
            console.log('[NoRouteModal] Moving position to waiting:', noRoutePosition.id, noRoutePosition.token_symbol);
            addBotLog({
              level: 'warning',
              category: 'exit',
              message: `⏳ Moving to Waiting Pool: ${noRoutePosition.token_symbol}`,
              tokenSymbol: noRoutePosition.token_symbol,
              details: 'No Jupiter/Raydium route available. Will auto-retry every 30s until liquidity returns.',
            });
            
            const success = await moveToWaitingForLiquidity(noRoutePosition.id);
            console.log('[NoRouteModal] Move result:', success);
            
            if (success) {
              addBotLog({
                level: 'success',
                category: 'exit',
                message: `✅ Moved to Waiting Pool: ${noRoutePosition.token_symbol}`,
                tokenSymbol: noRoutePosition.token_symbol,
                details: 'Token removed from Active trades. Will auto-sell when liquidity returns.',
              });
            } else {
              addBotLog({
                level: 'error',
                category: 'exit',
                message: `❌ Failed to move: ${noRoutePosition.token_symbol}`,
                tokenSymbol: noRoutePosition.token_symbol,
                details: 'Could not update position status. Check console for details.',
              });
              toast({
                title: 'Failed to move position',
                description: 'Could not update the position status. Please try again.',
                variant: 'destructive',
              });
            }
            
            // Always refresh both positions lists to sync UI state
            await Promise.all([fetchPositions(true), fetchWaitingPositions()]);
          }
          setShowNoRouteModal(false);
          setNoRoutePosition(null);
        }}
        onKeepInList={() => {
          setShowNoRouteModal(false);
          setNoRoutePosition(null);
        }}
      />
      <AppLayout>
        <div className="container mx-auto max-w-[1600px] px-2 sm:px-3 md:px-5 space-y-4 md:space-y-6">
          {/* Demo Mode Banner */}
          {isDemo && (
            <Alert className="bg-warning/10 border-warning/30">
              <FlaskConical className="h-4 w-4 text-warning" />
              <AlertTitle className="text-warning flex items-center justify-between">
                <div className="flex items-center gap-2">
                  Demo Mode Active
                  <Badge className="bg-warning/20 text-warning border-warning/30 ml-2">
                    <Coins className="w-3 h-3 mr-1" />
                    {demoBalance.toFixed(0)} SOL
                  </Badge>
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="h-7 text-xs border-warning/30 text-warning hover:bg-warning/20"
                  onClick={handleResetDemo}
                >
                  <RotateCcw className="w-3 h-3 mr-1" />
                  Reset
                </Button>
              </AlertTitle>
              <AlertDescription className="text-warning/80">
                You're trading with simulated {demoBalance.toFixed(0)} SOL. Switch to Live mode for real trading.
              </AlertDescription>
            </Alert>
          )}

          {/* No Credits Overlay - blocks scanner in live mode */}
          {!isDemo && !hasCredits && (
            <NoCreditOverlay feature="scanner" />
          )}

          {/* API Errors Banner */}
          {apiErrors.length > 0 && (
            <Alert variant="destructive" className="border-destructive/40 bg-destructive/5">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle className="flex items-center justify-between">
                <span>API Connection Issues ({apiErrors.length})</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => {}}
                >
                  <X className="h-4 w-4" />
                </Button>
              </AlertTitle>
              <AlertDescription>
                <div className="space-y-1 mt-2">
                  {apiErrors.slice(0, 3).map((error, index) => (
                    <div key={index} className="flex items-center justify-between text-sm bg-destructive/10 rounded px-2 py-1">
                      <div>
                        <span className="font-medium">{error.apiName}</span>
                        <span className="text-muted-foreground ml-2">({error.apiType})</span>
                      </div>
                      <span className="text-xs text-muted-foreground">{error.errorMessage}</span>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  View Admin Panel → Analytics for detailed API health monitoring
                </p>
              </AlertDescription>
            </Alert>
          )}

          {/* Stats Row - Compact dashboard-aligned grid */}
          <div className="grid grid-cols-3 gap-1.5 md:gap-2 lg:grid-cols-6">
            <div className="bg-card/80 rounded-lg border border-border/40 px-3 py-2.5">
              <p className="text-[10px] text-muted-foreground mb-0.5 truncate">Invested</p>
              <p className="text-sm font-bold text-foreground font-mono tabular-nums truncate">{formatSolNativeValue(totalInvestedSol).primary}</p>
              <p className="text-[9px] text-muted-foreground font-mono truncate">{formatSolNativeValue(totalInvestedSol).secondary}</p>
            </div>
            <div className="bg-card/80 rounded-lg border border-border/40 px-3 py-2.5">
              <p className="text-[10px] text-muted-foreground mb-0.5 truncate">Open Value</p>
              <p className="text-sm font-bold text-foreground font-mono tabular-nums truncate">{formatSolNativeValue(totalValueSol).primary}</p>
              <p className="text-[9px] text-muted-foreground font-mono truncate">{formatSolNativeValue(totalValueSol).secondary}</p>
            </div>
            <div className="bg-card/80 rounded-lg border border-border/40 px-3 py-2.5">
              <p className="text-[10px] text-muted-foreground mb-0.5 truncate">Total P&L</p>
              <p className={cn("text-sm font-bold font-mono tabular-nums truncate", totalPnLSol >= 0 ? 'text-success' : 'text-destructive')}>
                {formatSolNativeValue(totalPnLSol, { showSign: true }).primary}
              </p>
              <p className={cn("text-[9px] font-mono truncate", totalPnLSol >= 0 ? 'text-success/70' : 'text-destructive/70')}>
                {formatSolNativeValue(totalPnLSol, { showSign: true }).secondary}
              </p>
            </div>
            <div className="bg-card/80 rounded-lg border border-border/40 px-3 py-2.5">
              <p className="text-[10px] text-muted-foreground mb-0.5 truncate">Active</p>
              <p className="text-sm font-bold text-foreground tabular-nums">{openPositions.length}</p>
              <p className="text-[9px] text-success truncate">{openPositions.filter(p => (p.profit_loss_percent || 0) > 0).length} in profit</p>
            </div>
            <div className="bg-card/80 rounded-lg border border-border/40 px-3 py-2.5">
              <p className="text-[10px] text-muted-foreground mb-0.5 truncate">Pools</p>
              <p className="text-sm font-bold text-foreground tabular-nums">{tokens.length}</p>
              <p className="text-[9px] text-primary truncate">{tokens.filter(t => t.riskScore < 50).length} signals</p>
            </div>
            <div className="bg-card/80 rounded-lg border border-border/40 px-3 py-2.5">
              <p className="text-[10px] text-muted-foreground mb-0.5 truncate">Win Rate</p>
              <p className={cn("text-sm font-bold tabular-nums", winRate >= 50 ? 'text-success' : winRate > 0 ? 'text-destructive' : 'text-foreground')}>
                {winRate.toFixed(0)}%
              </p>
              <p className="text-[9px] text-muted-foreground truncate">{closedPositions.length} trades</p>
            </div>
          </div>

          {/* Main Content Grid - Cleaner 2-column layout */}
          <div className="grid gap-4 lg:grid-cols-[1fr,400px]">
            {/* Left Column - Token Monitor (main focus) */}
            <div className="space-y-4 order-2 lg:order-1">
              {/* Liquidity Monitor - Primary content */}
              <LiquidityMonitor 
                pools={tokens}
                activeTrades={allActivePositions}
                waitingPositions={waitingPositions}
                walletTokens={walletTokens}
                loadingWalletTokens={loadingWalletTokens}
                loading={loading}
                apiStatus={loading ? 'active' : (isPoolScanningPaused ? 'waiting' : 'active')}
                onExitTrade={handleOpenExitPreview}
                onRetryLiquidityCheck={runLiquidityRetryCheck}
                onMoveBackFromWaiting={moveBackToOpen}
                onManualSellWaiting={async (pos) => {
                  // Handle both WaitingPosition and CombinedWaitingItem (wallet tokens)
                  if ('isWalletToken' in pos && pos.isWalletToken) {
                    // For wallet tokens, we need to create a minimal position object
                    const walletPos = {
                      id: pos.id,
                      token_address: pos.token_address,
                      token_symbol: pos.token_symbol || pos.token_address.slice(0, 6),
                      token_name: pos.token_name || `Token ${pos.token_address.slice(0, 6)}`,
                      amount: pos.amount,
                      entry_price: pos.current_price,
                      current_price: pos.current_price,
                      profit_loss_percent: null,
                      liquidity_last_checked_at: null,
                      liquidity_check_count: 0,
                      waiting_for_liquidity_since: null,
                      status: 'wallet',
                    };
                    const success = await tryExecuteWaitingPosition(walletPos);
                    if (success) {
                      refetchWalletTokens();
                    }
                  } else {
                    const success = await tryExecuteWaitingPosition(pos);
                    if (success) {
                      fetchPositions(true);
                      fetchWaitingPositions();
                    }
                  }
                }}
                onRefreshWalletTokens={refetchWalletTokens}
                checkingLiquidity={checkingLiquidity}
                isScanningPaused={isPoolScanningPaused}
                onToggleScanning={() => setIsPoolScanningPaused(prev => !prev)}
                holderData={holderDataMap}
                onFetchHolders={fetchTokenHolders}
              />

              {/* Bot Activity Log */}
              <BotActivityLog maxEntries={30} />
            </div>

            {/* Right Column - Bot Controls & Stats */}
            <div className="space-y-4 order-1 lg:order-2">
              {/* Bot Preflight Check */}
              <BotPreflightCheck
                isBotActive={isBotActive}
                isDemo={isDemo}
                walletConnected={wallet.isConnected}
                walletNetwork={wallet.network}
                walletBalance={wallet.balance}
                tradeAmount={settings?.trade_amount ?? null}
                maxConcurrentTrades={settings?.max_concurrent_trades ?? null}
                autoEntryEnabled={autoEntryEnabled}
                openPositionsCount={openPositions.length}
                onConnectWallet={connectPhantom}
              />
              
              {/* Liquidity Bot Panel - All settings in one place */}
              <LiquidityBotPanel
                settings={settings}
                saving={saving}
                onUpdateField={updateField}
                onSave={handleSaveSettings}
                isActive={isBotActive}
                onToggleActive={handleToggleBotActiveWithConfirm}
                autoEntryEnabled={autoEntryEnabled}
                onAutoEntryChange={toggleAutoEntry}
                autoExitEnabled={autoExitEnabled}
                onAutoExitChange={toggleAutoExit}
                isDemo={isDemo}
                walletConnected={wallet.isConnected && wallet.network === 'solana'}
                walletAddress={wallet.address}
                walletBalance={wallet.balance}
              />

              {/* Clear Rejected Tokens */}
              {!isDemo && (
                <div className="glass rounded-xl p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-foreground">Rejected Token Cache</p>
                      <p className="text-xs text-muted-foreground">
                        {getStateCounts().rejectedCount} tokens blocked from re-evaluation
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        const cleared = await clearRejectedTokens();
                        processedTokensRef.current.clear();
                        toast({
                          title: 'Cache Cleared',
                          description: `${cleared} rejected tokens cleared. New tokens will be re-evaluated.`,
                        });
                      }}
                    >
                      Clear & Reset
                    </Button>
                  </div>
                </div>
              )}

              {/* Performance Panel */}
              <PerformancePanel
                winRate={isDemo ? demoWinRate : winRate}
                totalPnL={isDemo ? demoTotalPnLPercent : totalPnLPercent}
                avgPnL={isDemo ? demoAvgPnL : (totalPnLPercent / Math.max(closedPositions.length, 1))}
                bestTrade={isDemo ? demoBestTrade : Math.max(...closedPositions.map(p => p.profit_loss_percent || 0), 0)}
                worstTrade={isDemo ? demoWorstTrade : Math.min(...closedPositions.map(p => p.profit_loss_percent || 0), 0)}
                totalTrades={isDemo ? demoTotalTrades : closedPositions.length}
                wins={isDemo ? demoWins : closedPositions.filter(p => (p.profit_loss_percent || 0) > 0).length}
                losses={isDemo ? demoLosses : closedPositions.filter(p => (p.profit_loss_percent || 0) <= 0).length}
              />

              {/* Trade Signals - Live mode only */}
              {!isDemo && <TradeSignalPanel />}

              {/* Sniper Decisions - Live mode debug */}
              {!isDemo && (
                <SniperDecisionPanel
                  decisions={sniperResult?.decisions || []}
                  loading={sniperLoading}
                  isDemo={isDemo}
                  botActive={isBotActive}
                />
              )}

              {/* Validation Gate Summary */}
              {!isDemo && (
                <ValidationSummaryPanel
                  gateResults={(sniperResult?.gateResults || useScannerStore.getState().gateResults) as any}
                />
              )}

              {/* API Health - Admin only */}
              {isAdmin && <ApiHealthWidget isDemo={isDemo} />}

              {/* Paid API Alert */}
              <PaidApiAlert isBotActive={isBotActive} isDemo={isDemo} />

              {/* Recovery Controls - Live mode only */}
              {!isDemo && (
                <RecoveryControls
                  onForceScan={handleForceScan}
                  onForceEvaluate={handleForceEvaluate}
                  onClearProcessed={handleClearProcessed}
                  onResetBot={handleResetBot}
                  onCleanupStuck={handleCleanupStuckPositions}
                  onSyncPositions={handleSyncPositions}
                  scanning={loading}
                  evaluating={sniperLoading}
                  cleaningUp={cleaningUpPositions}
                  syncingPositions={syncingPositions}
                  processedCount={processedTokensRef.current.size}
                  stuckPositionsCount={realOpenPositions.filter(p => p.status === 'open' || p.status === 'pending').length}
                  openPositionsCount={realOpenPositions.length}
                  botActive={isBotActive}
                />
              )}
            </div>
          </div>
        </div>
      </AppLayout>
    </ErrorBoundary>
  );
});

Scanner.displayName = 'Scanner';

export default Scanner;
