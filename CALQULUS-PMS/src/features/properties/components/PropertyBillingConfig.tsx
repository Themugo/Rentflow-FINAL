import React, { useEffect, useState } from 'react';
import { BillingDueConfigPanel } from '@/features/billing/components/BillingDueConfigPanel';
import { PaymentCollectionRoutingPanel } from '@/features/billing/components/PaymentCollectionRoutingPanel';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/features/auth/AuthContext';
import { useToast } from '@/shared/hooks/use-toast';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Switch } from '@/shared/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { Badge } from '@/shared/components/ui/badge';
import { Separator } from '@/shared/components/ui/separator';
import { Save, Loader2, Receipt, Calendar, AlertTriangle, Zap, FileText, Info } from 'lucide-react';
import { useCurrency } from '@/shared/hooks/useCurrency';
import { errorToast } from "@/shared/lib/errorToast";

const INVOICE_MODES = [
  {
    value: 'compiled',
    label: 'Compiled — one invoice per unit',
    desc: 'Rent + water + garbage + all charges combined into a single monthly invoice. Simplest for tenants to understand.',
    example: 'Invoice: Rent 12,000 + Water 850 + Garbage 250 = KES 13,100',
  },
  {
    value: 'separate',
    label: 'Separate — one invoice per charge type',
    desc: 'Each charge type generates its own invoice. Best when different charges have different due dates or payment channels.',
    example: 'Invoice 1: Rent 12,000 | Invoice 2: Water 850 | Invoice 3: Garbage 250',
  },
  {
    value: 'rent_only',
    label: 'Rent only — manually bill other charges',
    desc: 'Only rent is auto-generated monthly. Water, garbage and other charges are invoiced manually by the manager.',
    example: 'Auto-invoice: Rent 12,000. Water and garbage added manually each month.',
  },
  {
    value: 'grouped',
    label: 'Grouped — rent + service separate from utilities',
    desc: 'Two invoices per unit: one for rent/service charges, one for utilities (water, electricity, garbage).',
    example: 'Invoice 1: Rent + Service Charge | Invoice 2: Water + Garbage',
  },
];

interface Props {
  propertyId: string;
  propertyName: string;
}

