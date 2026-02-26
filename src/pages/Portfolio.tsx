import React, { useState, useMemo } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import AppLayout from "@/components/layout/AppLayout";
import { useWallet } from "@/hooks/useWallet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePositions, Position } from "@/hooks/usePositions";
import { useTradeHistory } from "@/hooks/useTradeHistory";
import { useAutoExit } from "@/hooks/useAutoExit";
import { useDisplayUnit } from "@/contexts/DisplayUnitContext";
 import { useTokenRiskAssessment } from "@/hooks/useTokenRiskAssessment";

import { EnhancedTransactionHistory } from "@/components/portfolio/EnhancedTransactionHistory";
import { isPlaceholderTokenText } from "@/lib/dexscreener";
import TokenImage from "@/components/ui/TokenImage";
import { 
  TrendingUp, 
  TrendingDown,
  RefreshCw,
  Loader2,
  DollarSign,
  Target,
  ShieldAlert,
  Clock,
  Play,
  XCircle,
  CheckCircle,
  AlertTriangle,
  History,
  ArrowUpRight,
  ArrowDownRight,
  ExternalLink,
  Wallet,
  BarChart3,
  Activity,
  Zap,
  Trophy,
  PieChart,
  Coins,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";

import { 
  formatPercentage, 
  getTokenDisplayName,
  getTokenDisplaySymbol 
} from "@/lib/formatters";
import {
  calculateCurrentValue,
  calculateEntryValue,
  calculateUnrealizedPnL,
  validatePortfolioConsistency,
} from "@/lib/precision";

const shortAddress = (address: string) =>
  address && address.length > 10
    ? `${address.slice(0, 4)}…${address.slice(-4)}`
    : address || 'Token';

const getExitReasonDisplay = (reason: string | null | undefined) => {
  if (!reason) return { label: 'Manual', icon: XCircle, color: 'text-muted-foreground', tooltip: null };
  switch (reason) {
    case 'take_profit': return { label: 'Take Profit', icon: CheckCircle, color: 'text-success', tooltip: null };
    case 'stop_loss': return { label: 'Stop Loss', icon: AlertTriangle, color: 'text-destructive', tooltip: null };
    case 'sold_externally': return { label: 'External Sale', icon: ArrowUpRight, color: 'text-primary', tooltip: null };
    case 'rug_detected': return { 
      label: 'Rug Pull', 
      icon: AlertTriangle, 
      color: 'text-destructive',
      tooltip: 'Liquidity was removed. Enable these rules to prevent: LIQUIDITY_REALITY, LP_INTEGRITY, LIQUIDITY_AGING, DEPLOYER_REPUTATION, LIQUIDITY_STABILITY',
    };
    case 'force_closed_manual': 
    case 'force_closed_cleanup': return { label: 'Force Closed', icon: XCircle, color: 'text-warning', tooltip: null };
    case 'force_closed_dead_token': return { label: 'Dead Token', icon: AlertTriangle, color: 'text-destructive', tooltip: null };
    default: {
      if (reason.startsWith('emergency_')) {
        return { 
          label: 'Emergency Exit', 
          icon: AlertTriangle, 
          color: 'text-destructive',
          tooltip: 'Emergency sell triggered due to liquidity issues. Enable LP_INTEGRITY and LIQUIDITY_STABILITY rules to prevent.',
        };
      }
      return { label: reason.replace(/_/g, ' '), icon: XCircle, color: 'text-muted-foreground', tooltip: null };
    }
  }
};

// Raw values - no display scaling

interface PositionRowProps {
  position: Position;
  onClose?: () => void;
  compact?: boolean;
  formatValue: (usd: number, options?: { showSign?: boolean }) => string;
}

const PositionRow = ({ position, onClose, compact = false, formatValue }: PositionRowProps) => {
  const isProfit = (position.profit_loss_percent ?? 0) >= 0;
  const isPendingTakeProfit = (position.profit_loss_percent ?? 0) >= (position.profit_take_percent ?? 100) * 0.8;
  const isPendingStopLoss = (position.profit_loss_percent ?? 0) <= -(position.stop_loss_percent ?? 20) * 0.8;

  const displaySymbol = getTokenDisplaySymbol(position.token_symbol, position.token_address);
  const displayName = getTokenDisplayName(position.token_name, position.token_address);
  
  // CRITICAL: Calculate P&L using precision utilities
  // entryPriceUsd is preferred; fall back to entry_price for legacy positions
  const entryPriceUsd = position.entry_price_usd ?? position.entry_price;
  const currentPrice = position.current_price ?? position.entry_price;
  
  // Calculate P&L using the precision function (no manual scaling)
  const pnlValue = calculateUnrealizedPnL({
    amount: position.amount,
    entryPriceUsd,
    currentPriceUsd: currentPrice,
  });
  const exitInfo = position.status === 'closed' ? getExitReasonDisplay(position.exit_reason) : null;
  const ExitIcon = exitInfo?.icon || XCircle;

  return (
    <div className={`flex items-center justify-between p-3 md:p-4 hover:bg-secondary/30 transition-colors ${
      isPendingTakeProfit ? 'bg-success/5 border-l-2 border-success' : 
      isPendingStopLoss ? 'bg-destructive/5 border-l-2 border-destructive' : ''
    }`}>
      <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
        <TokenImage
          symbol={displaySymbol}
          address={position.token_address}
          size="md"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 md:gap-2 flex-wrap">
            <span className="font-semibold text-sm text-foreground truncate max-w-[100px] md:max-w-[150px]">{displaySymbol}</span>
            <Badge variant="outline" className="text-[10px] md:text-xs shrink-0 max-w-[80px] truncate">{displayName}</Badge>
            {position.status === 'open' ? (
              <Badge className="bg-success/20 text-success border-success/30 text-[10px] md:text-xs shrink-0">Open</Badge>
            ) : exitInfo?.tooltip ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="secondary" className="text-[10px] md:text-xs flex items-center gap-1 shrink-0 cursor-help">
                    <ExitIcon className={`w-2.5 h-2.5 md:w-3 md:h-3 ${exitInfo?.color}`} />
                    <span className="truncate max-w-[60px]">{exitInfo?.label}</span>
                  </Badge>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-[280px] text-xs">
                  <p className="font-medium text-destructive mb-1">⚠️ {exitInfo.label}</p>
                  <p className="text-muted-foreground">{exitInfo.tooltip}</p>
                </TooltipContent>
              </Tooltip>
            ) : (
              <Badge variant="secondary" className="text-[10px] md:text-xs flex items-center gap-1 shrink-0">
                <ExitIcon className={`w-2.5 h-2.5 md:w-3 md:h-3 ${exitInfo?.color}`} />
                <span className="truncate max-w-[60px]">{exitInfo?.label}</span>
              </Badge>
            )}
          </div>
          <p className="text-[10px] md:text-xs text-muted-foreground truncate mt-0.5">
            Entry: ${position.entry_price.toFixed(8)} • {formatDistanceToNow(new Date(position.created_at), { addSuffix: true })}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 md:gap-4 lg:gap-6 shrink-0">
        {!compact && (
          <div className="text-right hidden md:block min-w-[70px]">
            <p className="text-[10px] md:text-xs text-muted-foreground">Current</p>
            <p className="font-medium text-foreground text-xs md:text-sm tabular-nums">${(position.current_price ?? 0).toFixed(8)}</p>
          </div>
        )}
        
        <div className="text-right min-w-[60px] md:min-w-[80px]">
          <p className="text-[10px] md:text-xs text-muted-foreground">P&L</p>
          <div className={`flex items-center justify-end gap-0.5 font-bold text-xs md:text-sm ${isProfit ? 'text-success' : 'text-destructive'}`}>
            {formatPercentage(position.profit_loss_percent ?? 0)}
          </div>
          <p className={`text-[10px] md:text-xs ${isProfit ? 'text-success' : 'text-destructive'}`}>
            {formatValue(pnlValue, { showSign: true })}
          </p>
        </div>

        {!compact && (
          <div className="text-right hidden lg:block min-w-[80px] md:min-w-[100px]">
            <p className="text-[10px] md:text-xs text-muted-foreground">Entry Value</p>
            <p className="font-medium text-foreground text-xs md:text-sm">{formatValue(position.entry_value ?? 0)}</p>
          </div>
        )}

        {position.status === 'open' && onClose && (
          <Button size="sm" variant="outline" onClick={onClose} className="shrink-0 h-7 md:h-8 text-xs px-2 md:px-3">
            <XCircle className="w-3 h-3 mr-1" />
            <span className="hidden sm:inline">Close</span>
          </Button>
        )}
        
        {position.status === 'closed' && position.closed_at && (
          <div className="text-right min-w-[60px] md:min-w-[80px] hidden sm:block">
            <p className="text-[10px] md:text-xs text-muted-foreground">Closed</p>
            <p className="text-[10px] md:text-xs text-foreground">{format(new Date(position.closed_at), 'MMM d, HH:mm')}</p>
          </div>
        )}
      </div>
    </div>
  );
};

