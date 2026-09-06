// @ts-nocheck — Phase 12: remaining local types until live supabase gen types
import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/shared/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/shared/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { Label } from '@/shared/components/ui/label';
import { Textarea } from '@/shared/components/ui/textarea';
import { Badge } from '@/shared/components/ui/badge';
import { ArrowRightLeft, Building2, User, AlertTriangle, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/shared/hooks/use-toast';
import { useActivityLog } from '@/shared/hooks/useActivityLog';

interface Tenant {
  id: string;
  name: string;
  email: string;
  property: string | null;
  property_id: string | null;
  unit: string | null;
}

interface Manager {
  id: string;
  email: string;
  full_name: string | null;
}

interface Property {
  id: string;
  name: string;
  address: string;
  manager_id: string | null;
}

interface TenantTransferDialogProps {
  tenant: Tenant;
  currentManagerId?: string;
  onTransferComplete: () => void;
}

export const TenantTransferDialog: React.FC<TenantTransferDialogProps> = ({
  tenant,
  currentManagerId,
  onTransferComplete,
}) => {
  const { toast } = useToast();
  const { logActivity } = useActivityLog();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [managers, setManagers] = useState<Manager[]>([]);
  const [allProperties, setAllProperties] = useState<Property[]>([]);
  
  const [selectedManagerId, setSelectedManagerId] = useState<string>('');
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>('');
  const [newUnit, setNewUnit] = useState('');
  const [transferNotes, setTransferNotes] = useState('');

  // Get properties for the selected manager
  const availableProperties = allProperties.filter(
    p => p.manager_id === selectedManagerId
  );

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      // Fetch all managers (users with manager role)
      const { data: managerRoles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'manager')
        .eq('approval_status', 'approved');

      if (rolesError) throw rolesError;

      const managerIds = managerRoles?.map(r => r.user_id) || [];

      if (managerIds.length > 0) {
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('id, email, full_name')
          .in('id', managerIds);

        if (profilesError) throw profilesError;
        
        // Filter out current manager
        const otherManagers = (profiles || []).filter(p => p.id !== currentManagerId);
        setManagers(otherManagers);
      }

      // Fetch all properties (for webhost view) or just other manager's properties
      const { data: properties, error: propsError } = await supabase
        .from('properties')
        .select('id, name, address, manager_id');

      if (propsError) throw propsError;
      setAllProperties(properties || []);

    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load transfer options',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [currentManagerId, toast]);

  useEffect(() => {
    if (isOpen) {
      fetchData();
    }
  }, [isOpen, fetchData]);

  const handleTransfer = async () => {
    if (!selectedPropertyId) {
      toast({
        title: 'Error',
        description: 'Please select a destination property',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const targetProperty = allProperties.find(p => p.id === selectedPropertyId);
      if (!targetProperty) throw new Error('Property not found');

      const { error: transferError } = await supabase.rpc('transfer_tenant_atomic' as any, {
        p_tenant_id: tenant.id,
        p_property_id: selectedPropertyId,
        p_unit_id: null,
        p_unit_number: newUnit || null,
        p_destination_manager_id: selectedManagerId || targetProperty.manager_id || null,
        p_notes: transferNotes || null,
      });
      if (transferError) throw transferError;

      // Log activity
      await logActivity({
        action: 'transferred',
        entityType: 'tenant',
        entityId: tenant.id,
        details: {
          tenant_name: tenant.name,
          from_property: tenant.property || 'Unassigned',
          to_property: targetProperty.name,
          to_unit: newUnit || null,
          notes: transferNotes || null,
        }
      });

      toast({
        title: 'Tenant Transferred',
        description: `${tenant.name} has been transferred to ${targetProperty.name}`,
      });

      setIsOpen(false);
      resetForm();
      onTransferComplete();
    } catch (error) {
      toast({
        title: 'Transfer Failed',
        description: 'Could not complete the tenant transfer',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setSelectedManagerId('');
    setSelectedPropertyId('');
    setNewUnit('');
    setTransferNotes('');
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      setIsOpen(open);
      if (!open) resetForm();
    }}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          title="Transfer Tenant"
          aria-label="Transfer tenant"
        >
          <ArrowRightLeft className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px] bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5" />
            Transfer Tenant
          </DialogTitle>
          <DialogDescription>
            Move the tenant record to another managed property or manager without creating a new tenant identity.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4 py-4">
            {/* Current Location */}
            <div className="bg-muted/50 rounded-lg p-3">
              <p className="text-sm text-muted-foreground mb-1">Current Location</p>
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-warning" />
                <span className="font-medium">{tenant.name}</span>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">
                  {tenant.property || 'Unassigned'}
                  {tenant.unit && ` - Unit ${tenant.unit}`}
                </span>
              </div>
            </div>

            {/* Select Manager (optional filter) */}
            <div className="space-y-2">
              <Label>Filter by Manager (Optional)</Label>
              <Select value={selectedManagerId} onValueChange={(value) => {
                setSelectedManagerId(value);
                setSelectedPropertyId(''); // Reset property when manager changes
              }}>
                <SelectTrigger className="bg-background border-border">
                  <SelectValue placeholder="All managers" />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border">
                  <SelectItem value="all">All managers</SelectItem>
                  {managers.map((manager) => (
                    <SelectItem key={manager.id} value={manager.id}>
                      {manager.full_name || manager.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Select Destination Property */}
            <div className="space-y-2">
              <Label>Destination Property *</Label>
              <Select value={selectedPropertyId} onValueChange={setSelectedPropertyId}>
                <SelectTrigger className="bg-background border-border">
                  <SelectValue placeholder="Select property" />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border">
                  {(selectedManagerId && selectedManagerId !== 'all' ? availableProperties : allProperties)
                    .filter(p => p.id !== tenant.property_id) // Exclude current property
                    .map((property) => (
                      <SelectItem key={property.id} value={property.id}>
                        <div className="flex flex-col">
                          <span>{property.name}</span>
                          <span className="text-xs text-muted-foreground">{property.address}</span>
                        </div>
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            {/* New Unit */}
            <div className="space-y-2">
              <Label>New Unit Number (Optional)</Label>
              <input
                type="text"
                value={newUnit}
                onChange={(e) => setNewUnit(e.target.value)}
                placeholder="e.g., A101"
                className="flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />
            </div>

            {/* Transfer Notes */}
            <div className="space-y-2">
              <Label>Transfer Notes (Optional)</Label>
              <Textarea
                value={transferNotes}
                onChange={(e) => setTransferNotes(e.target.value)}
                placeholder="Reason for transfer, special instructions, etc."
                className="bg-background border-border"
                rows={3}
              />
            </div>

            {/* Warning */}
            <div className="flex items-start gap-2 p-3 rounded-lg bg-warning/10 border border-warning/20">
              <AlertTriangle className="h-4 w-4 text-warning mt-0.5 flex-shrink-0" />
              <p className="text-xs text-warning dark:text-warning">
                The tenant keeps the same CALQULUS identity, history, payment evidence and personal record. Complete or terminate any active lease before transferring management.
              </p>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleTransfer} 
            disabled={isSubmitting || !selectedPropertyId}
            className="gap-2"
          >
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Transfer Tenant
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
