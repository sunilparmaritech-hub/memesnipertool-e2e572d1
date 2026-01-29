import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  buy: 'bg-success/15 text-success border-success/30 hover:bg-success/25',
  monitor: 'bg-primary/15 text-primary border-primary/30 hover:bg-primary/25',
  exit: 'bg-destructive/15 text-destructive border-destructive/30 hover:bg-destructive/25',
};

const actionIcons = {
  buy: TrendingUp,
  monitor: Eye,
  exit: LogOut,
};

export default function IntelligencePanels({ signals = defaultSignals }: IntelligencePanelsProps) {
  return (
    <Card className="border border-border/50 bg-card/80 backdrop-blur-sm h-full">
      <CardHeader className="pb-2 pt-3 px-3">
        <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Intelligence Panels
        </CardTitle>
        <div className="flex items-center justify-between mt-1.5">
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs font-semibold">Market Signals</span>
          </div>
          <span className="text-[9px] text-muted-foreground uppercase tracking-wider">Confidence %</span>
        </div>
      </CardHeader>
      <CardContent className="px-3 pb-3 space-y-1.5 overflow-y-auto max-h-[260px]">
        {signals.map((signal, index) => {
          const ActionIcon = actionIcons[signal.action];
          
          return (
            <div
              key={signal.id}
              className="p-2.5 rounded-lg bg-secondary/40 border border-border/30 hover:bg-secondary/60 transition-all duration-200 animate-fade-in"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-semibold text-foreground">
                    {signal.title} <span className="text-muted-foreground">on</span>{' '}
                    <span className="text-primary">{signal.token}</span>
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    ({signal.confidence}%)
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className={cn(
                    "h-6 text-[10px] font-medium capitalize gap-1 shrink-0 px-2",
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
