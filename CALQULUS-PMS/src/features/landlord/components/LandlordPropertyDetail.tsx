// @ts-nocheck — Phase 12: remaining local types until live supabase gen types
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { Progress } from '@/shared/components/ui/progress';
import {
  Building2, Home, Wrench, DollarSign, BarChart3, CheckCircle, FileText, Download, Clock
} from 'lucide-react';
import { occupancyRateColor, maintenancePriorityTone, maintenanceStatusTone, statusBadgeClass } from '@/shared/lib/statusBadge';
import { LANDLORD_PROPERTY_TABS, LANDLORD_TREND_COLORS, netShare } from '@/features/landlord/lib/portfolioMetrics';
import { LANDLORD_DOCUMENT_TYPE } from '@/features/landlord/lib/documentTypes';
import UnitPaymentReconciliation from '@/features/billing/components/UnitPaymentReconciliation';
import { format, differenceInDays } from 'date-fns';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
} from 'recharts';

const fmt = (n: number) =>
  new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 0 }).format(n);

const STATUS_BADGE: Record<string, string> = {
  occupied:    'bg-success/15 text-success border-success/30',
  vacant:      'bg-warning/15 text-warning border-warning/30',
  maintenance: 'bg-destructive/15 text-destructive border-destructive/30',
  reserved:    'bg-primary/15 text-primary border-primary/30',
};

interface Props {
  propertyId: string;
  propertyName: string;
  revenueSharePct: number;
}

