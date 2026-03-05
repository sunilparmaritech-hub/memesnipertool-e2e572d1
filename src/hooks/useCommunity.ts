import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface CommunityPost {
  id: string;
  user_id: string;
  title: string;
  body: string;
  tag: string;
  token_address?: string;
  token_symbol?: string;
  upvotes: number;
  comment_count: number;
  is_pinned: boolean;
  is_locked: boolean;
  is_deleted: boolean;
  best_answer_id?: string;
  views: number;
  created_at: string;
  updated_at: string;
  // joined
  author_email?: string;
  author_display_name?: string;
  author_badge?: string;
  author_reputation?: number;
  user_voted?: boolean;
}

export interface CommunityComment {
  id: string;
  post_id: string;
  user_id: string;
  parent_id?: string;
  body: string;
  upvotes: number;
  is_best_answer: boolean;
  is_deleted: boolean;
  created_at: string;
  author_email?: string;
  author_display_name?: string;
  author_badge?: string;
  user_voted?: boolean;
  replies?: CommunityComment[];
}

export interface ChatChannel {
  id: string;
  name: string;
  description?: string;
  icon: string;
  channel_type: string;
  token_address?: string;
  is_active: boolean;
  message_count: number;
  last_message_at?: string;
  sort_order: number;
}

export interface ChatMessage {
  id: string;
  channel_id: string;
  user_id: string;
  reply_to_id?: string;
  content: string;
  message_type: string;
  reactions: Record<string, string[]>;
  is_pinned: boolean;
  is_deleted: boolean;
  edited_at?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
  author_email?: string;
  author_display_name?: string;
  author_badge?: string;
  reply_to?: { content: string; author_display_name?: string };
}

export interface UserReputation {
  id: string;
  user_id: string;
  reputation_score: number;
  helpful_answers: number;
  upvotes_received: number;
  posts_count: number;
  comments_count: number;
  badge: string;
  is_moderator: boolean;
}

const TAGS = ['general', 'strategy', 'help', 'bug', 'token', 'announcement'] as const;

export const TAG_LABELS: Record<string, { label: string; color: string }> = {
  general: { label: 'General', color: 'bg-secondary text-secondary-foreground' },
  strategy: { label: 'Strategy', color: 'bg-primary/20 text-primary' },
  help: { label: 'Help', color: 'bg-blue-500/20 text-blue-400' },
  bug: { label: 'Bug', color: 'bg-destructive/20 text-destructive' },
  token: { label: 'Token', color: 'bg-warning/20 text-warning' },
  announcement: { label: 'Announcement', color: 'bg-success/20 text-success' },
};

export const BADGE_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  new_trader: { label: 'New Trader', color: 'text-muted-foreground', icon: '🌱' },
  contributor: { label: 'Contributor', color: 'text-blue-400', icon: '⭐' },
  alpha_hunter: { label: 'Alpha Hunter', color: 'text-warning', icon: '🎯' },
  expert: { label: 'Community Expert', color: 'text-primary', icon: '👑' },
  moderator: { label: 'Moderator', color: 'text-success', icon: '🛡️' },
};

function computeBadge(score: number, isModerator: boolean): string {
  if (isModerator) return 'moderator';
  if (score >= 500) return 'expert';
  if (score >= 200) return 'alpha_hunter';
  if (score >= 50) return 'contributor';
  return 'new_trader';
}

// Fetch author info from profiles
async function fetchAuthorInfo(userIds: string[]): Promise<Map<string, { email?: string; display_name?: string }>> {
  const map = new Map<string, { email?: string; display_name?: string }>();
  if (!userIds.length) return map;
  const { data } = await supabase.from('profiles').select('user_id, email, display_name').in('user_id', userIds);
  (data || []).forEach(p => map.set(p.user_id, { email: p.email || undefined, display_name: p.display_name || undefined }));
  return map;
}

async function fetchRepMap(userIds: string[]): Promise<Map<string, UserReputation>> {
  const map = new Map<string, UserReputation>();
  if (!userIds.length) return map;
  const { data } = await supabase.from('user_reputation').select('*').in('user_id', userIds);
  (data || []).forEach(r => map.set(r.user_id, r as UserReputation));
  return map;
}

