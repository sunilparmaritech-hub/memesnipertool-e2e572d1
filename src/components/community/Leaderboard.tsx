import { Crown, TrendingUp, MessageSquare, ThumbsUp } from 'lucide-react';
import { useLeaderboard, BADGE_CONFIG } from '@/hooks/useCommunity';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export default function Leaderboard() {
  const { leaders, loading } = useLeaderboard();

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 rounded-lg" />
        ))}
      </div>
    );
  }

  if (!leaders.length) {
    return <div className="text-center text-sm text-muted-foreground py-8">No contributors yet</div>;
  }

  return (
    <div className="space-y-2">
      {leaders.map((leader, idx) => {
        const badge = BADGE_CONFIG[leader.badge] || BADGE_CONFIG.new_trader;
        const displayName = leader.display_name || (leader.email ? leader.email.split('@')[0] : 'Anonymous');
        return (
          <div key={leader.user_id} className={cn(
            "flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-colors",
            idx === 0 ? "border-warning/40 bg-warning/5" :
            idx === 1 ? "border-border/60 bg-secondary/30" :
            idx === 2 ? "border-primary/20 bg-primary/3" :
            "border-border bg-card"
          )}>
            <div className={cn(
              "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0",
              idx === 0 ? "bg-warning/20 text-warning" :
              idx === 1 ? "bg-muted-foreground/20 text-muted-foreground" :
              idx === 2 ? "bg-orange-500/20 text-orange-500" :
              "bg-secondary text-muted-foreground"
            )}>
              {idx < 3 ? <Crown className="w-3.5 h-3.5" /> : idx + 1}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-foreground truncate">{displayName}</span>
                <span className={cn("text-[10px] font-medium", badge.color)}>
                  {badge.icon} {badge.label}
                </span>
              </div>
              <div className="flex items-center gap-3 text-[10px] text-muted-foreground mt-0.5">
                <span className="flex items-center gap-0.5"><ThumbsUp className="w-2.5 h-2.5" />{leader.upvotes_received}</span>
                <span className="flex items-center gap-0.5"><MessageSquare className="w-2.5 h-2.5" />{leader.posts_count + leader.comments_count}</span>
                <span className="flex items-center gap-0.5">⭐{leader.helpful_answers} best</span>
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-sm font-bold text-primary">{leader.reputation_score}</div>
              <div className="text-[10px] text-muted-foreground">rep</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
