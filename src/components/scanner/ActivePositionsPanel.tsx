import { memo, useMemo, useCallback, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, MoreVertical, ExternalLink, RefreshCw, ChevronDown, ChevronUp, Trash2, Clock, ArrowUpRight, ArrowDownRight, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import TokenImage from "@/components/ui/TokenImage";
import { 
  formatPrice as formatPriceUtil,
  getTokenDisplayName,
  getTokenDisplaySymbol 
} from "@/lib/formatters";
import { formatDistanceToNow } from "date-fns";

interface Position {
  id: string;
  token_name: string;
  token_symbol: string;
  token_address?: string;
  amount: number;
  entry_price: number;
  entry_price_usd?: number;
  entry_value?: number;
  current_price: number;
  current_value?: number;
  profit_loss_percent: number | null;
  profit_loss_value: number | null;
  profit_take_percent?: number;
  stop_loss_percent?: number;
  created_at?: string;
}

interface ActivePositionsPanelProps {
  positions: Position[];
  loading?: boolean;
  onClosePosition?: (positionId: string, currentPrice: number) => void;
  onForceClose?: (positionId: string) => void;
  onMoveToWaiting?: (positionId: string) => void;
  onRefresh?: () => void;
}

const avatarColors = [
  'bg-gradient-to-br from-success/30 to-success/10 text-success border-success/20',
  'bg-gradient-to-br from-blue-500/30 to-blue-500/10 text-blue-400 border-blue-500/20',
  'bg-gradient-to-br from-purple-500/30 to-purple-500/10 text-purple-400 border-purple-500/20',
  'bg-gradient-to-br from-orange-500/30 to-orange-500/10 text-orange-400 border-orange-500/20',
  'bg-gradient-to-br from-pink-500/30 to-pink-500/10 text-pink-400 border-pink-500/20',
  'bg-gradient-to-br from-cyan-500/30 to-cyan-500/10 text-cyan-400 border-cyan-500/20',
];

const formatPrice = (value: number) => formatPriceUtil(value);

// Format token amount with appropriate precision
const formatTokenAmount = (amount: number) => {
  if (amount >= 1000000) return `${(amount / 1000000).toFixed(2)}M`;
  if (amount >= 1000) return `${(amount / 1000).toFixed(2)}K`;
  if (amount >= 1) return amount.toFixed(2);
  if (amount >= 0.001) return amount.toFixed(5);
  return amount.toFixed(8);
};

// Format USD value with appropriate precision
const formatUsdCompact = (val: number) => {
  const absVal = Math.abs(val);
  if (absVal >= 1000) return `$${val.toFixed(0)}`;
  if (absVal >= 1) return `$${val.toFixed(2)}`;
  if (absVal >= 0.01) return `$${val.toFixed(3)}`;
  return `$${val.toFixed(4)}`;
};

// Format P&L value with sign
const formatPnLValue = (val: number) => {
  const sign = val >= 0 ? '+' : '';
  return `${sign}${formatUsdCompact(val)}`;
};

// Memoized position row - Enhanced with more user-friendly info
const PositionRow = memo(({ 
  position, 
  colorIndex, 
  onClosePosition,
  onForceClose,
  onMoveToWaiting
}: { 
  position: Position; 
  colorIndex: number;
  onClosePosition?: (positionId: string, currentPrice: number) => void;
  onForceClose?: (positionId: string) => void;
  onMoveToWaiting?: (positionId: string) => void;
}) => {
  // Calculate values accurately from amount × prices
  const entryPriceUsd = position.entry_price_usd ?? position.entry_price;
  const currentPriceUsd = position.current_price ?? entryPriceUsd;
  
  // Calculate P&L from prices (not stored values which may be inconsistent)
  const entryValueUsd = position.amount * entryPriceUsd;
  const currentValueUsd = position.amount * currentPriceUsd;
  const pnlValueUsd = currentValueUsd - entryValueUsd;
  const pnlPercent = entryValueUsd > 0 ? ((currentValueUsd - entryValueUsd) / entryValueUsd) * 100 : 0;
  
  const isPositive = pnlPercent >= 0;
  const progressWidth = Math.min(Math.abs(pnlPercent), 100);

  // Use actual token name/symbol, fallback to formatted address
  const displaySymbol = getTokenDisplaySymbol(position.token_symbol, position.token_address || '');
  const displayName = getTokenDisplayName(position.token_name, position.token_address || '');
  
  // Time since entry
  const timeHeld = position.created_at 
    ? formatDistanceToNow(new Date(position.created_at), { addSuffix: false })
    : 'N/A';

  const handleClose = useCallback(() => {
    onClosePosition?.(position.id, position.current_price);
  }, [onClosePosition, position.id, position.current_price]);

  const handleForceClose = useCallback(() => {
    onForceClose?.(position.id);
  }, [onForceClose, position.id]);

  const handleMoveToWaiting = useCallback(() => {
    onMoveToWaiting?.(position.id);
  }, [onMoveToWaiting, position.id]);

  return (
    <div className="px-4 py-3.5 border-b border-border/20 hover:bg-secondary/30 transition-all duration-200 group">
      {/* Main Row */}
      <div className="flex items-center justify-between gap-3">
        {/* Left: Avatar + Token Info */}
        <div className="flex items-center gap-3.5 flex-1 min-w-0">
          <TokenImage
            symbol={displaySymbol}
            address={position.token_address || ''}
            size="lg"
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-semibold text-sm md:text-base text-foreground truncate max-w-[120px] md:max-w-[160px]">
                {displayName}
              </span>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 bg-secondary/50 shrink-0">
                {displaySymbol}
              </Badge>
            </div>
            {/* Token amount + Time held */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="tabular-nums">{formatTokenAmount(position.amount)} tokens</span>
              <span className="text-border">•</span>
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {timeHeld}
              </span>
            </div>
          </div>
        </div>
        
        {/* Right: P&L Display + Actions */}
        <div className="flex items-center gap-2 md:gap-3 shrink-0">
          {/* P&L Column */}
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="text-right cursor-help min-w-[80px] md:min-w-[100px]">
                {/* P&L Percentage - Main */}
                <div className={cn(
                  "flex items-center justify-end gap-1 font-bold text-sm md:text-base tabular-nums",
                  isPositive ? 'text-success' : 'text-destructive'
                )}>
                  {isPositive ? (
                    <ArrowUpRight className="w-4 h-4" />
                  ) : (
                    <ArrowDownRight className="w-4 h-4" />
                  )}
                  {isPositive ? '+' : ''}{pnlPercent.toFixed(2)}%
                </div>
                {/* P&L Value - Secondary */}
                <p className={cn(
                  "text-[11px] md:text-xs tabular-nums font-medium",
                  isPositive ? 'text-success/80' : 'text-destructive/80'
                )}>
                  {formatPnLValue(pnlValueUsd)}
                </p>
              </div>
            </TooltipTrigger>
            <TooltipContent side="left" className="bg-popover border-border text-xs max-w-[220px]">
              <div className="space-y-1.5 p-1">
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Tokens:</span>
                  <span className="tabular-nums font-medium">{formatTokenAmount(position.amount)}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Entry Price:</span>
                  <span className="tabular-nums">{formatPrice(entryPriceUsd)}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Current Price:</span>
                  <span className="tabular-nums">{formatPrice(currentPriceUsd)}</span>
                </div>
                <div className="border-t border-border/50 my-1.5" />
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Entry Value:</span>
                  <span className="tabular-nums">{formatUsdCompact(entryValueUsd)}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Current Value:</span>
                  <span className="tabular-nums font-medium">{formatUsdCompact(currentValueUsd)}</span>
                </div>
                <div className={cn("flex justify-between gap-4 font-medium", isPositive ? 'text-success' : 'text-destructive')}>
                  <span>P&L:</span>
                  <span className="tabular-nums">{formatPnLValue(pnlValueUsd)} ({isPositive ? '+' : ''}{pnlPercent.toFixed(2)}%)</span>
                </div>
                {position.profit_take_percent && (
                  <div className="flex justify-between gap-4 text-success/70">
                    <span>TP Target:</span>
                    <span>+{position.profit_take_percent}%</span>
                  </div>
                )}
                {position.stop_loss_percent && (
                  <div className="flex justify-between gap-4 text-destructive/70">
                    <span>SL Target:</span>
                    <span>-{position.stop_loss_percent}%</span>
                  </div>
                )}
              </div>
            </TooltipContent>
          </Tooltip>
          
          {/* Sell Button */}
          {onClosePosition && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleClose}
              className="h-8 px-3 text-xs font-medium border-destructive/30 text-destructive hover:bg-destructive/10 hover:border-destructive/50 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              Sell
            </Button>
          )}
          
          {/* More Actions */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon" 
                className="w-8 h-8 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 bg-popover border-border">
              {onClosePosition && (
                <DropdownMenuItem 
                  onClick={handleClose}
                  className="cursor-pointer"
                >
                  <DollarSign className="w-3.5 h-3.5 mr-2" />
                  Sell & Close
                </DropdownMenuItem>
              )}
              {onMoveToWaiting && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    onClick={handleMoveToWaiting}
                    className="text-warning focus:text-warning cursor-pointer"
                  >
                    <Clock className="w-3.5 h-3.5 mr-2" />
                    Move to Waiting List
                  </DropdownMenuItem>
                </>
              )}
              {onForceClose && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    onClick={handleForceClose}
                    className="text-destructive focus:text-destructive cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-2" />
                    Force Close (No Sell)
                  </DropdownMenuItem>
                </>
              )}
              {position.token_address && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <a 
                      href={`https://solscan.io/token/${position.token_address}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 cursor-pointer"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      View on Solscan
                    </a>
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      
      {/* Price Progress Bar */}
      <div className="mt-3.5 flex items-center gap-3 text-[11px] md:text-xs">
        <div className="flex flex-col items-start min-w-[75px] md:min-w-[90px]">
          <span className="text-muted-foreground/70 text-[9px] uppercase tracking-wide">Entry</span>
          <span className="text-muted-foreground tabular-nums font-medium">
            {formatPrice(entryPriceUsd)}
          </span>
        </div>
        <div className="flex-1 h-2.5 bg-secondary rounded-full overflow-hidden relative">
          <div 
            className={cn(
              "h-full rounded-full transition-all duration-500 ease-out",
              isPositive ? 'bg-gradient-to-r from-success/60 to-success' : 'bg-gradient-to-r from-destructive to-destructive/60'
            )}
            style={{ width: `${progressWidth}%` }}
          />
        </div>
        <div className="flex flex-col items-end min-w-[75px] md:min-w-[90px]">
          <span className="text-muted-foreground/70 text-[9px] uppercase tracking-wide">Current</span>
          <span className={cn(
            "tabular-nums font-medium",
            isPositive ? 'text-success' : 'text-destructive'
          )}>
            {formatPrice(currentPriceUsd)}
          </span>
        </div>
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  // STABLE COMPARISON: Only re-render when source-of-truth values change
  return (
    prevProps.position.id === nextProps.position.id &&
    prevProps.position.amount === nextProps.position.amount &&
    prevProps.position.current_price === nextProps.position.current_price &&
    prevProps.position.entry_price === nextProps.position.entry_price &&
    prevProps.position.entry_price_usd === nextProps.position.entry_price_usd &&
    prevProps.position.token_name === nextProps.position.token_name &&
    prevProps.position.token_symbol === nextProps.position.token_symbol &&
    prevProps.position.created_at === nextProps.position.created_at &&
    prevProps.colorIndex === nextProps.colorIndex
  );
});

PositionRow.displayName = 'PositionRow';

// Loading skeleton
const PositionSkeleton = memo(() => (
  <div className="px-4 py-3 border-b border-border/20 animate-pulse">
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-secondary/60" />
        <div className="space-y-1.5">
          <div className="h-4 w-24 bg-secondary/60 rounded" />
          <div className="h-3 w-16 bg-secondary/40 rounded" />
        </div>
      </div>
      <div className="space-y-1.5">
        <div className="h-4 w-14 bg-secondary/60 rounded ml-auto" />
        <div className="h-3 w-10 bg-secondary/40 rounded ml-auto" />
      </div>
    </div>
    <div className="mt-2.5 h-2 w-full bg-secondary/40 rounded" />
  </div>
));

PositionSkeleton.displayName = 'PositionSkeleton';

export default function ActivePositionsPanel({ 
  positions, 
  loading = false,
  onClosePosition,
  onForceClose,
  onMoveToWaiting,
  onRefresh,
}: ActivePositionsPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [showAll, setShowAll] = useState(false);
  
  // Display all or first 5
  const displayedPositions = useMemo(() => 
    showAll ? positions : positions.slice(0, 5), 
    [positions, showAll]
  );
  
  const remainingCount = positions.length - 5;

  // Total P&L in actual USD (amount × current_price - amount × entry_price_usd)
  // CRITICAL: Always use entry_price_usd for consistent USD calculations
  const totalPnL = useMemo(() => 
    positions.reduce((sum, p) => {
      const entryPriceUsd = p.entry_price_usd ?? p.entry_price;
      const currentVal = p.amount * p.current_price;
      const entryVal = p.amount * entryPriceUsd;
      return sum + (currentVal - entryVal);
    }, 0),
    [positions]
  );
  
  // Format total P&L
  const formatTotalPnL = (value: number) => {
    const sign = value >= 0 ? '+' : '';
    if (Math.abs(value) < 0.01) return `${sign}<$0.01`;
    return `${sign}$${value.toFixed(2)}`;
  };

  if (loading) {
    return (
      <Card className="bg-card/80 backdrop-blur-sm border-border/50">
        <CardHeader className="pb-2 px-4 pt-4">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            Active Positions
          </CardTitle>
          <div className="h-4 w-24 bg-secondary/60 rounded animate-pulse" />
        </CardHeader>
        <CardContent className="p-0">
          {[1, 2, 3].map((i) => (
            <PositionSkeleton key={i} />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card/80 backdrop-blur-sm border-border/50">
      <CardHeader className="pb-2 px-3 md:px-4 pt-3 md:pt-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
            <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg md:rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border border-primary/20 shrink-0">
              <TrendingUp className="w-4 h-4 md:w-5 md:h-5 text-primary" />
            </div>
            <div className="min-w-0">
              <CardTitle className="text-sm md:text-base font-semibold truncate">Active Positions</CardTitle>
              <p className="text-[10px] md:text-xs text-muted-foreground tabular-nums">
                {positions.length} open trades
                {positions.length > 0 && (
                  <span className={cn(
                    "ml-1.5 md:ml-2 font-medium",
                    totalPnL >= 0 ? 'text-success' : 'text-destructive'
                  )}>
                    ({formatTotalPnL(totalPnL)})
                  </span>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-0.5 md:gap-1 shrink-0">
            {onRefresh && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="w-8 h-8"
                    onClick={onRefresh}
                  >
                    <RefreshCw className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="bg-popover border-border">
                  <p className="text-xs">Refresh positions</p>
                </TooltipContent>
              </Tooltip>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="w-8 h-8"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </CardHeader>
      
      {isExpanded && (
        <CardContent className="p-0">
          {positions.length === 0 ? (
            <div className="text-center py-10">
              <TrendingUp className="w-10 h-10 mx-auto mb-3 text-muted-foreground/20" />
              <p className="text-sm text-muted-foreground font-medium">No active positions</p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                Positions will appear here when you open trades
              </p>
            </div>
          ) : (
            <>
              {displayedPositions.map((position, index) => (
                <PositionRow
                  key={position.id}
                  position={position}
                  colorIndex={index}
                  onClosePosition={onClosePosition}
                  onForceClose={onForceClose}
                  onMoveToWaiting={onMoveToWaiting}
                />
              ))}
              
              {remainingCount > 0 && !showAll && (
                <div className="px-4 py-3 border-t border-border/30">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAll(true)}
                    className="w-full h-8 text-xs"
                  >
                    Show all ({remainingCount} more)
                  </Button>
                </div>
              )}
              
              {showAll && remainingCount > 0 && (
                <div className="px-4 py-3 border-t border-border/30">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowAll(false)}
                    className="w-full h-8 text-xs text-muted-foreground"
                  >
                    Show less
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      )}
    </Card>
  );
}
