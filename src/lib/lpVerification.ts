/**
 * LP Verification Module v1.0
 * 
 * On-chain verification of Raydium liquidity pool integrity.
 * No API dependencies - uses RPC directly.
 */

import { Connection, PublicKey, AccountInfo } from '@solana/web3.js';

// Known burn addresses
const BURN_ADDRESSES = [
  '11111111111111111111111111111111',                    // System Program (null address)
  '1nc1nerator11111111111111111111111111111111',         // Incinerator
  'burnedxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',      // Common burn pattern
];

// Known timelock/lock programs
const LOCK_PROGRAMS = [
  'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',       // Token Program (for frozen accounts)
  'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL',      // Associated Token Program
];

// Raydium AMM Program IDs
const RAYDIUM_AMM_V4 = '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8';
const RAYDIUM_CPMM = 'CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C';

export interface LpVerificationResult {
  isSafe: boolean;
  lpLocked: boolean;
  lpBurnedPercent: number;
  creatorLpPercent: number;
  totalSupply: number;
  mintAuthority: string | null;
  freezeAuthority: string | null;
  warnings: string[];
  topHolders: {
    address: string;
    balance: number;
    percentage: number;
    isBurned: boolean;
    isLocked: boolean;
  }[];
  // New mandatory check flags
  lpMintAuthorityExists: boolean;
  lpFreezeAuthorityExists: boolean;
  lpCreatorHoldingPercent: number;
  lpMintToInstructionPossible: boolean;
  lpSupplyFullySecured: boolean;
  hardBlockReason?: string;
}

export interface PoolInfo {
  lpMint: string;
  baseMint: string;
  quoteMint: string;
  baseVault: string;
  quoteVault: string;
  authority: string;
}

/**
 * Parse SPL Token Mint account data
 */
function parseMintAccount(data: Buffer): {
  mintAuthority: PublicKey | null;
  supply: bigint;
  decimals: number;
  isInitialized: boolean;
  freezeAuthority: PublicKey | null;
} {
  // SPL Token Mint layout:
  // 0-4: mintAuthorityOption (4 bytes)
  // 4-36: mintAuthority (32 bytes)
  // 36-44: supply (8 bytes, little-endian u64)
  // 44: decimals (1 byte)
  // 45: isInitialized (1 byte)
  // 46-50: freezeAuthorityOption (4 bytes)
  // 50-82: freezeAuthority (32 bytes)
  
  const mintAuthorityOption = data.readUInt32LE(0);
  const mintAuthority = mintAuthorityOption === 1 
    ? new PublicKey(data.slice(4, 36)) 
    : null;
  
  const supply = data.readBigUInt64LE(36);
  const decimals = data.readUInt8(44);
  const isInitialized = data.readUInt8(45) === 1;
  
  const freezeAuthorityOption = data.readUInt32LE(46);
  const freezeAuthority = freezeAuthorityOption === 1 
    ? new PublicKey(data.slice(50, 82)) 
    : null;
  
  return { mintAuthority, supply, decimals, isInitialized, freezeAuthority };
}

/**
 * Parse SPL Token Account data
 */
function parseTokenAccount(data: Buffer): {
  mint: PublicKey;
  owner: PublicKey;
  amount: bigint;
  state: number;
} {
  // SPL Token Account layout:
  // 0-32: mint (32 bytes)
  // 32-64: owner (32 bytes)
  // 64-72: amount (8 bytes, little-endian u64)
  // 72-108: delegate option + delegate
  // 108: state (1 byte)
  
  return {
    mint: new PublicKey(data.slice(0, 32)),
    owner: new PublicKey(data.slice(32, 64)),
    amount: data.readBigUInt64LE(64),
    state: data.readUInt8(108),
  };
}

/**
 * Check if an address is a known burn address
 */
function isBurnAddress(address: string): boolean {
  return BURN_ADDRESSES.includes(address) || 
         address.startsWith('1111111111') ||
         address.toLowerCase().includes('burn');
}

/**
 * Fetch LP mint info directly from chain
 */
