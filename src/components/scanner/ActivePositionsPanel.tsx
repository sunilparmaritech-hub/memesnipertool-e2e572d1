import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Position {
  id: string;
  token_name: string;
  token_symbol: string;
  amount: number;
  entry_price: number;
  current_price: number;
  profit_loss_percent: number | null;
  profit_loss_value: number | null;
}

interface ActivePositionsPanelProps {
  positions: Position[];
}

export default function ActivePositionsPanel({ positions }: ActivePositionsPanelProps) {
  const avatarColors = [
    'bg-success/20 text-success',
    'bg-blue-500/20 text-blue-400',
    'bg-purple-500/20 text-purple-400',
    'bg-orange-500/20 text-orange-400',
    'bg-pink-500/20 text-pink-400',
    'bg-cyan-500/20 text-cyan-400',
  ];

  return (
    <Card className="bg-card/80 backdrop-blur-sm border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-primary" />
          Active Positions
        </CardTitle>
        <p className="text-xs text-muted-foreground">{positions.length} open trades</p>
      </CardHeader>
      <CardContent className="space-y-3">
        {positions.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-sm text-muted-foreground">No active positions</p>
          </div>
        ) : (
          positions.slice(0, 5).map((position, index) => {
            const pnlPercent = position.profit_loss_percent || 0;
            const pnlValue = position.profit_loss_value || 0;
            const isPositive = pnlPercent >= 0;
            const progressWidth = Math.min(Math.abs(pnlPercent), 100);

            return (
              <div key={position.id} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${avatarColors[index % avatarColors.length]}`}>
                      {position.token_symbol.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-sm text-foreground">{position.token_name}</span>
                        <span className="text-xs text-muted-foreground">{position.token_symbol}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {position.amount.toLocaleString()} tokens
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-right">
                      <div className={`font-bold text-sm ${isPositive ? 'text-success' : 'text-destructive'}`}>
                        {isPositive ? '+' : ''}{pnlPercent.toFixed(1)}%
                      </div>
                      <p className={`text-xs ${isPositive ? 'text-success/70' : 'text-destructive/70'}`}>
                        {isPositive ? '+' : ''}${pnlValue.toFixed(0)}
                      </p>
                    </div>
                    <Button variant="ghost" size="icon" className="w-6 h-6 text-muted-foreground">
                      <MoreVertical className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
                
                {/* Price Progress Bar */}
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-muted-foreground min-w-[70px]">Entry: ${position.entry_price.toFixed(5)}</span>
                  <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full ${isPositive ? 'bg-success' : 'bg-destructive'}`}
                      style={{ width: `${progressWidth}%` }}
                    />
                  </div>
                  <span className="text-muted-foreground min-w-[70px] text-right">Current: ${position.current_price.toFixed(5)}</span>
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
