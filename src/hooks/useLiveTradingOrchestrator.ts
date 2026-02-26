/**
 * Live Trading Orchestrator
 * 
 * This hook unifies the entire trading flow for live trading:
 * 1. Receives approved tokens from auto-sniper evaluation
 * 2. Validates wallet connection and balance
 * 3. Executes trades using the 3-stage trading engine
 * 4. Persists positions to the database
 * 5. Monitors for auto-exit conditions
 * 
 * This is the SINGLE ENTRY POINT for all live trades.
 */

import { useCallback, useRef, useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWallet } from '@/hooks/useWallet';
import { useWalletModal } from '@/hooks/useWalletModal';
import { useTradingEngine } from '@/hooks/useTradingEngine';
import { usePositions } from '@/hooks/usePositions';
import { useSniperSettings, SniperSettings } from '@/hooks/useSniperSettings';
import { useToast } from '@/hooks/use-toast';
import { useTokenStateManager } from '@/hooks/useTokenStateManager';
import { addBotLog } from '@/components/scanner/BotActivityLog';
import { isPlaceholderText } from '@/lib/formatters';
import { useCredits } from '@/hooks/useCredits';
import { validateSwapRoute } from '@/lib/routeValidator';
import { quickLiquidityCheck } from '@/lib/liquidityMonitor';
import { parseSolDelta } from '@/lib/solDeltaParser';
import { startPostBuyMonitor } from '@/lib/postBuyMonitor';
import {
  canExecuteToken,
  recordExecutionAttempt,
  acquireExecutionLock,
  releaseExecutionLock,
  isAutoBlacklisted,
  recordSwapFailure,
  verifySellRoute,
  isScamTokenName,
} from '@/lib/executionGuard';
import type { TradingFlowResult } from '@/lib/trading-engine';

// Approved token from auto-sniper
export interface ApprovedToken {
  address: string;
  symbol: string;
  name: string;
  liquidity: number;
  riskScore: number;
  priceUsd?: number;
  buyerPosition?: number | null;
  isPumpFun?: boolean;
  isTradeable?: boolean;
  canBuy?: boolean;
  canSell?: boolean;
  source?: string;
}

// Trade execution result
export interface LiveTradeResult {
  success: boolean;
  positionId?: string;
  txHash?: string;
  entryPrice?: number;
  tokenAmount?: number;
  solSpent?: number;
  error?: string;
  source?: 'trading-engine' | 'edge-function';
}

// Orchestrator state - executedTokens moved to ref for stable closure access
interface OrchestratorState {
  isExecuting: boolean;
  currentToken: string | null;
  pendingQueue: ApprovedToken[];
  lastTradeTime: number;
}

// Trade execution constants - these are intentional safety limits, not user-configurable
const TRADE_COOLDOWN_MS = 2000; // Minimum 2 seconds between trades (system limit)
const MAX_CONCURRENT_TRADES = 1; // Execute one at a time for wallet safety