function Portfolio() {
  const { 
    openPositions, 
    closedPositions, 
    loading, 
    closePosition,
    fetchPositions,
  } = usePositions();

  const {
    checking: checkingExits,
    lastCheck: lastExitCheck,
    results: exitResults,
    pendingExits,
    checkExitConditions,
    startAutoExitMonitor,
    stopAutoExitMonitor,
    isMonitoring,
  } = useAutoExit();

  const { formatPrimaryValue, formatSolNativeValue, solPrice } = useDisplayUnit();

  // Fetch up to the backend max (1000) so the table always shows the full history.
  const { trades, loading: tradesLoading, refetch: refetchTrades, forceSync } = useTradeHistory(1000);
   
   // Token risk assessment for validated P&L
   const { 
     validRealizedPnL, 
     validRealizedPnLPercent,
     flaggedCount,
     realCount,
     scamCount,
     fakeCount,
     portfolioSummary,
     getTokenAssessment,
   } = useTokenRiskAssessment(trades);
   
  const [autoMonitor, setAutoMonitor] = useState(false);
  const [autoExecute, setAutoExecute] = useState(true);
  const { wallet, connectPhantom, disconnect } = useWallet();

  // Sync auto monitor state with hook
  React.useEffect(() => {
    if (autoMonitor && openPositions.length > 0 && wallet.isConnected) {
      startAutoExitMonitor(30000);
    } else {
      stopAutoExitMonitor();
    }
  }, [autoMonitor, openPositions.length, wallet.isConnected, startAutoExitMonitor, stopAutoExitMonitor]);

  const handleClosePosition = async (position: Position) => {
    await closePosition(position.id, position.current_price ?? position.entry_price);
  };

  const handleCheckNow = () => {
    checkExitConditions(autoExecute);
  };

  // Calculate comprehensive stats
  // CRITICAL: Financial-grade precision - no rounding before summation
  // Uses same calculation method as Dashboard (Index.tsx) for consistency
  const stats = useMemo(() => {
    // OPEN VALUE: sum of (amount × current_price) for all active positions
    let openValue = 0;
    let openEntryValue = 0;
    
    for (const p of openPositions) {
      // Same formula as Active tab: entry_value × (current_price / entry_price)
      const entryVal = p.entry_value ?? 0;
      const entryPriceUsd = p.entry_price_usd ?? p.entry_price ?? 0;
      const currentPrice = p.current_price ?? entryPriceUsd;
      const positionCurrentValue = (entryVal > 0 && entryPriceUsd > 0)
        ? entryVal * (currentPrice / entryPriceUsd)
        : entryVal;
      const positionEntryValue = entryVal;
      
      openValue += positionCurrentValue;
      openEntryValue += positionEntryValue;
    }
    
    // UNREALIZED P&L = Open Value - Entry Value
    const openPnL = openValue - openEntryValue;
    
    // REALIZED P&L in SOL: use entry_value-based calculation for consistency
    const closedPnL = closedPositions.reduce((sum, p) => {
      const exitPrice = p.exit_price ?? p.current_price ?? p.entry_price ?? 0;
      const entryPriceUsd = p.entry_price_usd ?? p.entry_price ?? 0;
      const entryVal = p.entry_value ?? 0;
      if (entryPriceUsd <= 0 || entryVal <= 0) return sum;
      const exitVal = entryVal * (exitPrice / entryPriceUsd);
      return sum + (exitVal - entryVal);
    }, 0);
    
    // TOTAL P&L in SOL = Unrealized (open) + Realized (closed)
    const totalPnL = openPnL + closedPnL;
    
    // Total invested SOL across ALL positions for percentage calculation
    const closedEntryValue = closedPositions.reduce((sum, p) => {
      return sum + (p.entry_value ?? 0);
    }, 0);
    const totalEntryValue = openEntryValue + closedEntryValue;
    const totalPnLPercent = totalEntryValue > 0 ? (totalPnL / totalEntryValue) * 100 : 0;
    
    // Validate consistency (for debugging)
    const consistency = validatePortfolioConsistency(openValue, openEntryValue, openPnL);
    if (!consistency.isValid && process.env.NODE_ENV === 'development') {
      console.warn('[Portfolio] Consistency check failed:', consistency.message);
    }
    
    const wins = closedPositions.filter(p => (p.profit_loss_percent ?? 0) > 0).length;
    const losses = closedPositions.filter(p => (p.profit_loss_percent ?? 0) < 0).length;
    const winRate = closedPositions.length > 0 ? (wins / closedPositions.length) * 100 : 0;
    
    const takeProfitExits = closedPositions.filter(p => p.exit_reason === 'take_profit').length;
    const stopLossExits = closedPositions.filter(p => p.exit_reason === 'stop_loss').length;
    const externalExits = closedPositions.filter(p => p.exit_reason === 'sold_externally').length;
    const rugExits = closedPositions.filter(p => p.exit_reason === 'rug_detected' || p.exit_reason?.startsWith('emergency_')).length;
    
    const avgWinPercent = wins > 0 
      ? closedPositions.filter(p => (p.profit_loss_percent ?? 0) > 0).reduce((sum, p) => sum + (p.profit_loss_percent ?? 0), 0) / wins 
      : 0;
    const avgLossPercent = losses > 0 
      ? closedPositions.filter(p => (p.profit_loss_percent ?? 0) < 0).reduce((sum, p) => sum + (p.profit_loss_percent ?? 0), 0) / losses 
      : 0;
    
    // Invested in SOL (consistent with Scanner)
    const investedSol = openPositions.reduce((sum, p) => {
      return sum + (p.entry_value ?? 0.04);
    }, 0);

    return {
      investedSol,
      openValue,
      openEntryValue,
      openPnL,
      closedPnL,
      totalPnL,
      totalPnLPercent,
      wins,
      losses,
      winRate,
      takeProfitExits,
      stopLossExits,
      externalExits,
      avgWinPercent,
      avgLossPercent,
      totalTrades: openPositions.length + closedPositions.length,
      // Risk stats
      flaggedTokens: flaggedCount,
      realTokens: realCount,
      scamTokens: scamCount,
      fakeTokens: fakeCount,
    };
  }, [openPositions, closedPositions, flaggedCount, realCount, scamCount, fakeCount]);

  const recentExits = exitResults.filter(r => r.action !== 'hold');

  const handleConnectWallet = async () => {
    if (wallet.isConnected) {
      await disconnect();
    } else {
      await connectPhantom();
    }
  };

  return (
    <AppLayout>
      <div className="container mx-auto max-w-[1600px] px-2 sm:px-3 md:px-5 space-y-2 sm:space-y-3 py-2 sm:py-3">
        <div className="flex justify-end mb-2">
          <Button
            variant="glow"
            onClick={() => fetchPositions(true)}
            disabled={loading}
            className="shrink-0 h-9 md:h-10"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Refresh
          </Button>
        </div>


        {/* Risk Warning Banner */}
        {stats.flaggedTokens > 0 && (
          <div className="flex items-center gap-3 p-3 rounded-xl border border-warning/30 bg-warning/5">
            <AlertTriangle className="w-5 h-5 text-warning shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-warning">
                {stats.flaggedTokens} token{stats.flaggedTokens > 1 ? 's' : ''} flagged for review
              </p>
              <p className="text-xs text-muted-foreground">
                {stats.scamTokens > 0 && `${stats.scamTokens} potential scam/honeypot • `}
                {stats.fakeTokens > 0 && `${stats.fakeTokens} fake/manipulated profit • `}
                Flagged tokens are excluded from portfolio P&L calculations
              </p>
            </div>
          </div>
        )}

        {/* Stats Overview */}
        <div className="rounded-xl border border-border/30 bg-card/40 overflow-hidden">
          <div className="px-4 py-3 border-b border-border/20">
            <h3 className="text-xs font-bold uppercase tracking-widest text-foreground">Portfolio Overview</h3>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-1 sm:gap-1.5 p-2 sm:p-2.5">
            <div className="rounded-lg border border-border/20 bg-secondary/20 px-2.5 py-2 flex flex-col gap-0 min-w-0">
              <div className="flex items-center gap-1 mb-0.5">
                <Coins className="w-3 h-3 text-primary shrink-0" />
                <span className="text-[9px] sm:text-[10px] font-medium text-muted-foreground truncate">Invested</span>
              </div>
              <span className="text-sm sm:text-base md:text-lg font-bold text-foreground tabular-nums leading-tight truncate">{formatSolNativeValue(stats.investedSol).primary}</span>
              <span className="text-[9px] text-muted-foreground tabular-nums truncate">{formatSolNativeValue(stats.investedSol).secondary}</span>
            </div>

            <div className="rounded-lg border border-border/20 bg-secondary/20 px-2.5 py-2 flex flex-col gap-0 min-w-0">
              <div className="flex items-center gap-1 mb-0.5">
                <DollarSign className="w-3 h-3 text-primary shrink-0" />
                <span className="text-[9px] sm:text-[10px] font-medium text-muted-foreground truncate">Open Value</span>
              </div>
              <span className="text-sm sm:text-base md:text-lg font-bold text-foreground tabular-nums leading-tight truncate">{formatSolNativeValue(stats.openValue).primary}</span>
              <span className="text-[9px] text-muted-foreground tabular-nums truncate">{formatSolNativeValue(stats.openValue).secondary}</span>
            </div>

            <div className="rounded-lg border border-border/20 bg-secondary/20 px-2.5 py-2 flex flex-col gap-0 min-w-0">
              <div className="flex items-center gap-1 mb-0.5">
                {stats.totalPnL >= 0 ? <TrendingUp className="w-3 h-3 text-success shrink-0" /> : <TrendingDown className="w-3 h-3 text-destructive shrink-0" />}
                <span className="text-[9px] sm:text-[10px] font-medium text-muted-foreground truncate">Total P&L</span>
              </div>
              <span className={`text-sm sm:text-base md:text-lg font-bold tabular-nums leading-tight truncate ${stats.totalPnL >= 0 ? 'text-success' : 'text-destructive'}`}>
                {formatSolNativeValue(stats.totalPnL, { showSign: true }).primary}
              </span>
              <span className={`text-[9px] tabular-nums truncate ${stats.totalPnL >= 0 ? 'text-success/70' : 'text-destructive/70'}`}>
                {formatSolNativeValue(stats.totalPnL, { showSign: true }).secondary}
              </span>
            </div>

            <div className="rounded-lg border border-border/20 bg-secondary/20 px-2.5 py-2 flex flex-col gap-0 min-w-0">
              <div className="flex items-center gap-1 mb-0.5">
                <Activity className="w-3 h-3 text-primary shrink-0" />
                <span className="text-[9px] sm:text-[10px] font-medium text-muted-foreground truncate">Total Trades</span>
              </div>
              <span className="text-sm sm:text-base md:text-lg font-bold text-foreground tabular-nums leading-tight">{stats.totalTrades}</span>
              <span className="text-[9px] text-muted-foreground">{closedPositions.length} closed</span>
            </div>

            <div className="rounded-lg border border-border/20 bg-secondary/20 px-2.5 py-2 flex flex-col gap-0 min-w-0">
              <div className="flex items-center gap-1 mb-0.5">
                <Trophy className="w-3 h-3 text-warning shrink-0" />
                <span className="text-[9px] sm:text-[10px] font-medium text-muted-foreground truncate">Win Rate</span>
              </div>
              <span className={`text-sm sm:text-base md:text-lg font-bold tabular-nums leading-tight ${stats.winRate >= 50 ? 'text-success' : 'text-warning'}`}>
                {stats.winRate.toFixed(0)}%
              </span>
              <span className="text-[9px] text-muted-foreground">{stats.wins}W / {stats.losses}L</span>
            </div>

            <div className="rounded-lg border border-border/20 bg-secondary/20 px-2.5 py-2 flex flex-col gap-0 min-w-0">
              <div className="flex items-center gap-1 mb-0.5">
                <CheckCircle className="w-3 h-3 text-success shrink-0" />
                <span className="text-[9px] sm:text-[10px] font-medium text-muted-foreground truncate">Avg Win</span>
              </div>
              <span className="text-sm sm:text-base md:text-lg font-bold text-success tabular-nums leading-tight">+{stats.avgWinPercent.toFixed(1)}%</span>
              <span className="text-[9px] text-muted-foreground">{stats.takeProfitExits} TP exits</span>
            </div>

            <div className="rounded-lg border border-border/20 bg-secondary/20 px-2.5 py-2 flex flex-col gap-0 min-w-0">
              <div className="flex items-center gap-1 mb-0.5">
                <AlertTriangle className="w-3 h-3 text-destructive shrink-0" />
                <span className="text-[9px] sm:text-[10px] font-medium text-muted-foreground truncate">Avg Loss</span>
              </div>
              <span className="text-sm sm:text-base md:text-lg font-bold text-destructive tabular-nums leading-tight">{stats.avgLossPercent.toFixed(1)}%</span>
              <span className="text-[9px] text-muted-foreground">{stats.stopLossExits} SL exits</span>
            </div>
          </div>
        </div>

        {/* Auto-Exit Control Panel */}
        <div className="rounded-xl border border-border/30 bg-card/40 overflow-hidden">
          <div className="px-4 py-3 border-b border-border/20 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-primary" />
            <h3 className="text-xs font-bold uppercase tracking-widest text-foreground">Auto-Exit Monitor</h3>
          </div>
          <div className="p-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <p className="text-xs text-muted-foreground">
                {wallet.isConnected 
                  ? 'Continuously tracks prices and executes real exits via Jupiter'
                  : 'Connect wallet to enable real auto-exit execution'}
              </p>

              <div className="flex items-center gap-4 flex-wrap">
                {!wallet.isConnected ? (
                  <Button variant="outline" size="sm" onClick={handleConnectWallet}>
                    <Wallet className="w-4 h-4 mr-2" />
                    Connect Wallet
                  </Button>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={autoMonitor}
                        onCheckedChange={setAutoMonitor}
                        disabled={openPositions.length === 0}
                      />
                      <span className="text-sm text-muted-foreground">Monitor</span>
                      {isMonitoring && (
                        <span className="flex items-center gap-1 text-xs text-success">
                          <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
                          Active
                        </span>
                      )}
                    </div>

                    {autoMonitor && (
                      <div className="flex items-center gap-2">
                        <Switch checked={autoExecute} onCheckedChange={setAutoExecute} />
                        <span className="text-sm text-muted-foreground">Auto-Execute</span>
                      </div>
                    )}

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCheckNow}
                      disabled={checkingExits || openPositions.length === 0}
                    >
                      {checkingExits ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Play className="w-4 h-4 mr-1" />}
                      Check Now
                    </Button>
                  </>
                )}
              </div>
            </div>

            {/* Pending Exits */}
            {pendingExits.length > 0 && (
              <div className="mt-4 pt-4 border-t border-border/20">
                <p className="text-sm font-medium text-warning mb-2 flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Pending Wallet Signatures:
                </p>
                <div className="flex flex-wrap gap-2">
                  {pendingExits.map((exit, idx) => (
                    <Badge key={idx} className="bg-warning/15 text-warning border-warning/30">
                      {exit.symbol}: {exit.action === 'take_profit' ? 'TP' : 'SL'} @ {exit.profitLossPercent.toFixed(2)}%
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Recent Exit Triggers */}
            {recentExits.length > 0 && (
              <div className="mt-4 pt-4 border-t border-border/20">
                <p className="text-sm font-medium text-foreground mb-2">Recent Exit Triggers:</p>
                <div className="flex flex-wrap gap-2">
                  {recentExits.map((exit, idx) => (
                    <Badge
                      key={idx}
                      className={exit.action === 'take_profit' 
                        ? 'bg-success/15 text-success border-success/30'
                        : 'bg-destructive/15 text-destructive border-destructive/30'
                      }
                    >
                      {exit.symbol}: {exit.action === 'take_profit' ? 'TP' : 'SL'} @ {exit.profitLossPercent.toFixed(2)}%
                      {exit.executed && ' ✓'}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Positions Tabs */}
        <div className="rounded-xl border border-border/30 bg-card/40 overflow-hidden">
          <Tabs defaultValue="open" className="w-full">
            <div className="px-4 py-3 border-b border-border/20">
              <TabsList className="bg-secondary/40">
                <TabsTrigger value="open" className="gap-2 text-xs">
                  <Target className="w-3.5 h-3.5" />
                  Open ({openPositions.length})
                </TabsTrigger>
                <TabsTrigger value="closed" className="gap-2 text-xs">
                  <CheckCircle className="w-3.5 h-3.5" />
                  Closed ({closedPositions.length})
                </TabsTrigger>
                <TabsTrigger value="history" className="gap-2 text-xs">
                  <History className="w-3.5 h-3.5" />
                  Transactions
                </TabsTrigger>
              </TabsList>
            </div>

            {/* Open Positions Tab */}
            <TabsContent value="open" className="mt-0">
              {loading && openPositions.length === 0 ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : openPositions.length === 0 ? (
                <div className="p-8 text-center">
                  <Target className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground">No open positions</p>
                  <p className="text-sm text-muted-foreground">Snipe tokens from the Scanner to track them here</p>
                </div>
              ) : (
                <div className="divide-y divide-border/20">
                  {openPositions.map(position => (
                    <PositionRow 
                      key={position.id} 
                      position={position} 
                      onClose={() => handleClosePosition(position)}
                      formatValue={formatPrimaryValue}
                    />
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Closed Positions Tab */}
            <TabsContent value="closed" className="mt-0">
              {closedPositions.length === 0 ? (
                <div className="p-8 text-center">
                  <History className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground">No closed positions yet</p>
                  <p className="text-sm text-muted-foreground">Your completed trades will appear here</p>
                </div>
              ) : (
                <>
                  <div className="px-4 py-2 border-b border-border/20 flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">Position History</span>
                    <div className="flex gap-2 text-xs">
                      <Badge variant="outline" className="bg-success/10 text-success border-success/30">
                        {stats.takeProfitExits} TP
                      </Badge>
                      <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30">
                        {stats.stopLossExits} SL
                      </Badge>
                      <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
                        {stats.externalExits} External
                      </Badge>
                    </div>
                  </div>
                  <div className="divide-y divide-border/20 max-h-[600px] overflow-y-auto">
                    {closedPositions.map(position => (
                      <PositionRow 
                        key={position.id} 
                        position={position}
                        formatValue={formatPrimaryValue}
                      />
                    ))}
                  </div>
                </>
              )}
            </TabsContent>

            {/* Transaction History Tab */}
            <TabsContent value="history" className="mt-0">
              <EnhancedTransactionHistory 
                trades={trades} 
                loading={tradesLoading} 
                onRefetch={() => refetchTrades({ forceBackfill: true })} 
                onForceSync={forceSync}
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </AppLayout>
  );
}

export default Portfolio;
