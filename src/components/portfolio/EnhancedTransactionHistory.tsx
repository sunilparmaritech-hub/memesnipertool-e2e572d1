import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  History,
  RefreshCw,
  Loader2,
  ExternalLink,
  Filter,
  Download,
  FileText,
  FileSpreadsheet,
  FileJson,
  Search,
  X,
  RefreshCcw,
  AlertTriangle,
} from 'lucide-react';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { format } from 'date-fns';
import { TradeHistoryEntry } from '@/hooks/useTradeHistory';
import { isPlaceholderTokenText } from '@/lib/dexscreener';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { formatPreciseNumber } from '@/lib/precision';

interface EnhancedTransactionHistoryProps {
  trades: TradeHistoryEntry[];
  loading: boolean;
  onRefetch: () => void;
  onForceSync?: () => void;
  // Position data for matching buy/sell pairs
  positionData?: Map<string, {
    buyerPosition?: number | null;
    liquidity?: number | null;
    riskScore?: number | null;
    entryPrice?: number | null;
    exitPrice?: number | null;
    slippage?: number | null;
  }>;
}

type TradeTypeFilter = 'all' | 'buy' | 'sell';

const shortAddress = (address: string) =>
  address && address.length > 10
    ? `${address.slice(0, 4)}…${address.slice(-4)}`
    : address || '-';

const formatLiquidity = (value: number | null | undefined) => {
  if (value === null || value === undefined || !Number.isFinite(value)) return '-';
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  // For small values, preserve precision
  if (value < 1) return `$${value.toFixed(4)}`;
  return `$${value.toFixed(2)}`;
};

