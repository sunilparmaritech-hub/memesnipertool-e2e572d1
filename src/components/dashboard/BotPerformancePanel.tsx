import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, Zap, Signal, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface BotPerformancePanelProps {
  uptime: number;
  tradesToday: number;
  pendingSignals: number;
  queueStatus: 'active' | 'paused' | 'idle';
}

export default function BotPerformancePanel({
  uptime = 99.9,
  tradesToday = 0,
  pendingSignals = 0,
  queueStatus = 'active',
}: BotPerformancePanelProps) {
  const queueStatusColors = {
    active: 'text-success',
    paused: 'text-warning',
    idle: 'text-muted-foreground',
  };

  return (
    <Card className="border border-border/50 bg-card/80 backdrop-blur-sm h-full">
      <CardHeader className="pb-2 pt-3 px-3">
        <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Bot Performance Stats
        </CardTitle>
      </CardHeader>
      <CardContent className="px-3 pb-3">
        <div className="grid grid-cols-4 gap-2">
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-1 text-muted-foreground">
              <Clock className="w-3 h-3" />
              <span className="text-[9px] uppercase tracking-wider">Uptime</span>
            </div>
            <span className="text-lg font-bold text-foreground">{uptime.toFixed(1)}%</span>
          </div>
          
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-1 text-muted-foreground">
              <Zap className="w-3 h-3" />
              <span className="text-[9px] uppercase tracking-wider">Trades Today</span>
            </div>
            <span className="text-lg font-bold text-foreground">{tradesToday}</span>
          </div>
          
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-1 text-muted-foreground">
              <Signal className="w-3 h-3" />
              <span className="text-[9px] uppercase tracking-wider">Pending</span>
            </div>
            <span className="text-lg font-bold text-foreground">{pendingSignals}</span>
          </div>
          
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-1 text-muted-foreground">
              <Activity className="w-3 h-3" />
              <span className="text-[9px] uppercase tracking-wider">Queue</span>
            </div>
            <span className={cn("text-lg font-bold capitalize", queueStatusColors[queueStatus])}>
              {queueStatus === 'active' ? 'Active' : queueStatus === 'paused' ? 'Paused' : 'Idle'}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
