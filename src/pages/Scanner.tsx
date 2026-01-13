import React, { forwardRef, useState, useEffect, useCallback, useMemo, useRef } from "react";
import TradingHeader from "@/components/trading/TradingHeader";
import LiquidityBotPanel from "@/components/trading/LiquidityBotPanel";
import LiquidityMonitor from "@/components/scanner/LiquidityMonitor";
import PerformancePanel from "@/components/scanner/PerformancePanel";
import ActivePositionsPanel from "@/components/scanner/ActivePositionsPanel";
import StatsCard from "@/components/StatsCard";
import { PortfolioChart } from "@/components/charts/PriceCharts";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useTokenScanner } from "@/hooks/useTokenScanner";
import { useSniperSettings } from "@/hooks/useSniperSettings";
import { useAutoSniper, TokenData } from "@/hooks/useAutoSniper";
import { useAutoExit } from "@/hooks/useAutoExit";
import { useDemoAutoExit } from "@/hooks/useDemoAutoExit";
import { useWallet } from "@/hooks/useWallet";
import { useTradeExecution, SOL_MINT, type TradeParams, type PriorityLevel } from "@/hooks/useTradeExecution";
import { usePositions } from "@/hooks/usePositions";
import { useToast } from "@/hooks/use-toast";
import { useNotifications } from "@/hooks/useNotifications";
import { useAppMode } from "@/contexts/AppModeContext";
import { useDemoPortfolio } from "@/contexts/DemoPortfolioContext";
import { useSolPrice } from "@/hooks/useSolPrice";
import { Wallet, TrendingUp, Zap, Activity, AlertTriangle, X, FlaskConical, Coins, RotateCcw } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

