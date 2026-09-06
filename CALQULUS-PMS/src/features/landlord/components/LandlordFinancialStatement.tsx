// @ts-nocheck — Phase 12: remaining local types until live supabase gen types
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/features/auth/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { Label } from '@/shared/components/ui/label';
import { Input } from '@/shared/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/components/ui/table';
import { AlertTriangle } from 'lucide-react';
import { occupancyRateColor } from '@/shared/lib/statusBadge';
import { LANDLORD_TREND_COLORS } from '@/features/landlord/lib/portfolioMetrics';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';

const fmt = (n: number) =>
  new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 0 }).format(n);

interface Props {
  properties: Array<{
    id: string;
    name: string;
    revenue_share_pct: number;
    manager_name: string | null;
  }>;
  /** performance = trend and net; statement = period statement table. Default shows both. */
  mode?: "performance" | "statement" | "full";
}

const LandlordFinancialStatement: React.FC<Props> = ({ properties, mode = "full" }) => {
  const showStatement = mode === "statement" || mode === "full";
  const showPerformance = mode === "performance" || mode === "full";
  const { user } = useAuth();
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>(properties[0]?.id ?? '');
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM

  const periodStart = `${period}-01`;
  const periodEnd = endOfMonth(new Date(periodStart)).toISOString().slice(0, 10);

  const { data: financials, isLoading } = useQuery({
    queryKey: ['landlord-financials', selectedPropertyId, period, user?.id],
    queryFn: async () => {
      if (!selectedPropertyId) return null;
      const { data, error } = await supabase.rpc('get_landlord_revenue', {
        p_property_id:      selectedPropertyId,
        p_landlord_user_id: user!.id,
        p_period_start:     periodStart,
        p_period_end:       periodEnd,
      });
      if (error) throw error;
      return (data?.[0] as Record<string, unknown>) ?? null;
    },
    enabled: !!selectedPropertyId && !!user?.id,
  });

  // Per-unit breakdown — surfaces get_landlord_property_revenue_summary,
  // a privacy-safe RPC (no tenant names/emails/phones) that existed with
  // no UI consumer anywhere in the app.
  const { data: unitSummary, isLoading: isLoadingUnits } = useQuery({
    queryKey: ['landlord-unit-summary', selectedPropertyId, user?.id],
    queryFn: async () => {
      if (!selectedPropertyId) return [];
      const { data, error } = await supabase.rpc('get_landlord_property_revenue_summary' as unknown as string, {
        p_property_id: selectedPropertyId,
      });
      if (error) throw error;
      return (data ?? []) as Array<{
        unit_id: string; lease_start: string | null; monthly_rent: number;
        status: string; unit_number: string; total_paid: number; payment_count: number;
      }>;
    },
    enabled: !!selectedPropertyId && !!user?.id,
  });

  // 6-month trend
  const { data: trend = [] } = useQuery({
    queryKey: ['landlord-trend', selectedPropertyId, user?.id],
    queryFn: async () => {
      if (!selectedPropertyId) return [];
      const months = Array.from({ length: 6 }, (_, i) => {
        const d = subMonths(new Date(), 5 - i);
        return { month: format(d, 'MMM'), start: startOfMonth(d).toISOString().slice(0, 10), end: endOfMonth(d).toISOString().slice(0, 10) };
      });

      const results = await Promise.all(months.map(async m => {
        const { data } = await supabase.rpc('get_landlord_revenue', {
          p_property_id:      selectedPropertyId,
          p_landlord_user_id: user!.id,
          p_period_start:     m.start,
          p_period_end:       m.end,
        });
        return { month: m.month, revenue: Number((data?.[0] as Record<string, unknown>)?.net_to_landlord ?? 0) };
      }));
      return results;
    },
    enabled: !!selectedPropertyId && !!user?.id,
  });

  const property = properties.find(p => p.id === selectedPropertyId);
  const mgmtFee = 100 - (property?.revenue_share_pct ?? 100);

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex gap-3 flex-wrap items-end">
        <div>
          <Label htmlFor="statement-property" className="text-xs text-muted-foreground mb-1 block">Property</Label>
          <Select value={selectedPropertyId} onValueChange={setSelectedPropertyId}>
            <SelectTrigger id="statement-property" className="w-full min-w-0 sm:w-64"><SelectValue /></SelectTrigger>
            <SelectContent>
              {properties.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="statement-period" className="text-xs text-muted-foreground mb-1 block">Period</Label>
          <Input id="statement-period" type="month" value={period} onChange={e => setPeriod(e.target.value)} className="w-full sm:w-40" />
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-48 w-full" />
          <div className="grid grid-cols-3 gap-3">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}
          </div>
        </div>
      ) : !financials ? null : (
        <>
          {showStatement && (() => {
            const collected = Number(financials.gross_rent_collected ?? 0);
            const expense = Number(financials.management_fee ?? 0);
            const net = Number(financials.net_to_landlord ?? 0);
            const outstanding = Number(financials.arrears_total ?? 0);
            const pending = Number(financials.payout_pending ?? 0);
            const periodLabel = format(new Date(periodStart), 'dd/MM/yyyy');
            const statementRows = [
              { date: periodLabel, description: 'Collected — rent received', income: collected, expense: 0, balance: collected },
              { date: periodLabel, description: `Expense — management fee (${mgmtFee}%)`, income: 0, expense, balance: net },
              { date: periodLabel, description: 'Net to you', income: 0, expense: 0, balance: net, emphasize: true },
            ];
            return (
              <Card className="enterprise-card overflow-hidden">
                <CardHeader className="pb-3">
                  <CardTitle className="section-title">Statement — {format(new Date(periodStart), 'MMMM yyyy')}</CardTitle>
                  <CardDescription>
                    Collected is rent received. Expense is the management fee. Net is what remains for you.
                    Outstanding is uncollected arrears. Pending is payout not yet paid out.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead className="text-right">Income</TableHead>
                        <TableHead className="text-right">Expense</TableHead>
                        <TableHead className="text-right">Balance</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {statementRows.map((row) => (
                        <TableRow key={row.description} className={row.emphasize ? 'bg-muted/40' : undefined}>
                          <TableCell className="whitespace-nowrap text-sm">{row.date}</TableCell>
                          <TableCell className={row.emphasize ? 'font-semibold' : undefined}>{row.description}</TableCell>
                          <TableCell className="text-right tabular-nums">{row.income ? fmt(row.income) : '—'}</TableCell>
                          <TableCell className="text-right tabular-nums text-muted-foreground">{row.expense ? fmt(row.expense) : '—'}</TableCell>
                          <TableCell className={`text-right tabular-nums ${row.emphasize ? 'font-bold' : 'font-medium'}`}>
                            {fmt(row.balance)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <div className="grid grid-cols-2 gap-3 p-4 border-t border-border">
                    <div className="rounded-lg border border-border bg-muted/20 p-3">
                      <p className="text-xs text-muted-foreground mb-0.5">Outstanding</p>
                      <p className={`text-lg font-semibold ${outstanding > 0 ? 'text-destructive' : 'text-foreground'}`}>{fmt(outstanding)}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Uncollected arrears</p>
                    </div>
                    <div className="rounded-lg border border-border bg-muted/20 p-3">
                      <p className="text-xs text-muted-foreground mb-0.5">Pending</p>
                      <p className={`text-lg font-semibold ${pending > 0 ? 'text-warning' : 'text-foreground'}`}>{fmt(pending)}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Payout not yet paid</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })()}

          {showPerformance && (
            <>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Total units',    value: String(financials.total_units) },
              { label: 'Occupied',       value: String(financials.occupied_units) },
              { label: 'Occupancy', value: `${financials.occupancy_rate}%`, className: occupancyRateColor(Number(financials.occupancy_rate ?? 0)) },
            ].map(s => (
              <div key={s.label} className="rounded-lg border border-border p-3 bg-muted/20 text-center">
                <p className="text-xs text-muted-foreground mb-1">{s.label}</p>
                <p className={`text-xl font-semibold ${s.className ?? ''}`}>{s.value}</p>
              </div>
            ))}
          </div>

          {Number(financials.arrears_total) > 0 && (
            <div className="flex items-start gap-3 p-4 rounded-xl border border-warning/30 bg-warning/10">
              <AlertTriangle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-foreground">Outstanding</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {fmt(Number(financials.arrears_total))} uncollected. Your manager is working to collect — this is not yet income.
                </p>
              </div>
            </div>
          )}

          {!isLoadingUnits && unitSummary && unitSummary.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Units on this property</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-muted-foreground border-b">
                        <th className="pb-2 font-medium">Unit</th>
                        <th className="pb-2 font-medium">Status</th>
                        <th className="pb-2 font-medium text-right">Billed / month</th>
                        <th className="pb-2 font-medium text-right">Collected</th>
                        <th className="pb-2 font-medium text-right">Payments</th>
                      </tr>
                    </thead>
                    <tbody>
                      {unitSummary.map((u) => (
                        <tr key={u.unit_id} className="border-b last:border-0">
                          <td className="py-2 font-medium">{u.unit_number}</td>
                          <td className="py-2">
                            <span className={`text-xs px-2 py-0.5 rounded-full ${
                              u.status === 'active' ? 'bg-success/15 text-success' : 'bg-muted text-muted-foreground'
                            }`}>
                              {u.status}
                            </span>
                          </td>
                          <td className="py-2 text-right">{fmt(Number(u.monthly_rent || 0))}</td>
                          <td className="py-2 text-right font-medium">{fmt(Number(u.total_paid || 0))}</td>
                          <td className="py-2 text-right text-muted-foreground">{u.payment_count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Net performance — {format(new Date(periodStart), 'MMMM yyyy')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Collected</span>
                  <span className="font-semibold">{fmt(Number(financials.gross_rent_collected))}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">
                    Expense — management fee ({mgmtFee}%{property?.manager_name ? ` · ${property.manager_name}` : ''})
                  </span>
                  <span className="text-muted-foreground">– {fmt(Number(financials.management_fee))}</span>
                </div>
                <div className="h-px bg-border" />
                <div className="flex justify-between items-center">
                  <span className="font-semibold">Net to you ({property?.revenue_share_pct}%)</span>
                  <span className="text-xl font-bold tabular-nums">{fmt(Number(financials.net_to_landlord))}</span>
                </div>
              </div>
            </CardContent>
          </Card>
            </>
          )}
        </>
      )}

      {showPerformance && trend.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">6-month net to you</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="chart-frame h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trend} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => v >= 1000 ? `${v/1000}k` : String(v)} />
                <Tooltip formatter={(v: number) => fmt(v)} />
                <Bar dataKey="revenue" fill={LANDLORD_TREND_COLORS.net} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default LandlordFinancialStatement;
