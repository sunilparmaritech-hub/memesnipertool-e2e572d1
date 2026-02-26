import React, { useMemo, useState } from "react";
import { format } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  ExternalLink, 
  Download, 
  FileSpreadsheet, 
  FileJson, 
  Loader2 
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Transaction {
  id: string;
  token_address: string;
  token_symbol: string | null;
  token_name: string | null;
  trade_type: 'buy' | 'sell';
  amount: number;
  price_sol: number | null;
  price_usd: number | null;
  status: string | null;
  tx_hash: string | null;
  created_at: string;
  // Extended metadata columns
  buyer_position?: number | null;
  liquidity?: number | null;
  risk_score?: number | null;
  entry_price?: number | null;
  exit_price?: number | null;
  slippage?: number | null;
}

interface EnhancedUserTransactionTableProps {
  transactions: Transaction[];
  loading?: boolean;
  userName?: string;
}

const shortAddress = (address: string) =>
  address && address.length > 10
    ? `${address.slice(0, 4)}…${address.slice(-4)}`
    : address || '-';

const formatLiquidity = (value: number | null | undefined) => {
  if (value === null || value === undefined) return '-';
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
};

export function EnhancedUserTransactionTable({ 
  transactions, 
  loading,
  userName = "User" 
}: EnhancedUserTransactionTableProps) {
  const [exporting, setExporting] = useState(false);

  // Filter out fake transactions (no tx_hash = not a real on-chain swap)
  const validTransactions = useMemo(() => 
    transactions.filter(tx => tx.tx_hash !== null && tx.tx_hash !== undefined),
    [transactions]
  );

  // Calculate running balance and P&L for matched trades
  const transactionsWithMetrics = useMemo(() => {
    const sortedByDate = [...validTransactions].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
    
    // Track buys per token for matching sells
    const tokenBuys = new Map<string, { price: number; amount: number; solSpent: number }[]>();
    let runningBalance = 0;
    
    const withMetrics = sortedByDate.map(tx => {
      const solAmount = tx.price_sol || 0;
      
      let entryPrice: number | null = null;
      let exitPrice: number | null = null;
      let pnlSol: number | null = null;
      let roiPercent: number | null = null;
      
      if (tx.trade_type === 'buy') {
        runningBalance -= solAmount;
        entryPrice = tx.price_usd ? tx.price_usd / tx.amount : null;
        
        // Store this buy for future sell matching
        const buys = tokenBuys.get(tx.token_address) || [];
        buys.push({ 
          price: entryPrice || 0, 
          amount: tx.amount, 
          solSpent: solAmount 
        });
        tokenBuys.set(tx.token_address, buys);
      } else {
        runningBalance += solAmount;
        exitPrice = tx.price_usd ? tx.price_usd / tx.amount : null;
        
        // Match with previous buy for P&L calculation
        const buys = tokenBuys.get(tx.token_address);
        if (buys && buys.length > 0) {
          const matchedBuy = buys[0]; // FIFO matching
          entryPrice = matchedBuy.price;
          
          if (matchedBuy.solSpent > 0) {
            pnlSol = solAmount - matchedBuy.solSpent;
            roiPercent = ((solAmount - matchedBuy.solSpent) / matchedBuy.solSpent) * 100;
          }
          
          // Remove matched buy
          buys.shift();
        }
      }
      
      return {
        ...tx,
        runningBalance,
        entryPrice: tx.entry_price ?? entryPrice,
        exitPrice: tx.exit_price ?? exitPrice,
        buyerPosition: tx.buyer_position ?? null,
        liquidity: tx.liquidity ?? null,
        riskScore: tx.risk_score ?? null,
        slippage: tx.slippage ?? null,
        pnlSol,
        roiPercent,
      };
    });
    
    // Reverse to show newest first
    return withMetrics.reverse();
  }, [validTransactions]);

  // Stats
  const stats = useMemo(() => {
    const buys = validTransactions.filter(t => t.trade_type === 'buy');
    const sells = validTransactions.filter(t => t.trade_type === 'sell');
    const totalBuySol = buys.reduce((sum, t) => sum + (t.price_sol || 0), 0);
    const totalSellSol = sells.reduce((sum, t) => sum + (t.price_sol || 0), 0);
    
    return {
      total: validTransactions.length,
      buys: buys.length,
      sells: sells.length,
      totalBuySol,
      totalSellSol,
      netPnl: totalSellSol - totalBuySol,
    };
  }, [validTransactions]);

  // Export functions
  const exportToCSV = () => {
    if (transactionsWithMetrics.length === 0) {
      toast.error('No transactions to export');
      return;
    }

    setExporting(true);
    try {
      const headers = ['Time (UTC)', 'Action', 'Token', 'Buyer#', 'Liquidity', 'Risk', 'SOL In', 'SOL Out', 'Entry', 'Exit', 'PnL (SOL)', 'ROI%', 'Slippage', 'Status', 'TX'];
      const rows = transactionsWithMetrics.map(tx => [
        format(new Date(tx.created_at), 'yyyy-MM-dd HH:mm:ss'),
        tx.trade_type.toUpperCase(),
        tx.token_symbol || shortAddress(tx.token_address),
        tx.buyerPosition ? `#${tx.buyerPosition}` : '-',
        tx.liquidity ? formatLiquidity(tx.liquidity) : '-',
        tx.riskScore ? `${tx.riskScore}/100` : '-',
        tx.trade_type === 'buy' ? tx.price_sol?.toFixed(4) || '-' : '-',
        tx.trade_type === 'sell' ? tx.price_sol?.toFixed(4) || '-' : '-',
        tx.entryPrice?.toFixed(8) || '-',
        tx.exitPrice?.toFixed(8) || '-',
        tx.pnlSol?.toFixed(4) || '-',
        tx.roiPercent ? `${tx.roiPercent.toFixed(1)}%` : '-',
        tx.slippage ? `${tx.slippage.toFixed(1)}%` : '-',
        tx.status || 'pending',
        tx.tx_hash || '-',
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
      link.download = `${userName}_transactions_${format(new Date(), 'yyyy-MM-dd')}.csv`;
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
    if (transactionsWithMetrics.length === 0) {
      toast.error('No transactions to export');
      return;
    }

    setExporting(true);
    try {
      const jsonContent = JSON.stringify(transactionsWithMetrics, null, 2);
      const blob = new Blob([jsonContent], { type: 'application/json' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${userName}_transactions_${format(new Date(), 'yyyy-MM-dd')}.json`;
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
  
  if (loading) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
        Loading transactions...
      </div>
    );
  }

  if (validTransactions.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No verified transactions found
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats and Export */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex flex-wrap gap-2 text-xs">
          <Badge variant="outline" className="bg-success/10 text-success border-success/30">
            {stats.buys} Buys ({stats.totalBuySol.toFixed(2)} SOL)
          </Badge>
          <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30">
            {stats.sells} Sells ({stats.totalSellSol.toFixed(2)} SOL)
          </Badge>
          <Badge variant="outline" className={cn(
            stats.netPnl >= 0 ? "bg-success/10 text-success border-success/30" : "bg-destructive/10 text-destructive border-destructive/30"
          )}>
            Net: {stats.netPnl >= 0 ? '+' : ''}{stats.netPnl.toFixed(4)} SOL
          </Badge>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" disabled={exporting || validTransactions.length === 0}>
              {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              <span className="ml-2">Export</span>
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
      </div>

      {/* Table */}
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
              <TableHead className="text-xs font-semibold text-right">SOL In</TableHead>
              <TableHead className="text-xs font-semibold text-right">SOL Out</TableHead>
              <TableHead className="text-xs font-semibold text-right">Entry</TableHead>
              <TableHead className="text-xs font-semibold text-right">Exit</TableHead>
              <TableHead className="text-xs font-semibold text-right">PnL (SOL)</TableHead>
              <TableHead className="text-xs font-semibold text-right">ROI%</TableHead>
              <TableHead className="text-xs font-semibold text-right">Slippage</TableHead>
              <TableHead className="text-xs font-semibold text-center">Status</TableHead>
              <TableHead className="text-xs font-semibold text-right">TX</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactionsWithMetrics.map((tx) => {
              const isBuy = tx.trade_type === 'buy';
              const statusColors: Record<string, string> = {
                confirmed: 'text-success',
                success: 'text-success',
                failed: 'text-destructive',
                pending: 'text-warning',
              };
              const statusColor = statusColors[tx.status?.toLowerCase() || 'pending'] || 'text-muted-foreground';
              
              return (
                <TableRow key={tx.id} className="hover:bg-secondary/20 border-b border-border/50">
                  <TableCell className="text-xs font-mono whitespace-nowrap">
                    <div>{format(new Date(tx.created_at), 'yyyy-MM-dd')}</div>
                    <div className="text-muted-foreground">{format(new Date(tx.created_at), 'HH:mm:ss')}</div>
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
                      {tx.trade_type.toUpperCase()}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className="font-medium text-foreground">
                      {tx.token_symbol || shortAddress(tx.token_address)}
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="font-mono text-xs">
                      {tx.buyerPosition ? `#${tx.buyerPosition}` : '—'}
                    </span>
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs">
                    {formatLiquidity(tx.liquidity)}
                  </TableCell>
                  <TableCell className="text-center">
                    {tx.riskScore !== null ? (
                      <span className={cn(
                        "font-mono text-xs",
                        tx.riskScore <= 40 ? "text-success" :
                        tx.riskScore <= 70 ? "text-warning" : "text-destructive"
                      )}>
                        {tx.riskScore}/100
                      </span>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {isBuy && tx.price_sol ? (
                      <span className="text-foreground">{tx.price_sol.toFixed(2)}</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {!isBuy && tx.price_sol ? (
                      <span className="text-foreground">{tx.price_sol.toFixed(2)}</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs">
                    {tx.entryPrice ? tx.entryPrice.toFixed(8).replace(/\.?0+$/, '') : '—'}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs">
                    {tx.exitPrice ? tx.exitPrice.toFixed(8).replace(/\.?0+$/, '') : '—'}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {tx.pnlSol !== null ? (
                      <span className={cn(
                        "font-semibold",
                        tx.pnlSol >= 0 ? "text-success" : "text-destructive"
                      )}>
                        {tx.pnlSol >= 0 ? '+' : ''}{tx.pnlSol.toFixed(2)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs">
                    {tx.roiPercent !== null ? (
                      <span className={cn(
                        "font-semibold",
                        tx.roiPercent >= 0 ? "text-success" : "text-destructive"
                      )}>
                        {tx.roiPercent >= 0 ? '+' : ''}{tx.roiPercent.toFixed(1)}%
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs">
                    {tx.slippage !== null && tx.slippage !== undefined ? (
                      <span className="text-muted-foreground">{tx.slippage.toFixed(1)}%</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    <span className={cn("font-medium text-xs capitalize", statusColor)}>
                      {tx.status === 'confirmed' ? 'Success' : (tx.status || 'Pending')}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    {tx.tx_hash ? (
                      <a
                        href={`https://solscan.io/tx/${tx.tx_hash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-mono"
                      >
                        {shortAddress(tx.tx_hash)}
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
    </div>
  );
}
