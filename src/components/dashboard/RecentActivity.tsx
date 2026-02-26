import { Badge } from "@/components/ui/badge";
import { Bell, AlertTriangle, CheckCircle, AlertCircle, Lightbulb } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { useNotifications } from "@/hooks/useNotifications";

const activityStyles = {
  success: { bg: "bg-success/5 border-success/20", text: "text-success", label: "SIGNAL" },
  warning: { bg: "bg-warning/5 border-warning/20", text: "text-warning", label: "WARNING" },
  error: { bg: "bg-destructive/5 border-destructive/20", text: "text-destructive", label: "ALERT" },
  info: { bg: "bg-primary/5 border-primary/20", text: "text-primary", label: "INFO" },
  trade: { bg: "bg-accent/5 border-accent/20", text: "text-accent", label: "TRADE" },
};

export default function RecentActivity() {
  const { notifications } = useNotifications();
  const recentNotifications = notifications.slice(0, 4);

  return (
    <div className="rounded-xl border border-border/40 bg-card/60 backdrop-blur-sm overflow-hidden flex flex-col">
      <div className="px-4 py-3 flex items-center justify-between border-b border-border/30">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-primary" />
          <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground whitespace-nowrap">Alerts</h3>
        </div>
        <Badge variant="outline" className="text-[8px] px-1.5 py-0 bg-primary/10 text-primary border-primary/30">
          {recentNotifications.length}
        </Badge>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {recentNotifications.length === 0 ? (
          <div className="text-center py-8">
            <Bell className="w-6 h-6 text-muted-foreground/20 mx-auto mb-2" />
            <p className="text-xs text-muted-foreground">No alerts</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {recentNotifications.map((notification, index) => {
              const style = activityStyles[notification.type as keyof typeof activityStyles] || activityStyles.info;

              return (
                <div
                  key={notification.id}
                  className={cn("p-2.5 rounded-lg border transition-all", style.bg)}
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className={cn("text-[9px] font-bold uppercase tracking-wider", style.text)}>
                      {style.label}
                    </span>
                    <span className="text-[9px] text-muted-foreground shrink-0">
                      {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                    </span>
                  </div>
                  <p className="text-[11px] text-foreground/80 line-clamp-2">
                    {notification.message || notification.title}
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
