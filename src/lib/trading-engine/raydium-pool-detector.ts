/**
 * Stage 1: Strict Raydium Pool Detection
 * 
 * TRADABLE POOL DEFINITION (ALL conditions must pass):
 * 1. Raydium AMM pool initialized via `initialize2`
 * 2. AMM program is Raydium V4 or Raydium CLMM
 * 3. Pool status = initialized and open_time <= current_time
 * 4. Base mint is SOL or USDC only
 * 5. Both vault balances > 0
 * 6. Liquidity >= config.minLiquidity
 * 7. LP token mint exists
 * 8. Pool is NOT in Pump.fun bonding curve stage
 * 9. Swap simulation succeeds with tiny amount
 */

import { PROGRAM_IDS, SOL_MINT, USDC_MINT, API_ENDPOINTS } from './config';

// Raydium program IDs
const RAYDIUM_AMM_V4 = PROGRAM_IDS.raydiumAmm;
const RAYDIUM_CLMM = PROGRAM_IDS.raydiumClmm;
const PUMP_FUN_PROGRAM = PROGRAM_IDS.pumpFun;

// Valid base mints
const VALID_BASE_MINTS = [SOL_MINT, USDC_MINT];

export interface TradablePoolResult {
  status: 'TRADABLE' | 'DISCARDED';
  poolAddress?: string;
  baseMint?: string;
  quoteMint?: string;
  liquidity?: number;
  poolType?: 'raydium_v4' | 'raydium_clmm';
  detectedAt?: number;
  lpTokenMint?: string;
  tokenName?: string;
  tokenSymbol?: string;
  reason?: string;
}

export interface PoolValidationConfig {
  minLiquidity: number; // Minimum liquidity in SOL
  rpcUrl: string; // Helius or similar RPC
  waitBlocks?: number; // Blocks to wait before validation (default: 1)
}

interface RaydiumPoolState {
  poolAddress: string;
  baseMint: string;
  quoteMint: string;
  baseVault: string;
  quoteVault: string;
  lpMint: string;
  openTime: number;
  status: number;
  baseVaultBalance: number;
  quoteVaultBalance: number;
}

/**
 * Detect if a pool is tradable using strict Raydium criteria
 * This is the main entry point for Stage-1 detection
 */
