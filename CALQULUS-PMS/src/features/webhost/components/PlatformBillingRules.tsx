import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/shared/hooks/use-toast';
import { Card, CardContent } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Textarea } from '@/shared/components/ui/textarea';
import { Skeleton } from '@/shared/components/ui/skeleton';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/shared/components/ui/select';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/shared/components/ui/dialog';
import { Plus, Pencil, Trash2, ScrollText, RefreshCw, AlertTriangle, Power, Info, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/shared/lib/utils';
import { errorToast } from "@/shared/lib/errorToast";

interface BillingRule {
  id: string;
  rule_name: string;
  client_type: string;
  billing_model: string;
  rate_amount: number;
  rate_pct: number | null;
  applies_to_tier: string | null;
  registration_fee: number;
  free_trial_days: number;
  is_active: boolean;
  notes: string | null;
  created_at?: string | null;
}

const CLIENT_TYPES = ['manager', 'landlord', 'agency'];
const BILLING_MODELS = [
  { value: 'per_property', label: 'Per property / month' },
  { value: 'per_unit', label: 'Per unit / month' },
  { value: 'flat_monthly', label: 'Flat monthly fee' },
  { value: 'commission', label: 'Commission (% of rent collected)' },
  { value: 'tiered', label: 'Tiered (from subscription tiers)' },
  { value: 'free', label: 'Free / waived' },
];

const emptyForm = {
  rule_name: '', client_type: 'manager', billing_model: 'commission',
  rate_amount: '0', rate_pct: '1', applies_to_tier: '', registration_fee: '0',
  free_trial_days: '30', notes: '',
};

const fmt = (n: number) =>
  new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 0 }).format(n);

