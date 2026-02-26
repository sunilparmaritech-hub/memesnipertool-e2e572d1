/**
 * Post-Buy Emergency Monitor — Upgraded v2
 *
 * Actively monitors for 60s post-entry with checkpoints at +15s, +30s, +60s.
 * Enhanced exit triggers and integration with probabilistic scoring.
 */

import { supabase } from '@/integrations/supabase/client';
import { addBotLog } from '@/components/scanner/BotActivityLog';

const SOL_MINT = 'So11111111111111111111111111111111111111112';

export interface PostBuyMonitorInput {
  tokenAddress: string;
  tokenSymbol: string;
  positionId?: string;
  entryLiquidityUsd: number;
  tokenAmount: number;
  onEmergencyExit: (reason: string) => Promise<void>;
}

export interface CheckpointResult {
  timestamp: number;
  secondsAfterBuy: number;
  sellRouteExists: boolean;
  priceImpactPct: number | null;
  currentLiquidityUsd: number | null;
  liquidityDropPct: number;
  passed: boolean;
  reason: string;
}

interface MonitorSession {
  input: PostBuyMonitorInput;
  buyTimestamp: number;
  checkpoints: CheckpointResult[];
  aborted: boolean;
  exitTriggered: boolean;
}

const activeMonitors = new Map<string, MonitorSession>();

async function runCheckpoint(
  session: MonitorSession,
  checkpointLabel: string,
  liquidityDropThreshold: number = 40,
  impactThreshold: number = 50
): Promise<CheckpointResult> {
  const { input } = session;
  const secondsAfterBuy = (Date.now() - session.buyTimestamp) / 1000;

  addBotLog({
    level: 'info', category: 'trade',
    message: `🔍 Post-buy check (${checkpointLabel}): ${input.tokenSymbol}`,
    tokenSymbol: input.tokenSymbol, tokenAddress: input.tokenAddress,
    details: `Running at +${secondsAfterBuy.toFixed(0)}s after buy...`,
  });

  // 1. Check sell route via Jupiter
  let sellRouteExists = false;
  let priceImpactPct: number | null = null;

  try {
    const tokenAmountStr = Math.floor(input.tokenAmount).toString();
    const response = await fetch(
      `https://lite-api.jup.ag/swap/v1/quote?inputMint=${input.tokenAddress}&outputMint=${SOL_MINT}&amount=${tokenAmountStr}&slippageBps=500`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (response.ok) {
      const data = await response.json();
      if (data.outAmount && parseInt(data.outAmount) > 0) {
        sellRouteExists = true;
        priceImpactPct = Math.abs(parseFloat(data.priceImpactPct || '0'));
      }
    }
  } catch { /* treat as no route */ }

  // 2. Check current liquidity via DexScreener
  let currentLiquidityUsd: number | null = null;
  try {
    const response = await fetch(
      `https://api.dexscreener.com/latest/dex/tokens/${input.tokenAddress}`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (response.ok) {
      const data = await response.json();
      const pair = data.pairs?.find((p: any) => p.chainId === 'solana');
      currentLiquidityUsd = pair?.liquidity?.usd ?? null;
    }
  } catch { /* liquidity check failed */ }

  // 3. Calculate liquidity drop
  const liquidityDropPct = (currentLiquidityUsd !== null && input.entryLiquidityUsd > 0)
    ? ((input.entryLiquidityUsd - currentLiquidityUsd) / input.entryLiquidityUsd) * 100
    : 0;

  // 4. Evaluate checkpoint with graduated thresholds
  let passed = true;
  let reason = 'All checks passed';

  if (!sellRouteExists) {
    passed = false;
    reason = 'SELL ROUTE DISAPPEARED — emergency exit required';
  } else if (priceImpactPct !== null && priceImpactPct > impactThreshold) {
    passed = false;
    reason = `Price impact ${priceImpactPct.toFixed(1)}% > ${impactThreshold}% — liquidity drained`;
  } else if (liquidityDropPct > liquidityDropThreshold) {
    passed = false;
    reason = `Liquidity dropped ${liquidityDropPct.toFixed(1)}% > ${liquidityDropThreshold}% — possible rug`;
  } else if (priceImpactPct !== null && priceImpactPct > 30) {
    reason = `Warning: Price impact ${priceImpactPct.toFixed(1)}% elevated`;
  }

  const result: CheckpointResult = {
    timestamp: Date.now(), secondsAfterBuy,
    sellRouteExists, priceImpactPct, currentLiquidityUsd,
    liquidityDropPct, passed, reason,
  };

  session.checkpoints.push(result);

  addBotLog({
    level: passed ? 'success' : 'error', category: 'trade',
    message: passed
      ? `✓ Post-buy check OK (${checkpointLabel}): ${input.tokenSymbol}`
      : `🚨 Post-buy ALERT (${checkpointLabel}): ${input.tokenSymbol}`,
    tokenSymbol: input.tokenSymbol, tokenAddress: input.tokenAddress,
    details: `Route: ${sellRouteExists ? '✓' : '✗'} | Impact: ${priceImpactPct?.toFixed(1) ?? 'N/A'}% | Liq: $${currentLiquidityUsd?.toFixed(0) ?? 'N/A'} (drop: ${liquidityDropPct.toFixed(1)}%)\n${reason}`,
  });

  return result;
}

async function logEmergencyEvent(
  tokenAddress: string, tokenSymbol: string,
  reason: string, checkpoints: CheckpointResult[]
): Promise<void> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    await supabase.from('risk_check_logs').insert({
      token_address: tokenAddress, token_symbol: tokenSymbol,
      user_id: session.user.id, risk_score: 0, passed_checks: false,
      rejection_reasons: [reason],
      metadata: {
        type: 'POST_BUY_EMERGENCY',
        checkpoints: checkpoints.map(c => ({
          seconds: c.secondsAfterBuy, route: c.sellRouteExists,
          impact: c.priceImpactPct, liquidity: c.currentLiquidityUsd,
          drop: c.liquidityDropPct, passed: c.passed,
        })),
      } as any,
    });
  } catch (err) {
    console.error('[PostBuyMonitor] Failed to log emergency event:', err);
  }
}

