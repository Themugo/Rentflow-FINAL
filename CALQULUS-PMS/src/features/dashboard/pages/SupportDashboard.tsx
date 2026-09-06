import { DashboardLoadingSkeleton } from "@/features/dashboard/components/DashboardLoadingSkeleton";
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/features/auth/AuthContext';
import { DashboardGrid, DashboardWidget, DashboardKPI, DashboardAlertBanner } from '@/features/dashboard/framework';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/components/ui/table';
import {
  Headphones, MessageSquare, Clock, CheckCircle2, AlertCircle, RefreshCw,
  Search, ShieldAlert, ArrowRight, UserCheck, BookOpen
} from 'lucide-react';
import { format } from 'date-fns';

export default function SupportDashboard() {
  const { user } = useAuth();

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['support-dashboard-data', user?.id],
    queryFn: async () => {
      if (!user) return null;

      const [
        { data: activityLogs },
        { data: maintenanceTickets },
      ] = await Promise.all([
        supabase.from('activity_logs').select('id, action_type, description, created_at').order('created_at', { ascending: false }).limit(10),
        supabase.from('maintenance_requests').select('id, title, status, created_at').eq('status', 'pending').limit(10),
      ]);

      return {
        activityLogs: activityLogs || [],
        maintenanceTickets: maintenanceTickets || [],
        metrics: {
          pendingRequests: (maintenanceTickets || []).length,
          recentActivityCount: (activityLogs || []).length,
        },
      };
    },
  });

  if (isLoading) {
    return <DashboardLoadingSkeleton />;
  }

  const alerts = [
    {
      id: 'support-queue-alert',
      type: 'info' as const,
      title: 'Tenant Help Queue Active',
      message: `${data?.metrics.pendingRequests || 0} pending service requests surfaced from maintenance records.`,
      count: data?.metrics.pendingRequests || 0,
      actionLabel: 'Open Requests',
      onAction: () => window.location.href = '/maintenance',
    }
  ];

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-[1800px] mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black tracking-tight text-foreground">Tenant Support & Communications Center</h1>
            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 font-bold">
              Support Specialist Workspace
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Tenant inquiries, escalation routing, portal helpdesk, and tenant satisfaction monitoring.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="gap-1.5 h-9">
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh Queue
          </Button>
        </div>
      </div>

      {/* Alerts */}
      <DashboardAlertBanner alerts={alerts} />

      {/* KPIs */}
      <DashboardGrid columns={4}>
        <DashboardKPI
          title="Pending Service Requests"
          value={data?.metrics.pendingRequests || 0}
          subtitle="Pending initial response"
          icon={Headphones}
          color="info"
        />
        <DashboardKPI
          title="Recent Activity"
          value={data?.metrics.recentActivityCount || 0}
          subtitle="Latest activity records loaded"
          icon={Clock}
          color="success"
        />
        <DashboardKPI
          title="Support metrics"
          value="Not tracked"
          subtitle="No support satisfaction field is available"
          icon={CheckCircle2}
          color="navy"
          
        />
        <DashboardKPI
          title="Data coverage"
          value="Partial"
          subtitle="Support-specific ticket resolution is not tracked"
          icon={MessageSquare}
          color="warning"
        />
      </DashboardGrid>

      {/* Support Activity */}
      <DashboardGrid columns={12}>
        <DashboardWidget
          title="Recent System & Support Activity"
          description="Live stream of tenant interactions and portal activity"
          icon={MessageSquare}
          colSpan={8}
          accentColor="sky"
        >
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Action Type</TableHead>
                  <TableHead className="text-xs">Description</TableHead>
                  <TableHead className="text-xs">Timestamp</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.activityLogs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-6 text-muted-foreground text-xs">
                      No recent support log activity.
                    </TableCell>
                  </TableRow>
                ) : (
                  data?.activityLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="font-semibold text-xs text-foreground uppercase tracking-wider">{log.action_type}</TableCell>
                      <TableCell className="text-xs text-muted-foreground truncate max-w-[300px]">{log.description}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {log.created_at ? format(new Date(log.created_at), 'MMM dd, HH:mm') : 'N/A'}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </DashboardWidget>

        <DashboardWidget
          title="Support Tools & Helpdesk"
          description="Quick links for tenant resolution"
          icon={BookOpen}
          colSpan={4}
          accentColor="purple"
        >
          <div className="space-y-2.5">
            <Button variant="outline" className="w-full justify-between h-11 text-xs font-semibold" onClick={() => window.location.href = '/invites'}>
              <span className="flex items-center gap-2"><UserCheck className="h-4 w-4 text-success" /> Resend Tenant Invitation</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
            <Button variant="outline" className="w-full justify-between h-11 text-xs font-semibold" onClick={() => window.location.href = '/tenants'}>
              <span className="flex items-center gap-2"><Search className="h-4 w-4 text-primary" /> Lookup Tenant Profile</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
            <Button variant="outline" className="w-full justify-between h-11 text-xs font-semibold" onClick={() => window.location.href = '/maintenance'}>
              <span className="flex items-center gap-2"><ShieldAlert className="h-4 w-4 text-warning" /> Escalate Maintenance Ticket</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </DashboardWidget>
      </DashboardGrid>
    </div>
  );
}
