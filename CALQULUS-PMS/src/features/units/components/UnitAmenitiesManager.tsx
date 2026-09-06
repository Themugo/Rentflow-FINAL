import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/features/auth/AuthContext';
import { useToast } from '@/shared/hooks/use-toast';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import { Input } from '@/shared/components/ui/input';
import { Switch } from '@/shared/components/ui/switch';
import { Skeleton } from '@/shared/components/ui/skeleton';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/shared/components/ui/select';
import { Plus, Trash2, X } from 'lucide-react';
import { errorToast } from "@/shared/lib/errorToast";

interface UnitAmenity {
  id: string;
  unit_id: string;
  amenity_type: string;
  amenity_label: string;
  is_included: boolean;
  extra_charge: number | null;
  notes: string | null;
}

const AMENITY_TYPES: { value: string; label: string }[] = [
  { value: 'parking', label: 'Parking' },
  { value: 'wifi', label: 'Wi-Fi' },
  { value: 'water_included', label: 'Water included' },
  { value: 'electricity_included', label: 'Electricity included' },
  { value: 'security_guard', label: 'Security guard' },
  { value: 'garden', label: 'Garden' },
  { value: 'swimming_pool', label: 'Swimming pool' },
  { value: 'gym', label: 'Gym' },
  { value: 'laundry', label: 'Laundry' },
  { value: 'backup_generator', label: 'Backup generator' },
  { value: 'cctv', label: 'CCTV' },
  { value: 'balcony', label: 'Balcony' },
  { value: 'furnished', label: 'Furnished' },
  { value: 'semi_furnished', label: 'Semi-furnished' },
  { value: 'air_conditioning', label: 'Air conditioning' },
  { value: 'elevator', label: 'Elevator' },
  { value: 'borehole', label: 'Borehole' },
  { value: 'solar_water', label: 'Solar water heating' },
  { value: 'gas_cooking', label: 'Gas cooking' },
  { value: 'dsb_tv', label: 'DSTV-ready' },
  { value: 'custom', label: 'Custom…' },
];

const fmt = (n: number) =>
  new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 0 }).format(n);

interface UnitAmenitiesManagerProps {
  unitId: string;
  propertyId: string;
  unitLabel?: string;
}

export default function UnitAmenitiesManager({ unitId, propertyId, unitLabel }: UnitAmenitiesManagerProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [isAdding, setIsAdding] = useState(false);
  const [newType, setNewType] = useState('parking');
  const [customLabel, setCustomLabel] = useState('');
  const [included, setIncluded] = useState(true);
  const [extraCharge, setExtraCharge] = useState('');

  const queryKey = ['unit-amenities', unitId];

  const { data: amenities, isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await (supabase.from('unit_amenities') as any)
        .select('*')
        .eq('unit_id', unitId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data || []) as UnitAmenity[];
    },
  });

  const usedTypes = new Set((amenities || []).map((a) => a.amenity_type));
  const availableTypes = AMENITY_TYPES.filter((t) => t.value === 'custom' || !usedTypes.has(t.value));

  const addAmenity = useMutation({
    mutationFn: async () => {
      const label = newType === 'custom'
        ? customLabel.trim()
        : AMENITY_TYPES.find((t) => t.value === newType)?.label ?? newType;
      if (!label) throw new Error('Give this amenity a name');
      const { error } = await supabase.rpc('save_unit_amenity_atomic' as never, {
        p_amenity_id: null, p_unit_id: unitId, p_amenity_type: newType, p_amenity_label: label,
        p_is_included: included, p_extra_charge: included ? 0 : (Number(extraCharge) || 0),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast({ title: 'Amenity added' });
      setIsAdding(false);
      setNewType('parking');
      setCustomLabel('');
      setIncluded(true);
      setExtraCharge('');
    },
    onError: (err: Error) => errorToast('Failed to add amenity', err),
  });

  const removeAmenity = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('delete_unit_amenity_atomic' as never, { p_amenity_id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast({ title: 'Amenity removed' });
    },
    onError: (err: Error) => errorToast('Failed to remove amenity', err),
  });

  const totalExtra = (amenities || []).reduce((sum, a) => sum + (a.is_included ? 0 : Number(a.extra_charge || 0)), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold">
          Amenities{unitLabel ? ` — ${unitLabel}` : ''}
        </h4>
        {!isAdding && availableTypes.length > 0 && (
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setIsAdding(true)}>
            <Plus className="h-3.5 w-3.5" /> Add amenity
          </Button>
        )}
      </div>

      {isAdding && (
        <div className="rounded-lg border p-3 space-y-3 bg-muted/20">
          <div className="flex items-center justify-between gap-2">
            <Select value={newType} onValueChange={setNewType}>
              <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {availableTypes.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => setIsAdding(false)} aria-label="Cancel">
              <X className="h-4 w-4" />
            </Button>
          </div>

          {newType === 'custom' && (
            <Input placeholder="Amenity name" value={customLabel} onChange={(e) => setCustomLabel(e.target.value)} />
          )}

          <div className="flex items-center justify-between rounded-lg border px-3 py-2">
            <div>
              <p className="text-sm font-medium">Included in rent</p>
              <p className="text-xs text-muted-foreground">Off means it's billed as an extra monthly charge</p>
            </div>
            <Switch checked={included} onCheckedChange={setIncluded} />
          </div>

          {!included && (
            <div>
              <p className="text-xs text-muted-foreground mb-1">Monthly charge (KES)</p>
              <Input type="number" min="0" value={extraCharge} onChange={(e) => setExtraCharge(e.target.value)} />
            </div>
          )}

          <Button size="sm" className="w-full" disabled={addAmenity.isPending} onClick={() => addAmenity.mutate()}>
            {addAmenity.isPending ? 'Adding…' : 'Add amenity'}
          </Button>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
        </div>
      ) : !amenities || amenities.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">No amenities added for this unit yet.</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {amenities.map((a) => (
              <div key={a.id} className="group flex items-center gap-1.5 rounded-full border pl-3 pr-1.5 py-1 bg-card">
                <span className="text-sm">{a.amenity_label}</span>
                {a.is_included ? (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-success/20 text-success bg-success/10">
                    Included
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-amber-300 text-warning bg-amber-50">
                    +{fmt(Number(a.extra_charge || 0))}/mo
                  </Badge>
                )}
                <Button
                  size="icon" variant="ghost"
                  className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => removeAmenity.mutate(a.id)}
                  aria-label={`Remove ${a.amenity_label}`}
                >
                  <Trash2 className="h-3 w-3 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
          {totalExtra > 0 && (
            <p className="text-xs text-muted-foreground">
              Extra amenity charges add {fmt(totalExtra)}/month on top of rent.
            </p>
          )}
        </>
      )}
    </div>
  );
}