export default function PlatformBillingRules() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [editing, setEditing] = useState<BillingRule | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<BillingRule | null>(null);
  const [toggleTarget, setToggleTarget] = useState<BillingRule | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  const { data: rules, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['platform-billing-rules'],
    queryFn: async () => {
      const { data, error } = await (supabase.from('platform_billing_rules') as any)
        .select('*')
        .order('client_type', { ascending: true });
      if (error) throw error;
      return (data || []) as BillingRule[];
    },
  });

  const openNew = () => {
    setForm(emptyForm);
    setIsNew(true);
    setEditing({} as BillingRule);
  };

  const openEdit = (rule: BillingRule) => {
    setForm({
      rule_name: rule.rule_name,
      client_type: rule.client_type,
      billing_model: rule.billing_model,
      rate_amount: String(rule.rate_amount ?? 0),
      rate_pct: String(rule.rate_pct ?? 0),
      applies_to_tier: rule.applies_to_tier ?? '',
      registration_fee: String(rule.registration_fee ?? 0),
      free_trial_days: String(rule.free_trial_days ?? 30),
      notes: rule.notes ?? '',
    });
    setIsNew(false);
    setEditing(rule);
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!form.rule_name.trim()) throw new Error('Rule name is required');
      const rateAmount = Number(form.rate_amount);
      const ratePct = Number(form.rate_pct);
      const regFee = Number(form.registration_fee);
      const trialDays = Number(form.free_trial_days);
      if (isNaN(rateAmount) || rateAmount < 0) throw new Error('Rate amount must be a non-negative number');
      if (isNaN(regFee) || regFee < 0) throw new Error('Registration fee must be a non-negative number');
      if (isNaN(trialDays) || trialDays < 0) throw new Error('Free trial days must be a non-negative number');
      if (form.billing_model === 'commission' && (isNaN(ratePct) || ratePct < 0 || ratePct > 100)) {
        throw new Error('Commission rate must be between 0 and 100');
      }
      const payload = {
        rule_name: form.rule_name.trim(),
        client_type: form.client_type,
        billing_model: form.billing_model,
        rate_amount: rateAmount,
        rate_pct: ratePct,
        applies_to_tier: form.applies_to_tier.trim() || null,
        registration_fee: regFee,
        free_trial_days: trialDays,
        notes: form.notes.trim() || null,
      };
      if (isNew) {
        const { error } = await supabase.rpc('save_platform_billing_rule_atomic', { p_rule_id: null, p_payload: payload });
        if (error) throw error;
      } else {
        const { error } = await supabase.rpc('save_platform_billing_rule_atomic', { p_rule_id: editing!.id, p_payload: payload });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-billing-rules'] });
      toast({ title: isNew ? 'Rule created' : 'Rule updated' });
      setValidationError(null);
      setEditing(null);
    },
    onError: (err: Error) => {
      setValidationError(err.message);
      errorToast('Failed to save rule', err);
    },
  });

  const toggleActive = useMutation({
    mutationFn: async (rule: BillingRule) => {
      const { error } = await supabase.rpc('transition_platform_billing_rule_atomic', { p_rule_id: rule.id, p_is_active: !rule.is_active });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-billing-rules'] });
      setToggleTarget(null);
    },
    onError: (err: Error) => errorToast('Failed to update rule', err),
  });

  const removeRule = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('delete_platform_billing_rule_atomic', { p_rule_id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-billing-rules'] });
      toast({ title: 'Rule deleted' });
      setDeleteTarget(null);
    },
    onError: (err: Error) => errorToast('Failed to delete rule', err),
  });

  const activeCount = rules?.filter(r => r.is_active).length ?? 0;

  const describeRate = (rule: BillingRule): string => {
    if (rule.billing_model === 'commission') return `${rule.rate_pct ?? 0}% of rent collected`;
    if (rule.billing_model === 'free') return 'No charge';
    if (rule.billing_model === 'tiered') return 'From subscription tiers';
    const unit = rule.billing_model === 'flat_monthly' ? '/mo' : rule.billing_model === 'per_property' ? '/prop/mo' : rule.billing_model === 'per_unit' ? '/unit/mo' : '';
    return `${fmt(Number(rule.rate_amount || 0))}${unit}`;
  };

  return (
    <div className="space-y-5">
      {/* Control-center header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 enterprise-card p-4 sm:p-5">
        <div>
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <ScrollText className="h-5 w-5 text-warning" />
            Billing Rule Configuration Console
          </h2>
          <p className="text-muted-foreground text-xs mt-1">
            Defines the intended billing model per client type and tier. {rules && rules.length > 0 && <span className="text-muted-foreground">{activeCount} active · {rules.length - activeCount} inactive</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="border-border text-muted-foreground hover:bg-secondary-background hover:text-foreground h-9 rounded-xl text-xs" onClick={() => refetch()} aria-label="Refresh rules">
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />Refresh
          </Button>
          <Button size="sm" className="gap-1.5 bg-primary hover:bg-primary/90 text-white h-9 rounded-xl text-xs" onClick={openNew}>
            <Plus className="h-3.5 w-3.5" /> New rule
          </Button>
        </div>
      </div>

      {/* Reference-configuration banner — documents existing billing behaviour (no priority engine, not wired into invoice run) */}
      <div className="flex items-start gap-2.5 p-3.5 rounded-xl border border-warning/30 bg-warning/5">
        <Info className="h-4 w-4 shrink-0 text-warning mt-0.5" />
        <p className="text-xs text-warning/90">
          <strong className="text-warning">Reference configuration.</strong> These rules define what billing <em>should</em> be per client type and tier. The current monthly invoice run uses a single platform-wide commission rate rather than reading per-rule values from here. There is no rule priority or conflict-resolution engine — only one rule should be active per client type/tier. Treat this as the source of truth for intended billing until the run is wired to per-rule values.
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
      ) : isError ? (
        <div className="p-8 text-center rounded-2xl border border-destructive/30 bg-destructive/5">
          <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-destructive" />
          <p className="text-sm font-semibold text-destructive">Unable to load billing rules.</p>
          <p className="text-xs text-muted-foreground mt-1 mb-3">{(error as Error)?.message ?? 'Try again.'}</p>
          <Button variant="outline" size="sm" onClick={() => refetch()} className="border-destructive/40 text-destructive hover:bg-destructive/10">
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Retry
          </Button>
        </div>
      ) : !rules || rules.length === 0 ? (
        <div className="p-10 text-center rounded-2xl border border-border bg-secondary-background">
          <ScrollText className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">No billing rules configured.</p>
          <p className="text-xs text-muted-foreground mt-1">Create a rule to define the billing model per client type.</p>
        </div>
      ) : (
        <Card className="border-border">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-[10px] font-bold uppercase tracking-wide text-muted-foreground bg-secondary-background">
                    <th className="text-left px-4 py-2.5">Rule</th>
                    <th className="text-left px-4 py-2.5">Type</th>
                    <th className="text-left px-4 py-2.5">Amount / Rate</th>
                    <th className="text-left px-4 py-2.5">Scope</th>
                    <th className="text-center px-4 py-2.5">Status</th>
                    <th className="text-left px-4 py-2.5">Created</th>
                    <th className="text-right px-4 py-2.5">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {rules.map((rule) => (
                    <tr key={rule.id} className={cn('hover:bg-secondary-background', !rule.is_active && 'opacity-60')}>
                      <td className="px-4 py-3">
                        <p className="font-medium text-foreground">{rule.rule_name}</p>
                        {rule.notes && <p className="text-xs text-muted-foreground truncate max-w-xs italic">{rule.notes}</p>}
                        {rule.registration_fee > 0 && <p className="text-[10px] text-muted-foreground">{fmt(Number(rule.registration_fee))} reg. fee</p>}
                        {rule.free_trial_days > 0 && <p className="text-[10px] text-muted-foreground">{rule.free_trial_days}-day trial</p>}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className="text-[10px] border-border text-muted-foreground capitalize">{rule.client_type}</Badge>
                        <p className="text-[10px] text-muted-foreground mt-1">{BILLING_MODELS.find((m) => m.value === rule.billing_model)?.label ?? rule.billing_model}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-foreground text-xs">{describeRate(rule)}</p>
                      </td>
                      <td className="px-4 py-3">
                        {rule.applies_to_tier ? (
                          <Badge variant="outline" className="text-[10px] border-warning/30 text-warning bg-warning/10 capitalize">{rule.applies_to_tier}</Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">All {rule.client_type}s</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge variant="outline" className={cn('text-[10px]', rule.is_active ? 'bg-success/10 text-success border-success/30' : 'bg-secondary-foreground/10 text-secondary-foreground border-border/30')}>
                          {rule.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-xs text-muted-foreground">{rule.created_at ? format(new Date(rule.created_at), 'dd MMM yyyy') : '—'}</p>
                        <p className="text-[10px] text-muted-foreground">updated n/a</p>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:bg-secondary-background" onClick={() => openEdit(rule)} aria-label={`Edit ${rule.rule_name}`} title="Edit">
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          {rule.is_active ? (
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-warning hover:bg-warning/10" onClick={() => setToggleTarget(rule)} aria-label={`Deactivate ${rule.rule_name}`} title="Deactivate">
                              <Power className="h-3.5 w-3.5" />
                            </Button>
                          ) : (
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-success hover:bg-success/10" onClick={() => setToggleTarget(rule)} aria-label={`Activate ${rule.rule_name}`} title="Activate">
                              <Power className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10" onClick={() => setDeleteTarget(rule)} aria-label={`Delete ${rule.rule_name}`} title="Delete">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Create/edit dialog */}
      <Dialog open={!!editing} onOpenChange={(open) => { if (!open) { setEditing(null); setValidationError(null); } }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isNew ? 'New billing rule' : 'Edit billing rule'}</DialogTitle>
            <DialogDescription>Configure the billing model, rate, and scope for a client type. Changes affect intended billing configuration.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {validationError && (
              <div className="flex items-start gap-2 p-2.5 rounded-lg border border-destructive/30 bg-destructive/5">
                <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0 mt-0.5" />
                <p className="text-xs text-destructive">{validationError}</p>
              </div>
            )}
            <div>
              <Label className="text-xs">Rule name</Label>
              <Input value={form.rule_name} onChange={(e) => setForm((p) => ({ ...p, rule_name: e.target.value }))} className="mt-1 bg-card border-border text-foreground" placeholder="e.g. Manager — Growth tier" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Client type</Label>
                <Select value={form.client_type} onValueChange={(v) => setForm((p) => ({ ...p, client_type: v }))}>
                  <SelectTrigger className="mt-1 bg-card border-border text-foreground"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CLIENT_TYPES.map((t) => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Billing model</Label>
                <Select value={form.billing_model} onValueChange={(v) => setForm((p) => ({ ...p, billing_model: v }))}>
                  <SelectTrigger className="mt-1 bg-card border-border text-foreground"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {BILLING_MODELS.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {form.billing_model === 'commission' ? (
              <div>
                <Label className="text-xs">Rate (% of rent collected, 0–100)</Label>
                <Input type="number" min="0" max="100" step="0.1" value={form.rate_pct} onChange={(e) => setForm((p) => ({ ...p, rate_pct: e.target.value }))} className="mt-1 bg-card border-border text-foreground" />
              </div>
            ) : form.billing_model !== 'free' && form.billing_model !== 'tiered' && (
              <div>
                <Label className="text-xs">Rate amount (KES)</Label>
                <Input type="number" min="0" value={form.rate_amount} onChange={(e) => setForm((p) => ({ ...p, rate_amount: e.target.value }))} className="mt-1 bg-card border-border text-foreground" />
              </div>
            )}
            {form.billing_model === 'tiered' && (
              <div>
                <Label className="text-xs">Applies to tier</Label>
                <Input placeholder="e.g. starter, growth, enterprise" value={form.applies_to_tier} onChange={(e) => setForm((p) => ({ ...p, applies_to_tier: e.target.value }))} className="mt-1 bg-card border-border text-foreground" />
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Registration fee (KES)</Label>
                <Input type="number" min="0" value={form.registration_fee} onChange={(e) => setForm((p) => ({ ...p, registration_fee: e.target.value }))} className="mt-1 bg-card border-border text-foreground" />
              </div>
              <div>
                <Label className="text-xs">Free trial (days)</Label>
                <Input type="number" min="0" value={form.free_trial_days} onChange={(e) => setForm((p) => ({ ...p, free_trial_days: e.target.value }))} className="mt-1 bg-card border-border text-foreground" />
              </div>
            </div>
            <div>
              <Label className="text-xs">Notes</Label>
              <Textarea value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} rows={2} className="mt-1 bg-card border-border text-foreground" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditing(null); setValidationError(null); }}>Cancel</Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending} className="bg-primary hover:bg-primary/90 text-white">
              {save.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {save.isPending ? 'Saving…' : 'Save rule'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-warning" />Delete this rule?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            "{deleteTarget?.rule_name}" will be permanently removed from billing configuration.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteTarget && removeRule.mutate(deleteTarget.id)} disabled={removeRule.isPending}>
              {removeRule.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {removeRule.isPending ? 'Deleting…' : 'Delete permanently'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Activate / deactivate confirmation (billing-impacting change) */}
      <Dialog open={!!toggleTarget} onOpenChange={(open) => !open && setToggleTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-warning" />{toggleTarget?.is_active ? 'Deactivate rule?' : 'Activate rule?'}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            "{toggleTarget?.rule_name}" will be {toggleTarget?.is_active ? 'marked inactive' : 'marked active'}.
          </p>
          {toggleTarget?.is_active && (
            <p className="text-xs text-warning/90">Inactive rules are excluded from intended billing configuration for this client type/tier.</p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setToggleTarget(null)}>Cancel</Button>
            <Button onClick={() => toggleTarget && toggleActive.mutate(toggleTarget)} disabled={toggleActive.isPending} className={toggleTarget?.is_active ? 'bg-primary hover:bg-primary/90 text-white' : 'bg-success/100 hover:bg-success text-white'}>
              {toggleActive.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {toggleTarget?.is_active ? 'Deactivate' : 'Activate'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
