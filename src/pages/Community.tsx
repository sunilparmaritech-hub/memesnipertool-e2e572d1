import { useState, useEffect } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Users, MessageSquare, Hash, Trophy, TrendingUp, Plus, Search, Zap, Flame } from 'lucide-react';
import { useCommunityPosts, TAG_LABELS, useUserReputation } from '@/hooks/useCommunity';
import PostCard from '@/components/community/PostCard';
import PostDetail from '@/components/community/PostDetail';
import NewPostForm from '@/components/community/NewPostForm';
import ChatPanel from '@/components/community/ChatPanel';
import Leaderboard from '@/components/community/Leaderboard';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export default function Community() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('discussions');
  const [selectedTag, setSelectedTag] = useState('all');
  const [sort, setSort] = useState('latest');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [showNewPost, setShowNewPost] = useState(false);
  const [channels, setChannels] = useState<{ id: string; name: string; description?: string; icon: string; channel_type: string; is_active: boolean; message_count: number; sort_order: number }[]>([]);
  const { ensureReputation } = useUserReputation();

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  // Fetch channels
  useEffect(() => {
    supabase.from('chat_channels').select('*').eq('is_active', true).order('sort_order', { ascending: true })
      .then(({ data }) => setChannels((data || []) as typeof channels));
  }, []);

  // Ensure reputation on mount
  useEffect(() => {
    if (user) ensureReputation();
  }, [user, ensureReputation]);

  const { posts, loading, refetch } = useCommunityPosts({
    tag: selectedTag === 'all' ? undefined : selectedTag,
    search: debouncedSearch || undefined,
    sort,
  });

  const stats = {
    posts: posts.length,
    channels: channels.length,
  };

  return (
    <AppLayout>
      <div className="container mx-auto px-3 sm:px-4 max-w-6xl py-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-primary/15 flex items-center justify-center">
                <Users className="w-4 h-4 text-primary" />
              </div>
              <h1 className="text-xl font-bold text-foreground">Community</h1>
            </div>
            {user && (
              <Button
                size="sm"
                className="gap-1.5"
                onClick={() => { setShowNewPost(true); setActiveTab('discussions'); setSelectedPostId(null); }}
              >
                <Plus className="w-3.5 h-3.5" /> New Post
              </Button>
            )}
          </div>
          <p className="text-sm text-muted-foreground ml-10">Collaborate with traders, share alpha, and get help</p>

          {/* Quick stats */}
          <div className="flex gap-4 mt-3 ml-10">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <MessageSquare className="w-3.5 h-3.5 text-primary" />
              <span className="font-medium text-foreground">{posts.length}</span> discussions
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Hash className="w-3.5 h-3.5 text-primary" />
              <span className="font-medium text-foreground">{channels.length}</span> channels
            </div>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); setSelectedPostId(null); setShowNewPost(false); }}>
          <TabsList className="mb-5 bg-secondary/30 p-0.5 h-9">
            <TabsTrigger value="discussions" className="text-xs h-8 gap-1.5">
              <MessageSquare className="w-3.5 h-3.5" /> Discussions
            </TabsTrigger>
            <TabsTrigger value="chat" className="text-xs h-8 gap-1.5">
              <Hash className="w-3.5 h-3.5" /> Live Chat
            </TabsTrigger>
            <TabsTrigger value="leaderboard" className="text-xs h-8 gap-1.5">
              <Trophy className="w-3.5 h-3.5" /> Leaderboard
            </TabsTrigger>
          </TabsList>

          {/* ── DISCUSSIONS ── */}
          <TabsContent value="discussions">
            {selectedPostId ? (
              <PostDetail postId={selectedPostId} onBack={() => setSelectedPostId(null)} />
            ) : (
              <div className="space-y-4">
                {showNewPost && (
                  <NewPostForm
                    onCreated={() => { setShowNewPost(false); refetch(); }}
                    onClose={() => setShowNewPost(false)}
                  />
                )}

                {/* Filters */}
                <div className="flex flex-wrap gap-2">
                  <div className="relative flex-1 min-w-48">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                    <Input
                      placeholder="Search discussions..."
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      className="pl-8 h-8 text-xs"
                    />
                  </div>
                  <Select value={selectedTag} onValueChange={setSelectedTag}>
                    <SelectTrigger className="w-32 h-8 text-xs">
                      <SelectValue placeholder="All tags" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Tags</SelectItem>
                      {Object.entries(TAG_LABELS).map(([key, val]) => (
                        <SelectItem key={key} value={key}>{val.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={sort} onValueChange={setSort}>
                    <SelectTrigger className="w-32 h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="latest">Latest</SelectItem>
                      <SelectItem value="popular">Most Popular</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Tag chips */}
                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={() => setSelectedTag('all')}
                    className={cn("text-xs px-2.5 py-1 rounded-full border transition-colors", selectedTag === 'all' ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:border-foreground/30')}
                  >
                    All
                  </button>
                  {Object.entries(TAG_LABELS).map(([key, val]) => (
                    <button
                      key={key}
                      onClick={() => setSelectedTag(key)}
                      className={cn("text-xs px-2.5 py-1 rounded-full border transition-colors", selectedTag === key ? `${val.color} border-transparent` : 'border-border text-muted-foreground hover:border-foreground/30')}
                    >
                      {val.label}
                    </button>
                  ))}
                </div>

                {/* Posts list */}
                {loading ? (
                  <div className="space-y-3">
                    {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
                  </div>
                ) : posts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                    <MessageSquare className="w-12 h-12 mb-3 opacity-20" />
                    <p className="font-medium">No discussions yet</p>
                    <p className="text-sm">Be the first to start a conversation!</p>
                    {user && (
                      <Button size="sm" className="mt-4 gap-1.5" onClick={() => setShowNewPost(true)}>
                        <Plus className="w-3.5 h-3.5" /> Start a discussion
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {posts.map(post => (
                      <PostCard
                        key={post.id}
                        post={post}
                        onClick={() => setSelectedPostId(post.id)}
                        onVoteChange={refetch}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          {/* ── LIVE CHAT ── */}
          <TabsContent value="chat">
            {channels.length > 0 ? (
              <ChatPanel channels={channels} />
            ) : (
              <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
                Loading channels...
              </div>
            )}
          </TabsContent>

          {/* ── LEADERBOARD ── */}
          <TabsContent value="leaderboard">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <div className="bg-card border border-border rounded-xl p-5">
                  <h2 className="font-semibold text-base mb-4 flex items-center gap-2">
                    <Trophy className="w-4 h-4 text-warning" />
                    Top Contributors
                  </h2>
                  <Leaderboard />
                </div>
              </div>
              <div className="space-y-4">
                <div className="bg-card border border-border rounded-xl p-4">
                  <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                    <Flame className="w-4 h-4 text-orange-400" />
                    How to Earn Reputation
                  </h3>
                  <div className="space-y-2 text-xs text-muted-foreground">
                    {[
                      { action: 'Post a discussion', pts: '+2 pts' },
                      { action: 'Comment / reply', pts: '+1 pt' },
                      { action: 'Get upvote on post', pts: '+3 pts' },
                      { action: 'Get upvote on comment', pts: '+2 pts' },
                      { action: 'Best answer marked', pts: '+10 pts' },
                    ].map(item => (
                      <div key={item.action} className="flex justify-between">
                        <span>{item.action}</span>
                        <span className="font-medium text-success">{item.pts}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="bg-card border border-border rounded-xl p-4">
                  <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                    <Zap className="w-4 h-4 text-primary" />
                    Badges
                  </h3>
                  <div className="space-y-1.5 text-xs">
                    {[
                      { icon: '🌱', label: 'New Trader', req: '0 rep' },
                      { icon: '⭐', label: 'Contributor', req: '50+ rep' },
                      { icon: '🎯', label: 'Alpha Hunter', req: '200+ rep' },
                      { icon: '👑', label: 'Community Expert', req: '500+ rep' },
                      { icon: '🛡️', label: 'Moderator', req: 'Assigned by admin' },
                    ].map(b => (
                      <div key={b.label} className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5">{b.icon} <span className="text-foreground font-medium">{b.label}</span></span>
                        <span className="text-muted-foreground">{b.req}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
