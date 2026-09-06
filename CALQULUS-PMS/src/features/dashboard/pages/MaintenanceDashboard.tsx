import { DashboardLoadingSkeleton } from "@/features/dashboard/components/DashboardLoadingSkeleton";
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/features/auth/AuthContext';
import { useManagerScope } from '@/shared/hooks/useManagerScope';
import { DashboardGrid, DashboardWidget, DashboardKPI, DashboardAlertBanner } from '@/features/dashboard/framework';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/components/ui/table';
import {
  Wrench, AlertTriangle, Clock, CheckCircle2, UserCheck, ShieldAlert,
  Building2, Plus, RefreshCw, PhoneCall, Filter, ExternalLink, ArrowRight
} from 'lucide-react';
import { format, differenceInMinutes, subDays } from 'date-fns';

export default function MaintenanceDashboard() {
  const { user } = useAuth();
  const { managerId, restrictToAssignedProperties, assignedPropertyIds } = useManagerScope();

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['maintenance-dashboard-data', managerId, restrictToAssignedProperties, assignedPropertyIds],
    queryFn: async () => {
      if (!user || !managerId) return null;
      if (restrictToAssignedProperties && assignedPropertyIds.length === 0) return { allRequests: [], urgentRequests: [], metrics: { pendingCount: 0, inProgressCount: 0, urgentCount: 0, completedCount: 0, avgDispatchHours: null } };

      const [
        { data: allRequests },
        { data: urgentRequests },
        { data: inProgressRequests },
        { data: completedRequests },
        { data: scopedProperties },
      ] = await Promise.all([
        (() => { let q = supabase.from('maintenance_requests').select('id, title, priority, status, created_at, unit_id, description, provider_started_at, completion_date, manager_id, property_name').eq('manager_id', managerId).order('created_at', { ascending: false }).limit(50); return q; })(),
        supabase.from('maintenance_requests').select('id, title, priority, status, created_at, manager_id, property_name').eq('manager_id', managerId).eq('priority', 'urgent').neq('status', 'completed'),
        supabase.from('maintenance_requests').select('id, manager_id, property_name').eq('manager_id', managerId).eq('status', 'in_progress'),
        supabase.from('maintenance_requests').select('id, created_at, provider_started_at, completion_date, manager_id, property_name').eq('manager_id', managerId).gte('created_at', subDays(new Date(), 90).toISOString()).eq('status', 'completed'),
        (() => { let q = supabase.from('properties').select('id, name').eq('manager_id', managerId); if (restrictToAssignedProperties) q = q.in('id', assignedPropertyIds); return q; })(),
      ]);

      const scopedNames = new Set((scopedProperties || []).map((p: any) => p.name));
      const inScope = (rows: any[]) => restrictToAssignedProperties ? rows.filter((r) => scopedNames.has(r.property_name)) : rows;
      const scopedAllRequests = inScope(allRequests || []);
      const scopedUrgentRequests = inScope(urgentRequests || []);
      const scopedInProgressRequests = inScope(inProgressRequests || []);
      const scopedCompletedRequests = inScope(completedRequests || []);
      const pendingCount = scopedAllRequests.filter(r => r.status === 'pending').length;
      const inProgressCount = scopedInProgressRequests.length;
      const urgentCount = scopedUrgentRequests.length;
      const completedCount = scopedCompletedRequests.length;
      const completedWithDispatch = scopedCompletedRequests.filter(r => r.created_at && r.provider_started_at);
      const avgDispatchHours = completedWithDispatch.length > 0
        ? completedWithDispatch.reduce((sum, r) => sum + Math.max(0, differenceInMinutes(new Date(r.provider_started_at as string), new Date(r.created_at as string))), 0) / completedWithDispatch.length / 60
        : null;
      return {
        allRequests: scopedAllRequests,
        urgentRequests: scopedUrgentRequests,
        metrics: {
          pendingCount,
          inProgressCount,
          urgentCount,
          completedCount,
          avgDispatchHours,
        },
      };
    },
  });

  if (isLoading) {
    return <DashboardLoadingSkeleton />;
  }

  const alerts = [
    {
      id: 'urgent-repair-alert',
      type: 'critical' as const,
      title: 'Urgent Maintenance Tickets Pending',
      message: `${data?.metrics.urgentCount || 0} urgent tickets require immediate vendor dispatch (priority: urgent).`,
      count: data?.metrics.urgentCount || 0,
      actionLabel: 'Dispatch Vendor',
      onAction: () => window.location.href = '/maintenance',
    }
  ];

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-[1800px] mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black tracking-tight text-foreground">Maintenance & Operations Command Center</h1>
            <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20 font-bold">
              Maintenance Coordinator Workspace
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Real-time work order tracking, vendor dispatch, SLA performance monitoring, and property repairs.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="gap-1.5 h-9">
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            Sync Tickets
          </Button>
          <Button size="sm" className="gap-1.5 h-9 font-semibold" onClick={() => window.location.href = '/maintenance'}>
            <Plus className="h-3.5 w-3.5" />
            New Work Order
          </Button>
        </div>
      </div>

      {/* Alerts */}
      <DashboardAlertBanner alerts={alerts} />

      {/* KPIs */}
      <DashboardGrid columns={4}>
        <DashboardKPI
          title="Urgent Repairs"
          value={data?.metrics.urgentCount || 0}
          subtitle="Immediate dispatch required"
          icon={AlertTriangle}
          color="danger"
        />
        <DashboardKPI
          title="In-Progress Work Orders"
          value={data?.metrics.inProgressCount || 0}
          subtitle="Assigned to active vendors"
          icon={Wrench}
          color="warning"
        />
        <DashboardKPI
          title="Unassigned Requests"
          value={data?.metrics.pendingCount || 0}
          subtitle="Awaiting triage & vendor"
          icon={Clock}
          color="info"
        />
        <DashboardKPI
          title="Completed (90 days)"
          value={data?.metrics.completedCount || 0}
          subtitle={data?.metrics.avgDispatchHours != null ? `Avg dispatch ${data.metrics.avgDispatchHours.toFixed(1)} hrs` : "Dispatch time not yet measured"}
          icon={CheckCircle2}
          color="success"
        />
      </DashboardGrid>

      {/* Work Orders Table */}
      <DashboardGrid columns={12}>
        <DashboardWidget
          title="Active Work Orders & Repairs"
          description="Live ticket queue sorted by priority and response SLA"
          icon={Wrench}
          colSpan={8}
          accentColor="amber"
          badge={`${data?.allRequests.length || 0} tickets`}
        >
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Ticket Title</TableHead>
                  <TableHead className="text-xs">Priority</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                  <TableHead className="text-xs">Created</TableHead>
                  <TableHead className="text-xs text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.allRequests.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-6 text-muted-foreground text-xs">
                      No active maintenance requests found.
                    </TableCell>
                  </TableRow>
                ) : (
                  data?.allRequests.map((req) => (
                    <TableRow key={req.id}>
                      <TableCell className="font-semibold text-xs text-foreground truncate max-w-[200px]">
                        {req.title}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`text-[10px] uppercase font-bold ${
                            req.priority === 'urgent'
                              ? 'bg-red-500/10 text-red-600 border-red-500/30'
                              : req.priority === 'high'
                              ? 'bg-warning/10 text-warning border-warning/30'
                              : 'bg-muted text-muted-foreground'
                          }`}
                        >
                          {req.priority}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px] capitalize">
                          {req.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {req.created_at ? format(new Date(req.created_at), 'MMM dd, HH:mm') : 'N/A'}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="outline" className="h-6 text-[11px]" onClick={() => window.location.href = '/maintenance'}>
                          Manage
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </DashboardWidget>

        <DashboardWidget
          title="Maintenance Dispatch Shortcuts"
          description="Quick vendor allocation and escalation tools"
          icon={UserCheck}
          colSpan={4}
          accentColor="emerald"
        >
          <div className="space-y-2.5">
            <Button variant="outline" className="w-full justify-between h-11 text-xs font-semibold" onClick={() => window.location.href = '/maintenance'}>
              <span className="flex items-center gap-2"><PhoneCall className="h-4 w-4 text-success" /> Dispatch Emergency Vendor</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
            <Button variant="outline" className="w-full justify-between h-11 text-xs font-semibold" onClick={() => window.location.href = '/maintenance'}>
              <span className="flex items-center gap-2"><Wrench className="h-4 w-4 text-warning" /> Schedule Property Inspection</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
            <Button variant="outline" className="w-full justify-between h-11 text-xs font-semibold" onClick={() => window.location.href = '/maintenance'}>
              <span className="flex items-center gap-2"><ShieldAlert className="h-4 w-4 text-red-500" /> Escalate Urgent Repair SLA</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </DashboardWidget>
      </DashboardGrid>
    </div>
  );
}
