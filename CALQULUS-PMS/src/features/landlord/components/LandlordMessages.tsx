import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/features/auth/AuthContext';
import { useToast } from '@/shared/hooks/use-toast';
import { Button } from '@/shared/components/ui/button';
import { Textarea } from '@/shared/components/ui/textarea';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Badge } from '@/shared/components/ui/badge';
import { Avatar, AvatarFallback } from '@/shared/components/ui/avatar';
import { Card } from '@/shared/components/ui/card';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { Send, Plus, MessageSquare, Loader2 } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { onActivateKey } from "@/shared/lib/a11y";
import { errorToast } from "@/shared/lib/errorToast";

interface Props {
  properties: Array<{ id: string; name: string; manager_name: string | null; manager_id?: string | null }>;
}

interface LandlordMessage {
  id: string;
  parent_id: string | null;
  sender_id: string;
  recipient_id: string;
  subject: string | null;
  body: string;
  created_at: string;
  is_read: boolean;
  read_at: string | null;
  property_id: string | null;
}

const LandlordMessages: React.FC<Props> = ({ properties }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [composeOpen, setComposeOpen] = useState(false);
  const [selectedThread, setSelectedThread] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [form, setForm] = useState({ property_id: '', subject: '', body: '' });
  const bottomRef = useRef<HTMLDivElement>(null);

  // All messages (sent + received)
  const { data: messages = [], isLoading } = useQuery({
    queryKey: ['landlord-messages', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('landlord_messages')
        .select('*')
        .or(`sender_id.eq.${user!.id},recipient_id.eq.${user!.id}`)
        .order('created_at', { ascending: false });
      return (data || []) as unknown[];
    },
    enabled: !!user?.id,
    refetchInterval: 30_000,
  });

  // Group into threads by parent_id / root message
  const threads = (messages as LandlordMessage[]).filter((m) => !m.parent_id);
  const threadMessages = useCallback((threadId: string) =>
    (messages as LandlordMessage[]).filter((m) => m.id === threadId || m.parent_id === threadId)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()),
  [messages]);

  useEffect(() => {
    if (selectedThread) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selectedThread, messages.length]);

  // Mark messages read when thread opened
  useEffect(() => {
    if (!selectedThread) return;
    const unread = threadMessages(selectedThread).filter((m) => m.recipient_id === user?.id && !m.is_read);
    if (unread.length > 0) {
      supabase.rpc('mark_landlord_messages_read_atomic', { p_message_ids: unread.map((m) => m.id) })
        .then(() => queryClient.invalidateQueries({ queryKey: ['landlord-messages'] }));
    }
  }, [selectedThread, threadMessages, user?.id, queryClient]);

  // Managers from linked properties
  const managers = Array.from(new Map(
    properties.filter(p => p.manager_id).map(p => [p.manager_id, { id: p.manager_id, name: p.manager_name }])
  ).values());

  const send = useMutation({
    mutationFn: async ({ isNew, parentId }: { isNew: boolean; parentId?: string }) => {
      const prop = properties.find(p => p.id === form.property_id);
      const managerId = prop?.manager_id ?? managers[0]?.id;
      if (!managerId) throw new Error('No manager found for this property');

      const { error } = await supabase.rpc('send_landlord_message_atomic', {
        p_property_id: form.property_id, p_recipient_id: managerId,
        p_body: isNew ? form.body : replyText,
        p_subject: isNew ? (form.subject || 'Message from landlord') : null,
        p_parent_id: parentId ?? null,
      });
      if (error) throw error;
    },
    onSuccess: (_, { isNew }) => {
      queryClient.invalidateQueries({ queryKey: ['landlord-messages'] });
      if (isNew) {
        setComposeOpen(false);
        setForm({ property_id: '', subject: '', body: '' });
        toast({ title: 'Message sent' });
      } else {
        setReplyText('');
      }
    },
    onError: (err: Error) => errorToast('Failed', err),
  });

  const unreadCount = (messages as LandlordMessage[]).filter((m) => m.recipient_id === user?.id && !m.is_read).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="font-medium">Messages with your manager{managers.length > 1 ? 's' : ''}</h3>
          {unreadCount > 0 && (
            <Badge className="bg-red-100 text-red-800 border-red-200">{unreadCount} unread</Badge>
          )}
        </div>
        <Button size="sm" onClick={() => setComposeOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />New message
        </Button>
      </div>

      <div className="grid md:grid-cols-3 gap-4 h-[500px]">
        {/* Thread list */}
        <div className="border border-border rounded-xl overflow-y-auto">
          {isLoading ? (
            <div className="p-3 space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
          ) : threads.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-4 text-center">
              <MessageSquare className="h-8 w-8 mb-2 opacity-30" />
              <p className="text-sm">No messages yet</p>
            </div>
          ) : (threads as LandlordMessage[]).map((thread) => {
            const unread = threadMessages(thread.id).some((m) => m.recipient_id === user?.id && !m.is_read);
            const prop = properties.find(p => p.id === thread.property_id);
            return (
              <div
                key={thread.id}
                role="button"
                tabIndex={0}
                className={`p-3 border-b border-border cursor-pointer hover:bg-muted/40 transition-colors ${selectedThread === thread.id ? 'bg-amber-400/6 border-l-2 border-l-primary' : ''}`}
                onClick={() => setSelectedThread(thread.id)}
                onKeyDown={onActivateKey(() => setSelectedThread(thread.id))}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className={`text-sm truncate ${unread ? 'font-semibold' : 'font-medium'}`}>
                      {thread.subject || 'No subject'}
                    </p>
                    {prop && <p className="text-xs text-muted-foreground">{prop.name}</p>}
                    <p className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(thread.created_at), { addSuffix: true })}</p>
                  </div>
                  {unread && <span className="h-2 w-2 rounded-full bg-[hsl(214_73%_48%)] shrink-0 mt-1" />}
                </div>
              </div>
            );
          })}
        </div>

        {/* Message view */}
        <div className="md:col-span-2 border border-border rounded-xl flex flex-col overflow-hidden">
          {!selectedThread ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <MessageSquare className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Select a conversation</p>
              </div>
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {threadMessages(selectedThread).map((msg) => {
                  const isMe = msg.sender_id === user?.id;
                  return (
                    <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} gap-2`}>
                      {!isMe && (
                        <Avatar className="h-7 w-7 shrink-0 mt-1">
                          <AvatarFallback className="text-xs bg-amber-400/10">M</AvatarFallback>
                        </Avatar>
                      )}
                      <div className={`max-w-xs rounded-2xl px-3 py-2 text-sm ${isMe ? 'bg-amber-400 text-slate-900' : 'bg-muted'}`}>
                        {msg.subject && <p className="font-semibold text-xs mb-1 opacity-70">{msg.subject}</p>}
                        <p className="whitespace-pre-wrap">{msg.body}</p>
                        <p className="text-xs opacity-60 mt-1 text-right">{format(new Date(msg.created_at), 'dd MMM HH:mm')}</p>
                      </div>
                    </div>
                  );
                })}
                <div ref={bottomRef} />
              </div>
              <div className="border-t border-border p-3 flex gap-2">
                <Textarea
                  value={replyText}
                  onChange={e => setReplyText(e.target.value)}
                  placeholder="Type a reply…"
                  rows={2}
                  className="resize-none flex-1"
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      if (replyText.trim()) send.mutate({ isNew: false, parentId: selectedThread });
                    }
                  }}
                />
                <Button
                  size="icon"
                  aria-label="Send message"
                  className="self-end h-9 w-9"
                  disabled={!replyText.trim() || send.isPending}
                  onClick={() => send.mutate({ isNew: false, parentId: selectedThread })}
                >
                  {send.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Compose dialog */}
      <Dialog open={composeOpen} onOpenChange={setComposeOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>New message to manager</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            {properties.length > 1 && (
              <div>
                <Label className="text-xs">Property</Label>
                <Select value={form.property_id} onValueChange={v => setForm(p => ({ ...p, property_id: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select property" /></SelectTrigger>
                  <SelectContent>{properties.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label className="text-xs">Subject</Label>
              <Input value={form.subject} onChange={e => setForm(p => ({ ...p, subject: e.target.value }))} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Message</Label>
              <Textarea value={form.body} onChange={e => setForm(p => ({ ...p, body: e.target.value }))} rows={5} className="mt-1 resize-none" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setComposeOpen(false)}>Cancel</Button>
            <Button
              onClick={() => send.mutate({ isNew: true })}
              disabled={!form.body.trim() || send.isPending}
              className="gap-2"
            >
              {send.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LandlordMessages;
