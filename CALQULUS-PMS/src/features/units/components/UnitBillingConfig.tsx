import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/features/auth/AuthContext';
import { useToast } from '@/shared/hooks/use-toast';
import { useCurrency } from '@/shared/hooks/useCurrency';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Badge } from '@/shared/components/ui/badge';
import { Switch } from '@/shared/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { errorToast } from "@/shared/lib/errorToast";
import {
  Plus, Pencil, Trash2, Droplets, Shield, Trash, Wifi,
  Car, Zap, Home, Settings2, CheckCircle, Loader2
} from 'lucide-react';

const CHARGE_TYPES = [
  { value: 'rent',           label: 'Monthly Rent',       icon: Home,     color: 'text-[hsl(214_73%_45%)]' },
  { value: 'water',          label: 'Water',               icon: Droplets, color: 'text-[hsl(195_60%_38%)]' },
  { value: 'garbage',        label: 'Garbage Collection',  icon: Trash,    color: 'text-orange-600' },
  { value: 'security',       label: 'Security Levy',       icon: Shield,   color: 'text-green-600' },
  { value: 'service_charge', label: 'Service Charge',      icon: Settings2, color: 'text-[hsl(218_58%_38%)]' },
  { value: 'caretaker',      label: 'Caretaker Fee',       icon: Home,     color: 'text-warning' },
  { value: 'wifi',           label: 'Internet / WiFi',     icon: Wifi,     color: 'text-[hsl(38_52%_42%)]' },
  { value: 'parking',        label: 'Parking',             icon: Car,      color: 'text-slate-600' },
  { value: 'electricity',    label: 'Electricity',         icon: Zap,      color: 'text-yellow-600' },
  { value: 'custom',         label: 'Custom Charge',       icon: Plus,     color: 'text-gray-600' },
];

const BILLING_CYCLES = [
  { value: 'monthly',    label: 'Monthly' },
  { value: 'quarterly',  label: 'Quarterly' },
  { value: 'annual',     label: 'Annual' },
  { value: 'once_off',   label: 'Once-off' },
  { value: 'on_demand',  label: 'On demand' },
];

interface ChargeConfig {
  id: string;
  unit_id: string;
  charge_type: string;
  charge_label: string;
  amount: number;
  is_active: boolean;
  is_metered: boolean;
  billing_cycle: string;
  auto_generate: boolean;
  notes: string | null;
}

interface UnitBillingConfigProps {
  unitId: string;
  unitLabel: string;  // e.g. "R1" or "Unit A"
  propertyId: string;
  monthlyRent?: number;
}

const emptyForm = () => ({
  charge_type: 'water',
  charge_label: '',
  amount: '',
  is_metered: false,
  billing_cycle: 'monthly',
  auto_generate: true,
  notes: '',
});

