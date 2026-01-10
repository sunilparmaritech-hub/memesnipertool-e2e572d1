import { createContext, useContext, useState, ReactNode, useCallback, useEffect } from 'react';
import { useAppMode } from './AppModeContext';

// Demo position matching the real Position interface
export interface DemoPosition {
  id: string;
  user_id: string;
  token_address: string;
  token_symbol: string;
  token_name: string;
  chain: string;
  entry_price: number;
  current_price: number;
  amount: number;
  entry_value: number;
  current_value: number;
  profit_loss_percent: number;
  profit_loss_value: number;
  profit_take_percent: number;
  stop_loss_percent: number;
  status: 'open' | 'closed' | 'pending';
  exit_reason: string | null;
  exit_price: number | null;
  exit_tx_id: string | null;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
}

interface PortfolioData {
  date: string;
  value: number;
  pnl: number;
}

interface DemoPortfolioContextType {
  // Balance
  demoBalance: number;
  setDemoBalance: (balance: number) => void;
  deductBalance: (amount: number) => boolean;
  addBalance: (amount: number) => void;
  
  // Positions
  demoPositions: DemoPosition[];
  addDemoPosition: (position: Omit<DemoPosition, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => DemoPosition;
  updateDemoPosition: (id: string, updates: Partial<DemoPosition>) => void;
  closeDemoPosition: (id: string, exitPrice: number, exitReason: string) => void;
  
  // Open/Closed positions
  openDemoPositions: DemoPosition[];
  closedDemoPositions: DemoPosition[];
  
  // Portfolio history
  portfolioHistory: Record<string, PortfolioData[]>;
  selectedPeriod: '1H' | '24H' | '7D' | '30D';
  setSelectedPeriod: (period: '1H' | '24H' | '7D' | '30D') => void;
  getCurrentPortfolioData: () => PortfolioData[];
  
  // Stats
  totalValue: number;
  totalPnL: number;
  totalPnLPercent: number;
}

const INITIAL_DEMO_BALANCE = 5000; // 5000 SOL
const DEMO_STORAGE_KEY = 'demo_portfolio_state';

const DemoPortfolioContext = createContext<DemoPortfolioContextType | undefined>(undefined);

// Generate portfolio history for different time periods
const generatePortfolioHistory = (baseValue: number): Record<string, PortfolioData[]> => {
  const now = new Date();
  
  // 1H - every 2 minutes
  const data1H: PortfolioData[] = [];
  let value1H = baseValue * 0.98;
  for (let i = 30; i >= 0; i--) {
    const time = new Date(now.getTime() - i * 2 * 60 * 1000);
    const change = (Math.random() - 0.45) * (baseValue * 0.002);
    value1H = Math.max(value1H + change, baseValue * 0.9);
    data1H.push({
      date: time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      value: value1H,
      pnl: value1H - baseValue,
    });
  }
  
  // 24H - every hour
  const data24H: PortfolioData[] = [];
  let value24H = baseValue * 0.95;
  for (let i = 24; i >= 0; i--) {
    const time = new Date(now.getTime() - i * 60 * 60 * 1000);
    const change = (Math.random() - 0.4) * (baseValue * 0.01);
    value24H = Math.max(value24H + change, baseValue * 0.85);
    data24H.push({
      date: time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      value: value24H,
      pnl: value24H - baseValue,
    });
  }
  
  // 7D - every 6 hours
  const data7D: PortfolioData[] = [];
  let value7D = baseValue * 0.9;
  for (let i = 28; i >= 0; i--) {
    const time = new Date(now.getTime() - i * 6 * 60 * 60 * 1000);
    const change = (Math.random() - 0.35) * (baseValue * 0.02);
    value7D = Math.max(value7D + change, baseValue * 0.7);
    data7D.push({
      date: time.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      value: value7D,
      pnl: value7D - baseValue,
    });
  }
  
  // 30D - daily
  const data30D: PortfolioData[] = [];
  let value30D = baseValue * 0.8;
  for (let i = 30; i >= 0; i--) {
    const time = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const change = (Math.random() - 0.3) * (baseValue * 0.03);
    value30D = Math.max(value30D + change, baseValue * 0.5);
    data30D.push({
      date: time.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      value: value30D,
      pnl: value30D - baseValue,
    });
  }
  
  return {
    '1H': data1H,
    '24H': data24H,
    '7D': data7D,
    '30D': data30D,
  };
};

export function DemoPortfolioProvider({ children }: { children: ReactNode }) {
  const { isDemo } = useAppMode();
  
  // Initialize from localStorage or defaults
  const [demoBalance, setDemoBalance] = useState<number>(() => {
    const saved = localStorage.getItem(DEMO_STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return parsed.balance ?? INITIAL_DEMO_BALANCE;
      } catch {
        return INITIAL_DEMO_BALANCE;
      }
    }
    return INITIAL_DEMO_BALANCE;
  });
  
