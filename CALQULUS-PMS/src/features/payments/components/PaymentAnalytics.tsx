// @ts-nocheck — Phase 12: remaining local types until live supabase gen types
import React, { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';
import { TrendingUp, TrendingDown, Users, CreditCard } from 'lucide-react';
import { BRAND_CHART_COLORS } from '@/shared/lib/chartColors';

const fmt = (n: number) =>
  new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 0 }).format(n);

const METHOD_LABELS: Record<string, string> = {
  mpesa_stk:         'M-Pesa STK',
  mpesa_ussd:        'M-Pesa Paybill',
  mpesa_till:        'M-Pesa Till',
  bank_transfer:     'Bank Transfer',
  bank_direct_debit: 'Direct Debit',
  receipt_upload:    'Receipt Upload',
  cash:              'Cash',
};

interface Payment { amount: number; paid_date: string | null; payment_method?: string | null; tenants?: { name: string } | null; }
interface PendingInvoice { amount: number; status: string; }

interface PaymentAnalyticsProps {
  payments: Payment[];
  pendingInvoices: PendingInvoice[];
}

const PaymentAnalytics: React.FC<PaymentAnalyticsProps> = ({ payments, pendingInvoices }) => {
  const totalCollected = payments.reduce((s, p) => s + Number(p.amount), 0);
  const totalPending   = pendingInvoices.reduce((s, i) => s + Number(i.amount), 0);
  const overdue        = pendingInvoices.filter(i => i.status === 'overdue');
  const totalOverdue   = overdue.reduce((s, i) => s + Number(i.amount), 0);
  const collectionRate = totalCollected + totalPending > 0
    ? Math.round((totalCollected / (totalCollected + totalPending)) * 100) : 0;

  // By payment method
  const byMethod = useMemo(() => {
    const map: Record<string, number> = {};
    for (const p of payments) {
      const m = p.payment_method ?? 'unknown';
      map[m] = (map[m] ?? 0) + Number(p.amount);
    }
    return Object.entries(map)
      .map(([method, amount]) => ({ method, label: METHOD_LABELS[method] ?? method, amount }))
      .sort((a, b) => b.amount - a.amount);
  }, [payments]);

  // Monthly trend (last 6 months)
  const monthlyTrend = useMemo(() => {
    const months: Record<string, number> = {};
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months[`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`] = 0;
    }
    for (const p of payments) {
      if (!p.paid_date) continue;
      const key = p.paid_date.slice(0, 7);
      if (key in months) months[key] += Number(p.amount);
    }
    return Object.entries(months).map(([k, v]) => ({ month: k.slice(5), amount: v }));
  }, [payments]);

  // Top tenants
  const topTenants = useMemo(() => {
    const map: Record<string, { name: string; total: number }> = {};
    for (const p of payments) {
      const name = p.tenants?.name ?? 'Unknown';
      if (!map[name]) map[name] = { name, total: 0 };
      map[name].total += Number(p.amount);
    }
    return Object.values(map).sort((a, b) => b.total - a.total).slice(0, 8);
  }, [payments]);

  return (
    <div className="space-y-4">
      {/* KPI row — Navy/Blue trustworthy tones */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Collected', value: fmt(totalCollected), icon: TrendingUp, color: 'text-[hsl(214_73%_48%)]', bg: 'bg-[hsl(214_73%_48%/0.06)]' },
          { label: 'Outstanding', value: fmt(totalPending), icon: CreditCard, color: 'text-[hsl(215_20%_45%)]', bg: 'bg-[hsl(215_20%_45%/0.06)]' },
          { label: 'Overdue balance', value: fmt(totalOverdue), icon: TrendingDown, color: 'text-[hsl(0_72%_51%)]', bg: 'bg-[hsl(0_72%_51%/0.05)]' },
          { label: 'Collection rate', value: `${collectionRate}%`, icon: Users, color: collectionRate >= 80 ? 'text-[hsl(214_73%_48%)]' : 'text-[hsl(215_20%_45%)]', bg: collectionRate >= 80 ? 'bg-[hsl(214_73%_48%/0.06)]' : 'bg-[hsl(215_20%_45%/0.06)]' },
        ].map(k => (
          <div key={k.label} className={`rounded-xl border border-border p-3 ${k.bg}`}>
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs text-muted-foreground">{k.label}</p>
              <k.icon className={`h-4 w-4 ${k.color}`} />
            </div>
            <p className={`text-lg font-bold ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Monthly trend — Navy/Blue bar */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Monthly collections — last 6 months</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={monthlyTrend}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${Math.round(v/1000)}K`} />
                <Tooltip formatter={(v: number) => fmt(v)} />
                <Bar dataKey="amount" name="Collected" fill={BRAND_CHART_COLORS[0]} radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* By payment method — brand palette */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Payment methods</CardTitle>
          </CardHeader>
          <CardContent>
            {byMethod.length === 0 ? (
              <p className="text-center text-muted-foreground text-sm py-8">No payment data</p>
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={byMethod} dataKey="amount" nameKey="label" cx="50%" cy="50%" outerRadius={65}
                    label={({ label, percent }) => percent > 0.05 ? `${label.split(' ')[0]} ${(percent*100).toFixed(0)}%` : ''}
                    labelLine={false}>
                    {byMethod.map((_, i) => <Cell key={i} fill={BRAND_CHART_COLORS[i % BRAND_CHART_COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => fmt(v)} />
                </PieChart>
              </ResponsiveContainer>
            )}
            <div className="space-y-1 mt-2">
              {byMethod.map((m, i) => (
                <div key={m.method} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: BRAND_CHART_COLORS[i % BRAND_CHART_COLORS.length] }} />
                    <span>{m.label}</span>
                  </div>
                  <span className="font-medium">{fmt(m.amount)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top tenants — Navy/Blue progress bars */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Top paying tenants</CardTitle>
          <CardDescription>Highest total payments in selected period</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {topTenants.map((t, i) => (
              <div key={t.name} className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground w-4 text-right">{i+1}</span>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-sm font-medium">{t.name}</span>
                    <span className="text-sm font-semibold text-[hsl(214_73%_48%)]">{fmt(t.total)}</span>
                  </div>
                  <div className="h-1.5 w-full bg-[hsl(215_20%_95%)] rounded-full overflow-hidden">
                    <div className="h-full bg-[hsl(214_73%_48%)] rounded-full"
                      style={{ width: `${(t.total / topTenants[0].total) * 100}%` }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PaymentAnalytics;
