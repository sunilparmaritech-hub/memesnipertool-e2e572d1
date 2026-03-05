import { useState, useEffect, useRef } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Send, Hash, HelpCircle, TrendingUp, Zap, AlertTriangle, User, Pin, Reply as ReplyIcon, Smile } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useChatMessages, ChatChannel, ChatMessage } from '@/hooks/useCommunity';
import ReputationBadge from './ReputationBadge';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

const CHANNEL_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  'hash': Hash,
  'help-circle': HelpCircle,
  'trending-up': TrendingUp,
  'zap': Zap,
  'alert-triangle': AlertTriangle,
};

const EMOJIS = ['👍', '🔥', '🚀', '💎', '⚠️', '❤️', '😂', '🎯'];

interface Props {
  channels: ChatChannel[];
  initialChannelId?: string;
}

export default function ChatPanel({ channels, initialChannelId }: Props) {
  const { user, isAdmin } = useAuth();
  const [activeChannelId, setActiveChannelId] = useState<string | null>(initialChannelId || channels[0]?.id || null);
  const { messages, loading, sendMessage, addReaction } = useChatMessages(activeChannelId);
  const [input, setInput] = useState('');
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [showEmojis, setShowEmojis] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;
    await sendMessage(input, replyTo?.id);
    setInput('');
    setReplyTo(null);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handlePin = async (msgId: string, isPinned: boolean) => {
    if (!isAdmin) return;
    await supabase.from('chat_messages').update({ is_pinned: !isPinned }).eq('id', msgId);
  };

  const handleDelete = async (msgId: string) => {
    await supabase.from('chat_messages').update({ is_deleted: true }).eq('id', msgId);
  };

  const activeChannel = channels.find(c => c.id === activeChannelId);

  return (
    <div className="flex h-[600px] bg-card border border-border rounded-xl overflow-hidden">
      {/* Sidebar */}
      <div className="w-52 border-r border-border bg-secondary/20 flex flex-col shrink-0">
        <div className="px-3 py-3 border-b border-border">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Channels</p>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-0.5">
            {channels.map(ch => {
              const Icon = CHANNEL_ICONS[ch.icon] || Hash;
              const isActive = ch.id === activeChannelId;
              return (
                <button
                  key={ch.id}
                  onClick={() => setActiveChannelId(ch.id)}
                  className={cn(
                    "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left transition-colors text-xs",
                    isActive ? "bg-primary/15 text-primary font-medium" : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                  )}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{ch.name}</span>
                </button>
              );
            })}
          </div>
        </ScrollArea>
      </div>

      {/* Messages */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="px-4 py-2.5 border-b border-border flex items-center gap-2">
          {activeChannel && (() => { const Icon = CHANNEL_ICONS[activeChannel.icon] || Hash; return <Icon className="w-4 h-4 text-muted-foreground" />; })()}
          <span className="font-semibold text-sm">{activeChannel?.name || 'Select a channel'}</span>
          {activeChannel?.description && <span className="text-xs text-muted-foreground hidden sm:block">— {activeChannel.description}</span>}
        </div>

        {/* Message list */}
        <ScrollArea className="flex-1 px-4">
          {loading ? (
            <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">Loading...</div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
              <Hash className="w-8 h-8 mb-2 opacity-30" />
              <p className="text-sm">No messages yet. Start the conversation!</p>
            </div>
          ) : (
            <div className="py-3 space-y-1">
              {messages.map((msg, idx) => {
                const prevMsg = idx > 0 ? messages[idx - 1] : null;
                const isGrouped = prevMsg && prevMsg.user_id === msg.user_id &&
                  (new Date(msg.created_at).getTime() - new Date(prevMsg.created_at).getTime()) < 5 * 60 * 1000;
                const displayName = msg.author_display_name || (msg.author_email ? msg.author_email.split('@')[0] : 'Anonymous');

                return (
                  <div key={msg.id} className={cn("group flex items-start gap-2.5 px-1 py-0.5 rounded-lg hover:bg-secondary/30 transition-colors", msg.is_pinned && "bg-warning/5 border-l-2 border-warning pl-2")}>
                    {!isGrouped ? (
                      <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center shrink-0 mt-0.5">
                        <User className="w-4 h-4 text-muted-foreground" />
                      </div>
                    ) : <div className="w-7 shrink-0" />}
                    <div className="flex-1 min-w-0">
                      {!isGrouped && (
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-xs font-semibold text-foreground">{displayName}</span>
                          <ReputationBadge badge={msg.author_badge} />
                          <span className="text-[10px] text-muted-foreground">{formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })}</span>
                          {msg.is_pinned && <Pin className="w-3 h-3 text-warning" />}
                        </div>
                      )}
                      {msg.reply_to && (
                        <div className="text-[10px] text-muted-foreground bg-secondary/50 rounded px-2 py-1 mb-1 border-l-2 border-primary/40">
                          <span className="font-medium">{msg.reply_to.author_display_name}</span>: {msg.reply_to.content?.slice(0, 60)}...
                        </div>
                      )}
                      <p className="text-sm text-foreground/90 leading-relaxed break-words">{msg.content}</p>
                      {/* Reactions */}
                      {Object.entries(msg.reactions || {}).filter(([, users]) => users.length > 0).length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {Object.entries(msg.reactions || {}).filter(([, users]) => users.length > 0).map(([emoji, users]) => (
                            <button
                              key={emoji}
                              onClick={() => addReaction(msg.id, emoji)}
                              className={cn("text-[11px] px-1.5 py-0.5 rounded-full border transition-colors", user && (users as string[]).includes(user.id) ? "border-primary/40 bg-primary/10" : "border-border bg-secondary/50 hover:bg-secondary")}
                            >
                              {emoji} {(users as string[]).length}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    {/* Action buttons */}
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5 shrink-0">
                      <div className="relative">
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowEmojis(showEmojis === msg.id ? null : msg.id)}>
                          <Smile className="w-3 h-3" />
                        </Button>
                        {showEmojis === msg.id && (
                          <div className="absolute right-0 top-7 z-10 bg-card border border-border rounded-lg p-2 flex gap-1 shadow-lg">
                            {EMOJIS.map(e => (
                              <button key={e} className="text-base hover:scale-125 transition-transform" onClick={() => { addReaction(msg.id, e); setShowEmojis(null); }}>{e}</button>
                            ))}
                          </div>
                        )}
                      </div>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setReplyTo(msg)}>
                        <ReplyIcon className="w-3 h-3" />
                      </Button>
                      {isAdmin && (
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handlePin(msg.id, msg.is_pinned)}>
                          <Pin className="w-3 h-3" />
                        </Button>
                      )}
                      {(user?.id === msg.user_id || isAdmin) && (
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive/60 hover:text-destructive" onClick={() => handleDelete(msg.id)}>
                          ×
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>
          )}
        </ScrollArea>

        {/* Input */}
        <div className="px-4 py-3 border-t border-border">
          {replyTo && (
            <div className="flex items-center gap-2 mb-2 text-xs text-muted-foreground bg-secondary/50 rounded px-2 py-1">
              <ReplyIcon className="w-3 h-3" />
              <span>Replying to: <span className="text-foreground">{replyTo.content.slice(0, 50)}</span></span>
              <button className="ml-auto hover:text-foreground" onClick={() => setReplyTo(null)}>×</button>
            </div>
          )}
          {user ? (
            <div className="flex gap-2">
              <Input
                ref={inputRef}
                placeholder={`Message #${activeChannel?.name || '...'}`}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                maxLength={1000}
                className="flex-1"
              />
              <Button size="sm" onClick={handleSend} disabled={!input.trim()}>
                <Send className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            <div className="text-center text-sm text-muted-foreground py-2">Sign in to chat</div>
          )}
        </div>
      </div>
    </div>
  );
}
