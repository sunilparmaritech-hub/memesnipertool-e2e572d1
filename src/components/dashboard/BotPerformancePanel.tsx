import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
    <Card className="border-0 bg-gradient-to-br from-card/90 to-card/60 backdrop-blur-xl h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Bot Performance Stats
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Clock className="w-3 h-3" />
              <span className="text-[10px] uppercase tracking-wider">Uptime</span>
            </div>
            <span className="text-2xl font-bold text-foreground">{uptime.toFixed(1)}%</span>
          </div>
          
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Zap className="w-3 h-3" />
              <span className="text-[10px] uppercase tracking-wider">Trades Today</span>
            </div>
            <span className="text-2xl font-bold text-foreground">{tradesToday}</span>
          </div>
          
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Signal className="w-3 h-3" />
              <span className="text-[10px] uppercase tracking-wider">Pending Signals</span>
            </div>
            <span className="text-2xl font-bold text-foreground">{pendingSignals}</span>
          </div>
          
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Activity className="w-3 h-3" />
              <span className="text-[10px] uppercase tracking-wider">Queue Status</span>
            </div>
            <span className={cn("text-2xl font-bold capitalize", queueStatusColors[queueStatus])}>
              {queueStatus === 'active' ? 'Active' : queueStatus === 'paused' ? 'Paused' : 'Idle'}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
