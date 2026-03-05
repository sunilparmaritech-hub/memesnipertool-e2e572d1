import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ArrowLeft, ThumbsUp, MessageSquare, User, Lock, Flag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useCommunityPost, TAG_LABELS, useUserReputation } from '@/hooks/useCommunity';
import ReputationBadge from './ReputationBadge';
import CommentItem from './CommentItem';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

interface Props {
  postId: string;
  onBack: () => void;
}

export default function PostDetail({ postId, onBack }: Props) {
  const { user, isAdmin } = useAuth();
  const { post, comments, loading, refetch } = useCommunityPost(postId);
  const { ensureReputation } = useUserReputation();
  const [commentText, setCommentText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const tagConfig = post ? (TAG_LABELS[post.tag] || TAG_LABELS.general) : TAG_LABELS.general;

  const handleComment = async () => {
    if (!user || !commentText.trim()) return;
    setSubmitting(true);
    try {
      await ensureReputation();
      const { error } = await supabase.from('community_comments').insert({
        post_id: postId,
        user_id: user.id,
        body: commentText.trim(),
      });
      if (error) throw error;
      const { data: rep } = await supabase.from('user_reputation').select('comments_count, reputation_score').eq('user_id', user.id).single();
      if (rep) await supabase.from('user_reputation').update({ comments_count: (rep.comments_count || 0) + 1, reputation_score: (rep.reputation_score || 0) + 1 }).eq('user_id', user.id);
      setCommentText('');
      refetch();
      toast.success('Comment posted!');
    } catch {
      toast.error('Failed to post comment');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-32 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
      </div>
    );
  }

  if (!post) {
    return <div className="text-center text-muted-foreground py-8">Post not found</div>;
  }

  const displayName = post.author_display_name || (post.author_email ? post.author_email.split('@')[0] : 'Anonymous');
  const isPostAuthor = user?.id === post.user_id;

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={onBack} className="gap-2">
        <ArrowLeft className="w-4 h-4" /> Back to discussions
      </Button>

      {/* Post */}
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded-full", tagConfig.color)}>{tagConfig.label}</span>
          {post.token_symbol && <Badge variant="outline" className="text-[10px] border-warning/30 text-warning">{post.token_symbol}</Badge>}
          {post.is_locked && <Badge variant="outline" className="text-[10px] gap-1"><Lock className="w-2.5 h-2.5" /> Locked</Badge>}
        </div>
        <h1 className="text-lg font-bold text-foreground mb-3">{post.title}</h1>
        <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap mb-4">{post.body}</p>
        <div className="flex items-center justify-between border-t border-border pt-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center">
              <User className="w-3.5 h-3.5" />
            </div>
            <span className="font-medium text-foreground">{displayName}</span>
            <ReputationBadge badge={post.author_badge} score={post.author_reputation} showScore />
            <span>·</span>
            <span>{formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}</span>
            <span>·</span>
            <span className="flex items-center gap-1"><ThumbsUp className="w-3 h-3" />{post.upvotes}</span>
            <span className="flex items-center gap-1"><MessageSquare className="w-3 h-3" />{post.comment_count}</span>
          </div>
        </div>
      </div>

      {/* Comments */}
      <div className="bg-card border border-border rounded-xl p-4">
        <h3 className="font-semibold text-sm mb-4 flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-primary" />
          {post.comment_count} {post.comment_count === 1 ? 'Comment' : 'Comments'}
        </h3>

        {comments.length === 0 ? (
          <div className="text-center text-sm text-muted-foreground py-6">No comments yet. Be the first!</div>
        ) : (
          <div className="divide-y divide-border/40">
            {comments.map(comment => (
              <CommentItem
                key={comment.id}
                comment={comment}
                postId={postId}
                isPostAuthor={isPostAuthor}
                bestAnswerId={post.best_answer_id}
                onUpdate={refetch}
              />
            ))}
          </div>
        )}

        {/* Comment form */}
        {user && !post.is_locked ? (
          <div className="mt-4 space-y-2 border-t border-border pt-4">
            <Textarea
              placeholder="Share your thoughts, insights, or solution..."
              value={commentText}
              onChange={e => setCommentText(e.target.value)}
              rows={3}
              maxLength={1000}
            />
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{commentText.length}/1000</span>
              <Button size="sm" onClick={handleComment} disabled={submitting || !commentText.trim()}>
                {submitting ? 'Posting...' : 'Post Comment'}
              </Button>
            </div>
          </div>
        ) : !user ? (
          <div className="mt-4 text-center text-sm text-muted-foreground border-t border-border pt-4 py-4">
            Sign in to comment
          </div>
        ) : (
          <div className="mt-4 text-center text-xs text-muted-foreground border-t border-border pt-4 py-3 flex items-center justify-center gap-2">
            <Lock className="w-3.5 h-3.5" /> This post is locked
          </div>
        )}
      </div>
    </div>
  );
}