export function useCommunityPosts(filter: { tag?: string; tokenAddress?: string; search?: string; sort?: string } = {}) {
  const { user } = useAuth();
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase.from('community_posts').select('*').eq('is_deleted', false);
      if (filter.tag && filter.tag !== 'all') query = query.eq('tag', filter.tag);
      if (filter.tokenAddress) query = query.eq('token_address', filter.tokenAddress);
      if (filter.search) query = query.or(`title.ilike.%${filter.search}%,body.ilike.%${filter.search}%`);
      if (filter.sort === 'popular') query = query.order('upvotes', { ascending: false });
      else query = query.order('is_pinned', { ascending: false }).order('created_at', { ascending: false });
      query = query.limit(50);

      const { data, error } = await query;
      if (error) throw error;

      const posts = (data || []) as CommunityPost[];
      const userIds = [...new Set(posts.map(p => p.user_id))];
      const [authorMap, repMap] = await Promise.all([fetchAuthorInfo(userIds), fetchRepMap(userIds)]);

      let votedSet = new Set<string>();
      if (user) {
        const { data: votes } = await supabase.from('community_votes').select('target_id').eq('user_id', user.id).eq('target_type', 'post').in('target_id', posts.map(p => p.id));
        votedSet = new Set((votes || []).map(v => v.target_id));
      }

      setPosts(posts.map(p => {
        const rep = repMap.get(p.user_id);
        const author = authorMap.get(p.user_id);
        return {
          ...p,
          author_email: author?.email,
          author_display_name: author?.display_name,
          author_badge: rep ? computeBadge(rep.reputation_score, rep.is_moderator) : 'new_trader',
          author_reputation: rep?.reputation_score || 0,
          user_voted: votedSet.has(p.id),
        };
      }));
    } catch (err) {
      console.error('Error fetching posts:', err);
    } finally {
      setLoading(false);
    }
  }, [filter.tag, filter.tokenAddress, filter.search, filter.sort, user?.id]);

  useEffect(() => { fetchPosts(); }, [fetchPosts]);

  return { posts, loading, refetch: fetchPosts };
}

