// @ts-nocheck — Phase 12: remaining local types until live supabase gen types
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/features/auth/AuthContext';
import { useCurrency } from '@/shared/hooks/useCurrency';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';
import {
  Table, TableBody, TableCell,
  TableHead, TableHeader, TableRow,
} from '@/shared/components/ui/table';
import {
  Users, Wrench, FileSignature, CalendarX,
  Activity, Home, TrendingUp, AlertTriangle,
  CheckCircle, Clock, Archive, User, Key, Bell
} from 'lucide-react';
import UnitKeyTracker from '@/features/units/components/UnitKeyTracker';
import UnitInspectionChecklist from '@/features/units/components/UnitInspectionChecklist';
import { format, differenceInMonths } from 'date-fns';

interface UnitHistoryPanelProps {
  unitId: string;
  unitLabel: string;
  propertyId: string;
}

interface UnitTenancyHistoryRow {
  id: string;
  status: string;
  tenant_name: string;
  tenant_email: string;
  tenant_phone?: string | null;
  tenant_id?: string | null;
  move_in_date: string;
  move_out_date?: string | null;
  move_out_reason?: string | null;
  move_out_notes?: string | null;
  monthly_rent?: number | null;
  total_paid?: number | null;
  arrears_at_moveout?: number | null;
}

interface MaintenanceRow {
  id: string;
  title: string;
  description?: string | null;
  status: string;
  priority: string;
  category?: string | null;
  requested_date: string;
  completion_date?: string | null;
  tenant_name?: string | null;
  cost_actual?: number | null;
  archived_at?: string | null;
}

interface ContractRow {
  id: string;
  title: string;
  status: string;
  created_at: string;
  tenant_signed_at?: string | null;
  manager_signed_at?: string | null;
  archived_at?: string | null;
  archive_reason?: string | null;
  tenant_id?: string | null;
}

interface VacationNoticeRow {
  id: string;
  tenant_name: string;
  tenant_email?: string | null;
  notice_date?: string | null;
  intended_move_out_date?: string | null;
  status: string;
  reason?: string | null;
  manager_notes?: string | null;
  created_at: string;
}

interface UnitActivityLogRow {
  id: string;
  event_type: string;
  title: string;
  description?: string | null;
  created_at: string;
  triggered_by_role?: string | null;
}

interface EventIconConfig {
  icon: React.ElementType;
  color: string;
  bg: string;
}

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-100 text-green-800 border-green-200',
  archived: 'bg-slate-100 text-slate-700 border-slate-200',
  transferred: 'bg-[hsl(214_73%_48%/0.12)] text-[hsl(214_73%_35%)] border-[hsl(214_73%_48%/0.25)]',
  open: 'bg-amber-100 text-amber-800 border-amber-200',
  in_progress: 'bg-[hsl(218_58%_35%/0.12)] text-[hsl(218_58%_30%)] border-[hsl(218_58%_35%/0.25)]',
  completed: 'bg-green-100 text-green-800 border-green-200',
  cancelled: 'bg-slate-100 text-slate-600 border-slate-200',
  pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  pending_signature: 'bg-amber-100 text-amber-800 border-amber-200',
  draft: 'bg-slate-100 text-slate-600 border-slate-200',
  expired: 'bg-red-100 text-red-700 border-red-200',
  terminated: 'bg-red-100 text-red-700 border-red-200',
  acknowledged: 'bg-[hsl(214_73%_48%/0.12)] text-[hsl(214_73%_35%)] border-[hsl(214_73%_48%/0.25)]',
  approved: 'bg-green-100 text-green-800 border-green-200',
};

const fmt = (n: number) =>
  new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 0 }).format(n);