const PropertyBillingConfig: React.FC<Props> = ({ propertyId, propertyName }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { formatCurrency } = useCurrency();
  const queryClient = useQueryClient();

  const [form, setForm] = useState({
    invoice_mode: 'compiled',
    due_day_of_month: '1',
    grace_period_days: '0',
    late_penalty_enabled: false,
    late_penalty_type: 'fixed',
    late_penalty_amount: '0',
    late_penalty_pct: '0',
    auto_generate_monthly: true,
    auto_generate_day: '25',
    notify_before_days: '3',
    invoice_prefix: 'INV',
    receipt_prefix: 'RCP',
  });

  const { data: config, isLoading } = useQuery({
    queryKey: ['property-billing-config', propertyId],
    queryFn: async () => {
      const { data } = await supabase
        .from('property_billing_config')
        .select('*')
        .eq('property_id', propertyId)
        .maybeSingle();
      return data as any;
    },
    enabled: !!propertyId,
  });

  useEffect(() => {
    if (config) {
      setForm({
        invoice_mode:          config.invoice_mode ?? 'compiled',
        due_day_of_month:      String(config.due_day_of_month ?? 1),
        grace_period_days:     String(config.grace_period_days ?? 0),
        late_penalty_enabled:  config.late_penalty_enabled ?? false,
        late_penalty_type:     config.late_penalty_type ?? 'fixed',
        late_penalty_amount:   String(config.late_penalty_amount ?? 0),
        late_penalty_pct:      String(config.late_penalty_pct ?? 0),
        auto_generate_monthly: config.auto_generate_monthly ?? true,
        auto_generate_day:     String(config.auto_generate_day ?? 25),
        notify_before_days:    String(config.notify_before_days ?? 3),
        invoice_prefix:        config.invoice_prefix ?? 'INV',
        receipt_prefix:        config.receipt_prefix ?? 'RCP',
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config?.id, config?.updated_at]);

  const saveConfig = useMutation({
    mutationFn: async () => {
      const payload = {
        property_id:          propertyId,
        manager_id:           user!.id,
        invoice_mode:         form.invoice_mode,
        due_day_of_month:     parseInt(form.due_day_of_month),
        grace_period_days:    parseInt(form.grace_period_days),
        late_penalty_enabled: form.late_penalty_enabled,
        late_penalty_type:    form.late_penalty_type,
        late_penalty_amount:  parseFloat(form.late_penalty_amount) || 0,
        late_penalty_pct:     parseFloat(form.late_penalty_pct) || 0,
        auto_generate_monthly: form.auto_generate_monthly,
        auto_generate_day:    parseInt(form.auto_generate_day),
        notify_before_days:   parseInt(form.notify_before_days),
        invoice_prefix:       form.invoice_prefix.trim().toUpperCase() || 'INV',
        receipt_prefix:       form.receipt_prefix.trim().toUpperCase() || 'RCP',
      };
      const { error } = await supabase.rpc('save_property_billing_config_atomic' as any, { p_property_id: propertyId, p_payload: payload });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['property-billing-config', propertyId] });
      toast({ title: 'Billing settings saved', description: 'All future invoices will use these settings.' });
    },
    onError: (err: Error) => errorToast('Failed', err),
  });

  const f = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }));

  const selectedMode = INVOICE_MODES.find(m => m.value === form.invoice_mode);

  if (isLoading) return <div className="h-32 animate-pulse bg-muted rounded-lg" />;

  return (
    <div className="space-y-6">
      {/* Invoice mode */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Invoice mode — how charges are billed
          </CardTitle>
          <CardDescription>
            Controls whether all charges appear on one invoice or separate invoices for {propertyName}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3">
            {INVOICE_MODES.map(mode => (
              <button
                key={mode.value}
                type="button"
                onClick={() => setForm(p => ({ ...p, invoice_mode: mode.value }))}
                className={`text-left rounded-xl border p-4 transition-all ${
                  form.invoice_mode === mode.value
                    ? 'border-amber-400/50 bg-amber-400/8 ring-1 ring-amber-400'
                    : 'border-border hover:border-amber-400/40'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm font-semibold">{mode.label}</span>
                  {form.invoice_mode === mode.value && (
                    <Badge className="bg-amber-400/10 text-warning border-amber-400/20 text-xs">Selected</Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mb-2">{mode.desc}</p>
                <p className="text-xs font-mono text-muted-foreground bg-muted rounded px-2 py-1">{mode.example}</p>
              </button>
            ))}
          </div>

          {/* Charge-level override explanation */}
          <div className="flex items-start gap-2 p-3 rounded-lg bg-[hsl(214_73%_48%/0.06)] border border-[hsl(214_73%_48%/0.25)] text-xs text-[hsl(214_73%_35%)]">
            <Info className="h-4 w-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium mb-0.5">Per-charge overrides</p>
              <p>In Unit Billing Config (⚙ per unit), you can override the mode for specific charges — e.g. water is always separate even if the property is set to compiled.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Due dates */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Due dates & grace period
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div>
            <Label className="text-xs">Due day of month</Label>
            <Input type="number" min="1" max="28" value={form.due_day_of_month} onChange={f('due_day_of_month')} className="mt-1" />
            <p className="text-xs text-muted-foreground mt-0.5">e.g. 1 = every 1st of month</p>
          </div>
          <div>
            <Label className="text-xs">Grace period (days)</Label>
            <Input type="number" min="0" max="30" value={form.grace_period_days} onChange={f('grace_period_days')} className="mt-1" />
            <p className="text-xs text-muted-foreground mt-0.5">Days before overdue status</p>
          </div>
          <div>
            <Label className="text-xs">Notify tenants (days before)</Label>
            <Input type="number" min="0" max="14" value={form.notify_before_days} onChange={f('notify_before_days')} className="mt-1" />
            <p className="text-xs text-muted-foreground mt-0.5">Reminder SMS/email</p>
          </div>
        </CardContent>
      </Card>

      <BillingDueConfigPanel scope="manager" scopeId={user!.id} propertyId={propertyId} title="Manager due & overdue policy" />

      <PaymentCollectionRoutingPanel propertyId={propertyId} title="Property default payment destination" />

      {/* Late penalty */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Late payment penalty
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm">Enable late penalty</Label>
              <p className="text-xs text-muted-foreground">Apply a charge when payment is received after due date + grace period</p>
            </div>
            <Switch
              checked={form.late_penalty_enabled}
              onCheckedChange={v => setForm(p => ({ ...p, late_penalty_enabled: v }))}
            />
          </div>
          {form.late_penalty_enabled && (
            <div className="grid grid-cols-2 gap-4 pl-0">
              <div>
                <Label className="text-xs">Penalty type</Label>
                <Select value={form.late_penalty_type} onValueChange={v => setForm(p => ({ ...p, late_penalty_type: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fixed">Fixed amount (KES)</SelectItem>
                    <SelectItem value="percentage">Percentage of invoice (%)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {form.late_penalty_type === 'fixed' ? (
                <div>
                  <Label className="text-xs">Fixed penalty amount (KES)</Label>
                  <Input type="number" min="0" value={form.late_penalty_amount} onChange={f('late_penalty_amount')} className="mt-1" />
                </div>
              ) : (
                <div>
                  <Label className="text-xs">Penalty percentage (%)</Label>
                  <Input type="number" min="0" max="100" step="0.5" value={form.late_penalty_pct} onChange={f('late_penalty_pct')} className="mt-1" />
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Auto-generation */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Zap className="h-4 w-4" />
            Auto-generate invoices
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm">Auto-generate monthly</Label>
              <p className="text-xs text-muted-foreground">Automatically generate next month's invoices on a set day each month</p>
            </div>
            <Switch
              checked={form.auto_generate_monthly}
              onCheckedChange={v => setForm(p => ({ ...p, auto_generate_monthly: v }))}
            />
          </div>
          {form.auto_generate_monthly && (
            <div>
              <Label className="text-xs">Generate on day of month</Label>
              <Input type="number" min="1" max="28" value={form.auto_generate_day} onChange={f('auto_generate_day')} className="mt-1 w-24" />
              <p className="text-xs text-muted-foreground mt-0.5">e.g. 25 = generate December invoices on 25th November</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Numbering */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Receipt className="h-4 w-4" />
            Invoice & receipt numbering
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-xs">Invoice prefix</Label>
            <Input value={form.invoice_prefix} onChange={f('invoice_prefix')} maxLength={8} className="mt-1 uppercase" />
            <p className="text-xs text-muted-foreground mt-0.5">e.g. {form.invoice_prefix}-2025-001</p>
          </div>
          <div>
            <Label className="text-xs">Receipt prefix</Label>
            <Input value={form.receipt_prefix} onChange={f('receipt_prefix')} maxLength={8} className="mt-1 uppercase" />
            <p className="text-xs text-muted-foreground mt-0.5">e.g. {form.receipt_prefix}-2025-001</p>
          </div>
        </CardContent>
      </Card>

      <Button
        className="w-full gap-2"
        onClick={() => saveConfig.mutate()}
        disabled={saveConfig.isPending}
      >
        {saveConfig.isPending
          ? <><Loader2 className="h-4 w-4 animate-spin" />Saving…</>
          : <><Save className="h-4 w-4" />Save billing settings</>
        }
      </Button>
    </div>
  );
};

export default PropertyBillingConfig;