  const [demoPositions, setDemoPositions] = useState<DemoPosition[]>(() => {
    const saved = localStorage.getItem(DEMO_STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return parsed.positions ?? [];
      } catch {
        return [];
      }
    }
    return [];
  });
  
  const [selectedPeriod, setSelectedPeriod] = useState<'1H' | '24H' | '7D' | '30D'>('24H');
  const [portfolioHistory] = useState(() => generatePortfolioHistory(INITIAL_DEMO_BALANCE));
  
  // Persist to localStorage
  useEffect(() => {
    localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify({
      balance: demoBalance,
      positions: demoPositions,
    }));
  }, [demoBalance, demoPositions]);
  
  // Calculate totals
  const openDemoPositions = demoPositions.filter(p => p.status === 'open');
  const closedDemoPositions = demoPositions.filter(p => p.status === 'closed');
  
  const totalValue = openDemoPositions.reduce((sum, p) => sum + p.current_value, 0) + demoBalance;
  const totalPnL = openDemoPositions.reduce((sum, p) => sum + (p.profit_loss_value || 0), 0);
  const entryTotal = openDemoPositions.reduce((sum, p) => sum + p.entry_value, 0);
  const totalPnLPercent = entryTotal > 0 ? (totalPnL / entryTotal) * 100 : 0;
  
  const deductBalance = useCallback((amount: number) => {
    if (demoBalance >= amount) {
      setDemoBalance(prev => prev - amount);
      return true;
    }
    return false;
  }, [demoBalance]);
  
  const addBalance = useCallback((amount: number) => {
    setDemoBalance(prev => prev + amount);
  }, []);
  
  const addDemoPosition = useCallback((position: Omit<DemoPosition, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
    const newPosition: DemoPosition = {
      ...position,
      id: `demo-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      user_id: 'demo-user',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    
    setDemoPositions(prev => [newPosition, ...prev]);
    return newPosition;
  }, []);
  
  const updateDemoPosition = useCallback((id: string, updates: Partial<DemoPosition>) => {
    setDemoPositions(prev => prev.map(p => 
      p.id === id ? { ...p, ...updates, updated_at: new Date().toISOString() } : p
    ));
  }, []);
  
  const closeDemoPosition = useCallback((id: string, exitPrice: number, exitReason: string) => {
    setDemoPositions(prev => prev.map(p => {
      if (p.id === id) {
        const currentValue = p.amount * exitPrice;
        const profitLossValue = currentValue - p.entry_value;
        const profitLossPercent = ((exitPrice - p.entry_price) / p.entry_price) * 100;
        
        return {
          ...p,
          status: 'closed' as const,
          exit_price: exitPrice,
          exit_reason: exitReason,
          current_price: exitPrice,
          current_value: currentValue,
          profit_loss_value: profitLossValue,
          profit_loss_percent: profitLossPercent,
          closed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
      }
      return p;
    }));
  }, []);
  
  const getCurrentPortfolioData = useCallback(() => {
    return portfolioHistory[selectedPeriod] || portfolioHistory['24H'];
  }, [portfolioHistory, selectedPeriod]);
  
  const value: DemoPortfolioContextType = {
    demoBalance,
    setDemoBalance,
    deductBalance,
    addBalance,
    demoPositions,
    addDemoPosition,
    updateDemoPosition,
    closeDemoPosition,
    openDemoPositions,
    closedDemoPositions,
    portfolioHistory,
    selectedPeriod,
    setSelectedPeriod,
    getCurrentPortfolioData,
    totalValue,
    totalPnL,
    totalPnLPercent,
  };
  
  return (
    <DemoPortfolioContext.Provider value={value}>
      {children}
    </DemoPortfolioContext.Provider>
  );
}

export function useDemoPortfolio() {
  const context = useContext(DemoPortfolioContext);
  if (context === undefined) {
    throw new Error('useDemoPortfolio must be used within a DemoPortfolioProvider');
  }
  return context;
}
