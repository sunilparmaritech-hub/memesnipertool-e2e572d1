import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ThumbsUp, Reply, Award, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { CommunityComment, useUserReputation } from '@/hooks/useCommunity';
import ReputationBadge from './ReputationBadge';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';

interface Props {
  comment: CommunityComment;
  postId: string;
  isPostAuthor: boolean;
  bestAnswerId?: string;
  onUpdate: () => void;
  depth?: number;
}

export default function CommentItem({ comment, postId, isPostAuthor, bestAnswerId, onUpdate, depth = 0 }: Props) {
  const { user, isAdmin } = useAuth();
  const { ensureReputation } = useUserReputation();
  const [voted, setVoted] = useState(comment.user_voted || false);
  const [upvotes, setUpvotes] = useState(comment.upvotes);
  const [replying, setReplying] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [submittingReply, setSubmittingReply] = useState(false);
  const isBest = comment.id === bestAnswerId;
  const displayName = comment.author_display_name || (comment.author_email ? comment.author_email.split('@')[0] : 'Anonymous');

  const handleVote = async () => {
    if (!user) return;
    await ensureReputation();
    const { data } = await supabase.rpc('handle_community_vote', {
      _user_id: user.id,
      _target_id: comment.id,
      _target_type: 'comment',
      _vote_type: 'up',
    } as never);
    if (data) {
      const result = data as { delta: number; voted: boolean };
      setVoted(result.voted);
      setUpvotes(prev => prev + result.delta);
    }
  };

  const handleReply = async () => {
    if (!user || !replyText.trim()) return;
    setSubmittingReply(true);
    try {
      await ensureReputation();
      const { error } = await supabase.from('community_comments').insert({
        post_id: postId,
        user_id: user.id,
        parent_id: comment.id,
        body: replyText.trim(),
      });
      if (error) throw error;
      // Update reputation
      const { data: rep } = await supabase.from('user_reputation').select('comments_count, reputation_score').eq('user_id', user.id).single();
      if (rep) await supabase.from('user_reputation').update({ comments_count: (rep.comments_count || 0) + 1, reputation_score: (rep.reputation_score || 0) + 1 }).eq('user_id', user.id);
      setReplyText('');
      setReplying(false);
      onUpdate();
    } catch {
      toast.error('Failed to post reply');
    } finally {
      setSubmittingReply(false);
    }
  };

  const handleMarkBest = async () => {
    await supabase.from('community_posts').update({ best_answer_id: isBest ? null : comment.id }).eq('id', postId);
    if (!isBest) {
      // Reward the answerer
      const { data: rep } = await supabase.from('user_reputation').select('helpful_answers, reputation_score').eq('user_id', comment.user_id).single();
      if (rep) await supabase.from('user_reputation').update({ helpful_answers: (rep.helpful_answers || 0) + 1, reputation_score: (rep.reputation_score || 0) + 10 }).eq('user_id', comment.user_id);
    }
    onUpdate();
  };

  const handleDelete = async () => {
    await supabase.from('community_comments').update({ is_deleted: true }).eq('id', comment.id);
    onUpdate();
  };

  return (
    <div className={cn("group", depth > 0 && "ml-8 border-l border-border/40 pl-4")}>
      <div className={cn("py-3", isBest && "bg-success/5 rounded-lg px-3 border border-success/20")}>
        {isBest && (
          <div className="flex items-center gap-1.5 text-success text-xs font-medium mb-2">
            <Award className="w-3.5 h-3.5" />
            Best Answer
          </div>
        )}
        <div className="flex items-start gap-2">
          <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center shrink-0 mt-0.5">
            <User className="w-4 h-4 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="text-xs font-semibold text-foreground">{displayName}</span>
              <ReputationBadge badge={comment.author_badge} />
              <span className="text-[10px] text-muted-foreground">{formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}</span>
            </div>
            <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">{comment.body}</p>
            <div className="flex items-center gap-2 mt-2">
              <Button variant="ghost" size="sm" className={cn("h-6 px-2 text-xs gap-1", voted ? "text-primary" : "text-muted-foreground")} onClick={handleVote}>
                <ThumbsUp className="w-3 h-3" /> {upvotes}
              </Button>
              {depth === 0 && (
                <Button variant="ghost" size="sm" className="h-6 px-2 text-xs text-muted-foreground gap-1" onClick={() => setReplying(!replying)}>
                  <Reply className="w-3 h-3" /> Reply
                </Button>
              )}
              {isPostAuthor && depth === 0 && (
                <Button variant="ghost" size="sm" className={cn("h-6 px-2 text-xs gap-1", isBest ? "text-success" : "text-muted-foreground hover:text-success")} onClick={handleMarkBest}>
                  <Award className="w-3 h-3" /> {isBest ? 'Unmark' : 'Best Answer'}
                </Button>
              )}
              {(user?.id === comment.user_id || isAdmin) && (
                <Button variant="ghost" size="sm" className="h-6 px-2 text-xs text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity" onClick={handleDelete}>
                  Delete
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Reply box */}
      {replying && (
        <div className="ml-9 mt-2 space-y-2">
          <Textarea placeholder="Write a reply..." value={replyText} onChange={e => setReplyText(e.target.value)} rows={2} className="text-sm" />
          <div className="flex gap-2">
            <Button size="sm" onClick={handleReply} disabled={submittingReply || !replyText.trim()}>Reply</Button>
            <Button size="sm" variant="ghost" onClick={() => setReplying(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {/* Nested replies */}
      {comment.replies && comment.replies.length > 0 && (
        <div className="mt-1 space-y-1">
          {comment.replies.map(reply => (
            <CommentItem key={reply.id} comment={reply} postId={postId} isPostAuthor={isPostAuthor} bestAnswerId={bestAnswerId} onUpdate={onUpdate} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}