export function useCommunityPost(postId: string) {
  const { user } = useAuth();
  const [post, setPost] = useState<CommunityPost | null>(null);
  const [comments, setComments] = useState<CommunityComment[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPost = useCallback(async () => {
    if (!postId) return;
    setLoading(true);
    try {
      const [{ data: postData }, { data: commentsData }] = await Promise.all([
        supabase.from('community_posts').select('*').eq('id', postId).single(),
        supabase.from('community_comments').select('*').eq('post_id', postId).eq('is_deleted', false).order('created_at', { ascending: true }),
      ]);

      if (!postData) return;

      // Increment views
      await supabase.from('community_posts').update({ views: (postData.views || 0) + 1 }).eq('id', postId);

      const allUserIds = [...new Set([postData.user_id, ...(commentsData || []).map((c: CommunityComment) => c.user_id)])];
      const [authorMap, repMap] = await Promise.all([fetchAuthorInfo(allUserIds), fetchRepMap(allUserIds)]);

      let postVoted = false;
      const commentVotedSet = new Set<string>();
      if (user) {
        const targetIds = [postId, ...(commentsData || []).map((c: CommunityComment) => c.id)];
        const { data: votes } = await supabase.from('community_votes').select('target_id, target_type').eq('user_id', user.id).in('target_id', targetIds);
        (votes || []).forEach(v => {
          if (v.target_type === 'post') postVoted = true;
          else commentVotedSet.add(v.target_id);
        });
      }

      const postRep = repMap.get(postData.user_id);
      const postAuthor = authorMap.get(postData.user_id);
      setPost({
        ...postData,
        views: (postData.views || 0) + 1,
        author_email: postAuthor?.email,
        author_display_name: postAuthor?.display_name,
        author_badge: postRep ? computeBadge(postRep.reputation_score, postRep.is_moderator) : 'new_trader',
        author_reputation: postRep?.reputation_score || 0,
        user_voted: postVoted,
      } as CommunityPost);

      const rawComments = (commentsData || []) as CommunityComment[];
      const enriched = rawComments.map(c => {
        const rep = repMap.get(c.user_id);
        const author = authorMap.get(c.user_id);
        return {
          ...c,
          author_email: author?.email,
          author_display_name: author?.display_name,
          author_badge: rep ? computeBadge(rep.reputation_score, rep.is_moderator) : 'new_trader',
          user_voted: commentVotedSet.has(c.id),
        };
      });
      // Build tree
      const topLevel = enriched.filter(c => !c.parent_id);
      topLevel.forEach(c => {
        c.replies = enriched.filter(r => r.parent_id === c.id);
      });
      setComments(topLevel);
    } catch (err) {
      console.error('Error fetching post:', err);
    } finally {
      setLoading(false);
    }
  }, [postId, user?.id]);

  useEffect(() => { fetchPost(); }, [fetchPost]);
  return { post, comments, loading, refetch: fetchPost };
}

export function useChatMessages(channelId: string | null) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);

  const enrichMessages = useCallback(async (rawMessages: ChatMessage[]) => {
    if (!rawMessages.length) return [];
    const userIds = [...new Set(rawMessages.map(m => m.user_id))];
    const [authorMap, repMap] = await Promise.all([fetchAuthorInfo(userIds), fetchRepMap(userIds)]);
    return rawMessages.map(m => {
      const rep = repMap.get(m.user_id);
      const author = authorMap.get(m.user_id);
      return {
        ...m,
        author_email: author?.email,
        author_display_name: author?.display_name,
        author_badge: rep ? computeBadge(rep.reputation_score, rep.is_moderator) : 'new_trader',
      };
    });
  }, []);

  useEffect(() => {
    if (!channelId) return;
    setLoading(true);

    supabase.from('chat_messages').select('*').eq('channel_id', channelId).eq('is_deleted', false).order('created_at', { ascending: true }).limit(100)
      .then(async ({ data }) => {
        const enriched = await enrichMessages((data || []) as ChatMessage[]);
        setMessages(enriched);
        setLoading(false);
      });

    const channel = supabase.channel(`chat:${channelId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `channel_id=eq.${channelId}` },
        async (payload) => {
          const newMsg = payload.new as ChatMessage;
          const enriched = await enrichMessages([newMsg]);
          setMessages(prev => [...prev, ...enriched]);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [channelId, enrichMessages]);

  const sendMessage = useCallback(async (content: string, replyToId?: string) => {
    if (!user || !channelId || !content.trim()) return;
    const { error } = await supabase.from('chat_messages').insert({
      channel_id: channelId,
      user_id: user.id,
      content: content.trim(),
      reply_to_id: replyToId || null,
    });
    if (error) toast.error('Failed to send message');
  }, [user, channelId]);

  const addReaction = useCallback(async (messageId: string, emoji: string) => {
    if (!user) return;
    const msg = messages.find(m => m.id === messageId);
    if (!msg) return;
    const reactions = { ...msg.reactions };
    if (!reactions[emoji]) reactions[emoji] = [];
    const idx = reactions[emoji].indexOf(user.id);
    if (idx > -1) reactions[emoji].splice(idx, 1);
    else reactions[emoji].push(user.id);
    await supabase.from('chat_messages').update({ reactions }).eq('id', messageId);
    setMessages(prev => prev.map(m => m.id === messageId ? { ...m, reactions } : m));
  }, [user, messages]);

  return { messages, loading, sendMessage, addReaction };
}

export function useUserReputation(userId?: string) {
  const { user } = useAuth();
  const [reputation, setReputation] = useState<UserReputation | null>(null);

  const targetId = userId || user?.id;

  useEffect(() => {
    if (!targetId) return;
    supabase.from('user_reputation').select('*').eq('user_id', targetId).maybeSingle()
      .then(({ data }) => {
        if (data) setReputation(data as UserReputation);
      });
  }, [targetId]);

  const ensureReputation = useCallback(async () => {
    if (!user) return null;
    const { data } = await supabase.from('user_reputation').select('*').eq('user_id', user.id).maybeSingle();
    if (!data) {
      const { data: inserted } = await supabase.from('user_reputation').insert({ user_id: user.id }).select().single();
      return inserted as UserReputation;
    }
    return data as UserReputation;
  }, [user]);

  return { reputation, ensureReputation };
}

export function useLeaderboard() {
  const [leaders, setLeaders] = useState<(UserReputation & { email?: string; display_name?: string })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from('user_reputation').select('*').order('reputation_score', { ascending: false }).limit(20)
      .then(async ({ data }) => {
        if (!data) { setLoading(false); return; }
        const userIds = data.map(r => r.user_id);
        const authorMap = await fetchAuthorInfo(userIds);
        setLeaders((data as UserReputation[]).map(r => ({
          ...r,
          ...(authorMap.get(r.user_id) || {}),
        })));
        setLoading(false);
      });
  }, []);

  return { leaders, loading };
}

export { TAGS };
