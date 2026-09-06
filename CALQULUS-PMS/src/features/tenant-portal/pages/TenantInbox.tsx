import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/features/auth/AuthContext';
import { useToast } from '@/shared/hooks/use-toast';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import { Card, CardContent } from '@/shared/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { Textarea } from '@/shared/components/ui/textarea';
import { Label } from '@/shared/components/ui/label';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { EmptyState } from '@/shared/components/ui/empty-state';
import { ErrorState } from '@/shared/components/ui/error-state';
import {
  MessageSquare,
  Bell,
  AlertTriangle,
  CheckCircle,
  Clock,
  Megaphone,
  TrendingUp,
  Home,
  Wrench,
  FileText,
  ChevronRight,
  Loader2,
  ThumbsUp,
  MessageCircle,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import TenantLayout from '@/features/tenant-portal/components/TenantLayout';
import { onActivateKey } from '@/shared/lib/a11y';
import { unwrapList } from '@/shared/lib/queryErrors';
import VirtualizedList from '@/shared/components/VirtualizedList';

interface NoticeIconConfig {
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bg: string;
  label: string;
}

const NOTICE_ICONS: Record<string, NoticeIconConfig> = {
  rent_increase: { icon: TrendingUp, color: 'text-warning', bg: 'bg-warning/20', label: 'Rent increase' },
  arrears_demand: { icon: AlertTriangle, color: 'text-destructive', bg: 'bg-destructive/20', label: 'Arrears demand' },
  eviction_warning: { icon: Home, color: 'text-destructive', bg: 'bg-destructive/20', label: 'Eviction warning' },
  entry_notice: { icon: Home, color: 'text-primary', bg: 'bg-primary/10', label: 'Entry notice' },
  lease_renewal: { icon: FileText, color: 'text-success', bg: 'bg-success/20', label: 'Lease renewal' },
  rule_violation: { icon: AlertTriangle, color: 'text-warning', bg: 'bg-warning/10', label: 'Rule violation' },
  general: { icon: MessageSquare, color: 'text-muted-foreground', bg: 'bg-muted/20', label: 'Notice' },
  announcement: { icon: Megaphone, color: 'text-primary', bg: 'bg-primary/10', label: 'Announcement' },
  payment_reminder: { icon: Bell, color: 'text-warning', bg: 'bg-warning/20', label: 'Payment reminder' },
  maintenance_update: {
    icon: Wrench,
    color: 'text-primary',
    bg: 'bg-primary/10',
    label: 'Maintenance update',
  },
};

const TenantInbox: React.FC = () => {
  const { user, userRole } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  interface TenantNotice {
    id: string;
    notice_type: string;
    title: string;
    body: string;
    status: string;
    created_at: string;
    tenant_acknowledged: boolean | null;
    tenant_ack_at: string | null;
    delivery_method: string | null;
    new_rent: number | null;
    current_rent: number | null;
    effective_date: string | null;
  }

  interface TenantMessage {
    id: string;
    is_read: boolean | null;
    subject: string | null;
    body: string;
    message_type: string;
    created_at: string;
    sent_via_sms: boolean | null;
    sent_via_email: boolean | null;
    sent_via_whatsapp: boolean | null;
  }

  const [selectedNotice, setSelectedNotice] = useState<TenantNotice | null>(null);
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [disputeText, setDisputeText] = useState('');

  const tenantId = userRole?.tenant_id;

  // Formal notices from manager
  const { data: notices = [], isLoading: noticesLoading, isError: noticesError, error: noticesQueryError, refetch: refetchNotices } = useQuery({
    queryKey: ['tenant-notices-inbox', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from('tenant_notices')
        .select('*')
        .eq('tenant_id', tenantId)
        .neq('status', 'draft')
        .order('created_at', { ascending: false });
      return unwrapList({ data, error }, 'tenant notices') as TenantNotice[];
    },
    enabled: !!tenantId,
  });

  // Messages from manager
  const { data: messages = [], isLoading: messagesLoading } = useQuery({
    queryKey: ['tenant-messages-inbox', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(50);
      return unwrapList({ data, error }, 'tenant messages') as TenantMessage[];
    },
    enabled: !!tenantId,
  });

  const unreadNotices = notices.filter((n) => !n.tenant_acknowledged).length;
  const unreadMessages = messages.filter((m) => !m.is_read).length;

  // Acknowledge a notice
  const acknowledgeNotice = useMutation({
    mutationFn: async (noticeId: string) => {
      const { error } = await supabase.rpc('acknowledge_tenant_notice_atomic', { p_notice_id: noticeId });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-notices-inbox'] });
      toast({ title: 'Notice acknowledged' });
    },
  });

  // Dispute a notice
  const disputeNotice = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const { error } = await supabase.rpc('acknowledge_tenant_notice_atomic', { p_notice_id: id, p_response: reason });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-notices-inbox'] });
      toast({ title: 'Dispute submitted', description: 'Your manager has been notified of your dispute.' });
      setDisputeOpen(false);
      setDisputeText('');
      setSelectedNotice(null);
    },
  });

  // Mark message as read
  const markRead = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('mark_tenant_message_read_atomic', { p_message_id: id });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tenant-messages-inbox'] }),
  });

  const NoticeCard = ({ notice }: { notice: TenantNotice }) => {
    const config = NOTICE_ICONS[notice.notice_type] ?? NOTICE_ICONS.general;
    const Icon = config.icon;
    const isUrgent = ['rent_increase', 'eviction_warning', 'arrears_demand'].includes(notice.notice_type);

    return (
      <Card
        role="button"
        tabIndex={0}
        aria-label={`${config.label}: ${notice.title}`}
        className={`cursor-pointer hover:shadow-sm transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${!notice.tenant_acknowledged ? 'border-warning/40 bg-warning/10' : ''}`}
        onClick={() => setSelectedNotice(notice)}
        onKeyDown={onActivateKey(() => setSelectedNotice(notice))}
      >
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${config.bg}`}>
              <Icon className={`h-4 w-4 ${config.color}`} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <Badge variant="outline" className="text-xs">
                  {config.label}
                </Badge>
                {!notice.tenant_acknowledged && (
                  <Badge className="text-xs bg-primary/20 text-primary border-primary/30">New</Badge>
                )}
                {notice.status === 'disputed' && (
                  <Badge className="text-xs" variant="warning">Disputed</Badge>
                )}
                {isUrgent && (
                  <Badge className="text-xs bg-destructive/20 text-destructive border-destructive/30">
                    Action required
                  </Badge>
                )}
              </div>
              <p className="text-sm font-medium truncate">{notice.title}</p>
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{notice.body}</p>
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(notice.created_at), { addSuffix: true })}
                </span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  const MessageCard = ({ msg }: { msg: TenantMessage }) => {
    const config = NOTICE_ICONS[msg.message_type] ?? NOTICE_ICONS.general;
    const Icon = config.icon;
    return (
      <Card
        role="button"
        tabIndex={0}
        aria-label={`${msg.subject || 'Message'}${!msg.is_read ? ', unread' : ''}`}
        className={`cursor-pointer hover:shadow-sm transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${!msg.is_read ? 'border-warning/40 bg-warning/10' : ''}`}
        onClick={() => markRead.mutate(msg.id)}
        onKeyDown={onActivateKey(() => markRead.mutate(msg.id))}
      >
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${config.bg}`}>
              <Icon className={`h-4 w-4 ${config.color}`} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                {!msg.is_read && <Badge className="text-xs bg-primary/20 text-primary border-primary/30">New</Badge>}
                {msg.message_type && (
                  <Badge variant="outline" className="text-xs capitalize">
                    {msg.message_type.replace(/_/g, ' ')}
                  </Badge>
                )}
              </div>
              {msg.subject && <p className="text-sm font-medium truncate">{msg.subject}</p>}
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{msg.body}</p>
              <p className="text-xs text-muted-foreground mt-2">
                {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })}
                {msg.sent_via_sms && ' · SMS'}
                {msg.sent_via_email && ' · Email'}
                {msg.sent_via_whatsapp && ' · WhatsApp'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <TenantLayout title="Inbox" description="Notices from your manager.">
    <div className="space-y-4">
      <Tabs defaultValue="notices">
        <TabsList>
          <TabsTrigger value="notices" className="gap-2">
            <Bell className="h-4 w-4" />
            Notices
            {unreadNotices > 0 && (
              <Badge className="ml-1 bg-destructive/20 text-destructive border-destructive/30 text-xs h-5">
                {unreadNotices}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="messages" className="gap-2">
            <MessageSquare className="h-4 w-4" />
            Messages
            {unreadMessages > 0 && (
              <Badge className="ml-1 bg-destructive/20 text-destructive border-destructive/30 text-xs h-5">
                {unreadMessages}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ── Formal notices ── */}
        <TabsContent value="notices" className="mt-4 space-y-3">
          {noticesLoading ? (
            Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)
          ) : noticesError ? (
            <ErrorState
              title="Could not load notices"
              message={noticesQueryError instanceof Error ? noticesQueryError.message : "Try again."}
              onRetry={() => refetchNotices()}
            />
          ) : notices.length === 0 ? (
            <EmptyState icon={Bell} title="No notices from your manager yet" />
          ) : (
            <VirtualizedList
              items={notices}
              getItemKey={(n) => n.id}
              estimatedItemHeight={104}
              className="max-h-[70vh]"
              emptyMessage="No notices from your manager yet"
              renderItem={(n) => <NoticeCard key={n.id} notice={n} />}
            />
          )}
        </TabsContent>

        {/* ── Broadcast messages ── */}
        <TabsContent value="messages" className="mt-4 space-y-3">
          {messagesLoading ? (
            Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)
          ) : messages.length === 0 ? (
            <EmptyState icon={MessageSquare} title="No messages from your manager yet" />
          ) : (
            messages.map((m) => <MessageCard key={m.id} msg={m} />)
          )}
        </TabsContent>
      </Tabs>

      {/* Notice detail dialog */}
      <Dialog open={!!selectedNotice} onOpenChange={(open) => !open && setSelectedNotice(null)}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          {selectedNotice &&
            (() => {
              const config = NOTICE_ICONS[selectedNotice.notice_type] ?? NOTICE_ICONS.general;
              const Icon = config.icon;
              return (
                <>
                  <DialogHeader>
                    <div className="flex items-center gap-2 mb-1">
                      <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${config.bg}`}>
                        <Icon className={`h-4 w-4 ${config.color}`} />
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {config.label}
                      </Badge>
                    </div>
                    <DialogTitle>{selectedNotice.title}</DialogTitle>
                    <DialogDescription>
                      Received {format(new Date(selectedNotice.created_at), 'dd/MM/yy')}
                      {selectedNotice.delivery_method && ` via ${selectedNotice.delivery_method}`}
                    </DialogDescription>
                  </DialogHeader>
                  <pre className="whitespace-pre-wrap text-sm font-sans leading-relaxed p-4 bg-muted/30 rounded-lg border border-border">
                    {selectedNotice.body}
                  </pre>

                  {/* Rent increase details */}
                  {selectedNotice.notice_type === 'rent_increase' && selectedNotice.new_rent && (
                    <div className="grid grid-cols-2 gap-3 p-3 bg-warning/20 border border-warning/30 rounded-lg">
                      <div>
                        <p className="text-xs text-warning">Current rent</p>
                        <p className="font-semibold text-warning">
                          KES {Number(selectedNotice.current_rent || 0).toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-warning">New rent</p>
                        <p className="font-semibold text-warning">
                          KES {Number(selectedNotice.new_rent).toLocaleString()}
                        </p>
                      </div>
                      {selectedNotice.effective_date && (
                        <div className="col-span-2">
                          <p className="text-xs text-warning">Effective from</p>
                          <p className="font-medium text-warning">
                            {format(new Date(selectedNotice.effective_date), 'dd/MM/yy')}
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row gap-2">
                    {!selectedNotice.tenant_acknowledged && (
                      <Button
                        className="gap-2 flex-1 bg-success hover:bg-success text-white"
                        onClick={() => {
                          acknowledgeNotice.mutate(selectedNotice.id);
                          setSelectedNotice(null);
                        }}
                        disabled={acknowledgeNotice.isPending}
                      >
                        <ThumbsUp className="h-4 w-4" />
                        Acknowledge receipt
                      </Button>
                    )}
                    {selectedNotice.tenant_acknowledged && (
                      <div className="flex items-center gap-2 text-sm text-success flex-1">
                        <CheckCircle className="h-4 w-4" />
                        Acknowledged{' '}
                        {selectedNotice.tenant_ack_at ? format(new Date(selectedNotice.tenant_ack_at), 'dd/MM/yy') : ''}
                      </div>
                    )}
                    {!selectedNotice.tenant_acknowledged && (
                      <Button
                        variant="outline"
                        className="gap-2"
                        onClick={() => setDisputeOpen(true)}
                      >
                        <MessageCircle className="h-4 w-4" />
                        Dispute
                      </Button>
                    )}
                  </div>
                </>
              );
            })()}
        </DialogContent>
      </Dialog>

      {/* Dispute dialog */}
      <Dialog open={disputeOpen} onOpenChange={setDisputeOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Dispute this notice</DialogTitle>
            <DialogDescription>
              Explain your grounds for disputing this notice. Your manager will be notified.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Label>Your reason for disputing</Label>
            <Textarea
              value={disputeText}
              onChange={(e) => setDisputeText(e.target.value)}
              rows={4}
              placeholder="Explain clearly why you are disputing this notice..."
              className="mt-1 resize-none"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDisputeOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="gap-2"
              onClick={() => selectedNotice && disputeNotice.mutate({ id: selectedNotice.id, reason: disputeText })}
              disabled={!disputeText.trim() || disputeNotice.isPending}
            >
              {disputeNotice.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Submit dispute
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </TenantLayout>
  );
};

// Mobile nav injected
export default TenantInbox;
