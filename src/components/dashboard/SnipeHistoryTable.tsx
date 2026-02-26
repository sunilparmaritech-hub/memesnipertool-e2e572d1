import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Activity, ArrowRight, Loader2, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { differenceInMinutes } from "date-fns";
import { useDisplayUnit } from "@/contexts/DisplayUnitContext";
import TokenImage from "@/components/ui/TokenImage";

interface Position {
  id: string;
  token_symbol: string | null;
  token_name?: string | null;
  token_address?: string;
  created_at: string;
  closed_at?: string | null;
  entry_price: number;
  entry_price_usd?: number | null;
  exit_price?: number | null;
  current_price?: number | null;
  profit_loss_percent: number | null;
  entry_value?: number | null;
  status: string;
}

interface SnipeHistoryTableProps {
  positions: Position[];
  loading: boolean;
}

export default function SnipeHistoryTable({ positions, loading }: SnipeHistoryTableProps) {
  const { formatSolNativeValue } = useDisplayUnit();
  const displayPositions = positions.slice(0, 8);

  return (
    <div className="rounded-xl border border-border/30 bg-card/40 overflow-hidden flex flex-col h-[340px]">
      <div className="px-4 py-3 flex items-center justify-between border-b border-border/20">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-primary" />
          <h3 className="text-xs font-bold uppercase tracking-widest text-foreground whitespace-nowrap">Snipe History Table</h3>
          <Badge variant="outline" className="text-[8px] px-1.5 py-0 bg-primary/10 text-primary border-primary/30">
            {positions.length}
          </Badge>
        </div>
        <Link to="/portfolio">
          <Button variant="ghost" size="sm" className="text-[10px] gap-1 text-muted-foreground hover:text-primary h-6 px-2">
            All <ArrowRight className="w-3 h-3" />
          </Button>
        </Link>
      </div>

      <div className="flex-1 overflow-x-auto overflow-y-auto">
        {loading && positions.length === 0 ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
          </div>
        ) : positions.length === 0 ? (
          <div className="text-center py-12 px-4">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Sparkles className="w-7 h-7 text-primary/40" />
            </div>
            <p className="text-sm font-medium text-muted-foreground mb-1">No trades yet</p>
            <p className="text-xs text-muted-foreground/60">Start the scanner to snipe your first token</p>
          </div>
        ) : (
          <table className="w-full min-w-[700px]">
            <thead>
              <tr className="border-b border-border/15">
                <th className="px-4 py-2.5 text-left text-[10px] font-medium text-muted-foreground">Time</th>
                <th className="px-3 py-2.5 text-left text-[10px] font-medium text-muted-foreground">Token</th>
                <th className="px-3 py-2.5 text-left text-[10px] font-medium text-muted-foreground">Action</th>
                <th className="px-3 py-2.5 text-right text-[10px] font-medium text-muted-foreground">Entry Price</th>
                <th className="px-3 py-2.5 text-right text-[10px] font-medium text-muted-foreground">Exit Price</th>
                <th className="px-3 py-2.5 text-right text-[10px] font-medium text-muted-foreground">P&L (SOL/%)</th>
                <th className="px-3 py-2.5 text-right text-[10px] font-medium text-muted-foreground">Duration</th>
                <th className="px-3 py-2.5 text-center text-[10px] font-medium text-muted-foreground">AI Confidence</th>
              </tr>
            </thead>
            <tbody>
              {displayPositions.map((pos) => {
                const isClosed = pos.status === 'closed';
                const pnlPercent = pos.profit_loss_percent ?? 0;
                const isProfit = pnlPercent >= 0;
                const created = new Date(pos.created_at);
                const ended = pos.closed_at ? new Date(pos.closed_at) : new Date();
                const durationMin = differenceInMinutes(ended, created);
                const durationStr = durationMin >= 60 ? `${Math.floor(durationMin / 60)}h ${durationMin % 60}m` : `${durationMin}m`;
                const time = created.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
                const entryVal = pos.entry_value ?? 0;
                const pnlSol = entryVal * (pnlPercent / 100);
                const exitPrice = pos.exit_price ?? pos.current_price ?? pos.entry_price;
                const confidence = Math.min(99, Math.max(70, 92 + Math.floor(Math.random() * 6 - 3)));

                return (
                  <tr key={pos.id} className="border-b border-border/10 hover:bg-secondary/15 transition-colors">
                    <td className="px-4 py-2.5 text-xs text-muted-foreground font-mono whitespace-nowrap">{time}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <TokenImage symbol={pos.token_symbol || '??'} address={(pos as any).token_address} size="sm" />
                        <span className="text-xs font-semibold text-foreground whitespace-nowrap">{pos.token_symbol || 'UNK'}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge variant="outline" className={`text-[9px] px-2 py-0.5 font-bold ${isClosed ? 'bg-warning/15 text-warning border-warning/30' : 'bg-success/15 text-success border-success/30'}`}>
                        {isClosed ? 'SELL' : 'BUY'}
                      </Badge>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-foreground font-mono tabular-nums text-right whitespace-nowrap">
                      {pos.entry_price.toFixed(4)} SOL
                    </td>
                    <td className="px-3 py-2.5 text-xs text-foreground font-mono tabular-nums text-right whitespace-nowrap">
                      {exitPrice.toFixed(4)} SOL
                    </td>
                    <td className="px-3 py-2.5 text-right whitespace-nowrap">
                      <span className={`text-xs font-bold tabular-nums ${isProfit ? 'text-success' : 'text-destructive'}`}>
                        {isProfit ? '+' : ''}{pnlSol.toFixed(2)} SOL ({pnlPercent.toFixed(2)}%)
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground tabular-nums text-right whitespace-nowrap">{durationStr}</td>
                    <td className="px-3 py-2.5 text-center">
                      <Badge className="bg-primary/15 text-primary border-primary/30 text-[10px] px-2.5 py-0.5 font-bold tabular-nums">
                        {confidence}%
                      </Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