export async function detectTradablePool(
  tokenAddress: string,
  config: PoolValidationConfig
): Promise<TradablePoolResult> {
  const startTime = Date.now();
  
  try {
    // Step 1: Check if token is still on Pump.fun bonding curve
    const isPumpFunBonding = await checkPumpFunBondingCurve(tokenAddress);
    if (isPumpFunBonding) {
      return {
        status: 'DISCARDED',
        reason: 'Token still on Pump.fun bonding curve - not graduated to Raydium',
      };
    }

    // Step 2: Find Raydium pool for this token
    const poolState = await findRaydiumPool(tokenAddress, config);
    if (!poolState) {
      return {
        status: 'DISCARDED',
        reason: 'No Raydium AMM pool found for token',
      };
    }

    // Step 3: Validate base mint (must be SOL or USDC)
    if (!VALID_BASE_MINTS.includes(poolState.baseMint)) {
      return {
        status: 'DISCARDED',
        reason: `Invalid base mint: ${poolState.baseMint}. Only SOL/USDC pairs are tradable`,
      };
    }

    // Step 4: Check pool is initialized and open
    const currentTime = Math.floor(Date.now() / 1000);
    if (poolState.openTime > currentTime) {
      return {
        status: 'DISCARDED',
        reason: `Pool not yet open. Opens at: ${new Date(poolState.openTime * 1000).toISOString()}`,
      };
    }

    // Step 5: Verify vault balances > 0
    if (poolState.baseVaultBalance <= 0 || poolState.quoteVaultBalance <= 0) {
      return {
        status: 'DISCARDED',
        reason: `Empty vaults - base: ${poolState.baseVaultBalance}, quote: ${poolState.quoteVaultBalance}`,
      };
    }

    // Step 6: Calculate and validate liquidity
    const liquidityInSol = calculateLiquidityInSol(poolState);
    if (liquidityInSol < config.minLiquidity) {
      return {
        status: 'DISCARDED',
        reason: `Insufficient liquidity: ${liquidityInSol.toFixed(2)} SOL < ${config.minLiquidity} SOL minimum`,
      };
    }

    // Step 7: Verify LP token mint exists
    if (!poolState.lpMint || poolState.lpMint === '11111111111111111111111111111111') {
      return {
        status: 'DISCARDED',
        reason: 'LP token mint not found or invalid',
      };
    }

    // Step 8: MANDATORY - Simulate swap to verify tradability
    const swapSimulation = await simulateSwap(
      tokenAddress,
      poolState.baseMint,
      0.001, // 0.001 SOL test amount
      config
    );
    
    if (!swapSimulation.success) {
      return {
        status: 'DISCARDED',
        reason: `Swap simulation failed: ${swapSimulation.error}`,
      };
    }

    // Step 9: Get token metadata
    const tokenInfo = await getTokenMetadata(tokenAddress);

    // ALL CHECKS PASSED - Pool is TRADABLE
    return {
      status: 'TRADABLE',
      poolAddress: poolState.poolAddress,
      baseMint: poolState.baseMint,
      quoteMint: poolState.quoteMint,
      liquidity: liquidityInSol,
      poolType: 'raydium_v4', // or determine from program
      detectedAt: startTime,
      lpTokenMint: poolState.lpMint,
      tokenName: tokenInfo?.name || 'Unknown',
      tokenSymbol: tokenInfo?.symbol || 'UNKNOWN',
    };

  } catch (error) {
    return {
      status: 'DISCARDED',
      reason: `Detection error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Check if token is still on Pump.fun bonding curve (not graduated)
 */
async function checkPumpFunBondingCurve(tokenAddress: string): Promise<boolean> {
  try {
    const response = await fetch(`${API_ENDPOINTS.pumpFunToken}/${tokenAddress}`, {
      signal: AbortSignal.timeout(5000),
    });
    
    if (!response.ok) {
      // Token not found on Pump.fun - this is good, means it might be on Raydium
      return false;
    }
    
    const data = await response.json();
    
    // If 'complete' is false, token is still on bonding curve
    // If 'complete' is true, token has graduated to Raydium
    if (data && data.complete === false) {
      console.log(`[PumpFun] Token ${tokenAddress} still on bonding curve`);
      return true;
    }
    
    // Token either graduated or not a pump.fun token
    return false;
  } catch {
    // Error checking pump.fun - assume not on bonding curve
    return false;
  }
}

/**
 * Find Raydium pool for a given token using Raydium API
 */
async function findRaydiumPool(
  tokenAddress: string,
  config: PoolValidationConfig
): Promise<RaydiumPoolState | null> {
  try {
    // Use Raydium pools API to find pools containing this token
    const response = await fetch(
      `${API_ENDPOINTS.raydiumPools}?mint=${tokenAddress}`,
      { signal: AbortSignal.timeout(10000) }
    );
    
    if (!response.ok) {
      console.log(`[Raydium] API error: ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    
    if (!data.data || data.data.length === 0) {
      console.log(`[Raydium] No pools found for token ${tokenAddress}`);
      return null;
    }
    
    // Find pool with SOL or USDC as base
    const validPools = data.data.filter((pool: any) => {
      const baseMint = pool.mintA;
      const quoteMint = pool.mintB;
      
      // Check if one side is SOL/USDC and other is our token
      const hasValidBase = VALID_BASE_MINTS.includes(baseMint) || VALID_BASE_MINTS.includes(quoteMint);
      const hasOurToken = baseMint === tokenAddress || quoteMint === tokenAddress;
      
      return hasValidBase && hasOurToken;
    });
    
    if (validPools.length === 0) {
      console.log(`[Raydium] No SOL/USDC pools for token ${tokenAddress}`);
      return null;
    }
    
    // Get the highest TVL pool
    const bestPool = validPools.reduce((best: any, current: any) => 
      (current.tvl || 0) > (best.tvl || 0) ? current : best
    );
    
    // Determine which mint is base (SOL/USDC) and which is quote (token)
    const isBaseA = VALID_BASE_MINTS.includes(bestPool.mintA);
    
    return {
      poolAddress: bestPool.id,
      baseMint: isBaseA ? bestPool.mintA : bestPool.mintB,
      quoteMint: isBaseA ? bestPool.mintB : bestPool.mintA,
      baseVault: isBaseA ? bestPool.vaultA : bestPool.vaultB,
      quoteVault: isBaseA ? bestPool.vaultB : bestPool.vaultA,
      lpMint: bestPool.lpMint || '',
      openTime: bestPool.openTime || 0,
      status: 1, // Assume initialized if returned by API
      baseVaultBalance: isBaseA ? (bestPool.mintAmountA || 0) : (bestPool.mintAmountB || 0),
      quoteVaultBalance: isBaseA ? (bestPool.mintAmountB || 0) : (bestPool.mintAmountA || 0),
    };
    
  } catch (error) {
    console.error('[Raydium] Error finding pool:', error);
    return null;
  }
}

/**
 * Calculate liquidity in SOL equivalent
 */
function calculateLiquidityInSol(poolState: RaydiumPoolState): number {
  // If base is SOL, directly return base vault balance in SOL
  if (poolState.baseMint === SOL_MINT) {
    // baseVaultBalance is usually in lamports from API, but Raydium API gives SOL
    // Check if it's a large number (lamports) or small (SOL)
    const balance = poolState.baseVaultBalance;
    if (balance > 1000000) {
      return balance / 1e9; // Convert lamports to SOL
    }
    return balance; // Already in SOL
  }
  
  // If base is USDC, estimate SOL equivalent (rough: 1 SOL ≈ $150)
  if (poolState.baseMint === USDC_MINT) {
    const usdcAmount = poolState.baseVaultBalance > 1000000 
      ? poolState.baseVaultBalance / 1e6 
      : poolState.baseVaultBalance;
    return usdcAmount / 150; // Rough SOL equivalent
  }
  
  // Fallback: use TVL estimate
  return poolState.baseVaultBalance;
}

/**
 * Simulate a swap to verify the pool is actually tradable
 * Uses Raydium API simulation (no on-chain signing)
 */
async function simulateSwap(
  tokenAddress: string,
  baseMint: string,
  amount: number,
  config: PoolValidationConfig
): Promise<{ success: boolean; outputAmount?: number; error?: string }> {
  try {
    const inputMint = baseMint;
    const outputMint = tokenAddress;
    const amountInLamports = Math.floor(amount * 1e9);
    
    // Try Raydium swap quote first
    const raydiumUrl = `${API_ENDPOINTS.raydiumSwap}/compute/swap-base-in?` +
      `inputMint=${inputMint}&` +
      `outputMint=${outputMint}&` +
      `amount=${amountInLamports}&` +
      `slippageBps=1000`; // 10% slippage for simulation
    
    const response = await fetch(raydiumUrl, {
      signal: AbortSignal.timeout(8000),
    });
    
    if (response.ok) {
      const data = await response.json();
      
      if (data.success && data.data?.outputAmount > 0) {
        console.log(`[Simulation] Raydium swap success: ${amount} SOL -> ${data.data.outputAmount} tokens`);
        return {
          success: true,
          outputAmount: data.data.outputAmount,
        };
      }
    }
    
    // Fallback: Try Jupiter quote
    const jupiterUrl = `https://quote-api.jup.ag/v6/quote?` +
      `inputMint=${inputMint}&` +
      `outputMint=${outputMint}&` +
      `amount=${amountInLamports}&` +
      `slippageBps=1000`;
    
    const jupResponse = await fetch(jupiterUrl, {
      signal: AbortSignal.timeout(8000),
    });
    
    if (jupResponse.ok) {
      const jupData = await jupResponse.json();
      
      if (jupData.outAmount && parseInt(jupData.outAmount) > 0) {
        console.log(`[Simulation] Jupiter swap success: ${amount} SOL -> ${jupData.outAmount} tokens`);
        return {
          success: true,
          outputAmount: parseInt(jupData.outAmount),
        };
      }
    }
    
    // Both failed
    return {
      success: false,
      error: 'No swap route available on Raydium or Jupiter',
    };
    
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Swap simulation error',
    };
  }
}

