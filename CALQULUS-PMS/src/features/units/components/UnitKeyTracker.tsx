import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/features/auth/AuthContext';
import { useToast } from '@/shared/hooks/use-toast';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Badge } from '@/shared/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { Switch } from '@/shared/components/ui/switch';
import { Key, Plus, CheckCircle, AlertTriangle, Loader2, RotateCcw } from 'lucide-react';
import { format } from 'date-fns';
import { errorToast } from "@/shared/lib/errorToast";

interface UnitKeyTrackerProps {
  unitId: string;
  unitLabel: string;
  propertyId: string;
  currentTenantId?: string | null;
  currentTenantName?: string | null;
}

const KEY_TYPES = [
  { value: 'door_key',   label: 'Door key' },
  { value: 'gate_key',   label: 'Gate key' },
  { value: 'mailbox_key',label: 'Mailbox key' },
  { value: 'fob',        label: 'Key fob' },
  { value: 'card',       label: 'Access card' },
  { value: 'master_key', label: 'Master key' },
  { value: 'spare_key',  label: 'Spare key' },
];

const STATUS_COLORS: Record<string, string> = {
  active:   'bg-green-100 text-green-800 border-green-200',
  returned: 'bg-slate-100 text-slate-700 border-slate-200',
  lost:     'bg-red-100 text-red-800 border-red-200',
  replaced: 'bg-amber-100 text-amber-800 border-amber-200',
};

const emptyForm = () => ({
  key_type: 'door_key', key_label: '', serial_number: '',
  issued_date: new Date().toISOString().slice(0, 10),
  issued_to_name: '', notes: '',
});

