import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/features/auth/AuthContext';
import { useToast } from '@/shared/hooks/use-toast';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Badge } from '@/shared/components/ui/badge';
import { Switch } from '@/shared/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { errorToast } from "@/shared/lib/errorToast";
import {
  Plus, Trash2, Briefcase, User, Users, Building2,
  Loader2, Info
} from 'lucide-react';

interface PaymentPayersManagerProps {
  tenantId: string;
  tenantName: string;
  unitId?: string | null;
  propertyId?: string | null;
  monthlyRent?: number | null;
}

const PAYER_TYPES = [
  { value: 'self',          label: 'Tenant pays directly',      icon: User,      desc: 'Tenant pays their own rent' },
  { value: 'employer',      label: 'Employer / company pays',   icon: Briefcase, desc: 'Workplace pays on behalf of employee' },
  { value: 'parent',        label: 'Parent / guardian pays',    icon: Users,     desc: 'Family member pays rent' },
  { value: 'housing_assoc', label: 'Housing association',       icon: Building2, desc: 'Government or housing body pays' },
  { value: 'guarantor',     label: 'Guarantor pays',            icon: Users,     desc: 'Guarantor covering rent' },
  { value: 'split',         label: 'Split — multiple payers',   icon: Users,     desc: 'Two or more parties share the rent' },
  { value: 'custom',        label: 'Other arrangement',         icon: User,      desc: 'Custom payment arrangement' },
];

const METHODS = [
  { value: 'mpesa',           label: 'M-Pesa' },
  { value: 'bank',            label: 'Bank transfer' },
  { value: 'standing_order',  label: 'Bank standing order' },
  { value: 'cheque',          label: 'Cheque' },
  { value: 'cash',            label: 'Cash' },
];

const PAYER_COLORS: Record<string, string> = {
  self:          'bg-green-100 text-green-800 border-green-200',
  employer:      'bg-[hsl(214_73%_48%/0.12)] text-[hsl(214_73%_35%)] border-[hsl(214_73%_48%/0.25)]',
  parent:        'bg-[hsl(218_58%_35%/0.12)] text-[hsl(218_58%_30%)] border-[hsl(218_58%_35%/0.25)]',
  housing_assoc: 'bg-primary/10 text-primary border-primary/20',
  guarantor:     'bg-amber-100 text-amber-800 border-amber-200',
  split:         'bg-orange-100 text-orange-800 border-orange-200',
  custom:        'bg-slate-100 text-slate-700 border-slate-200',
};

const empty = () => ({
  payer_type: 'employer', payer_name: '', payer_email: '', payer_phone: '',
  payer_organisation: '', payer_address: '', national_id: '',
  pays_amount: '', pays_percentage: '',
  payment_day: '', preferred_method: 'mpesa', mpesa_number: '',
  bank_account: '', bank_name: '', standing_order_ref: '',
  start_date: new Date().toISOString().slice(0,10), end_date: '', notes: '',
});

const fmt = (n: number) => `KES ${n.toLocaleString('en-KE')}`;

