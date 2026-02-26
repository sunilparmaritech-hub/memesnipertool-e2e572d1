import { useState, useMemo, memo, useCallback, useEffect, useRef, forwardRef } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ScannedToken } from "@/hooks/useTokenScanner";
import { useScannerStore, type MonitorTab } from "@/stores/scannerStore";
import { Zap, TrendingUp, TrendingDown, ExternalLink, ShieldCheck, ShieldX, Lock, Search, LogOut, ChevronDown, ChevronUp, DollarSign, Eye, Clock, Play, Pause, Users } from "lucide-react";
import TokenImage from "@/components/ui/TokenImage";
import { formatDistanceToNow } from "date-fns";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import WaitingLiquidityTab, { type CombinedWaitingItem } from "./WaitingLiquidityTab";
import type { WaitingPosition } from "@/hooks/useLiquidityRetryWorker";
import type { WalletToken } from "@/hooks/useWalletTokens";
import { useTokenHolders } from "@/hooks/useTokenHolders";
import { formatPreciseUsd, formatTokenPrice } from "@/lib/precision";

interface ActiveTradePosition {
  id: string;
  token_address: string;
  token_symbol: string;
  token_name: string;
  chain: string;
  entry_price: number;
  entry_price_usd?: number | null; // USD entry price (source of truth for P&L)
  current_price: number;
  amount: number;
  entry_value: number;      // May be stale/mixed-unit - prefer deriving from amount × entry_price_usd
  current_value: number;    // May be stale/mixed-unit - prefer deriving from amount × current_price
  profit_loss_percent: number | null;
  profit_loss_value: number | null;
  profit_take_percent: number;
  stop_loss_percent: number;
  status: 'open' | 'closed' | 'pending' | 'waiting_for_liquidity';
  created_at: string;
}

interface LiquidityMonitorProps {
  pools: ScannedToken[];
  activeTrades: ActiveTradePosition[];
  waitingPositions?: WaitingPosition[];
  walletTokens?: WalletToken[];
  loadingWalletTokens?: boolean;
  loading: boolean;
  apiStatus: 'waiting' | 'active' | 'error' | 'rate_limited';
  onExitTrade?: (positionId: string, currentPrice: number) => void;
  onRetryLiquidityCheck?: () => void;
  onMoveBackFromWaiting?: (positionId: string) => void;
  onManualSellWaiting?: (position: WaitingPosition | CombinedWaitingItem) => void;
  onRefreshWalletTokens?: () => void;
  checkingLiquidity?: boolean;
  // Pool scanning controls
  isScanningPaused?: boolean;
  onToggleScanning?: () => void;
  // Holder data integration
  holderData?: Map<string, { holderCount: number; buyerPosition?: number }>;
  onFetchHolders?: (tokenAddresses: string[]) => void;
}

const formatLiquidity = (value: number | null | undefined) => {
  const v = value ?? 0;
  // Only use K/M for very large liquidity values
  if (v >= 1000000) return `$${(v / 1000000).toFixed(1)}M`;
  if (v >= 100000) return `$${(v / 1000).toFixed(0)}K`;
  // Show exact value below $100K
  return formatPreciseUsd(v);
};

const formatPrice = (value: number | null | undefined) => formatTokenPrice(value);

const avatarColors = [
  'bg-gradient-to-br from-primary/30 to-primary/10 text-primary',
  'bg-gradient-to-br from-blue-500/30 to-blue-500/10 text-blue-400',
  'bg-gradient-to-br from-purple-500/30 to-purple-500/10 text-purple-400',
  'bg-gradient-to-br from-orange-500/30 to-orange-500/10 text-orange-400',
  'bg-gradient-to-br from-pink-500/30 to-pink-500/10 text-pink-400',
  'bg-gradient-to-br from-cyan-500/30 to-cyan-500/10 text-cyan-400',
];

// Format age from ISO date string
const formatAge = (createdAt: string | null | undefined) => {
  if (!createdAt || createdAt.trim() === '') return '—';
  const date = new Date(createdAt);
  if (isNaN(date.getTime())) return '—';
  // Reject dates before 2020 or in the future (bad data)
  const year = date.getFullYear();
  if (year < 2020 || year > 2100) return '—';
  const diff = Date.now() - date.getTime();
  if (diff < 0) return '—';
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ${mins % 60}m`;
  const days = Math.floor(hrs / 24);
  return `${days}d`;
};

const formatCompact = (value: number | null | undefined) => {
  const v = value ?? 0;
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(2)}K`;
  if (v >= 1) return `$${v.toFixed(2)}`;
  return `$${v.toFixed(4)}`;
};