const UnitKeyTracker: React.FC<UnitKeyTrackerProps> = ({
  unitId, unitLabel, propertyId, currentTenantId, currentTenantName,
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [returnOpen, setReturnOpen] = useState<any | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [returnForm, setReturnForm] = useState({ returned_date: new Date().toISOString().slice(0, 10), return_condition: 'good', replacement_cost: '', deducted_from_deposit: false });

  const { data: keys = [], isLoading } = useQuery({
    queryKey: ['unit-keys', unitId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('unit_key_records')
        .select('*')
        .eq('unit_id', unitId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const issueKey = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('issue_unit_key_atomic' as never, {
        p_unit_id: unitId, p_key_type: form.key_type, p_key_label: form.key_label || null,
        p_serial_number: form.serial_number || null, p_issued_date: form.issued_date,
        p_issued_to_name: form.issued_to_name || currentTenantName || null,
        p_tenant_id: currentTenantId ?? null, p_notes: form.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['unit-keys', unitId] });
      queryClient.invalidateQueries({ queryKey: ['unit-activity-log', unitId] });
      toast({ title: 'Key issued' });
      setAddOpen(false);
      setForm(emptyForm());
    },
    onError: (err: Error) => errorToast('Failed', err),
  });

  const returnKey = useMutation({
    mutationFn: async () => {
      if (!returnOpen) return;
      const isLost = returnForm.return_condition === 'lost';
      const { error } = await supabase.rpc('return_unit_key_atomic' as never, {
        p_key_id: returnOpen.id,
        p_returned_date: returnForm.returned_date,
        p_return_condition: returnForm.return_condition,
        p_replacement_cost: returnForm.replacement_cost ? Number(returnForm.replacement_cost) : null,
        p_deducted_from_deposit: returnForm.deducted_from_deposit,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['unit-keys', unitId] });
      toast({ title: 'Key return recorded' });
      setReturnOpen(null);
    },
    onError: (err: Error) => errorToast('Failed', err),
  });

  const activeKeys = keys.filter(k => k.status === 'active');
  const historicKeys = keys.filter(k => k.status !== 'active');

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Key className="h-4 w-4" />
              Key / access tracking — {unitLabel}
            </CardTitle>
            <CardDescription>
              All keys, fobs and cards issued for this unit
            </CardDescription>
          </div>
          <div className="flex items-center gap-3">
            {activeKeys.length > 0 && (
              <Badge variant="outline" className="border-green-300 text-green-700 bg-green-50">
                {activeKeys.length} active
              </Badge>
            )}
            <Button size="sm" onClick={() => setAddOpen(true)}>
              <Plus className="h-4 w-4 mr-1.5" />
              Issue key
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : keys.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              <Key className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No keys on record for this unit</p>
            </div>
          ) : (
            <div className="space-y-2">
              {keys.map(k => (
                <div key={k.id} className={`rounded-lg border p-3 flex items-center justify-between gap-3 ${k.status !== 'active' ? 'opacity-60' : ''}`}>
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${STATUS_COLORS[k.status]?.split(' ')[0] || 'bg-muted'}`}>
                      <Key className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">{k.key_label || KEY_TYPES.find(t => t.value === k.key_type)?.label}</p>
                        <Badge variant="outline" className={`text-xs ${STATUS_COLORS[k.status]}`}>{k.status}</Badge>
                        {k.return_condition === 'lost' && <AlertTriangle className="h-3.5 w-3.5 text-red-600" />}
                      </div>
                      <div className="text-xs text-muted-foreground space-y-0.5 mt-0.5">
                        <p>Issued to: {k.issued_to_name || '—'} · {k.issued_date ? format(new Date(k.issued_date), 'dd/MM/yy') : '—'}</p>
                        {k.serial_number && <p>Serial: {k.serial_number}</p>}
                        {k.status === 'returned' && <p className="text-green-700">Returned: {k.returned_date ? format(new Date(k.returned_date), 'dd/MM/yy') : '—'} · {k.return_condition}</p>}
                        {k.status === 'lost' && <p className="text-red-600">Lost · Replacement: {k.replacement_cost ? `KES ${Number(k.replacement_cost).toLocaleString()}` : 'TBD'}{k.deducted_from_deposit ? ' (deducted from deposit)' : ''}</p>}
                      </div>
                    </div>
                  </div>
                  {k.status === 'active' && (
                    <Button
                      variant="outline" size="sm"
                      onClick={() => {
                        setReturnOpen(k);
                        setReturnForm({ returned_date: new Date().toISOString().slice(0, 10), return_condition: 'good', replacement_cost: '', deducted_from_deposit: false });
                      }}
                    >
                      <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                      Return
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Issue key dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Issue key / access — {unitLabel}</DialogTitle>
            <DialogDescription>Record a key, fob or card issued for this unit</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Type</Label>
                <Select value={form.key_type} onValueChange={v => setForm(p => ({ ...p, key_type: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{KEY_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Label / number</Label>
                <Input value={form.key_label} onChange={e => setForm(p => ({ ...p, key_label: e.target.value }))} placeholder="e.g. Key #2" className="mt-1" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Serial number (optional)</Label>
                <Input value={form.serial_number} onChange={e => setForm(p => ({ ...p, serial_number: e.target.value }))} className="mt-1" />
              </div>
              <div>
                <Label>Date issued</Label>
                <Input type="date" value={form.issued_date} onChange={e => setForm(p => ({ ...p, issued_date: e.target.value }))} className="mt-1" />
              </div>
            </div>
            <div>
              <Label>Issued to (name)</Label>
              <Input value={form.issued_to_name} onChange={e => setForm(p => ({ ...p, issued_to_name: e.target.value }))} placeholder={currentTenantName || 'Name of recipient'} className="mt-1" />
            </div>
            <div>
              <Label>Notes</Label>
              <Input value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} className="mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={() => issueKey.mutate()} disabled={issueKey.isPending}>
              {issueKey.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Key className="h-4 w-4 mr-2" />}
              Issue key
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Return key dialog */}
      <Dialog open={!!returnOpen} onOpenChange={open => !open && setReturnOpen(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Record key return</DialogTitle>
            <DialogDescription>{returnOpen?.key_label || returnOpen?.key_type} — issued to {returnOpen?.issued_to_name}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Return date</Label>
              <Input type="date" value={returnForm.returned_date} onChange={e => setReturnForm(p => ({ ...p, returned_date: e.target.value }))} className="mt-1" />
            </div>
            <div>
              <Label>Condition on return</Label>
              <Select value={returnForm.return_condition} onValueChange={v => setReturnForm(p => ({ ...p, return_condition: v }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="good">Good — no damage</SelectItem>
                  <SelectItem value="damaged">Damaged</SelectItem>
                  <SelectItem value="lost">Lost / not returned</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {(returnForm.return_condition === 'damaged' || returnForm.return_condition === 'lost') && (
              <>
                <div>
                  <Label>Replacement / repair cost (KES)</Label>
                  <Input type="number" value={returnForm.replacement_cost} onChange={e => setReturnForm(p => ({ ...p, replacement_cost: e.target.value }))} placeholder="0" className="mt-1" />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Deduct from deposit</Label>
                  <Switch checked={returnForm.deducted_from_deposit} onCheckedChange={v => setReturnForm(p => ({ ...p, deducted_from_deposit: v }))} />
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReturnOpen(null)}>Cancel</Button>
            <Button onClick={() => returnKey.mutate()} disabled={returnKey.isPending}>
              {returnKey.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle className="h-4 w-4 mr-2" />}
              Record return
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UnitKeyTracker;