const PaymentPayersManager: React.FC<PaymentPayersManagerProps> = ({
  tenantId, tenantName, unitId, propertyId, monthlyRent,
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(empty());

  const f = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }));

  const { data: payers = [], isLoading } = useQuery({
    queryKey: ['payment-payers', tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payment_payers')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at');
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const addPayer = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('save_payment_payer_atomic' as never, {
        p_payer_id: null,
        p_payload: {
          tenant_id: tenantId, manager_id: user!.id, unit_id: unitId ?? null, property_id: propertyId ?? null,
          payer_type: form.payer_type, payer_name: form.payer_name || null, payer_email: form.payer_email || null,
          payer_phone: form.payer_phone || null, payer_organisation: form.payer_organisation || null, payer_address: form.payer_address || null,
          national_id: form.national_id || null, pays_amount: form.pays_amount || null, pays_percentage: form.pays_percentage || null,
          payment_day: form.payment_day || null, preferred_method: form.preferred_method, mpesa_number: form.mpesa_number || null,
          bank_account: form.bank_account || null, bank_name: form.bank_name || null, standing_order_ref: form.standing_order_ref || null,
          start_date: form.start_date || null, end_date: form.end_date || null, notes: form.notes || null, is_active: true,
        },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-payers', tenantId] });
      toast({ title: 'Payer added', description: `Payment arrangement saved for ${tenantName}` });
      setDialogOpen(false);
      setForm(empty());
    },
    onError: (err: Error) => errorToast('Failed', err),
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.rpc('transition_payment_payer_atomic' as never, { p_payer_id: id, p_active: active });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['payment-payers', tenantId] }),
    onError: () => { /* error surfaced via react-query error boundary */ },
  });

  const deletePayer = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('delete_payment_payer_atomic' as never, { p_payer_id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-payers', tenantId] });
      toast({ title: 'Payer removed' });
    },
  });

  const totalPct = payers.filter(p => p.is_active && p.pays_percentage)
    .reduce((s, p) => s + Number(p.pays_percentage), 0);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-sm font-medium">Payment arrangements</CardTitle>
            <CardDescription>
              Who pays rent for {tenantName} — employer, split, standing order, etc.
            </CardDescription>
          </div>
          <Button size="sm" onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-1.5" />
            Add payer
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-16 w-full" />
          ) : payers.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              <User className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No payment arrangements — tenant pays directly</p>
              <p className="text-xs mt-1 opacity-70">Add an arrangement if an employer, parent, or other party pays rent</p>
            </div>
          ) : (
            <div className="space-y-3">
              {payers.map(payer => {
                const pt = PAYER_TYPES.find(t => t.value === payer.payer_type);
                const Icon = pt?.icon ?? User;
                const coverage = payer.pays_amount
                  ? fmt(payer.pays_amount)
                  : payer.pays_percentage
                    ? `${payer.pays_percentage}%${monthlyRent ? ` (${fmt(monthlyRent * payer.pays_percentage / 100)})` : ''}`
                    : 'Full rent';
                return (
                  <div key={payer.id} className={`rounded-lg border p-4 ${!payer.is_active ? 'opacity-50' : ''}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${PAYER_COLORS[payer.payer_type]?.replace('text-', 'bg-').split(' ')[0] || 'bg-muted'}`}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <Badge variant="outline" className={`text-xs ${PAYER_COLORS[payer.payer_type]}`}>
                              {pt?.label}
                            </Badge>
                            <span className="text-sm font-medium">{payer.payer_name || payer.payer_organisation || 'Unnamed payer'}</span>
                          </div>
                          <div className="text-xs text-muted-foreground space-y-0.5">
                            {payer.payer_phone && <p>📞 {payer.payer_phone}</p>}
                            {payer.payer_organisation && <p>🏢 {payer.payer_organisation}</p>}
                            <p>Covers: <span className="font-medium text-foreground">{coverage}</span> · Pays on day {payer.payment_day || '—'} of month</p>
                            <p>Via: {METHODS.find(m => m.value === payer.preferred_method)?.label}</p>
                            {payer.mpesa_number && <p>M-Pesa: {payer.mpesa_number}</p>}
                            {payer.standing_order_ref && <p>Standing order: {payer.standing_order_ref}</p>}
                            {payer.start_date && <p>From {payer.start_date}{payer.end_date ? ` to ${payer.end_date}` : ' (ongoing)'}</p>}
                          </div>
                          {payer.notes && <p className="text-xs text-muted-foreground mt-1 italic">{payer.notes}</p>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Switch
                          checked={payer.is_active}
                          onCheckedChange={v => toggleActive.mutate({ id: payer.id, active: v })}
                        />
                        <Button
                          variant="ghost" size="icon"
                          aria-label="Delete payer"
                          className="h-7 w-7 text-destructive hover:bg-destructive/10"
                          onClick={() => deletePayer.mutate(payer.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
              {payers.some(p => p.pays_percentage && p.is_active) && (
                <div className={`text-xs p-2 rounded-lg border ${totalPct === 100 ? 'border-green-300 bg-green-50 text-green-800' : 'border-amber-300 bg-amber-50 text-amber-800'}`}>
                  {totalPct === 100
                    ? '✓ Split adds up to 100% — rent fully covered'
                    : `⚠ Split adds up to ${totalPct}% — ${totalPct < 100 ? `${100 - totalPct}% uncovered` : `${totalPct - 100}% over-assigned`}`
                  }
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add payer dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add payment arrangement</DialogTitle>
            <DialogDescription>Configure who pays rent for {tenantName}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Payer type */}
            <div>
              <Label>Arrangement type</Label>
              <div className="grid grid-cols-2 gap-2 mt-1">
                {PAYER_TYPES.filter(t => t.value !== 'self').map(t => (
                  <button
                    key={t.value} type="button"
                    onClick={() => setForm(p => ({ ...p, payer_type: t.value }))}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-left text-xs transition-colors ${
                      form.payer_type === t.value
                        ? 'border-amber-400/50 bg-amber-400/8 text-warning'
                        : 'border-border hover:border-amber-400/40 text-muted-foreground'
                    }`}
                  >
                    <t.icon className="h-3.5 w-3.5 shrink-0" />
                    <span className="font-medium">{t.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Payer identity */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Payer name</Label>
                <Input value={form.payer_name} onChange={f('payer_name')} placeholder="Full name" className="mt-1" />
              </div>
              <div>
                <Label>Organisation / company</Label>
                <Input value={form.payer_organisation} onChange={f('payer_organisation')} placeholder="Company name" className="mt-1" />
              </div>
              <div>
                <Label>Phone</Label>
                <Input value={form.payer_phone} onChange={f('payer_phone')} placeholder="0712345678" className="mt-1" />
              </div>
              <div>
                <Label>Email</Label>
                <Input type="email" value={form.payer_email} onChange={f('payer_email')} placeholder="payer@company.com" className="mt-1" />
              </div>
            </div>

            {/* Coverage */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Amount they pay (KES)</Label>
                <Input type="number" value={form.pays_amount} onChange={f('pays_amount')} placeholder={monthlyRent ? String(monthlyRent) : 'Full rent'} className="mt-1" />
                <p className="text-xs text-muted-foreground mt-0.5">Leave blank = full rent</p>
              </div>
              <div>
                <Label>Or percentage (%)</Label>
                <Input type="number" min="1" max="100" value={form.pays_percentage} onChange={f('pays_percentage')} placeholder="e.g. 50" className="mt-1" />
              </div>
            </div>

            {/* Payment method */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Preferred payment method</Label>
                <Select value={form.preferred_method} onValueChange={v => setForm(p => ({ ...p, preferred_method: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {METHODS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Payment day of month</Label>
                <Input type="number" min="1" max="31" value={form.payment_day} onChange={f('payment_day')} placeholder="e.g. 1" className="mt-1" />
              </div>
            </div>

            {form.preferred_method === 'mpesa' && (
              <div>
                <Label>M-Pesa number</Label>
                <Input value={form.mpesa_number} onChange={f('mpesa_number')} placeholder="2547XXXXXXXX" className="mt-1" />
              </div>
            )}
            {form.preferred_method === 'bank' && (
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Bank name</Label><Input value={form.bank_name} onChange={f('bank_name')} className="mt-1" /></div>
                <div><Label>Account number</Label><Input value={form.bank_account} onChange={f('bank_account')} className="mt-1" /></div>
              </div>
            )}
            {form.preferred_method === 'standing_order' && (
              <div>
                <Label>Standing order reference</Label>
                <Input value={form.standing_order_ref} onChange={f('standing_order_ref')} placeholder="Bank SO reference" className="mt-1" />
              </div>
            )}

            {/* Dates */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Arrangement start date</Label>
                <Input type="date" value={form.start_date} onChange={f('start_date')} className="mt-1" />
              </div>
              <div>
                <Label>End date (blank = ongoing)</Label>
                <Input type="date" value={form.end_date} onChange={f('end_date')} className="mt-1" />
              </div>
            </div>

            <div>
              <Label>Notes</Label>
              <Input value={form.notes} onChange={f('notes')} placeholder="Any additional notes" className="mt-1" />
            </div>

            <div className="flex items-start gap-2 p-3 rounded-lg bg-[hsl(214_73%_48%/0.06)] border border-[hsl(214_73%_48%/0.25)] text-xs text-[hsl(214_73%_35%)]">
              <Info className="h-4 w-4 shrink-0 mt-0.5" />
              <span>When recording payments, you can specify which payer made the payment. Receipts will show the payer's name and organisation, not just the tenant's name.</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => addPayer.mutate()} disabled={addPayer.isPending}>
              {addPayer.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Save arrangement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PaymentPayersManager;