async function fetchLpMintInfo(
  connection: Connection,
  lpMintAddress: string
): Promise<{
  totalSupply: number;
  decimals: number;
  mintAuthority: string | null;
  freezeAuthority: string | null;
} | null> {
  try {
    const lpMintPubkey = new PublicKey(lpMintAddress);
    const accountInfo = await connection.getAccountInfo(lpMintPubkey);
    
    if (!accountInfo || accountInfo.data.length < 82) {
      return null;
    }
    
    const parsed = parseMintAccount(accountInfo.data);
    
    return {
      totalSupply: Number(parsed.supply) / Math.pow(10, parsed.decimals),
      decimals: parsed.decimals,
      mintAuthority: parsed.mintAuthority?.toBase58() ?? null,
      freezeAuthority: parsed.freezeAuthority?.toBase58() ?? null,
    };
  } catch (error) {
    console.error('[LP Verify] Failed to fetch LP mint info:', error);
    return null;
  }
}

/**
 * Fetch top LP token holders using getTokenLargestAccounts
 */
async function fetchTopLpHolders(
  connection: Connection,
  lpMintAddress: string,
  limit: number = 10
): Promise<{
  address: string;
  owner: string;
  balance: number;
  decimals: number;
}[]> {
  try {
    const lpMintPubkey = new PublicKey(lpMintAddress);
    
    // Get largest token accounts for this mint
    const largestAccounts = await connection.getTokenLargestAccounts(lpMintPubkey);
    
    if (!largestAccounts.value || largestAccounts.value.length === 0) {
      return [];
    }
    
    // Fetch account details to get owners
    const accountAddresses = largestAccounts.value
      .slice(0, limit)
      .map(acc => acc.address);
    
    const accountInfos = await connection.getMultipleAccountsInfo(accountAddresses);
    
    const holders: {
      address: string;
      owner: string;
      balance: number;
      decimals: number;
    }[] = [];
    
    for (let i = 0; i < accountInfos.length; i++) {
      const accountInfo = accountInfos[i];
      const tokenAccount = largestAccounts.value[i];
      
      if (!accountInfo || accountInfo.data.length < 109) continue;
      
      const parsed = parseTokenAccount(accountInfo.data);
      
      holders.push({
        address: tokenAccount.address.toBase58(),
        owner: parsed.owner.toBase58(),
        balance: tokenAccount.uiAmount || 0,
        decimals: tokenAccount.decimals,
      });
    }
    
    return holders;
  } catch (error) {
    console.error('[LP Verify] Failed to fetch LP holders:', error);
    return [];
  }
}

/**
 * Decode Raydium AMM V4 pool state to extract LP mint
 */
async function decodeRaydiumV4Pool(
  connection: Connection,
  poolAddress: string
): Promise<PoolInfo | null> {
  try {
    const poolPubkey = new PublicKey(poolAddress);
    const accountInfo = await connection.getAccountInfo(poolPubkey);
    
    if (!accountInfo) {
      return null;
    }
    
    const data = accountInfo.data;
    
    // Raydium AMM V4 pool layout (simplified - key offsets):
    // Offset 400: LP mint (32 bytes)
    // Offset 432: base mint (32 bytes)
    // Offset 464: quote mint (32 bytes)
    // Offset 336: base vault (32 bytes)
    // Offset 368: quote vault (32 bytes)
    // Offset 304: authority (32 bytes)
    
    if (data.length < 496) {
      console.log('[LP Verify] Pool data too short for V4 format');
      return null;
    }
    
    return {
      lpMint: new PublicKey(data.slice(400, 432)).toBase58(),
      baseMint: new PublicKey(data.slice(432, 464)).toBase58(),
      quoteMint: new PublicKey(data.slice(464, 496)).toBase58(),
      baseVault: new PublicKey(data.slice(336, 368)).toBase58(),
      quoteVault: new PublicKey(data.slice(368, 400)).toBase58(),
      authority: new PublicKey(data.slice(304, 336)).toBase58(),
    };
  } catch (error) {
    console.error('[LP Verify] Failed to decode Raydium V4 pool:', error);
    return null;
  }
}

/**
 * Find Raydium pool for a token pair
 */
