/**
 * Bot Evaluation Loop Hook
 * 
 * Extracted from Scanner.tsx - handles the continuous bot evaluation cycle
 * including token filtering, demo/live trade execution, and state management.
 */

import { useCallback, useEffect, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { addBotLog } from '@/components/scanner/BotActivityLog';
import type { TokenData } from '@/hooks/useAutoSniper';
import type { ScannedToken } from '@/hooks/useTokenScanner';

interface BotEvalDeps {
  // State
  tokens: ScannedToken[];
  isBotActive: boolean;
  isPaused: boolean;
  autoEntryEnabled: boolean;
  isDemo: boolean;
  settings: any;
  openPositionsCount: number;
  // Wallet
  walletConnected: boolean;
  walletNetwork: string | null;
  walletAddress: string | null;
  walletBalance: string | null;
  // Token state manager (live only)
  tokenStatesInitialized: boolean;
  canTradeToken: (addr: string) => boolean;
  cleanupExpiredPending: () => void;
  registerTokensBatch: (tokens: any[]) => Promise<void>;
  markTraded: (addr: string, txHash?: string) => Promise<void>;
  markPending: (addr: string, reason: string) => Promise<void>;
  markRejected: (addr: string, reason: string) => Promise<void>;
  // Trade execution
  evaluateTokens: (data: TokenData[], manual?: boolean, settings?: any, opts?: any) => Promise<any>;
  snipeToken: (addr: string, wallet: string, sign: any, opts: any, meta?: any) => Promise<any>;
  signAndSendTransaction: (tx: any) => Promise<any>;
  // Position management
  fetchPositions: (force?: boolean) => Promise<void>;
  refreshBalance: () => void;
  recordTrade: (success: boolean) => void;
  openPositions: any[];
  // Demo
  demoBalance: number;
  solPrice: number;
  deductBalance: (amount: number) => void;
  addBalance: (amount: number) => void;
  addDemoPosition: (pos: any) => any;
  updateDemoPosition: (id: string, updates: any) => void;
  closeDemoPosition: (id: string, price: number, reason: string) => void;
  // UI
  openWalletModal: () => void;
  SOL_MINT: string;
}

export function useBotEvaluationLoop(deps: BotEvalDeps) {
  const { toast } = useToast();
  
  const processedTokensRef = useRef<Set<string>>(new Set());
  const tradedTokensRef = useRef<Set<string>>(new Set());
  const liveTradeInFlightRef = useRef(false);
  const evaluationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Clear processed tokens periodically
  useEffect(() => {
    if (!deps.isBotActive || deps.isPaused) return;
    const cleanupInterval = setInterval(() => {
      const oldSize = processedTokensRef.current.size;
      if (oldSize > 100) {
        const arr = Array.from(processedTokensRef.current);
        processedTokensRef.current = new Set(arr.slice(-50));
        addBotLog({ level: 'info', category: 'system', message: `Cleared ${oldSize - 50} old tokens from cache` });
      }
    }, 120000);
    return () => clearInterval(cleanupInterval);
  }, [deps.isBotActive, deps.isPaused]);

  const runBotEvaluation = useCallback(async () => {
    if (!deps.isBotActive || deps.tokens.length === 0 || !deps.settings) return;
    if (!deps.isDemo && !deps.tokenStatesInitialized) return;
    if (!deps.autoEntryEnabled) return;
    if (!deps.isDemo) deps.cleanupExpiredPending();

    const activeAddrs = new Set(deps.openPositions.map(p => p.token_address.toLowerCase()));

    const unseenTokens = deps.tokens.filter(t => {
      if (processedTokensRef.current.has(t.address)) return false;
      if (tradedTokensRef.current.has(t.address)) return false;
      if (activeAddrs.has(t.address.toLowerCase())) return false;
      if (!deps.isDemo && !deps.canTradeToken(t.address)) return false;
      return true;
    });

    if (unseenTokens.length === 0) return;

    const blacklist = new Set(deps.settings.token_blacklist || []);
    const sellRouteEnabled = deps.settings.validation_rule_toggles?.EXECUTABLE_SELL !== false;
    const candidates = unseenTokens.filter(t => {
      if (!t.address || blacklist.has(t.address)) return false;
      if (t.symbol?.toUpperCase() === 'SOL' && t.address !== deps.SOL_MINT) return false;
      if (sellRouteEnabled && t.canSell === false) {
        if (!deps.isDemo) deps.markRejected(t.address, 'not_sellable');
        return false;
      }
      if (tradedTokensRef.current.has(t.address)) return false;
      if (activeAddrs.has(t.address.toLowerCase())) return false;
      return true;
    });

    if (candidates.length === 0) return;

    if (!deps.isDemo && candidates.length > 0) {
      await deps.registerTokensBatch(candidates.map(t => ({
        address: t.address, symbol: t.symbol, name: t.name,
        source: t.source, liquidity: t.liquidity, riskScore: t.riskScore,
        buyerPosition: t.buyerPosition,
      })));
    }

    const batchSize = deps.isDemo ? 10 : 20;
    const batch = candidates.slice(0, batchSize);

    const tokenData: TokenData[] = batch.map(t => ({
      address: t.address, name: t.name, symbol: t.symbol, chain: t.chain,
      liquidity: t.liquidity, liquidityLocked: t.liquidityLocked,
      lockPercentage: t.lockPercentage, buyerPosition: t.buyerPosition,
      riskScore: t.riskScore, categories: [], priceUsd: t.priceUsd,
      isPumpFun: t.isPumpFun, isTradeable: t.isTradeable,
      canBuy: t.canBuy, canSell: t.canSell, source: t.source,
      safetyReasons: t.safetyReasons,
      poolCreatedAt: (t as any).poolCreatedAt || t.createdAt,
      freezeAuthority: t.freezeAuthority, mintAuthority: t.mintAuthority,
      holders: t.holders, holderCount: t.holders,
    }));

    // Demo mode
    if (deps.isDemo) {
      batch.forEach(t => processedTokensRef.current.add(t.address));
      const s = deps.settings;
      const targetPositions = s.target_buyer_positions || [1, 2, 3, 4, 5];

      const approvedToken = tokenData.find(t =>
        (t.buyerPosition === null || (t.buyerPosition && targetPositions.includes(t.buyerPosition))) &&
        t.riskScore < (s.max_risk_score || 70) &&
        t.liquidity >= (s.min_liquidity || 5) &&
        t.isTradeable !== false && t.canBuy !== false && t.canSell !== false
      );

      if (approvedToken && s.trade_amount && deps.demoBalance >= s.trade_amount) {
        tradedTokensRef.current.add(approvedToken.address);
        deps.deductBalance(s.trade_amount);
        const tradeAmountUsd = s.trade_amount * deps.solPrice;
        const entryPrice = approvedToken.priceUsd || 0.0001;
        const amount = tradeAmountUsd / entryPrice;

        const newPosition = deps.addDemoPosition({
          token_address: approvedToken.address, token_symbol: approvedToken.symbol,
          token_name: approvedToken.name, chain: approvedToken.chain,
          entry_price: entryPrice, current_price: entryPrice, amount,
          entry_value: tradeAmountUsd, current_value: tradeAmountUsd,
          profit_loss_percent: 0, profit_loss_value: 0,
          profit_take_percent: s.profit_take_percentage, stop_loss_percent: s.stop_loss_percentage,
          status: 'open', exit_reason: null, exit_price: null, exit_tx_id: null, closed_at: null,
        });

        addBotLog({
          level: 'success', category: 'trade',
          message: `Demo trade executed: ${approvedToken.symbol}`,
          tokenSymbol: approvedToken.symbol,
          details: `Entry: $${entryPrice.toFixed(6)} | Amount: ${s.trade_amount} SOL`,
        });
        toast({ title: '🎯 Demo Trade Executed!', description: `Bought ${approvedToken.symbol} at $${entryPrice.toFixed(6)}` });

        setTimeout(() => {
          const priceChange = (Math.random() - 0.3) * 0.5;
          const newPrice = entryPrice * (1 + priceChange);
          const newValue = amount * newPrice;
          const pnlPercent = priceChange * 100;
          const pnlValue = newValue - tradeAmountUsd;
          deps.updateDemoPosition(newPosition.id, {
            current_price: newPrice, current_value: newValue,
            profit_loss_percent: pnlPercent, profit_loss_value: pnlValue,
          });
          if (pnlPercent >= s.profit_take_percentage) {
            deps.closeDemoPosition(newPosition.id, newPrice, 'take_profit');
            deps.addBalance(s.trade_amount + (pnlValue / deps.solPrice));
            toast({ title: '💰 Take Profit Hit!', description: `Closed ${approvedToken.symbol} at +${pnlPercent.toFixed(1)}%` });
          } else if (pnlPercent <= -s.stop_loss_percentage) {
            deps.closeDemoPosition(newPosition.id, newPrice, 'stop_loss');
            deps.addBalance(s.trade_amount + (pnlValue / deps.solPrice));
            toast({ title: '🛑 Stop Loss Hit', description: `Closed ${approvedToken.symbol} at ${pnlPercent.toFixed(1)}%`, variant: 'destructive' });
          }
        }, 5000 + Math.random() * 10000);
      }
      return;
    }

    // Live mode
    if (!deps.walletConnected || deps.walletNetwork !== 'solana' || !deps.walletAddress) {
      addBotLog({ level: 'warning', category: 'trade', message: 'Connect wallet to enable live trading' });
      deps.openWalletModal();
      return;
    }

    const balanceSol = parseFloat(String(deps.walletBalance || '').replace(/[^\d.]/g, '')) || 0;
    const tradeAmountSol = deps.settings.trade_amount || 0;
    if (tradeAmountSol <= 0 || balanceSol < tradeAmountSol + 0.01) return;
    if (liveTradeInFlightRef.current) return;

    const evaluation = await deps.evaluateTokens(tokenData, false, undefined, { suppressOpportunityToast: true });
    if (!evaluation) return;

    batch.forEach(t => processedTokensRef.current.add(t.address));
    const approved = evaluation.decisions?.filter((d: any) => d.approved) || [];

    // Log decisions
    for (const decision of (evaluation.decisions || [])) {
      const steps = decision.reasons.slice(0, 4).join(' | ');
      if (decision.approved) {
        addBotLog({
          level: 'success', category: 'evaluate',
          message: `✅ ${decision.token.symbol} PASSED`,
          tokenSymbol: decision.token.symbol, tokenAddress: decision.token.address,
          details: steps,
        });
      } else {
        if (!deps.isDemo) deps.markRejected(decision.token.address, decision.reasons[0]?.slice(0, 100) || 'validation_failed');
        addBotLog({
          level: 'warning', category: 'evaluate',
          message: `❌ ${decision.token.symbol} REJECTED`,
          tokenSymbol: decision.token.symbol, tokenAddress: decision.token.address,
          details: steps,
        });
      }
    }

    if (approved.length === 0) return;

    liveTradeInFlightRef.current = true;
    try {
      const maxConcurrent = deps.settings.max_concurrent_trades || 3;
      const availableSlots = maxConcurrent - deps.openPositionsCount;
      if (availableSlots <= 0) return;

      for (const next of approved.slice(0, availableSlots)) {
        if (tradedTokensRef.current.has(next.token.address)) continue;
        tradedTokensRef.current.add(next.token.address);

        const priorityFeeMap: Record<string, number> = { turbo: 500000, fast: 200000, normal: 100000 };
        const priorityFee = priorityFeeMap[deps.settings.priority] || 100000;
        const slippagePct = next.tradeParams?.slippage ?? deps.settings.slippage_tolerance ?? 15;

        addBotLog({
          level: 'info', category: 'trade',
          message: `📝 Executing BUY: ${next.token.symbol}`,
          tokenSymbol: next.token.symbol, tokenAddress: next.token.address,
          details: `💰 Amount: ${tradeAmountSol} SOL | Slippage: ${slippagePct}%\n⚡ Priority: ${deps.settings.priority} | Fee: ${priorityFee / 1e9} SOL`,
        });

        const result = await deps.snipeToken(
          next.token.address, deps.walletAddress,
          (tx: any) => deps.signAndSendTransaction(tx),
          {
            buyAmount: tradeAmountSol, slippage: slippagePct / 100, priorityFee,
            minLiquidity: deps.settings.min_liquidity, maxRiskScore: deps.settings.max_risk_score ?? 70,
            skipRiskCheck: true, profitTakePercent: deps.settings.profit_take_percentage,
            stopLossPercent: deps.settings.stop_loss_percentage,
          },
          {
            symbol: next.token.symbol, name: next.token.name,
            liquidity: next.token.liquidity, priceUsd: next.token.priceUsd,
            buyerPosition: next.token.buyerPosition ?? undefined,
            riskScore: next.token.riskScore, isPumpFun: next.token.isPumpFun,
            source: next.token.source,
          }
        );

        if (result?.status === 'SUCCESS' && result.position) {
          await deps.markTraded(next.token.address, result.position.entryTxHash);
          addBotLog({
            level: 'success', category: 'trade',
            message: `✅ BUY FILLED: ${next.token.symbol}`,
            tokenSymbol: next.token.symbol, tokenAddress: next.token.address,
          });
          deps.recordTrade(true);
          await deps.fetchPositions();
          deps.refreshBalance();
          await new Promise(r => setTimeout(r, 500));
        } else {
          const failReason = result?.error || 'Trade failed';
          const isLiqIssue = failReason.toLowerCase().includes('no route') || failReason.toLowerCase().includes('no liquidity');
          if (isLiqIssue) {
            await deps.markPending(next.token.address, 'no_route');
          } else {
            await deps.markRejected(next.token.address, failReason.slice(0, 100));
          }
          deps.recordTrade(false);
          break;
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
    deps.tokens, deps.isBotActive, deps.autoEntryEnabled, deps.settings, deps.isDemo,
    deps.openPositionsCount, deps.walletConnected, deps.walletNetwork, deps.walletAddress,
    deps.walletBalance, deps.demoBalance, deps.solPrice, deps.evaluateTokens, deps.snipeToken,
    deps.recordTrade, deps.signAndSendTransaction, deps.refreshBalance, deps.fetchPositions,
    deps.deductBalance, deps.addBalance, deps.addDemoPosition, deps.updateDemoPosition,
    deps.closeDemoPosition, deps.tokenStatesInitialized, deps.canTradeToken,
    deps.cleanupExpiredPending, deps.registerTokensBatch, deps.markTraded, deps.markPending,
    deps.markRejected, deps.openPositions, deps.openWalletModal, deps.SOL_MINT, toast,
  ]);

  // Continuous evaluation loop
  useEffect(() => {
    if (!deps.isBotActive || deps.isPaused) {
      if (evaluationIntervalRef.current) {
        clearInterval(evaluationIntervalRef.current);
        evaluationIntervalRef.current = null;
      }
      return;
    }
    runBotEvaluation();
    const intervalMs = deps.isDemo ? 8000 : 10000;
    evaluationIntervalRef.current = setInterval(runBotEvaluation, intervalMs);
    return () => {
      if (evaluationIntervalRef.current) {
        clearInterval(evaluationIntervalRef.current);
        evaluationIntervalRef.current = null;
      }
    };
  }, [deps.isBotActive, deps.isPaused, deps.isDemo, runBotEvaluation]);

  return {
    processedTokensRef,
    tradedTokensRef,
    clearProcessedTokens: () => processedTokensRef.current.clear(),
    clearTradedTokens: () => tradedTokensRef.current.clear(),
    clearAll: () => {
      processedTokensRef.current.clear();
      tradedTokensRef.current.clear();
    },
  };
}
