// @ts-nocheck — Phase 12: remaining local types until live supabase gen types
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/features/auth/AuthContext';
import { useManagerScope } from '@/shared/hooks/useManagerScope';
import { Layout } from '@/shared/components/layout/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Tabs, TabsContent } from '@/shared/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { Badge } from '@/shared/components/ui/badge';
import { Skeleton } from '@/shared/components/ui/skeleton';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { Users, Home } from 'lucide-react';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { RentCollectionSummary } from '@/features/reports/components/RentCollectionSummary';
import {
  ExecutiveAnalyticsWorkspace,
  ReportCenterCatalog,
  CustomReportBuilder,
  AnalyticsAlertPanel,
  ReportSchedulingModal,
} from '@/shared/components/bi';
import { occupancyRateColor } from '@/shared/lib/statusBadge';
import { Label } from '@/shared/components/ui/label';
import { CALQULUS_COLOR } from '@/shared/theme/tokens';
import { FeatureGate } from '@/shared/components/FeatureGate';

const fmt = (n: number) =>
  new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 0 }).format(n);

const REPORT_TYPES = [
  { id: 'revenue', label: 'Revenue trend' },
  { id: 'occupancy', label: 'Occupancy' },
  { id: 'arrears', label: 'Arrears aging' },
  { id: 'by-property', label: 'Revenue by property' },
  { id: 'collection-report', label: 'Collection report' },
  { id: 'catalog', label: 'Report catalog' },
  { id: 'builder', label: 'Custom report builder' },
  { id: 'alerts', label: 'Analytics alerts' },
  { id: 'executive', label: 'Executive analytics' },
] as const;

