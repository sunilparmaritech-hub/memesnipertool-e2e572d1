import { Bot, Settings } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useDisplayUnit } from "@/contexts/DisplayUnitContext";
import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";

interface DashboardBotStatusProps {
  balance: number;
  totalPnLPercent: number;
  winRate: number;
  totalTrades: number;
  closedPnLSol: number;
  lastTradeTime?: string | null;
}

export default function DashboardBotStatus({
  balance, totalPnLPercent, winRate, totalTrades, closedPnLSol, lastTradeTime,
}: DashboardBotStatusProps) {
  const { formatSolNativeValue } = useDisplayUnit();
  const balFormatted = formatSolNativeValue(balance);
  const pnlFormatted = formatSolNativeValue(Math.abs(closedPnLSol), { showSign: true });
  const isPositive = totalPnLPercent >= 0;

  const lastTradeStr = lastTradeTime
    ? formatDistanceToNow(new Date(lastTradeTime), { addSuffix: true })
    : 'No trades yet';

  return (
    <div className="rounded-xl border border-border/20 overflow-hidden" style={{ background: 'var(--gradient-card-sidebar)' }}>
      {/* Header */}
      <div className="px-4 py-3 flex items-center justify-between border-b border-border/15">
        <div className="flex items-center gap-2">
          <Bot className="w-4 h-4 text-primary" />
          <span className="text-xs font-bold uppercase tracking-widest text-foreground">Bot Status</span>
        </div>
        <Link to="/sniper-settings">
          <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground">
            <Settings className="w-3 h-3" />
          </Button>
        </Link>
      </div>

      <div className="p-4 space-y-4">
        {/* Balance + Total P&L */}
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">Wallet Balance</p>
            <p className="text-xl font-bold tabular-nums text-foreground leading-none">{balFormatted.primary}</p>
            <p className="text-[10px] text-muted-foreground tabular-nums mt-0.5">{balFormatted.secondary}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">Total P&L</p>
            <p className={`text-xl font-bold tabular-nums leading-none ${isPositive ? 'text-success' : 'text-destructive'}`}>
              {totalPnLPercent >= 0 ? '+' : ''}{totalPnLPercent.toFixed(1)}%
            </p>
            <p className={`text-[10px] tabular-nums mt-0.5 ${closedPnLSol >= 0 ? 'text-success' : 'text-destructive'}`}>
              {closedPnLSol >= 0 ? '+' : '-'}{pnlFormatted.primary}
            </p>
          </div>
        </div>

        {/* Win Rate + Last Trade */}
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">Win Rate</p>
            <p className="text-lg font-bold tabular-nums text-foreground leading-none">{winRate.toFixed(0)}%</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">Last Trade</p>
            <p className="text-sm font-bold tabular-nums text-foreground leading-none whitespace-nowrap">{lastTradeStr}</p>
          </div>
        </div>

        {/* Total Trades */}
        <div className="flex items-center justify-between border-t border-border/15 pt-3">
          <div>
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">Total Trades</p>
            <p className="text-lg font-bold tabular-nums text-foreground leading-none">{totalTrades}</p>
          </div>
          <Badge variant="outline" className={`text-[9px] px-2 py-0.5 font-bold tabular-nums ${isPositive ? 'bg-success/10 text-success border-success/30' : 'bg-destructive/10 text-destructive border-destructive/30'}`}>
            {totalPnLPercent >= 0 ? '▲' : '▼'} {Math.abs(totalPnLPercent).toFixed(1)}%
          </Badge>
        </div>
      </div>
    </div>
  );
}
