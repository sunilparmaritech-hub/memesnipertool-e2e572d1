import { useState, useEffect, useCallback } from 'react';
import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { BrowserProvider, formatEther } from 'ethers';
import { useToast } from '@/hooks/use-toast';

export type WalletType = 'phantom' | 'metamask' | 'walletconnect';
export type BlockchainNetwork = 'solana' | 'ethereum' | 'bsc';

export interface WalletState {
  isConnected: boolean;
  address: string | null;
  balance: string | null;
  network: BlockchainNetwork | null;
  walletType: WalletType | null;
}

interface PhantomProvider {
  isPhantom?: boolean;
  connect: () => Promise<{ publicKey: PublicKey }>;
  disconnect: () => Promise<void>;
  on: (event: string, callback: (args: any) => void) => void;
  off: (event: string, callback: (args: any) => void) => void;
  publicKey: PublicKey | null;
}

interface EthereumProvider {
  isMetaMask?: boolean;
  request: (args: { method: string; params?: any[] }) => Promise<any>;
  on: (event: string, callback: (...args: any[]) => void) => void;
  removeListener: (event: string, callback: (...args: any[]) => void) => void;
  selectedAddress: string | null;
}

declare global {
  interface Window {
    solana?: PhantomProvider;
    ethereum?: EthereumProvider;
  }
}

const SOLANA_RPC = 'https://api.mainnet-beta.solana.com';
const BSC_CHAIN_ID = '0x38';
const ETH_CHAIN_ID = '0x1';

export function useWallet() {
  const [wallet, setWallet] = useState<WalletState>({
    isConnected: false,
    address: null,
    balance: null,
    network: null,
    walletType: null,
  });
  const [isConnecting, setIsConnecting] = useState(false);
  const { toast } = useToast();

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const getSolanaBalance = async (publicKey: string): Promise<string> => {
    try {
      const connection = new Connection(SOLANA_RPC);
      const balance = await connection.getBalance(new PublicKey(publicKey));
      return (balance / LAMPORTS_PER_SOL).toFixed(4);
    } catch {
      return '0';
    }
  };

  const getEthBalance = async (address: string, provider: BrowserProvider): Promise<string> => {
    try {
      const balance = await provider.getBalance(address);
      return parseFloat(formatEther(balance)).toFixed(4);
    } catch {
      return '0';
    }
  };

  const connectPhantom = useCallback(async () => {
    const provider = window.solana;
    
    if (!provider?.isPhantom) {
      toast({
        title: 'Phantom not found',
        description: 'Please install Phantom wallet extension',
        variant: 'destructive',
      });
      window.open('https://phantom.app/', '_blank');
      return;
    }

    setIsConnecting(true);
    try {
      const response = await provider.connect();
      const address = response.publicKey.toString();
      const balance = await getSolanaBalance(address);

      setWallet({
        isConnected: true,
        address,
        balance: `${balance} SOL`,
        network: 'solana',
        walletType: 'phantom',
      });

      toast({ title: 'Wallet connected', description: `Connected to Phantom` });
    } catch (error: any) {
      toast({
        title: 'Connection failed',
        description: error.message || 'Failed to connect to Phantom',
        variant: 'destructive',
      });
    } finally {
      setIsConnecting(false);
    }
  }, [toast]);

  const connectMetaMask = useCallback(async (targetNetwork: 'ethereum' | 'bsc' = 'ethereum') => {
    const provider = window.ethereum;

    if (!provider?.isMetaMask) {
      toast({
        title: 'MetaMask not found',
        description: 'Please install MetaMask extension',
        variant: 'destructive',
      });
      window.open('https://metamask.io/', '_blank');
      return;
    }

    setIsConnecting(true);
    try {
      const targetChainId = targetNetwork === 'bsc' ? BSC_CHAIN_ID : ETH_CHAIN_ID;
      
      // Request account access
      const accounts = await provider.request({ method: 'eth_requestAccounts' });
      const address = accounts[0];

      // Switch to target network
      try {
        await provider.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: targetChainId }],
        });
      } catch (switchError: any) {
        // Add BSC network if not available
        if (switchError.code === 4902 && targetNetwork === 'bsc') {
          await provider.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: BSC_CHAIN_ID,
              chainName: 'BNB Smart Chain',
              nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
              rpcUrls: ['https://bsc-dataseed.binance.org/'],
              blockExplorerUrls: ['https://bscscan.com/'],
            }],
          });
        }
      }

      const browserProvider = new BrowserProvider(provider);
      const balance = await getEthBalance(address, browserProvider);
      const symbol = targetNetwork === 'bsc' ? 'BNB' : 'ETH';

      setWallet({
        isConnected: true,
        address,
        balance: `${balance} ${symbol}`,
        network: targetNetwork,
        walletType: 'metamask',
      });

      toast({ title: 'Wallet connected', description: `Connected to MetaMask on ${targetNetwork.toUpperCase()}` });
    } catch (error: any) {
      toast({
        title: 'Connection failed',
        description: error.message || 'Failed to connect to MetaMask',
        variant: 'destructive',
      });
    } finally {
      setIsConnecting(false);
    }
  }, [toast]);

  const connectWalletConnect = useCallback(async () => {
    toast({
      title: 'WalletConnect',
      description: 'WalletConnect integration requires additional setup. Please use Phantom or MetaMask for now.',
    });
  }, [toast]);

  const disconnect = useCallback(async () => {
    try {
      if (wallet.walletType === 'phantom' && window.solana) {
        await window.solana.disconnect();
      }
      // MetaMask doesn't have a disconnect method - we just clear state
      
      setWallet({
        isConnected: false,
        address: null,
        balance: null,
        network: null,
        walletType: null,
      });

      toast({ title: 'Wallet disconnected' });
    } catch (error: any) {
      toast({
        title: 'Disconnect failed',
        description: error.message,
        variant: 'destructive',
      });
    }
  }, [wallet.walletType, toast]);

  const refreshBalance = useCallback(async () => {
    if (!wallet.isConnected || !wallet.address) return;

    try {
      if (wallet.network === 'solana') {
        const balance = await getSolanaBalance(wallet.address);
        setWallet(prev => ({ ...prev, balance: `${balance} SOL` }));
      } else if (wallet.network && window.ethereum) {
        const browserProvider = new BrowserProvider(window.ethereum);
        const balance = await getEthBalance(wallet.address, browserProvider);
        const symbol = wallet.network === 'bsc' ? 'BNB' : 'ETH';
        setWallet(prev => ({ ...prev, balance: `${balance} ${symbol}` }));
      }
    } catch (error) {
      console.error('Failed to refresh balance:', error);
    }
  }, [wallet.isConnected, wallet.address, wallet.network]);

  // Listen for account changes
  useEffect(() => {
    const handleAccountsChanged = (accounts: string[]) => {
      if (accounts.length === 0) {
        disconnect();
      } else if (wallet.walletType === 'metamask') {
        setWallet(prev => ({ ...prev, address: accounts[0] }));
        refreshBalance();
      }
    };

    const handleChainChanged = () => {
      window.location.reload();
    };

    if (window.ethereum) {
      window.ethereum.on('accountsChanged', handleAccountsChanged);
      window.ethereum.on('chainChanged', handleChainChanged);
    }

    return () => {
      if (window.ethereum) {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
        window.ethereum.removeListener('chainChanged', handleChainChanged);
      }
    };
  }, [wallet.walletType, disconnect, refreshBalance]);

  return {
    wallet,
    isConnecting,
    formatAddress,
    connectPhantom,
    connectMetaMask,
    connectWalletConnect,
    disconnect,
    refreshBalance,
  };
}