async function findRaydiumPool(
  connection: Connection,
  tokenMint: string,
  quoteMint: string = 'So11111111111111111111111111111111111111112' // WSOL
): Promise<string | null> {
  try {
    // For Raydium AMM V4, we need to derive the pool address
    // This is a simplified approach - in production you'd use getProgramAccounts
    
    const ammProgramId = new PublicKey(RAYDIUM_AMM_V4);
    
    // Get all AMM accounts for this program (limited query)
    const accounts = await connection.getProgramAccounts(ammProgramId, {
      filters: [
        { dataSize: 752 }, // Raydium V4 pool size
      ],
      commitment: 'confirmed',
    });
    
    // Search for pool containing our token
    for (const account of accounts.slice(0, 100)) { // Limit search
      const data = account.account.data;
      if (data.length >= 496) {
        const baseMint = new PublicKey(data.slice(432, 464)).toBase58();
        const poolQuoteMint = new PublicKey(data.slice(464, 496)).toBase58();
        
        if ((baseMint === tokenMint && poolQuoteMint === quoteMint) ||
            (baseMint === quoteMint && poolQuoteMint === tokenMint)) {
          return account.pubkey.toBase58();
        }
      }
    }
    
    return null;
  } catch (error) {
    console.error('[LP Verify] Failed to find Raydium pool:', error);
    return null;
  }
}

/**
 * Main LP Verification function
 * 
 * Verifies the integrity of a Raydium liquidity pool on-chain.
 */
export async function verifyLpIntegrity(
  connection: Connection,
  lpMintAddress: string,
  creatorAddress?: string
): Promise<LpVerificationResult> {
  const warnings: string[] = [];
  let hardBlockReason: string | undefined;
  
  // Step 1: Fetch LP mint account info
  const mintInfo = await fetchLpMintInfo(connection, lpMintAddress);
  
  if (!mintInfo) {
    return {
      isSafe: false,
      lpLocked: false,
      lpBurnedPercent: 0,
      creatorLpPercent: 0,
      totalSupply: 0,
      mintAuthority: null,
      freezeAuthority: null,
      warnings: ['Failed to fetch LP mint info - invalid or non-existent mint'],
      topHolders: [],
      lpMintAuthorityExists: false,
      lpFreezeAuthorityExists: false,
      lpCreatorHoldingPercent: 0,
      lpMintToInstructionPossible: false,
      lpSupplyFullySecured: false,
      hardBlockReason: 'LP mint not found',
    };
  }
  
  // Mandatory check flags
  const lpMintAuthorityExists = mintInfo.mintAuthority !== null;
  const lpFreezeAuthorityExists = mintInfo.freezeAuthority !== null;
  
  // Step 2: HARD BLOCK - Mint authority exists
  if (lpMintAuthorityExists) {
    hardBlockReason = 'LP mintAuthority != null - new LP tokens can be minted';
    warnings.push(`HARD BLOCK: ${hardBlockReason}`);
  }
  
  // Step 3: HARD BLOCK - Freeze authority exists
  if (lpFreezeAuthorityExists && !hardBlockReason) {
    hardBlockReason = 'LP freezeAuthority != null - LP tokens can be frozen';
    warnings.push(`HARD BLOCK: ${hardBlockReason}`);
  }
  
  // Step 4: Fetch top LP holders
  const topHolders = await fetchTopLpHolders(connection, lpMintAddress, 20);
  
  if (topHolders.length === 0) {
    warnings.push('No LP token holders found');
  }
  
  // Step 5: Calculate burned/locked percentages
  let burnedAmount = 0;
  let lockedAmount = 0;
  let creatorAmount = 0;
  
  const enrichedHolders = topHolders.map(holder => {
    const isBurned = isBurnAddress(holder.owner);
    const isLocked = LOCK_PROGRAMS.includes(holder.owner) || 
                     holder.owner.includes('lock') ||
                     holder.owner.includes('Lock');
    
    if (isBurned) {
      burnedAmount += holder.balance;
    }
    if (isLocked) {
      lockedAmount += holder.balance;
    }
    if (creatorAddress && holder.owner === creatorAddress) {
      creatorAmount += holder.balance;
    }
    
    return {
      address: holder.address,
      balance: holder.balance,
      percentage: mintInfo.totalSupply > 0 
        ? (holder.balance / mintInfo.totalSupply) * 100 
        : 0,
      isBurned,
      isLocked,
    };
  });
  
  const lpBurnedPercent = mintInfo.totalSupply > 0 
    ? (burnedAmount / mintInfo.totalSupply) * 100 
    : 0;
    
  const lpLockedPercent = mintInfo.totalSupply > 0 
    ? (lockedAmount / mintInfo.totalSupply) * 100 
    : 0;
    
  const creatorLpPercent = mintInfo.totalSupply > 0 
    ? (creatorAmount / mintInfo.totalSupply) * 100 
    : 0;
  
  // LP supply is fully secured if 90%+ is burned/locked
  const lpSupplyFullySecured = (lpBurnedPercent + lpLockedPercent) >= 90;
  
  // Mint-to instruction is possible if mintAuthority exists
  const lpMintToInstructionPossible = lpMintAuthorityExists;
  
  // Step 6: HARD BLOCK - Creator holds > 5% LP tokens
  if (creatorLpPercent > 5 && !hardBlockReason) {
    hardBlockReason = `Creator holds ${creatorLpPercent.toFixed(2)}% LP tokens (> 5% threshold)`;
    warnings.push(`HARD BLOCK: ${hardBlockReason}`);
  }
  
  // Step 7: HARD BLOCK - LP supply not fully secured (< 90% burned/locked)
  if (!lpSupplyFullySecured && !hardBlockReason) {
    hardBlockReason = `Only ${(lpBurnedPercent + lpLockedPercent).toFixed(2)}% LP burned/locked (< 90%)`;
    warnings.push(`HARD BLOCK: ${hardBlockReason}`);
  }
  
  // Safety evaluation - isSafe only if no hard blocks
  const isSafe = !hardBlockReason;
  const lpLocked = lpSupplyFullySecured;
  
  // Check for suspicious concentration (warning only)
  const topHolderPercent = enrichedHolders[0]?.percentage || 0;
  if (topHolderPercent > 50 && !enrichedHolders[0]?.isBurned) {
    warnings.push(`WARNING: Top holder owns ${topHolderPercent.toFixed(2)}% of LP and is not a burn address`);
  }
  
  return {
    isSafe,
    lpLocked,
    lpBurnedPercent,
    creatorLpPercent: creatorLpPercent,
    totalSupply: mintInfo.totalSupply,
    mintAuthority: mintInfo.mintAuthority,
    freezeAuthority: mintInfo.freezeAuthority,
    warnings,
    topHolders: enrichedHolders,
    // New mandatory check flags
    lpMintAuthorityExists,
    lpFreezeAuthorityExists,
    lpCreatorHoldingPercent: creatorLpPercent,
    lpMintToInstructionPossible,
    lpSupplyFullySecured,
    hardBlockReason,
  };
}

