
-- =============================================
-- COMMUNITY MODULE - Full Schema
-- =============================================

-- 1. User Reputation Table
CREATE TABLE IF NOT EXISTS public.user_reputation (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  reputation_score INTEGER NOT NULL DEFAULT 0,
  helpful_answers INTEGER NOT NULL DEFAULT 0,
  upvotes_received INTEGER NOT NULL DEFAULT 0,
  posts_count INTEGER NOT NULL DEFAULT 0,
  comments_count INTEGER NOT NULL DEFAULT 0,
  accurate_insights INTEGER NOT NULL DEFAULT 0,
  badge TEXT NOT NULL DEFAULT 'new_trader',
  is_moderator BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.user_reputation ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view reputation" ON public.user_reputation FOR SELECT USING (true);
CREATE POLICY "Users can insert own reputation" ON public.user_reputation FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own reputation" ON public.user_reputation FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage all reputation" ON public.user_reputation FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- 2. Community Posts Table
CREATE TABLE IF NOT EXISTS public.community_posts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  tag TEXT NOT NULL DEFAULT 'general',
  token_address TEXT,
  token_symbol TEXT,
  upvotes INTEGER NOT NULL DEFAULT 0,
  comment_count INTEGER NOT NULL DEFAULT 0,
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  is_locked BOOLEAN NOT NULL DEFAULT false,
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  best_answer_id UUID,
  views INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.community_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view non-deleted posts" ON public.community_posts FOR SELECT USING (is_deleted = false);
CREATE POLICY "Users can insert own posts" ON public.community_posts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own posts" ON public.community_posts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage all posts" ON public.community_posts FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_community_posts_user ON public.community_posts(user_id);
CREATE INDEX IF NOT EXISTS idx_community_posts_tag ON public.community_posts(tag);
CREATE INDEX IF NOT EXISTS idx_community_posts_token ON public.community_posts(token_address);
CREATE INDEX IF NOT EXISTS idx_community_posts_created ON public.community_posts(created_at DESC);

-- 3. Community Comments Table
CREATE TABLE IF NOT EXISTS public.community_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  parent_id UUID REFERENCES public.community_comments(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  upvotes INTEGER NOT NULL DEFAULT 0,
  is_best_answer BOOLEAN NOT NULL DEFAULT false,
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.community_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view non-deleted comments" ON public.community_comments FOR SELECT USING (is_deleted = false);
CREATE POLICY "Users can insert own comments" ON public.community_comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own comments" ON public.community_comments FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage all comments" ON public.community_comments FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_community_comments_post ON public.community_comments(post_id);
CREATE INDEX IF NOT EXISTS idx_community_comments_user ON public.community_comments(user_id);

-- 4. Post Votes Table
CREATE TABLE IF NOT EXISTS public.community_votes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  target_id UUID NOT NULL,
  target_type TEXT NOT NULL CHECK (target_type IN ('post', 'comment')),
  vote_type TEXT NOT NULL DEFAULT 'up' CHECK (vote_type IN ('up', 'down')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, target_id, target_type)
);

ALTER TABLE public.community_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own votes" ON public.community_votes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own votes" ON public.community_votes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own votes" ON public.community_votes FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_community_votes_target ON public.community_votes(target_id, target_type);

-- 5. Chat Channels Table
CREATE TABLE IF NOT EXISTS public.chat_channels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  icon TEXT DEFAULT 'hash',
  channel_type TEXT NOT NULL DEFAULT 'public' CHECK (channel_type IN ('public', 'token', 'private')),
  token_address TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  message_count INTEGER NOT NULL DEFAULT 0,
  last_message_at TIMESTAMP WITH TIME ZONE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.chat_channels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active channels" ON public.chat_channels FOR SELECT USING (is_active = true);
CREATE POLICY "Admins can manage channels" ON public.chat_channels FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- 6. Chat Messages Table
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  channel_id UUID NOT NULL REFERENCES public.chat_channels(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  reply_to_id UUID REFERENCES public.chat_messages(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  message_type TEXT NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'token_alert', 'system', 'image')),
  reactions JSONB NOT NULL DEFAULT '{}',
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  edited_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view non-deleted messages" ON public.chat_messages FOR SELECT USING (auth.uid() IS NOT NULL AND is_deleted = false);
CREATE POLICY "Authenticated can insert messages" ON public.chat_messages FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own messages" ON public.chat_messages FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage all messages" ON public.chat_messages FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_chat_messages_channel ON public.chat_messages(channel_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_user ON public.chat_messages(user_id);

-- 7. Token Sentiment Table
CREATE TABLE IF NOT EXISTS public.token_sentiment (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  token_address TEXT NOT NULL,
  user_id UUID NOT NULL,
  sentiment TEXT NOT NULL CHECK (sentiment IN ('bullish', 'bearish', 'neutral')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(token_address, user_id)
);

ALTER TABLE public.token_sentiment ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view sentiment" ON public.token_sentiment FOR SELECT USING (true);
CREATE POLICY "Users can manage own sentiment" ON public.token_sentiment FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_token_sentiment_address ON public.token_sentiment(token_address);

-- 8. Content Reports Table  
CREATE TABLE IF NOT EXISTS public.community_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  reporter_id UUID NOT NULL,
  target_id UUID NOT NULL,
  target_type TEXT NOT NULL CHECK (target_type IN ('post', 'comment', 'message')),
  reason TEXT NOT NULL,
  details TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'actioned', 'dismissed')),
  reviewed_by UUID,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.community_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert reports" ON public.community_reports FOR INSERT WITH CHECK (auth.uid() = reporter_id);
CREATE POLICY "Users can view own reports" ON public.community_reports FOR SELECT USING (auth.uid() = reporter_id);
CREATE POLICY "Admins can manage all reports" ON public.community_reports FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_community_reports_status ON public.community_reports(status);

-- Enable realtime for chat_messages and community tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.community_posts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.community_comments;

-- Triggers for updated_at
CREATE TRIGGER update_community_posts_updated_at BEFORE UPDATE ON public.community_posts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_community_comments_updated_at BEFORE UPDATE ON public.community_comments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_user_reputation_updated_at BEFORE UPDATE ON public.user_reputation FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function to update post comment count
CREATE OR REPLACE FUNCTION public.update_post_comment_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.community_posts SET comment_count = comment_count + 1 WHERE id = NEW.post_id;
  ELSIF TG_OP = 'UPDATE' AND NEW.is_deleted = true AND OLD.is_deleted = false THEN
    UPDATE public.community_posts SET comment_count = GREATEST(comment_count - 1, 0) WHERE id = NEW.post_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_update_comment_count
AFTER INSERT OR UPDATE ON public.community_comments
FOR EACH ROW EXECUTE FUNCTION public.update_post_comment_count();

-- Function to handle vote toggle
CREATE OR REPLACE FUNCTION public.handle_community_vote(
  _user_id UUID,
  _target_id UUID,
  _target_type TEXT,
  _vote_type TEXT DEFAULT 'up'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  existing_vote RECORD;
  delta INTEGER;
BEGIN
  SELECT * INTO existing_vote FROM public.community_votes 
  WHERE user_id = _user_id AND target_id = _target_id AND target_type = _target_type;
  
  IF existing_vote IS NOT NULL THEN
    DELETE FROM public.community_votes WHERE id = existing_vote.id;
    delta := -1;
  ELSE
    INSERT INTO public.community_votes (user_id, target_id, target_type, vote_type)
    VALUES (_user_id, _target_id, _target_type, _vote_type);
    delta := 1;
  END IF;

  IF _target_type = 'post' THEN
    UPDATE public.community_posts SET upvotes = GREATEST(upvotes + delta, 0) WHERE id = _target_id;
  ELSIF _target_type = 'comment' THEN
    UPDATE public.community_comments SET upvotes = GREATEST(upvotes + delta, 0) WHERE id = _target_id;
  END IF;

  RETURN jsonb_build_object('success', true, 'delta', delta, 'voted', delta = 1);
END;
$$;

-- Insert default chat channels
INSERT INTO public.chat_channels (name, description, icon, channel_type, sort_order) VALUES
  ('general', 'General discussion for all traders', 'hash', 'public', 1),
  ('platform-help', 'Get help with platform features', 'help-circle', 'public', 2),
  ('trading-strategies', 'Share and discuss trading strategies', 'trending-up', 'public', 3),
  ('new-token-alerts', 'Discuss newly detected tokens', 'zap', 'public', 4),
  ('rug-alerts', 'Report and discuss suspected rugs', 'alert-triangle', 'public', 5)
ON CONFLICT (name) DO NOTHING;