const UnitHistoryPanel: React.FC<UnitHistoryPanelProps> = ({ unitId, unitLabel, propertyId }) => {
  const { user } = useAuth();
  const { formatCurrency } = useCurrency();

  // ── Tenancy history ────────────────────────────────────────────────────
  const { data: tenancies = [], isLoading: tenanciesLoading } = useQuery({
    queryKey: ['unit-tenancy-history', unitId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('unit_tenancy_history')
        .select('*')
        .eq('unit_id', unitId)
        .order('move_in_date', { ascending: false });
      if (error) throw error;
      return (data || []) as UnitTenancyHistoryRow[];
    },
  });

  // ── Maintenance requests ───────────────────────────────────────────────
  const { data: maintenance = [], isLoading: maintLoading } = useQuery({
    queryKey: ['unit-maintenance', unitId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('maintenance_requests')
        .select('id, title, description, status, priority, category, requested_date, completion_date, tenant_name, cost_actual, archived_at')
        .eq('unit_id', unitId)
        .order('requested_date', { ascending: false });
      if (error) throw error;
      return (data || []) as MaintenanceRow[];
    },
  });

  // ── Contracts / agreements ─────────────────────────────────────────────
  const { data: contracts = [], isLoading: contractsLoading } = useQuery({
    queryKey: ['unit-contracts', unitId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contracts')
        .select('id, title, status, created_at, tenant_signed_at, manager_signed_at, archived_at, archive_reason, tenant_id')
        .eq('unit_id', unitId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as ContractRow[];
    },
  });

  // ── Vacation / move-out notices ────────────────────────────────────────
  const { data: notices = [], isLoading: noticesLoading } = useQuery({
    queryKey: ['unit-notices', unitId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vacation_notices')
        .select('id, tenant_name, tenant_email, notice_date, intended_move_out_date, status, reason, manager_notes, created_at')
        .eq('unit_id', unitId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as VacationNoticeRow[];
    },
  });

  // ── Unit activity log ──────────────────────────────────────────────────
  const { data: activity = [], isLoading: activityLoading } = useQuery({
    queryKey: ['unit-activity-log', unitId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('unit_activity_log')
        .select('*')
        .eq('unit_id', unitId)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data || []) as UnitActivityLogRow[];
    },
  });

  const activeTenancy = tenancies.find(t => t.status === 'active');
  const pastTenancies = tenancies.filter(t => t.status !== 'active');
  const openMaintenance = maintenance.filter(m => ['open', 'in_progress'].includes(m.status)).length;

  const EVENT_ICONS: Record<string, EventIconConfig> = {
    tenant_moved_in:       { icon: User,         color: 'text-green-600',  bg: 'bg-green-50' },
    tenant_moved_out:      { icon: Archive,       color: 'text-slate-600',  bg: 'bg-slate-50' },
    maintenance_raised:    { icon: Wrench,        color: 'text-warning',  bg: 'bg-amber-50' },
    maintenance_resolved:  { icon: CheckCircle,   color: 'text-green-600',  bg: 'bg-green-50' },
    notice_submitted:      { icon: CalendarX,     color: 'text-orange-600', bg: 'bg-orange-50' },
    lease_created:         { icon: FileSignature, color: 'text-[hsl(214_73%_45%)]',   bg: 'bg-[hsl(214_73%_48%/0.08)]'  },
    lease_signed:          { icon: CheckCircle,   color: 'text-green-600',  bg: 'bg-green-50' },
    contract_signed:       { icon: CheckCircle,   color: 'text-green-600',  bg: 'bg-green-50' },
    payment_recorded:      { icon: TrendingUp,    color: 'text-green-600',  bg: 'bg-green-50' },
    deposit_received:      { icon: TrendingUp,    color: 'text-[hsl(218_58%_38%)]', bg: 'bg-[hsl(218_58%_38%/0.08)]' },
    deposit_refunded:      { icon: Activity,      color: 'text-[hsl(214_73%_45%)]',   bg: 'bg-[hsl(214_73%_48%/0.08)]'  },
  };

  return (
    <div className="space-y-4">
      {/* Current occupancy summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-lg border border-border p-3 bg-muted/20">
          <p className="text-xs text-muted-foreground mb-1">Current tenant</p>
          <p className="text-sm font-medium">
            {activeTenancy ? activeTenancy.tenant_name : (
              <span className="text-muted-foreground italic">Vacant</span>
            )}
          </p>
        </div>
        <div className="rounded-lg border border-border p-3 bg-muted/20">
          <p className="text-xs text-muted-foreground mb-1">Previous tenants</p>
          <p className="text-sm font-semibold">{pastTenancies.length}</p>
        </div>
        <div className="rounded-lg border border-border p-3 bg-muted/20">
          <p className="text-xs text-muted-foreground mb-1">Open maintenance</p>
          <p className={`text-sm font-semibold ${openMaintenance > 0 ? 'text-warning' : 'text-success'}`}>
            {openMaintenance}
          </p>
        </div>
        <div className="rounded-lg border border-border p-3 bg-muted/20">
          <p className="text-xs text-muted-foreground mb-1">Total contracts</p>
          <p className="text-sm font-semibold">{contracts.length}</p>
        </div>
      </div>

      <Tabs defaultValue="tenants">
        <TabsList className="flex-wrap h-auto gap-1 p-1">
          <TabsTrigger value="tenants" className="gap-1.5 text-xs">
            <Users className="h-3.5 w-3.5" />
            Tenants ({tenancies.length})
          </TabsTrigger>
          <TabsTrigger value="maintenance" className="gap-1.5 text-xs">
            <Wrench className="h-3.5 w-3.5" />
            Maintenance ({maintenance.length})
            {openMaintenance > 0 && (
              <Badge className="ml-0.5 h-4 min-w-4 text-xs px-1 bg-amber-100 text-amber-800 border-amber-200">
                {openMaintenance}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="contracts" className="gap-1.5 text-xs">
            <FileSignature className="h-3.5 w-3.5" />
            Contracts ({contracts.length})
          </TabsTrigger>
          <TabsTrigger value="notices" className="gap-1.5 text-xs">
            <CalendarX className="h-3.5 w-3.5" />
            Notices ({notices.length})
          </TabsTrigger>
          <TabsTrigger value="activity" className="gap-1.5 text-xs">
            <Activity className="h-3.5 w-3.5" />
            Activity log
          </TabsTrigger>
          <TabsTrigger value="keys" className="gap-1.5 text-xs">
            <Key className="h-3.5 w-3.5" />
            Keys
          </TabsTrigger>
        </TabsList>

        {/* ── Tenancy history ── */}
        <TabsContent value="tenants" className="mt-4">
          {tenanciesLoading ? (
            <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
          ) : tenancies.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground">
              <Users className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No tenancy records for this unit yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {tenancies.map(t => {
                const months = t.move_out_date
                  ? differenceInMonths(new Date(t.move_out_date), new Date(t.move_in_date))
                  : differenceInMonths(new Date(), new Date(t.move_in_date));
                return (
                  <div key={t.id} className={`rounded-lg border p-4 ${t.status === 'active' ? 'border-green-200 bg-green-50/40' : 'border-border bg-muted/10'}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-medium text-sm">{t.tenant_name}</p>
                          <Badge variant="outline" className={`text-xs ${STATUS_COLORS[t.status]}`}>
                            {t.status === 'active' ? 'Current' : t.status}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">{t.tenant_email}</p>
                        {t.tenant_phone && <p className="text-xs text-muted-foreground">{t.tenant_phone}</p>}
                        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                          <span>Moved in: {t.move_in_date ? format(new Date(t.move_in_date), 'dd/MM/yy') : '—'}</span>
                          {t.move_out_date && <span>Moved out: {format(new Date(t.move_out_date), 'dd/MM/yy')}</span>}
                          <span className="text-foreground font-medium">{months} months</span>
                        </div>
                        {t.move_out_reason && (
                          <p className="text-xs text-muted-foreground mt-1">Reason: {t.move_out_reason}</p>
                        )}
                      </div>
                      <div className="text-right shrink-0 space-y-1">
                        <div>
                          <p className="text-xs text-muted-foreground">Monthly rent</p>
                          <p className="text-sm font-semibold">{t.monthly_rent ? fmt(t.monthly_rent) : '—'}</p>
                        </div>
                        {t.total_paid > 0 && (
                          <div>
                            <p className="text-xs text-muted-foreground">Total paid</p>
                            <p className="text-sm font-medium text-foreground">{fmt(t.total_paid)}</p>
                          </div>
                        )}
                        {t.arrears_at_moveout > 0 && (
                          <div>
                            <p className="text-xs text-muted-foreground">Arrears at exit</p>
                            <p className="text-sm font-medium text-destructive">{fmt(t.arrears_at_moveout)}</p>
                          </div>
                        )}
                      </div>
                    </div>
                    {t.move_out_notes && (
                      <p className="mt-2 text-xs text-muted-foreground border-t border-border/50 pt-2">{t.move_out_notes}</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ── Maintenance history ── */}
        <TabsContent value="maintenance" className="mt-4">
          {maintLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : maintenance.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground">
              <Wrench className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No maintenance requests for this unit</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Raised by</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Requested</TableHead>
                  <TableHead>Completed</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {maintenance.map(m => (
                  <TableRow key={m.id} className={m.archived_at ? 'opacity-60' : ''}>
                    <TableCell>
                      <div>
                        <p className="text-sm font-medium">{m.title}</p>
                        {m.category && <p className="text-xs text-muted-foreground capitalize">{m.category}</p>}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{m.tenant_name}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-xs capitalize ${STATUS_COLORS[m.priority] || ''}`}>
                        {m.priority}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-xs capitalize ${STATUS_COLORS[m.status] || ''}`}>
                        {m.status.replace('_', ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {m.requested_date ? format(new Date(m.requested_date), 'dd/MM/yy') : '—'}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {m.completion_date ? format(new Date(m.completion_date), 'dd/MM/yy') : '—'}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {m.cost_actual ? fmt(m.cost_actual) : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TabsContent>

        {/* ── Contracts ── */}
        <TabsContent value="contracts" className="mt-4">
          {contractsLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : contracts.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground">
              <FileSignature className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No contracts for this unit</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Tenant signed</TableHead>
                  <TableHead>Manager signed</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Archive reason</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contracts.map(c => (
                  <TableRow key={c.id} className={c.archived_at ? 'opacity-60' : ''}>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        {c.archived_at && <Archive className="h-3.5 w-3.5 text-muted-foreground" />}
                        <span className="text-sm font-medium">{c.title}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-xs capitalize ${STATUS_COLORS[c.status] || ''}`}>
                        {c.status.replace(/_/g, ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {c.tenant_signed_at
                        ? <span className="text-green-700 flex items-center gap-1"><CheckCircle className="h-3 w-3" />{format(new Date(c.tenant_signed_at), 'dd/MM/yy')}</span>
                        : <span className="text-warning">Pending</span>
                      }
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {c.manager_signed_at
                        ? <span className="text-green-700 flex items-center gap-1"><CheckCircle className="h-3 w-3" />{format(new Date(c.manager_signed_at), 'dd/MM/yy')}</span>
                        : <span className="text-warning">Pending</span>
                      }
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {format(new Date(c.created_at), 'dd/MM/yy')}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground capitalize">
                      {c.archive_reason?.replace(/_/g, ' ') || '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TabsContent>

        {/* ── Vacation / move-out notices ── */}
        <TabsContent value="notices" className="mt-4">
          {noticesLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : notices.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground">
              <CalendarX className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No move-out notices for this unit</p>
            </div>
          ) : (
            <div className="space-y-3">
              {notices.map(n => (
                <div key={n.id} className="rounded-lg border border-border p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium text-sm">{n.tenant_name}</p>
                        <Badge variant="outline" className={`text-xs capitalize ${STATUS_COLORS[n.status] || ''}`}>
                          {n.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{n.tenant_email}</p>
                      {n.reason && <p className="text-xs text-muted-foreground mt-1">Reason: {n.reason}</p>}
                      {n.manager_notes && <p className="text-xs text-muted-foreground mt-1 italic">Manager: {n.manager_notes}</p>}
                    </div>
                    <div className="text-right text-xs text-muted-foreground space-y-1">
                      <div>Notice: {n.notice_date ? format(new Date(n.notice_date), 'dd/MM/yy') : '—'}</div>
                      <div className="font-medium">Move-out: {n.intended_move_out_date ? format(new Date(n.intended_move_out_date), 'dd/MM/yy') : '—'}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── Activity log ── */}
        <TabsContent value="activity" className="mt-4">
          {activityLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : activity.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground">
              <Activity className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No activity recorded yet for this unit</p>
            </div>
          ) : (
            <div className="space-y-2">
              {activity.map((a: UnitActivityLogRow) => {
                const ev = EVENT_ICONS[a.event_type] ?? { icon: Activity, color: 'text-muted-foreground', bg: 'bg-muted' };
                const Icon = ev.icon;
                return (
                  <div key={a.id} className="flex items-start gap-3 p-3 rounded-lg border border-border/50 hover:border-border transition-colors">
                    <div className={`h-7 w-7 rounded-full ${ev.bg} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                      <Icon className={`h-3.5 w-3.5 ${ev.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium leading-tight">{a.title}</p>
                      {a.description && <p className="text-xs text-muted-foreground mt-0.5">{a.description}</p>}
                      <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {format(new Date(a.created_at), 'dd MMM yyyy · HH:mm')}
                        {a.triggered_by_role && <span className="ml-1 capitalize">· by {a.triggered_by_role}</span>}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ── Keys ── */}
        <TabsContent value="keys" className="mt-4">
          <UnitKeyTracker
            unitId={unitId}
            unitLabel={unitLabel}
            propertyId={propertyId}
            currentTenantId={tenancies.find(t => t.status === 'active')?.tenant_id}
            currentTenantName={tenancies.find(t => t.status === 'active')?.tenant_name}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default UnitHistoryPanel;
