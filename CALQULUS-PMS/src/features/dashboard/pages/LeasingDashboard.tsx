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
  FileCheck, Users, Home, Calendar, Clock, ArrowRight, RefreshCw,
  Plus, CheckCircle2, TrendingUp, AlertCircle, Sparkles, UserPlus
} from 'lucide-react';
import { format, subDays } from 'date-fns';

export default function LeasingDashboard() {
  const { user } = useAuth();
  const { managerId, restrictToAssignedProperties, assignedPropertyIds } = useManagerScope();

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['leasing-dashboard-data', managerId, restrictToAssignedProperties, assignedPropertyIds],
    queryFn: async () => {
      if (!user || !managerId) return null;
      if (restrictToAssignedProperties && assignedPropertyIds.length === 0) return { expiringLeases: [], pendingInvites: [], metrics: { totalUnits: 0, totalOccupied: 0, vacantUnits: 0, occupancyRate: 0, activeLeaseCount: 0, expiringCount: 0, pendingInviteCount: 0 } };

      const [
        { data: activeLeases },
        { data: expiringLeases },
        { data: properties },
        { data: pendingInvites },
      ] = await Promise.all([
        (() => { let q = supabase.from('leases').select('id, monthly_rent, status, start_date, end_date, property_id').eq('status', 'active'); if (restrictToAssignedProperties) q = q.in('property_id', assignedPropertyIds); return q; })(),
        (() => { let q = supabase.from('leases').select('id, monthly_rent, status, end_date, unit, property_id').eq('status', 'expiring').limit(10); if (restrictToAssignedProperties) q = q.in('property_id', assignedPropertyIds); return q; })(),
        (() => { let q = supabase.from('properties').select('id, name, units, occupied').eq('manager_id', managerId); if (restrictToAssignedProperties) q = q.in('id', assignedPropertyIds); return q; })(),
        (() => { let q = supabase.from('tenant_invitations').select('id, email, tenant_name, created_at, status, property_id').eq('invited_by', managerId).eq('status', 'pending').limit(10); if (restrictToAssignedProperties) q = q.in('property_id', assignedPropertyIds); return q; })(),
      ]);

      const totalUnits = (properties || []).reduce((sum, p) => sum + (p.units || 0), 0);
      const totalOccupied = (properties || []).reduce((sum, p) => sum + (p.occupied || 0), 0);
      const vacantUnits = totalUnits - totalOccupied;
      const occupancyRate = totalUnits > 0 ? Math.round((totalOccupied / totalUnits) * 100) : 0;

      return {
        expiringLeases: expiringLeases || [],
        pendingInvites: pendingInvites || [],
        metrics: {
          totalUnits,
          totalOccupied,
          vacantUnits,
          occupancyRate,
          activeLeaseCount: (activeLeases || []).length,
          expiringCount: (expiringLeases || []).length,
          pendingInviteCount: (pendingInvites || []).length,
        },
      };
    },
  });

  if (isLoading) {
    return <DashboardLoadingSkeleton />;
  }

  const alerts = [
    {
      id: 'expiring-leases-alert',
      type: 'warning' as const,
      title: 'Lease Renewal Action Required',
      message: `${data?.metrics.expiringCount || 0} active leases are expiring in the next 60 days. Dispatch renewal offers now.`,
      count: data?.metrics.expiringCount || 0,
      actionLabel: 'View Leases',
      onAction: () => window.location.href = '/leases',
    }
  ];

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-[1800px] mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black tracking-tight text-foreground">Leasing & Occupancy Command Center</h1>
            <Badge variant="outline" className="bg-navy-mid/10 text-navy-mid border-navy-mid/20 font-bold">
              Leasing Officer Workspace
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Unit vacancy management, tenant onboarding pipeline, lease renewals, and lease agreement execution.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="gap-1.5 h-9">
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            Sync Pipeline
          </Button>
          <Button size="sm" className="gap-1.5 h-9 font-semibold" onClick={() => window.location.href = '/invites'}>
            <UserPlus className="h-3.5 w-3.5" />
            Invite Tenant
          </Button>
        </div>
      </div>

      {/* Alerts */}
      <DashboardAlertBanner alerts={alerts} />

      {/* KPIs */}
      <DashboardGrid columns={4}>
        <DashboardKPI
          title="Occupancy Rate"
          value={`${data?.metrics.occupancyRate || 0}%`}
          subtitle={`${data?.metrics.totalOccupied} / ${data?.metrics.totalUnits} units occupied`}
          icon={Home}
          color="success"
          progress={data?.metrics.occupancyRate}
        />
        <DashboardKPI
          title="Vacant Units"
          value={data?.metrics.vacantUnits || 0}
          subtitle="Ready for marketing & lease"
          icon={AlertCircle}
          color="warning"
        />
        <DashboardKPI
          title="Leases Expiring Soon"
          value={data?.metrics.expiringCount || 0}
          subtitle="Review renewal or move-out action"
          icon={Clock}
          color="navy"
        />
        <DashboardKPI
          title="Pending Invitations"
          value={data?.metrics.pendingInviteCount || 0}
          subtitle="Awaiting tenant completion"
          icon={Users}
          color="info"
        />
      </DashboardGrid>

      {/* Tables & Onboarding */}
      <DashboardGrid columns={12}>
        <DashboardWidget
          title="Upcoming Expiring Leases"
          description="Leases requiring renewal confirmation or move-out notice"
          icon={Calendar}
          colSpan={8}
          accentColor="purple"
          badge={`${data?.expiringLeases.length || 0} leases`}
        >
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Unit</TableHead>
                  <TableHead className="text-xs">Expiration Date</TableHead>
                  <TableHead className="text-xs">Monthly Rent</TableHead>
                  <TableHead className="text-xs text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.expiringLeases.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-6 text-muted-foreground text-xs">
                      No leases expiring in the near term.
                    </TableCell>
                  </TableRow>
                ) : (
                  data?.expiringLeases.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell className="font-semibold text-xs text-foreground">{l.unit || 'Unit A'}</TableCell>
                      <TableCell className="text-xs text-navy-mid font-medium">{l.end_date}</TableCell>
                      <TableCell className="text-xs font-bold">{l.monthly_rent ? `KES ${l.monthly_rent}` : 'N/A'}</TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="outline" className="h-6 text-[11px]" onClick={() => window.location.href = '/leases'}>
                          Review Lease
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
          title="Leasing Quick Actions"
          description="High frequency onboarding & agreement management"
          icon={FileCheck}
          colSpan={4}
          accentColor="emerald"
        >
          <div className="space-y-2.5">
            <Button variant="outline" className="w-full justify-between h-11 text-xs font-semibold" onClick={() => window.location.href = '/invites'}>
              <span className="flex items-center gap-2"><UserPlus className="h-4 w-4 text-success" /> Send Tenant Onboarding Link</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
            <Button variant="outline" className="w-full justify-between h-11 text-xs font-semibold" onClick={() => window.location.href = '/leases'}>
              <span className="flex items-center gap-2"><FileCheck className="h-4 w-4 text-navy-mid" /> Draft Lease Agreement</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
            <Button variant="outline" className="w-full justify-between h-11 text-xs font-semibold" onClick={() => window.location.href = '/tenants'}>
              <span className="flex items-center gap-2"><Clock className="h-4 w-4 text-warning" /> Review Vacation Notices</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </DashboardWidget>
      </DashboardGrid>
    </div>
  );
}
