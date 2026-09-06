import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/features/auth/AuthContext';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover';
import { ScrollArea } from '@/shared/components/ui/scroll-area';
import {
  Bell,
  BellRing,
  CheckCheck,
  Megaphone,
  CreditCard,
  Wrench,
  FileSignature,
  AlertTriangle,
  Info,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { onActivateKey } from '@/shared/lib/a11y';

interface TenantNotification {
  id: string;
  is_read: boolean;
  type: string;
  title: string;
  body: string;
  created_at: string;
  action_url?: string;
  action_label?: string;
  is_dismissed: boolean;
}

const TYPE_CONFIG: Record<string, { icon: React.ComponentType<{ className?: string }>; color: string; bg: string }> = {
  payment: { icon: CreditCard, color: 'text-success', bg: 'bg-success/20' },
  maintenance: { icon: Wrench, color: 'text-warning', bg: 'bg-warning/20' },
  notice: { icon: AlertTriangle, color: 'text-orange-600', bg: 'bg-orange-50' },
  broadcast: { icon: Megaphone, color: 'text-primary', bg: 'bg-primary/10' },
  announcement: { icon: Megaphone, color: 'text-primary', bg: 'bg-primary/10' },
  contract: { icon: FileSignature, color: 'text-[hsl(218_58%_38%)]', bg: 'bg-[hsl(218_58%_38%/0.08)]' },
  reminder: { icon: BellRing, color: 'text-destructive', bg: 'bg-destructive/20' },
  alert: { icon: AlertTriangle, color: 'text-destructive', bg: 'bg-destructive/20' },
  info: { icon: Info, color: 'text-muted-foreground', bg: 'bg-muted/20' },
};

const TenantNotificationBell: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: notifications = [] } = useQuery({
    queryKey: ['tenant-notifications', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('in_app_notifications')
        .select('*')
        .eq('user_id', user!.id)
        .eq('is_dismissed', false)
        .order('created_at', { ascending: false })
        .limit(30);
      if (error) throw error;
      return (data || []) as TenantNotification[];
    },
    enabled: !!user?.id,
    refetchInterval: 30_000,
  });

  const unread = notifications.filter((n) => !n.is_read).length;

  // Real-time subscription
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`notifications-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'in_app_notifications',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['tenant-notifications', user.id] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient]);

  const markRead = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('update_tenant_notification_atomic', { p_notification_id: id, p_action: 'read' });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tenant-notifications', user?.id] }),
  });

  const markAllRead = useMutation({
    mutationFn: async () => {
      const unreadIds = notifications.filter((n) => !n.is_read).map((n) => n.id);
      if (unreadIds.length === 0) return;
      const { error } = await supabase.rpc('mark_all_tenant_notifications_read_atomic');
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tenant-notifications', user?.id] }),
  });

  const dismiss = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('update_tenant_notification_atomic', { p_notification_id: id, p_action: 'dismiss' });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tenant-notifications', user?.id] }),
  });

  const handleClick = (n: TenantNotification) => {
    if (!n.is_read) markRead.mutate(n.id);
    if (n.action_url) navigate(n.action_url);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative min-h-11 min-w-11"
          aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
        >
          {unread > 0 ? <BellRing className="h-5 w-5" /> : <Bell className="h-5 w-5" />}
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-5 min-w-5 rounded-full bg-destructive text-white text-xs font-bold flex items-center justify-center px-1">
              {unread > 99 ? '99+' : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="font-semibold text-sm">Notifications</h3>
          <div className="flex items-center gap-2">
            {unread > 0 && (
              <Button variant="ghost" size="sm" className="h-6 text-xs gap-1" onClick={() => markAllRead.mutate()}>
                <CheckCheck className="h-3 w-3" />
                Mark all read
              </Button>
            )}
          </div>
        </div>
        <ScrollArea className="max-h-[400px]">
          {notifications.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground">
              <Bell className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No notifications</p>
            </div>
          ) : (
            notifications.map((n) => {
              const config = TYPE_CONFIG[n.type] ?? TYPE_CONFIG.info;
              const Icon = config.icon;
              return (
                <div
                  key={n.id}
                  className={`flex items-start gap-3 px-4 py-3 border-b border-border/50 cursor-pointer hover:bg-muted/50 transition-colors ${!n.is_read ? 'bg-primary/10' : ''}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleClick(n)}
                  onKeyDown={onActivateKey(() => handleClick(n))}
                >
                  <div className={`h-8 w-8 rounded-full ${config.bg} flex items-center justify-center shrink-0 mt-0.5`}>
                    <Icon className={`h-4 w-4 ${config.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={`text-sm leading-tight ${!n.is_read ? 'font-semibold' : 'font-medium'}`}>
                        {n.title}
                      </p>
                      {!n.is_read && <span className="h-2 w-2 rounded-full bg-primary shrink-0 mt-1" />}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.body}</p>
                    <div className="flex items-center justify-between mt-1.5">
                      <span className="text-xs text-muted-foreground/70">
                        {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                      </span>
                      {n.action_label && <span className="text-xs text-warning font-medium">{n.action_label} →</span>}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
};

export default TenantNotificationBell;