const UnitBillingConfig: React.FC<UnitBillingConfigProps> = ({
  unitId, unitLabel, propertyId, monthlyRent
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { formatCurrency } = useCurrency();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ChargeConfig | null>(null);
  const [form, setForm] = useState(emptyForm());

  const { data: charges = [], isLoading } = useQuery({
    queryKey: ['unit-charge-configs', unitId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('unit_charge_configs')
        .select('*')
        .eq('unit_id', unitId)
        .order('charge_type');
      if (error) throw error;
      return (data || []) as ChargeConfig[];
    },
    enabled: !!unitId,
  });

  const openAdd = () => {
    setEditTarget(null);
    setForm(emptyForm());
    setDialogOpen(true);
  };

  const openEdit = (c: ChargeConfig) => {
    setEditTarget(c);
    setForm({
      charge_type: c.charge_type,
      charge_label: c.charge_label,
      amount: String(c.amount),
      is_metered: c.is_metered,
      billing_cycle: c.billing_cycle,
      auto_generate: c.auto_generate,
      notes: c.notes || '',
    });
    setDialogOpen(true);
  };

  // Auto-fill label when charge type changes
  const handleTypeChange = (type: string) => {
    const found = CHARGE_TYPES.find(t => t.value === type);
    setForm(f => ({
      ...f,
      charge_type: type,
      charge_label: found && type !== 'custom' ? found.label : f.charge_label,
      is_metered: type === 'water' || type === 'electricity',
    }));
  };

  const saveCharge = useMutation({
    mutationFn: async () => {
      const payload = {
        unit_id:      unitId,
        property_id:  propertyId,
        manager_id:   user!.id,
        charge_type:  form.charge_type,
        charge_label: form.charge_label || CHARGE_TYPES.find(t => t.value === form.charge_type)?.label || form.charge_type,
        amount:       parseFloat(form.amount) || 0,
        is_metered:   form.is_metered,
        billing_cycle: form.billing_cycle,
        auto_generate: form.auto_generate,
        notes:         form.notes || null,
        is_active:     true,
      };
      const { error } = await supabase.rpc('save_unit_charge_config_atomic', {
        p_unit_id: unitId, p_charge_type: payload.charge_type, p_charge_label: payload.charge_label,
        p_amount: payload.amount, p_is_metered: payload.is_metered, p_billing_cycle: payload.billing_cycle,
        p_auto_generate: payload.auto_generate, p_notes: payload.notes, p_charge_id: editTarget?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['unit-charge-configs', unitId] });
      toast({ title: editTarget ? 'Charge updated' : 'Charge added' });
      setDialogOpen(false);
    },
    onError: (err: Error) => errorToast('Failed', err),
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.rpc('transition_unit_charge_config_atomic', { p_charge_id: id, p_is_active: active });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['unit-charge-configs', unitId] }),
  });

  const deleteCharge = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('delete_unit_charge_config_atomic', { p_charge_id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['unit-charge-configs', unitId] });
      toast({ title: 'Charge removed' });
    },
    onError: (err: Error) => errorToast('Failed', err),
  });

  const totalMonthly = charges
    .filter(c => c.is_active && c.billing_cycle === 'monthly' && !c.is_metered)
    .reduce((s, c) => s + Number(c.amount), 0);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-sm font-medium">
              Charge configuration — {unitLabel}
            </CardTitle>
            <CardDescription>
              Define all charges for this unit. These are used for auto invoice generation.
            </CardDescription>
          </div>
          <div className="flex items-center gap-3">
            {totalMonthly > 0 && (
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Monthly total</p>
                <p className="text-sm font-semibold">{formatCurrency(totalMonthly)}</p>
              </div>
            )}
            <Button size="sm" onClick={openAdd}>
              <Plus className="h-4 w-4 mr-1.5" />
              Add charge
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : charges.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              <Home className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No charges configured</p>
              <p className="text-xs mt-1 opacity-70">Add rent, water, garbage and other charges for this unit</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Charge</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Cycle</TableHead>
                  <TableHead>Auto</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead className="w-16" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {charges.map(c => {
                  const ct = CHARGE_TYPES.find(t => t.value === c.charge_type);
                  const Icon = ct?.icon ?? Home;
                  return (
                    <TableRow key={c.id} className={!c.is_active ? 'opacity-50' : ''}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Icon className={`h-4 w-4 ${ct?.color ?? 'text-muted-foreground'}`} />
                          <div>
                            <p className="text-sm font-medium">{c.charge_label}</p>
                            {c.is_metered && (
                              <span className="text-xs text-[hsl(195_60%_38%)]">Metered</span>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">
                        {c.is_metered ? <span className="text-muted-foreground text-xs">Per reading</span> : formatCurrency(c.amount)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs capitalize">
                          {c.billing_cycle.replace('_', ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {c.auto_generate
                          ? <CheckCircle className="h-4 w-4 text-green-600" />
                          : <span className="text-xs text-muted-foreground">Manual</span>
                        }
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={c.is_active}
                          onCheckedChange={v => toggleActive.mutate({ id: c.id, active: v })}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(c)} aria-label="Edit charge">
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost" size="icon"
                            className="h-7 w-7 text-destructive hover:bg-destructive/10"
                            aria-label="Delete charge"
                            onClick={() => deleteCharge.mutate(c.id)}
                            disabled={deleteCharge.isPending}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit charge dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editTarget ? 'Edit charge' : 'Add charge'} — {unitLabel}</DialogTitle>
            <DialogDescription>
              Configure a recurring charge for this unit.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Charge type</Label>
              <Select value={form.charge_type} onValueChange={handleTypeChange}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CHARGE_TYPES.map(t => (
                    <SelectItem key={t.value} value={t.value}>
                      <div className="flex items-center gap-2">
                        <t.icon className={`h-4 w-4 ${t.color}`} />
                        {t.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Display label on invoice</Label>
              <Input
                value={form.charge_label}
                onChange={e => setForm(f => ({ ...f, charge_label: e.target.value }))}
                placeholder="e.g. Water Bill, Garbage Collection"
                className="mt-1"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Amount (KES)</Label>
                <Input
                  type="number"
                  min="0"
                  step="50"
                  value={form.amount}
                  onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                  placeholder="0"
                  className="mt-1"
                  disabled={form.is_metered}
                />
                {form.is_metered && (
                  <p className="text-xs text-muted-foreground mt-1">Computed from meter reading</p>
                )}
              </div>
              <div>
                <Label>Billing cycle</Label>
                <Select value={form.billing_cycle} onValueChange={v => setForm(f => ({ ...f, billing_cycle: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {BILLING_CYCLES.map(b => <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center justify-between py-1">
              <div>
                <Label className="text-sm">Metered charge</Label>
                <p className="text-xs text-muted-foreground">Amount computed from meter reading (e.g. water, electricity)</p>
              </div>
              <Switch
                checked={form.is_metered}
                onCheckedChange={v => setForm(f => ({ ...f, is_metered: v }))}
              />
            </div>

            <div className="flex items-center justify-between py-1">
              <div>
                <Label className="text-sm">Auto-include in invoices</Label>
                <p className="text-xs text-muted-foreground">Add this charge automatically when generating monthly invoices</p>
              </div>
              <Switch
                checked={form.auto_generate}
                onCheckedChange={v => setForm(f => ({ ...f, auto_generate: v }))}
              />
            </div>

            <div>
              <Label>Notes (optional)</Label>
              <Input
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Any notes about this charge"
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => saveCharge.mutate()} disabled={saveCharge.isPending}>
              {saveCharge.isPending
                ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Saving…</>
                : editTarget ? 'Update charge' : 'Add charge'
              }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UnitBillingConfig;