export function useLiveTradingOrchestrator() {
  const { wallet, signAndSendTransaction, refreshBalance, scheduleBalanceRefresh } = useWallet();
  const { openModal: openWalletModal } = useWalletModal();
  const tradingEngine = useTradingEngine();
  const { snipeToken, exitPosition, createConfig } = tradingEngine;
  const { createPosition, fetchPositions, openPositions } = usePositions();
  const { settings } = useSniperSettings();
  const { toast } = useToast();
  const { canAfford, deductCreditsAsync, hasCredits: userHasCredits, isAdmin: isAdminUser } = useCredits();
  
  // CRITICAL: Persistent token state manager - survives restarts
  const {
    initialized: tokenStatesInitialized,
    canTradeToken,
    markTraded,
    markPending,
    markRejected,
  } = useTokenStateManager();

  const [state, setState] = useState<OrchestratorState>({
    isExecuting: false,
    currentToken: null,
    pendingQueue: [],
    lastTradeTime: 0,
  });

  const executingRef = useRef(false);
  const queueRef = useRef<ApprovedToken[]>([]);
  
  // CRITICAL: Use ref for executedTokens to prevent stale closure issues
  // This ensures deduplication works correctly across all callbacks
  const executedTokensRef = useRef<Set<string>>(new Set());
  
  // CRITICAL: Track active position addresses from database to prevent duplicate trades
  // This persists across sessions unlike executedTokensRef which is session-only
  const activePositionAddressesRef = useRef<Set<string>>(new Set());
  
  // Keep activePositionAddressesRef synced with database positions
  useEffect(() => {
    const addresses = new Set(openPositions.map(p => p.token_address.toLowerCase()));
    activePositionAddressesRef.current = addresses;
    console.log(`[Orchestrator] Synced ${addresses.size} active position addresses for deduplication`);
  }, [openPositions]);


  /**
   * Validate prerequisites for live trading
   */
  const validatePrerequisites = useCallback((): { valid: boolean; error?: string } => {
    // Check wallet connection
    if (!wallet.isConnected || wallet.network !== 'solana' || !wallet.address) {
      return { valid: false, error: 'Solana wallet not connected' };
    }

    // Check wallet balance
    const balanceNum = parseFloat(wallet.balance || '0');
    const tradeAmount = settings?.trade_amount || 0.1;
    
    if (balanceNum < tradeAmount + 0.01) { // +0.01 for fees
      return { valid: false, error: `Insufficient balance: ${balanceNum.toFixed(4)} SOL < ${(tradeAmount + 0.01).toFixed(4)} SOL` };
    }

    // Check settings
    if (!settings) {
      return { valid: false, error: 'Trading settings not loaded' };
    }

    // Check credit balance (admins bypass)
    if (!isAdminUser && !userHasCredits) {
      return { valid: false, error: 'Insufficient credits — purchase more to trade' };
    }

    return { valid: true };
  }, [wallet, settings]);

  /**
   * Execute a single trade with the trading engine
   */
  const executeSingleTrade = useCallback(async (
    token: ApprovedToken,
    settings: SniperSettings
  ): Promise<LiveTradeResult> => {
    if (!wallet.address) {
      return { success: false, error: 'No wallet address' };
    }

    // CRITICAL: Pre-validate token is sellable before executing buy
    // Must be EXPLICITLY true — undefined means scanner couldn't confirm, so block
    // TOCTOU FIX: This is the FINAL check right before execution — captures any state
    // changes that occurred between gate evaluation and actual execution
    if (token.isTradeable !== true || token.canBuy !== true) {
      addBotLog({
        level: 'warning',
        category: 'trade',
        message: `⚠️ Skipped: ${token.symbol} (not tradeable)`,
        tokenSymbol: token.symbol,
        tokenAddress: token.address,
        details: `Token tradeability not confirmed — isTradeable: ${token.isTradeable}, canBuy: ${token.canBuy}. This may be a TOCTOU race where scanner data refreshed between gate evaluation and execution.`,
      });
      return { success: false, error: 'Token not tradeable (TOCTOU check)' };
    }

    // Prepare trade context for logging
    const buyerPosText = token.buyerPosition ? `#${token.buyerPosition}` : 'N/A';
    const safetyScoreText = token.riskScore != null ? `${100 - token.riskScore}/100` : 'N/A';
    const liquidityText = token.liquidity ? `$${token.liquidity.toLocaleString()}` : 'N/A';

    addBotLog({
      level: 'info',
      category: 'trade',
      message: `🚀 Executing BUY: ${token.name} (${token.symbol})`,
      tokenSymbol: token.symbol,
      tokenAddress: token.address,
      details: `🪙 Token: ${token.name} (${token.symbol})\n💧 Liquidity: ${liquidityText} | 👤 Buyer Pos: ${buyerPosText} | 🛡️ Safety: ${safetyScoreText}\n⚙️ User Settings: ${settings.trade_amount} SOL | Slippage: ${settings.slippage_tolerance || 15}% | Priority: ${settings.priority} | TP: ${settings.profit_take_percentage}% | SL: ${settings.stop_loss_percentage}%`,
    });

    try {
      // Create trading config from user settings - NO HARDCODED VALUES
      // Use user's slippage tolerance, default to 15% for meme coins
      const slippage = settings.slippage_tolerance 
        ? settings.slippage_tolerance / 100 
        : 0.15;
      
      // Priority fee based on user's priority setting (in SOL)
      const priorityFeeMap: Record<string, number> = {
        turbo: 0.005,
        fast: 0.002,
        normal: 0.001,
      };
      
      const config = createConfig({
        buyAmount: settings.trade_amount,
        slippage,
        priorityFee: priorityFeeMap[settings.priority] || 0.001,
        maxRetries: 2, // System limit for faster failure detection
        riskFilters: {
          checkRugPull: true,
          checkHoneypot: true,
          checkMintAuthority: true,
          checkFreezeAuthority: true,
          // These should ideally come from admin settings, using sensible defaults
          maxOwnershipPercent: 50, // Allow higher ownership for new tokens
          minHolders: 5, // Allow tokens with fewer holders
        },
        // Pass user's TP/SL settings for position persistence
        profitTakePercent: settings.profit_take_percentage,
        stopLossPercent: settings.stop_loss_percentage,
      });

      // Execute via 3-stage trading engine
      // CRITICAL: MANDATORY sell simulation before every buy — no exceptions
      // This replaces the old optional re-check and ensures bidirectional route integrity
      addBotLog({
        level: 'info',
        category: 'trade',
        message: `🔄 Mandatory sell simulation: ${token.symbol}`,
        tokenSymbol: token.symbol,
        tokenAddress: token.address,
        details: 'Verifying bidirectional route (buy + sell) before execution...',
      });

      const sellVerification = await verifySellRoute(token.address);
      
      const hasValidRoute = token.isTradeable === true && 
                            token.canBuy === true &&
                            sellVerification.canSell;
      
      if (!hasValidRoute) {
        const failReason = !sellVerification.canSell 
          ? `Sell route failed: ${sellVerification.error}` 
          : `isTradeable: ${token.isTradeable}, canBuy: ${token.canBuy}`;
        
        addBotLog({
          level: 'warning',
          category: 'trade',
          message: `🚫 Route not confirmed: ${token.symbol}`,
          tokenSymbol: token.symbol,
          tokenAddress: token.address,
          details: `${failReason} — bidirectional validation required`,
        });
        return { success: false, error: failReason };
      }

      addBotLog({
        level: 'success',
        category: 'trade',
        message: `✅ Sell route confirmed (${sellVerification.source}): ${token.symbol}`,
        tokenSymbol: token.symbol,
        tokenAddress: token.address,
      });
      
      // Deduct credits BEFORE executing trade (admins bypass via hook)
      try {
        await deductCreditsAsync({ actionType: 'auto_execution', referenceId: token.address });
      } catch (creditErr: any) {
        return { success: false, error: creditErr.message || 'Credit deduction failed' };
      }

      const result = await snipeToken(
        token.address,
        wallet.address,
        signAndSendTransaction,
        config,
        {
          symbol: token.symbol,
          name: token.name,
          liquidity: token.liquidity,
          priceUsd: token.priceUsd,
          buyerPosition: token.buyerPosition ?? undefined,
          isPumpFun: token.isPumpFun,
          source: token.source,
          hasJupiterRoute: true, // Guaranteed true by the check above
        }
      );

      if (!result) {
        return { success: false, error: 'Trade engine returned null' };
      }

      if (result.status !== 'SUCCESS') {
        return { 
          success: false, 
          error: result.error || `Trade failed: ${result.status}`,
          source: 'trading-engine',
        };
      }

      // CRITICAL: Persist position to database
      const position = result.position;
      if (position) {
        try {
          // PRIORITY: Use scanner token metadata (from pool scan) FIRST
          // This ensures position names match what user saw during discovery
          // Only fall back to trading engine metadata if scanner data is unavailable/placeholder
          // Use the unified isPlaceholderText from formatters for consistent detection
          
          // Scanner data (token.symbol/name) is from pool discovery - most reliable
          // Trading engine data (position.tokenSymbol/Name) may be from DexScreener enrichment
          const finalSymbol = !isPlaceholderText(token.symbol) ? token.symbol : 
            (!isPlaceholderText(position.tokenSymbol) ? position.tokenSymbol : token.symbol);
          const finalName = !isPlaceholderText(token.name) ? token.name : 
            (!isPlaceholderText(position.tokenName) ? position.tokenName : token.name);
          
          const savedPosition = await createPosition(
            token.address,
            finalSymbol,
            finalName,
            'solana',
            position.entryPrice,
            position.tokenAmount,
            settings.profit_take_percentage,
            settings.stop_loss_percentage
          );

          // Log comprehensive trade details with liquidity, safety, position info
          const entryValueUsd = position.entryPrice * position.tokenAmount;
          const buyerPosTextSuccess = token.buyerPosition ? `#${token.buyerPosition}` : 'N/A';
          const safetyScoreTextSuccess = token.riskScore != null ? `${100 - token.riskScore}/100` : 'N/A';
          const liquidityTextSuccess = token.liquidity ? `$${token.liquidity.toLocaleString()}` : 'N/A';
          const txHashFull = position.entryTxHash || '';
          
          addBotLog({
            level: 'success',
            category: 'trade',
            message: `✅ BUY FILLED: ${finalName} (${finalSymbol})`,
            tokenSymbol: finalSymbol,
            tokenAddress: token.address,
            details: `🪙 Token: ${finalName} (${finalSymbol})\n💧 Liquidity: ${liquidityTextSuccess} | 👤 Buyer Pos: ${buyerPosTextSuccess} | 🛡️ Safety: ${safetyScoreTextSuccess}\nEntry: $${position.entryPrice.toFixed(8)} | Tokens: ${position.tokenAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })} | Value: $${entryValueUsd.toFixed(4)} | SOL: ${position.solSpent.toFixed(4)}\n🔗 TX: ${txHashFull}`,
          });

          // ==========================================
          // POST-BUY: Dual-RPC Delta Validation
          // ==========================================
          if (position.entryTxHash) {
            try {
              addBotLog({
                level: 'info',
                category: 'trade',
                message: `🔍 Validating transaction: ${finalSymbol}`,
                tokenSymbol: finalSymbol,
                tokenAddress: token.address,
                details: 'Running dual-RPC delta validation...',
              });

              const deltaResult = await parseSolDelta({
                signature: position.entryTxHash,
                walletAddress: wallet.address,
                tradeType: 'buy',
                expectedAmount: position.solSpent,
              });

              if (deltaResult.isCorrupted) {
                addBotLog({
                  level: 'warning',
                  category: 'trade',
                  message: `⚠️ TX Validation Warning: ${finalSymbol}`,
                  tokenSymbol: finalSymbol,
                  tokenAddress: token.address,
                  details: `Reason: ${deltaResult.corruptionReason}\nActual SOL spent: ${deltaResult.solSpent.toFixed(6)}`,
                });
              } else {
                addBotLog({
                  level: 'success',
                  category: 'trade',
                  message: `✓ TX Validated: ${finalSymbol}`,
                  tokenSymbol: finalSymbol,
                  tokenAddress: token.address,
                  details: `SOL spent: ${deltaResult.solSpent.toFixed(6)} | Fee: ${deltaResult.fee.toFixed(6)}`,
                });
              }
            } catch (deltaError) {
              console.error('[Orchestrator] Delta validation error:', deltaError);
            }
          }

          // ==========================================
          // POST-BUY: Liquidity Revalidation
          // ==========================================
          try {
            addBotLog({
              level: 'info',
              category: 'trade',
              message: `💧 Post-buy liquidity check: ${finalSymbol}`,
              tokenSymbol: finalSymbol,
              tokenAddress: token.address,
              details: 'Verifying liquidity stability after buy...',
            });

            const postBuyLiquidity = await quickLiquidityCheck(token.address, token.liquidity);
            
            if (!postBuyLiquidity.stable) {
              addBotLog({
                level: 'warning',
                category: 'trade',
                message: `⚠️ Liquidity dropped post-buy: ${finalSymbol}`,
                tokenSymbol: finalSymbol,
                tokenAddress: token.address,
                details: `Drop: ${postBuyLiquidity.liquidityDropPercent.toFixed(1)}% | ${postBuyLiquidity.blockReason || 'Monitor closely'}`,
              });
            } else {
              addBotLog({
                level: 'success',
                category: 'trade',
                message: `✓ Liquidity stable: ${finalSymbol}`,
                tokenSymbol: finalSymbol,
                tokenAddress: token.address,
                details: `Current liquidity: $${postBuyLiquidity.snapshots[0]?.liquidityUsd?.toFixed(0) || 'N/A'}`,
              });
            }
          } catch (liqError) {
            console.error('[Orchestrator] Post-buy liquidity check error:', liqError);
          }

          // ==========================================
          // CRITICAL: Log BUY to trade_history via confirm-transaction
          // This ensures buyer_position, liquidity, risk_score are recorded
          // ==========================================
          if (position.entryTxHash && savedPosition?.id) {
            try {
              await supabase.functions.invoke('confirm-transaction', {
                body: {
                  signature: position.entryTxHash,
                  positionId: savedPosition.id,
                  action: 'buy',
                  walletAddress: wallet.address,
                  solSpent: position.solSpent,
                  tokenAddress: token.address,
                  tokenSymbol: finalSymbol,
                  tokenName: finalName,
                  amount: position.tokenAmount,
                  // Pass all discovery metadata
                  buyerPosition: token.buyerPosition ?? undefined,
                  liquidity: token.liquidity ?? undefined,
                  riskScore: token.riskScore ?? undefined,
                  entryPrice: position.entryPrice,
                  slippage: settings.slippage_tolerance || 15,
                },
              });
              console.log(`[Orchestrator] BUY logged to trade_history: ${finalSymbol} buyer#=${token.buyerPosition || 'N/A'}`);
            } catch (confirmErr) {
              console.warn('[Orchestrator] confirm-transaction failed (non-blocking):', confirmErr);
            }
          }

          // ==========================================
          // UPGRADE 5: POST-BUY EMERGENCY MONITOR
          // ==========================================
          // Start 60-second monitoring with checkpoints at +15s and +45s
          startPostBuyMonitor({
            tokenAddress: token.address,
            tokenSymbol: finalSymbol,
            positionId: savedPosition?.id,
            entryLiquidityUsd: token.liquidity || 0,
            tokenAmount: position.tokenAmount,
            onEmergencyExit: async (reason: string) => {
              addBotLog({
                level: 'error',
                category: 'trade',
                message: `🚨 Emergency auto-exit triggered: ${finalSymbol}`,
                tokenSymbol: finalSymbol,
                tokenAddress: token.address,
                details: `Reason: ${reason}\nAttempting immediate sell via Jupiter...`,
              });
              
              try {
                // CRITICAL FIX: Actually attempt to SELL the token before closing position
                // Previously only marked as closed without executing sell
                if (savedPosition?.id && wallet.address) {
                  addBotLog({
                    level: 'warning',
                    category: 'trade',
                    message: `🔄 Executing emergency sell: ${finalSymbol}`,
                    tokenSymbol: finalSymbol,
                    tokenAddress: token.address,
                    details: `Attempting Jupiter swap to exit position...`,
                  });
                  
                  try {
                    const exitResult = await exitPosition(
                      token.address,
                      position.tokenAmount,
                      wallet.address,
                      signAndSendTransaction,
                      createConfig({ buyAmount: 0, slippage: 0.25, priorityFee: 0.005 })
                    );
                    
                    if (exitResult?.success && exitResult.txHash) {
                      // Confirm the sell transaction
                      await supabase.functions.invoke('confirm-transaction', {
                        body: {
                          signature: exitResult.txHash,
                          positionId: savedPosition.id,
                          action: 'sell',
                          walletAddress: wallet.address,
                          tokenAddress: token.address,
                          tokenSymbol: finalSymbol,
                          tokenName: finalName,
                        },
                      });
                      
                      addBotLog({
                        level: 'success',
                        category: 'trade',
                        message: `✅ Emergency sell executed: ${finalSymbol}`,
                        tokenSymbol: finalSymbol,
                        tokenAddress: token.address,
                        details: `TX: ${exitResult.txHash}`,
                      });
                      
                      scheduleBalanceRefresh();
                      fetchPositions();
                    } else {
                      throw new Error(exitResult?.error || 'Exit returned non-success');
                    }
                  } catch (sellError) {
                    console.error('[Orchestrator] Emergency sell failed, force-closing:', sellError);
                    // Sell failed - force close position to prevent stuck state
                    await supabase
                      .from('positions')
                      .update({ 
                        status: 'closed', 
                        exit_reason: `EMERGENCY_SELL_FAILED: ${reason}`,
                        closed_at: new Date().toISOString(),
                      })
                      .eq('id', savedPosition.id);
                    
                    addBotLog({
                      level: 'error',
                      category: 'trade',
                      message: `❌ Emergency sell failed: ${finalSymbol}`,
                      tokenSymbol: finalSymbol,
                      tokenAddress: token.address,
                      details: `Sell failed: ${sellError instanceof Error ? sellError.message : 'unknown'}. Position force-closed.`,
                    });
                  }
                }
                
                // Log to risk_check_logs for audit trail
                const { data: { session: authSession } } = await supabase.auth.getSession();
                if (authSession) {
                  await supabase.from('risk_check_logs').insert({
                    token_address: token.address,
                    token_symbol: finalSymbol,
                    user_id: authSession.user.id,
                    risk_score: 0,
                    passed_checks: false,
                    rejection_reasons: [`POST_BUY_EMERGENCY: ${reason}`],
                    metadata: { type: 'POST_BUY_EMERGENCY_EXIT' } as any,
                  });
                }
              } catch (exitError) {
                console.error('[Orchestrator] Emergency exit error:', exitError);
              }
            },
          });

          return {
            success: true,
            positionId: savedPosition?.id,
            txHash: position.entryTxHash,
            entryPrice: position.entryPrice,
            tokenAmount: position.tokenAmount,
            solSpent: position.solSpent,
            source: 'trading-engine',
          };
        } catch (dbError) {
          console.error('[Orchestrator] Failed to save position:', dbError);
          // Trade succeeded but DB failed - still return success
          return {
            success: true,
            txHash: position.entryTxHash,
            entryPrice: position.entryPrice,
            tokenAmount: position.tokenAmount,
            solSpent: position.solSpent,
            error: 'Position save failed - check manually',
            source: 'trading-engine',
          };
        }
      }

      return { success: true, source: 'trading-engine' };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const buyerPosFail = token.buyerPosition ? `#${token.buyerPosition}` : 'N/A';
      const safetyFail = token.riskScore != null ? `${100 - token.riskScore}/100` : 'N/A';
      const liqFail = token.liquidity ? `$${token.liquidity.toLocaleString()}` : 'N/A';
      
      addBotLog({
        level: 'error',
        category: 'trade',
        message: `❌ BUY FAILED: ${token.name} (${token.symbol})`,
        tokenSymbol: token.symbol,
        tokenAddress: token.address,
        details: `🪙 Token: ${token.name} (${token.symbol})\n💧 Liquidity: ${liqFail} | 👤 Buyer Pos: ${buyerPosFail} | 🛡️ Safety: ${safetyFail}\n❗ Reason: ${errorMessage}\n⚙️ Attempted: ${settings.trade_amount} SOL | Slippage: ${settings.slippage_tolerance || 15}% | TP: ${settings.profit_take_percentage}% | SL: ${settings.stop_loss_percentage}%\n📍 Token: ${token.address}`,
      });

      return { success: false, error: errorMessage, source: 'trading-engine' };
    }
  }, [wallet.address, signAndSendTransaction, snipeToken, createPosition, createConfig]);

  /**
   * Process the pending trade queue
   */
  const processQueue = useCallback(async () => {
    if (executingRef.current || queueRef.current.length === 0) {
      return;
    }

    const prerequisites = validatePrerequisites();
    if (!prerequisites.valid) {
      console.log('[Orchestrator] Prerequisites not met:', prerequisites.error);
      
      // If wallet not connected, prompt to connect
      if (prerequisites.error?.includes('wallet')) {
        openWalletModal();
      }
      return;
    }

    executingRef.current = true;
    
    while (queueRef.current.length > 0) {
      const token = queueRef.current.shift();
      if (!token) break;

      const tokenAddrLower = token.address.toLowerCase();
      
      // Skip if already executed - use ref for stable closure access
      if (executedTokensRef.current.has(token.address)) {
        continue;
      }
      
      // EXECUTION GUARD: Auto-blacklist check
      if (isAutoBlacklisted(token.address)) {
        addBotLog({
          level: 'warning',
          category: 'trade',
          message: `🚫 Auto-blacklisted: ${token.symbol}`,
          tokenSymbol: token.symbol,
          tokenAddress: token.address,
          details: 'Token blocked after 3+ consecutive failed swap attempts',
        });
        executedTokensRef.current.add(token.address);
        continue;
      }
      
      // EXECUTION GUARD: Suspicious token name detection
      const scamCheck = isScamTokenName(token.name, token.symbol);
      if (scamCheck.suspicious) {
        addBotLog({
          level: 'warning',
          category: 'trade',
          message: `🚫 Suspicious name blocked: ${token.symbol}`,
          tokenSymbol: token.symbol,
          tokenAddress: token.address,
          details: scamCheck.reason || 'Token name matches known scam patterns',
        });
        executedTokensRef.current.add(token.address);
        continue;
      }

      // EXECUTION GUARD: Token cooldown lock
      if (!canExecuteToken(token.address)) {
        addBotLog({
          level: 'info',
          category: 'trade',
          message: `⏳ Cooldown active: ${token.symbol} — skipped`,
          tokenSymbol: token.symbol,
          tokenAddress: token.address,
        });
        continue;
      }
      
      // EXECUTION GUARD: Idempotency — prevent concurrent execution of same token
      if (!acquireExecutionLock(token.address)) {
        addBotLog({
          level: 'warning',
          category: 'trade',
          message: `⏭️ Already executing: ${token.symbol}`,
          tokenSymbol: token.symbol,
          tokenAddress: token.address,
        });
        continue;
      }
      
      // CRITICAL: Skip if token already has an active position in database
      // This prevents duplicate buys across sessions
      if (activePositionAddressesRef.current.has(tokenAddrLower)) {
        addBotLog({
          level: 'warning',
          category: 'trade',
          message: `⏭️ Skipped: ${token.symbol} (already in active positions)`,
          tokenSymbol: token.symbol,
          tokenAddress: token.address,
          details: 'Token already has an open position - skipping to avoid duplicate buy',
        });
        continue;
      }
      
      // CRITICAL: Check persistent token state - prevents duplicate trades across restarts
      if (tokenStatesInitialized && !canTradeToken(token.address)) {
        addBotLog({
          level: 'warning',
          category: 'trade',
          message: `⏭️ Skipped: ${token.symbol} (state blocked)`,
          tokenSymbol: token.symbol,
          tokenAddress: token.address,
          details: 'Token is TRADED, REJECTED, or PENDING - cannot execute',
        });
        continue;
      }
      
      // CRITICAL SAFEGUARD: Direct database check for PENDING state
      // This catches race conditions where state cache might be stale
      try {
        const { data: stateRecord } = await supabase
          .from('token_processing_states')
          .select('state, pending_reason')
          .eq('token_address', tokenAddrLower)
          .maybeSingle();
        
        if (stateRecord && (stateRecord.state === 'PENDING' || stateRecord.state === 'TRADED' || stateRecord.state === 'REJECTED')) {
          addBotLog({
            level: 'warning',
            category: 'trade',
            message: `⏭️ Skipped: ${token.symbol} (DB state: ${stateRecord.state})`,
            tokenSymbol: token.symbol,
            tokenAddress: token.address,
            details: stateRecord.pending_reason || `Token state is ${stateRecord.state} - blocked by database check`,
          });
          executedTokensRef.current.add(token.address);
          continue;
        }
      } catch (dbCheckError) {
        console.error('[Orchestrator] DB state check failed:', dbCheckError);
        // On error, proceed cautiously - the cache check should have caught it
      }

      // Enforce cooldown
      const timeSinceLastTrade = Date.now() - state.lastTradeTime;
      if (timeSinceLastTrade < TRADE_COOLDOWN_MS) {
        await new Promise(r => setTimeout(r, TRADE_COOLDOWN_MS - timeSinceLastTrade));
      }

      // TOCTOU FIX: Route validation uses a snapshot — if token was already validated
      // at queue time via the pre-execution gate, we trust that result and only do
      // a lightweight re-check here to catch liquidity pulls between gate and execution
      addBotLog({
        level: 'info',
        category: 'trade',
        message: `🔍 Re-validating swap route: ${token.symbol}`,
        tokenSymbol: token.symbol,
        tokenAddress: token.address,
        details: 'Lightweight re-check (TOCTOU protection)...',
      });

      const routeValidation = await validateSwapRoute(token.address, {
        timeoutMs: 8000,
        checkBothParallel: true,
        checkIndexing: true,
      });

      // CRITICAL: Block tokens awaiting indexing - too new to trade safely
      if (routeValidation.isAwaitingIndexing) {
        addBotLog({
          level: 'warning',
          category: 'trade',
          message: `⏳ Awaiting indexing: ${token.symbol} - skipped`,
          tokenSymbol: token.symbol,
          tokenAddress: token.address,
          details: 'Token is too new and not yet indexed on DEX aggregators.\nWill retry once indexing completes.',
        });
        
        // Mark as PENDING for retry later when indexed
        await markPending(token.address, 'awaiting_indexing');
        executedTokensRef.current.add(token.address); // Prevent immediate retry
        continue;
      }

      if (!routeValidation.hasRoute) {
        addBotLog({
          level: 'warning',
          category: 'trade',
          message: `🚫 No route: ${token.symbol} - skipped`,
          tokenSymbol: token.symbol,
          tokenAddress: token.address,
          details: `Jupiter: ${routeValidation.jupiter ? '✓' : '✗'} | Raydium: ${routeValidation.raydium ? '✓' : '✗'}\n${routeValidation.error || 'No active swap route on either DEX'}`,
        });
        
        // Mark as PENDING for retry later
        await markPending(token.address, 'no_route');
        executedTokensRef.current.add(token.address); // Prevent immediate retry
        continue;
      }

      addBotLog({
        level: 'success',
        category: 'trade',
        message: `✓ Route found: ${token.symbol} via ${routeValidation.source}`,
        tokenSymbol: token.symbol,
        tokenAddress: token.address,
        details: `Jupiter: ${routeValidation.jupiter ? '✓' : '✗'} | Raydium: ${routeValidation.raydium ? '✓' : '✗'} | Indexed: ✓`,
      });

      setState(prev => ({
        ...prev,
        isExecuting: true,
        currentToken: token.address,
      }));

      // Record execution attempt for cooldown tracking
      recordExecutionAttempt(token.address);

      const result = await executeSingleTrade(token, settings!);

      // ALWAYS release execution lock after trade completes
      releaseExecutionLock(token.address);

      // Mark as executed regardless of result - use ref for immediate effect
      executedTokensRef.current.add(token.address);
      setState(prev => ({
        ...prev,
        lastTradeTime: Date.now(),
      }));

      if (result.success) {
        // CRITICAL: Mark token as TRADED in persistent state (survives restarts)
        await markTraded(token.address, result.txHash, result.positionId);
        
        toast({
          title: `🎯 Trade Executed: ${token.symbol}`,
          description: `Entry: $${result.entryPrice?.toFixed(8)} | TX: ${result.txHash?.slice(0, 8)}...`,
        });
        
        // CRITICAL: Multi-stage balance refresh for proper UI sync after transaction
        scheduleBalanceRefresh();
        fetchPositions();
      } else {
        // EXECUTION GUARD: Track failure and auto-blacklist after N failures
        const failResult = recordSwapFailure(token.address, result.error || 'unknown');
        
        if (failResult.blacklisted) {
          addBotLog({
            level: 'error',
            category: 'trade',
            message: `🚫 Auto-blacklisted: ${token.symbol}`,
            tokenSymbol: token.symbol,
            tokenAddress: token.address,
            details: `Blacklisted after ${failResult.failureCount} consecutive failures. Token will not be retried.`,
          });
          await markRejected(token.address, `auto_blacklisted_${failResult.failureCount}_failures`);
        } else {
          // Check if failure is due to liquidity/route issue - mark as PENDING for retry
          const isLiquidityIssue = result.error?.toLowerCase().includes('no route') || 
            result.error?.toLowerCase().includes('no liquidity') ||
            result.error?.toLowerCase().includes('insufficient liquidity');
          
          if (isLiquidityIssue) {
            await markPending(token.address, 'no_route');
          } else {
            await markRejected(token.address, result.error?.slice(0, 100) || 'unknown_error');
          }
        }
        
        toast({
          title: `Trade Failed: ${token.symbol}`,
          description: result.error || 'Unknown error',
          variant: 'destructive',
        });
      }
    }

    setState(prev => ({
      ...prev,
      isExecuting: false,
      currentToken: null,
    }));
    
    executingRef.current = false;
  }, [validatePrerequisites, state.lastTradeTime, settings, executeSingleTrade, toast, scheduleBalanceRefresh, fetchPositions, openWalletModal, tokenStatesInitialized, canTradeToken, markTraded, markPending, markRejected]);

  /**
   * Queue approved tokens for execution
   */
  const queueTokens = useCallback((tokens: ApprovedToken[]) => {
    // Filter out already executed, queued, OR having active positions
    const newTokens = tokens.filter(t => {
      const addrLower = t.address.toLowerCase();
      
      // Skip if already executed this session
      if (executedTokensRef.current.has(t.address)) return false;
      
      // Skip if already in queue
      if (queueRef.current.some(q => q.address === t.address)) return false;
      
      // CRITICAL: Skip if token already has an active position in database
      if (activePositionAddressesRef.current.has(addrLower)) {
        console.log(`[Orchestrator] Filtered out ${t.symbol} - already in active positions`);
        return false;
      }
      
      // CRITICAL: Check persistent token state - prevents duplicate trades across restarts
      if (tokenStatesInitialized && !canTradeToken(t.address)) {
        console.log(`[Orchestrator] Filtered out ${t.symbol} - persistent state: TRADED/REJECTED`);
        return false;
      }
      
      // EXECUTION GUARD: Skip auto-blacklisted tokens
      if (isAutoBlacklisted(t.address)) {
        console.log(`[Orchestrator] Filtered out ${t.symbol} - auto-blacklisted`);
        return false;
      }
      
      // EXECUTION GUARD: Skip tokens in cooldown
      if (!canExecuteToken(t.address)) {
        console.log(`[Orchestrator] Filtered out ${t.symbol} - cooldown active`);
        return false;
      }
      
      return true;
    });

    if (newTokens.length === 0) return;

    queueRef.current.push(...newTokens);
    setState(prev => ({
      ...prev,
      pendingQueue: [...queueRef.current],
    }));

    addBotLog({
      level: 'info',
      category: 'evaluate',
      message: `Queued ${newTokens.length} tokens for execution`,
      details: newTokens.map(t => t.symbol).join(', '),
    });

    // Start processing
    processQueue();
  }, [processQueue, tokenStatesInitialized, canTradeToken]);

  /**
   * Execute immediate trade (bypass queue)
   */
  const executeImmediate = useCallback(async (token: ApprovedToken): Promise<LiveTradeResult> => {
    const prerequisites = validatePrerequisites();
    if (!prerequisites.valid) {
      if (prerequisites.error?.includes('wallet')) {
        openWalletModal();
      }
      return { success: false, error: prerequisites.error };
    }

    return executeSingleTrade(token, settings!);
  }, [validatePrerequisites, settings, executeSingleTrade, openWalletModal]);

  /**
   * Clear the execution queue
   */
  const clearQueue = useCallback(() => {
    queueRef.current = [];
    setState(prev => ({
      ...prev,
      pendingQueue: [],
    }));
  }, []);

  /**
   * Reset executed tokens (allow re-trading)
   */
  const resetExecutedTokens = useCallback(() => {
    executedTokensRef.current.clear();
  }, []);

  return {
    // State
    isExecuting: state.isExecuting,
    currentToken: state.currentToken,
    queueLength: queueRef.current.length,
    executedCount: executedTokensRef.current.size,
    engineStatus: tradingEngine.status,

    // Actions
    queueTokens,
    executeImmediate,
    clearQueue,
    resetExecutedTokens,

    // Validation
    validatePrerequisites,
  };
}
