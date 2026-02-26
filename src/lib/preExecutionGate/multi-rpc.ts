/**
 * Multi-RPC Validation — Actual RPC-Level Verification
 *
 * Queries token supply from 2 independent RPC nodes in parallel.
 * Detects stale/manipulated data by comparing slot numbers and token supply.
 */

import type { MultiRpcSimulationResult } from './types';

const RPC_ENDPOINTS = [
  typeof import.meta !== 'undefined' ? (import.meta as any).env?.VITE_SOLANA_RPC_URL : undefined,
  'https://rpc.ankr.com/solana',
  'https://api.mainnet-beta.solana.com',
].filter(Boolean) as string[];

const RPC_DEVIATION_THRESHOLD = 1.0; // 1% max deviation

async function fetchTokenSupplyViaRpc(
  tokenMint: string,
  rpcUrl: string,
  timeoutMs: number = 6000
): Promise<{ success: boolean; supply: number; slot: number; error?: string }> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getTokenSupply', params: [tokenMint] }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (!response.ok) return { success: false, supply: 0, slot: 0, error: `HTTP ${response.status}` };
    const data = await response.json();
    if (data.error) return { success: false, supply: 0, slot: 0, error: data.error.message };
    const supply = parseFloat(data.result?.value?.uiAmountString || '0');
    const slot = data.result?.context?.slot || 0;
    return { success: true, supply, slot };
  } catch (error: any) {
    return { success: false, supply: 0, slot: 0, error: error.name === 'AbortError' ? 'Timeout' : error.message };
  }
}

export async function validateMultiRpcSimulation(
  tokenAddress: string,
  _tokenAmount: number = 1000000
): Promise<MultiRpcSimulationResult> {
  const rule = 'RPC_SIMULATION_MISMATCH';

  if (RPC_ENDPOINTS.length < 2) {
    return { passed: true, rule, reason: 'Only one RPC configured — multi-RPC validation skipped' };
  }

  console.log(`[MultiRPC] Validating ${tokenAddress.slice(0, 8)}... via actual RPC calls`);

  const [primary, secondary] = await Promise.all([
    fetchTokenSupplyViaRpc(tokenAddress, RPC_ENDPOINTS[0]),
    fetchTokenSupplyViaRpc(tokenAddress, RPC_ENDPOINTS[1]),
  ]);

  if (!primary.success && !secondary.success) {
    return { passed: true, rule, reason: 'Both RPCs failed — multi-RPC validation skipped' };
  }
  if (!primary.success || !secondary.success) {
    const failedRpc = primary.success ? 'secondary' : 'primary';
    return { passed: true, rule, reason: `${failedRpc} RPC unavailable — single-RPC mode`, penalty: 5 };
  }

  const slotDiff = Math.abs(primary.slot - secondary.slot);
  if (slotDiff > 10) {
    return { passed: false, rule, reason: `RPC slot divergence: ${slotDiff} slots (>10 threshold)`, penalty: 30, primarySlot: primary.slot, secondarySlot: secondary.slot, slotDifference: slotDiff };
  }

  const avgSupply = (primary.supply + secondary.supply) / 2;
  const supplyDeviation = avgSupply > 0 ? (Math.abs(primary.supply - secondary.supply) / avgSupply) * 100 : 0;

  if (supplyDeviation > RPC_DEVIATION_THRESHOLD) {
    return { passed: false, rule, reason: `Token supply mismatch: ${supplyDeviation.toFixed(2)}% deviation`, penalty: 40, primarySupply: primary.supply, secondarySupply: secondary.supply, supplyDeviationPercent: supplyDeviation };
  }

  return { passed: true, rule, reason: `Multi-RPC validated (slot Δ${slotDiff}, supply Δ${supplyDeviation.toFixed(3)}%)`, primarySlot: primary.slot, secondarySlot: secondary.slot, slotDifference: slotDiff, primarySupply: primary.supply, secondarySupply: secondary.supply, supplyDeviationPercent: supplyDeviation };
}

/**
 * Simulate Jupiter sell to verify token can actually be sold
 */
export async function simulateJupiterSell(
  tokenAddress: string,
  tokenAmount: number = 1000000,
): Promise<{ hasRoute: boolean; slippage: number | null; error?: string }> {
  const SOL_MINT = 'So11111111111111111111111111111111111111112';
  try {
    const response = await fetch(
      `https://lite-api.jup.ag/swap/v1/quote?inputMint=${tokenAddress}&outputMint=${SOL_MINT}&amount=${tokenAmount}&slippageBps=500`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (!response.ok) {
      if (response.status === 429) return { hasRoute: false, slippage: null, error: 'Rate limited' };
      return { hasRoute: false, slippage: null, error: `HTTP ${response.status}` };
    }
    const data = await response.json();
    if (data.outAmount && parseInt(data.outAmount) > 0) {
      const priceImpact = parseFloat(data.priceImpactPct || '0');
      return { hasRoute: true, slippage: Math.abs(priceImpact) / 100 };
    }
    return { hasRoute: false, slippage: null, error: 'No output amount' };
  } catch (error) {
    return { hasRoute: false, slippage: null, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}
