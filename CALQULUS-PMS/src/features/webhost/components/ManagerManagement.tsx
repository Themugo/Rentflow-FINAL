import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/features/auth/AuthContext';
import { useToast } from '@/shared/hooks/use-toast';
import { cn } from '@/shared/lib/utils';
import { onActivateKey } from '@/shared/lib/a11y';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Badge } from '@/shared/components/ui/badge';
import { EmptyState } from '@/shared/components/ui/empty-state';
import { Textarea } from '@/shared/components/ui/textarea';
import { Card, CardContent } from '@/shared/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { Link } from 'react-router-dom';
import { webhostOrganizationPath } from '@/features/webhost/lib/webhostPaths';
import { format } from 'date-fns';
import { errorToast } from "@/shared/lib/errorToast";
import {
  UserCheck, UserX, Users, Building2, Home, Mail,
  AlertTriangle, CheckCircle, Clock, Ban, RefreshCw,
  ChevronDown, ChevronUp, UserPlus, Loader2,
  Activity, CreditCard
} from 'lucide-react';

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  pending:              { label: 'Pending Approval', color: 'bg-warning/15 text-warning border-warning/30 font-bold', icon: Clock },
  approved:             { label: 'Active',           color: 'bg-success/15 text-success border-success/30 font-bold', icon: CheckCircle },
  rejected:             { label: 'Rejected',         color: 'bg-destructive/15 text-destructive border-destructive/30 font-bold', icon: UserX },
  suspended:            { label: 'Suspended',        color: 'bg-warning/15 text-warning border-warning/30 font-bold', icon: Ban },
  suspended_nonpayment: { label: 'Non-Payment Suspended', color: 'bg-destructive/15 text-destructive border-destructive/30 font-bold', icon: Ban },
};

const TIER_BADGE: Record<string, string> = {
  starter:      'bg-secondary-background text-secondary-foreground border-border font-semibold',
  growth:       'bg-primary/15 text-primary border-primary/30 font-semibold',
  professional: 'bg-info/15 text-info border-info/30 font-semibold',
  enterprise:   'bg-warning/15 text-warning border-warning/30 font-bold',
};

interface Manager {
  id: string;
  user_id: string;
  email: string;
  full_name: string | null;
  created_at: string;
  approval_status: string;
  property_count: number;
  unit_count: number;
  subscription_tier: string | null;
  agency_name: string | null;
  last_active_at: string | null;
  rejection_reason: string | null;
  suspension_reason: string | null;
}

interface ManagerProfile {
  status?: string;
  property_count?: number;
  unit_count?: number;
  subscription_tier?: string | null;
  last_active_at?: string | null;
  rejection_reason?: string | null;
  suspension_reason?: string | null;
}

interface StatusLogEntry {
  id: string;
  created_at: string;
  old_status: string | null;
  new_status: string;
  reason: string | null;
}

