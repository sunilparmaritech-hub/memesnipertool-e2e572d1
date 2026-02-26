/**
 * Raydium Swap Hook
 * 
 * Provides a fallback swap mechanism via Raydium when Jupiter has no route.
 * Used by the Scanner's exit flow for tokens with limited liquidity.
 */

import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWallet } from '@/hooks/useWallet';

interface SwapResult {
  success: boolean;
  signature?: string;
  error?: string;
}

export function useRaydiumSwap() {
  const { wallet, signAndSendTransaction } = useWallet();

  const tryRaydiumSwap = useCallback(async (
    tokenAddress: string,
    tokenSymbol: string | null | undefined,
    tokenAmount: number,
  ): Promise<SwapResult> => {
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
          body: { mint: tokenAddress, owner: wallet.address },
        });
        if (meta?.decimals) decimals = meta.decimals;
      } catch {
        // Use default
      }

      const amountInBaseUnits = Math.floor(tokenAmount * Math.pow(10, decimals)).toString();

      // Get Raydium quote
      const quoteParams = new URLSearchParams({
        inputMint: tokenAddress,
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

      // Derive the user's Associated Token Account (ATA)
      const { PublicKey: PK } = await import('@solana/web3.js');
      const TOKEN_PROGRAM_ID = new PK('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
      const ASSOCIATED_TOKEN_PROGRAM_ID = new PK('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');
      const [inputAccount] = PK.findProgramAddressSync(
        [new PK(wallet.address).toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), new PK(tokenAddress).toBuffer()],
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

  return { tryRaydiumSwap };
}