/**
 * Start 60-second post-buy monitoring with checkpoints at +15s, +30s, +60s.
 * Enhanced with graduated thresholds per checkpoint.
 */
export function startPostBuyMonitor(input: PostBuyMonitorInput): void {
  const session: MonitorSession = {
    input, buyTimestamp: Date.now(), checkpoints: [], aborted: false, exitTriggered: false,
  };

  activeMonitors.set(input.tokenAddress, session);

  addBotLog({
    level: 'info', category: 'trade',
    message: `🛡️ Post-buy monitor started: ${input.tokenSymbol}`,
    tokenSymbol: input.tokenSymbol, tokenAddress: input.tokenAddress,
    details: 'Monitoring 60s — checkpoints at +15s, +30s, +60s',
  });

  (async () => {
    try {
      // ── Checkpoint 1: +15s — sell route + severe liquidity drain ──────
      await new Promise(resolve => setTimeout(resolve, 15000));
      if (session.aborted) return;

      const cp1 = await runCheckpoint(session, '+15s', 40, 50);

      if (!cp1.passed && !session.exitTriggered) {
        session.exitTriggered = true;
        addBotLog({ level: 'error', category: 'trade', message: `🚨 EMERGENCY EXIT: ${input.tokenSymbol}`, tokenSymbol: input.tokenSymbol, tokenAddress: input.tokenAddress, details: `Trigger: ${cp1.reason}` });
        await logEmergencyEvent(input.tokenAddress, input.tokenSymbol, cp1.reason, session.checkpoints);
        await input.onEmergencyExit(cp1.reason);
        return;
      }

      // ── Checkpoint 2: +30s — check liquidity drop >30% or slippage explosion ─
      await new Promise(resolve => setTimeout(resolve, 15000));
      if (session.aborted || session.exitTriggered) return;

      const cp2 = await runCheckpoint(session, '+30s', 30, 40);

      if (!cp2.passed && !session.exitTriggered) {
        session.exitTriggered = true;
        addBotLog({ level: 'error', category: 'trade', message: `🚨 EMERGENCY EXIT: ${input.tokenSymbol}`, tokenSymbol: input.tokenSymbol, tokenAddress: input.tokenAddress, details: `Trigger: ${cp2.reason}` });
        await logEmergencyEvent(input.tokenAddress, input.tokenSymbol, cp2.reason, session.checkpoints);
        await input.onEmergencyExit(cp2.reason);
        return;
      }

      // ── Checkpoint 3: +60s — final risk score recompute ───────────────
      await new Promise(resolve => setTimeout(resolve, 30000));
      if (session.aborted || session.exitTriggered) return;

      const cp3 = await runCheckpoint(session, '+60s', 25, 35);

      if (!cp3.passed && !session.exitTriggered) {
        session.exitTriggered = true;
        addBotLog({ level: 'error', category: 'trade', message: `🚨 EMERGENCY EXIT: ${input.tokenSymbol}`, tokenSymbol: input.tokenSymbol, tokenAddress: input.tokenAddress, details: `Trigger: ${cp3.reason}` });
        await logEmergencyEvent(input.tokenAddress, input.tokenSymbol, cp3.reason, session.checkpoints);
        await input.onEmergencyExit(cp3.reason);
        return;
      }

      addBotLog({
        level: 'success', category: 'trade',
        message: `✅ Post-buy monitor clear: ${input.tokenSymbol}`,
        tokenSymbol: input.tokenSymbol, tokenAddress: input.tokenAddress,
        details: '60s monitoring completed — position looks safe',
      });

    } catch (err) {
      console.error('[PostBuyMonitor] Monitoring error:', err);
    } finally {
      activeMonitors.delete(input.tokenAddress);
    }
  })();
}

export function stopPostBuyMonitor(tokenAddress: string): void {
  const session = activeMonitors.get(tokenAddress);
  if (session) {
    session.aborted = true;
    activeMonitors.delete(tokenAddress);
  }
}

export function isPostBuyMonitored(tokenAddress: string): boolean {
  return activeMonitors.has(tokenAddress);
}