/**
 * Verify LP for a token by finding its Raydium pool
 */
export async function verifyTokenLp(
  connection: Connection,
  tokenMint: string,
  creatorAddress?: string
): Promise<LpVerificationResult & { poolAddress?: string }> {
  // Find the Raydium pool for this token
  const poolAddress = await findRaydiumPool(connection, tokenMint);
  
  if (!poolAddress) {
    return {
      isSafe: false,
      lpLocked: false,
      lpBurnedPercent: 0,
      creatorLpPercent: 0,
      totalSupply: 0,
      mintAuthority: null,
      freezeAuthority: null,
      warnings: ['No Raydium pool found for this token'],
      topHolders: [],
      poolAddress: undefined,
      lpMintAuthorityExists: false,
      lpFreezeAuthorityExists: false,
      lpCreatorHoldingPercent: 0,
      lpMintToInstructionPossible: false,
      lpSupplyFullySecured: false,
      hardBlockReason: 'No Raydium pool found',
    };
  }
  
  // Decode pool to get LP mint
  const poolInfo = await decodeRaydiumV4Pool(connection, poolAddress);
  
  if (!poolInfo) {
    return {
      isSafe: false,
      lpLocked: false,
      lpBurnedPercent: 0,
      creatorLpPercent: 0,
      totalSupply: 0,
      mintAuthority: null,
      freezeAuthority: null,
      warnings: ['Failed to decode Raydium pool'],
      topHolders: [],
      poolAddress,
      lpMintAuthorityExists: false,
      lpFreezeAuthorityExists: false,
      lpCreatorHoldingPercent: 0,
      lpMintToInstructionPossible: false,
      lpSupplyFullySecured: false,
      hardBlockReason: 'Failed to decode pool',
    };
  }
  
  // Verify the LP mint
  const result = await verifyLpIntegrity(connection, poolInfo.lpMint, creatorAddress);
  
  return {
    ...result,
    poolAddress,
  };
}

/**
 * Quick LP safety check - returns boolean only
 */
export async function isLpSafe(
  connection: Connection,
  lpMintAddress: string,
  creatorAddress?: string
): Promise<boolean> {
  const result = await verifyLpIntegrity(connection, lpMintAddress, creatorAddress);
  return result.isSafe;
}
