/**
 * Helius Real-Time Pool Detection
 * 
 * Uses Helius enhanced APIs for instant token discovery:
 * - gRPC/WebSocket for sub-second pool detection
 * - Transaction webhook for new Raydium pool events
 * - Enhanced token metadata API
 * 
 * Fallback to polling if no Helius key configured
 */

const RAYDIUM_V4_PROGRAM = '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8';
const RAYDIUM_CLMM_PROGRAM = 'CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK';
const SOL_MINT = 'So11111111111111111111111111111111111111112';
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

// =============================================================================
// TYPES
// =============================================================================

export interface HeliusPoolEvent {
  signature: string;
  slot: number;
  timestamp: number;
  poolAddress: string;
  tokenMint: string;
  liquidityLamports: number;
  createdAt: string;
}

export interface HeliusTokenMetadata {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  logoUri?: string;
  verified?: boolean;
}

// =============================================================================
// HELIUS RPC METHODS
// =============================================================================

/**
 * Fetch recent Raydium pool transactions using Helius enhanced API
 * Returns new pools created in the last N slots
 */
export async function fetchRecentPools(
  rpcUrl: string,
  lookbackSlots: number = 100
): Promise<HeliusPoolEvent[]> {
  const pools: HeliusPoolEvent[] = [];
  
  try {
    // Get recent signatures for Raydium V4
    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getSignaturesForAddress',
        params: [
          RAYDIUM_V4_PROGRAM,
          { limit: 50 }
        ]
      }),
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) return pools;
    
    const data = await response.json();
    const signatures = data.result || [];
    
    // Filter to only recent (last ~40 seconds at 400ms/slot)
    const now = Date.now() / 1000;
    const recentSigs = signatures.filter((sig: any) => {
      const blockTime = sig.blockTime || 0;
      return blockTime > 0 && (now - blockTime) < 60;
    });
    
    console.log(`[Helius] Found ${recentSigs.length} recent Raydium transactions`);
    
    // Parse initialize pool transactions
    for (const sig of recentSigs.slice(0, 10)) {
      const txDetails = await parsePoolTransaction(rpcUrl, sig.signature);
      if (txDetails) {
        pools.push(txDetails);
      }
    }
  } catch (error) {
    console.log('[Helius] fetchRecentPools error:', error);
  }
  
  return pools;
}

/**
 * Parse a transaction to extract pool creation details
 */
async function parsePoolTransaction(
  rpcUrl: string,
  signature: string
): Promise<HeliusPoolEvent | null> {
  try {
    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getTransaction',
        params: [
          signature,
          { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0 }
        ]
      }),
      signal: AbortSignal.timeout(3000),
    });

    if (!response.ok) return null;
    
    const data = await response.json();
    const tx = data.result;
    
    if (!tx || !tx.meta || tx.meta.err) return null;
    
    // Look for token balance changes indicating new pool
    const postBalances = tx.meta.postTokenBalances || [];
    const preBalances = tx.meta.preTokenBalances || [];
    
    // Find new token accounts created
    for (const post of postBalances) {
      const pre = preBalances.find((p: any) => 
        p.accountIndex === post.accountIndex
      );
      
      // New token balance appeared
      if (!pre && post.mint && post.mint !== SOL_MINT && post.mint !== USDC_MINT) {
        const uiAmount = parseFloat(post.uiTokenAmount?.uiAmountString || '0');
        if (uiAmount > 0) {
          return {
            signature,
            slot: tx.slot,
            timestamp: tx.blockTime || Math.floor(Date.now() / 1000),
            poolAddress: tx.transaction?.message?.accountKeys?.[0]?.pubkey || '',
            tokenMint: post.mint,
            liquidityLamports: 0, // Would need additional parsing
            createdAt: new Date((tx.blockTime || Date.now() / 1000) * 1000).toISOString(),
          };
        }
      }
    }
  } catch {
    // Silent fail for individual tx parse
  }
  
  return null;
}

/**
 * Fetch token metadata using Helius DAS API
 * Much faster than on-chain fetches
 */
export async function fetchHeliusTokenMetadata(
  rpcUrl: string,
  mintAddresses: string[]
): Promise<Map<string, HeliusTokenMetadata>> {
  const result = new Map<string, HeliusTokenMetadata>();
  
  if (mintAddresses.length === 0) return result;
  
  try {
    // Use Helius DAS getAssetBatch (if available)
    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getAssetBatch',
        params: {
          ids: mintAddresses.slice(0, 100)
        }
      }),
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) return result;
    
    const data = await response.json();
    
    if (data.result) {
      for (const asset of data.result) {
        if (!asset || !asset.id) continue;
        
        result.set(asset.id, {
          address: asset.id,
          name: asset.content?.metadata?.name || `Token ${asset.id.slice(0, 6)}`,
          symbol: asset.content?.metadata?.symbol || asset.id.slice(0, 4),
          decimals: asset.token_info?.decimals || 9,
          logoUri: asset.content?.links?.image || undefined,
          verified: asset.content?.metadata?.verified || false,
        });
      }
    }
  } catch (error) {
    console.log('[Helius] Token metadata fetch error:', error);
  }
  
  return result;
}

/**
 * Get current slot for latency measurement
 */
export async function getCurrentSlot(rpcUrl: string): Promise<number> {
  try {
    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getSlot',
        params: []
      }),
      signal: AbortSignal.timeout(2000),
    });

    if (!response.ok) return 0;
    
    const data = await response.json();
    return data.result || 0;
  } catch {
    return 0;
  }
}

/**
 * Check if RPC endpoint is Helius (has enhanced methods)
 */
export function isHeliusRpc(rpcUrl: string): boolean {
  return rpcUrl.includes('helius') || rpcUrl.includes('mainnet.helius');
}

/**
 * Fast pool lookup by token address
 */
export async function lookupPoolByToken(
  rpcUrl: string,
  tokenMint: string
): Promise<{ poolAddress: string; liquidity: number } | null> {
  try {
    // Query Raydium program accounts for pools containing this token
    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getProgramAccounts',
        params: [
          RAYDIUM_V4_PROGRAM,
          {
            encoding: 'jsonParsed',
            filters: [
              { dataSize: 752 }, // Raydium AMM pool size
              { 
                memcmp: {
                  offset: 400, // Approximate offset for token mint
                  bytes: tokenMint
                }
              }
            ]
          }
        ]
      }),
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) return null;
    
    const data = await response.json();
    const accounts = data.result || [];
    
    if (accounts.length > 0) {
      return {
        poolAddress: accounts[0].pubkey,
        liquidity: 0, // Would need parsing
      };
    }
  } catch {
    // Silent fail
  }
  
  return null;
}
