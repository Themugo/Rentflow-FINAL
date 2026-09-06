import { DashboardLoadingSkeleton } from "@/features/dashboard/components/DashboardLoadingSkeleton";
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/features/auth/AuthContext';
import { useManagerScope } from '@/shared/hooks/useManagerScope';
import { DashboardGrid, DashboardWidget, DashboardKPI, DashboardAlertBanner } from '@/features/dashboard/framework';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import { Card, CardContent } from '@/shared/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/components/ui/table';
import {
  DollarSign, CreditCard, Receipt, TrendingUp, AlertCircle, ArrowUpRight,
  FileText, Download, CheckCircle, Clock, RefreshCw, Scale, Building2,
  PieChart as PieIcon, ArrowDownRight, Wallet, ArrowRight
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { CALQULUS_COLOR } from '@/shared/theme/tokens';

const fmt = (n: number) =>
  new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 0 }).format(n);

export default function AccountantDashboard() {
  const { user } = useAuth();
  const { managerId, restrictToAssignedProperties, assignedPropertyIds } = useManagerScope();

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['accountant-dashboard-data', managerId, restrictToAssignedProperties, assignedPropertyIds],
    queryFn: async () => {
      if (!user || !managerId) return null;
      if (restrictToAssignedProperties && assignedPropertyIds.length === 0) {
        return { pendingInvoices: [], overdueInvoices: [], recentPaidInvoices: [], pendingPayouts: [], properties: [], metrics: { totalPending: 0, totalOverdue: 0, totalCollected: 0, totalPendingPayouts: 0 }, financialTrends: [] };
      }

      const [
        { data: pendingInvoices },
        { data: overdueInvoices },
        { data: recentPaidInvoices },
        { data: pendingPayouts },
        { data: properties },
      ] = await Promise.all([
        (() => { let q = supabase.from('invoices').select('id, invoice_number, amount, balance_due, due_date, status, tenant_id, property_id').eq('manager_id', managerId).eq('status', 'pending').limit(10); if (restrictToAssignedProperties) q = q.in('property_id', assignedPropertyIds); return q; })(),
        (() => { let q = supabase.from('invoices').select('id, invoice_number, amount, balance_due, due_date, status, tenant_id, property_id').eq('manager_id', managerId).eq('status', 'overdue').limit(10); if (restrictToAssignedProperties) q = q.in('property_id', assignedPropertyIds); return q; })(),
        (() => { let q = supabase.from('invoices').select('id, invoice_number, amount, paid_date, status, property_id').eq('manager_id', managerId).eq('status', 'paid').gte('paid_date', startOfMonth(subMonths(new Date(), 5)).toISOString()).order('paid_date', { ascending: false }).limit(1000); if (restrictToAssignedProperties) q = q.in('property_id', assignedPropertyIds); return q; })(),
        (() => { let q = supabase.from('payout_requests').select('id, amount, status, created_at, property_id').eq('manager_id', managerId).eq('status', 'pending').limit(10); if (restrictToAssignedProperties) q = q.in('property_id', assignedPropertyIds); return q; })(),
        (() => { let q = supabase.from('properties').select('id, name, occupied, units').eq('manager_id', managerId); if (restrictToAssignedProperties) q = q.in('id', assignedPropertyIds); return q.limit(10); })(),
      ]);

      const totalPending = (pendingInvoices || []).reduce((acc, inv) => acc + (Number(inv.balance_due) || Number(inv.amount) || 0), 0);
      const totalOverdue = (overdueInvoices || []).reduce((acc, inv) => acc + (Number(inv.balance_due) || Number(inv.amount) || 0), 0);
      const totalCollected = (recentPaidInvoices || []).reduce((acc, inv) => acc + (Number(inv.amount) || 0), 0);
      const totalPendingPayouts = (pendingPayouts || []).reduce((acc, p) => acc + (Number(p.amount) || 0), 0);

      const financialTrends = Array.from({ length: 6 }, (_, index) => {
        const monthDate = startOfMonth(subMonths(new Date(), 5 - index));
        const nextMonth = endOfMonth(monthDate);
        const revenue = (recentPaidInvoices || [])
          .filter((invoice) => invoice.paid_date && new Date(invoice.paid_date) >= monthDate && new Date(invoice.paid_date) <= nextMonth)
          .reduce((sum, invoice) => sum + (Number(invoice.amount) || 0), 0);
        return { month: format(monthDate, 'MMM'), revenue };
      });

      return {
        pendingInvoices: pendingInvoices || [],
        overdueInvoices: overdueInvoices || [],
        recentPaidInvoices: recentPaidInvoices || [],
        pendingPayouts: pendingPayouts || [],
        properties: properties || [],
        metrics: {
          totalPending,
          totalOverdue,
          totalCollected,
          totalPendingPayouts,
        },
        financialTrends,
      };
    },
  });

  if (isLoading) {
    return <DashboardLoadingSkeleton />;
  }

  const alerts = [
    {
      id: 'overdue-alert',
      type: 'warning' as const,
      title: 'Overdue Receivables Alert',
      message: `${data?.overdueInvoices.length || 0} invoices are overdue totaling ${fmt(data?.metrics.totalOverdue || 0)}. Review the overdue queue and follow up on delinquent accounts.`,
      count: data?.overdueInvoices.length || 0,
      actionLabel: 'View Invoices',
      onAction: () => window.location.href = '/statements',
    },
    {
      id: 'payout-alert',
      type: 'info' as const,
      title: 'Owner Payout Approval Required',
      message: `${data?.pendingPayouts.length || 0} owner payout requests pending review totaling ${fmt(data?.metrics.totalPendingPayouts || 0)}.`,
      count: data?.pendingPayouts.length || 0,
      actionLabel: 'Review Payouts',
      onAction: () => window.location.href = '/billing',
    }
  ];

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-[1800px] mx-auto">
      {/* Top Header & Context */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black tracking-tight text-foreground">Financial Operational Command Center</h1>
            <Badge variant="outline" className="bg-success/10 text-success border-success/20 font-bold">
              Accountant Workspace
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Ledger tracking, bank reconciliation, owner disbursements, and accounts receivable controls.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="gap-1.5 h-9">
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            Sync Ledger
          </Button>
          <Button size="sm" className="gap-1.5 h-9 font-semibold" onClick={() => window.location.href = '/billing'}>
            <Download className="h-3.5 w-3.5" />
            Open Financial Records
          </Button>
        </div>
      </div>

      {/* Operational Alerts */}
      <DashboardAlertBanner alerts={alerts} />

      {/* High-Impact Financial KPIs */}
      <DashboardGrid columns={4}>
        <DashboardKPI
          title="Recent Collections (MTD)"
          value={fmt(data?.metrics.totalCollected || 0)}
          icon={DollarSign}
          color="success"
        />
        <DashboardKPI
          title="Pending Receivables"
          value={fmt(data?.metrics.totalPending || 0)}
          subtitle={`${data?.pendingInvoices.length || 0} active invoices`}
          icon={CreditCard}
          color="warning"
        />
        <DashboardKPI
          title="Overdue Invoices"
          value={fmt(data?.metrics.totalOverdue || 0)}
          subtitle={`${data?.overdueInvoices.length || 0} delinquent accounts`}
          icon={AlertCircle}
          color="danger"
        />
        <DashboardKPI
          title="Pending Owner Payouts"
          value={fmt(data?.metrics.totalPendingPayouts || 0)}
          subtitle={`${data?.pendingPayouts.length || 0} disbursements pending`}
          icon={Wallet}
          color="info"
        />
      </DashboardGrid>

      {/* Main Charts & Financial Analysis */}
      <DashboardGrid columns={12}>
        <DashboardWidget
          title="Collections trend"
          description="Recorded paid invoices over the last six months"
          icon={TrendingUp}
          colSpan={8}
          accentColor="emerald"
        >
          <div className="h-72 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data?.financialTrends}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={CALQULUS_COLOR.success} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={CALQULUS_COLOR.success} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tickFormatter={v => `${v / 1000}k`} tick={{ fontSize: 12 }} />
                <Tooltip formatter={(value: any) => fmt(Number(value))} />
                <Area type="monotone" dataKey="revenue" name="Recorded collections" stroke={CALQULUS_COLOR.success} fillOpacity={1} fill="url(#colorRevenue)" strokeWidth={2} />
                              </AreaChart>
            </ResponsiveContainer>
          </div>
        </DashboardWidget>

        <DashboardWidget
          title="Financial Quick Actions"
          description="High frequency accounting tasks"
          icon={FileText}
          colSpan={4}
          accentColor="primary"
        >
          <div className="space-y-2.5">
            <Button variant="outline" className="w-full justify-between h-11 text-xs font-semibold" onClick={() => window.location.href = '/statements'}>
              <span className="flex items-center gap-2"><Receipt className="h-4 w-4 text-success" /> Generate Owner Statements</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
            <Button variant="outline" className="w-full justify-between h-11 text-xs font-semibold" onClick={() => window.location.href = '/water-billing'}>
              <span className="flex items-center gap-2"><CreditCard className="h-4 w-4 text-primary" /> Process Water & Utility Billing</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
            <Button variant="outline" className="w-full justify-between h-11 text-xs font-semibold" onClick={() => window.location.href = '/billing'}>
              <span className="flex items-center gap-2"><Scale className="h-4 w-4 text-warning" /> Reconcile Bank Statements</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
            <Button variant="outline" className="w-full justify-between h-11 text-xs font-semibold" onClick={() => window.location.href = '/invites'}>
              <span className="flex items-center gap-2"><Clock className="h-4 w-4 text-navy-mid" /> Audit Rent Reminders</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </DashboardWidget>
      </DashboardGrid>

      {/* Receivables & Disbursements Tables */}
      <DashboardGrid columns={12}>
        <DashboardWidget
          title="Delinquent & Overdue Accounts"
          description="Invoices requiring collection intervention"
          icon={AlertCircle}
          colSpan={6}
          accentColor="red"
          badge={`${data?.overdueInvoices.length || 0} overdue`}
          badgeVariant="destructive"
        >
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Invoice #</TableHead>
                  <TableHead className="text-xs">Due Date</TableHead>
                  <TableHead className="text-xs text-right">Amount</TableHead>
                  <TableHead className="text-xs text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.overdueInvoices.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-6 text-muted-foreground text-xs">
                      No overdue invoices detected.
                    </TableCell>
                  </TableRow>
                ) : (
                  data?.overdueInvoices.map((inv) => (
                    <TableRow key={inv.id}>
                      <TableCell className="font-mono text-xs font-semibold">{inv.invoice_number}</TableCell>
                      <TableCell className="text-xs text-red-500 font-medium">{inv.due_date}</TableCell>
                      <TableCell className="text-xs font-bold text-right">{fmt(inv.balance_due || inv.amount)}</TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="ghost" className="h-6 text-[11px] text-primary">
                          Remind
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
          title="Pending Owner Disbursements"
          description="Owner payout requests ready for batch approval"
          icon={Wallet}
          colSpan={6}
          accentColor="sky"
          badge={`${data?.pendingPayouts.length || 0} pending`}
          badgeVariant="secondary"
        >
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Date</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                  <TableHead className="text-xs text-right">Amount</TableHead>
                  <TableHead className="text-xs text-right">Approval</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.pendingPayouts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-6 text-muted-foreground text-xs">
                      No pending owner payout requests.
                    </TableCell>
                  </TableRow>
                ) : (
                  data?.pendingPayouts.map((payout) => (
                    <TableRow key={payout.id}>
                      <TableCell className="text-xs">{payout.created_at ? format(new Date(payout.created_at), 'MMM dd') : 'N/A'}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px] bg-warning/10 text-warning border-warning/20">
                          {payout.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs font-bold text-right">{fmt(payout.amount)}</TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" className="h-6 text-[11px] bg-success hover:bg-success text-white">
                          Approve
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </DashboardWidget>
      </DashboardGrid>
    </div>
  );
}
