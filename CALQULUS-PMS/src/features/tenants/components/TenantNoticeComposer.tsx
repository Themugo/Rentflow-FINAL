// @ts-nocheck — Phase 12: remaining local types until live supabase gen types
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/features/auth/AuthContext';
import { useRBAC } from '@/shared/hooks/useRBAC';
import { useToast } from '@/shared/hooks/use-toast';
import { useCurrency } from '@/shared/hooks/useCurrency';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Badge } from '@/shared/components/ui/badge';
import { Textarea } from '@/shared/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog';
import { Skeleton } from '@/shared/components/ui/skeleton';
import {
  Bell, Plus, Send, CheckCircle, Clock, Eye,
  TrendingUp, AlertTriangle, Home, FileText, Loader2
} from 'lucide-react';
import { format } from 'date-fns';
import { errorToast } from "@/shared/lib/errorToast";

interface Tenant {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  unit?: string | null;
  property?: string | null;
  monthly_rent?: number | null;
  unit_id?: string | null;
  property_id?: string | null;
}

interface TenantNoticeComposerProps {
  tenant: Tenant;
  tenancyId?: string | null;
}

const NOTICE_TYPES = [
  { value: 'rent_increase',   label: 'Rent increase notice',    icon: TrendingUp,    color: 'text-warning', template: true },
  { value: 'arrears_demand',  label: 'Arrears demand letter',   icon: AlertTriangle, color: 'text-red-600',   template: true },
  { value: 'eviction_warning',label: 'Eviction warning',        icon: Home,          color: 'text-red-700',   template: true },
  { value: 'entry_notice',    label: 'Maintenance entry notice', icon: Home,          color: 'text-[hsl(214_73%_45%)]',  template: true },
  { value: 'lease_renewal',   label: 'Lease renewal offer',     icon: FileText,      color: 'text-green-600', template: true },
  { value: 'rule_violation',  label: 'Rule violation notice',   icon: AlertTriangle, color: 'text-orange-600', template: false },
  { value: 'general',         label: 'General notice',          icon: Bell,          color: 'text-slate-600', template: false },
];

const TEMPLATES: Record<string, (t: Tenant, extra?: Record<string, unknown>) => string> = {
  rent_increase: (t, e) =>
    `Dear ${t.name},\n\nPlease be advised that effective ${e?.effectiveDate || '[effective date]'}, the monthly rent for your unit at ${t.property || '[property]'} — ${t.unit || '[unit]'} — will increase from KES ${Number(t.monthly_rent || 0).toLocaleString()} to KES ${Number(e?.newRent || 0).toLocaleString()} per month.\n\nThis increase reflects current market conditions and the cost of maintaining the property to a high standard. We appreciate your continued tenancy and are committed to providing you with quality accommodation.\n\nIf you have any questions, please contact us at your earliest convenience.\n\nYours sincerely,\n[Manager name]`,

  arrears_demand: (t, e) =>
    `Dear ${t.name},\n\nThis letter serves as a formal demand for payment of outstanding rent arrears for your tenancy at ${t.property || '[property]'} — ${t.unit || '[unit]'}.\n\nAs of today, your account shows an outstanding balance of KES ${Number(e?.amountOwed || 0).toLocaleString()}.\n\nYou are hereby required to settle this amount in full within ${e?.noticeDays || 7} days of this notice. Failure to do so may result in further legal action including eviction proceedings.\n\nPayment can be made via M-Pesa Paybill [paybill number] or by contacting our office.\n\nYours sincerely,\n[Manager name]`,

  eviction_warning: (t, e) =>
    `Dear ${t.name},\n\nNOTICE TO VACATE\n\nYou are hereby given formal notice to vacate the premises at ${t.property || '[property]'} — ${t.unit || '[unit]'} within ${e?.noticeDays || 30} days from the date of this letter.\n\nReason: ${e?.reason || '[reason]'}\n\nYou are required to leave the premises in clean and good condition and return all keys on or before the vacate date. Your deposit will be processed in accordance with the tenancy agreement following inspection of the unit.\n\nFailure to comply with this notice may result in legal proceedings.\n\nYours sincerely,\n[Manager name]`,

  entry_notice: (t, e) =>
    `Dear ${t.name},\n\nThis is to inform you that authorised personnel will need to access your unit at ${t.property || '[property]'} — ${t.unit || '[unit]'} on ${e?.entryDate || '[date]'} between ${e?.entryTime || '[time]'} for the purpose of ${e?.purpose || 'routine maintenance/inspection'}.\n\nYour presence is not required but you are welcome to be present. Please ensure the area is accessible.\n\nWe apologise for any inconvenience and thank you for your cooperation.\n\nYours sincerely,\n[Manager name]`,

  lease_renewal: (t, e) =>
    `Dear ${t.name},\n\nYour current tenancy agreement for ${t.property || '[property]'} — ${t.unit || '[unit]'} is due to expire on ${e?.expiryDate || '[expiry date]'}.\n\nWe are pleased to offer you a lease renewal under the following terms:\n\n• New lease period: ${e?.newPeriod || '[period]'}\n• Monthly rent: KES ${Number(e?.newRent || t.monthly_rent || 0).toLocaleString()}\n\nPlease confirm your intention to renew by ${e?.replyDate || '[reply date]'}. If we do not receive a response, we will assume you do not wish to renew.\n\nWe value your tenancy and hope to continue this arrangement.\n\nYours sincerely,\n[Manager name]`,
};

