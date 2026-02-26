import { Zap, Bot, Shield, BarChart3, Crosshair, BookOpen, Rocket } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

const quickActions = [
  { icon: Crosshair, label: "Scanner", path: "/scanner", iconColor: "text-primary" },
  { icon: Bot, label: "Bot Config", path: "/sniper-settings", iconColor: "text-accent" },
  { icon: Shield, label: "Risk", path: "/risk", iconColor: "text-warning" },
  { icon: BarChart3, label: "Portfolio", path: "/portfolio", iconColor: "text-success" },
  { icon: BookOpen, label: "Guide", path: "/basics", iconColor: "text-primary" },
  { icon: Rocket, label: "Referrals", path: "/promotions", iconColor: "text-accent" },
];

export default function QuickActions() {
  return (
    <div className="rounded-xl border border-border/20 bg-card/40 overflow-hidden">
      <div className="px-3 py-2 border-b border-border/15">
        <div className="flex items-center gap-1.5">
          <Zap className="w-3.5 h-3.5 text-accent" />
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-foreground">Quick Actions</h3>
        </div>
      </div>
      <div className="p-1.5 grid grid-cols-3 gap-1">
        {quickActions.map((action) => {
          const Icon = action.icon;
          return (
            <Link key={action.label} to={action.path}>
              <div className="px-2 py-2 rounded-md border border-border/20 bg-secondary/30 hover:bg-secondary/50 hover:border-primary/20 transition-all duration-150 flex flex-col items-center gap-1 text-center">
                <Icon className={cn("w-4 h-4", action.iconColor)} />
                <p className="font-medium text-[10px] text-foreground leading-none truncate w-full">{action.label}</p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
