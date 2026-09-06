// @ts-nocheck — Phase 12: remaining local types until live supabase gen types
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/features/auth/AuthContext';
import { useToast } from '@/shared/hooks/use-toast';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Badge } from '@/shared/components/ui/badge';
import { Textarea } from '@/shared/components/ui/textarea';
import { Switch } from '@/shared/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { logError } from '@/shared/lib/errorLogger';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/components/ui/table';
import { Avatar, AvatarFallback } from '@/shared/components/ui/avatar';
import {
  Send, Smartphone, Mail, MessageSquare,
  Bell, Megaphone, AlertTriangle,
  Search, Loader2, BarChart3, RefreshCw
} from 'lucide-react';
import { format } from 'date-fns';
import { onActivateKey } from "@/shared/lib/a11y";
import { errorToast } from "@/shared/lib/errorToast";

// ── Message type presets ────────────────────────────────────────────
const MESSAGE_TYPES = [
  { value: 'announcement',   label: 'Announcement',       icon: Megaphone  },
  { value: 'payment_reminder', label: 'Payment reminder', icon: Bell       },
  { value: 'maintenance_update', label: 'Maintenance update', icon: AlertTriangle },
  { value: 'rent_increase',  label: 'Rent increase notice', icon: AlertTriangle },
  { value: 'general',        label: 'General message',    icon: MessageSquare },
  { value: 'emergency',      label: 'Emergency notice',   icon: AlertTriangle },
];

const AUDIENCE_TYPES = [
  { value: 'all_tenants',    label: 'All active tenants' },
  { value: 'property_tenants', label: 'Tenants in a property' },
  { value: 'overdue_tenants', label: 'Tenants with overdue invoices' },
  { value: 'arrears_tenants', label: 'Tenants in arrears' },
  { value: 'one_tenant',     label: 'Specific tenant' },
];

const QUICK_TEMPLATES: Record<string, string> = {
  payment_reminder: `Dear [Tenant Name],\n\nThis is a friendly reminder that your rent payment for [Month] is due on [Due Date].\n\nAmount due: KES [Amount]\n\nPlease ensure timely payment to avoid late charges. You can pay via M-Pesa Paybill [Number] using your account number [Unit Number].\n\nThank you for your cooperation.\n\n[Manager Name]`,
  maintenance_update: `Dear [Tenant Name],\n\nWe wish to inform you that maintenance work is scheduled for [Date] at [Property Name].\n\nWork to be done: [Description]\n\nThis may cause temporary inconvenience. We apologise for any disruption and appreciate your patience.\n\n[Manager Name]`,
  announcement: `Dear Residents,\n\nWe would like to bring to your attention the following:\n\n[Your announcement here]\n\nPlease do not hesitate to contact us if you have any questions.\n\nThank you.\n\n[Manager Name]`,
  emergency: `URGENT NOTICE\n\nDear Tenants,\n\n[Emergency details here]\n\nPlease take immediate action as directed. Contact [Phone Number] for assistance.\n\n[Manager Name]`,
  rent_increase: `Dear [Tenant Name],\n\nPlease be advised that effective [Effective Date], your monthly rent will increase from KES [Current Amount] to KES [New Amount].\n\nThis represents a [Percentage]% increase based on the approved rent adjustment and applicable property costs.\n\nYour new lease reflecting this change will be sent to you shortly.\n\nKindly confirm receipt of this notice.\n\n[Manager Name]`,
};

interface Property { id: string; name: string; }
interface Tenant { id: string; name: string; email: string; phone: string | null; unit: string | null; property: string | null; property_id: string | null; }

