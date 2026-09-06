// @ts-nocheck — Phase 12: remaining local types until live supabase gen types
import { format } from "date-fns";
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/features/auth/AuthContext';
import { useToast } from '@/shared/hooks/use-toast';
import { useActivityLog } from '@/shared/hooks/useActivityLog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/shared/components/ui/alert-dialog';
import { Badge } from '@/shared/components/ui/badge';
import { Switch } from '@/shared/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { Checkbox } from '@/shared/components/ui/checkbox';
import { Users, UserPlus, Trash2, Eye, Loader2, Settings2, Zap, Building } from 'lucide-react';

interface SubmanagerPermissions {
  // View flags
  can_view_properties: boolean;
  can_view_tenants: boolean;
  can_view_leases: boolean;
  can_view_invoices: boolean;
  can_view_maintenance: boolean;
  can_view_contracts: boolean;
  can_view_activity_logs: boolean;
  restrict_to_assigned_properties?: boolean;
  // Write flags
  can_record_payments:    boolean;
  can_edit_tenants:       boolean;
  can_manage_maintenance: boolean;
  can_create_invoices:    boolean;
  can_approve_moveouts:   boolean;
  can_send_notices:       boolean;
  can_upload_documents:   boolean;
}

interface Property {
  id: string;
  name: string;
  address: string;
}

interface Submanager {
  id: string;
  submanager_user_id: string;
  created_at: string;
  profile?: {
    email: string;
    full_name: string | null;
  };
  permissions?: SubmanagerPermissions;
  assigned_properties?: string[];
}

type PermissionPreset = 'custom' | 'full_access' | 'financial_only' | 'operations_only' | 'read_only';

interface PresetConfig {
  label: string;
  description: string;
  permissions: SubmanagerPermissions;
}

const BASE_WRITE_OFF = {
  can_record_payments: false, can_edit_tenants: false, can_manage_maintenance: false,
  can_create_invoices: false, can_approve_moveouts: false, can_send_notices: false, can_upload_documents: true,
};

const PERMISSION_PRESETS: Record<PermissionPreset, PresetConfig> = {
  custom: {
    label: 'Custom',
    description: 'Manually select permissions',
    permissions: {
      can_view_properties: true, can_view_tenants: true, can_view_leases: true,
      can_view_invoices: true, can_view_maintenance: true, can_view_contracts: true,
      can_view_activity_logs: false, ...BASE_WRITE_OFF,
    }
  },
  full_access: {
    label: 'Full Access',
    description: 'All permissions — view + write + activity logs',
    permissions: {
      can_view_properties: true, can_view_tenants: true, can_view_leases: true,
      can_view_invoices: true, can_view_maintenance: true, can_view_contracts: true,
      can_view_activity_logs: true,
      can_record_payments: true, can_edit_tenants: true, can_manage_maintenance: true,
      can_create_invoices: true, can_approve_moveouts: true, can_send_notices: true, can_upload_documents: true,
    }
  },
  financial_only: {
    label: 'Financial Only',
    description: 'Invoices, leases & contracts — can record payments',
    permissions: {
      can_view_properties: false, can_view_tenants: false, can_view_leases: true,
      can_view_invoices: true, can_view_maintenance: false, can_view_contracts: true,
      can_view_activity_logs: false,
      can_record_payments: true, can_edit_tenants: false, can_manage_maintenance: false,
      can_create_invoices: true, can_approve_moveouts: false, can_send_notices: false, can_upload_documents: true,
    }
  },
  operations_only: {
    label: 'Operations Only',
    description: 'Properties, tenants & maintenance — can manage day-to-day',
    permissions: {
      can_view_properties: true, can_view_tenants: true, can_view_leases: false,
      can_view_invoices: false, can_view_maintenance: true, can_view_contracts: false,
      can_view_activity_logs: false,
      can_record_payments: false, can_edit_tenants: true, can_manage_maintenance: true,
      can_create_invoices: false, can_approve_moveouts: true, can_send_notices: true, can_upload_documents: true,
    }
  },
  read_only: {
    label: 'View Only',
    description: 'Read-only access to properties & tenants — no write actions',
    permissions: {
      can_view_properties: true, can_view_tenants: true, can_view_leases: false,
      can_view_invoices: false, can_view_maintenance: false, can_view_contracts: false,
      can_view_activity_logs: false,
      ...BASE_WRITE_OFF,
    }
  }
};

