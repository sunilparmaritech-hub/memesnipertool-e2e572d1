import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Activity, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";

interface Position {
  id: string;
  token_symbol: string;
  created_at: string;
  profit_loss_percent: number | null;
  current_value: number;
}

interface ActiveTradesCardProps {
  positions: Position[];
  loading: boolean;
  onStartSnipping?: () => void;
}

const formatCurrency = (value: number) => {
  if (Math.abs(value) >= 1000000) return `$${(value / 1000000).toFixed(2)}M`;
  if (Math.abs(value) >= 1000) return `$${(value / 1000).toFixed(1)}K`;
  return `$${value.toFixed(2)}`;
};

export default function ActiveTradesCard({ positions, loading, onStartSnipping }: ActiveTradesCardProps) {
  return (
    <Card className="bg-card/80 backdrop-blur-sm border-border/50">
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Activity className="w-4 h-4 text-primary" />
          Active Trades
        </CardTitle>
        <Link to="/portfolio">
          <Button variant="ghost" size="sm" className="text-xs">View All →</Button>
        </Link>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : positions.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Activity className="w-10 h-10 mx-auto mb-3 opacity-50" />
            <p className="text-sm mb-2">No active trades</p>
            {onStartSnipping && (
              <Button variant="link" size="sm" onClick={onStartSnipping} className="text-primary">
                Start sniping →
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {positions.slice(0, 4).map((position) => {
              const isProfit = (position.profit_loss_percent || 0) >= 0;
              return (
                <div key={position.id} className="flex items-center justify-between p-3 bg-secondary/40 rounded-lg hover:bg-secondary/60 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center">
                      <span className="text-xs font-bold text-primary">
                        {position.token_symbol.slice(0, 2)}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium text-foreground text-sm">{position.token_symbol}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(position.created_at), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-semibold text-sm ${isProfit ? 'text-success' : 'text-destructive'}`}>
                      {isProfit ? '+' : ''}{(position.profit_loss_percent || 0).toFixed(2)}%
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatCurrency(position.current_value)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
