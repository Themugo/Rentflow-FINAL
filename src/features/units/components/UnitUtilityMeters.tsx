import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/features/auth/AuthContext';
import { useToast } from '@/shared/hooks/use-toast';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Switch } from '@/shared/components/ui/switch';
import { Skeleton } from '@/shared/components/ui/skeleton';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/shared/components/ui/select';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/shared/components/ui/dialog';
import { Zap, Droplets, Flame, Wifi, Plus, Gauge, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { errorToast } from "@/shared/lib/errorToast";

interface UtilityMeter {
  id: string;
  unit_id: string;
  utility_type: string;
  meter_number: string;
  meter_label: string | null;
  provider: string | null;
  account_number: string | null;
  billing_method: string;
  rate_per_unit: number | null;
  current_reading: number;
  last_read_date: string | null;
  is_active: boolean;
}

const UTILITY_TYPES = [
  { value: 'water', label: 'Water', icon: Droplets, color: 'text-[hsl(195_60%_42%)]' },
  { value: 'electricity', label: 'Electricity', icon: Zap, color: 'text-warning' },
  { value: 'gas', label: 'Gas', icon: Flame, color: 'text-orange-500' },
  { value: 'internet', label: 'Internet', icon: Wifi, color: 'text-[hsl(38_52%_42%)]' },
];

const BILLING_METHODS = [
  { value: 'prepaid', label: 'Prepaid' },
  { value: 'postpaid', label: 'Postpaid' },
  { value: 'flat_rate', label: 'Flat rate' },
];

const emptyForm = {
  utility_type: 'electricity', meter_number: '', meter_label: '', provider: '',
  account_number: '', billing_method: 'postpaid', rate_per_unit: '',
};

interface UnitUtilityMetersProps {
  unitId: string;
  propertyId: string;
  unitLabel?: string;
}

export default function UnitUtilityMeters({ unitId, propertyId, unitLabel }: UnitUtilityMetersProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [readingMeter, setReadingMeter] = useState<UtilityMeter | null>(null);
  const [newReading, setNewReading] = useState('');

  const queryKey = ['unit-utility-meters', unitId];

  const { data: meters, isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await (supabase.from('unit_utility_meters') as any)
        .select('*')
        .eq('unit_id', unitId)
        .order('utility_type', { ascending: true });
      if (error) throw error;
      return (data || []) as UtilityMeter[];
    },
  });

  const usedTypes = new Set((meters || []).map((m) => m.utility_type));

  const addMeter = useMutation({
    mutationFn: async () => {
      if (!form.meter_number.trim()) throw new Error('Meter number is required');
      const { error } = await supabase.rpc('save_unit_utility_meter_atomic' as never, {
        p_meter_id: null, p_unit_id: unitId, p_utility_type: form.utility_type,
        p_meter_number: form.meter_number.trim(), p_meter_label: form.meter_label.trim() || null,
        p_provider: form.provider.trim() || null, p_account_number: form.account_number.trim() || null,
        p_billing_method: form.billing_method, p_rate_per_unit: form.rate_per_unit ? Number(form.rate_per_unit) : null, p_is_active: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast({ title: 'Meter added' });
      setAddOpen(false);
      setForm(emptyForm);
    },
    onError: (err: Error) => errorToast('Failed to add meter', err),
  });

  const recordReading = useMutation({
    mutationFn: async () => {
      if (!readingMeter) return;
      const reading = Number(newReading);
      if (!newReading || isNaN(reading)) throw new Error('Enter a valid reading');
      const { error } = await supabase.rpc('record_unit_utility_meter_reading_atomic' as never, {
        p_meter_id: readingMeter.id, p_reading: reading, p_read_date: new Date().toISOString().slice(0, 10),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast({ title: 'Reading recorded' });
      setReadingMeter(null);
      setNewReading('');
    },
    onError: (err: Error) => errorToast('Failed to record reading', err),
  });

  const toggleActive = useMutation({
    mutationFn: async (meter: UtilityMeter) => {
      const { error } = await supabase.rpc('set_unit_utility_meter_active_atomic' as never, {
        p_meter_id: meter.id, p_is_active: !meter.is_active,
      });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const removeMeter = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('delete_unit_utility_meter_atomic' as never, { p_meter_id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast({ title: 'Meter removed' });
    },
    onError: (err: Error) => errorToast('Failed to remove meter', err),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold">
          Utility meters{unitLabel ? ` — ${unitLabel}` : ''}
        </h4>
        {usedTypes.size < UTILITY_TYPES.length && (
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setAddOpen(true)}>
            <Plus className="h-3.5 w-3.5" /> Add meter
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2">{[1, 2].map((i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
      ) : !meters || meters.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">No utility meters set up for this unit yet.</p>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {meters.map((meter) => {
            const cfg = UTILITY_TYPES.find((t) => t.value === meter.utility_type) ?? UTILITY_TYPES[0];
            const Icon = cfg.icon;
            return (
              <div key={meter.id} className={`rounded-lg border p-3 ${!meter.is_active ? 'opacity-50' : ''}`}>
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Icon className={`h-4 w-4 ${cfg.color}`} />
                    <div>
                      <p className="text-sm font-medium">{meter.meter_label || cfg.label}</p>
                      <p className="text-xs text-muted-foreground">{meter.meter_number}</p>
                    </div>
                  </div>
                  <Button
                    size="icon" variant="ghost" className="h-6 w-6"
                    onClick={() => removeMeter.mutate(meter.id)}
                    aria-label={`Remove ${cfg.label} meter`}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 text-xs mb-2">
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 capitalize">{meter.billing_method}</Badge>
                  {meter.provider && <Badge variant="outline" className="text-[10px] px-1.5 py-0">{meter.provider}</Badge>}
                  {!meter.is_active && <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-muted-foreground">Inactive</Badge>}
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-sm">
                    <span className="text-muted-foreground">Reading: </span>
                    <span className="font-medium">{Number(meter.current_reading).toLocaleString()}</span>
                    {meter.last_read_date && (
                      <span className="text-xs text-muted-foreground ml-1.5">
                        ({format(new Date(meter.last_read_date), 'dd MMM')})
                      </span>
                    )}
                  </div>
                  <Button
                    size="sm" variant="outline" className="h-7 gap-1"
                    onClick={() => { setReadingMeter(meter); setNewReading(String(meter.current_reading)); }}
                  >
                    <Gauge className="h-3 w-3" /> Record
                  </Button>
                </div>
                <div className="flex items-center justify-between mt-2 pt-2 border-t">
                  <span className="text-xs text-muted-foreground">Active</span>
                  <Switch checked={meter.is_active} onCheckedChange={() => toggleActive.mutate(meter)} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add meter dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Add a utility meter</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label>Utility type</Label>
              <Select value={form.utility_type} onValueChange={(v) => setForm((p) => ({ ...p, utility_type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {UTILITY_TYPES.filter((t) => !usedTypes.has(t.value)).map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Meter number <span className="text-destructive">*</span></Label>
              <Input value={form.meter_number} onChange={(e) => setForm((p) => ({ ...p, meter_number: e.target.value }))} />
            </div>
            <div>
              <Label>Label (optional)</Label>
              <Input placeholder="e.g. Main electric meter" value={form.meter_label} onChange={(e) => setForm((p) => ({ ...p, meter_label: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Provider</Label>
                <Input placeholder="e.g. Kenya Power" value={form.provider} onChange={(e) => setForm((p) => ({ ...p, provider: e.target.value }))} />
              </div>
              <div>
                <Label>Account number</Label>
                <Input value={form.account_number} onChange={(e) => setForm((p) => ({ ...p, account_number: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Billing method</Label>
                <Select value={form.billing_method} onValueChange={(v) => setForm((p) => ({ ...p, billing_method: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {BILLING_METHODS.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Rate per unit (KES)</Label>
                <Input type="number" min="0" step="0.01" value={form.rate_per_unit} onChange={(e) => setForm((p) => ({ ...p, rate_per_unit: e.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={() => addMeter.mutate()} disabled={addMeter.isPending}>
              {addMeter.isPending ? 'Adding…' : 'Add meter'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Record reading dialog */}
      <Dialog open={!!readingMeter} onOpenChange={(open) => !open && setReadingMeter(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Record meter reading</DialogTitle></DialogHeader>
          <div className="py-2">
            <Label>New reading</Label>
            <Input type="number" step="0.001" value={newReading} onChange={(e) => setNewReading(e.target.value)} autoFocus />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReadingMeter(null)}>Cancel</Button>
            <Button onClick={() => recordReading.mutate()} disabled={recordReading.isPending}>
              {recordReading.isPending ? 'Saving…' : 'Save reading'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
