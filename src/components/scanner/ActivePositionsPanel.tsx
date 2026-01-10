import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, MoreVertical, ExternalLink, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Position {
  id: string;
  token_name: string;
  token_symbol: string;
  token_address?: string;
  amount: number;
  entry_price: number;
  current_price: number;
  profit_loss_percent: number | null;
  profit_loss_value: number | null;
  profit_take_percent?: number;
  stop_loss_percent?: number;
}

interface ActivePositionsPanelProps {
  positions: Position[];
  loading?: boolean;
  onClosePosition?: (positionId: string, currentPrice: number) => void;
  onRefresh?: () => void;
}

export default function ActivePositionsPanel({ 
  positions, 
  loading = false,
  onClosePosition,
  onRefresh,
}: ActivePositionsPanelProps) {
  const avatarColors = [
    'bg-success/20 text-success',
    'bg-blue-500/20 text-blue-400',
    'bg-purple-500/20 text-purple-400',
    'bg-orange-500/20 text-orange-400',
    'bg-pink-500/20 text-pink-400',
    'bg-cyan-500/20 text-cyan-400',
  ];

  // Loading skeleton
  if (loading) {
    return (
      <Card className="bg-card/80 backdrop-blur-sm border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            Active Positions
          </CardTitle>
          <Skeleton className="h-4 w-24" />
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Skeleton className="w-8 h-8 rounded-lg" />
                  <div className="space-y-1">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                </div>
                <div className="space-y-1">
                  <Skeleton className="h-4 w-12 ml-auto" />
                  <Skeleton className="h-3 w-10 ml-auto" />
                </div>
              </div>
              <Skeleton className="h-1.5 w-full" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card/80 backdrop-blur-sm border-border/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              Active Positions
            </CardTitle>
            <p className="text-xs text-muted-foreground">{positions.length} open trades</p>
          </div>
          {onRefresh && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="w-7 h-7"
                  onClick={onRefresh}
                  aria-label="Refresh positions"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">Refresh positions</p>
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {positions.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-sm text-muted-foreground">No active positions</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Positions will appear here when you open trades</p>
          </div>
        ) : (
          positions.slice(0, 5).map((position, index) => {
            const pnlPercent = position.profit_loss_percent || 0;
            const pnlValue = position.profit_loss_value || 0;
            const isPositive = pnlPercent >= 0;
            const progressWidth = Math.min(Math.abs(pnlPercent), 100);

            return (
              <div key={position.id} className="space-y-2 group">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div 
                      className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${avatarColors[index % avatarColors.length]}`}
                      role="img"
                      aria-label={`${position.token_symbol} token`}
                    >
                      {position.token_symbol.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-sm text-foreground">{position.token_name}</span>
                        <span className="text-xs text-muted-foreground">{position.token_symbol}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {position.amount.toLocaleString(undefined, { maximumFractionDigits: 2 })} tokens
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-right">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className={`font-bold text-sm cursor-help ${isPositive ? 'text-success' : 'text-destructive'}`}>
                            {isPositive ? '+' : ''}{pnlPercent.toFixed(1)}%
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="left" className="text-xs">
                          <div className="space-y-1">
                            <p>Entry: ${position.entry_price.toFixed(6)}</p>
                            <p>Current: ${position.current_price.toFixed(6)}</p>
                            {position.profit_take_percent && (
                              <p className="text-success">TP: +{position.profit_take_percent}%</p>
                            )}
                            {position.stop_loss_percent && (
                              <p className="text-destructive">SL: -{position.stop_loss_percent}%</p>
                            )}
                          </div>
                        </TooltipContent>
                      </Tooltip>
                      <p className={`text-xs ${isPositive ? 'text-success/70' : 'text-destructive/70'}`}>
                        {isPositive ? '+' : ''}${pnlValue.toFixed(0)}
                      </p>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="w-6 h-6 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                          aria-label="Position options"
                        >
                          <MoreVertical className="w-3.5 h-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-40">
                        {onClosePosition && (
                          <DropdownMenuItem 
                            onClick={() => onClosePosition(position.id, position.current_price)}
                            className="text-destructive focus:text-destructive"
                          >
                            Close Position
                          </DropdownMenuItem>
                        )}
                        {position.token_address && (
                          <DropdownMenuItem asChild>
                            <a 
                              href={`https://solscan.io/token/${position.token_address}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-2"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                              View on Solscan
                            </a>
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
                
                {/* Price Progress Bar with TP/SL indicators */}
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-muted-foreground min-w-[70px]">Entry: ${position.entry_price.toFixed(5)}</span>
                  <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden relative">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ${isPositive ? 'bg-success' : 'bg-destructive'}`}
                      style={{ width: `${progressWidth}%` }}
                      role="progressbar"
                      aria-valuenow={Math.abs(pnlPercent)}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={`P&L: ${pnlPercent.toFixed(1)}%`}
                    />
                  </div>
                  <span className="text-muted-foreground min-w-[70px] text-right">Current: ${position.current_price.toFixed(5)}</span>
                </div>
              </div>
            );
          })
        )}
        {positions.length > 5 && (
          <p className="text-center text-xs text-muted-foreground pt-2 border-t border-border/50">
            + {positions.length - 5} more positions
          </p>
        )}
      </CardContent>
    </Card>
  );
}