const formatCompactNum = (value: number | null | undefined) => {
  const v = value ?? 0;
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(2)}K`;
  return v.toLocaleString();
};

// Memoized Pool Row - Desktop: full inline data, Mobile: expandable
const PoolRow = memo(({ pool, colorIndex, isNew, onViewDetails, holderCount, buyerPosition }: { 
  pool: ScannedToken; 
  colorIndex: number; 
  isNew?: boolean; 
  onViewDetails: (pool: ScannedToken) => void;
  holderCount?: number | null;
  buyerPosition?: number | null;
}) => {
  const [expanded, setExpanded] = useState(false);
  const priceChange = pool.priceChange24h ?? 0;
  const isPositive = priceChange >= 0;
  
  const displaySymbol = isPlaceholder(pool.symbol) 
    ? shortAddress(pool.address) 
    : pool.symbol;
  const displayName = isPlaceholder(pool.name) 
    ? `Token ${shortAddress(pool.address)}` 
    : pool.name;

  const honeypotSafe = pool.riskScore < 50;
  const liquidityLocked = pool.liquidityLocked;
  const isPumpFun = pool.isPumpFun || pool.source?.toLowerCase().includes('pump');
  const canBuy = pool.canBuy === true;
  const canSell = pool.canSell === true;
  const isTradeable = pool.isTradeable === true && canBuy && canSell;
  const displayHolders = holderCount ?? pool.holders;
  const entryPos = buyerPosition ?? pool.buyerPosition;

  const navigate = useNavigate();
  const isRugRisk = pool.riskScore >= 70;

  const handleRowClick = () => {
    // On mobile, toggle expand; on desktop, navigate to detail
    if (window.innerWidth < 768) {
      setExpanded(!expanded);
    } else {
      navigate(`/token/${pool.address}`);
    }
  };

  const handleSolscanClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.open(`https://solscan.io/token/${pool.address}`, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className={cn("border-b border-border/20", isNew && "animate-fade-in")}>
      {/* Main row */}
      <div 
        className="grid grid-cols-[1fr_auto] md:grid-cols-[minmax(180px,2fr)_60px_90px_100px_72px_80px_56px_56px_52px_32px] items-center gap-0 px-4 py-3.5 hover:bg-secondary/30 transition-colors cursor-pointer"
        onClick={handleRowClick}
      >
        {/* Pair Info - with address & badges */}
        <div className="flex items-center gap-3 min-w-0 pl-1">
          <TokenImage
            symbol={displaySymbol}
            address={pool.address}
            imageUrl={pool.imageUrl}
            size="lg"
            className="shrink-0"
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className="font-bold text-foreground text-sm truncate max-w-[140px]">{displayName}</span>
              {isNew && (
                <Badge className="bg-primary/20 text-primary text-[8px] px-1.5 py-0 h-4">NEW</Badge>
              )}
              {isRugRisk && (
                <Badge className="bg-destructive/20 text-destructive text-[8px] px-1.5 py-0 h-4 border border-destructive/30">RUG</Badge>
              )}
            </div>
            {/* Token address */}
            <div className="text-[10px] text-muted-foreground font-mono truncate">
              {pool.address.slice(0, 6)}...{pool.address.slice(-4)}
            </div>
          </div>
        </div>

        {/* Mobile: compact summary */}
        <div className="flex flex-col items-end gap-0.5 md:hidden min-w-[80px]">
          <span className={cn("font-bold text-sm tabular-nums", isPositive ? 'text-success' : 'text-destructive')}>
            {isPositive ? '+' : ''}{priceChange.toFixed(1)}%
          </span>
          <span className="text-xs text-muted-foreground tabular-nums">{formatCompact(pool.liquidity)}</span>
          <ChevronDown className={cn("w-3 h-3 text-muted-foreground/50 transition-transform", expanded && "rotate-180")} />
        </div>

        {/* Age - Desktop */}
        <div className="hidden md:flex items-center justify-center text-xs text-muted-foreground tabular-nums">
          {formatAge(pool.createdAt)}
        </div>

        {/* Liquidity + Change - Desktop */}
        <div className="hidden md:block text-right px-2">
          <div className="text-xs font-semibold text-foreground tabular-nums">{formatCompact(pool.liquidity)}</div>
          <div className={cn("text-[10px] tabular-nums", isPositive ? 'text-success' : 'text-destructive')}>
            {isPositive ? '+' : ''}{priceChange.toFixed(0)}%
          </div>
        </div>

        {/* Market Cap - Desktop */}
        <div className="hidden md:block text-right px-2">
          <div className="text-xs font-medium text-foreground tabular-nums">{formatCompact(pool.marketCap)}</div>
          <div className="text-[10px] text-muted-foreground tabular-nums">{formatPrice(pool.priceUsd)}</div>
        </div>

        {/* Holders - Desktop */}
        <div className="hidden md:flex items-center justify-center text-xs font-semibold text-foreground tabular-nums">
          {displayHolders ? formatCompactNum(displayHolders) : '—'}
        </div>

        {/* Volume - Desktop */}
        <div className="hidden md:block text-right px-2 text-xs font-bold text-foreground tabular-nums">
          {formatCompact(pool.volume24h)}
        </div>

        {/* Source - Desktop inline */}
        <div className="hidden md:flex items-center justify-center">
          <Badge variant="outline" className={cn(
            "text-[9px] px-1.5 py-0 h-5",
            isPumpFun ? "border-orange-400/40 text-orange-400 bg-orange-400/10" : "border-purple-400/40 text-purple-400 bg-purple-400/10"
          )}>
            {isPumpFun ? 'Pump' : 'Dex'}
          </Badge>
        </div>

        {/* Buy/Sell - Desktop inline */}
        <div className="hidden md:flex items-center justify-center gap-0.5 text-xs font-semibold">
          <span className={canBuy ? 'text-success' : 'text-destructive'}>{canBuy ? '✓' : '✗'}</span>
          <span className="text-muted-foreground/40">/</span>
          <span className={canSell ? 'text-success' : 'text-destructive'}>{canSell ? '✓' : '✗'}</span>
        </div>

        {/* Risk - Desktop inline */}
        <div className="hidden md:flex items-center justify-center">
          <Badge variant="outline" className={cn(
            "text-[9px] px-1.5 py-0 h-5",
            pool.riskScore < 40 ? "border-success/40 text-success bg-success/10" :
            pool.riskScore < 70 ? "border-warning/40 text-warning bg-warning/10" :
            "border-destructive/40 text-destructive bg-destructive/10"
          )}>
            {pool.riskScore}
          </Badge>
        </div>

        {/* Solscan link - Desktop inline */}
        <div className="hidden md:flex items-center justify-center">
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={handleSolscanClick} title="View on Solscan">
            <ExternalLink className="w-3.5 h-3.5 text-muted-foreground hover:text-primary" />
          </Button>
        </div>
      </div>
      
      {/* Expanded section - MOBILE ONLY */}
      {expanded && (
        <div className="md:hidden px-4 pb-3 pt-1 bg-secondary/20 animate-fade-in">
          <div className="grid grid-cols-2 gap-2 p-2.5 bg-background/50 rounded-lg text-xs">
            <div>
              <span className="text-muted-foreground text-[10px] block">Source</span>
              <span className={cn("font-semibold text-xs", isPumpFun ? "text-orange-400" : "text-purple-400")}>
                {pool.source || (isPumpFun ? 'Pump.fun' : 'DexScreener')}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground text-[10px] block">Buy / Sell</span>
              <span className={cn("font-semibold text-xs", isTradeable ? 'text-success' : 'text-destructive')}>
                {canBuy ? '✓' : '✗'} / {canSell ? '✓' : '✗'}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground text-[10px] block">Entry Pos</span>
              <span className={cn("font-semibold text-xs", entryPos && entryPos <= 10 ? "text-success" : "text-foreground")}>
                {entryPos ? `#${entryPos}` : '—'}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground text-[10px] block">Risk</span>
              <span className={cn("font-semibold text-xs", pool.riskScore < 40 ? 'text-success' : pool.riskScore < 70 ? 'text-warning' : 'text-destructive')}>
                {pool.riskScore}/100
              </span>
            </div>
            <div>
              <span className="text-muted-foreground text-[10px] block">Mkt Cap</span>
              <span className="font-semibold text-xs text-foreground">{formatCompact(pool.marketCap)}</span>
            </div>
            <div>
              <span className="text-muted-foreground text-[10px] block">Holders</span>
              <span className="font-semibold text-xs text-foreground">{displayHolders ? formatCompactNum(displayHolders) : '—'}</span>
            </div>
          </div>
          {pool.safetyReasons && pool.safetyReasons.length > 0 && (
            <div className="mt-2 p-2 bg-background/30 rounded text-xs">
              <div className="flex flex-wrap gap-1">
                {[...new Set(pool.safetyReasons)]
                  .sort((a, b) => {
                    const priority = (s: string) => s.startsWith('✅') ? 0 : s.startsWith('⚠️') ? 1 : s.startsWith('❌') ? 2 : 3;
                    return priority(a) - priority(b);
                  })
                  .slice(0, 5)
                  .map((reason, idx) => (
                    <Badge key={idx} variant="outline" className={cn(
                      "text-[10px] px-1.5 py-0 h-5",
                      reason.startsWith('✅') && "border-success/40 text-success bg-success/5",
                      reason.startsWith('⚠️') && "border-warning/40 text-warning bg-warning/5",
                      reason.startsWith('❌') && "border-destructive/40 text-destructive bg-destructive/5"
                    )}>
                      {reason}
                    </Badge>
                  ))}
              </div>
            </div>
          )}
          <div className="flex items-center gap-2 mt-2">
            <Button size="sm" variant="outline" className="flex-1 h-8 text-xs gap-1.5" onClick={(e) => { e.stopPropagation(); onViewDetails(pool); }}>
              <Eye className="w-3.5 h-3.5" /> View Details
            </Button>
            <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={handleSolscanClick}>
              <ExternalLink className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.pool.id === nextProps.pool.id &&
    prevProps.pool.priceChange24h === nextProps.pool.priceChange24h &&
    prevProps.pool.liquidity === nextProps.pool.liquidity &&
    prevProps.pool.riskScore === nextProps.pool.riskScore &&
    prevProps.pool.priceUsd === nextProps.pool.priceUsd &&
    prevProps.colorIndex === nextProps.colorIndex &&
    prevProps.isNew === nextProps.isNew &&
    prevProps.holderCount === nextProps.holderCount &&
    prevProps.buyerPosition === nextProps.buyerPosition
  );
});