export function EnhancedTransactionHistory({ 
  trades, 
  loading, 
  onRefetch, 
  onForceSync,
  positionData = new Map()
}: EnhancedTransactionHistoryProps) {
  const [exporting, setExporting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [tradeTypeFilter, setTradeTypeFilter] = useState<TradeTypeFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const handleForceSync = async () => {
    if (!onForceSync) return;
    setSyncing(true);
    try {
      await onForceSync();
    } finally {
      setSyncing(false);
    }
  };

  // Filter trades - only show confirmed trades with tx_hash
  const filteredTrades = useMemo(() => {
    return trades.filter(trade => {
      // CRITICAL: Skip entries without tx_hash - these are fake/non-trade movements
      if (!trade.tx_hash) return false;
      
      // Trade type filter
      if (tradeTypeFilter !== 'all' && trade.trade_type !== tradeTypeFilter) return false;
      
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const symbol = trade.token_symbol?.toLowerCase() || '';
        const name = trade.token_name?.toLowerCase() || '';
        const address = trade.token_address.toLowerCase();
        
        if (!symbol.includes(query) && !name.includes(query) && !address.includes(query)) {
          return false;
        }
      }
      
      return true;
    });
  }, [trades, tradeTypeFilter, searchQuery]);

  // Calculate running balance using semantic SOL columns
  // CRITICAL: Use sol_spent/sol_received as source of truth, fallback to price_sol for legacy data
  const tradesWithMetrics = useMemo(() => {
    // Sort by date ascending for running balance calculation
    const sortedByDate = [...filteredTrades].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
    
    // Skip corrupted transactions
    const validTrades = sortedByDate.filter(t => !t.is_corrupted);
    
    let runningBalance = 0;
    
    const withMetrics = validTrades.map(trade => {
      const posData = positionData.get(trade.token_address);
      const isBuy = trade.trade_type === 'buy';
      
      // SEMANTIC COLUMNS: Use sol_spent/sol_received as primary source
      // These are the on-chain verified values
      const solSpent = trade.sol_spent ?? (isBuy ? trade.price_sol : 0) ?? 0;
      const solReceived = trade.sol_received ?? (!isBuy ? trade.price_sol : 0) ?? 0;
      
      // Update running balance
      if (isBuy) {
        runningBalance -= solSpent;
      } else {
        runningBalance += solReceived;
      }
      
      // Use database-stored P&L and ROI (calculated from SOL delta, not price math)
      // CRITICAL: Only show ROI for SELL transactions with valid data
      const pnlSol = !isBuy ? (trade.realized_pnl_sol ?? null) : null;
      const roiPercent = !isBuy ? (trade.roi_percent ?? null) : null;
      
      // Entry/exit prices from database
      const entryPrice = trade.entry_price ?? posData?.entryPrice ?? null;
      const exitPrice = trade.exit_price ?? posData?.exitPrice ?? null;
      
      return {
        ...trade,
        runningBalance,
        // Semantic values
        solSpent,
        solReceived,
        // P&L (only for SELL, from database)
        pnlSol,
        roiPercent,
        // Metadata
        entryPrice,
        exitPrice,
        buyerPosition: trade.buyer_position ?? posData?.buyerPosition ?? null,
        liquidity: trade.liquidity ?? posData?.liquidity ?? null,
        riskScore: trade.risk_score ?? posData?.riskScore ?? null,
        slippage: trade.slippage ?? posData?.slippage ?? null,
      };
    });
    
    // Reverse to show newest first
    return withMetrics.reverse();
  }, [filteredTrades, positionData]);

  // Stats
  const stats = useMemo(() => {
    const buys = filteredTrades.filter(t => t.trade_type === 'buy');
    const sells = filteredTrades.filter(t => t.trade_type === 'sell');
    const totalBuySol = buys.reduce((sum, t) => sum + (t.price_sol || 0), 0);
    const totalSellSol = sells.reduce((sum, t) => sum + (t.price_sol || 0), 0);
    
    return {
      total: filteredTrades.length,
      buys: buys.length,
      sells: sells.length,
      totalBuySol,
      totalSellSol,
      netPnl: totalSellSol - totalBuySol,
    };
  }, [filteredTrades]);

  // Export functions
  const exportToCSV = () => {
    if (tradesWithMetrics.length === 0) {
      toast.error('No transactions to export');
      return;
    }

    setExporting(true);
    try {
      const headers = ['Time (UTC)', 'Action', 'Token', 'Buyer#', 'Liquidity', 'Risk', 'SOL In', 'SOL Out', 'Entry', 'Exit', 'PnL (SOL)', 'ROI%', 'Slippage', 'Status', 'TX'];
      const rows = tradesWithMetrics.map(trade => [
        format(new Date(trade.created_at), 'yyyy-MM-dd HH:mm:ss'),
        trade.trade_type.toUpperCase(),
        trade.token_symbol || shortAddress(trade.token_address),
        trade.buyerPosition ? `#${trade.buyerPosition}` : '-',
        trade.liquidity ? formatLiquidity(trade.liquidity) : '-',
        trade.riskScore ? `${trade.riskScore}/100` : '-',
        trade.trade_type === 'buy' ? trade.price_sol?.toFixed(4) || '-' : '-',
        trade.trade_type === 'sell' ? trade.price_sol?.toFixed(4) || '-' : '-',
        trade.entryPrice?.toFixed(8) || '-',
        trade.exitPrice?.toFixed(8) || '-',
        trade.pnlSol?.toFixed(4) || '-',
        trade.roiPercent ? `${trade.roiPercent.toFixed(1)}%` : '-',
        trade.slippage ? `${trade.slippage.toFixed(1)}%` : '-',
        trade.status || 'pending',
        trade.tx_hash || '-',
      ]);

      const escapeCSV = (value: string) => {
        if (value.includes(',') || value.includes('"') || value.includes('\n')) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      };

      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => escapeCSV(String(cell))).join(',')),
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `transactions_${format(new Date(), 'yyyy-MM-dd')}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success('CSV exported successfully');
    } catch (error) {
      toast.error('Export failed');
    } finally {
      setExporting(false);
    }
  };

  const exportToJSON = () => {
    if (tradesWithMetrics.length === 0) {
      toast.error('No transactions to export');
      return;
    }

    setExporting(true);
    try {
      const jsonContent = JSON.stringify(tradesWithMetrics, null, 2);
      const blob = new Blob([jsonContent], { type: 'application/json' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `transactions_${format(new Date(), 'yyyy-MM-dd')}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success('JSON exported successfully');
    } catch (error) {
      toast.error('Export failed');
    } finally {
      setExporting(false);
    }
  };

  const clearFilters = () => {
    setTradeTypeFilter('all');
    setSearchQuery('');
  };

  const hasActiveFilters = tradeTypeFilter !== 'all' || searchQuery !== '';

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-4">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-base flex items-center gap-2">
              <History className="w-5 h-5 text-primary" />
              Transaction History
              <Badge variant="secondary" className="ml-2">{stats.total}</Badge>
            </CardTitle>
            
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" disabled={exporting || tradesWithMetrics.length === 0}>
                    {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                    <span className="hidden sm:inline ml-2">Export</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-card border-border z-50">
                  <DropdownMenuItem onClick={exportToCSV}>
                    <FileSpreadsheet className="w-4 h-4 mr-2" />
                    Export as CSV
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={exportToJSON}>
                    <FileJson className="w-4 h-4 mr-2" />
                    Export as JSON
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <Button
                variant={showFilters ? 'secondary' : 'outline'}
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
              >
                <Filter className="w-4 h-4" />
                {hasActiveFilters && (
                  <Badge variant="default" className="ml-2 h-5 w-5 p-0 flex items-center justify-center text-xs">!</Badge>
                )}
              </Button>

              {onForceSync && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleForceSync} 
                  disabled={loading || syncing}
                  className="border-primary/50 text-primary hover:bg-primary/10"
                  title="Sync missing transactions"
                >
                  {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCcw className="w-4 h-4" />}
                </Button>
              )}

              <Button variant="outline" size="sm" onClick={onRefetch} disabled={loading}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              </Button>
            </div>
          </div>

          {/* Filter Panel */}
          {showFilters && (
            <div className="flex flex-wrap items-center gap-3 p-4 bg-secondary/30 rounded-lg border border-border">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search token..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>

              <Select value={tradeTypeFilter} onValueChange={(v) => setTradeTypeFilter(v as TradeTypeFilter)}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Trade Type" />
                </SelectTrigger>
                <SelectContent className="bg-card border-border z-50">
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="buy">Buy Only</SelectItem>
                  <SelectItem value="sell">Sell Only</SelectItem>
                </SelectContent>
              </Select>

              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  <X className="w-4 h-4 mr-1" />
                  Clear
                </Button>
              )}
            </div>
          )}

          {/* Quick Stats */}
          <div className="flex flex-wrap gap-3 text-sm">
            <Badge variant="outline" className="bg-success/10 text-success border-success/30">
              {stats.buys} Buys ({stats.totalBuySol.toFixed(2)} SOL)
            </Badge>
            <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30">
              {stats.sells} Sells ({stats.totalSellSol.toFixed(2)} SOL)
            </Badge>
            <Badge variant="outline" className={cn(
              stats.netPnl >= 0 ? "bg-success/10 text-success border-success/30" : "bg-destructive/10 text-destructive border-destructive/30"
            )}>
              Net P&L: {stats.netPnl >= 0 ? '+' : ''}{stats.netPnl.toFixed(4)} SOL
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {loading && trades.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : tradesWithMetrics.length === 0 ? (
          <div className="p-12 text-center">
            <History className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No transactions yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-secondary/30 hover:bg-secondary/30">
                  <TableHead className="text-xs font-semibold whitespace-nowrap">Time (UTC)</TableHead>
                  <TableHead className="text-xs font-semibold">Action</TableHead>
                  <TableHead className="text-xs font-semibold">Token</TableHead>
                  <TableHead className="text-xs font-semibold text-center">Buyer#</TableHead>
                  <TableHead className="text-xs font-semibold text-right">Liquidity</TableHead>
                  <TableHead className="text-xs font-semibold text-center">Risk</TableHead>
                  <TableHead className="text-xs font-semibold text-right">SOL Spent</TableHead>
                  <TableHead className="text-xs font-semibold text-right">SOL Received</TableHead>
                  <TableHead className="text-xs font-semibold text-right">Entry $</TableHead>
                  <TableHead className="text-xs font-semibold text-right">Exit $</TableHead>
                  <TableHead className="text-xs font-semibold text-right">PnL (SOL)</TableHead>
                  <TableHead className="text-xs font-semibold text-right">ROI%</TableHead>
                  <TableHead className="text-xs font-semibold text-right">Slippage</TableHead>
                  <TableHead className="text-xs font-semibold text-center">Status</TableHead>
                  <TableHead className="text-xs font-semibold text-right">TX</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tradesWithMetrics.map((trade) => {
                  const isBuy = trade.trade_type === 'buy';
                  const statusColors: Record<string, string> = {
                    confirmed: 'text-success',
                    success: 'text-success',
                    failed: 'text-destructive',
                    pending: 'text-warning',
                  };
                  const statusColor = statusColors[trade.status?.toLowerCase() || 'pending'] || 'text-muted-foreground';
                  
                  return (
                    <TableRow key={trade.id} className="hover:bg-secondary/20 border-b border-border/50">
                      <TableCell className="text-xs font-mono whitespace-nowrap">
                        <div>{format(new Date(trade.created_at), 'yyyy-MM-dd')}</div>
                        <div className="text-muted-foreground">{format(new Date(trade.created_at), 'HH:mm:ss')}</div>
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant="outline" 
                          className={cn(
                            "font-semibold text-xs",
                            isBuy 
                              ? "bg-success/10 text-success border-success/30" 
                              : "bg-destructive/10 text-destructive border-destructive/30"
                          )}
                        >
                          {trade.trade_type.toUpperCase()}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <span className="font-medium text-foreground">
                            {!isPlaceholderTokenText(trade.token_symbol) ? trade.token_symbol : shortAddress(trade.token_address)}
                          </span>
                          {trade.is_corrupted && (
                            <HoverCard>
                              <HoverCardTrigger asChild>
                                <AlertTriangle className="w-3.5 h-3.5 text-destructive cursor-help flex-shrink-0" />
                              </HoverCardTrigger>
                              <HoverCardContent side="right" className="w-72 text-xs">
                                <div className="space-y-2">
                                  <p className="font-semibold text-destructive flex items-center gap-1">
                                    <AlertTriangle className="w-3.5 h-3.5" /> Flagged Token
                                  </p>
                                  <p className="text-muted-foreground leading-relaxed">
                                    {trade.corruption_reason || 'This token was flagged as suspicious after execution. Liquidity may have been removed immediately after buy (rug pull pattern).'}
                                  </p>
                                  <div className="pt-1 border-t border-border">
                                    <p className="font-medium text-foreground mb-1">Gates that should block this:</p>
                                    <ul className="list-disc list-inside text-muted-foreground space-y-0.5">
                                      <li>Suspicious name pattern detection</li>
                                      <li>Deployer reputation scoring</li>
                                      <li>Post-buy liquidity stability check</li>
                                      <li>Observation delay enforcement</li>
                                    </ul>
                                  </div>
                                </div>
                              </HoverCardContent>
                            </HoverCard>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="font-mono text-xs">
                          {trade.buyerPosition ? `#${trade.buyerPosition}` : '—'}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {formatLiquidity(trade.liquidity)}
                      </TableCell>
                      <TableCell className="text-center">
                        {trade.riskScore !== null ? (
                          <span className={cn(
                            "font-mono text-xs",
                            trade.riskScore <= 40 ? "text-success" :
                            trade.riskScore <= 70 ? "text-warning" : "text-destructive"
                          )}>
                            {trade.riskScore}/100
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {isBuy && trade.solSpent > 0 ? (
                          <span className="text-foreground">{formatPreciseNumber(trade.solSpent)}</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {!isBuy && trade.solReceived > 0 ? (
                          <span className="text-foreground">{formatPreciseNumber(trade.solReceived)}</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {trade.entryPrice ? formatPreciseNumber(trade.entryPrice) : '—'}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {trade.exitPrice ? formatPreciseNumber(trade.exitPrice) : '—'}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {trade.pnlSol !== null ? (
                          <span className={cn(
                            "font-semibold",
                            trade.pnlSol >= 0 ? "text-success" : "text-destructive"
                          )}>
                            {formatPreciseNumber(trade.pnlSol, { showSign: true })}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {trade.roiPercent !== null ? (
                          <span className={cn(
                            "font-semibold",
                            trade.roiPercent >= 0 ? "text-success" : "text-destructive"
                          )}>
                            {trade.roiPercent >= 0 ? '+' : ''}{trade.roiPercent.toFixed(1)}%
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {trade.slippage !== null && trade.slippage !== undefined ? (
                          <span className="text-muted-foreground">{trade.slippage.toFixed(1)}%</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <span className={cn("font-medium text-xs capitalize", statusColor)}>
                          {trade.status === 'confirmed' ? 'Success' : (trade.status || 'Pending')}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        {trade.tx_hash ? (
                          <a
                            href={`https://solscan.io/tx/${trade.tx_hash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-mono"
                          >
                            {shortAddress(trade.tx_hash)}
                          </a>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
