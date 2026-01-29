import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, AlertCircle, TrendingUp, Bell } from "lucide-react";
import { cn } from "@/lib/utils";

interface Alert {
  id: string;
  type: 'critical' | 'warning' | 'opportunity';
  title: string;
  message: string;
  timestamp?: string;
}

interface AlertCenterProps {
  alerts?: Alert[];
}

const defaultAlerts: Alert[] = [
  { id: '1', type: 'critical', title: 'CRITICAL', message: 'Stop-loss triggered on SHIB' },
  { id: '2', type: 'warning', title: 'WARNING', message: 'High volatility detected in meme sector' },
  { id: '3', type: 'opportunity', title: 'OPPORTUNITY', message: 'New breakout pattern on PEPE' },
];

const alertStyles = {
  critical: {
    bg: 'bg-destructive/10 border-destructive/30',
    icon: AlertCircle,
    iconColor: 'text-destructive',
    titleColor: 'text-destructive',
  },
  warning: {
    bg: 'bg-warning/10 border-warning/30',
    icon: AlertTriangle,
    iconColor: 'text-warning',
    titleColor: 'text-warning',
  },
  opportunity: {
    bg: 'bg-success/10 border-success/30',
    icon: TrendingUp,
    iconColor: 'text-success',
    titleColor: 'text-success',
  },
};

export default function AlertCenter({ alerts = defaultAlerts }: AlertCenterProps) {
  return (
    <Card className="border border-border/50 bg-card/80 backdrop-blur-sm h-full">
      <CardHeader className="pb-2 pt-3 px-3">
        <div className="flex items-center gap-1.5">
          <Bell className="w-3.5 h-3.5 text-muted-foreground" />
          <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Alert Center
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="px-3 pb-3 space-y-1.5 overflow-y-auto max-h-[200px]">
        {alerts.length === 0 ? (
          <div className="text-center py-6">
            <Bell className="w-6 h-6 text-muted-foreground/30 mx-auto mb-1.5" />
            <p className="text-[10px] text-muted-foreground">No alerts</p>
          </div>
        ) : (
          alerts.map((alert, index) => {
            const style = alertStyles[alert.type];
            const Icon = style.icon;
            
            return (
              <div
                key={alert.id}
                className={cn(
                  "p-2.5 rounded-lg border transition-all duration-200 animate-fade-in",
                  style.bg
                )}
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className="flex items-start gap-2">
                  <Icon className={cn("w-3.5 h-3.5 mt-0.5 shrink-0", style.iconColor)} />
                  <div className="flex-1 min-w-0">
                    <p className={cn("text-[10px] font-bold uppercase tracking-wider", style.titleColor)}>
                      {alert.title}
                    </p>
                    <p className="text-[10px] text-foreground/80 mt-0.5">{alert.message}</p>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