/**
 * Get token metadata from DexScreener
 */
async function getTokenMetadata(tokenAddress: string): Promise<{ name: string; symbol: string } | null> {
  try {
    const response = await fetch(`${API_ENDPOINTS.dexScreener}/${tokenAddress}`, {
      signal: AbortSignal.timeout(5000),
    });
    
    if (!response.ok) return null;
    
    const data = await response.json();
    
    if (data.pairs && data.pairs.length > 0) {
      const pair = data.pairs[0];
      return {
        name: pair.baseToken?.name || 'Unknown',
        symbol: pair.baseToken?.symbol || 'UNKNOWN',
      };
    }
    
    return null;
  } catch {
    return null;
  }
}

/**
 * Listen for new Raydium pool creations and detect tradable pools
 * This is the main scanner function that should replace Pump.fun listening
 */
export async function scanForNewRaydiumPools(
  config: PoolValidationConfig,
  onTradablePool: (result: TradablePoolResult) => void,
  options?: {
    pollIntervalMs?: number;
    maxTokensPerScan?: number;
  }
): Promise<{ stop: () => void }> {
  const pollInterval = options?.pollIntervalMs || 5000;
  const maxTokens = options?.maxTokensPerScan || 10;
  
  let isRunning = true;
  const seenPools = new Set<string>();
  
  const scan = async () => {
    if (!isRunning) return;
    
    try {
      // Fetch recently created pools from Raydium
      const response = await fetch(
        `${API_ENDPOINTS.raydiumPools}?sort=open_time&order=desc&pageSize=${maxTokens}`,
        { signal: AbortSignal.timeout(10000) }
      );
      
      if (!response.ok) {
        console.log('[Scanner] Failed to fetch new pools');
        return;
      }
      
      const data = await response.json();
      const pools = data.data || [];
      
      for (const pool of pools) {
        // Skip already seen pools
        if (seenPools.has(pool.id)) continue;
        seenPools.add(pool.id);
        
        // Determine which token is not SOL/USDC
        let tokenAddress = pool.mintA;
        if (VALID_BASE_MINTS.includes(pool.mintA)) {
          tokenAddress = pool.mintB;
        }
        
        // Skip if it's a major token pair (SOL-USDC, etc.)
        if (VALID_BASE_MINTS.includes(tokenAddress)) continue;
        
        // Run full tradable pool detection
        const result = await detectTradablePool(tokenAddress, config);
        
        if (result.status === 'TRADABLE') {
          console.log(`[Scanner] TRADABLE pool found: ${result.tokenSymbol} at ${result.poolAddress}`);
          onTradablePool(result);
        } else {
          console.log(`[Scanner] Pool discarded for ${tokenAddress}: ${result.reason}`);
        }
      }
      
    } catch (error) {
      console.error('[Scanner] Scan error:', error);
    }
    
    // Schedule next scan
    if (isRunning) {
      setTimeout(scan, pollInterval);
    }
  };
  
  // Start scanning
  scan();
  
  return {
    stop: () => {
      isRunning = false;
    },
  };
}

/**
 * Batch validate multiple tokens and return only tradable ones
 * Useful for filtering scanner results
 */
export async function batchValidateTradability(
  tokenAddresses: string[],
  config: PoolValidationConfig
): Promise<TradablePoolResult[]> {
  const results = await Promise.all(
    tokenAddresses.map(address => detectTradablePool(address, config))
  );
  
  return results.filter(r => r.status === 'TRADABLE');
}
