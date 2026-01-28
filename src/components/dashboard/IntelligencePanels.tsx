import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TrendingUp, Eye, LogOut, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface MarketSignal {
  id: string;
  type: 'bullish' | 'volume_spike' | 'bearish' | 'breakout';
  title: string;
  token: string;
  confidence: number;
  action: 'buy' | 'monitor' | 'exit';
}

interface IntelligencePanelsProps {
  signals?: MarketSignal[];
}

const defaultSignals: MarketSignal[] = [
  { id: '1', type: 'bullish', title: 'BULLISH FLAG', token: 'JUP', confidence: 90, action: 'buy' },
  { id: '2', type: 'volume_spike', title: 'VOLUME SPIKE', token: 'WIF', confidence: 85, action: 'monitor' },
  { id: '3', type: 'bearish', title: 'BEARISH DIVERGENCE', token: 'MEW', confidence: 75, action: 'exit' },
];

const actionColors = {
  buy: 'bg-success/20 text-success border-success/30 hover:bg-success/30',
  monitor: 'bg-primary/20 text-primary border-primary/30 hover:bg-primary/30',
  exit: 'bg-destructive/20 text-destructive border-destructive/30 hover:bg-destructive/30',
};

const actionIcons = {
  buy: TrendingUp,
  monitor: Eye,
  exit: LogOut,
};

export default function IntelligencePanels({ signals = defaultSignals }: IntelligencePanelsProps) {
  return (
    <Card className="border-0 bg-gradient-to-br from-card/90 to-card/60 backdrop-blur-xl h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Intelligence Panels
          </CardTitle>
        </div>
        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold">Market Signals</span>
          </div>
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Confidence %</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 overflow-y-auto max-h-[300px]">
        {signals.map((signal, index) => {
          const ActionIcon = actionIcons[signal.action];
          
          return (
            <div
              key={signal.id}
              className="p-3 rounded-xl bg-secondary/30 border border-border/30 hover:bg-secondary/50 transition-all duration-200 animate-fade-in"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-foreground">
                    {signal.title} <span className="text-muted-foreground">on</span>{' '}
                    <span className="text-primary">{signal.token}</span>
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    ({signal.confidence}%)
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className={cn(
                    "h-7 text-xs font-medium capitalize gap-1.5 shrink-0",
                    actionColors[signal.action]
                  )}
                >
                  <ActionIcon className="w-3 h-3" />
                  {signal.action}
                </Button>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
