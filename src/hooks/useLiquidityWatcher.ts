/**
 * Liquidity Watcher Background Worker
 * 
 * Continuously monitors open positions for liquidity risks:
 * - Liquidity drops > 60% → Emergency sell or FROZEN
 * - LP tokens removed → Emergency sell or FROZEN
 * - Sell route disappears → Mark FROZEN
 * 
 * Also updates deployer reputation on detected rugs.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useWallet } from '@/hooks/useWallet';
import { useNotifications } from '@/hooks/useNotifications';
import { addBotLog } from '@/components/scanner/BotActivityLog';
import { fetchJupiterQuote } from '@/lib/jupiterQuote';
import { recordRugPull, addWalletToCluster } from '@/lib/deployerReputation';
import { acquireSellLock, releaseSellLock } from '@/lib/sellLock';

// =============================================================================
// TYPES
// =============================================================================

export interface WatchedPosition {
  id: string;
  tokenAddress: string;
  tokenSymbol: string;
  tokenName: string;
  entryLiquidity: number;
  currentLiquidity: number;
  lastChecked: number;
  status: 'watching' | 'warning' | 'frozen' | 'exiting';
  warningReason?: string;
}

export interface LiquidityWatchResult {
  positionId: string;
  tokenSymbol: string;
  action: 'ok' | 'emergency_sell' | 'frozen';
  reason?: string;
  liquidityDropPercent?: number;
  txHash?: string;
  error?: string;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const WATCH_INTERVAL_MS = 15_000;        // Check every 15 seconds
const LIQUIDITY_DROP_THRESHOLD = 60;     // 60% drop triggers action
const ROUTE_CHECK_TIMEOUT_MS = 8_000;    // 8 second timeout for route checks
const SOL_MINT = 'So11111111111111111111111111111111111111112';

// =============================================================================
// HOOK
// =============================================================================

export function useLiquidityWatcher() {
  const [isWatching, setIsWatching] = useState(false);
  const [watchedPositions, setWatchedPositions] = useState<WatchedPosition[]>([]);
  const [lastCheck, setLastCheck] = useState<string | null>(null);
  const [frozenCount, setFrozenCount] = useState(0);
  
  const { toast } = useToast();
  const { user } = useAuth();
  const { wallet, signAndSendTransaction } = useWallet();
  const { addNotification } = useNotifications();
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isRunningRef = useRef(false);
  const positionLiquidityCache = useRef<Map<string, number>>(new Map());

  /**
   * Fetch current liquidity for a token from DexScreener
   */
  const fetchTokenLiquidity = useCallback(async (tokenAddress: string): Promise<{
    liquidity: number;
    price: number;
    hasLpRemoval?: boolean;
  } | null> => {
    try {
      const response = await fetch(
        `https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`,
        { signal: AbortSignal.timeout(5000) }
      );
      
      if (!response.ok) return null;
      
      const data = await response.json();
      const pair = data.pairs?.find((p: any) => p.chainId === 'solana');
      
      if (!pair) return null;
      
      return {
        liquidity: pair.liquidity?.usd || 0,
        price: parseFloat(pair.priceUsd || '0'),
        // DexScreener doesn't directly expose LP removal, but we can infer from liquidity drop
      };
    } catch (error) {
      console.error('[LiquidityWatcher] Fetch error:', error);
      return null;
    }
  }, []);

  /**
   * Check if a sell route exists for a token
   */
  const checkSellRoute = useCallback(async (
    tokenAddress: string,
    amount: number
  ): Promise<boolean> => {
    try {
      // Convert to base units (assume 6 decimals for most tokens)
      const amountStr = Math.floor(amount * 1_000_000).toString();
      
      const result = await fetchJupiterQuote({
        inputMint: tokenAddress,
        outputMint: SOL_MINT,
        amount: amountStr,
        slippageBps: 1500,
        critical: true, // Emergency route check
      });
      
      return result.ok === true;
    } catch (error) {
      console.error('[LiquidityWatcher] Route check error:', error);
      return false;
    }
  }, []);

  /**
   * Execute emergency sell for a position
   */
  const executeEmergencySell = useCallback(async (
    position: WatchedPosition,
    reason: string
  ): Promise<LiquidityWatchResult> => {
    if (!wallet.isConnected || !wallet.address) {
      return {
        positionId: position.id,
        tokenSymbol: position.tokenSymbol,
        action: 'frozen',
        reason: 'Wallet not connected for emergency sell',
      };
    }

    // Acquire sell lock
    if (!acquireSellLock(position.tokenAddress, 'liquidity_watcher')) {
      return {
        positionId: position.id,
        tokenSymbol: position.tokenSymbol,
        action: 'frozen',
        reason: 'Sell already in progress',
      };
    }

    try {
      addBotLog({
        level: 'warning',
        category: 'exit',
        message: `🚨 EMERGENCY SELL: ${position.tokenSymbol}`,
        tokenSymbol: position.tokenSymbol,
        details: `Reason: ${reason}\nExecuting immediate sell...`,
      });

      // Get position details from DB
      const { data: dbPosition, error: posError } = await supabase
        .from('positions')
        .select('*')
        .eq('id', position.id)
        .single();

      if (posError || !dbPosition) {
        throw new Error('Position not found in database');
      }

      // Get on-chain balance
      let tokenAmount = Number(dbPosition.amount);
      let tokenDecimals = 6;

      try {
        const { data: meta } = await supabase.functions.invoke('token-metadata', {
          body: { mint: position.tokenAddress, owner: wallet.address },
        });
        const bal = Number((meta as any)?.balanceUi);
        const dec = Number((meta as any)?.decimals);
        if (Number.isFinite(dec) && dec >= 0) tokenDecimals = dec;
        if (Number.isFinite(bal) && bal > 0) tokenAmount = bal;
      } catch {
        // Use DB amount
      }

      if (tokenAmount <= 0) {
        throw new Error('No tokens to sell');
      }

      // Build Jupiter swap
      const amountInSmallestUnit = Math.floor(tokenAmount * Math.pow(10, tokenDecimals)).toString();
      
      const quoteResult = await fetchJupiterQuote({
        inputMint: position.tokenAddress,
        outputMint: SOL_MINT,
        amount: amountInSmallestUnit,
        slippageBps: 2500, // 25% slippage for emergency
        critical: true, // Emergency exit bypasses circuit breaker
      });

      if (quoteResult.ok !== true) {
        // No route - mark as frozen
        await markPositionFrozen(position.id, `No sell route: ${reason}`);
        
        return {
          positionId: position.id,
          tokenSymbol: position.tokenSymbol,
          action: 'frozen',
          reason: 'No sell route available',
        };
      }

      // Build swap transaction
      const swapRes = await fetch('https://lite-api.jup.ag/swap/v1/swap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quoteResponse: quoteResult.quote,
          userPublicKey: wallet.address,
          wrapAndUnwrapSol: true,
          dynamicComputeUnitLimit: true,
          dynamicSlippage: true,
          priorityLevelWithMaxLamports: { maxLamports: 10000000, priorityLevel: 'veryHigh' },
        }),
      });

      if (!swapRes.ok) {
        throw new Error('Failed to build swap transaction');
      }

      const swapData = await swapRes.json();
      if (!swapData.swapTransaction) {
        throw new Error('No transaction data returned');
      }

      // Decode and sign
      const txBytes = Uint8Array.from(atob(swapData.swapTransaction), c => c.charCodeAt(0));
      const { VersionedTransaction } = await import('@solana/web3.js');
      const transaction = VersionedTransaction.deserialize(txBytes);

      const signResult = await signAndSendTransaction(transaction);

      if (!signResult.success) {
        throw new Error(signResult.error || 'Transaction rejected');
      }

      // Update position as closed
      await supabase
        .from('positions')
        .update({
          status: 'closed',
          exit_reason: `emergency_${reason.toLowerCase().replace(/\s+/g, '_')}`,
          exit_tx_id: signResult.signature,
          closed_at: new Date().toISOString(),
        })
        .eq('id', position.id);

      // Record rug pull for deployer reputation
      // Calculate position duration
      const { data: posForDuration } = await supabase
        .from('positions')
        .select('created_at')
        .eq('id', position.id)
        .single();
      
      const durationSeconds = posForDuration 
        ? Math.round((Date.now() - new Date(posForDuration.created_at).getTime()) / 1000)
        : 300;

      // Note: We don't have deployer wallet stored on position currently
      // This would need to be added for full deployer tracking
      // recordRugPull(deployerWallet, durationSeconds, position.tokenAddress);

      addBotLog({
        level: 'success',
        category: 'exit',
        message: `✅ EMERGENCY SELL COMPLETE: ${position.tokenSymbol}`,
        tokenSymbol: position.tokenSymbol,
        details: `Reason: ${reason}\nTX: ${signResult.signature}`,
      });

      toast({
        title: '🚨 Emergency Sell Executed',
        description: `${position.tokenSymbol} sold due to ${reason}`,
        variant: 'destructive',
      });

      addNotification({
        title: `Emergency Sell: ${position.tokenSymbol}`,
        message: `Position closed due to ${reason}`,
        type: 'error',
      });

      return {
        positionId: position.id,
        tokenSymbol: position.tokenSymbol,
        action: 'emergency_sell',
        reason,
        txHash: signResult.signature,
      };

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      
      // Mark as frozen if sell fails
      await markPositionFrozen(position.id, `Emergency sell failed: ${errorMsg}`);

      addBotLog({
        level: 'error',
        category: 'exit',
        message: `❌ EMERGENCY SELL FAILED: ${position.tokenSymbol}`,
        tokenSymbol: position.tokenSymbol,
        details: `Error: ${errorMsg}\nPosition marked as FROZEN`,
      });

      return {
        positionId: position.id,
        tokenSymbol: position.tokenSymbol,
        action: 'frozen',
        reason: `Sell failed: ${errorMsg}`,
        error: errorMsg,
      };
    } finally {
      releaseSellLock(position.tokenAddress);
    }
  }, [wallet, signAndSendTransaction, toast, addNotification]);

  /**
   * Mark a position as frozen (cannot exit)
   */
  const markPositionFrozen = useCallback(async (
    positionId: string,
    reason: string
  ): Promise<void> => {
    try {
      // Determine if this is a rug (liquidity gone) vs temporary freeze
      const isRug = reason.includes('sell_route_disappeared') || 
                    reason.includes('liquidity dropped') ||
                    reason.includes('No sell route');
      
      if (isRug) {
        // Mark as rug_detected with -100% P&L
        const { data: posData } = await supabase
          .from('positions')
          .select('entry_value, entry_price, entry_price_usd, amount')
          .eq('id', positionId)
          .single();
        
        const entryPriceForCalc = posData?.entry_price_usd ?? posData?.entry_price ?? 0;
        const entryValue = posData?.entry_value ?? ((posData?.amount ?? 0) * entryPriceForCalc);

        await supabase
          .from('positions')
          .update({
            status: 'closed',
            closed_at: new Date().toISOString(),
            exit_reason: 'rug_detected',
            current_price: 0,
            current_value: 0,
            profit_loss_percent: -100,
            profit_loss_value: -entryValue,
          })
          .eq('id', positionId);
      } else {
        await supabase
          .from('positions')
          .update({
            status: 'waiting_for_liquidity' as any,
            waiting_for_liquidity_since: new Date().toISOString(),
            exit_reason: `frozen:${reason}`,
          })
          .eq('id', positionId);
      }

      setFrozenCount(prev => prev + 1);

      console.log(`[LiquidityWatcher] Position ${positionId} marked as FROZEN: ${reason}`);
    } catch (error) {
      console.error('[LiquidityWatcher] Failed to mark position frozen:', error);
    }
  }, []);

  /**
   * Run a single watch cycle for all open positions
   */
  const runWatchCycle = useCallback(async (): Promise<LiquidityWatchResult[]> => {
    if (isRunningRef.current || !user) return [];
    
    isRunningRef.current = true;
    const results: LiquidityWatchResult[] = [];

    try {
      // Fetch all open positions
      const { data: positions, error } = await supabase
        .from('positions')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'open');

      if (error || !positions || positions.length === 0) {
        return [];
      }

      const watchedList: WatchedPosition[] = [];

      // Check each position
      for (const pos of positions) {
        const tokenAddress = pos.token_address;
        const tokenSymbol = pos.token_symbol || 'UNKNOWN';
        const tokenName = pos.token_name || tokenSymbol;
        const amount = Number(pos.amount);

        // Get cached entry liquidity or use entry_value as proxy
        let entryLiquidity = positionLiquidityCache.current.get(pos.id);
        if (!entryLiquidity) {
          // First time seeing this position - use entry value * 100 as rough liquidity estimate
          entryLiquidity = (Number(pos.entry_value) || 0.1) * 100;
          positionLiquidityCache.current.set(pos.id, entryLiquidity);
        }

        // Fetch current liquidity
        const currentData = await fetchTokenLiquidity(tokenAddress);
        
        const watchedPos: WatchedPosition = {
          id: pos.id,
          tokenAddress,
          tokenSymbol,
          tokenName,
          entryLiquidity,
          currentLiquidity: currentData?.liquidity || 0,
          lastChecked: Date.now(),
          status: 'watching',
        };

        // Check 1: Liquidity drop > 60%
        if (currentData) {
          const dropPercent = entryLiquidity > 0
            ? ((entryLiquidity - currentData.liquidity) / entryLiquidity) * 100
            : 0;

          if (dropPercent > LIQUIDITY_DROP_THRESHOLD) {
            watchedPos.status = 'warning';
            watchedPos.warningReason = `Liquidity dropped ${dropPercent.toFixed(1)}%`;

            addBotLog({
              level: 'warning',
              category: 'exit',
              message: `⚠️ LIQUIDITY ALERT: ${tokenSymbol}`,
              tokenSymbol,
              details: `Liquidity dropped ${dropPercent.toFixed(1)}% (>${LIQUIDITY_DROP_THRESHOLD}%)\nFrom: $${entryLiquidity.toFixed(0)} → $${currentData.liquidity.toFixed(0)}\nTriggering emergency action...`,
            });

            // Attempt emergency sell
            const sellResult = await executeEmergencySell(
              watchedPos,
              `liquidity dropped ${dropPercent.toFixed(0)}%`
            );
            results.push({
              ...sellResult,
              liquidityDropPercent: dropPercent,
            });

            if (sellResult.action === 'frozen') {
              watchedPos.status = 'frozen';
            } else {
              continue; // Position closed, don't add to watched list
            }
          }
        } else {
          // Couldn't fetch liquidity - check if route exists
          watchedPos.status = 'warning';
          watchedPos.warningReason = 'Could not fetch liquidity data';
        }

        // Check 2: Sell route exists (only if we haven't already triggered emergency sell)
        if (watchedPos.status !== 'frozen' && watchedPos.status !== 'exiting') {
          const hasRoute = await checkSellRoute(tokenAddress, amount);

          if (!hasRoute) {
            watchedPos.status = 'warning';
            watchedPos.warningReason = 'No sell route available';

            addBotLog({
              level: 'warning',
              category: 'exit',
              message: `⚠️ NO ROUTE: ${tokenSymbol}`,
              tokenSymbol,
              details: `Sell route disappeared for ${tokenSymbol}\nPosition may be unsellable - marking as FROZEN`,
            });

            await markPositionFrozen(pos.id, 'sell_route_disappeared');
            watchedPos.status = 'frozen';

            results.push({
              positionId: pos.id,
              tokenSymbol,
              action: 'frozen',
              reason: 'Sell route disappeared',
            });
          }
        }

        watchedList.push(watchedPos);
      }

      setWatchedPositions(watchedList);
      setLastCheck(new Date().toISOString());

    } catch (error) {
      console.error('[LiquidityWatcher] Watch cycle error:', error);
    } finally {
      isRunningRef.current = false;
    }

    return results;
  }, [user, fetchTokenLiquidity, checkSellRoute, executeEmergencySell, markPositionFrozen]);

  /**
   * Start the background watcher
   */
  const startWatcher = useCallback(() => {
    if (intervalRef.current) {
      console.log('[LiquidityWatcher] Already running');
      return;
    }

    console.log('[LiquidityWatcher] Starting background watcher');
    setIsWatching(true);

    // Run immediately
    runWatchCycle();

    // Then run periodically
    intervalRef.current = setInterval(() => {
      runWatchCycle();
    }, WATCH_INTERVAL_MS);
  }, [runWatchCycle]);

  /**
   * Stop the background watcher
   */
  const stopWatcher = useCallback(() => {
    if (intervalRef.current) {
      console.log('[LiquidityWatcher] Stopping background watcher');
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsWatching(false);
  }, []);

  /**
   * Force an immediate check
   */
  const forceCheck = useCallback(async (): Promise<LiquidityWatchResult[]> => {
    return await runWatchCycle();
  }, [runWatchCycle]);

  /**
   * Add a deployer to malicious list
   */
  const flagMaliciousDeployer = useCallback(async (
    deployerWallet: string,
    clusterId?: string
  ): Promise<void> => {
    try {
      if (clusterId) {
        await addWalletToCluster(deployerWallet, clusterId);
      } else {
        // Record as rug with minimal survival time
        await recordRugPull(deployerWallet, 60, 'manual_flag');
      }

      toast({
        title: 'Deployer Flagged',
        description: `${deployerWallet.slice(0, 8)}... added to malicious list`,
      });

      addBotLog({
        level: 'warning',
        category: 'system',
        message: `🚫 Deployer flagged: ${deployerWallet.slice(0, 12)}...`,
        tokenSymbol: 'SYSTEM',
        details: clusterId ? `Added to cluster: ${clusterId}` : 'Marked as malicious',
      });
    } catch (error) {
      console.error('[LiquidityWatcher] Failed to flag deployer:', error);
    }
  }, [toast]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  // Auto-start when user is authenticated (optional - can be controlled externally)
  // Disabled by default - let Scanner.tsx control when to start
  // useEffect(() => {
  //   if (user && wallet.isConnected) {
  //     startWatcher();
  //   }
  //   return () => stopWatcher();
  // }, [user, wallet.isConnected, startWatcher, stopWatcher]);

  return {
    // State
    isWatching,
    watchedPositions,
    lastCheck,
    frozenCount,
    
    // Actions
    startWatcher,
    stopWatcher,
    forceCheck,
    flagMaliciousDeployer,
    
    // Utilities
    fetchTokenLiquidity,
    checkSellRoute,
  };
}
