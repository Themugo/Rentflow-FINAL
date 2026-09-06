// @ts-nocheck — Phase 12: remaining local types until live supabase gen types
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/features/auth/AuthContext';
import { useToast } from '@/shared/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Switch } from '@/shared/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/components/ui/table';
import { Users, UserPlus, Trash2 } from 'lucide-react';
import { errorToast } from "@/shared/lib/errorToast";

interface TeamRow {
  id: string;
  member_user_id: string;
  member_label: string | null;
  can_view_tenants: boolean;
  can_record_payments: boolean;
  can_edit_tenants: boolean;
  restrict_to_assigned_properties: boolean;
  assigned_property_ids: string[];
  profile?: { email: string; full_name: string | null };
}

const LandlordTeamSettings: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState('');
  const [label, setLabel] = useState('');

  const { data: properties = [] } = useQuery({
    queryKey: ['landlord-team-properties', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data: links } = await supabase
        .from('property_landlords')
        .select('property_id')
        .eq('landlord_user_id', user.id);
      if (!links?.length) return [];
      const ids = links.map((l: { property_id: string }) => l.property_id);
      const { data: props } = await supabase.from('properties').select('id, name').in('id', ids);
      return props || [];
    },
    enabled: !!user,
  });

  const { data: team = [], isLoading } = useQuery({
    queryKey: ['landlord-team', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('landlord_team_members')
        .select('*')
        .eq('landlord_user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      const rows = (data || []) as TeamRow[];
      const memberIds = rows.map((r) => r.member_user_id);
      if (memberIds.length === 0) return rows;
      const { data: profiles } = await supabase.from('profiles').select('id, email, full_name').in('id', memberIds);
      const byId = new Map((profiles || []).map((p: { id: string }) => [p.id, p]));
      return rows.map((r) => ({ ...r, profile: byId.get(r.member_user_id) }));
    },
    enabled: !!user,
  });


  const addMember = useMutation({
    mutationFn: async () => {
      if (!user || !email.trim()) throw new Error('Email is required');
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', email.trim().toLowerCase())
        .maybeSingle();
      if (!profile) throw new Error('User not found. They must create a CALQULUS PMS account first.');

      const allPropertyIds = properties.map((p: { id: string }) => p.id);
      const perms = {
        can_view_properties: true,
        can_view_tenants: true,
        can_view_leases: true,
        can_view_invoices: true,
        can_view_maintenance: true,
        can_view_contracts: false,
        can_view_activity_logs: false,
        restrict_to_assigned_properties: true,
        can_record_payments: false,
        can_edit_tenants: false,
        can_manage_maintenance: false,
        can_create_invoices: false,
        can_approve_moveouts: false,
        can_send_notices: false,
        can_upload_documents: true,
      };

      const { error } = await supabase.rpc('save_landlord_team_member_atomic' as never, {
        p_member_user_id: profile.id,
        p_member_label: label.trim() || null,
        p_assigned_property_ids: allPropertyIds,
        p_permissions: perms,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['landlord-team'] });
      toast({ title: 'Team member added', description: 'They can sign in via the Submanager portal.' });
      setEmail('');
      setLabel('');
    },
    onError: (e: Error) => errorToast('Failed', e),
  });

  const removeMember = useMutation({
    mutationFn: async (row: TeamRow) => {
      const { error } = await supabase.rpc('remove_landlord_team_member_atomic' as never, {
        p_team_member_id: row.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['landlord-team'] });
      toast({ title: 'Removed from team' });
    },
  });

  const togglePerm = useMutation({
    mutationFn: async ({
      row,
      key,
      value,
    }: {
      row: TeamRow;
      key: keyof TeamRow;
      value: boolean;
    }) => {
      if (!user) return;
      const updated = { ...row, [key]: value };
      const { error } = await supabase.rpc('save_landlord_team_member_atomic' as never, {
        p_member_user_id: row.member_user_id,
        p_member_label: row.member_label,
        p_assigned_property_ids: row.assigned_property_ids,
        p_permissions: updated,
      });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['landlord-team'] }),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Users className="h-4 w-4" />
          Management team
        </CardTitle>
        <CardDescription>
          Build your in-house team with role-based access. Members use the Submanager portal and only see
          tenants and properties you assign.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[200px]">
            <Label>Member email</Label>
            <Input className="mt-1" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="staff@example.com" />
          </div>
          <div className="flex-1 min-w-[160px]">
            <Label>Role label (optional)</Label>
            <Input className="mt-1" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Accountant" />
          </div>
          <Button onClick={() => addMember.mutate()} disabled={addMember.isPending || properties.length === 0}>
            <UserPlus className="h-4 w-4 mr-2" />
            Add member
          </Button>
        </div>
        {properties.length === 0 && (
          <p className="text-xs text-warning bg-amber-50 border border-amber-200 rounded-md p-2">
            Link at least one property to your account before adding team members.
          </p>
        )}

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading team…</p>
        ) : team.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">No team members yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead>
                <TableHead>View tenants</TableHead>
                <TableHead>Record payments</TableHead>
                <TableHead>Edit tenants</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {team.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <p className="text-sm font-medium">{row.profile?.full_name || row.member_label || 'Staff'}</p>
                    <p className="text-xs text-muted-foreground">{row.profile?.email}</p>
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={row.can_view_tenants}
                      onCheckedChange={(v) => togglePerm.mutate({ row, key: 'can_view_tenants', value: v })}
                    />
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={row.can_record_payments}
                      onCheckedChange={(v) => togglePerm.mutate({ row, key: 'can_record_payments', value: v })}
                    />
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={row.can_edit_tenants}
                      onCheckedChange={(v) => togglePerm.mutate({ row, key: 'can_edit_tenants', value: v })}
                    />
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" className="text-destructive" onClick={() => removeMember.mutate(row)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};

export default LandlordTeamSettings;