const defaultPermissions: SubmanagerPermissions = {
  can_view_properties: true, can_view_tenants: true, can_view_leases: true,
  can_view_invoices: true, can_view_maintenance: true, can_view_contracts: true,
  can_view_activity_logs: false, restrict_to_assigned_properties: true,
  can_record_payments: false, can_edit_tenants: false, can_manage_maintenance: false,
  can_create_invoices: false, can_approve_moveouts: false, can_send_notices: false, can_upload_documents: true,
};

const permissionLabels: Record<keyof Omit<SubmanagerPermissions, 'restrict_to_assigned_properties'>, string> = {
  // View permissions
  can_view_properties:    'View properties',
  can_view_tenants:       'View tenants',
  can_view_leases:        'View leases',
  can_view_invoices:      'View invoices',
  can_view_maintenance:   'View maintenance',
  can_view_contracts:     'View contracts',
  can_view_activity_logs: 'View activity logs',
  // Write permissions
  can_record_payments:    'Record payments',
  can_edit_tenants:       'Edit tenant profiles',
  can_manage_maintenance: 'Manage maintenance requests',
  can_create_invoices:    'Create invoices',
  can_approve_moveouts:   'Approve move-outs',
  can_send_notices:       'Send formal notices',
  can_upload_documents:   'Upload documents',
};

const VIEW_PERMISSION_KEYS: Array<keyof SubmanagerPermissions> = [
  'can_view_properties', 'can_view_tenants', 'can_view_leases',
  'can_view_invoices', 'can_view_maintenance', 'can_view_contracts', 'can_view_activity_logs',
];
const WRITE_PERMISSION_KEYS: Array<keyof SubmanagerPermissions> = [
  'can_record_payments', 'can_edit_tenants', 'can_manage_maintenance',
  'can_create_invoices', 'can_approve_moveouts', 'can_send_notices', 'can_upload_documents',
];

const detectPresetFromPermissions = (perms: SubmanagerPermissions): PermissionPreset => {
  for (const [key, preset] of Object.entries(PERMISSION_PRESETS)) {
    if (key === 'custom') continue;
    const presetPerms = preset.permissions;
    const matches = Object.keys(presetPerms).every(
      (k) => perms[k as keyof SubmanagerPermissions] === presetPerms[k as keyof SubmanagerPermissions]
    );
    if (matches) return key as PermissionPreset;
  }
  return 'custom';
};