const STATUS_COLORS: Record<string, string> = {
  draft:        'bg-slate-100 text-slate-700 border-slate-200',
  sent:         'bg-[hsl(214_73%_48%/0.12)] text-[hsl(214_73%_35%)] border-[hsl(214_73%_48%/0.25)]',
  delivered:    'bg-green-100 text-green-800 border-green-200',
  acknowledged: 'bg-green-100 text-green-800 border-green-200',
  disputed:     'bg-red-100 text-red-800 border-red-200',
  withdrawn:    'bg-slate-100 text-slate-500 border-slate-200',
};

const TenantNoticeComposer: React.FC<TenantNoticeComposerProps> = ({ tenant, tenancyId }) => {
  const { user } = useAuth();
  const { can } = useRBAC();
  const canSend = can('send_notices');
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [previewId, setPreviewId] = useState<string | null>(null);

  const [form, setForm] = useState({
    notice_type: 'rent_increase',
    title: '',
    body: '',
    current_rent: String(tenant.monthly_rent || ''),
    new_rent: '',
    effective_date: '',
    notice_period_days: '30',
    delivery_method: 'email',
  });

  const { data: notices = [], isLoading } = useQuery({
    queryKey: ['tenant-notices', tenant.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tenant_notices')
        .select('*')
        .eq('tenant_id', tenant.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const loadTemplate = (type: string) => {
    const extra = {
      newRent: form.new_rent,
      effectiveDate: form.effective_date,
      noticeDays: form.notice_period_days,
      amountOwed: 0,
    };
    const nt = NOTICE_TYPES.find(t => t.value === type);
    const tpl = TEMPLATES[type]?.(tenant, extra) || '';
    setForm(p => ({
      ...p,
      notice_type: type,
      title: nt?.label || '',
      body: tpl,
    }));
  };

  const sendNotice = useMutation({
    mutationFn: async (asDraft = false) => {
      const { data, error } = await supabase.rpc('create_tenant_notice_atomic' as never, {
        p_tenant_id: tenant.id, p_unit_id: tenant.unit_id ?? null, p_property_id: tenant.property_id ?? null,
        p_tenancy_id: tenancyId ?? null, p_notice_type: form.notice_type, p_title: form.title, p_body: form.body,
        p_current_rent: form.current_rent ? Number(form.current_rent) : null,
        p_new_rent: form.new_rent ? Number(form.new_rent) : null, p_effective_date: form.effective_date || null,
        p_notice_period_days: form.notice_period_days ? Number(form.notice_period_days) : null,
        p_delivery_method: form.delivery_method, p_status: asDraft ? 'draft' : 'sent',
      });
      if (error) throw error;

      let emailDelivered = true;
      if (!asDraft) {
        // Send via email/SMS
        if (form.delivery_method === 'email' || form.delivery_method === 'both') {
          const { data: sendResult, error: sendError } = await supabase.functions.invoke('send-tenant-notice', {
            body: {
              tenantEmail:    tenant.email,
              tenantName:     tenant.name,
              noticeType:     form.notice_type,
              title:          form.title,
              body:           form.body,
              property:       tenant.property,
              unit:           tenant.unit,
            },
          });
          const delivered = sendResult?.sent === true || sendResult?.data?.sent === true;
          if (sendError || !delivered) {
            emailDelivered = false;
            console.error('[TenantNoticeComposer] send-tenant-notice failed:', sendError ?? sendResult);
          }
        }
      }
      return { asDraft, emailDelivered };
    },
    onSuccess: ({ asDraft, emailDelivered }) => {
      queryClient.invalidateQueries({ queryKey: ['tenant-notices', tenant.id] });
      if (asDraft) {
        toast({ title: 'Notice saved as draft' });
      } else if (emailDelivered) {
        toast({ title: 'Notice sent', description: `Delivered to ${tenant.email}` });
      } else {
        toast({
          title: 'Notice saved, but email failed to send',
          description: `The notice was recorded, but we couldn't deliver it to ${tenant.email}. Please follow up manually or resend.`,
          variant: 'destructive',
        });
      }
      setDialogOpen(false);
      setForm(p => ({ ...p, title: '', body: '', new_rent: '', effective_date: '' }));
    },
    onError: (err: Error) => errorToast('Failed', err),
  });

  const previewNotice = notices.find(n => n.id === previewId);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-sm font-medium">Formal notices to tenant</CardTitle>
            <CardDescription>Rent increases, arrears demands, entry notices, and more</CardDescription>
          </div>
          {canSend && (
            <Button size="sm" onClick={() => { loadTemplate('rent_increase'); setDialogOpen(true); }}>
              <Plus className="h-4 w-4 mr-1.5" />
              New notice
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {isLoading ? <Skeleton className="h-24 w-full" /> : notices.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              <Bell className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No notices issued to this tenant yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {notices.map(n => {
                const nt = NOTICE_TYPES.find(t => t.value === n.notice_type);
                const Icon = nt?.icon ?? Bell;
                return (
                  <div key={n.id} className="rounded-lg border border-border p-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <Icon className={`h-4 w-4 shrink-0 ${nt?.color || 'text-muted-foreground'}`} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium truncate">{n.title}</p>
                          <Badge variant="outline" className={`text-xs ${STATUS_COLORS[n.status]}`}>{n.status}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {n.created_at ? format(new Date(n.created_at), 'dd/MM/yy') : '—'}
                          {n.delivery_method && ` · via ${n.delivery_method}`}
                          {n.tenant_acknowledged && ' · ✓ Acknowledged'}
                        </p>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setPreviewId(n.id)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Compose dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Issue formal notice to {tenant.name}</DialogTitle>
            <DialogDescription>{tenant.property} — {tenant.unit}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Notice type */}
            <div>
              <Label>Notice type</Label>
              <div className="grid grid-cols-3 gap-2 mt-1">
                {NOTICE_TYPES.map(t => (
                  <button key={t.value} type="button"
                    onClick={() => loadTemplate(t.value)}
                    className={`flex items-center gap-2 px-2.5 py-2 rounded-lg border text-left text-xs transition-colors ${
                      form.notice_type === t.value
                        ? 'border-amber-400/50 bg-amber-400/8 text-warning'
                        : 'border-border hover:border-amber-400/30 text-muted-foreground'
                    }`}
                  >
                    <t.icon className={`h-3.5 w-3.5 shrink-0 ${t.color}`} />
                    <span className="font-medium leading-tight">{t.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Rent increase extras */}
            {form.notice_type === 'rent_increase' && (
              <div className="grid grid-cols-3 gap-3 p-3 bg-amber-50 rounded-lg border border-amber-200">
                <div>
                  <Label className="text-xs">Current rent (KES)</Label>
                  <Input type="number" value={form.current_rent} onChange={e => setForm(p => ({ ...p, current_rent: e.target.value }))} className="mt-1 h-8 text-sm" />
                </div>
                <div>
                  <Label className="text-xs">New rent (KES)</Label>
                  <Input type="number" value={form.new_rent} onChange={e => setForm(p => ({ ...p, new_rent: e.target.value }))} className="mt-1 h-8 text-sm" />
                </div>
                <div>
                  <Label className="text-xs">Effective date</Label>
                  <Input type="date" value={form.effective_date} onChange={e => setForm(p => ({ ...p, effective_date: e.target.value }))} className="mt-1 h-8 text-sm" />
                </div>
              </div>
            )}

            <div>
              <Label>Subject / title</Label>
              <Input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} className="mt-1" />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <Label>Notice body</Label>
                <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => loadTemplate(form.notice_type)}>
                  Reload template
                </Button>
              </div>
              <Textarea
                value={form.body}
                onChange={e => setForm(p => ({ ...p, body: e.target.value }))}
                rows={12}
                className="font-mono text-sm resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Delivery method</Label>
                <Select value={form.delivery_method} onValueChange={v => setForm(p => ({ ...p, delivery_method: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="sms">SMS</SelectItem>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                    <SelectItem value="both">Email + SMS</SelectItem>
                    <SelectItem value="hand_delivered">Hand delivered</SelectItem>
                    <SelectItem value="posted">Posted mail</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Notice period (days)</Label>
                <Input type="number" value={form.notice_period_days} onChange={e => setForm(p => ({ ...p, notice_period_days: e.target.value }))} className="mt-1" />
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => sendNotice.mutate(true)} disabled={sendNotice.isPending}>
              Save as draft
            </Button>
            <Button onClick={() => sendNotice.mutate(false)} disabled={sendNotice.isPending} className="gap-2">
              {sendNotice.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Send notice
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview dialog */}
      <Dialog open={!!previewId} onOpenChange={open => !open && setPreviewId(null)}>
        <DialogContent className="sm:max-w-xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{previewNotice?.title}</DialogTitle>
            <DialogDescription>
              {previewNotice?.created_at ? format(new Date(previewNotice.created_at), 'dd/MM/yy') : '—'} · {previewNotice?.delivery_method}
            </DialogDescription>
          </DialogHeader>
          <pre className="whitespace-pre-wrap text-sm font-sans p-4 bg-muted/30 rounded-lg border border-border">
            {previewNotice?.body}
          </pre>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TenantNoticeComposer;
