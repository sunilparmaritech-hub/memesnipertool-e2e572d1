import { useState, useEffect, useCallback, useRef } from 'react';
import { Connection, PublicKey, LAMPORTS_PER_SOL, Transaction, VersionedTransaction, SendOptions } from '@solana/web3.js';
import { BrowserProvider, formatEther } from 'ethers';
import { useToast } from '@/hooks/use-toast';

export type WalletType = 'phantom' | 'solflare' | 'backpack' | 'metamask' | 'walletconnect';
export type BlockchainNetwork = 'solana' | 'ethereum' | 'bsc';

export interface WalletState {
  isConnected: boolean;
  address: string | null;
  balance: string | null;
  network: BlockchainNetwork | null;
  walletType: WalletType | null;
}

export interface SignTransactionResult {
  signature: string;
  success: boolean;
  error?: string;
}

interface SolanaProvider {
  isPhantom?: boolean;
  isSolflare?: boolean;
  isBackpack?: boolean;
  connect: (options?: { onlyIfTrusted?: boolean }) => Promise<{ publicKey: PublicKey }>;
  disconnect: () => Promise<void>;
  on: (event: string, callback: (args: any) => void) => void;
  off: (event: string, callback: (args: any) => void) => void;
  publicKey: PublicKey | null;
  signTransaction: <T extends Transaction | VersionedTransaction>(transaction: T) => Promise<T>;
  signAllTransactions: <T extends Transaction | VersionedTransaction>(transactions: T[]) => Promise<T[]>;
  signMessage: (message: Uint8Array) => Promise<{ signature: Uint8Array }>;
  signAndSendTransaction: (
    transaction: Transaction | VersionedTransaction,
    options?: SendOptions
  ) => Promise<{ signature: string }>;
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
    solana?: SolanaProvider;
    solflare?: SolanaProvider;
    backpack?: SolanaProvider;
    ethereum?: EthereumProvider;
  }
}

// Use Helius or other reliable RPC for production
const SOLANA_RPC = import.meta.env.VITE_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
const BSC_CHAIN_ID = '0x38';
const ETH_CHAIN_ID = '0x1';