const SubmanagerManagement = () => {
  const { user, isManager } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { logActivity } = useActivityLog();
  
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isPermissionsDialogOpen, setIsPermissionsDialogOpen] = useState(false);
  const [isPropertyDialogOpen, setIsPropertyDialogOpen] = useState(false);
  const [selectedSubmanager, setSelectedSubmanager] = useState<Submanager | null>(null);
  const [editingPermissions, setEditingPermissions] = useState<SubmanagerPermissions>(defaultPermissions);
  const [editingPreset, setEditingPreset] = useState<PermissionPreset>('custom');
  const [newSubmanagerName, setNewSubmanagerName] = useState('');
  const [newSubmanagerEmail, setNewSubmanagerEmail] = useState('');
  const [newSubmanagerPassword, setNewSubmanagerPassword] = useState('');
  const [newPermissions, setNewPermissions] = useState<SubmanagerPermissions>(defaultPermissions);
  const [newPreset, setNewPreset] = useState<PermissionPreset>('custom');
  const [isCreating, setIsCreating] = useState(false);
  const [isSavingPermissions, setIsSavingPermissions] = useState(false);
  const [selectedPropertyIds, setSelectedPropertyIds] = useState<string[]>([]);
  const [isSavingProperties, setIsSavingProperties] = useState(false);

  // Fetch manager's properties
  const { data: properties } = useQuery({
    queryKey: ['manager-properties', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('properties')
        .select('id, name, address')
        .eq('manager_id', user.id)
        .order('name');
      if (error) throw error;
      return data as Property[];
    },
    enabled: !!user?.id && isManager,
  });

  // Fetch submanagers for the current manager
  const { data: submanagers, isLoading } = useQuery({
    queryKey: ['manager-submanagers', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data: relationships, error } = await supabase
        .from('manager_submanagers')
        .select('*')
        .eq('manager_id', user.id);

      if (error) throw error;

      // Fetch profiles, permissions, and property assignments for each submanager
      const submanagersWithProfiles: Submanager[] = [];
      for (const rel of relationships || []) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('email, full_name')
          .eq('id', rel.submanager_user_id)
          .maybeSingle();

        const { data: permissions } = await supabase
          .from('submanager_permissions')
          .select('*')
          .eq('submanager_user_id', rel.submanager_user_id)
          .maybeSingle();

        const { data: propertyAssignments } = await supabase
          .from('submanager_property_assignments')
          .select('property_id')
          .eq('submanager_user_id', rel.submanager_user_id);

        submanagersWithProfiles.push({
          ...rel,
          profile: profile || undefined,
          permissions: permissions || defaultPermissions,
          assigned_properties: propertyAssignments?.map(p => p.property_id) || [],
        });
      }

      return submanagersWithProfiles;
    },
    enabled: !!user?.id && isManager,
  });

  // Create a new submanager
  const handleCreateSubmanager = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;

    setIsCreating(true);
    try {
      // Create the user account
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: newSubmanagerEmail,
        password: newSubmanagerPassword,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: {
            full_name: newSubmanagerName,
          },
        },
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error('Failed to create user');

      const { error: provisionError } = await supabase.rpc('provision_submanager_atomic', {
        p_submanager_user_id: authData.user.id,
        p_permissions: newPermissions,
      });
      if (provisionError) throw provisionError;

      // Log activity
      logActivity({
        action: 'created',
        entityType: 'submanager',
        entityId: authData.user.id,
        details: {
          submanager_email: newSubmanagerEmail,
          submanager_name: newSubmanagerName,
          permissions: newPermissions,
        },
      });

      toast({
        title: 'Submanager created',
        description: `${newSubmanagerEmail} can now access your data with the configured permissions.`,
      });

      setIsAddDialogOpen(false);
      setNewSubmanagerName('');
      setNewSubmanagerEmail('');
      setNewSubmanagerPassword('');
      setNewPermissions(defaultPermissions);
      queryClient.invalidateQueries({ queryKey: ['manager-submanagers'] });
    } catch (err: unknown) {
      toast({
        title: 'Failed to create submanager',
        description: err instanceof Error ? err.message : 'An error occurred while creating the submanager.',
        variant: 'destructive',
      });
    } finally {
      setIsCreating(false);
    }
  };

  // Save permissions for a submanager
  const handleSavePermissions = async () => {
    if (!selectedSubmanager || !user?.id) return;

    setIsSavingPermissions(true);
    try {
      const { error } = await supabase.rpc('save_submanager_permissions_atomic', {
        p_submanager_user_id: selectedSubmanager.submanager_user_id,
        p_permissions: editingPermissions,
      });
      if (error) throw error;

      // Log activity
      logActivity({
        action: 'updated_permissions',
        entityType: 'submanager',
        entityId: selectedSubmanager.submanager_user_id,
        details: {
          submanager_email: selectedSubmanager.profile?.email,
          submanager_name: selectedSubmanager.profile?.full_name,
          permissions: editingPermissions,
        },
      });

      // Sync to agency_members — link submanager to manager's agency
      const { data: agency } = await supabase
        .from('agencies')
        .select('id')
        .eq('manager_id', user.id)
        .maybeSingle();
      toast({
        title: 'Permissions updated',
        description: 'Submanager permissions have been saved successfully.',
      });

      setIsPermissionsDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['manager-submanagers'] });
    } catch (err: unknown) {
      toast({
        title: 'Failed to save permissions',
        description: err instanceof Error ? err.message : 'An error occurred.',
        variant: 'destructive',
      });
    } finally {
      setIsSavingPermissions(false);
    }
  };

  // Remove a submanager
  const removeSubmanager = useMutation({
    mutationFn: async (submanagerId: string) => {
      const { data: relationship, error } = await supabase
        .from('manager_submanagers')
        .select('submanager_user_id')
        .eq('id', submanagerId)
        .single();
      if (error) throw error;
      const { error: removeError } = await supabase.rpc('remove_submanager_atomic', { p_submanager_id: submanagerId });
      if (removeError) throw removeError;

      return relationship;
    },
    onSuccess: (relationship) => {
      // Log activity
      logActivity({
        action: 'removed',
        entityType: 'submanager',
        entityId: relationship?.submanager_user_id,
        details: {
          submanager_user_id: relationship?.submanager_user_id,
        },
      });

      toast({
        title: 'Submanager removed',
        description: 'The submanager has been removed from your account.',
      });
      queryClient.invalidateQueries({ queryKey: ['manager-submanagers'] });
    },
    onError: (err: unknown) => {
      toast({
        title: 'Failed to remove submanager',
        description: err instanceof Error ? err.message : 'An error occurred.',
        variant: 'destructive',
      });
    },
  });

  const openPermissionsDialog = (submanager: Submanager) => {
    setSelectedSubmanager(submanager);
    const perms = submanager.permissions || defaultPermissions;
    setEditingPermissions(perms);
    setEditingPreset(detectPresetFromPermissions(perms));
    setIsPermissionsDialogOpen(true);
  };

  const handleNewPresetChange = (preset: PermissionPreset) => {
    setNewPreset(preset);
    if (preset !== 'custom') {
      setNewPermissions(PERMISSION_PRESETS[preset].permissions);
    }
  };

  const handleNewPermissionChange = (key: keyof SubmanagerPermissions, checked: boolean) => {
    const updated = { ...newPermissions, [key]: checked };
    setNewPermissions(updated);
    setNewPreset(detectPresetFromPermissions(updated));
  };

  const handleEditPresetChange = (preset: PermissionPreset) => {
    setEditingPreset(preset);
    if (preset !== 'custom') {
      setEditingPermissions(PERMISSION_PRESETS[preset].permissions);
    }
  };

  const handleEditPermissionChange = (key: keyof SubmanagerPermissions, checked: boolean) => {
    const updated = { ...editingPermissions, [key]: checked };
    setEditingPermissions(updated);
    setEditingPreset(detectPresetFromPermissions(updated));
  };

  const countActivePermissions = (perms?: SubmanagerPermissions) => {
    if (!perms) return Object.keys(permissionLabels).length;
    return Object.entries(perms).filter(([key, value]) => key !== 'restrict_to_assigned_properties' && value === true).length;
  };

  const openPropertyDialog = (submanager: Submanager) => {
    setSelectedSubmanager(submanager);
    setSelectedPropertyIds(submanager.assigned_properties || []);
    setEditingPermissions(submanager.permissions || defaultPermissions);
    setIsPropertyDialogOpen(true);
  };

  const handleSavePropertyAssignments = async () => {
    if (!selectedSubmanager || !user?.id) return;

    setIsSavingProperties(true);
    try {
      const previousPropertyIds = selectedSubmanager.assigned_properties || [];
      const wasRestricted = selectedSubmanager.permissions?.restrict_to_assigned_properties || false;
      
      const { error } = await supabase.rpc('save_submanager_property_assignments_atomic', {
        p_submanager_user_id: selectedSubmanager.submanager_user_id,
        p_property_ids: selectedPropertyIds,
        p_restrict: editingPermissions.restrict_to_assigned_properties,
      });
      if (error) throw error;

      // Get property names for logging and email
      const assignedPropertyNames = properties
        ?.filter(p => selectedPropertyIds.includes(p.id))
        .map(p => p.name) || [];

      // Determine action type for email
      let emailAction: 'assigned' | 'updated' | 'removed' = 'updated';
      if (!wasRestricted && editingPermissions.restrict_to_assigned_properties && selectedPropertyIds.length > 0) {
        emailAction = 'assigned';
      } else if (wasRestricted && !editingPermissions.restrict_to_assigned_properties) {
        emailAction = 'removed';
      }

      // Log activity
      logActivity({
        action: 'updated_property_assignments',
        entityType: 'submanager',
        entityId: selectedSubmanager.submanager_user_id,
        details: {
          submanager_email: selectedSubmanager.profile?.email,
          submanager_name: selectedSubmanager.profile?.full_name,
          previous_properties: previousPropertyIds,
          new_properties: selectedPropertyIds,
          property_names: assignedPropertyNames,
          restrict_to_assigned_properties: editingPermissions.restrict_to_assigned_properties,
        },
      });

      // Send email notification
      if (selectedSubmanager.profile?.email) {
        // Fetch manager's profile for name
        const { data: managerProfile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', user.id)
          .maybeSingle();

        supabase.functions.invoke('send-property-assignment-notification', {
          body: {
            submanagerEmail: selectedSubmanager.profile.email,
            submanagerName: selectedSubmanager.profile.full_name || '',
            managerName: managerProfile?.full_name || '',
            propertyNames: assignedPropertyNames,
            action: emailAction,
          },
        }).catch((err) => {
        });
      }

      toast({
        title: 'Properties Updated',
        description: selectedPropertyIds.length > 0
          ? `Assigned ${selectedPropertyIds.length} properties to this submanager.`
          : 'Submanager now has access to all properties.',
      });

      setIsPropertyDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['manager-submanagers'] });
    } catch (err: unknown) {
      toast({
        title: 'Failed to save',
        description: err instanceof Error ? err.message : 'An error occurred.',
        variant: 'destructive',
      });
    } finally {
      setIsSavingProperties(false);
    }
  };

  const togglePropertySelection = (propertyId: string) => {
    setSelectedPropertyIds(prev =>
      prev.includes(propertyId)
        ? prev.filter(id => id !== propertyId)
        : [...prev, propertyId]
    );
  };

  if (!isManager) return null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Submanager Accounts
            </CardTitle>
            <CardDescription>
              Create accounts with customizable permissions to let others view your data
            </CardDescription>
          </div>
          <Button onClick={() => setIsAddDialogOpen(true)}>
            <UserPlus className="h-4 w-4 mr-2" />
            Add Submanager
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : submanagers && submanagers.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Permissions</TableHead>
                <TableHead>Properties</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {submanagers.map((submanager) => (
                <TableRow key={submanager.id}>
                  <TableCell className="font-medium">
                    {submanager.profile?.full_name || 'Unknown'}
                  </TableCell>
                  <TableCell>{submanager.profile?.email || 'Unknown'}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="gap-1">
                      <Eye className="h-3 w-3" />
                      {countActivePermissions(submanager.permissions)} of {Object.keys(permissionLabels).length}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {submanager.permissions?.restrict_to_assigned_properties ? (
                      <Badge variant="outline" className="gap-1">
                        <Building className="h-3 w-3" />
                        {submanager.assigned_properties?.length || 0} assigned
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="gap-1">
                        All properties
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {format(new Date(submanager.created_at), 'dd/MM/yy')}
                  </TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openPermissionsDialog(submanager)}
                      title="Edit Permissions"
                    >
                      <Settings2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openPropertyDialog(submanager)}
                      title="Assign Properties"
                    >
                      <Building className="h-4 w-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remove Submanager</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to remove {submanager.profile?.email}? They will no longer be able to view your data.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => removeSubmanager.mutate(submanager.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Remove
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No submanagers yet</p>
            <p className="text-sm">Add submanagers to give customized access to your data</p>
          </div>
        )}

        {/* Add Submanager Dialog */}
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add Submanager</DialogTitle>
              <DialogDescription>
                Create a new account with customizable permissions.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateSubmanager} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="submanager-name">Full Name</Label>
                <Input
                  id="submanager-name"
                  value={newSubmanagerName}
                  onChange={(e) => setNewSubmanagerName(e.target.value)}
                  placeholder="John Doe"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="submanager-email">Email</Label>
                <Input
                  id="submanager-email"
                  type="email"
                  value={newSubmanagerEmail}
                  onChange={(e) => setNewSubmanagerEmail(e.target.value)}
                  placeholder="submanager@example.com"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="submanager-password">Password</Label>
                <Input
                  id="submanager-password"
                  type="password"
                  value={newSubmanagerPassword}
                  onChange={(e) => setNewSubmanagerPassword(e.target.value)}
                  placeholder="Minimum 8 characters"
                  minLength={8}
                  required
                />
              </div>
              
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-warning" />
                    Quick Setup Preset
                  </Label>
                  <Select value={newPreset} onValueChange={(v) => handleNewPresetChange(v as PermissionPreset)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a preset" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(PERMISSION_PRESETS).map(([key, preset]) => (
                        <SelectItem key={key} value={key}>
                          <div className="flex flex-col items-start">
                            <span className="font-medium">{preset.label}</span>
                            <span className="text-xs text-muted-foreground">{preset.description}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Label>Permissions</Label>
                <div className="space-y-3 border rounded-lg p-3">
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-[hsl(214_73%_58%)] inline-block" />
                      What they can view
                    </p>
                    {VIEW_PERMISSION_KEYS.map((key) => (
                      <div key={key} className="flex items-center justify-between py-1">
                        <Label htmlFor={`new-${key}`} className="font-normal cursor-pointer text-sm">
                          {permissionLabels[key as keyof typeof permissionLabels]}
                        </Label>
                        <Switch
                          id={`new-${key}`}
                          checked={!!(newPermissions[key])}
                          onCheckedChange={(checked) => handleNewPermissionChange(key, checked)}
                        />
                      </div>
                    ))}
                  </div>
                  <div className="border-t pt-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-green-400 inline-block" />
                      What they can do (write actions)
                    </p>
                    {WRITE_PERMISSION_KEYS.map((key) => (
                      <div key={key} className="flex items-center justify-between py-1">
                        <Label htmlFor={`new-${key}`} className="font-normal cursor-pointer text-sm">
                          {permissionLabels[key as keyof typeof permissionLabels]}
                        </Label>
                        <Switch
                          id={`new-${key}`}
                          checked={!!(newPermissions[key])}
                          onCheckedChange={(checked) => handleNewPermissionChange(key, checked)}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isCreating}>
                  {isCreating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    'Create Submanager'
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Edit Permissions Dialog */}
        <Dialog open={isPermissionsDialogOpen} onOpenChange={setIsPermissionsDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Permissions</DialogTitle>
              <DialogDescription>
                Configure what {selectedSubmanager?.profile?.full_name || selectedSubmanager?.profile?.email || 'this submanager'} can view and do.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-warning" />
                  Quick Setup Preset
                </Label>
                <Select value={editingPreset} onValueChange={(v) => handleEditPresetChange(v as PermissionPreset)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a preset" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(PERMISSION_PRESETS).map(([key, preset]) => (
                      <SelectItem key={key} value={key}>
                        <div className="flex flex-col items-start">
                          <span className="font-medium">{preset.label}</span>
                          <span className="text-xs text-muted-foreground">{preset.description}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3 border rounded-lg p-3 max-h-72 overflow-y-auto">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-[hsl(214_73%_58%)] inline-block" />
                    What they can view
                  </p>
                  {VIEW_PERMISSION_KEYS.map((key) => (
                    <div key={key} className="flex items-center justify-between py-1">
                      <Label htmlFor={`edit-${key}`} className="font-normal cursor-pointer text-sm">
                        {permissionLabels[key as keyof typeof permissionLabels]}
                      </Label>
                      <Switch
                        id={`edit-${key}`}
                        checked={!!(editingPermissions[key])}
                        onCheckedChange={(checked) => handleEditPermissionChange(key, checked)}
                      />
                    </div>
                  ))}
                </div>
                <div className="border-t pt-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-green-400 inline-block" />
                    What they can do (write actions)
                  </p>
                  {WRITE_PERMISSION_KEYS.map((key) => (
                    <div key={key} className="flex items-center justify-between py-1">
                      <Label htmlFor={`edit-${key}`} className="font-normal cursor-pointer text-sm">
                        {permissionLabels[key as keyof typeof permissionLabels]}
                      </Label>
                      <Switch
                        id={`edit-${key}`}
                        checked={!!(editingPermissions[key])}
                        onCheckedChange={(checked) => handleEditPermissionChange(key, checked)}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsPermissionsDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSavePermissions} disabled={isSavingPermissions}>
                {isSavingPermissions ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Permissions'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Property Assignment Dialog */}
        <Dialog open={isPropertyDialogOpen} onOpenChange={setIsPropertyDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Building className="h-5 w-5" />
                Assign Properties
              </DialogTitle>
              <DialogDescription>
                Choose which properties {selectedSubmanager?.profile?.full_name || 'this submanager'} can access.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {/* Restrict Toggle */}
              <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30">
                <div>
                  <Label className="font-medium">Restrict to specific properties</Label>
                  <p className="text-sm text-muted-foreground">
                    When disabled, submanager sees all your properties
                  </p>
                </div>
                <Switch
                  checked={editingPermissions.restrict_to_assigned_properties || false}
                  onCheckedChange={(checked) =>
                    setEditingPermissions(prev => ({ ...prev, restrict_to_assigned_properties: checked }))
                  }
                />
              </div>

              {editingPermissions.restrict_to_assigned_properties && (
                <div className="space-y-2">
                  <Label>Select Properties</Label>
                  <div className="border rounded-lg max-h-64 overflow-y-auto">
                    {properties && properties.length > 0 ? (
                      properties.map((property) => (
                        <div
                          key={property.id}
                          className="flex items-center gap-3 p-3 border-b last:border-b-0 hover:bg-muted/50 cursor-pointer"
                          onClick={() => togglePropertySelection(property.id)}
                        >
                          <Checkbox
                            checked={selectedPropertyIds.includes(property.id)}
                            onCheckedChange={() => togglePropertySelection(property.id)}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{property.name}</p>
                            <p className="text-xs text-muted-foreground truncate">{property.address}</p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="p-4 text-center text-muted-foreground text-sm">
                        No properties found
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {selectedPropertyIds.length} properties selected
                  </p>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsPropertyDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSavePropertyAssignments} disabled={isSavingProperties}>
                {isSavingProperties ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Assignments'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};

export default SubmanagerManagement;
