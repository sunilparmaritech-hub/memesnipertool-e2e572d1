import { useSubscription } from "@/hooks/useSubscription";
import { Badge } from "@/components/ui/badge";
import { Crown, Zap, Rocket, Shield } from "lucide-react";
import { useNavigate } from "react-router-dom";

const PLAN_ICON = {
  free: Zap,
  pro: Rocket,
  elite: Crown,
  enterprise: Shield,
};

const PLAN_STYLE = {
  free: "bg-muted text-muted-foreground",
  pro: "bg-primary/20 text-primary border-primary/30",
  elite: "bg-accent/20 text-accent border-accent/30",
  enterprise: "bg-primary/20 text-primary border-primary/30",
};

export default function SubscriptionBadge() {
  const { plan, isActive } = useSubscription();
  const navigate = useNavigate();
  const Icon = PLAN_ICON[plan];

  return (
    <Badge
      variant="outline"
      className={`cursor-pointer ${PLAN_STYLE[plan]} text-xs gap-1`}
      onClick={() => navigate("/pricing")}
    >
      <Icon className="w-3 h-3" />
      {plan.charAt(0).toUpperCase() + plan.slice(1)}
      {!isActive && " (Expired)"}
    </Badge>
  );
}