PoolRow.displayName = 'PoolRow';

// Import formatters
import { 
  formatPercentage, 
  formatCurrency as formatCurrencyValue, 
  calculatePnLValue, 
  getTokenDisplayName, 
  getTokenDisplaySymbol,
  isPlaceholderText,
  shortAddress as formatShortAddress 
} from '@/lib/formatters';

// Legacy helpers (kept for pools display)
const shortAddress = (address: string) => formatShortAddress(address);
const isPlaceholder = (val: string | null | undefined) => isPlaceholderText(val);

// Import SOL price hook for accurate conversions
import { useSolPrice, getSolPriceSync } from '@/hooks/useSolPrice';

// Modern Trade Row - Clean card-like design with clear data hierarchy
const TradeRow = memo(({ trade, colorIndex, onExit }: { 
  trade: ActiveTradePosition; 
  colorIndex: number; 
  onExit?: (id: string, price: number) => void;
}) => {
  // Get SOL price for conversions
  const solPrice = getSolPriceSync();
  
  // CRITICAL: Use entry_value (SOL spent) as ground truth, NOT amount × price_usd
  // entry_value is the actual SOL the user spent to buy tokens
  // current value = entry_value × (current_price / entry_price) i.e. proportional to price change
  const entryPriceUsd = trade.entry_price_usd ?? trade.entry_price ?? 0;
  const currentPriceUsd = trade.current_price ?? entryPriceUsd;
  
  // P&L percentage from price movement (most reliable)
  const pnlPercent = entryPriceUsd > 0 
    ? ((currentPriceUsd - entryPriceUsd) / entryPriceUsd) * 100 
    : (trade.profit_loss_percent ?? 0);
  
  // SOL-based values (what the user actually cares about)
  const entryValueSol = trade.entry_value > 0 ? trade.entry_value : 0;
  const currentValueSol = entryValueSol > 0 && entryPriceUsd > 0
    ? entryValueSol * (currentPriceUsd / entryPriceUsd)
    : 0;
  const pnlValueSol = currentValueSol - entryValueSol;
  
  // USD equivalents
  const entryValueUsd = entryValueSol * solPrice;
  const currentValueUsd = currentValueSol * solPrice;
  const pnlValueUsd = pnlValueSol * solPrice;
  
  const isPositive = pnlPercent >= 0;

  // Use actual token name/symbol, fallback to formatted address
  const displaySymbol = getTokenDisplaySymbol(trade.token_symbol, trade.token_address);
  const displayName = getTokenDisplayName(trade.token_name, trade.token_address);
  
  // Time since entry
  const timeHeld = trade.created_at 
    ? formatDistanceToNow(new Date(trade.created_at), { addSuffix: false })
    : 'N/A';
    
  const initials = displaySymbol.slice(0, 2).toUpperCase();
  const avatarClass = avatarColors[colorIndex % avatarColors.length];

  const handleExit = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onExit?.(trade.id, trade.current_price);
  }, [onExit, trade.id, trade.current_price]);

  
  // Format SOL value with adaptive precision
  const formatSolValue = (val: number, showSign = false) => {
    const sign = showSign && val >= 0 ? '+' : '';
    const absVal = Math.abs(val);
    if (absVal >= 100) return `${sign}${val.toFixed(2)}`;
    if (absVal >= 1) return `${sign}${val.toFixed(4)}`;
    if (absVal >= 0.001) return `${sign}${val.toFixed(6)}`;
    if (absVal >= 0.000001) return `${sign}${val.toFixed(8)}`;
    return `${sign}${val.toFixed(10)}`;
  };

  // Format token amount with appropriate precision
  const formatTokenAmount = (amount: number) => {
    if (amount >= 1000000) return `${(amount / 1000000).toFixed(2)}M`;
    if (amount >= 1000) return `${(amount / 1000).toFixed(1)}K`;
    if (amount >= 1) return amount.toFixed(2);
    return amount.toFixed(4);
  };
  
  // Format USD with adaptive precision
  const formatUsdVal = (val: number, showSign = false) => {
    const sign = showSign && val >= 0 ? '+' : '';
    const absVal = Math.abs(val);
    if (absVal >= 1000) return `${sign}$${val.toFixed(0)}`;
    if (absVal >= 1) return `${sign}$${val.toFixed(2)}`;
    if (absVal >= 0.01) return `${sign}$${val.toFixed(3)}`;
    if (absVal >= 0.001) return `${sign}$${val.toFixed(4)}`;
    return `${sign}$${val.toFixed(6)}`;
  };

  return (
    <div className="px-3 py-3 border-b border-border/10 hover:bg-secondary/30 transition-all duration-200 group">
      <div className="flex items-center gap-3">
        {/* Token Avatar & Info */}
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <TokenImage
            symbol={displaySymbol}
            address={trade.token_address}
            size="md"
          />
          
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-sm text-foreground truncate max-w-[100px]">
                {displaySymbol}
              </span>
              <a 
                href={`https://solscan.io/token/${trade.token_address}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-muted-foreground/40 hover:text-primary transition-colors"
              >
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <div className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                <span>{timeHeld}</span>
              </div>
              <span className="text-muted-foreground/30">•</span>
              <span className="font-mono tabular-nums">{formatTokenAmount(trade.amount)}</span>
            </div>
          </div>
        </div>
        
        {/* Value Column - SOL-native with USD secondary */}
        <div className="text-right min-w-[90px] hidden sm:block">
          <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wide mb-0.5">Value</p>
          <p className="text-sm font-semibold font-mono tabular-nums">
            {formatSolValue(currentValueSol)} <span className="text-muted-foreground text-xs">SOL</span>
          </p>
          <p className="text-[11px] text-muted-foreground font-mono tabular-nums">
            {formatUsdVal(currentValueUsd)}
          </p>
        </div>
        
        {/* P&L Column */}
        <div className="text-right min-w-[80px]">
          <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wide mb-0.5">P&L</p>
          <div className={cn(
            "flex items-center justify-end gap-1 font-bold text-sm tabular-nums",
            isPositive ? 'text-success' : 'text-destructive'
          )}>
            {isPositive ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
            {isPositive ? '+' : ''}{pnlPercent.toFixed(1)}%
          </div>
          <p className={cn(
            "text-[11px] font-mono tabular-nums",
            isPositive ? 'text-success/70' : 'text-destructive/70'
          )}>
            {formatSolValue(pnlValueSol, true)} SOL
          </p>
        </div>
        
        {/* Sell Button */}
        {onExit && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleExit}
            className="h-9 px-4 text-xs font-semibold border-destructive/40 text-destructive hover:bg-destructive hover:text-destructive-foreground hover:border-destructive transition-all shrink-0 gap-1.5"
          >
            <LogOut className="w-3.5 h-3.5" />
            Exit
          </Button>
        )}
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.trade.id === nextProps.trade.id &&
    prevProps.trade.amount === nextProps.trade.amount &&
    prevProps.trade.current_price === nextProps.trade.current_price &&
    prevProps.trade.entry_price === nextProps.trade.entry_price &&
    prevProps.trade.entry_price_usd === nextProps.trade.entry_price_usd &&
    prevProps.trade.token_name === nextProps.trade.token_name &&
    prevProps.trade.token_symbol === nextProps.trade.token_symbol &&
    prevProps.trade.created_at === nextProps.trade.created_at &&
    prevProps.colorIndex === nextProps.colorIndex
  );
});

TradeRow.displayName = 'TradeRow';

// Initial loading skeleton
const PoolSkeleton = memo(() => (
  <div className="grid grid-cols-[1fr_auto] md:grid-cols-[2fr_70px_100px_90px_70px_90px] items-center gap-1 md:gap-2 px-3 py-2.5 border-b border-border/20 animate-pulse">
    <div className="flex items-center gap-2.5">
      <div className="w-9 h-9 rounded-full bg-secondary/60 shrink-0" />
      <div className="space-y-1.5">
        <div className="h-4 w-28 bg-secondary/60 rounded" />
        <div className="h-3 w-16 bg-secondary/40 rounded" />
      </div>
    </div>
    <div className="hidden md:block"><div className="h-3 w-8 bg-secondary/40 rounded mx-auto" /></div>
    <div className="hidden md:block"><div className="h-3 w-14 bg-secondary/40 rounded ml-auto" /></div>
    <div className="hidden md:block"><div className="h-3 w-12 bg-secondary/40 rounded ml-auto" /></div>
    <div className="hidden md:block"><div className="h-3 w-8 bg-secondary/40 rounded mx-auto" /></div>
    <div><div className="h-3 w-12 bg-secondary/40 rounded ml-auto" /></div>
  </div>
));

PoolSkeleton.displayName = 'PoolSkeleton';

const LiquidityMonitor = forwardRef<HTMLDivElement, LiquidityMonitorProps>(function LiquidityMonitor({ 
  pools, 
  activeTrades, 
  waitingPositions = [],
  walletTokens = [],
  loadingWalletTokens = false,
  loading,
  apiStatus = 'waiting',
  onExitTrade,
  onRetryLiquidityCheck,
  onMoveBackFromWaiting,
  onManualSellWaiting,
  onRefreshWalletTokens,
  checkingLiquidity = false,
  isScanningPaused = false,
  onToggleScanning,
  holderData,
  onFetchHolders,
}, ref) {
  const navigate = useNavigate();
  
  // Use Zustand store for persisted tab and search state
  const { activeTab, searchTerm, setActiveTab, setSearchTerm } = useScannerStore();
  
  const [isExpanded, setIsExpanded] = useState(true);
  const [displayCount, setDisplayCount] = useState(10);
  
  // Handle navigation to token detail page
  const handleViewDetails = useCallback((pool: ScannedToken) => {
    const tokenDataParam = encodeURIComponent(JSON.stringify(pool));
    navigate(`/token/${pool.address}?data=${tokenDataParam}`);
  }, [navigate]);
  
  // Track new tokens (added in last 5 seconds) - using refs to avoid re-renders
  const [newTokenIds, setNewTokenIds] = useState<Set<string>>(new Set());
  const prevPoolsLengthRef = useRef(pools.length);
  const clearTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Update new token tracking with useEffect (proper side effect handling)
  useEffect(() => {
    // Only process when pools length increases (new tokens added)
    if (pools.length <= prevPoolsLengthRef.current) {
      prevPoolsLengthRef.current = pools.length;
      return;
    }
    prevPoolsLengthRef.current = pools.length;
    
    const now = Date.now();
    const fiveSecondsAgo = now - 5000;
    const newIds = new Set<string>();
    
    pools.forEach(pool => {
      const createdTime = new Date(pool.createdAt).getTime();
      if (createdTime > fiveSecondsAgo) {
        newIds.add(pool.id);
      }
    });
    
    if (newIds.size > 0) {
      setNewTokenIds(newIds);
      // Clear previous timeout
      if (clearTimeoutRef.current) {
        clearTimeout(clearTimeoutRef.current);
      }
      // Clear after 5 seconds
      clearTimeoutRef.current = setTimeout(() => setNewTokenIds(new Set()), 5000);
    }
    
    return () => {
      if (clearTimeoutRef.current) {
        clearTimeout(clearTimeoutRef.current);
      }
    };
  }, [pools]);
  
  // Memoize filtered pools
  const filteredPools = useMemo(() => 
    pools.filter(p => 
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.symbol.toLowerCase().includes(searchTerm.toLowerCase())
    ), [pools, searchTerm]
  );

  // Displayed pools based on display count
  const displayedPools = useMemo(() => 
    filteredPools.slice(0, displayCount), 
    [filteredPools, displayCount]
  );

  const hasMore = filteredPools.length > displayCount;

  // Memoize open trades - CRITICAL: Show ALL non-closed positions
  // This includes 'open', 'pending', AND 'waiting_for_liquidity' statuses
  // Users should see ALL their active positions in the Active tab (not just in Waiting tab)
  const openTrades = useMemo(() => 
    activeTrades.filter(t => t.status !== 'closed'), 
    [activeTrades]
  );

  // Create set of active token addresses for exclusion in Waiting tab
  // CRITICAL: Include ALL non-closed positions (open, pending, AND waiting_for_liquidity)
  // This prevents wallet tokens from appearing in Waiting tab when they're already tracked as positions
  const activeTokenAddresses = useMemo(() => {
    const addresses = new Set<string>();
    // Include all non-closed positions to prevent duplicates in Waiting tab
    for (const trade of activeTrades) {
      if (trade.status !== 'closed') {
        addresses.add(trade.token_address.toLowerCase());
      }
    }
    return addresses;
  }, [activeTrades]);

  // Calculate combined waiting items count (positions + wallet tokens, excluding active and duplicates)
  const waitingItemsCount = useMemo(() => {
    const seenAddresses = new Set<string>();
    let count = 0;
    
    // Count waiting positions not in active trades
    for (const pos of waitingPositions) {
      const addr = pos.token_address.toLowerCase();
      if (!activeTokenAddresses.has(addr)) {
        seenAddresses.add(addr);
        count++;
      }
    }
    
    // Count wallet tokens not already counted or in active trades
    for (const token of (walletTokens || [])) {
      const addr = token.mint.toLowerCase();
      if (!seenAddresses.has(addr) && !activeTokenAddresses.has(addr)) {
        seenAddresses.add(addr);
        count++;
      }
    }
    
    return count;
  }, [waitingPositions, walletTokens, activeTokenAddresses]);

  // Total P&L in SOL (using entry_value as ground truth)
  const totalPnLSol = useMemo(() => 
    openTrades.reduce((sum, t) => {
      const entryPriceUsd = t.entry_price_usd ?? t.entry_price ?? 0;
      const currentPriceUsd = t.current_price ?? entryPriceUsd;
      const entryVal = t.entry_value > 0 ? t.entry_value : 0;
      const currentVal = entryVal > 0 && entryPriceUsd > 0
        ? entryVal * (currentPriceUsd / entryPriceUsd)
        : 0;
      return sum + (currentVal - entryVal);
    }, 0),
    [openTrades]
  );

  const handleSearchChange = useCallback((value: string) => {
    setSearchTerm(value);
    setDisplayCount(10);
  }, [setSearchTerm]);

  const loadMore = useCallback(() => {
    setDisplayCount(prev => prev + 10);
  }, []);

  const getStatusBadge = () => {
    switch (apiStatus) {
      case 'active':
        return (
          <Badge className="bg-success/20 text-success border-success/30 text-[10px] px-2 py-0.5 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
            Scanning
          </Badge>
        );
      case 'error':
        return <Badge className="bg-destructive/20 text-destructive border-destructive/30 text-[10px] px-2 py-0.5">Error</Badge>;
      case 'rate_limited':
        return <Badge className="bg-warning/20 text-warning border-warning/30 text-[10px] px-2 py-0.5">Rate Limited</Badge>;
      default:
        return <Badge className="bg-muted text-muted-foreground text-[10px] px-2 py-0.5">Idle</Badge>;
    }
  };

  return (
    <Card ref={ref} className="bg-card/80 backdrop-blur-sm border-border/50">
      <CardHeader className="pb-2 px-4 pt-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border border-primary/20">
              <Zap className="w-5 h-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold">Liquidity Monitor</CardTitle>
              <p className="text-xs text-muted-foreground tabular-nums">
                {pools.length} pools detected • {openTrades.length} active trades
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {getStatusBadge()}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </CardHeader>
      
      {isExpanded && (
        <CardContent className="p-0">
          <Tabs value={activeTab} onValueChange={(val) => {
            setActiveTab(val as MonitorTab);
            // Trigger wallet refresh when switching to waiting tab
            if (val === 'waiting' && onRefreshWalletTokens) {
              onRefreshWalletTokens();
            }
          }}>
            <div className="px-4 pb-2">
              <TabsList className="w-full bg-secondary/60 h-9">
                <TabsTrigger 
                  value="pools" 
                  className="flex-1 text-xs h-8 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                >
                  Pools ({filteredPools.length})
                </TabsTrigger>
                <TabsTrigger 
                  value="trades" 
                  className="flex-1 text-xs h-8 data-[state=active]:bg-success data-[state=active]:text-success-foreground"
                >
                  Active ({openTrades.length})
                </TabsTrigger>
                <TabsTrigger 
                  value="waiting" 
                  className={cn(
                    "flex-1 text-xs h-8 gap-1",
                    waitingItemsCount > 0 
                      ? "data-[state=active]:bg-warning data-[state=active]:text-warning-foreground"
                      : "data-[state=active]:bg-muted data-[state=active]:text-muted-foreground"
                  )}
                >
                  <Clock className="w-3 h-3" />
                  Waiting ({waitingItemsCount})
                </TabsTrigger>
              </TabsList>
            </div>
            
            <TabsContent value="pools" className="mt-0">
              {/* Search + Pause/Start Controls */}
              <div className="px-4 pb-3 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by name or symbol..."
                      value={searchTerm}
                      onChange={(e) => handleSearchChange(e.target.value)}
                      className="pl-9 bg-secondary/40 border-border/30 h-9 text-sm"
                    />
                  </div>
                  {onToggleScanning && (
                    <Button
                      variant={isScanningPaused ? "default" : "outline"}
                      size="sm"
                      onClick={onToggleScanning}
                      className={cn(
                        "h-9 gap-1.5 min-w-[90px]",
                        isScanningPaused 
                          ? "bg-success hover:bg-success/90 text-success-foreground" 
                          : "border-warning/50 text-warning hover:bg-warning/10"
                      )}
                    >
                      {isScanningPaused ? (
                        <>
                          <Play className="w-3.5 h-3.5" />
                          Start
                        </>
                      ) : (
                        <>
                          <Pause className="w-3.5 h-3.5" />
                          Pause
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </div>
              
              {/* Column Headers */}
              <div className="grid grid-cols-[1fr_auto] md:grid-cols-[minmax(180px,2fr)_60px_90px_100px_72px_80px_56px_56px_52px_32px] items-center gap-0 px-4 py-2.5 text-[10px] uppercase tracking-wider text-muted-foreground/70 border-y border-border/30 bg-secondary/20 font-medium">
                <div className="pl-1">Pair Info</div>
                <div className="hidden md:block text-center">Age</div>
                <div className="hidden md:block text-right px-2">Liquidity</div>
                <div className="hidden md:block text-right px-2">MCap</div>
                <div className="hidden md:block text-center">Holders</div>
                <div className="hidden md:block text-right px-2">Volume</div>
                <div className="hidden md:block text-center">Source</div>
                <div className="hidden md:block text-center">B/S</div>
                <div className="hidden md:block text-center">Risk</div>
                <div></div>
              </div>
              
              {/* Pool List - No scroll, auto expand */}
              <div className="divide-y divide-border/10">
                {loading && pools.length === 0 ? (
                  // Only show skeleton on initial load
                  <>
                    {[1, 2, 3, 4, 5].map((i) => (
                      <PoolSkeleton key={i} />
                    ))}
                  </>
                ) : displayedPools.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <Zap className="w-10 h-10 mb-3 opacity-20" />
                    <p className="font-medium text-sm mb-1">
                      {searchTerm ? 'No matching pools' : 'No pools detected yet'}
                    </p>
                    <p className="text-xs text-muted-foreground/70">
                      {searchTerm ? 'Try a different search term' : 'Enable the bot to start scanning'}
                    </p>
                  </div>
                ) : (
                  displayedPools.map((pool, idx) => (
                    <PoolRow 
                      key={pool.id} 
                      pool={pool} 
                      colorIndex={idx}
                      isNew={newTokenIds.has(pool.id)}
                      onViewDetails={handleViewDetails}
                      holderCount={holderData?.get(pool.address)?.holderCount}
                      buyerPosition={holderData?.get(pool.address)?.buyerPosition}
                    />
                  ))
                )}
              </div>

              {/* Load More */}
              {hasMore && (
                <div className="px-4 py-3 border-t border-border/30">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={loadMore}
                    className="w-full h-8 text-xs"
                  >
                    Show more ({filteredPools.length - displayCount} remaining)
                  </Button>
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="trades" className="mt-0">
              {/* Trade List - No scroll, auto expand */}
              <div className="divide-y divide-border/10">
                {openTrades.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <DollarSign className="w-10 h-10 mb-3 opacity-20" />
                    <p className="font-medium text-sm mb-1">No active trades</p>
                    <p className="text-xs text-muted-foreground/70">Trades will appear here when executed</p>
                  </div>
                ) : (
                  openTrades.map((trade, idx) => (
                    <TradeRow 
                      key={trade.id} 
                      trade={trade} 
                      colorIndex={idx} 
                      onExit={onExitTrade}
                    />
                  ))
                )}
              </div>
              
              {/* Trades Summary */}
              {openTrades.length > 0 && (
                <div className="px-4 py-3 border-t border-border/30 bg-secondary/10">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Total P&L</span>
                    <span className={cn(
                      "font-bold text-sm tabular-nums",
                      totalPnLSol >= 0 ? 'text-success' : 'text-destructive'
                    )}>
                      {totalPnLSol >= 0 ? '+' : ''}{Math.abs(totalPnLSol) < 0.0001 ? '<0.0001' : totalPnLSol.toFixed(6)} SOL
                    </span>
                  </div>
                </div>
              )}
            </TabsContent>
            
            {/* Waiting for Liquidity Tab */}
            <TabsContent value="waiting" className="mt-0">
              <WaitingLiquidityTab
                positions={waitingPositions}
                walletTokens={walletTokens}
                activeTokenAddresses={activeTokenAddresses}
                checking={checkingLiquidity}
                loadingWalletTokens={loadingWalletTokens}
                onRetryCheck={onRetryLiquidityCheck || (() => {})}
                onMoveBack={onMoveBackFromWaiting || (() => {})}
                onManualSell={onManualSellWaiting || (() => {})}
                onRefreshWalletTokens={onRefreshWalletTokens}
                isTabActive={activeTab === 'waiting'}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      )}
    </Card>
  );
});

LiquidityMonitor.displayName = 'LiquidityMonitor';

export default LiquidityMonitor;
