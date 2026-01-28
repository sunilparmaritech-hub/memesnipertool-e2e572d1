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
    <Card className="border-0 bg-gradient-to-br from-card/90 to-card/60 backdrop-blur-xl h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-muted-foreground" />
          <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Alert Center
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 overflow-y-auto max-h-[250px]">
        {alerts.length === 0 ? (
          <div className="text-center py-8">
            <Bell className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No alerts</p>
          </div>
        ) : (
          alerts.map((alert, index) => {
            const style = alertStyles[alert.type];
            const Icon = style.icon;
            
            return (
              <div
                key={alert.id}
                className={cn(
                  "p-3 rounded-xl border transition-all duration-200 animate-fade-in",
                  style.bg
                )}
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className="flex items-start gap-2">
                  <Icon className={cn("w-4 h-4 mt-0.5 shrink-0", style.iconColor)} />
                  <div className="flex-1 min-w-0">
                    <p className={cn("text-xs font-bold uppercase tracking-wider", style.titleColor)}>
                      {alert.title}
                    </p>
                    <p className="text-xs text-foreground mt-0.5">{alert.message}</p>
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
