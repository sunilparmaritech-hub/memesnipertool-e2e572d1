import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ThumbsUp, MessageSquare, Pin, Lock, ChevronRight, User } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TAG_LABELS, CommunityPost, useUserReputation } from '@/hooks/useCommunity';
import ReputationBadge from './ReputationBadge';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface Props {
  post: CommunityPost;
  onClick: () => void;
  onVoteChange?: () => void;
}

export default function PostCard({ post, onClick, onVoteChange }: Props) {
  const { user } = useAuth();
  const { ensureReputation } = useUserReputation();
  const [voted, setVoted] = useState(post.user_voted || false);
  const [upvotes, setUpvotes] = useState(post.upvotes);
  const tagConfig = TAG_LABELS[post.tag] || TAG_LABELS.general;
  const displayName = post.author_display_name || (post.author_email ? post.author_email.split('@')[0] : 'Anonymous');

  const handleVote = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) return;
    await ensureReputation();
    const { data } = await supabase.rpc('handle_community_vote', {
      _user_id: user.id,
      _target_id: post.id,
      _target_type: 'post',
      _vote_type: 'up',
    } as never);
    if (data) {
      const result = data as { delta: number; voted: boolean };
      setVoted(result.voted);
      setUpvotes(prev => prev + result.delta);
      onVoteChange?.();
    }
  };

  return (
    <div
      className={cn(
        "bg-card border border-border rounded-xl p-4 hover:border-border/80 hover:bg-card/80 cursor-pointer transition-all group",
        post.is_pinned && "border-primary/30 bg-primary/3"
      )}
      onClick={onClick}
    >
      <div className="flex items-start gap-3">
        {/* Vote */}
        <div className="flex flex-col items-center gap-1 pt-0.5 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className={cn("h-7 w-7 rounded-lg", voted ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-primary")}
            onClick={handleVote}
          >
            <ThumbsUp className="w-3.5 h-3.5" />
          </Button>
          <span className="text-xs font-bold text-muted-foreground">{upvotes}</span>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            {post.is_pinned && <Pin className="w-3 h-3 text-primary shrink-0" />}
            {post.is_locked && <Lock className="w-3 h-3 text-muted-foreground shrink-0" />}
            <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded-full", tagConfig.color)}>
              {tagConfig.label}
            </span>
            {post.token_symbol && (
              <Badge variant="outline" className="text-[10px] border-warning/30 text-warning">{post.token_symbol}</Badge>
            )}
          </div>

          <h3 className="font-semibold text-sm text-foreground leading-tight mb-1 line-clamp-2 group-hover:text-primary transition-colors">
            {post.title}
          </h3>
          <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{post.body}</p>

          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 rounded-full bg-secondary flex items-center justify-center">
                <User className="w-2.5 h-2.5" />
              </div>
              <span className="font-medium text-foreground">{displayName}</span>
              <ReputationBadge badge={post.author_badge} />
            </div>
            <span>·</span>
            <span>{formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}</span>
            <span>·</span>
            <span className="flex items-center gap-1">
              <MessageSquare className="w-3 h-3" />
              {post.comment_count}
            </span>
          </div>
        </div>
        <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors shrink-0 mt-1" />
      </div>
    </div>
  );
}