const LandlordPropertyDetail: React.FC<Props> = ({ propertyId, propertyName, revenueSharePct }) => {

  // Units — no tenant personal data (name/email/phone) — only unit facts
  const { data: units = [], isLoading: unitsLoading } = useQuery({
    queryKey: ['landlord-units', propertyId],
    queryFn: async () => {
      const { data } = await supabase
        .from('units')
        .select(`
          id, unit_number, label, status, monthly_rent,
          unit_type, floor_number, bedrooms, house_deposit,
          available_from
        `)
        .eq('property_id', propertyId)
        .neq('status', 'inactive')
        .order('unit_number');
      return (data || []) as Array<{ id: string; unit_number: string; status: string; monthly_rent: number }>;
    },
  });

  const { data: ops, isLoading: opsLoading } = useQuery({
    queryKey: ['landlord-property-ops', propertyId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_landlord_property_ops', { p_property_id: propertyId });
      if (error) throw error;
      const payload = (data ?? {}) as {
        unit_revenue?: Record<string, { billed: number; collected: number }>;
        trend?: Array<{ month: string; gross: number }>;
        maintenance?: Array<{
          id: string; unit_number: string; unit_id: string | null; category: string;
          priority: string; status: string; requested_date: string; completion_date: string | null;
          budget: number | null; deposit_deduction_amount: number | null; created_at: string;
        }>;
      };
      return payload;
    },
  });

  // Documents shared by the manager for THIS property only
  const { data: documents = [], isLoading: docsLoading } = useQuery({
    queryKey: ['landlord-property-documents', propertyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('landlord_documents')
        .select('*')
        .eq('property_id', propertyId)
        .eq('is_visible', true)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return await Promise.all((data || []).map(async (doc: any) => {
        if (doc.storage_bucket && doc.storage_path && doc.verification_status !== 'revoked') {
          const { data: signed } = await supabase.storage.from(doc.storage_bucket).createSignedUrl(doc.storage_path, 300);
          return { ...doc, signed_url: signed?.signedUrl ?? null };
        }
        return { ...doc, signed_url: null };
      }));
    },
  });

  const unitRevenue = ops?.unit_revenue ?? {};
  const maintenance = ops?.maintenance ?? [];
  const trend = (ops?.trend ?? []).map((row) => ({
    month: row.month,
    gross: Number(row.gross),
    net: netShare(Number(row.gross), revenueSharePct),
  }));
  const maintLoading = opsLoading;

  const totalUnits = units.length;
  const occupiedUnits = units.filter(u => u.status === 'occupied').length;
  const vacantUnits = units.filter(u => u.status === 'vacant').length;
  const maintenanceUnits = units.filter(u => u.status === 'maintenance').length;
  const occupancyRate = totalUnits > 0 ? Math.round((occupiedUnits / totalUnits) * 100) : 0;
  const openMaintenance = maintenance.filter(m => m.status !== 'completed').length;
  const monthlyGross = units.filter(u => u.status === 'occupied')
    .reduce((s, u) => s + Number(u.monthly_rent ?? 0), 0);

  const revenueRows = Object.values(unitRevenue);
  const periodBilled = revenueRows.reduce((s, r) => s + Number(r.billed ?? 0), 0);
  const periodCollected = revenueRows.reduce((s, r) => s + Number(r.collected ?? 0), 0);
  const periodOutstanding = Math.max(0, periodBilled - periodCollected);

  return (
    <div className="space-y-6">
      <Tabs defaultValue={LANDLORD_PROPERTY_TABS[0]}>
        <TabsList className="flex-wrap h-auto gap-1 p-1">
          <TabsTrigger value="performance" className="text-xs gap-1.5">
            <BarChart3 className="h-3.5 w-3.5" />Performance
          </TabsTrigger>
          <TabsTrigger value="collections" className="text-xs gap-1.5"><DollarSign className="h-3.5 w-3.5" />Collections</TabsTrigger>
          <TabsTrigger value="units" className="text-xs gap-1.5">
            <Home className="h-3.5 w-3.5" />Units ({totalUnits})
          </TabsTrigger>
          <TabsTrigger value="maintenance" className="text-xs gap-1.5">
            <Wrench className="h-3.5 w-3.5" />
            Maintenance
            {openMaintenance > 0 && (
              <span className="ml-1 h-4 w-4 rounded-full bg-destructive text-destructive-foreground text-xs flex items-center justify-center font-bold">{openMaintenance}</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="documents" className="text-xs gap-1.5">
            <FileText className="h-3.5 w-3.5" />Documents ({documents.length})
          </TabsTrigger>
        </TabsList>

        {/* ── Performance tab — first, per the landlord mental model ── */}
        <TabsContent value="performance" className="mt-4 space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Occupancy', value: `${occupancyRate}%`, sub: `${occupiedUnits}/${totalUnits} units`, icon: Home, color: occupancyRateColor(occupancyRate) },
              { label: 'Vacant units', value: vacantUnits, sub: maintenanceUnits > 0 ? `+${maintenanceUnits} on maintenance` : 'Ready to let', icon: Building2, color: 'text-muted-foreground' },
              { label: 'Billed', value: fmt(monthlyGross), sub: `${fmt(netShare(monthlyGross, revenueSharePct))} net to you`, icon: DollarSign, color: 'text-foreground' },
              { label: 'Open maintenance', value: openMaintenance, sub: openMaintenance > 0 ? 'Requires attention' : 'All clear', icon: Wrench, color: openMaintenance > 0 ? 'text-destructive' : 'text-muted-foreground' },
            ].map(s => (
              <div key={s.label} className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                  <s.icon className={`h-4 w-4 ${s.color}`} />
                </div>
                <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{s.sub}</p>
              </div>
            ))}
          </div>

          {revenueRows.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Income this period — {propertyName}</CardTitle>
                <CardDescription>
                  Collected is money received. Outstanding is uncollected. Net is your {revenueSharePct}% share of collections.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Billed</span>
                    <span className="font-medium tabular-nums">{fmt(periodBilled)}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Collected</span>
                    <span className="font-medium tabular-nums">{fmt(periodCollected)}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Outstanding</span>
                    <span className={`font-medium tabular-nums ${periodOutstanding > 0 ? 'text-destructive' : ''}`}>
                      {fmt(periodOutstanding)}
                    </span>
                  </div>
                  <div className="h-px bg-border" />
                  <div className="flex justify-between items-center">
                    <span className="font-semibold">Net to you ({revenueSharePct}%)</span>
                    <span className="text-xl font-bold tabular-nums">{fmt(netShare(periodCollected, revenueSharePct))}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">6-month revenue — {propertyName}</CardTitle>
              <CardDescription>Collected vs net to you ({revenueSharePct}% share)</CardDescription>
            </CardHeader>
            <CardContent>
              {opsLoading ? (
                <Skeleton className="h-[220px] w-full" />
              ) : trend.length === 0 ? (
                <p className="py-12 text-center text-sm text-muted-foreground">Revenue trend appears once collections are recorded.</p>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={trend} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
                      <Tooltip formatter={(v: number) => fmt(v)} />
                      <Bar dataKey="gross" name="Collected" fill={LANDLORD_TREND_COLORS.collected} radius={[3, 3, 0, 0]} />
                      <Bar dataKey="net" name={`Net to you (${revenueSharePct}%)`} fill={LANDLORD_TREND_COLORS.net} radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                  <div className="flex gap-4 justify-center mt-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <span className="h-3 w-3 rounded-sm inline-block" style={{ backgroundColor: LANDLORD_TREND_COLORS.collected }} />
                      Collected
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="h-3 w-3 rounded-sm inline-block" style={{ backgroundColor: LANDLORD_TREND_COLORS.net }} />
                      Net to you ({revenueSharePct}%)
                    </span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Collections tab ── */}
        <TabsContent value="collections" className="mt-4">
          <UnitPaymentReconciliation propertyId={propertyId} landlordView title="Unit collections — payment reconciliation" />
        </TabsContent>

        {/* ── Units tab ── */}
        <TabsContent value="units" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Unit occupancy — {propertyName}</CardTitle>
              <CardDescription>
                Unit numbers and status only — tenant personal information is managed privately by your property manager.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {unitsLoading ? (
                <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
              ) : (
                <div className="space-y-2">
                  {units.map(unit => {
                    const rev = unitRevenue[unit.id];
                    const daysVacant = unit.status === 'vacant' && unit.available_from
                      ? differenceInDays(new Date(), new Date(unit.available_from))
                      : null;
                    return (
                      <div key={unit.id} className={`flex items-center justify-between p-3 rounded-lg border ${
                        unit.status === 'vacant' ? 'border-warning/30 bg-warning/5' :
                        unit.status === 'maintenance' ? 'border-destructive/30 bg-destructive/5' :
                        'border-border'
                      }`}>
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`h-8 w-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
                            unit.status === 'occupied' ? 'bg-success/15 text-success' :
                            unit.status === 'vacant' ? 'bg-warning/15 text-warning' :
                            'bg-destructive/15 text-destructive'
                          }`}>
                            {(unit.label || unit.unit_number).slice(-2)}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-medium">{unit.label || unit.unit_number}</p>
                              <Badge variant="outline" className={`text-xs ${STATUS_BADGE[unit.status] || ''}`}>
                                {unit.status}
                              </Badge>
                              {unit.bedrooms && <span className="text-xs text-muted-foreground">{unit.bedrooms}BR</span>}
                              {unit.floor_number && <span className="text-xs text-muted-foreground">Floor {unit.floor_number}</span>}
                            </div>
                            {daysVacant !== null && daysVacant > 0 && (
                              <p className="text-xs text-warning mt-0.5">
                                Vacant {daysVacant} day{daysVacant !== 1 ? 's' : ''}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          {unit.monthly_rent && (
                            <p className="text-sm font-semibold tabular-nums">{fmt(unit.monthly_rent)}/mo</p>
                          )}
                          {rev && (
                            <p className="text-xs mt-0.5 text-muted-foreground">
                              {fmt(rev.collected)} collected
                              {rev.collected < rev.billed && (
                                <span className="text-warning"> · {fmt(rev.billed - rev.collected)} outstanding</span>
                              )}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Occupancy progress */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium">Overall occupancy</p>
                <span className={`text-sm font-bold ${occupancyRateColor(occupancyRate)}`}>{occupancyRate}%</span>
              </div>
              <Progress value={occupancyRate} className="h-3" />
              <div className="flex justify-between text-xs text-muted-foreground mt-2">
                <span>{occupiedUnits} occupied</span>
                <span>{vacantUnits} vacant</span>
                {maintenanceUnits > 0 && <span>{maintenanceUnits} maintenance</span>}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Maintenance tab ── */}
        <TabsContent value="maintenance" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Wrench className="h-4 w-4" />
                Maintenance requests — {propertyName}
              </CardTitle>
              <CardDescription>
                Unit numbers and categories only — managed by your property manager.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {maintLoading ? (
                <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
              ) : maintenance.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  <CheckCircle className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No maintenance requests</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {maintenance.map(m => (
                    <div key={m.id} className={`flex items-center justify-between p-3 rounded-lg border ${
                      m.status === 'completed' ? 'border-success/30 bg-success/5 opacity-75' :
                      m.priority === 'urgent' || m.priority === 'high' ? 'border-destructive/30 bg-destructive/5' :
                      'border-border'
                    }`}>
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-medium">{m.unit_number ? `Unit ${m.unit_number}` : 'Common area'}</p>
                            <Badge variant="outline" className={`text-xs ${statusBadgeClass(maintenanceStatusTone(m.status))}`}>
                              {m.status?.replace('_', ' ')}
                            </Badge>
                            {(m.priority === 'urgent' || m.priority === 'high') && (
                              <span className={statusBadgeClass(maintenancePriorityTone(m.priority))}>
                                {m.priority === 'urgent' ? 'Urgent' : 'High'}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {m.category || 'Maintenance'}
                            {m.unit_number && ` · Unit ${m.unit_number}`}
                            {m.requested_date && ` · Submitted ${format(new Date(m.requested_date), 'dd/MM/yy')}`}
                            {m.completion_date && ` · Resolved ${format(new Date(m.completion_date), 'dd/MM/yy')}`}
                          </p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        {m.budget && <p className="text-xs text-muted-foreground">Budget: {fmt(m.budget)}</p>}
                        {m.deposit_deduction_amount > 0 && (
                          <p className="text-xs text-warning">Deposit deduction: {fmt(m.deposit_deduction_amount)}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Documents tab ── */}
        <TabsContent value="documents" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Documents — {propertyName}
              </CardTitle>
              <CardDescription>Statements and reports your manager shared for this property.</CardDescription>
            </CardHeader>
            <CardContent>
              {docsLoading ? (
                <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
              ) : documents.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  <FileText className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No documents shared for this property yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {documents.map(doc => {
                    const cfg = LANDLORD_DOCUMENT_TYPE[doc.document_type] ?? LANDLORD_DOCUMENT_TYPE.custom;
                    const href = doc.signed_url ?? doc.file_url ?? doc.document_url;
                    return (
                      <div key={doc.id} className="flex items-center justify-between p-3 rounded-lg border border-border">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                            <cfg.icon className={`h-4 w-4 ${cfg.color}`} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{doc.title}</p>
                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                              <Badge variant="outline" className="text-xs">{cfg.label}</Badge>
                              {doc.period_start && (
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {format(new Date(doc.period_start), 'MMM yyyy')}
                                  {doc.period_end && doc.period_end !== doc.period_start && ` – ${format(new Date(doc.period_end), 'MMM yyyy')}`}
                                </span>
                              )}
                              <span className="text-xs text-muted-foreground">{format(new Date(doc.created_at), 'dd/MM/yy')}</span>
                            </div>
                          </div>
                        </div>
                        {href && (
                          <a href={href} target="_blank" rel="noopener noreferrer" className="shrink-0 ml-3">
                            <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs">
                              <Download className="h-3.5 w-3.5" />
                              Download
                            </Button>
                          </a>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default LandlordPropertyDetail;
