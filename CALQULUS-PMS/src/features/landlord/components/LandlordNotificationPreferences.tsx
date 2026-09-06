import React, { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/features/auth/AuthContext';
import { useToast } from '@/shared/hooks/use-toast';
import { Button } from '@/shared/components/ui/button';
import { Switch } from '@/shared/components/ui/switch';
import { Label } from '@/shared/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Separator } from '@/shared/components/ui/separator';
import { Save, Loader2, Bell, Mail, Smartphone, MessageSquare } from 'lucide-react';
import { errorToast } from "@/shared/lib/errorToast";

const EVENTS = [
  { key: 'payout_approved',       label: 'Payout request approved',    desc: 'When your manager approves a payout request' },
  { key: 'payout_paid',           label: 'Payout transferred',          desc: 'When the manager marks payment as sent' },
  { key: 'monthly_statement',     label: 'Monthly statement ready',     desc: 'Monthly revenue/occupancy report' },
  { key: 'new_tenant_moved_in',   label: 'New tenant moved in',         desc: 'When a tenant occupies one of your units' },
  { key: 'tenant_moved_out',      label: 'Tenant moved out',            desc: 'When a tenant vacates a unit' },
  { key: 'maintenance_completed', label: 'Maintenance completed',       desc: 'When a repair or maintenance job is finished' },
  { key: 'vacancy_alert',         label: 'Vacancy alert',               desc: 'When a unit has been vacant for more than 14 days' },
  { key: 'arrears_alert',         label: 'Arrears alert',               desc: 'When a tenant in your property is in arrears' },
];

const CHANNELS = [
  { key: 'email_enabled',     label: 'Email',    icon: Mail,           desc: 'Receive notifications by email' },
  { key: 'sms_enabled',       label: 'SMS',      icon: Smartphone,     desc: 'Receive SMS on your registered number' },
  { key: 'whatsapp_enabled',  label: 'WhatsApp', icon: MessageSquare,  desc: 'Receive WhatsApp messages' },
];

const defaultPrefs = {
  email_enabled: true, sms_enabled: true, whatsapp_enabled: false,
  payout_approved: true, payout_paid: true, monthly_statement: true,
  new_tenant_moved_in: true, tenant_moved_out: true,
  maintenance_completed: true, vacancy_alert: true, arrears_alert: true,
};

const LandlordNotificationPreferences: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [prefs, setPrefs] = useState(defaultPrefs);

  const { data: existing, isLoading } = useQuery({
    queryKey: ['landlord-notif-prefs', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('landlord_notification_preferences')
        .select('*')
        .eq('landlord_user_id', user!.id)
        .maybeSingle();
      return data as Record<string, unknown>;
    },
    enabled: !!user?.id,
  });

  useEffect(() => {
    if (existing) {
      setPrefs(p => ({ ...p, ...Object.fromEntries(Object.keys(defaultPrefs).map(k => [k, existing[k] ?? (defaultPrefs as Record<string, unknown>)[k]])) }));
    }
  }, [existing]);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('save_landlord_notification_preferences_atomic', { p_preferences: prefs });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['landlord-notif-prefs'] });
      toast({ title: 'Notification preferences saved' });
    },
    onError: (err: Error) => errorToast('Failed', err),
  });

  const toggle = (key: string) => setPrefs(p => ({ ...p, [key]: !(p as Record<string, unknown>)[key] }));

  if (isLoading) return <div className="h-32 animate-pulse bg-muted rounded-lg" />;

  return (
    <div className="space-y-6">
      {/* Channels */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Notification channels
          </CardTitle>
          <CardDescription>Choose how you want to receive alerts</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {CHANNELS.map(ch => (
            <div key={ch.key} className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <ch.icon className="h-4 w-4 text-muted-foreground" />
                <div>
                  <Label className="text-sm">{ch.label}</Label>
                  <p className="text-xs text-muted-foreground">{ch.desc}</p>
                </div>
              </div>
              <Switch checked={(prefs as Record<string, unknown>)[ch.key] as boolean} onCheckedChange={() => toggle(ch.key)} />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Events */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Events to notify</CardTitle>
          <CardDescription>Choose which events trigger notifications</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {EVENTS.map((ev, i) => (
            <React.Fragment key={ev.key}>
              {i > 0 && <Separator />}
              <div className="flex items-center justify-between py-1">
                <div>
                  <Label className="text-sm">{ev.label}</Label>
                  <p className="text-xs text-muted-foreground">{ev.desc}</p>
                </div>
                <Switch checked={(prefs as Record<string, unknown>)[ev.key] as boolean} onCheckedChange={() => toggle(ev.key)} />
              </div>
            </React.Fragment>
          ))}
        </CardContent>
      </Card>

      <Button className="w-full gap-2" onClick={() => save.mutate()} disabled={save.isPending}>
        {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        Save preferences
      </Button>
    </div>
  );
};

export default LandlordNotificationPreferences;