const Scanner = forwardRef<HTMLDivElement, object>(function Scanner(_props, ref) {
  const { tokens, loading, scanTokens, errors, apiErrors, isDemo, cleanup } = useTokenScanner();
  const { settings, saving, saveSettings, updateField } = useSniperSettings();
  const { evaluateTokens, result: sniperResult, loading: sniperLoading } = useAutoSniper();
  const { startAutoExitMonitor, stopAutoExitMonitor, isMonitoring } = useAutoExit();
  const { executeTrade } = useTradeExecution();
  const { wallet, connectPhantom, disconnect, signAndSendTransaction, refreshBalance } = useWallet();
  const { openPositions: realOpenPositions, closedPositions: realClosedPositions, fetchPositions } = usePositions();
  const { toast } = useToast();
  const { addNotification } = useNotifications();
  const { mode } = useAppMode();
  
  // Real-time SOL price
  const { price: solPrice } = useSolPrice();
  
  // Demo portfolio context
  const {
    demoBalance,
    deductBalance,
    addBalance,
    addDemoPosition,
    updateDemoPosition,
    closeDemoPosition,
    openDemoPositions,
    closedDemoPositions,
    portfolioHistory,
    selectedPeriod,
    setSelectedPeriod,
    getCurrentPortfolioData,
    totalValue: demoTotalValue,
    totalPnL: demoTotalPnL,
    totalPnLPercent: demoTotalPnLPercent,
    resetDemoPortfolio,
    // Performance stats
    winRate: demoWinRate,
    avgPnL: demoAvgPnL,
    bestTrade: demoBestTrade,
    worstTrade: demoWorstTrade,
    totalTrades: demoTotalTrades,
    wins: demoWins,
    losses: demoLosses,
  } = useDemoPortfolio();
  
  // Demo auto-exit monitor
  const { startDemoMonitor, stopDemoMonitor } = useDemoAutoExit();

  const [isBotActive, setIsBotActive] = useState(false);
  const [scanSpeed, setScanSpeed] = useState<'slow' | 'normal' | 'fast'>('normal');
  const [isPaused, setIsPaused] = useState(false);
  const [showApiErrors, setShowApiErrors] = useState(true);
  
  // Confirmation dialogs
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showBotActivateConfirm, setShowBotActivateConfirm] = useState(false);
  const [pendingBotAction, setPendingBotAction] = useState<boolean | null>(null);
  
  // Refs for tracking
  const lastSniperRunRef = useRef<number>(0);
  const processedTokensRef = useRef<Set<string>>(new Set());
  const liveTradeInFlightRef = useRef(false);

  // Use demo or real positions based on mode
  const openPositions = isDemo ? openDemoPositions : realOpenPositions;
  const closedPositions = isDemo ? closedDemoPositions : realClosedPositions;

  // Calculate stats based on mode
  const totalValue = useMemo(() => {
    if (isDemo) {
      return demoTotalValue;
    }
    return realOpenPositions.reduce((sum, p) => sum + p.current_value, 0);
  }, [isDemo, demoTotalValue, realOpenPositions]);
  
  const totalPnL = useMemo(() => {
    if (isDemo) {
      return demoTotalPnL;
    }
    return realOpenPositions.reduce((sum, p) => sum + (p.profit_loss_value || 0), 0);
  }, [isDemo, demoTotalPnL, realOpenPositions]);
  
  const totalPnLPercent = useMemo(() => {
    if (isDemo) {
      return demoTotalPnLPercent;
    }
    const entryTotal = realOpenPositions.reduce((sum, p) => sum + p.entry_value, 0);
    return entryTotal > 0 ? (totalPnL / entryTotal) * 100 : 0;
  }, [isDemo, demoTotalPnLPercent, realOpenPositions, totalPnL]);

  // Get portfolio data based on selected period
  const portfolioData = useMemo(() => getCurrentPortfolioData(), [getCurrentPortfolioData, selectedPeriod]);

  // Calculate today's change from portfolio data
  const todayChange = useMemo(() => {
    if (portfolioData.length < 2) return { value: 0, percent: 0 };
    const initial = portfolioData[0]?.value || totalValue;
    const current = portfolioData[portfolioData.length - 1]?.value || totalValue;
    const change = current - initial;
    const percent = initial > 0 ? (change / initial) * 100 : 0;
    return { value: change, percent };
  }, [portfolioData, totalValue]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  // Auto-scan on mount
  useEffect(() => {
    if (settings?.min_liquidity && !isPaused) {
      scanTokens(settings.min_liquidity);
    }
  }, [settings?.min_liquidity]);

  // Periodic scanning based on speed - optimized intervals
  useEffect(() => {
    if (isPaused) return;
    
    // Demo mode uses faster intervals since no real API calls
    const intervals = isDemo 
      ? { slow: 20000, normal: 10000, fast: 5000 }
      : { slow: 60000, normal: 30000, fast: 15000 };
    
    const interval = setInterval(() => {
      if (settings?.min_liquidity) {
        scanTokens(settings.min_liquidity);
      }
    }, intervals[scanSpeed]);
    
    return () => clearInterval(interval);
  }, [scanSpeed, isPaused, settings?.min_liquidity, scanTokens, isDemo]);

  // Auto-sniper: evaluate NEW tokens when bot is active
  useEffect(() => {
    if (!isBotActive || tokens.length === 0 || !settings) return;
    
    // Filter for tokens we haven't processed yet
    const newTokens = tokens.filter(t => !processedTokensRef.current.has(t.address));
    
    if (newTokens.length === 0) return;
    
    // Mark these tokens as processed
    newTokens.forEach(t => processedTokensRef.current.add(t.address));
    
    // Throttle: minimum 20 seconds between runs
    const now = Date.now();
    if (now - lastSniperRunRef.current < 20000) {
      console.log('Auto-sniper throttled, will process on next cycle');
      return;
    }
    
    lastSniperRunRef.current = now;
    
    // Map tokens with price data for auto-sniper
    const tokenData: TokenData[] = newTokens.slice(0, 5).map(t => ({
      address: t.address,
      name: t.name,
      symbol: t.symbol,
      chain: t.chain,
      liquidity: t.liquidity,
      liquidityLocked: t.liquidityLocked,
      lockPercentage: t.lockPercentage,
      buyerPosition: t.buyerPosition,
      riskScore: t.riskScore,
      categories: [],
      priceUsd: t.priceUsd,
    }));
    
    console.log('Auto-sniper evaluating new tokens:', tokenData.map(t => t.symbol));
    
    // In demo mode, simulate trade execution with demo balance
    if (isDemo) {
      // Find token that meets criteria
      const approvedToken = tokenData.find(t => 
        t.buyerPosition && 
        t.buyerPosition >= 2 && 
        t.buyerPosition <= 3 && 
        t.riskScore < 70 &&
        t.liquidity >= (settings.min_liquidity || 300)
      );
      
      if (approvedToken && settings.trade_amount) {
        // Check if we have enough balance - use real SOL price
        const tradeAmountInDollars = settings.trade_amount * solPrice;
        
        if (demoBalance >= settings.trade_amount) {
          // Deduct balance
          deductBalance(settings.trade_amount);
          
          const entryPrice = approvedToken.priceUsd || 0.0001;
          const amount = tradeAmountInDollars / entryPrice;
          
          // Create demo position
          const newPosition = addDemoPosition({
            token_address: approvedToken.address,
            token_symbol: approvedToken.symbol,
            token_name: approvedToken.name,
            chain: approvedToken.chain,
            entry_price: entryPrice,
            current_price: entryPrice,
            amount,
            entry_value: tradeAmountInDollars,
            current_value: tradeAmountInDollars,
            profit_loss_percent: 0,
            profit_loss_value: 0,
            profit_take_percent: settings.profit_take_percentage,
            stop_loss_percent: settings.stop_loss_percentage,
            status: 'open',
            exit_reason: null,
            exit_price: null,
            exit_tx_id: null,
            closed_at: null,
          });
          
          toast({
            title: '🎯 Demo Trade Executed!',
            description: `Bought ${approvedToken.symbol} at $${entryPrice.toFixed(6)} with ${settings.trade_amount} SOL`,
          });
          
          addNotification({
            title: `Demo Trade: ${approvedToken.symbol}`,
            message: `Bought ${approvedToken.symbol} with ${settings.trade_amount} SOL. TP: ${settings.profit_take_percentage}% SL: ${settings.stop_loss_percentage}%`,
            type: 'trade',
            metadata: { token: approvedToken.symbol, amount: settings.trade_amount },
          });
          
          // Simulate price movement for demo positions
          setTimeout(() => {
            const priceChange = (Math.random() - 0.3) * 0.5; // -30% to +20%
            const newPrice = entryPrice * (1 + priceChange);
            const newValue = amount * newPrice;
            const pnlPercent = priceChange * 100;
            const pnlValue = newValue - tradeAmountInDollars;
            
            updateDemoPosition(newPosition.id, {
              current_price: newPrice,
              current_value: newValue,
              profit_loss_percent: pnlPercent,
              profit_loss_value: pnlValue,
            });
            
            // Check exit conditions
            if (pnlPercent >= settings.profit_take_percentage) {
              closeDemoPosition(newPosition.id, newPrice, 'take_profit');
              addBalance(settings.trade_amount + (pnlValue / solPrice)); // Return original + profit
              toast({
                title: '💰 Take Profit Hit!',
                description: `Closed ${approvedToken.symbol} at +${pnlPercent.toFixed(1)}%`,
              });
            } else if (pnlPercent <= -settings.stop_loss_percentage) {
              closeDemoPosition(newPosition.id, newPrice, 'stop_loss');
              addBalance(settings.trade_amount + (pnlValue / solPrice)); // Return remaining value
              toast({
                title: '🛑 Stop Loss Hit',
                description: `Closed ${approvedToken.symbol} at ${pnlPercent.toFixed(1)}%`,
                variant: 'destructive',
              });
            }
          }, 5000 + Math.random() * 10000); // Random 5-15 seconds delay
        } else {
          toast({
            title: 'Insufficient Demo Balance',
            description: `Need ${settings.trade_amount} SOL, have ${demoBalance.toFixed(2)} SOL`,
            variant: 'destructive',
          });
        }
      }
    } else {
      // Live mode: evaluate first, then execute via wallet signature (no private keys stored)
      (async () => {
        if (!wallet.isConnected || wallet.network !== 'solana' || !wallet.address) {
          toast({
            title: 'Wallet Required',
            description: 'Connect a Solana wallet to enable live bot trading.',
            variant: 'destructive',
          });
          return;
        }

        // Ensure we have enough SOL for the trade amount + a small fee buffer
        const balanceSol = parseFloat(String(wallet.balance || '').replace(/[^\d.]/g, '')) || 0;
        const tradeAmountSol = settings.trade_amount || 0;
        const feeBufferSol = 0.01;

        if (tradeAmountSol <= 0) {
          toast({
            title: 'Invalid Trade Amount',
            description: 'Set a trade amount > 0 in Liquidity Bot settings.',
            variant: 'destructive',
          });
          return;
        }

        if (balanceSol < tradeAmountSol + feeBufferSol) {
          toast({
            title: 'Insufficient SOL Balance',
            description: `Add SOL to your wallet (need ~${(tradeAmountSol + feeBufferSol).toFixed(3)} SOL) then refresh balance.`,
            variant: 'destructive',
          });
          return;
        }

        if (liveTradeInFlightRef.current) return;

        const evaluation = await evaluateTokens(tokenData, false);
        const approved = evaluation?.decisions?.filter((d) => d.approved) || [];
        if (approved.length === 0) return;

        const next = approved[0];
        const slippagePct = next.tradeParams?.slippage ?? 5;
        const slippageBps = Math.round(slippagePct * 100);

        const priorityLevel: PriorityLevel =
          settings.priority === 'turbo'
            ? 'veryHigh'
            : settings.priority === 'fast'
              ? 'high'
              : 'medium';

        const params: TradeParams = {
          inputMint: SOL_MINT,
          outputMint: next.token.address,
          amount: String(Math.floor(tradeAmountSol * 1e9)),
          slippageBps,
          priorityLevel,
          tokenSymbol: next.token.symbol,
          tokenName: next.token.name,
          profitTakePercent: settings.profit_take_percentage,
          stopLossPercent: settings.stop_loss_percentage,
        };

        liveTradeInFlightRef.current = true;
        try {
          const result = await executeTrade(params, wallet.address, (tx) => signAndSendTransaction(tx));
          if (result.success) {
            await fetchPositions();
            refreshBalance();
          }
        } finally {
          liveTradeInFlightRef.current = false;
        }
      })();
    }
  }, [
    tokens,
    isBotActive,
    settings,
    isDemo,
    evaluateTokens,
    executeTrade,
    wallet.isConnected,
    wallet.network,
    wallet.address,
    wallet.balance,
    signAndSendTransaction,
    refreshBalance,
    fetchPositions,
    toast,
    addNotification,
    demoBalance,
    deductBalance,
    addBalance,
    addDemoPosition,
    updateDemoPosition,
    closeDemoPosition,
    solPrice,
  ]);

  const handleConnectWallet = async () => {
    if (wallet.isConnected) {
      await disconnect();
    } else {
      await connectPhantom();
    }
  };

  const handleSaveSettings = async () => {
    if (!settings) return;
    try {
      await saveSettings(settings);
    } catch {
      // Error handled in hook
    }
  };

  const handleToggleBotActive = (active: boolean) => {
    if (active) {
      // Clear processed tokens when activating bot
      processedTokensRef.current.clear();
      
      if (isDemo) {
        // Start demo auto-exit monitor
        startDemoMonitor(5000); // Check every 5 seconds for demo
        toast({
          title: "Demo Mode Active",
          description: `Bot running with ${demoBalance.toFixed(0)} SOL demo balance. No real trades.`,
          variant: "default",
        });
      } else {
        // Start auto-exit monitor for live mode
        startAutoExitMonitor(30000); // Check every 30 seconds
      }
      
      addNotification({
        title: 'Bot Activated',
        message: isDemo 
          ? `Liquidity bot started in demo mode with ${demoBalance.toFixed(0)} SOL balance`
          : 'Liquidity bot started - will auto-trade and auto-exit when conditions are met',
        type: 'success',
      });
    } else {
      // Stop auto-exit monitors
      if (isDemo) {
        stopDemoMonitor();
      } else {
        stopAutoExitMonitor();
      }
      
      addNotification({
        title: 'Bot Deactivated',
        message: 'Liquidity bot has been stopped',
        type: 'info',
      });
    }
    
    setIsBotActive(active);
    toast({
      title: active ? "Liquidity Bot Activated" : "Liquidity Bot Deactivated",
      description: active 
        ? (isDemo ? `Bot will simulate trades with ${demoBalance.toFixed(0)} SOL` : "Bot will automatically enter/exit trades when conditions are met")
        : "Automatic trading has been paused",
    });
  };
  
  // Reset demo balance handler - with confirmation
  const handleResetDemo = () => {
    setShowResetConfirm(true);
  };

  const confirmResetDemo = () => {
    resetDemoPortfolio();
    setShowResetConfirm(false);
    toast({
      title: "Demo Reset",
      description: "Demo balance reset to 5,000 SOL. All positions cleared.",
    });
  };

  // Bot activation with confirmation for live mode
  const handleToggleBotActiveWithConfirm = (active: boolean) => {
    if (active && !isDemo) {
      // Show confirmation for live mode activation
      setPendingBotAction(active);
      setShowBotActivateConfirm(true);
    } else {
      handleToggleBotActive(active);
    }
  };

  const confirmBotActivation = () => {
    if (pendingBotAction !== null) {
      handleToggleBotActive(pendingBotAction);
      setPendingBotAction(null);
    }
    setShowBotActivateConfirm(false);
  };

  // Win rate calculation
  const winRate = closedPositions.length > 0 
    ? (closedPositions.filter(p => (p.profit_loss_percent || 0) > 0).length / closedPositions.length) * 100 
    : 0;

  return (
    <ErrorBoundary>
    <div className="min-h-screen bg-background">
      {/* Confirmation Dialogs */}
      <ConfirmDialog
        open={showResetConfirm}
        onOpenChange={setShowResetConfirm}
        title="Reset Demo Portfolio?"
        description="This will reset your demo balance to 5,000 SOL and close all demo positions. This action cannot be undone."
        confirmLabel="Reset Demo"
        variant="warning"
        onConfirm={confirmResetDemo}
      />
      
      <ConfirmDialog
        open={showBotActivateConfirm}
        onOpenChange={setShowBotActivateConfirm}
        title="Activate Live Trading Bot?"
        description="This will enable automatic trading with real funds from your connected wallet. The bot will execute trades based on your configured settings. Make sure you understand the risks before proceeding."
        confirmLabel="Activate Bot"
        variant="destructive"
        onConfirm={confirmBotActivation}
      />
      <TradingHeader
        walletConnected={wallet.isConnected}
        walletAddress={wallet.address || undefined}
        network={wallet.network}
        onConnectWallet={handleConnectWallet}
      />

      <main className="pt-20 pb-6 px-4">
        <div className="container mx-auto space-y-6">
          {/* Demo Mode Banner */}
          {isDemo && (
            <Alert className="bg-warning/10 border-warning/30">
              <FlaskConical className="h-4 w-4 text-warning" />
              <AlertTitle className="text-warning flex items-center justify-between">
                <div className="flex items-center gap-2">
                  Demo Mode Active
                  <Badge className="bg-warning/20 text-warning border-warning/30 ml-2">
                    <Coins className="w-3 h-3 mr-1" />
                    {demoBalance.toFixed(0)} SOL
                  </Badge>
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="h-7 text-xs border-warning/30 text-warning hover:bg-warning/20"
                  onClick={handleResetDemo}
                >
                  <RotateCcw className="w-3 h-3 mr-1" />
                  Reset
                </Button>
              </AlertTitle>
              <AlertDescription className="text-warning/80">
                You're trading with simulated {demoBalance.toFixed(0)} SOL. Switch to Live mode for real trading.
              </AlertDescription>
            </Alert>
          )}

          {/* API Errors Alert - Only show in Live mode */}
          {!isDemo && apiErrors.length > 0 && showApiErrors && (
            <Alert variant="destructive" className="relative">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle className="flex items-center justify-between">
                <span>API Issues Detected ({apiErrors.length})</span>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-6 w-6 absolute top-2 right-2"
                  onClick={() => setShowApiErrors(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </AlertTitle>
              <AlertDescription>
                <div className="mt-2 space-y-1">
                  {apiErrors.map((error, index) => (
                    <div key={index} className="flex items-center justify-between text-sm bg-destructive/10 rounded px-2 py-1">
                      <div>
                        <span className="font-medium">{error.apiName}</span>
                        <span className="text-muted-foreground ml-2">({error.apiType})</span>
                      </div>
                      <span className="text-xs text-muted-foreground">{error.errorMessage}</span>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  View Admin Panel → Analytics for detailed API health monitoring
                </p>
              </AlertDescription>
            </Alert>
          )}

          {/* Stats Row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatsCard
              title={isDemo ? "Demo Balance" : "Portfolio Value"}
              value={isDemo ? `${demoBalance.toFixed(0)} SOL` : `$${totalValue.toFixed(2)}`}
              change={`${totalPnLPercent >= 0 ? '+' : ''}${totalPnLPercent.toFixed(1)}% total`}
              changeType={totalPnLPercent >= 0 ? 'positive' : 'negative'}
              icon={isDemo ? Coins : Wallet}
            />
            <StatsCard
              title="Active Trades"
              value={openPositions.length.toString()}
              change={`${openPositions.filter(p => (p.profit_loss_percent || 0) > 0).length} profitable`}
              changeType="positive"
              icon={TrendingUp}
            />
            <StatsCard
              title="Pools Detected"
              value={tokens.length.toString()}
              change={`${tokens.filter(t => t.riskScore < 50).length} signals`}
              changeType="neutral"
              icon={Zap}
            />
            <StatsCard
              title="Win Rate"
              value={`${winRate.toFixed(0)}%`}
              change={`${closedPositions.length} trades`}
              changeType={winRate >= 50 ? 'positive' : winRate > 0 ? 'negative' : 'neutral'}
              icon={Activity}
            />
          </div>

          {/* Main Content Grid */}
          <div className="grid lg:grid-cols-[1fr,380px] gap-6">
            {/* Left Column */}
            <div className="space-y-6">
              {/* Portfolio Chart */}
              <Card className="bg-card/80 backdrop-blur-sm border-border/50">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base font-semibold">
                        {isDemo ? "Demo Portfolio" : "Portfolio Value"}
                      </CardTitle>
                      <div className="flex items-baseline gap-2 mt-1">
                        <span className="text-2xl font-bold text-foreground">
                          {isDemo ? `${demoBalance.toFixed(0)} SOL` : `$${totalValue.toFixed(2)}`}
                        </span>
                        <span className={`text-sm font-medium ${todayChange.value >= 0 ? 'text-success' : 'text-destructive'}`}>
                          {todayChange.value >= 0 ? '+' : ''}{todayChange.value.toFixed(2)} ({todayChange.percent.toFixed(2)}%) {selectedPeriod}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-1 bg-secondary/60 rounded-lg p-0.5">
                      {(['1H', '24H', '7D', '30D'] as const).map((period) => (
                        <button
                          key={period}
                          onClick={() => setSelectedPeriod(period)}
                          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                            period === selectedPeriod 
                              ? 'bg-primary text-primary-foreground' 
                              : 'text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          {period}
                        </button>
                      ))}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <PortfolioChart data={portfolioData} height={250} />
                </CardContent>
              </Card>

              {/* Liquidity Monitor */}
              <LiquidityMonitor 
                pools={tokens}
                activeTrades={openPositions}
                loading={loading}
                apiStatus={loading ? 'active' : 'waiting'}
                onExitTrade={(positionId, currentPrice) => {
                  if (isDemo) {
                    closeDemoPosition(positionId, currentPrice, 'manual');
                    const position = openDemoPositions.find(p => p.id === positionId);
                    if (position) {
                      const pnlValue = (currentPrice - position.entry_price) * position.amount;
                      addBalance(settings?.trade_amount || 0 + (pnlValue / 150));
                      toast({
                        title: 'Position Closed',
                        description: `${position.token_symbol} manually closed`,
                      });
                    }
                  }
                }}
              />
            </div>

            {/* Right Column - Bot Settings & Performance */}
            <div className="space-y-6">
              {/* Liquidity Bot Panel */}
              <LiquidityBotPanel
                settings={settings}
                saving={saving}
                onUpdateField={updateField}
                onSave={handleSaveSettings}
                isActive={isBotActive}
                onToggleActive={handleToggleBotActiveWithConfirm}
                isDemo={isDemo}
              />

              {/* Performance Panel - use demo stats in demo mode */}
              <PerformancePanel
                winRate={isDemo ? demoWinRate : winRate}
                totalPnL={isDemo ? demoTotalPnLPercent : totalPnLPercent}
                avgPnL={isDemo ? demoAvgPnL : (totalPnLPercent / Math.max(closedPositions.length, 1))}
                bestTrade={isDemo ? demoBestTrade : Math.max(...closedPositions.map(p => p.profit_loss_percent || 0), 0)}
                worstTrade={isDemo ? demoWorstTrade : Math.min(...closedPositions.map(p => p.profit_loss_percent || 0), 0)}
                totalTrades={isDemo ? demoTotalTrades : closedPositions.length}
                wins={isDemo ? demoWins : closedPositions.filter(p => (p.profit_loss_percent || 0) > 0).length}
                losses={isDemo ? demoLosses : closedPositions.filter(p => (p.profit_loss_percent || 0) <= 0).length}
              />

              {/* Active Positions */}
              <ActivePositionsPanel positions={openPositions} />
            </div>
          </div>
        </div>
      </main>
    </div>
    </ErrorBoundary>
  );
});

Scanner.displayName = 'Scanner';

export default Scanner;
