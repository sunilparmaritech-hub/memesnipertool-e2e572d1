import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useDisplayUnit } from "@/contexts/DisplayUnitContext";
import { differenceInMinutes } from "date-fns";
import { Crosshair, List, LayoutGrid } from "lucide-react";
import { Link } from "react-router-dom";
import TokenImage from "@/components/ui/TokenImage";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

function MiniSparkline({ positive }: { positive: boolean }) {
  const points = positive
    ? "0,12 5,10 10,11 15,8 20,9 25,5 30,6 35,3 40,4 45,2 50,3"
    : "0,3 5,4 10,2 15,5 20,4 25,7 30,6 35,9 40,8 45,11 50,12";
  const color = positive ? 'hsl(95, 80%, 45%)' : 'hsl(0, 72%, 51%)';
  return (
    <svg width="50" height="16" viewBox="0 0 50 16" className="opacity-60">
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

interface Position {
  id: string;
  token_symbol: string | null;
  token_name?: string | null;
  token_address?: string;
  created_at: string;
  entry_price: number;
  entry_price_usd?: number | null;
  current_price?: number | null;
  profit_loss_percent?: number | null;
  entry_value?: number | null;
  status?: string | null;
}

type SortMode = 'best' | 'worst' | 'largest' | 'newest' | 'oldest';

interface ActivePositionsGridProps {
  positions: Position[];
  loading?: boolean;
}

export default function ActivePositionsGrid({ positions, loading = false }: ActivePositionsGridProps) {
  const [sort, setSort] = useState<SortMode>('best');
  const [view, setView] = useState<'cards' | 'table'>('table');
  const { formatSolNativeValue } = useDisplayUnit();

  const sorted = useMemo(() => {
    const arr = [...positions];
    switch (sort) {
      case 'best': return arr.sort((a, b) => (b.profit_loss_percent ?? 0) - (a.profit_loss_percent ?? 0));
      case 'worst': return arr.sort((a, b) => (a.profit_loss_percent ?? 0) - (b.profit_loss_percent ?? 0));
      case 'largest': return arr.sort((a, b) => (b.entry_value ?? 0) - (a.entry_value ?? 0));
      case 'newest': return arr.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      case 'oldest': return arr.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      default: return arr;
    }
  }, [positions, sort]);

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-6 w-48" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-36 rounded-xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Crosshair className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-bold uppercase tracking-widest text-foreground">Active Positions</h2>
          <Badge variant="outline" className="text-[9px] px-1.5 py-0 text-muted-foreground border-border/30">
            {positions.length}
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          <Select value={sort} onValueChange={(v) => setSort(v as SortMode)}>
            <SelectTrigger className="h-7 w-[130px] text-[10px] bg-secondary/30 border-border/30">
              <SelectValue placeholder="Best Performer" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="best">Best Performer</SelectItem>
              <SelectItem value="worst">Worst Performer</SelectItem>
              <SelectItem value="largest">Largest Position</SelectItem>
              <SelectItem value="newest">Newest</SelectItem>
              <SelectItem value="oldest">Oldest</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex bg-secondary/30 rounded p-0.5 gap-0.5">
            <button
              onClick={() => setView('cards')}
              className={`p-1 rounded ${view === 'cards' ? 'bg-secondary/60 text-foreground' : 'text-muted-foreground'}`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setView('table')}
              className={`p-1 rounded ${view === 'table' ? 'bg-secondary/60 text-foreground' : 'text-muted-foreground'}`}
            >
              <List className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Empty state */}
      {positions.length === 0 ? (
        <div className="rounded-xl border border-border/20 py-12 text-center" style={{ background: 'var(--gradient-card-sidebar)' }}>
          <Crosshair className="w-8 h-8 text-primary/30 mx-auto mb-3" />
          <p className="text-sm font-semibold text-foreground mb-1">No Active Positions</p>
          <p className="text-xs text-muted-foreground mb-3">Start sniping to track performance</p>
          <Link to="/scanner">
            <Button variant="outline" size="sm" className="border-primary/30 text-primary hover:bg-primary/10 gap-2 text-xs">
              <Crosshair className="w-3.5 h-3.5" />
              Open Scanner
            </Button>
          </Link>
        </div>
      ) : view === 'cards' ? (
        /* Cards view */
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
          {sorted.map((pos) => {
            const pnl = pos.profit_loss_percent ?? 0;
            const isPositive = pnl >= 0;
            const entryVal = pos.entry_value ?? 0;
            const entryFormatted = formatSolNativeValue(entryVal);
            const pnlSol = entryVal * (pnl / 100);
            const created = new Date(pos.created_at);
            const durationMin = differenceInMinutes(new Date(), created);
            const durationStr = durationMin >= 60 ? `${Math.floor(durationMin / 60)}h ${durationMin % 60}m` : `${durationMin}m`;

            return (
              <Link key={pos.id} to={pos.token_address ? `/token/${pos.token_address}` : '#'} className="shrink-0 w-[220px] sm:w-[240px]">
                <div
                  className={`rounded-xl border p-3.5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg ${
                    isPositive ? 'border-success/20 hover:border-success/40' : 'border-destructive/20 hover:border-destructive/40'
                  }`}
                  style={{ background: 'var(--gradient-card-hover)' }}
                >
                  {/* Token header */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <TokenImage symbol={pos.token_symbol || '??'} address={pos.token_address} size="sm" />
                      <span className="text-sm font-bold text-foreground">{pos.token_symbol || 'UNK'}</span>
                    </div>
                    <MiniSparkline positive={isPositive} />
                  </div>

                  {/* PnL */}
                  <div className="flex items-baseline justify-between mb-3">
                    <p className={`text-lg font-bold tabular-nums ${isPositive ? 'text-success' : 'text-destructive'}`}>
                      {isPositive ? '+' : ''}{pnl.toFixed(2)}%
                    </p>
                    <span className="text-[10px] text-muted-foreground tabular-nums">{entryFormatted.primary}</span>
                  </div>

                  {/* Details */}
                  <div className="space-y-1 text-[10px]">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Entry</span>
                      <span className="text-foreground tabular-nums font-medium">{(pos.entry_price ?? 0).toFixed(6)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Current</span>
                      <span className="text-foreground tabular-nums font-medium">{(pos.current_price ?? pos.entry_price ?? 0).toFixed(6)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">P&L</span>
                      <span className={`font-medium tabular-nums ${isPositive ? 'text-success' : 'text-destructive'}`}>
                        {isPositive ? '+' : ''}{pnlSol.toFixed(4)} SOL
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Time Held</span>
                      <span className="text-foreground tabular-nums">{durationStr}</span>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        /* Table view */
        <div className="rounded-xl border border-border/20 overflow-hidden" style={{ background: 'var(--gradient-card-sidebar)' }}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px]">
              <thead>
                <tr className="border-b border-border/10">
                  <th className="px-4 py-2 text-left text-[10px] font-medium text-muted-foreground">Token</th>
                  <th className="px-3 py-2 text-right text-[10px] font-medium text-muted-foreground">Entry Price</th>
                  <th className="px-3 py-2 text-right text-[10px] font-medium text-muted-foreground">Current Price</th>
                  <th className="px-3 py-2 text-right text-[10px] font-medium text-muted-foreground">PNL</th>
                  <th className="px-3 py-2 text-right text-[10px] font-medium text-muted-foreground">P&L (SOL)</th>
                  <th className="px-3 py-2 text-right text-[10px] font-medium text-muted-foreground">Position Size</th>
                  <th className="px-3 py-2 text-right text-[10px] font-medium text-muted-foreground">Time Held</th>
                  <th className="px-3 py-2 text-center text-[10px] font-medium text-muted-foreground"></th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((pos) => {
                  const pnl = pos.profit_loss_percent ?? 0;
                  const isPositive = pnl >= 0;
                  const entryVal = pos.entry_value ?? 0;
                  const pnlSol = entryVal * (pnl / 100);
                  const durationMin = differenceInMinutes(new Date(), new Date(pos.created_at));
                  const durationStr = durationMin >= 60 ? `${Math.floor(durationMin / 60)}h ${durationMin % 60}m` : `${durationMin}m`;

                  return (
                    <tr key={pos.id} className="border-b border-border/8 hover:bg-secondary/10 transition-colors">
                      <td className="px-4 py-2.5">
                        <Link to={pos.token_address ? `/token/${pos.token_address}` : '#'} className="flex items-center gap-2">
                          <TokenImage symbol={pos.token_symbol || '??'} address={pos.token_address} size="sm" />
                          <span className="text-xs font-bold text-foreground">{pos.token_symbol || 'UNK'}</span>
                        </Link>
                      </td>
                      <td className="px-3 py-2.5 text-right text-xs font-mono tabular-nums text-foreground">{(pos.entry_price ?? 0).toFixed(6)}</td>
                      <td className="px-3 py-2.5 text-right text-xs font-mono tabular-nums text-foreground">{(pos.current_price ?? pos.entry_price ?? 0).toFixed(6)}</td>
                      <td className={`px-3 py-2.5 text-right text-xs font-bold tabular-nums ${isPositive ? 'text-success' : 'text-destructive'}`}>
                        {pnl >= 0 ? '+' : ''}{pnl.toFixed(2)}%
                      </td>
                      <td className={`px-3 py-2.5 text-right text-xs tabular-nums ${isPositive ? 'text-success' : 'text-destructive'}`}>
                        {isPositive ? '+' : ''}{pnlSol.toFixed(4)} SOL
                      </td>
                      <td className="px-3 py-2.5 text-right text-xs font-mono tabular-nums text-foreground">{entryVal.toFixed(4)} SOL</td>
                      <td className="px-3 py-2.5 text-right text-xs text-muted-foreground">{durationStr}</td>
                      <td className="px-3 py-2.5 text-center">
                        <Link to={pos.token_address ? `/token/${pos.token_address}` : '#'}>
                          <Badge variant="outline" className="text-[8px] px-2 py-0 bg-primary/10 text-primary border-primary/30 font-bold cursor-pointer hover:bg-primary/20">
                            View
                          </Badge>
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
