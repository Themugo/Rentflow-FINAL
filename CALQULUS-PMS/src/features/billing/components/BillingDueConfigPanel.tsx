import React, { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarClock, Save } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Button } from '@/shared/components/ui/button';
import { useToast } from '@/shared/hooks/use-toast';

interface Props { scope: 'manager' | 'landlord' | 'tenancy'; scopeId: string; propertyId?: string | null; title?: string; compact?: boolean; }

export function BillingDueConfigPanel({ scope, scopeId, propertyId = null, title = 'Due & overdue rules', compact = false }: Props) {
  const { toast } = useToast(); const qc = useQueryClient();
  const [form, setForm] = useState({ due: '1', overdue: '0', reminder: '3', repeat: '3' });
  const { data } = useQuery({ queryKey: ['billing-due-config', scope, scopeId, propertyId], queryFn: async () => {
    let q = supabase.from('billing_due_configurations').select('*').eq('is_active', true);
    if (scope === 'tenancy') q = q.eq('lease_id', scopeId); else if (scope === 'landlord') q = q.eq('landlord_user_id', scopeId).eq('property_id', propertyId); else q = q.eq('manager_user_id', scopeId).eq('property_id', propertyId);
    const { data, error } = await q.maybeSingle(); if (error && error.code !== 'PGRST116') throw error; return data as any;
  }, enabled: !!scopeId && (scope !== 'landlord' || !!propertyId) });
  useEffect(() => { if (data) setForm({ due: String(data.due_day_of_month ?? 1), overdue: String(data.overdue_after_days ?? 0), reminder: String(data.reminder_before_days ?? 3), repeat: String(data.overdue_reminder_interval_days ?? 3) }); }, [data]);
  const save = useMutation({ mutationFn: async () => {
    const { error } = await supabase.rpc('save_billing_due_configuration_atomic' as any, { p_id: data?.id ?? null, p_scope_type: scope, p_scope_id: scopeId, p_property_id: propertyId, p_payload: { due_day_of_month: Number(form.due), overdue_after_days: Number(form.overdue), reminder_before_days: Number(form.reminder), overdue_reminder_interval_days: Number(form.repeat), is_active: true } });
    if (error) throw error;
  }, onSuccess: () => { qc.invalidateQueries({ queryKey: ['billing-due-config', scope, scopeId, propertyId] }); toast({ title: 'Billing rules saved' }); }, onError: (e: Error) => toast({ title: 'Could not save billing rules', description: e.message, variant: 'destructive' }) });
  return <Card className={compact ? 'border-border' : undefined}>
    <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><CalendarClock className="h-4 w-4" />{title}</CardTitle><CardDescription className="text-xs">Configure when bills become due, when they turn overdue, and when tenants are reminded.</CardDescription></CardHeader>
    <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <div><Label className="text-xs">Due day</Label><Input type="number" min="1" max="28" value={form.due} onChange={e => setForm(f => ({ ...f, due: e.target.value }))} /></div>
      <div><Label className="text-xs">Overdue after</Label><Input type="number" min="0" max="90" value={form.overdue} onChange={e => setForm(f => ({ ...f, overdue: e.target.value }))} /><p className="text-[11px] text-muted-foreground">days after due</p></div>
      <div><Label className="text-xs">Reminder before</Label><Input type="number" min="0" max="30" value={form.reminder} onChange={e => setForm(f => ({ ...f, reminder: e.target.value }))} /><p className="text-[11px] text-muted-foreground">days before due</p></div>
      <div><Label className="text-xs">Overdue reminder</Label><Input type="number" min="1" max="30" value={form.repeat} onChange={e => setForm(f => ({ ...f, repeat: e.target.value }))} /><p className="text-[11px] text-muted-foreground">repeat every N days</p></div>
      <div className="col-span-full flex justify-end"><Button size="sm" onClick={() => save.mutate()} disabled={save.isPending}><Save className="h-4 w-4 mr-2" />{save.isPending ? 'Saving…' : 'Save rules'}</Button></div>
    </CardContent>
  </Card>;
}
