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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { PawPrint, Car, Plus, Clock, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { Tables } from '@/integrations/supabase/types';
import { errorToast } from "@/shared/lib/errorToast";

const PET_TYPES = ['Dog', 'Cat', 'Bird', 'Rabbit', 'Fish', 'Reptile', 'Other'];

const STATUS_BADGE: Record<string, string> = {
  true: 'border-success/40 text-success bg-success/20',
  false: 'border-warning/40 text-warning bg-warning/20',
};

const TenantPetsVehicles: React.FC = () => {
  const { user, userRole } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const tenantId = userRole?.tenant_id;

  const [petOpen, setPetOpen] = useState(false);
  const [vehicleOpen, setVehicleOpen] = useState(false);

  const [petForm, setPetForm] = useState({ pet_type: 'Dog', breed: '', name: '', notes: '' });
  const [vehicleForm, setVehicleForm] = useState({ make: '', model: '', colour: '', plate_number: '', notes: '' });

  const { data: tenantData } = useQuery({
    queryKey: ['tenant-ids', tenantId],
    queryFn: async () => {
      if (!tenantId) return null;
      const { data } = await supabase
        .from('tenants')
        .select('id, unit_id, property_id, manager_id')
        .eq('id', tenantId)
        .maybeSingle();
      return data as Tables<'tenants'>;
    },
    enabled: !!tenantId,
  });

  const { data: pets = [], isLoading: petsLoading } = useQuery({
    queryKey: ['tenant-pets', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data } = await supabase
        .from('tenant_pets')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });
      return (data || []) as Tables<'tenant_pets'>[];
    },
    enabled: !!tenantId,
  });

  const { data: vehicles = [], isLoading: vehiclesLoading } = useQuery({
    queryKey: ['tenant-vehicles', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data } = await supabase
        .from('tenant_vehicles')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });
      return (data || []) as Tables<'tenant_vehicles'>[];
    },
    enabled: !!tenantId,
  });

  const addPet = useMutation({
    mutationFn: async () => {
      if (!petForm.pet_type) throw new Error('Select pet type');
      const { error } = await supabase.rpc('register_tenant_pet_atomic', {
        p_pet_type: petForm.pet_type, p_breed: petForm.breed || null, p_name: petForm.name || null, p_notes: petForm.notes || null,
      });
      if (error) throw error;

    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-pets'] });
      toast({ title: 'Pet registered', description: 'Awaiting manager approval.' });
      setPetOpen(false);
      setPetForm({ pet_type: 'Dog', breed: '', name: '', notes: '' });
    },
    onError: (err: Error) => errorToast('Failed', err),
  });

  const addVehicle = useMutation({
    mutationFn: async () => {
      if (!vehicleForm.plate_number.trim()) throw new Error('Plate number required');
      const { error } = await supabase.rpc('register_tenant_vehicle_atomic', {
        p_make: vehicleForm.make || null, p_model: vehicleForm.model || null, p_colour: vehicleForm.colour || null,
        p_plate_number: vehicleForm.plate_number.trim().toUpperCase(), p_notes: vehicleForm.notes || null,
      });
      if (error) throw error;

      await supabase.rpc('notify_manager_of_tenant_vehicle_request_atomic' as never, {
        p_plate_number: vehicleForm.plate_number.trim().toUpperCase(),
        p_vehicle_description: `${vehicleForm.plate_number.toUpperCase()} (${vehicleForm.colour} ${vehicleForm.make} ${vehicleForm.model})`,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-vehicles'] });
      toast({ title: 'Vehicle registered', description: 'Awaiting manager approval.' });
      setVehicleOpen(false);
      setVehicleForm({ make: '', model: '', colour: '', plate_number: '', notes: '' });
    },
    onError: (err: Error) => errorToast('Failed', err),
  });

  return (
    <div className="space-y-4">
      <Tabs defaultValue="pets">
        <TabsList>
          <TabsTrigger value="pets" className="gap-2">
            <PawPrint className="h-4 w-4" />
            Pets ({pets.length})
          </TabsTrigger>
          <TabsTrigger value="vehicles" className="gap-2">
            <Car className="h-4 w-4" />
            Vehicles ({vehicles.length})
          </TabsTrigger>
        </TabsList>

        {/* Pets */}
        <TabsContent value="pets" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="text-sm">Registered pets</CardTitle>
                <CardDescription>
                  Register pets for manager approval. Some properties require a pet deposit.
                </CardDescription>
              </div>
              <Button size="sm" onClick={() => setPetOpen(true)}>
                <Plus className="h-4 w-4 mr-1.5" />
                Register pet
              </Button>
            </CardHeader>
            <CardContent>
              {petsLoading ? (
                <Skeleton className="h-16 w-full" />
              ) : pets.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  <PawPrint className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No pets registered</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {pets.map((p: Tables<'tenant_pets'>) => (
                    <div key={p.id} className="flex items-center justify-between p-3 rounded-lg border border-border">
                      <div className="flex items-center gap-3">
                        <PawPrint className="h-5 w-5 text-warning" />
                        <div>
                          <p className="text-sm font-medium capitalize">
                            {p.pet_type}
                            {p.name ? ` — ${p.name}` : ''}
                          </p>
                          {p.breed && <p className="text-xs text-muted-foreground">{p.breed}</p>}
                          {p.pet_deposit > 0 && (
                            <p className="text-xs text-muted-foreground">
                              Deposit: KES {Number(p.pet_deposit).toLocaleString()}
                            </p>
                          )}
                        </div>
                      </div>
                      <Badge variant="outline" className={`text-xs ${STATUS_BADGE[String(p.is_approved)]}`}>
                        {p.is_approved ? (
                          <>
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Approved
                          </>
                        ) : (
                          <>
                            <Clock className="h-3 w-3 mr-1" />
                            Pending approval
                          </>
                        )}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Vehicles */}
        <TabsContent value="vehicles" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="text-sm">Registered vehicles</CardTitle>
                <CardDescription>Register vehicles for parking and security purposes.</CardDescription>
              </div>
              <Button size="sm" onClick={() => setVehicleOpen(true)}>
                <Plus className="h-4 w-4 mr-1.5" />
                Register vehicle
              </Button>
            </CardHeader>
            <CardContent>
              {vehiclesLoading ? (
                <Skeleton className="h-16 w-full" />
              ) : vehicles.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  <Car className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No vehicles registered</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {vehicles.map((v: Tables<'tenant_vehicles'>) => (
                    <div key={v.id} className="flex items-center justify-between p-3 rounded-lg border border-border">
                      <div className="flex items-center gap-3">
                        <Car className="h-5 w-5 text-primary" />
                        <div>
                          <p className="text-sm font-semibold font-mono">{v.plate_number}</p>
                          <p className="text-xs text-muted-foreground">
                            {[v.colour, v.make, v.model].filter(Boolean).join(' ')}
                          </p>
                          {v.parking_bay && <p className="text-xs text-muted-foreground">Bay: {v.parking_bay}</p>}
                          {v.parking_fee > 0 && (
                            <p className="text-xs text-muted-foreground">
                              Parking: KES {Number(v.parking_fee).toLocaleString()}/mo
                            </p>
                          )}
                        </div>
                      </div>
                      <Badge variant="outline" className={`text-xs ${STATUS_BADGE[String(v.is_approved)]}`}>
                        {v.is_approved ? (
                          <>
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Approved
                          </>
                        ) : (
                          <>
                            <Clock className="h-3 w-3 mr-1" />
                            Pending
                          </>
                        )}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Pet dialog */}
      <Dialog open={petOpen} onOpenChange={setPetOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PawPrint className="h-5 w-5 text-warning" />
              Register a pet
            </DialogTitle>
            <DialogDescription>Your manager will review and approve your pet registration.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label>Pet type</Label>
              <Select value={petForm.pet_type} onValueChange={(v) => setPetForm((p) => ({ ...p, pet_type: v }))}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PET_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Pet name</Label>
                <Input
                  value={petForm.name}
                  onChange={(e) => setPetForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. Buddy"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Breed</Label>
                <Input
                  value={petForm.breed}
                  onChange={(e) => setPetForm((p) => ({ ...p, breed: e.target.value }))}
                  placeholder="e.g. Labrador"
                  className="mt-1"
                />
              </div>
            </div>
            <div>
              <Label>Notes (optional)</Label>
              <Input
                value={petForm.notes}
                onChange={(e) => setPetForm((p) => ({ ...p, notes: e.target.value }))}
                placeholder="Any details for manager"
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPetOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => addPet.mutate()} disabled={addPet.isPending}>
              {addPet.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}Register pet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Vehicle dialog */}
      <Dialog open={vehicleOpen} onOpenChange={setVehicleOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Car className="h-5 w-5 text-primary" />
              Register a vehicle
            </DialogTitle>
            <DialogDescription>Your manager will review and assign a parking bay if available.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label>Plate number *</Label>
              <Input
                value={vehicleForm.plate_number}
                onChange={(e) => setVehicleForm((p) => ({ ...p, plate_number: e.target.value.toUpperCase() }))}
                placeholder="KCB 123A"
                className="mt-1 font-mono"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Make</Label>
                <Input
                  value={vehicleForm.make}
                  onChange={(e) => setVehicleForm((p) => ({ ...p, make: e.target.value }))}
                  placeholder="Toyota"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Model</Label>
                <Input
                  value={vehicleForm.model}
                  onChange={(e) => setVehicleForm((p) => ({ ...p, model: e.target.value }))}
                  placeholder="Corolla"
                  className="mt-1"
                />
              </div>
            </div>
            <div>
              <Label>Colour</Label>
              <Input
                value={vehicleForm.colour}
                onChange={(e) => setVehicleForm((p) => ({ ...p, colour: e.target.value }))}
                placeholder="Silver"
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVehicleOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => addVehicle.mutate()}
              disabled={addVehicle.isPending || !vehicleForm.plate_number.trim()}
            >
              {addVehicle.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}Register vehicle
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TenantPetsVehicles;