const BroadcastCenter: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Compose state
  const [audienceType, setAudienceType] = useState('all_tenants');
  const [selectedPropertyId, setSelectedPropertyId] = useState('');
  const [selectedTenantId, setSelectedTenantId] = useState('');
  const [messageType, setMessageType] = useState('announcement');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sendSms, setSendSms] = useState(true);
  const [sendEmail, setSendEmail] = useState(true);
  const [sendWhatsapp, setSendWhatsapp] = useState(false);
  const [sendPush, setSendPush] = useState(true);
  const [sendApp, setSendApp] = useState(true);
  const [tenantSearch, setTenantSearch] = useState('');

  // Data
  const { data: properties = [] } = useQuery({
    queryKey: ['manager-properties', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('properties').select('id, name').eq('manager_id', user!.id).order('name');
      return (data || []) as Property[];
    },
    enabled: !!user?.id,
  });

  const { data: tenants = [] } = useQuery({
    queryKey: ['broadcast-tenants', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('tenants').select('id, name, email, phone, unit, property, property_id').eq('manager_id', user!.id).eq('status', 'active').order('name');
      return (data || []) as Tenant[];
    },
    enabled: !!user?.id,
  });

  const { data: campaigns = [], isLoading: campaignsLoading, refetch: refetchCampaigns } = useQuery({
    queryKey: ['broadcast-campaigns', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('broadcast_campaigns').select('*').eq('manager_id', user!.id).order('created_at', { ascending: false }).limit(20);
      return (data || []) as unknown[];
    },
    enabled: !!user?.id,
  });

  // Compute audience preview
  const audienceTenants = React.useMemo(() => {
    let result = tenants;
    if (audienceType === 'property_tenants' && selectedPropertyId) {
      result = tenants.filter(t => t.property_id === selectedPropertyId);
    } else if (audienceType === 'one_tenant' && selectedTenantId) {
      result = tenants.filter(t => t.id === selectedTenantId);
    }
    if (tenantSearch) {
      const q = tenantSearch.toLowerCase();
      result = result.filter(t => t.name.toLowerCase().includes(q) || (t.unit || '').toLowerCase().includes(q));
    }
    return result;
  }, [tenants, audienceType, selectedPropertyId, selectedTenantId, tenantSearch]);

  const channelCount = [sendSms, sendEmail, sendWhatsapp, sendPush, sendApp].filter(Boolean).length;

  // Send broadcast
  const sendBroadcast = useMutation({
    mutationFn: async () => {
      if (!body.trim()) throw new Error('Message body is required');
      if (!user?.id) throw new Error('You must be signed in to send broadcasts');
      if (audienceType === 'one_tenant' && !selectedTenantId) throw new Error('Select a tenant');
      if (audienceTenants.length === 0) throw new Error('No recipients found for selected audience');

      // Core campaign/message/notification rows are created atomically by the database.
      const { data: campaign, error: campErr } = await supabase.rpc('create_broadcast_campaign_atomic', {
        p_payload: {
          name: subject || `${messageType} — ${format(new Date(), 'dd/MM/yy')}`, subject, body,
          message_type: messageType, audience_type: audienceType,
          audience_filter: selectedPropertyId ? { property_id: selectedPropertyId } : null,
          property_id: selectedPropertyId || null, send_sms: sendSms, send_email: sendEmail,
          send_whatsapp: sendWhatsapp, send_push: sendPush, send_app: sendApp,
        },
        p_tenant_ids: audienceTenants.map(t => t.id),
      });
      if (campErr || !campaign) throw campErr || new Error('Failed to create broadcast campaign');
      const campaignId = (campaign as { id: string }).id;

      let smsSent = 0, emailSent = 0, waSent = 0, pushSent = 0;
      const notify = async (fn: string, payload: Record<string, unknown>) => {
        const { data, error } = await supabase.functions.invoke(fn, { body: payload });
        if (error) throw error;
        if (data?.success === false || data?.skipped === true) throw new Error(data?.error || data?.message || data?.reason || `${fn} did not deliver`);
      };

      const notifyFn = async (tenant: Tenant) => {
        const tenantUserId = (await supabase.from('user_roles').select('user_id').eq('tenant_id', tenant.id).eq('role', 'tenant').maybeSingle()).data?.user_id ?? null;
        const personalised = body.replace(/\[Tenant Name\]/g, tenant.name);
        if (sendPush && tenantUserId) { try { await notify('send-push-notification', { userId: tenantUserId, title: subject || 'New message', body: personalised.slice(0,240), url:'/portal', tag:`broadcast-${campaignId}` }); pushSent++; } catch (error) { logError(`Broadcast push failed [tenant:${tenant.id}]`, error); } }
        if (sendSms && tenant.phone) { try { await notify('send-sms-notification', { phoneNumber: tenant.phone, message: personalised }); smsSent++; } catch (error) { logError(`Broadcast SMS failed [tenant:${tenant.id}]`, error); } }
        if (sendEmail && tenant.email) { try { await notify('send-email-notification', { to: tenant.email, subject: subject || 'New message', body: personalised }); emailSent++; } catch (error) { logError(`Broadcast email failed [tenant:${tenant.id}]`, error); } }
        if (sendWhatsapp && tenant.phone) { try { await notify('send-whatsapp-notification', { phoneNumber: tenant.phone, tenantName: tenant.name, type:'general', message: personalised }); waSent++; } catch (error) { logError(`Broadcast WhatsApp failed [tenant:${tenant.id}]`, error); } }
      };

      // Send to all recipients (chunked to avoid timeout and rate limits)
      const CHUNK_SIZE = 50;
      const chunks: typeof audienceTenants[] = [];
      for (let i = 0; i < audienceTenants.length; i += CHUNK_SIZE) {
        chunks.push(audienceTenants.slice(i, i + CHUNK_SIZE));
      }
      for (const chunk of chunks) {
        await Promise.allSettled(chunk.map(notifyFn));
      }

      // Update campaign stats
      const { error: transitionError } = await supabase.rpc('transition_broadcast_campaign_atomic', { p_campaign_id: campaignId, p_status: 'sent', p_sms_sent: smsSent, p_email_sent: emailSent, p_whatsapp_sent: waSent, p_push_sent: pushSent });
      if (transitionError) throw transitionError;
    },
    onSuccess: () => {
      toast({
        title: 'Broadcast sent',
        description: `Message delivered to ${audienceTenants.length} tenant${audienceTenants.length !== 1 ? 's' : ''} via ${channelCount} channel${channelCount !== 1 ? 's' : ''}`,
      });
      queryClient.invalidateQueries({ queryKey: ['broadcast-campaigns'] });
      refetchCampaigns();
      setBody('');
      setSubject('');
    },
    onError: (err: Error) => errorToast('Failed to send', err),
  });

  return (
    <div className="space-y-6">
      <Tabs defaultValue="compose">
        <TabsList>
          <TabsTrigger value="compose" className="gap-2">
            <Send className="h-4 w-4" />Compose & Send
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <BarChart3 className="h-4 w-4" />Sent campaigns ({campaigns.length})
          </TabsTrigger>
        </TabsList>

        {/* ── Compose ── */}
        <TabsContent value="compose" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* Left: Compose */}
            <div className="lg:col-span-2 space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Compose message</CardTitle>
                  <CardDescription>Send to one tenant or broadcast to all</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Audience */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Send to</Label>
                      <Select value={audienceType} onValueChange={setAudienceType}>
                        <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {AUDIENCE_TYPES.map(a => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    {audienceType === 'property_tenants' && (
                      <div>
                        <Label>Property</Label>
                        <Select value={selectedPropertyId} onValueChange={setSelectedPropertyId}>
                          <SelectTrigger className="mt-1"><SelectValue placeholder="Select property" /></SelectTrigger>
                          <SelectContent>{properties.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                    )}
                    {audienceType === 'one_tenant' && (
                      <div>
                        <Label>Tenant</Label>
                        <Select value={selectedTenantId} onValueChange={setSelectedTenantId}>
                          <SelectTrigger className="mt-1"><SelectValue placeholder="Select tenant" /></SelectTrigger>
                          <SelectContent>
                            {tenants.map(t => (
                              <SelectItem key={t.id} value={t.id}>
                                {t.name} {t.unit ? `(${t.unit})` : ''}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>

                  {/* Message type */}
                  <div>
                    <Label>Message type</Label>
                    <div className="grid grid-cols-3 gap-2 mt-1">
                      {MESSAGE_TYPES.map(mt => (
                        <button key={mt.value} type="button"
                          onClick={() => {
                            setMessageType(mt.value);
                            if (QUICK_TEMPLATES[mt.value] && !body) setBody(QUICK_TEMPLATES[mt.value]);
                          }}
                          className={`flex items-center gap-2 px-2.5 py-2 rounded-lg border text-xs transition-colors text-left ${
                            messageType === mt.value
                              ? 'border-amber-400/50 bg-amber-400/8 text-warning'
                              : 'border-border hover:border-amber-400/30 text-muted-foreground'
                          }`}
                        >
                          <mt.icon className="h-3.5 w-3.5 shrink-0" />
                          <span className="font-medium">{mt.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Subject */}
                  <div>
                    <Label>Subject (for email)</Label>
                    <Input value={subject} onChange={e => setSubject(e.target.value)} placeholder="e.g. Important notice from your property manager" className="mt-1" />
                  </div>

                  {/* Body */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <Label>Message</Label>
                      {QUICK_TEMPLATES[messageType] && (
                        <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setBody(QUICK_TEMPLATES[messageType])}>
                          Load template
                        </Button>
                      )}
                    </div>
                    <Textarea
                      value={body}
                      onChange={e => setBody(e.target.value)}
                      rows={10}
                      placeholder="Type your message here... Use [Tenant Name], [Unit Number], [Amount] as placeholders."
                      className="resize-none font-mono text-sm"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground mt-1">
                      <span>{body.length} characters</span>
                      {sendSms && body.length > 160 && (
                        <span className="text-warning">⚠ SMS will split into {Math.ceil(body.length / 160)} parts</span>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Channels */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Delivery channels</CardTitle>
                  <CardDescription>Select which channels to send through</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                    {[
                      { key: 'sms',       label: 'SMS',      icon: Smartphone,    state: sendSms,      set: setSendSms,      desc: 'Africa\'s Talking' },
                      { key: 'email',     label: 'Email',    icon: Mail,          state: sendEmail,    set: setSendEmail,    desc: 'Resend' },
                      { key: 'whatsapp',  label: 'WhatsApp', icon: MessageSquare, state: sendWhatsapp, set: setSendWhatsapp, desc: 'Twilio/Meta' },
                      { key: 'push',      label: 'Push',     icon: Bell,          state: sendPush,     set: setSendPush,     desc: 'Web push' },
                      { key: 'app',       label: 'In-app',   icon: Bell,          state: sendApp,      set: setSendApp,      desc: 'Notification bell' },
                    ].map(ch => (
                      <div
                        key={ch.key}
                        role="button"
                        tabIndex={0}
                        onClick={() => ch.set(!ch.state)}
                        onKeyDown={onActivateKey(() => ch.set(!ch.state))}
                        className={`rounded-lg border p-3 cursor-pointer transition-colors ${ch.state ? 'border-amber-400/50 bg-amber-400/8' : 'border-border'}`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <ch.icon className={`h-4 w-4 ${ch.state ? 'text-warning' : 'text-muted-foreground'}`} />
                          <Switch checked={ch.state} onCheckedChange={ch.set} className="scale-75" />
                        </div>
                        <p className={`text-xs font-medium ${ch.state ? 'text-warning' : 'text-muted-foreground'}`}>{ch.label}</p>
                        <p className="text-xs text-muted-foreground/70">{ch.desc}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right: Preview & send */}
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Recipients preview</CardTitle>
                  <CardDescription>{audienceTenants.length} tenant{audienceTenants.length !== 1 ? 's' : ''} will receive this message</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {audienceType !== 'one_tenant' && (
                    <div className="relative">
                      <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
                      <Input
                        placeholder="Search tenants..."
                        value={tenantSearch}
                        onChange={e => setTenantSearch(e.target.value)}
                        className="pl-8 h-8 text-xs"
                      />
                    </div>
                  )}
                  <div className="max-h-64 overflow-y-auto space-y-1.5">
                    {audienceTenants.slice(0, 30).map(t => (
                      <div key={t.id} className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-muted/50">
                        <Avatar className="h-6 w-6">
                          <AvatarFallback className="text-xs bg-amber-400/10">
                            {t.name.split(' ').map(n => n[0]).join('')}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="text-xs font-medium truncate">{t.name}</p>
                          <p className="text-xs text-muted-foreground">{t.unit} {t.phone ? `· ${t.phone}` : ''}</p>
                        </div>
                        <div className="ml-auto flex gap-0.5">
                          {sendSms && t.phone && <Smartphone className="h-3 w-3 text-green-600" />}
                          {sendEmail && <Mail className="h-3 w-3 text-[hsl(214_73%_45%)]" />}
                          {sendWhatsapp && t.phone && <MessageSquare className="h-3 w-3 text-green-500" />}
                        </div>
                      </div>
                    ))}
                    {audienceTenants.length > 30 && (
                      <p className="text-xs text-center text-muted-foreground py-1">+{audienceTenants.length - 30} more</p>
                    )}
                    {audienceTenants.length === 0 && (
                      <p className="text-xs text-center text-muted-foreground py-4">No tenants match selected audience</p>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Send summary */}
              <Card>
                <CardContent className="p-4 space-y-3">
                  <div className="text-sm space-y-1.5">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Recipients</span>
                      <span className="font-medium">{audienceTenants.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Channels</span>
                      <span className="font-medium">{channelCount}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total sends</span>
                      <span className="font-medium">{audienceTenants.length * channelCount}</span>
                    </div>
                  </div>
                  <Button
                    className="w-full gap-2"
                    onClick={() => sendBroadcast.mutate()}
                    disabled={sendBroadcast.isPending || !body.trim() || audienceTenants.length === 0}
                  >
                    {sendBroadcast.isPending
                      ? <><Loader2 className="h-4 w-4 animate-spin" />Sending…</>
                      : <><Send className="h-4 w-4" />Send to {audienceTenants.length} tenant{audienceTenants.length !== 1 ? 's' : ''}</>
                    }
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* ── Campaign history ── */}
        <TabsContent value="history" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="text-base">Sent campaigns</CardTitle>
                <CardDescription>Broadcast history with delivery stats</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={() => refetchCampaigns()}>
                <RefreshCw className="h-4 w-4 mr-2" />Refresh
              </Button>
            </CardHeader>
            <CardContent>
              {campaignsLoading ? (
                <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
              ) : campaigns.length === 0 ? (
                <div className="py-10 text-center text-muted-foreground">
                  <Megaphone className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">No messages sent yet</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Campaign</TableHead>
                      <TableHead>Audience</TableHead>
                      <TableHead>Channels</TableHead>
                      <TableHead>Recipients</TableHead>
                      <TableHead>Sent</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {campaigns.map(c => (
                      <TableRow key={c.id}>
                        <TableCell>
                          <div>
                            <p className="text-sm font-medium">{c.name}</p>
                            <p className="text-xs text-muted-foreground truncate max-w-48">{c.body?.slice(0, 60)}…</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground capitalize">
                          {c.audience_type?.replace(/_/g, ' ')}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {c.send_sms && <Badge variant="outline" className="text-xs px-1 py-0">SMS</Badge>}
                            {c.send_email && <Badge variant="outline" className="text-xs px-1 py-0">Email</Badge>}
                            {c.send_whatsapp && <Badge variant="outline" className="text-xs px-1 py-0">WA</Badge>}
                            {c.send_app && <Badge variant="outline" className="text-xs px-1 py-0">App</Badge>}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">{c.total_recipients}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {c.sent_at ? format(new Date(c.sent_at), 'dd/MM/yy HH:mm') : '—'}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`text-xs ${
                            c.status === 'sent' ? 'border-green-300 text-green-700 bg-green-50' :
                            c.status === 'sending' ? 'border-[hsl(214_73%_48%/0.35)] text-[hsl(214_73%_35%)] bg-[hsl(214_73%_48%/0.06)]' :
                            c.status === 'failed' ? 'border-red-300 text-red-700 bg-red-50' :
                            'border-slate-300 text-slate-600'
                          }`}>
                            {c.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default BroadcastCenter;