const ManagerManagement: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [actionDialog, setActionDialog] = useState<{ type: string; manager: Manager } | null>(null);
  const [actionReason, setActionReason] = useState('');
  const [actionTier,   setActionTier]   = useState('starter');
  const [expandedId,   setExpandedId]   = useState<string | null>(null);
  const [addOpen,      setAddOpen]      = useState(false);
  const [newMgr,       setNewMgr]       = useState({ email: '', password: '', fullName: '' });
  const [search,       setSearch]       = useState('');
  const [activeFilter, setActiveFilter] = useState<'pending' | 'active' | 'suspended' | 'rejected'>('pending');

  const { data: managers = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ['webhost-managers-rich'],
    queryFn: async () => {
      const { data: roles } = await supabase
        .from('user_roles')
        .select('id, user_id, created_at, approval_status')
        .eq('role', 'manager')
        .order('created_at', { ascending: false });
      if (!roles?.length) return [];
      return Promise.all((roles || []).map(async (role) => {
        const [profileRes, mpRes, agencyRes] = await Promise.all([
          supabase.from('profiles').select('email, full_name').eq('id', role.user_id).maybeSingle(),
          supabase.from('manager_profiles').select('*').eq('manager_user_id', role.user_id).maybeSingle(),
          supabase.from('agencies').select('name').eq('manager_id', role.user_id).maybeSingle(),
        ]);
        const mp = (mpRes as { data: ManagerProfile | null }).data;
        return {
          id: role.id, user_id: role.user_id,
          email: (profileRes.data as { email?: string; full_name?: string } | null)?.email ?? 'Unknown',
          full_name: (profileRes.data as { email?: string; full_name?: string } | null)?.full_name ?? null,
          created_at: role.created_at,
          approval_status: mp?.status ?? role.approval_status,
          property_count: mp?.property_count ?? 0,
          unit_count: mp?.unit_count ?? 0,
          subscription_tier: mp?.subscription_tier ?? null,
          agency_name: (agencyRes.data as { name?: string } | null)?.name ?? null,
          last_active_at: mp?.last_active_at ?? null,
          rejection_reason: mp?.rejection_reason ?? null,
          suspension_reason: mp?.suspension_reason ?? null,
        } as Manager;
      }));
    },
  });

  // Client-side search across already-fetched manager records (name + email).
  const searchQ = search.trim().toLowerCase();
  const visibleManagers = searchQ
    ? managers.filter(m => (m.full_name?.toLowerCase().includes(searchQ) ?? false) || m.email.toLowerCase().includes(searchQ))
    : managers;

  const pending   = visibleManagers.filter(m => m.approval_status === 'pending');
  const active    = visibleManagers.filter(m => m.approval_status === 'approved');
  const suspended = visibleManagers.filter(m => m.approval_status === 'suspended' || m.approval_status === 'suspended_nonpayment');
  const rejected  = visibleManagers.filter(m => m.approval_status === 'rejected');

  const filteredList = activeFilter === 'pending' ? pending : activeFilter === 'active' ? active : activeFilter === 'suspended' ? suspended : rejected;

  const executeAction = useMutation({
    mutationFn: async () => {
      if (!actionDialog) return;
      const { manager, type } = actionDialog;
      const action = type === 'unsuspend' ? 'reinstate' : type;
      const { error } = await supabase.rpc('transition_manager_admin_atomic', {
        p_manager_user_id: manager.user_id,
        p_action: action,
        p_reason: actionReason || null,
        p_subscription_tier: type === 'set_tier' ? actionTier : null,
      });
      if (error) throw error;

      if (type === 'approve') {
        await supabase.functions.invoke('send-manager-approval-notification', { body: { managerId: manager.user_id, status: 'approved', managerEmail: manager.email, managerName: manager.full_name, note: actionReason } }).catch(() => {});
        try {
          await supabase.rpc('create_manager_contract_atomic', {
            p_manager_user_id: manager.user_id, p_manager_email: manager.email, p_manager_name: manager.full_name || manager.email,
            p_title: 'CALQULUS PMS Platform Service Agreement', p_description: 'Standard service agreement for CALQULUS PMS platform access',
            p_contract_type: 'service_agreement', p_uploaded_contract_url: null, p_valid_from: new Date().toISOString().slice(0, 10), p_valid_until: null,
          });
        } catch (_) {}
        try {
          const { data: existingInv } = await supabase.from('manager_invoices').select('id').eq('manager_user_id', manager.user_id).eq('invoice_type', 'registration').maybeSingle();
          if (!existingInv) {
            const { data: settings } = await supabase.from('webhost_payment_settings').select('registration_fee').maybeSingle();
            const regFee = Number((settings as { registration_fee?: number } | null)?.registration_fee ?? 3000);
            if (regFee > 0) {
              const dueDate = new Date(); dueDate.setDate(dueDate.getDate() + 7);
              await supabase.rpc('create_manager_invoice_atomic', { p_manager_user_id: manager.user_id, p_amount: regFee, p_due_date: dueDate.toISOString().slice(0, 10), p_description: 'One-time platform registration fee', p_invoice_type: 'registration', p_invoice_number: `REG-${manager.user_id.slice(0, 8).toUpperCase()}` });
            }
          }
        } catch (_) {}
      } else if (type === 'reject') {
        await supabase.functions.invoke('send-manager-approval-notification', { body: { managerId: manager.user_id, status: 'rejected', managerEmail: manager.email, reason: actionReason } }).catch(() => {});
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhost-managers-rich'] });
      const labels: Record<string, string> = { approve: 'Approved', reject: 'Rejected', suspend: 'Suspended', unsuspend: 'Reinstated', set_tier: 'Tier updated' };
      toast({ title: labels[actionDialog!.type] });
      setActionDialog(null); setActionReason('');
    },
    onError: (err: Error) => errorToast('Failed', err),
  });

  const createManager = useMutation({
    mutationFn: async () => {
      const { data: authData, error } = await supabase.auth.signUp({
        email: newMgr.email,
        password: newMgr.password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: { full_name: newMgr.fullName, role: 'manager' },
        },
      });
      if (error) throw error;
      if (!authData.user) throw new Error('Failed to create user');
      const { error: provisionError } = await supabase.rpc('provision_manager_account_atomic', {
        p_manager_user_id: authData.user.id,
        p_full_name: newMgr.fullName || null,
      });
      if (provisionError) throw provisionError;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['webhost-managers-rich'] }); toast({ title: 'Manager created' }); setAddOpen(false); setNewMgr({ email: '', password: '', fullName: '' }); },
    onError: (err: Error) => errorToast('Failed', err),
  });

  const ManagerCard = ({ m }: { m: Manager }) => {
    const cfg = STATUS_CONFIG[m.approval_status] ?? STATUS_CONFIG.pending;
    const Icon = cfg.icon;
    const expanded = expandedId === m.user_id;
    return (
      <Card className={`border rounded-2xl shadow-sm transition-all ${
        m.approval_status === 'pending' 
          ? 'border-warning/50 bg-card shadow-warning/5' 
          : m.approval_status.startsWith('suspend') 
          ? 'border-destructive/50 bg-card shadow-destructive/5' 
          : 'border-border bg-card hover:border-primary/40'
      }`}>
        <CardContent className="p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1.5">
                <p className="font-bold text-base text-foreground">{m.full_name || 'Unnamed Manager'}</p>
                <Badge variant="outline" className={`text-[11px] ${cfg.color}`}><Icon className="h-3 w-3 mr-1" />{cfg.label}</Badge>
                {m.subscription_tier && <Badge variant="outline" className={`text-[11px] capitalize ${TIER_BADGE[m.subscription_tier] ?? ''}`}>{m.subscription_tier}</Badge>}
              </div>
              <p className="text-xs text-primary flex items-center gap-1 font-medium"><Mail className="h-3.5 w-3.5 text-primary" />{m.email}</p>
              {m.agency_name && <p className="text-xs text-secondary-foreground mt-1 flex items-center gap-1"><Building2 className="h-3.5 w-3.5 text-secondary-foreground" />{m.agency_name}</p>}
              <div className="flex gap-4 mt-2 text-xs text-secondary-foreground items-center">
                <span className="flex items-center gap-1.5 bg-secondary-background px-2 py-0.5 rounded-md border border-border"><Building2 className="h-3.5 w-3.5 text-primary" /> <strong className="font-['Outfit'] text-foreground font-bold">{m.property_count}</strong> props</span>
                <span className="flex items-center gap-1.5 bg-secondary-background px-2 py-0.5 rounded-md border border-border"><Home className="h-3.5 w-3.5 text-warning" /> <strong className="font-['Outfit'] text-foreground font-bold">{m.unit_count}</strong> units</span>
                {m.last_active_at && <span className="flex items-center gap-1.5 text-secondary-foreground"><Activity className="h-3.5 w-3.5 text-success" />{format(new Date(m.last_active_at), 'dd MMM')}</span>}
              </div>
              {(m.rejection_reason || m.suspension_reason) && (
                <p className="text-xs text-destructive mt-2 flex items-start gap-1.5 bg-destructive/10 p-2 rounded-lg border border-destructive/20"><AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />{m.rejection_reason ?? m.suspension_reason}</p>
              )}
            </div>
            <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
              {m.approval_status === 'pending' && (<>
                <Button size="sm" className="bg-success hover:bg-success/90 text-white h-8 text-xs font-bold rounded-lg" onClick={() => { setActionDialog({ type: 'approve', manager: m }); setActionReason(''); }}><UserCheck className="h-3.5 w-3.5 mr-1" />Approve</Button>
                <Button size="sm" variant="outline" className="border-destructive/50 text-destructive hover:bg-destructive/10 h-8 text-xs font-semibold rounded-lg" onClick={() => { setActionDialog({ type: 'reject', manager: m }); setActionReason(''); }}><UserX className="h-3.5 w-3.5 mr-1" />Reject</Button>
              </>)}
              {m.approval_status === 'approved' && (<>
                <Button size="sm" variant="outline" className="border-border text-primary hover:bg-soft-blue h-8 text-xs font-semibold rounded-lg" onClick={() => { setActionDialog({ type: 'set_tier', manager: m }); setActionTier(m.subscription_tier ?? 'starter'); }}><CreditCard className="h-3.5 w-3.5 mr-1" />Tier</Button>
                <Button size="sm" variant="outline" className="border-warning/50 text-warning hover:bg-warning/10 h-8 text-xs font-semibold rounded-lg" onClick={() => { setActionDialog({ type: 'suspend', manager: m }); setActionReason(''); }}><Ban className="h-3.5 w-3.5 mr-1" />Suspend</Button>
              </>)}
              {(m.approval_status === 'suspended' || m.approval_status === 'suspended_nonpayment' || m.approval_status === 'rejected') && (
                <Button size="sm" className="bg-success hover:bg-success/90 text-white h-8 text-xs font-bold rounded-lg" onClick={() => { setActionDialog({ type: 'unsuspend', manager: m }); setActionReason(''); }}><UserCheck className="h-3.5 w-3.5 mr-1" />Reinstate</Button>
              )}
              <Button variant="outline" size="sm" className="h-8 text-xs font-semibold rounded-lg" asChild>
                <Link to={webhostOrganizationPath(m.user_id)}>Open</Link>
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-secondary-foreground hover:text-primary hover:bg-soft-blue rounded-lg" onClick={() => setExpandedId(expanded ? null : m.user_id)} aria-label={expanded ? "Collapse details" : "Expand details"}>
                {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          {expanded && (
            <div className="mt-3 pt-3 border-t border-border space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-secondary-foreground flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" />Email</span>
                  <span className="text-foreground font-medium truncate text-right">{m.email}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-secondary-foreground">Created</span>
                  <span className="text-foreground font-medium">{format(new Date(m.created_at), 'dd MMM yyyy')}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-secondary-foreground flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5" />Agency</span>
                  <span className="text-foreground font-medium truncate text-right">{m.agency_name ?? '—'}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-secondary-foreground flex items-center gap-1.5"><CreditCard className="h-3.5 w-3.5" />Tier</span>
                  <span className="text-foreground font-medium capitalize text-right">{m.subscription_tier ?? '—'}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-secondary-foreground flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5" />Properties</span>
                  <strong className="font-['Outfit'] text-foreground font-bold">{m.property_count}</strong>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-secondary-foreground flex items-center gap-1.5"><Home className="h-3.5 w-3.5" />Units</span>
                  <strong className="font-['Outfit'] text-foreground font-bold">{m.unit_count}</strong>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-secondary-foreground flex items-center gap-1.5"><Activity className="h-3.5 w-3.5" />Last active</span>
                  <span className="text-foreground font-medium">{m.last_active_at ? format(new Date(m.last_active_at), 'dd MMM yyyy HH:mm') : '—'}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-secondary-foreground">Status</span>
                  <span className="text-foreground font-medium capitalize">{m.approval_status.replace(/_/g, ' ')}</span>
                </div>
              </div>
              {(m.rejection_reason || m.suspension_reason) && (
                <p className="text-xs text-destructive flex items-start gap-1.5 bg-destructive/10 p-2 rounded-lg border border-destructive/20">
                  <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  <span><strong className="block mb-0.5">{m.suspension_reason ? 'Suspension reason' : 'Rejection reason'}</strong>{m.rejection_reason ?? m.suspension_reason}</span>
                </p>
              )}
              <StatusHistory managerId={m.user_id} />
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  const StatusHistory = ({ managerId }: { managerId: string }) => {
    const { data: logs = [] } = useQuery({
      queryKey: ['manager-status-log', managerId],
      queryFn: async () => {
        const { data } = await supabase.from('manager_status_log').select('*').eq('manager_user_id', managerId).order('created_at', { ascending: false }).limit(8);
        return (data || []) as StatusLogEntry[];
      },
    });
    if (!logs.length) return <p className="text-xs text-secondary-foreground/70">No status history.</p>;
    return (
      <div className="space-y-1.5">
        <p className="text-xs font-semibold text-secondary-foreground uppercase tracking-wide">Status history</p>
        {logs.map((l: StatusLogEntry) => (
          <div key={l.id} className="text-xs flex items-start gap-2 text-secondary-foreground">
            <span className="shrink-0">{format(new Date(l.created_at), 'dd MMM HH:mm')}</span>
            <span className="font-medium text-foreground capitalize">{l.old_status ?? '—'} → {l.new_status}</span>
            {l.reason && <span>· {l.reason}</span>}
          </div>
        ))}
      </div>
    );
  };

  const EMPTY_COPY: Record<string, string> = {
    pending: 'No pending manager accounts.',
    active: 'No active manager accounts.',
    suspended: 'No suspended manager accounts.',
    rejected: 'No rejected manager accounts.',
  };

  const FilterList = () => {
    if (isLoading) {
      return (
        <div className="space-y-3 mt-4">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 w-full bg-secondary-background" />)}
        </div>
      );
    }
    if (isError) {
      return (
        <div className="mt-4 p-6 rounded-2xl border border-destructive/30 bg-destructive/5 text-center">
          <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-destructive" />
          <p className="text-sm font-semibold text-destructive">Failed to load managers</p>
          <p className="text-xs text-secondary-foreground mt-1 mb-3">{(error as Error)?.message ?? 'You may not have permission to view this data.'}</p>
          <Button variant="outline" size="sm" onClick={() => refetch()} className="border-destructive/40 text-destructive hover:bg-destructive/10">
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Retry
          </Button>
        </div>
      );
    }
    if (filteredList.length === 0) {
      const copy = searchQ
        ? `No managers match "${search.trim()}" in ${activeFilter}.`
        : EMPTY_COPY[activeFilter];
      return (
        <EmptyState className="mt-4" icon={Users} title={copy} />
      );
    }
    return (
      <div className="space-y-3 mt-4">
        {filteredList.map(m => <ManagerCard key={m.user_id} m={m} />)}
      </div>
    );
  };

  return (
    <div className="space-y-5">
      {/* Header: title, search, refresh, add */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 enterprise-card p-4 sm:p-5">
        <div>
          <h2 className="section-title flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Manager Account Control Center
          </h2>
          <p className="supporting-text mt-1">
            Approve, suspend, reinstate, and tier manager accounts. All actions are audit-logged.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 lg:w-64">
            <Mail className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-secondary-foreground" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name or email..."
              className="pl-8 h-9 rounded-xl bg-card border-border text-foreground placeholder:text-secondary-foreground text-xs"
              aria-label="Search managers by name or email"
            />
          </div>
          <Button variant="outline" size="sm" className="border-border text-secondary-foreground hover:bg-soft-blue hover:text-primary h-9 rounded-xl font-medium text-xs" onClick={() => refetch()} aria-label="Refresh manager list"><RefreshCw className="h-3.5 w-3.5 mr-1.5" />Refresh</Button>
          <Button size="sm" className="bg-primary hover:bg-primary/90 text-white font-bold h-9 rounded-xl text-xs" onClick={() => setAddOpen(true)}><UserPlus className="h-3.5 w-3.5 mr-1.5" />Add Manager</Button>
        </div>
      </div>

      {/* Clickable status summary — acts as the filter (clicking sets the active list) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {([
          { key: 'total',    label: 'Total',     count: managers.length,   icon: Users,      active: false, cls: 'border-border bg-card text-secondary-foreground' },
          { key: 'pending',   label: 'Pending',   count: pending.length,   icon: Clock,      active: activeFilter === 'pending',   cls: 'border-warning/40 bg-warning/10 text-warning' },
          { key: 'active',    label: 'Active',    count: active.length,    icon: CheckCircle, active: activeFilter === 'active',    cls: 'border-success/40 bg-success/10 text-success' },
          { key: 'suspended', label: 'Suspended', count: suspended.length, icon: Ban,        active: activeFilter === 'suspended', cls: 'border-warning/40 bg-warning/10 text-warning' },
          { key: 'rejected',  label: 'Rejected',  count: rejected.length,  icon: UserX,      active: activeFilter === 'rejected',  cls: 'border-destructive/40 bg-destructive/10 text-destructive' },
        ] as const).map(({ key, label, count, icon: Icon, active, cls }) => {
          const isTotal = key === 'total';
          const handleClick = () => { if (!isTotal) setActiveFilter(key as typeof activeFilter); };
          return (
            <button
              key={key}
              type="button"
              onClick={handleClick}
              onKeyDown={onActivateKey(handleClick)}
              role={isTotal ? 'status' : 'button'}
              tabIndex={isTotal ? -1 : 0}
              aria-pressed={isTotal ? undefined : active}
              aria-label={isTotal ? `${count} total managers` : `Filter ${label}: ${count} managers`}
              className={cn(
                'flex items-center justify-between gap-2 p-3 rounded-xl border text-left transition-all',
                cls,
                !isTotal && 'hover:brightness-105 cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/30',
                active && 'ring-2 ring-primary/60',
              )}
            >
              <div className="min-w-0">
                <span className="text-[10px] font-bold uppercase tracking-wide opacity-80 block">{label}</span>
                <strong className="font-['Outfit'] text-xl font-bold text-foreground">{count}</strong>
              </div>
              <Icon className={cn('h-5 w-5 shrink-0', isTotal && 'opacity-60')} />
            </button>
          );
        })}
      </div>

      {pending.length > 0 && (
        <div className="flex items-center gap-2.5 p-3.5 rounded-xl border border-warning/40 bg-warning/10 text-warning shadow-sm">
          <Clock className="h-4 w-4 shrink-0 text-warning" />
          <span className="text-xs font-semibold">
            <strong className="font-['Outfit'] text-warning text-sm font-bold mr-1">{pending.length}</strong>
            manager{pending.length > 1 ? 's' : ''} awaiting approval and credential verification
          </span>
        </div>
      )}

      <FilterList />

      {/* Action dialog */}
      <Dialog open={!!actionDialog} onOpenChange={open => !open && setActionDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {{'approve':'Approve manager','reject':'Reject manager','suspend':'Suspend manager','unsuspend':'Reinstate manager','set_tier':'Set subscription tier'}[actionDialog?.type ?? ''] ?? ''}
            </DialogTitle>
            <DialogDescription>{actionDialog?.manager.full_name ?? actionDialog?.manager.email}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {actionDialog?.type === 'set_tier' && (
              <div>
                <Label>Subscription tier</Label>
                <Select value={actionTier} onValueChange={setActionTier}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[['starter','Starter — 5 props','KES 500/prop'],['growth','Growth — 20 props','KES 450/prop'],['professional','Professional — 50 props','KES 400/prop'],['enterprise','Enterprise — unlimited','KES 350/prop']].map(([v,l,p]) => (
                      <SelectItem key={v} value={v}><span>{l}</span><span className="text-xs text-secondary-foreground ml-2">{p}</span></SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {actionDialog?.type !== 'set_tier' && (
              <div>
                <Label>{actionDialog?.type === 'approve' || actionDialog?.type === 'unsuspend' ? 'Note (optional)' : 'Reason (required)'}</Label>
                <Textarea value={actionReason} onChange={e => setActionReason(e.target.value)}
                  placeholder={actionDialog?.type === 'reject' ? 'This will be emailed to the manager.' : actionDialog?.type === 'suspend' ? 'Internal record.' : ''}
                  rows={3} className="mt-1 resize-none" />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialog(null)}>Cancel</Button>
            <Button onClick={() => executeAction.mutate()} disabled={executeAction.isPending}
              className={actionDialog?.type === 'approve' || actionDialog?.type === 'unsuspend' ? 'bg-success hover:bg-success/90 text-white' : actionDialog?.type === 'reject' || actionDialog?.type === 'suspend' ? 'bg-destructive hover:bg-destructive/90 text-white' : ''}>
              {executeAction.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {{'approve':'Approve','reject':'Reject','suspend':'Suspend','unsuspend':'Reinstate','set_tier':'Save tier'}[actionDialog?.type ?? ''] ?? 'Confirm'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add manager */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Create manager account</DialogTitle><DialogDescription>Pre-approved and immediately active.</DialogDescription></DialogHeader>
          <div className="space-y-3 py-2">
            <div><Label>Full name</Label><Input value={newMgr.fullName} onChange={e => setNewMgr(p => ({...p, fullName: e.target.value}))} className="mt-1" /></div>
            <div><Label>Email</Label><Input type="email" value={newMgr.email} onChange={e => setNewMgr(p => ({...p, email: e.target.value}))} className="mt-1" /></div>
            <div><Label>Password</Label><Input type="password" value={newMgr.password} onChange={e => setNewMgr(p => ({...p, password: e.target.value}))} className="mt-1" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={() => createManager.mutate()} disabled={createManager.isPending || !newMgr.email || !newMgr.password}>
              {createManager.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Create manager
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ManagerManagement;
