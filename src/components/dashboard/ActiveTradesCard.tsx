import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Activity, Loader2, TrendingUp, TrendingDown, ArrowRight, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { formatPreciseUsd } from "@/lib/precision";
import TokenImage from "@/components/ui/TokenImage";

interface Position {
  id: string;
  token_symbol: string;
  token_name?: string;
  token_address?: string;
  created_at: string;
  profit_loss_percent: number | null;
  current_value: number;
}

interface ActiveTradesCardProps {
  positions: Position[];
  loading: boolean;
  onStartSnipping?: () => void;
}

const formatCurrency = (value: number) => formatPreciseUsd(value);

export default function ActiveTradesCard({ positions, loading, onStartSnipping }: ActiveTradesCardProps) {
  return (
    <div className="rounded-xl border border-border/50 bg-card/80 backdrop-blur-xl overflow-hidden animate-fade-in">
      {/* Header */}
      <div className="px-5 py-3 flex items-center justify-between border-b border-border/30">
        <div className="flex items-center gap-2.5">
          <Activity className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-bold uppercase tracking-wide">Snipe History</h3>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-primary/10 text-primary border-primary/30">
            {positions.length} active
          </Badge>
        </div>
        <Link to="/portfolio">
          <Button variant="ghost" size="sm" className="text-xs gap-1.5 text-muted-foreground hover:text-primary group h-7">
            View All 
            <ArrowRight className="w-3 h-3 transition-transform group-hover:translate-x-0.5" />
          </Button>
        </Link>
      </div>
      
      {/* Content */}
      <div className="p-3">
        {loading && positions.length === 0 ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : positions.length === 0 ? (
          <div className="text-center py-8">
            <Sparkles className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground mb-1">No active trades</p>
            <p className="text-xs text-muted-foreground/70 mb-3">Start trading to see positions here</p>
            {onStartSnipping && (
              <Button variant="outline" size="sm" onClick={onStartSnipping} className="gap-2 border-primary/30 text-primary hover:bg-primary/10 h-7 text-xs">
                <TrendingUp className="w-3 h-3" />
                Start Trading
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-0">
            {/* Table Header */}
            <div className="grid grid-cols-[1fr_auto_auto] gap-3 px-3 py-2 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
              <span>Token</span>
              <span className="text-right w-20">P&L</span>
              <span className="text-right w-16">Value</span>
            </div>
            {positions.slice(0, 5).map((position, index) => {
              const isProfit = (position.profit_loss_percent || 0) >= 0;
              const pnlPercent = position.profit_loss_percent || 0;
              
              return (
                <div 
                  key={position.id} 
                  className="grid grid-cols-[1fr_auto_auto] gap-3 items-center px-3 py-2.5 hover:bg-secondary/30 rounded-lg transition-colors animate-fade-in"
                  style={{ animationDelay: `${index * 30}ms` }}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <TokenImage
                      symbol={position.token_symbol}
                      address={position.token_address}
                      size="sm"
                    />
                    <div className="min-w-0">
                      <p className="font-semibold text-sm text-foreground truncate">{position.token_symbol}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {formatDistanceToNow(new Date(position.created_at), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                  
                  <div className={`flex items-center justify-end gap-1 font-bold text-sm w-20 ${isProfit ? 'text-success' : 'text-destructive'}`}>
                    {isProfit ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    {isProfit ? '+' : ''}{pnlPercent.toFixed(2)}%
                  </div>
                  
                  <p className="text-xs text-muted-foreground font-medium text-right w-16 tabular-nums">
                    {formatCurrency(position.current_value)}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
