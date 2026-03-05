import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TAG_LABELS, useUserReputation } from '@/hooks/useCommunity';
import { toast } from 'sonner';
import { X } from 'lucide-react';

interface Props {
  onCreated: () => void;
  onClose: () => void;
  prefillTokenAddress?: string;
  prefillTokenSymbol?: string;
}

export default function NewPostForm({ onCreated, onClose, prefillTokenAddress, prefillTokenSymbol }: Props) {
  const { user } = useAuth();
  const { ensureReputation } = useUserReputation();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [tag, setTag] = useState(prefillTokenAddress ? 'token' : 'general');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!user) { toast.error('Sign in required'); return; }
    if (!title.trim() || !body.trim()) { toast.error('Title and body required'); return; }
    setSubmitting(true);
    try {
      await ensureReputation();
      const { error } = await supabase.from('community_posts').insert({
        user_id: user.id,
        title: title.trim(),
        body: body.trim(),
        tag,
        token_address: prefillTokenAddress || null,
        token_symbol: prefillTokenSymbol || null,
      });
      if (error) throw error;
      // Increment posts_count in reputation
      await supabase.from('user_reputation').update({ posts_count: supabase.rpc as unknown as number }).eq('user_id', user.id);
      // Simple upsert for reputation increment
      const { data: rep } = await supabase.from('user_reputation').select('posts_count, reputation_score').eq('user_id', user.id).single();
      if (rep) {
        await supabase.from('user_reputation').update({
          posts_count: (rep.posts_count || 0) + 1,
          reputation_score: (rep.reputation_score || 0) + 2,
        }).eq('user_id', user.id);
      }
      toast.success('Post created!');
      onCreated();
    } catch (err) {
      toast.error('Failed to create post');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-card border border-border rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-foreground">New Post</h3>
        <Button variant="ghost" size="icon" onClick={onClose}><X className="w-4 h-4" /></Button>
      </div>
      <Input placeholder="Title" value={title} onChange={e => setTitle(e.target.value)} maxLength={120} />
      <Textarea placeholder="Share your strategy, question, or insight..." value={body} onChange={e => setBody(e.target.value)} rows={5} maxLength={2000} />
      <div className="flex items-center gap-3">
        <Select value={tag} onValueChange={setTag}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(TAG_LABELS).map(([key, val]) => (
              <SelectItem key={key} value={key}>{val.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground ml-auto">{body.length}/2000</span>
        <Button onClick={handleSubmit} disabled={submitting || !title.trim() || !body.trim()} size="sm">
          {submitting ? 'Posting...' : 'Post'}
        </Button>
      </div>
    </div>
  );
}