const WALLET_STORAGE_KEY = 'connected_wallet';

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
  const connectionRef = useRef<Connection | null>(null);

  // Get Solana connection (singleton)
  const getConnection = useCallback(() => {
    if (!connectionRef.current) {
      connectionRef.current = new Connection(SOLANA_RPC, {
        commitment: 'confirmed',
        confirmTransactionInitialTimeout: 60000,
      });
    }
    return connectionRef.current;
  }, []);

  const formatAddress = useCallback((address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }, []);

  const getSolanaBalance = useCallback(async (publicKey: string): Promise<string> => {
    try {
      const connection = getConnection();
      const balance = await connection.getBalance(new PublicKey(publicKey));
      return (balance / LAMPORTS_PER_SOL).toFixed(4);
    } catch (error) {
      console.error('Failed to get Solana balance:', error);
      return '0';
    }
  }, [getConnection]);

  const getEthBalance = async (address: string, provider: BrowserProvider): Promise<string> => {
    try {
      const balance = await provider.getBalance(address);
      return parseFloat(formatEther(balance)).toFixed(4);
    } catch {
      return '0';
    }
  };

  // Get the Solana provider based on wallet type
  const getSolanaProvider = useCallback((walletType: WalletType): SolanaProvider | null => {
    switch (walletType) {
      case 'phantom':
        return window.solana?.isPhantom ? window.solana : null;
      case 'solflare':
        return window.solflare?.isSolflare ? window.solflare : null;
      case 'backpack':
        return window.backpack?.isBackpack ? window.backpack : null;
      default:
        return null;
    }
  }, []);

  // Save wallet connection to localStorage
  const saveWalletConnection = useCallback((walletType: WalletType, network: BlockchainNetwork) => {
    localStorage.setItem(WALLET_STORAGE_KEY, JSON.stringify({ walletType, network }));
  }, []);

  // Clear wallet connection from localStorage
  const clearWalletConnection = useCallback(() => {
    localStorage.removeItem(WALLET_STORAGE_KEY);
  }, []);

  // Connect to Phantom wallet
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

      saveWalletConnection('phantom', 'solana');
      toast({ title: 'Wallet connected', description: `Connected to Phantom` });
    } catch (error: any) {
      if (error.code === 4001) {
        toast({
          title: 'Connection rejected',
          description: 'You rejected the connection request',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Connection failed',
          description: error.message || 'Failed to connect to Phantom',
          variant: 'destructive',
        });
      }
    } finally {
      setIsConnecting(false);
    }
  }, [toast, getSolanaBalance, saveWalletConnection]);

  // Connect to Solflare wallet
  const connectSolflare = useCallback(async () => {
    const provider = window.solflare;
    
    if (!provider?.isSolflare) {
      toast({
        title: 'Solflare not found',
        description: 'Please install Solflare wallet extension',
        variant: 'destructive',
      });
      window.open('https://solflare.com/', '_blank');
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
        walletType: 'solflare',
      });

      saveWalletConnection('solflare', 'solana');
      toast({ title: 'Wallet connected', description: `Connected to Solflare` });
    } catch (error: any) {
      toast({
        title: 'Connection failed',
        description: error.message || 'Failed to connect to Solflare',
        variant: 'destructive',
      });
    } finally {
      setIsConnecting(false);
    }
  }, [toast, getSolanaBalance, saveWalletConnection]);

  // Connect to Backpack wallet
  const connectBackpack = useCallback(async () => {
    const provider = window.backpack;
    
    if (!provider?.isBackpack) {
      toast({
        title: 'Backpack not found',
        description: 'Please install Backpack wallet extension',
        variant: 'destructive',
      });
      window.open('https://backpack.app/', '_blank');
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
        walletType: 'backpack',
      });

      saveWalletConnection('backpack', 'solana');
      toast({ title: 'Wallet connected', description: `Connected to Backpack` });
    } catch (error: any) {
      toast({
        title: 'Connection failed',
        description: error.message || 'Failed to connect to Backpack',
        variant: 'destructive',
      });
    } finally {
      setIsConnecting(false);
    }
  }, [toast, getSolanaBalance, saveWalletConnection]);

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
      
      const accounts = await provider.request({ method: 'eth_requestAccounts' });
      const address = accounts[0];

      try {
        await provider.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: targetChainId }],
        });
      } catch (switchError: any) {
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

      saveWalletConnection('metamask', targetNetwork);
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
  }, [toast, saveWalletConnection]);

  const connectWalletConnect = useCallback(async () => {
    toast({
      title: 'WalletConnect',
      description: 'WalletConnect integration requires additional setup. Please use Phantom, Solflare, or Backpack for Solana.',
    });
  }, [toast]);

  const disconnect = useCallback(async () => {
    try {
      if (wallet.walletType && wallet.network === 'solana') {
        const provider = getSolanaProvider(wallet.walletType);
        if (provider) {
          await provider.disconnect();
        }
      }
      
      setWallet({
        isConnected: false,
        address: null,
        balance: null,
        network: null,
        walletType: null,
      });

      clearWalletConnection();
      toast({ title: 'Wallet disconnected' });
    } catch (error: any) {
      toast({
        title: 'Disconnect failed',
        description: error.message,
        variant: 'destructive',
      });
    }
  }, [wallet.walletType, wallet.network, toast, getSolanaProvider, clearWalletConnection]);

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
  }, [wallet.isConnected, wallet.address, wallet.network, getSolanaBalance]);

  // Sign a Solana transaction (user signs directly on wallet)
  const signTransaction = useCallback(async <T extends Transaction | VersionedTransaction>(
    transaction: T
  ): Promise<T | null> => {
    if (!wallet.isConnected || !wallet.walletType || wallet.network !== 'solana') {
      toast({
        title: 'Wallet not connected',
        description: 'Please connect a Solana wallet first',
        variant: 'destructive',
      });
      return null;
    }

    const provider = getSolanaProvider(wallet.walletType);
    if (!provider) {
      toast({
        title: 'Provider not found',
        description: 'Wallet provider is not available',
        variant: 'destructive',
      });
      return null;
    }

    try {
      const signedTx = await provider.signTransaction(transaction);
      return signedTx;
    } catch (error: any) {
      if (error.code === 4001) {
        toast({
          title: 'Transaction rejected',
          description: 'You rejected the transaction',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Signing failed',
          description: error.message || 'Failed to sign transaction',
          variant: 'destructive',
        });
      }
      return null;
    }
  }, [wallet, toast, getSolanaProvider]);

  // Sign and send a Solana transaction
  const signAndSendTransaction = useCallback(async (
    transaction: Transaction | VersionedTransaction,
    options?: SendOptions
  ): Promise<SignTransactionResult> => {
    if (!wallet.isConnected || !wallet.walletType || wallet.network !== 'solana') {
      return {
        signature: '',
        success: false,
        error: 'Wallet not connected',
      };
    }

    const provider = getSolanaProvider(wallet.walletType);
    if (!provider) {
      return {
        signature: '',
        success: false,
        error: 'Provider not found',
      };
    }

    try {
      const result = await provider.signAndSendTransaction(transaction, options);
      
      toast({
        title: 'Transaction sent',
        description: `Signature: ${result.signature.slice(0, 8)}...`,
      });

      // Refresh balance after transaction
      setTimeout(() => refreshBalance(), 2000);

      return {
        signature: result.signature,
        success: true,
      };
    } catch (error: any) {
      const errorMessage = error.code === 4001 
        ? 'Transaction rejected by user'
        : error.message || 'Transaction failed';
      
      toast({
        title: 'Transaction failed',
        description: errorMessage,
        variant: 'destructive',
      });

      return {
        signature: '',
        success: false,
        error: errorMessage,
      };
    }
  }, [wallet, toast, getSolanaProvider, refreshBalance]);

  // Sign a message (for verification purposes)
  const signMessage = useCallback(async (message: string): Promise<Uint8Array | null> => {
    if (!wallet.isConnected || !wallet.walletType || wallet.network !== 'solana') {
      toast({
        title: 'Wallet not connected',
        description: 'Please connect a Solana wallet first',
        variant: 'destructive',
      });
      return null;
    }

    const provider = getSolanaProvider(wallet.walletType);
    if (!provider) {
      toast({
        title: 'Provider not found',
        description: 'Wallet provider is not available',
        variant: 'destructive',
      });
      return null;
    }

    try {
      const encodedMessage = new TextEncoder().encode(message);
      const result = await provider.signMessage(encodedMessage);
      return result.signature;
    } catch (error: any) {
      if (error.code === 4001) {
        toast({
          title: 'Signing rejected',
          description: 'You rejected the message signing',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Signing failed',
          description: error.message || 'Failed to sign message',
          variant: 'destructive',
        });
      }
      return null;
    }
  }, [wallet, toast, getSolanaProvider]);

  // Get the Solana connection for external use
  const getSolanaConnection = useCallback(() => {
    return getConnection();
  }, [getConnection]);

  // Auto-reconnect on page load
  useEffect(() => {
    const attemptAutoConnect = async () => {
      const savedConnection = localStorage.getItem(WALLET_STORAGE_KEY);
      if (!savedConnection) return;

      try {
        const { walletType, network } = JSON.parse(savedConnection);
        
        if (network === 'solana') {
          const provider = getSolanaProvider(walletType);
          if (provider?.publicKey) {
            // Already connected
            const address = provider.publicKey.toString();
            const balance = await getSolanaBalance(address);
            
            setWallet({
              isConnected: true,
              address,
              balance: `${balance} SOL`,
              network: 'solana',
              walletType,
            });
          } else if (provider) {
            // Try to reconnect silently
            try {
              const response = await provider.connect({ onlyIfTrusted: true });
              const address = response.publicKey.toString();
              const balance = await getSolanaBalance(address);
              
              setWallet({
                isConnected: true,
                address,
                balance: `${balance} SOL`,
                network: 'solana',
                walletType,
              });
            } catch {
              // User needs to manually reconnect
              clearWalletConnection();
            }
          }
        } else if (window.ethereum && walletType === 'metamask') {
          const accounts = await window.ethereum.request({ method: 'eth_accounts' });
          if (accounts.length > 0) {
            const browserProvider = new BrowserProvider(window.ethereum);
            const balance = await getEthBalance(accounts[0], browserProvider);
            const symbol = network === 'bsc' ? 'BNB' : 'ETH';
            
            setWallet({
              isConnected: true,
              address: accounts[0],
              balance: `${balance} ${symbol}`,
              network,
              walletType: 'metamask',
            });
          }
        }
      } catch (error) {
        console.error('Auto-connect failed:', error);
        clearWalletConnection();
      }
    };

    // Small delay to ensure wallet extensions are loaded
    const timeout = setTimeout(attemptAutoConnect, 100);
    return () => clearTimeout(timeout);
  }, [getSolanaProvider, getSolanaBalance, clearWalletConnection]);

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

    // Solana wallet disconnect handler
    const handleSolanaDisconnect = () => {
      setWallet({
        isConnected: false,
        address: null,
        balance: null,
        network: null,
        walletType: null,
      });
      clearWalletConnection();
    };

    if (window.ethereum) {
      window.ethereum.on('accountsChanged', handleAccountsChanged);
      window.ethereum.on('chainChanged', handleChainChanged);
    }

    // Listen to Solana wallet events
    if (window.solana) {
      window.solana.on('disconnect', handleSolanaDisconnect);
    }
    if (window.solflare) {
      window.solflare.on('disconnect', handleSolanaDisconnect);
    }
    if (window.backpack) {
      window.backpack.on('disconnect', handleSolanaDisconnect);
    }

    return () => {
      if (window.ethereum) {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
        window.ethereum.removeListener('chainChanged', handleChainChanged);
      }
      if (window.solana) {
        window.solana.off('disconnect', handleSolanaDisconnect);
      }
      if (window.solflare) {
        window.solflare.off('disconnect', handleSolanaDisconnect);
      }
      if (window.backpack) {
        window.backpack.off('disconnect', handleSolanaDisconnect);
      }
    };
  }, [wallet.walletType, disconnect, refreshBalance, clearWalletConnection]);

  return {
    wallet,
    isConnecting,
    formatAddress,
    connectPhantom,
    connectSolflare,
    connectBackpack,
    connectMetaMask,
    connectWalletConnect,
    disconnect,
    refreshBalance,
    signTransaction,
    signAndSendTransaction,
    signMessage,
    getSolanaConnection,
  };
}
