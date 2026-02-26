import { create } from 'zustand';

export type WalletType = 'phantom' | 'solflare' | 'backpack' | 'metamask' | 'walletconnect';
export type BlockchainNetwork = 'solana' | 'ethereum' | 'bsc';

export interface WalletState {
  isConnected: boolean;
  address: string | null;
  balance: string | null;
  network: BlockchainNetwork | null;
  walletType: WalletType | null;
}

interface WalletStore {
  wallet: WalletState;
  setWallet: (wallet: WalletState) => void;
  updateWallet: (partial: Partial<WalletState>) => void;
  clearWallet: () => void;
}

const defaultWallet: WalletState = {
  isConnected: false,
  address: null,
  balance: null,
  network: null,
  walletType: null,
};

/**
 * Global wallet store ensures wallet connection state persists
 * across route changes without re-initialization.
 */
export const useWalletStore = create<WalletStore>((set) => ({
  wallet: defaultWallet,
  setWallet: (wallet) => set({ wallet }),
  updateWallet: (partial) => set((state) => ({ wallet: { ...state.wallet, ...partial } })),
  clearWallet: () => set({ wallet: defaultWallet }),
}));