const Reports: React.FC = () => {
  const { user } = useAuth();
  const { managerId, restrictToAssignedProperties, assignedPropertyIds } = useManagerScope();
  const [period, setPeriod] = useState('6');
  const [propertyId, setPropertyId] = useState('all');
  const [reportType, setReportType] = useState<string>('revenue');
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [selectedReportTitle, setSelectedReportTitle] = useState("Executive Performance Statement");

  const { data: reportProperties = [] } = useQuery({
    queryKey: ['reports-property-list', managerId, restrictToAssignedProperties, assignedPropertyIds],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('properties')
        .select('id, name')
        .eq('manager_id', managerId)
        .eq('status', 'active')
        .order('name');
      const scoped = restrictToAssignedProperties ? (data ?? []).filter((p) => assignedPropertyIds.includes(p.id)) : (data ?? []);
      if (error) throw error;
      return scoped;
    },
    enabled: !!managerId,
  });

  // ── Revenue trend ──────────────────────────────────────────
  const { data: revenueTrend = [], isLoading: revLoading } = useQuery({
    queryKey: ['reports-revenue-trend', managerId, period, propertyId, restrictToAssignedProperties, assignedPropertyIds],
    queryFn: async () => {
      const months = parseInt(period);
      return Promise.all(
        Array.from({ length: months }, (_, i) => {
          const d = subMonths(new Date(), months - 1 - i);
          const start = startOfMonth(d).toISOString();
          const end   = endOfMonth(d).toISOString();
          let query = supabase
            .from('invoices')
            .select('amount, paid_amount, status')
            .eq('manager_id', managerId)
            .gte('due_date', start)
            .lte('due_date', end);
          if (restrictToAssignedProperties) query = query.in('property_id', assignedPropertyIds);
          if (propertyId !== 'all') {
            query = query.eq('property_id', propertyId);
          }
          return query.then(({ data, error }) => {
              if (error) throw error;
              const billed    = (data || []).reduce((s, i) => s + Number(i.amount), 0);
              const collected = (data || []).reduce((s, i) => s + Number(i.paid_amount ?? 0), 0);
              const arrears   = (data || []).filter(i => i.status === 'overdue').reduce((s, i) => s + Number(i.amount), 0);
              return { month: format(d, 'MMM yy'), billed, collected, arrears };
            });
        })
      );
    },
    enabled: !!managerId,
  });

  // ── Occupancy trend ────────────────────────────────────────
  const { data: occupancySummary, isLoading: occLoading } = useQuery({
    queryKey: ['reports-occupancy', managerId, restrictToAssignedProperties, assignedPropertyIds],
    queryFn: async () => {
      let propsQuery = supabase
        .from('properties')
        .select('id, name, units, occupied')
        .eq('manager_id', managerId)
        .eq('status', 'active')
        .order('name');
      if (restrictToAssignedProperties) propsQuery = propsQuery.in('id', assignedPropertyIds);
      const { data: props, error: propsError } = await propsQuery;
      if (propsError) throw propsError;

      const items = (props || []).map(p => ({
        id: p.id,
        name: p.name.length > 18 ? p.name.slice(0, 16) + '…' : p.name,
        occupied: p.occupied ?? 0,
        vacant: (p.units ?? 0) - (p.occupied ?? 0),
        total: p.units ?? 0,
        rate: p.units > 0 ? Math.round((p.occupied / p.units) * 100) : 0,
      }));

      const totalUnits    = items.reduce((s, p) => s + p.total, 0);
      const totalOccupied = items.reduce((s, p) => s + p.occupied, 0);
      return { items, totalUnits, totalOccupied, overallRate: totalUnits > 0 ? Math.round((totalOccupied / totalUnits) * 100) : 0 };
    },
    enabled: !!managerId,
  });

  // ── Arrears aging ──────────────────────────────────────────
  const { data: arrearsAging = [], isLoading: arrearsLoading } = useQuery({
    queryKey: ['reports-arrears', managerId, propertyId, restrictToAssignedProperties, assignedPropertyIds],
    queryFn: async () => {
      let query = supabase
        .from('invoices')
        .select('balance_due, due_date')
        .eq('manager_id', managerId)
        .eq('status', 'overdue')
        .order('due_date');
      if (restrictToAssignedProperties) query = query.in('property_id', assignedPropertyIds);
      if (propertyId !== 'all') {
        query = query.eq('property_id', propertyId);
      }
      const { data } = await query;

      const now = new Date();
      const buckets = { '1-30 days': 0, '31-60 days': 0, '61-90 days': 0, '90+ days': 0 };
      for (const inv of (data || []) as any[]) {
        const days = Math.floor((now.getTime() - new Date(inv.due_date).getTime()) / 86400000);
        const amt  = Number(inv.balance_due ?? 0);
        if (days <= 30) buckets['1-30 days'] += amt;
        else if (days <= 60) buckets['31-60 days'] += amt;
        else if (days <= 90) buckets['61-90 days'] += amt;
        else buckets['90+ days'] += amt;
      }
      return Object.entries(buckets).map(([name, value]) => ({ name, value }));
    },
    enabled: !!managerId,
  });

  // ── Revenue by property ────────────────────────────────────
  const { data: revenueByProp = [], isLoading: propRevLoading } = useQuery({
    queryKey: ['reports-revenue-by-property', managerId, period, propertyId, restrictToAssignedProperties, assignedPropertyIds],
    queryFn: async () => {
      const months = parseInt(period);
      const start = startOfMonth(subMonths(new Date(), months - 1)).toISOString();
      let propsQuery = supabase
        .from('properties')
        .select('id, name')
        .eq('manager_id', managerId)
        .eq('status', 'active');
      if (restrictToAssignedProperties) propsQuery = propsQuery.in('id', assignedPropertyIds);
      if (propertyId !== 'all') propsQuery = propsQuery.eq('id', propertyId);
      const { data: props, error: propsError } = await propsQuery;
      if (propsError) throw propsError;
      if (!props?.length) return [];

      const propertyIds = props.map((p) => p.id);
      let invoicesQuery = supabase
        .from('invoices')
        .select('property_id, paid_amount')
        .eq('manager_id', managerId)
        .eq('status', 'paid')
        .gte('paid_date', start)
        .in('property_id', propertyIds);
      const { data: invs, error: invoicesError } = await invoicesQuery;
      if (invoicesError) throw invoicesError;
      const totals = new Map<string, number>();
      for (const inv of invs ?? []) totals.set(inv.property_id, (totals.get(inv.property_id) ?? 0) + Number(inv.paid_amount ?? 0));
      return props.map((p) => ({ name: p.name.length > 18 ? p.name.slice(0, 16) + '…' : p.name, revenue: totals.get(p.id) ?? 0 }));
    },
    enabled: !!managerId,
  });

  const totalArrears = arrearsAging.reduce((s, b) => s + b.value, 0);
  const occupancyItems = (occupancySummary?.items ?? []).filter(
    (item) => propertyId === 'all' || item.id === propertyId,
  );
  const occupancyUnits = occupancyItems.reduce((s, p) => s + p.total, 0);
  const occupancyOccupied = occupancyItems.reduce((s, p) => s + p.occupied, 0);
  const occupancyRate = occupancyUnits > 0 ? Math.round((occupancyOccupied / occupancyUnits) * 100) : 0;

  return (
    <Layout title="Reports" subtitle="Period, property, and report type — live collections, occupancy, and arrears">
      <div className="space-y-6">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-0 w-full space-y-1 sm:w-auto">
            <Label htmlFor="report-period">Period</Label>
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger id="report-period" className="w-full sm:w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="3">Last 3 months</SelectItem>
                <SelectItem value="6">Last 6 months</SelectItem>
                <SelectItem value="12">Last 12 months</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-0 w-full space-y-1 sm:w-auto">
            <Label htmlFor="report-property">Property</Label>
            <Select value={propertyId} onValueChange={setPropertyId}>
              <SelectTrigger id="report-property" className="w-full sm:w-52">
                <SelectValue placeholder="All properties" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All properties</SelectItem>
                {reportProperties.map((property) => (
                  <SelectItem key={property.id} value={property.id}>{property.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-0 w-full space-y-1 sm:w-auto">
            <Label htmlFor="report-type">Report type</Label>
            <Select value={reportType} onValueChange={setReportType}>
              <SelectTrigger id="report-type" className="w-full sm:w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REPORT_TYPES.map((type) => (
                  <SelectItem key={type.id} value={type.id}>{type.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex min-w-0 flex-wrap items-center gap-3 pb-1 text-sm text-muted-foreground">
            {occupancySummary && (
              <>
                <span className="flex items-center gap-1">
                  <Home className="h-4 w-4" />
                  {occupancyUnits} units
                </span>
                <span className="flex items-center gap-1">
                  <Users className="h-4 w-4" />
                  {occupancyOccupied} occupied
                </span>
                <Badge variant="outline" className={occupancyRateColor(occupancyRate)}>
                  {occupancyRate}% occupancy
                </Badge>
              </>
            )}
          </div>
        </div>

        <Tabs value={reportType} onValueChange={setReportType}>

          {/* Executive Analytics */}
          <TabsContent value="executive" className="mt-4 space-y-6">
            <FeatureGate feature="advanced_analytics" featureLabel="Executive analytics">
            <ExecutiveAnalyticsWorkspace />
            </FeatureGate>
          </TabsContent>

          {/* Report Catalog */}
          <TabsContent value="catalog" className="mt-4 space-y-6">
            <FeatureGate feature="advanced_analytics" featureLabel="Report catalog">
            <ReportCenterCatalog
              onScheduleReport={(title) => {
                setSelectedReportTitle(title);
                setScheduleModalOpen(true);
              }}
            />
            </FeatureGate>
          </TabsContent>

          {/* Custom Report Builder */}
          <TabsContent value="builder" className="mt-4 space-y-6">
            <FeatureGate feature="advanced_analytics" featureLabel="Custom report builder">
            <CustomReportBuilder />
            </FeatureGate>
          </TabsContent>

          {/* Analytics Alerts */}
          <TabsContent value="alerts" className="mt-4 space-y-6">
            <FeatureGate feature="advanced_analytics" featureLabel="Analytics alerts">
            <AnalyticsAlertPanel />
            </FeatureGate>
          </TabsContent>

          {/* Revenue trend */}
          <TabsContent value="revenue" className="mt-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Revenue — billed vs collected vs arrears</CardTitle>
                <CardDescription>Last {period} months across all properties</CardDescription>
              </CardHeader>
              <CardContent className="min-w-0">
                {revLoading ? <Skeleton className="h-64 w-full" /> : (
                  <div className="chart-frame h-[220px] sm:h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={revenueTrend} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${Math.round(v / 1000)}K`} />
                      <Tooltip formatter={(v: number) => fmt(v)} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Bar dataKey="billed"    name="Billed"    fill="hsl(218 30% 65%)" radius={[3,3,0,0]} />
                      <Bar dataKey="collected" name="Collected" fill={CALQULUS_COLOR.success} radius={[3,3,0,0]} />
                      <Bar dataKey="arrears"   name="Arrears"   fill={CALQULUS_COLOR.danger} radius={[3,3,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                  </div>
                )}
                {!revLoading && revenueTrend.length > 0 && (
                  <div className="mt-3 grid grid-cols-1 gap-3 text-center sm:grid-cols-3">
                    {[
                      { label: 'Total billed', val: revenueTrend.reduce((s, r) => s + r.billed, 0), color: 'text-muted-foreground' },
                      { label: 'Total collected', val: revenueTrend.reduce((s, r) => s + r.collected, 0), color: 'text-success' },
                      { label: 'Total arrears', val: revenueTrend.reduce((s, r) => s + r.arrears, 0), color: 'text-destructive' },
                    ].map(s => (
                      <div key={s.label} className="rounded-lg bg-muted/40 p-2">
                        <p className="text-xs text-muted-foreground">{s.label}</p>
                        <p className={`amount-display text-sm font-semibold ${s.color}`}>{fmt(s.val)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Occupancy */}
          <TabsContent value="occupancy" className="mt-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Occupancy by property</CardTitle>
                <CardDescription>Current occupied vs vacant units per property</CardDescription>
              </CardHeader>
              <CardContent>
                {occLoading ? <Skeleton className="h-64 w-full" /> : !occupancyItems.length ? (
                  <p className="text-center py-12 text-muted-foreground text-sm">No active properties found.</p>
                ) : (
                  <>
                    <div className="chart-frame h-[220px] sm:h-[260px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={occupancyItems} margin={{ top: 5, right: 10, left: 10, bottom: 40 }}>
                        <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                        <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" interval={0} />
                        <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                        <Tooltip />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <Bar dataKey="occupied" name="Occupied" stackId="a" fill={CALQULUS_COLOR.success} radius={[0,0,0,0]} />
                        <Bar dataKey="vacant"   name="Vacant"   stackId="a" fill="hsl(218 30% 88%)" radius={[3,3,0,0]} />
                      </BarChart>
                    </ResponsiveContainer>
                    </div>
                    <div className="mt-3 space-y-1.5">
                      {occupancyItems.map(p => (
                        <div key={p.id} className="flex items-center gap-3 text-xs">
                          <span className="min-w-0 flex-1 truncate text-muted-foreground sm:w-32 sm:flex-none">{p.name}</span>
                          <div
                            className="flex-1 h-2 rounded-full bg-muted overflow-hidden"
                            role="progressbar"
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-valuenow={p.rate}
                            aria-label={`${p.name} occupancy ${p.rate} percent`}
                          >
                            <div className="h-full rounded-full bg-success" style={{ width: `${p.rate}%` }} />
                          </div>
                          <span className={`w-10 text-right font-medium ${occupancyRateColor(p.rate)}`}>
                            {p.rate}%
                          </span>
                          <span className="text-muted-foreground w-12 text-right">{p.occupied}/{p.total}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Arrears aging */}
          <TabsContent value="arrears" className="mt-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Arrears aging</CardTitle>
                <CardDescription>Overdue invoice amounts by how long they have been overdue</CardDescription>
              </CardHeader>
              <CardContent>
                {arrearsLoading ? <Skeleton className="h-48 w-full" /> : totalArrears === 0 ? (
                  <div className="py-10 text-center text-muted-foreground">
                    <p className="text-sm">No overdue invoices.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {arrearsAging.map((bucket) => (
                      <div key={bucket.name} className="flex items-center justify-between p-3 rounded-lg border border-border">
                        <span className="text-sm font-medium">{bucket.name}</span>
                        <span className={`text-sm font-semibold ${bucket.value > 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                          {bucket.value > 0 ? fmt(bucket.value) : '—'}
                        </span>
                      </div>
                    ))}
                    <div className="flex items-center justify-between p-3 rounded-lg border border-destructive/30 bg-destructive/10 font-semibold">
                      <span className="text-sm text-destructive">Total outstanding</span>
                      <span className="text-sm text-destructive">{fmt(totalArrears)}</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Collection report */}
          <TabsContent value="collection-report" className="mt-4">
            <RentCollectionSummary propertyId={propertyId === 'all' ? undefined : propertyId} />
          </TabsContent>

          {/* Revenue by property */}
          <TabsContent value="by-property" className="mt-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Revenue by property</CardTitle>
                <CardDescription>Total collected over last {period} months per property</CardDescription>
              </CardHeader>
              <CardContent>
                {propRevLoading ? <Skeleton className="h-64 w-full" /> : !revenueByProp.length ? (
                  <p className="text-center py-12 text-muted-foreground text-sm">No revenue data found.</p>
                ) : (
                  <>
                    <div className="chart-frame h-[220px] sm:h-[260px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={[...revenueByProp].sort((a, b) => b.revenue - a.revenue)}
                        margin={{ top: 5, right: 10, left: 10, bottom: 40 }}>
                        <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                        <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" interval={0} />
                        <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${Math.round(v / 1000)}K`} />
                        <Tooltip formatter={(v: number) => fmt(v)} />
                        <Bar dataKey="revenue" name="Revenue collected" fill={CALQULUS_COLOR.primary} radius={[3,3,0,0]} />
                      </BarChart>
                    </ResponsiveContainer>
                    </div>
                    <div className="mt-3 space-y-1.5 max-h-48 overflow-y-auto">
                      {[...revenueByProp].sort((a, b) => b.revenue - a.revenue).map((p, i) => (
                        <div key={p.name} className="flex items-center gap-3 text-sm">
                          <span className="text-muted-foreground w-5 text-right text-xs">{i + 1}.</span>
                          <span className="flex-1 truncate">{p.name}</span>
                          <span className="font-semibold text-[hsl(214_73%_45%)] dark:text-[hsl(214_73%_65%)]">{fmt(p.revenue)}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <ReportSchedulingModal
          isOpen={scheduleModalOpen}
          onClose={() => setScheduleModalOpen(false)}
          reportTitle={selectedReportTitle}
        />
      </div>
    </Layout>
  );
};

export default Reports;
