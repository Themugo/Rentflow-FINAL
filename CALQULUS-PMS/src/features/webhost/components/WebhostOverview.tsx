import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { formatDistanceToNow } from 'date-fns';
import {
  Users, Building,
  CheckCircle, Clock, DollarSign, Home, Search,
  AlertCircle, BarChart3, ArrowRight, Zap, RefreshCw,
  ShieldCheck, Layers, ScrollText, Tag, ChevronRight,
  ServerCog, MapPin, Bug, Receipt,
} from 'lucide-react';
import { HEALTH_COPY, usePlatformHealth } from '@/features/webhost/hooks/usePlatformHealth';
import { EmptyState } from '@/shared/components/ui/empty-state';
import { CALQULUS_COLOR } from '@/shared/theme/tokens';

type ManagerInvoiceRow = { amount: number | null };
type PropertyRow = { id: string; name: string; address: string | null; manager_id: string | null; created_at: string };
type ProfileRow = { id: string; email: string | null; full_name: string | null };

const fmt = (n: number) =>
  new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 0 }).format(n);

interface WebhostOverviewProps {
  onNavigateTab?: (tab: string) => void;
}

// ── Platform status band ─────────────────────────────────────────────
const PlatformStatusBand: React.FC<{ onNavigateTab?: (tab: string) => void }> = ({ onNavigateTab }) => {
  const { data: health = 'unknown', isLoading } = usePlatformHealth();
  const copy = HEALTH_COPY[health];
  return (
    <Card className="enterprise-card rounded-2xl">
      <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
            <ServerCog className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              {isLoading ? (
                <Skeleton className="h-3 w-32 bg-secondary-background" />
              ) : (
                <span className="flex items-center gap-1.5">
                  <span className={`h-2 w-2 rounded-full ${copy.dot} ${health === 'healthy' ? 'animate-pulse' : ''}`} aria-hidden />
                  <span className={`text-sm font-bold ${copy.text}`}>{copy.label}</span>
                </span>
              )}
            </div>
            <p className="text-[11px] text-secondary-foreground mt-0.5 leading-tight">{copy.sub}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge variant="outline" className="text-[10px] border-border bg-secondary-background text-secondary-foreground font-bold uppercase tracking-wider">
            Platform Administration
          </Badge>
          {onNavigateTab && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onNavigateTab('security')}
              className="h-7 text-xs text-secondary-foreground hover:text-primary hover:bg-soft-blue px-2 font-medium"
            >
              Security <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

// ── Empty state for zero-value attention items ───────────────────────
const HealthyEmpty: React.FC<{ message: string }> = ({ message }) => (
  <div className="flex items-center gap-2 rounded-lg bg-success/10 border border-success/20 px-2.5 py-1.5">
    <CheckCircle className="h-3.5 w-3.5 text-success shrink-0" />
    <span className="text-[11px] font-medium text-success">{message}</span>
  </div>
);

interface RevenueTrendPoint {
  month: string;
  monthFull: string;
  revenue: number;
  rawMonth: string;
}

const CustomRevenueTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ payload: RevenueTrendPoint }> }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="enterprise-card rounded-xl p-3 shadow-md text-foreground">
        <p className="text-[11px] font-bold text-secondary-foreground uppercase tracking-wider">{data.monthFull}</p>
        <p className="text-base font-black text-primary mt-1">
          {fmt(data.revenue)}
        </p>
        <div className="text-[10px] text-success font-semibold mt-1 flex items-center gap-1 bg-success/10 px-2 py-0.5 rounded-full border border-success/20 w-fit">
          <CheckCircle className="h-3 w-3" /> Paid Invoices
        </div>
      </div>
    );
  }
  return null;
};

const PlatformRevenueTrend: React.FC<{ onNavigateTab?: (tab: string) => void }> = ({ onNavigateTab }) => {
  const { data: trend = [], isLoading } = useQuery<RevenueTrendPoint[]>({
    queryKey: ['platform-revenue-6mo'],
    queryFn: async () => {
      const months = Array.from({ length: 6 }, (_, i) => {
        const d = new Date();
        d.setMonth(d.getMonth() - (5 - i));
        return d.toISOString().slice(0, 7);
      });
      return Promise.all(months.map(async (m) => {
        const start = `${m}-01`;
        const end = new Date(start);
        end.setMonth(end.getMonth() + 1);
        const { data } = await supabase.from('manager_invoices').select('amount')
          .eq('status', 'paid').gte('paid_date', start).lt('paid_date', end.toISOString().slice(0, 10));
        const rows = (data as ManagerInvoiceRow[] | null) || [];
        const revenue = rows.reduce((s, i) => s + Number(i.amount), 0);

        const dateObj = new Date(`${m}-01T00:00:00`);
        const monthShort = dateObj.toLocaleDateString('en-US', { month: 'short' });
        const monthFull = dateObj.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

        return {
          month: monthShort,
          monthFull,
          revenue,
          rawMonth: m,
        };
      }));
    },
  });

  const total6Mo = trend.reduce((sum, t) => sum + t.revenue, 0);
  const avgMonthly = Math.round(total6Mo / 6);
  const hasBillingData = total6Mo > 0;

  return (
    <Card className="enterprise-card rounded-xl overflow-hidden">
      <CardHeader className="pb-3 pt-5 px-5 border-b border-border">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <CardTitle className="text-sm font-bold flex items-center gap-2 text-foreground">
              <BarChart3 className="h-4 w-4 text-primary" />
              Platform Revenue Trend — Last 6 Months
            </CardTitle>
            <CardDescription className="text-xs text-secondary-foreground">Subscription billing collected across registered property managers</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[10px] border-primary/30 text-primary bg-primary/10 font-bold">
              Avg: {fmt(avgMonthly)}/mo
            </Badge>
            {onNavigateTab && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onNavigateTab('billing')}
                className="h-7 text-xs text-primary hover:text-primary hover:bg-soft-blue px-2 font-medium"
              >
                Billing Details <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-4 sm:px-5 pt-5 pb-4">
        {isLoading ? (
          <Skeleton className="h-48 w-full bg-secondary-background rounded-xl" />
        ) : !hasBillingData ? (
          <div className="h-48 w-full flex flex-col items-center justify-center text-center px-4">
            <div className="h-12 w-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-3">
              <BarChart3 className="h-6 w-6 text-primary" />
            </div>
            <p className="text-sm font-semibold text-secondary-foreground">No billing activity recorded in the last 6 months</p>
            <p className="text-xs text-secondary-foreground mt-1 max-w-sm">
              Paid manager invoices will appear here once subscription billing begins.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="h-48 w-full pt-1">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="blueRevenueGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={CALQULUS_COLOR.primary} stopOpacity={0.35} />
                      <stop offset="95%" stopColor={CALQULUS_COLOR.primary} stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={CALQULUS_COLOR.border} opacity={0.7} vertical={false} />
                  <XAxis 
                    dataKey="month" 
                    stroke={CALQULUS_COLOR.textMuted} 
                    tick={{ fontSize: 11, fill: CALQULUS_COLOR.textMuted, fontWeight: 600 }}
                    tickLine={false}
                    axisLine={{ stroke: CALQULUS_COLOR.border }}
                  />
                  <YAxis 
                    stroke={CALQULUS_COLOR.textMuted} 
                    tick={{ fontSize: 10, fill: CALQULUS_COLOR.textMuted }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(val) => val >= 1000 ? `${(val / 1000).toFixed(0)}k` : `${val}`}
                  />
                  <Tooltip content={<CustomRevenueTooltip />} />
                  <Area 
                    type="monotone" 
                    dataKey="revenue" 
                    stroke={CALQULUS_COLOR.primary} 
                    strokeWidth={2.5}
                    fillOpacity={1} 
                    fill="url(#blueRevenueGradient)" 
                    activeDot={{ r: 6, fill: CALQULUS_COLOR.primary, stroke: CALQULUS_COLOR.white, strokeWidth: 2 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="flex justify-between items-center text-[11px] text-secondary-foreground pt-3 border-t border-border">
              <span>Total 6-Month Billing: <strong className="text-foreground font-bold ml-1">{fmt(total6Mo)}</strong></span>
              <span className="text-primary/90 font-medium flex items-center gap-1">
                Paid subscription invoices
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

type OverviewStats = {
  totalManagers: number;
  pendingManagers: number;
  approvedManagers: number;
  rejectedManagers: number;
  totalProperties: number;
  totalWebhosts: number;
  revenueMTD: number;
  revenueLM: number;
  revenueChange: number;
  pendingManagerInvoices: number;
  overdueManagerInvoices: number;
  systemLandlords: number;
  pendingPayouts: number;
};

interface CardShellProps {
  onClick?: () => void;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: { label: string; cls: string };
  children: React.ReactNode;
}

const CardShell: React.FC<CardShellProps> = ({ onClick, title, icon: Icon, badge, children }) => {
  return (
    <Card
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={(e) => { if (onClick && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onClick(); } }}
      className={`enterprise-card rounded-2xl hover:shadow-md transition-all ${onClick ? 'cursor-pointer group focus:outline-none focus-visible:ring-2 focus-visible:ring-ring' : ''}`}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2.5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 group-hover:text-primary">
            <Icon className="h-3.5 w-3.5 text-primary" />
            {title}
          </span>
          {badge && (
            <Badge variant="outline" className={`text-[10px] h-5 px-2 ${badge.cls} font-bold`}>{badge.label}</Badge>
          )}
        </div>
        {children}
      </CardContent>
    </Card>
  );
};

const WebhostOverview: React.FC<WebhostOverviewProps> = ({ onNavigateTab }) => {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');

  const { data: stats, isLoading } = useQuery<OverviewStats>({
    queryKey: ['webhost-overview-stats-v2'],
    queryFn: async () => {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
      const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0).toISOString();
      const [
        totalManagers, pendingManagers, approvedManagers, rejectedManagers,
        totalProperties, totalWebhosts,
        platformRevenueMTD, platformRevenueLM,
        pendingManagerInvoices, overdueManagerInvoices,
        systemLandlords, pendingPayouts,
      ] = await Promise.all([
        supabase.from('manager_profiles').select('id', { count: 'exact', head: true }),
        supabase.from('manager_profiles').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('manager_profiles').select('id', { count: 'exact', head: true }).eq('status', 'approved'),
        supabase.from('manager_profiles').select('id', { count: 'exact', head: true }).eq('status', 'rejected'),
        supabase.from('properties').select('id', { count: 'exact', head: true }),
        supabase.from('user_roles').select('id', { count: 'exact', head: true }).eq('role', 'webhost'),
        supabase.from('manager_invoices').select('amount').eq('status', 'paid').gte('paid_date', startOfMonth),
        supabase.from('manager_invoices').select('amount').eq('status', 'paid')
          .gte('paid_date', startOfLastMonth).lte('paid_date', endOfLastMonth),
        supabase.from('manager_invoices').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('manager_invoices').select('id', { count: 'exact', head: true }).eq('status', 'overdue'),
        supabase.from('property_landlords').select('id', { count: 'exact', head: true }).is('manager_id', null),
        supabase.from('payout_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending').eq('recipient_type', 'webhost'),
      ]);
      const revenueMTD = ((platformRevenueMTD.data as ManagerInvoiceRow[] | null) ?? []).reduce((s,i) => s + Number(i.amount), 0);
      const revenueLM = ((platformRevenueLM.data as ManagerInvoiceRow[] | null) ?? []).reduce((s,i) => s + Number(i.amount), 0);
      const revenueChange = revenueLM > 0 ? Math.round(((revenueMTD - revenueLM) / revenueLM) * 100) : 0;
      return {
        totalManagers: totalManagers.count ?? 0,
        pendingManagers: pendingManagers.count ?? 0,
        approvedManagers: approvedManagers.count ?? 0,
        rejectedManagers: rejectedManagers.count ?? 0,
        totalProperties: totalProperties.count ?? 0,
        totalWebhosts: totalWebhosts.count ?? 0,
        revenueMTD, revenueLM, revenueChange,
        pendingManagerInvoices: pendingManagerInvoices.count ?? 0,
        overdueManagerInvoices: overdueManagerInvoices.count ?? 0,
        systemLandlords: systemLandlords.count ?? 0,
        pendingPayouts: pendingPayouts.count ?? 0,
      };
    },
  });

  const { data: latestProperties = [], isLoading: isLoadingProperties } = useQuery({
    queryKey: ['webhost-latest-properties-audit'],
    queryFn: async () => {
      const { data: props, error } = await supabase.from('properties')
        .select('id, name, address, manager_id, created_at').order('created_at', { ascending: false }).limit(8);
      if (error) throw error;
      const typedProps = (props || []) as PropertyRow[];
      const managerIds = [...new Set(typedProps.map(p => p.manager_id).filter(Boolean))];
      const { data: profiles } = managerIds.length > 0
        ? await supabase.from('profiles').select('id, email, full_name').in('id', managerIds)
        : { data: [] as ProfileRow[] };
      const profileById = new Map((profiles as ProfileRow[] || []).map(p => [p.id, p]));
      return typedProps.map(p => ({ ...p, manager_profile: p.manager_id ? profileById.get(p.manager_id) ?? null : null }));
    },
  });

  const filteredProperties = latestProperties.filter(prop => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      prop.name.toLowerCase().includes(q) ||
      (prop.address && prop.address.toLowerCase().includes(q)) ||
      (prop.manager_profile?.full_name && prop.manager_profile.full_name.toLowerCase().includes(q)) ||
      (prop.manager_profile?.email && prop.manager_profile.email.toLowerCase().includes(q))
    );
  });

  // ── derived values (no new queries, no invented data) ───────────────
  const s = stats ?? ({} as Partial<OverviewStats>);
  const pendingManagers = s.pendingManagers ?? 0;
  const overdueInvoices = s.overdueManagerInvoices ?? 0;
  const pendingPayouts = s.pendingPayouts ?? 0;
  const attentionCount = pendingManagers + overdueInvoices + pendingPayouts;
  const hasAttention = attentionCount > 0;

  const revenueMTD = s.revenueMTD ?? 0;
  const revenueLM = s.revenueLM ?? 0;
  const pendingInvoices = s.pendingManagerInvoices ?? 0;
  // Only show MoM growth when there is meaningful historical data (last
  // month revenue > 0). Otherwise an honest "no billing activity yet"
  // state — never a misleading "+0% MoM".
  const hasBillingHistory = revenueLM > 0;
  const momChange = s.revenueChange ?? 0;
  const momUp = momChange >= 0;

  const totalManagers = s.totalManagers ?? 0;
  const approvedManagers = s.approvedManagers ?? 0;
  const totalProperties = s.totalProperties ?? 0;
  const systemLandlords = s.systemLandlords ?? 0;
  const totalWebhosts = s.totalWebhosts ?? 0;

  return (
    <div className="space-y-6">
      {/* ── 1. PLATFORM STATUS ── */}
      <PlatformStatusBand onNavigateTab={onNavigateTab} />

      {/* ── 2. EXECUTIVE ANSWERS (Attention · Subscriptions · Accounts · Security) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <CardShell
          title="Attention"
          icon={AlertCircle}
          onClick={() => onNavigateTab?.(pendingManagers > 0 ? 'managers' : overdueInvoices > 0 ? 'billing' : 'billing')}
          badge={hasAttention
            ? { label: `${attentionCount} item${attentionCount === 1 ? '' : 's'}`, cls: 'border-warning/30 text-warning bg-warning/10' }
            : { label: 'All clear', cls: 'border-success/30 text-success bg-success/10' }
          }
        >
          {isLoading ? (
            <div className="space-y-2">{[0,1,2].map(i => <Skeleton key={i} className="h-4 w-full bg-secondary-background rounded" />)}</div>
          ) : hasAttention ? (
            <div className="space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-secondary-foreground font-medium">Pending Managers</span>
                <span className="font-bold text-warning flex items-center gap-1">
                  {pendingManagers}
                  {pendingManagers > 0 && <ChevronRight className="h-3 w-3" />}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-secondary-foreground font-medium">Overdue Invoices</span>
                <span className="font-bold text-destructive flex items-center gap-1">
                  {overdueInvoices}
                  {overdueInvoices > 0 && <ChevronRight className="h-3 w-3" />}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-secondary-foreground font-medium">Pending Payouts</span>
                <span className="font-bold text-foreground">{pendingPayouts}</span>
              </div>
            </div>
          ) : (
            <HealthyEmpty message="No outstanding approvals, overdue invoices, or payouts" />
          )}
        </CardShell>

        <CardShell
          title="Subscriptions"
          icon={DollarSign}
          onClick={() => onNavigateTab?.('billing')}
          badge={hasBillingHistory
            ? { label: `${momUp ? '+' : ''}${momChange}% MoM`, cls: `border-warning/30 ${momUp ? 'text-success bg-success/10' : 'text-destructive bg-destructive/10'}` }
            : { label: 'No activity', cls: 'border-border text-secondary-foreground bg-secondary-background' }
          }
        >
          {isLoading ? (
            <div className="space-y-2">{[0,1,2].map(i => <Skeleton key={i} className="h-4 w-full bg-secondary-background rounded" />)}</div>
          ) : hasBillingHistory || revenueMTD > 0 ? (
            <div className="space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-secondary-foreground font-medium">Revenue MTD</span>
                <span className="font-bold text-success">{fmt(revenueMTD)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-secondary-foreground font-medium">Last Month</span>
                <span className="font-semibold text-foreground">{fmt(revenueLM)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-secondary-foreground font-medium">Pending Invoices</span>
                <span className="font-semibold text-warning">{pendingInvoices}</span>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs font-medium text-secondary-foreground">No billing activity yet</p>
              <p className="text-[11px] text-secondary-foreground leading-tight">
                Paid manager invoices will populate revenue figures once subscription billing begins.
              </p>
            </div>
          )}
        </CardShell>

        <CardShell
          title="Accounts"
          icon={Building}
          onClick={() => onNavigateTab?.('managers')}
          badge={{ label: 'Active scope', cls: 'border-primary/30 text-primary bg-primary/10' }}
        >
          {isLoading ? (
            <div className="space-y-2">{[0,1,2].map(i => <Skeleton key={i} className="h-4 w-full bg-secondary-background rounded" />)}</div>
          ) : (
            <div className="space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-secondary-foreground font-medium">Managers</span>
                <span className="font-bold text-foreground">{totalManagers} <span className="text-secondary-foreground font-normal">({approvedManagers} approved)</span></span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-secondary-foreground font-medium">Properties</span>
                <span className="font-bold text-foreground">{totalProperties}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-secondary-foreground font-medium">System Landlords</span>
                <span className="font-bold text-foreground">{systemLandlords}</span>
              </div>
            </div>
          )}
        </CardShell>

        <CardShell
          title="Security"
          icon={ShieldCheck}
          onClick={() => onNavigateTab?.('security')}
          badge={{ label: 'Enforced', cls: 'border-info/30 text-info bg-info/10' }}
        >
          {isLoading ? (
            <div className="space-y-2">{[0,1,2].map(i => <Skeleton key={i} className="h-4 w-full bg-secondary-background rounded" />)}</div>
          ) : (
            <div className="space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-secondary-foreground font-medium">Webhost Admins</span>
                <span className="font-bold text-foreground">{totalWebhosts}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-secondary-foreground font-medium">Tenant Access</span>
                <span className="font-bold text-success">Blocked (Firewall)</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-secondary-foreground font-medium">Isolation</span>
                <span className="font-bold text-success">RLS Enforced</span>
              </div>
            </div>
          )}
        </CardShell>
      </div>

      {/* ── MAIN WORKSPACE: subscriptions trend + shortcuts ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-8 space-y-5">
          <PlatformRevenueTrend onNavigateTab={onNavigateTab} />
        </div>

        <div className="lg:col-span-4 space-y-5">
          <Card className="enterprise-card rounded-2xl overflow-hidden">
            <CardHeader className="pb-2 pt-4 px-4 sm:px-5 border-b border-border">
              <CardTitle className="text-sm font-bold flex items-center gap-2 text-foreground">
                <Zap className="h-4 w-4 text-primary" />
                Platform shortcuts
              </CardTitle>
              <CardDescription className="text-xs text-secondary-foreground">Accounts, subscriptions, security, and issues first</CardDescription>
            </CardHeader>
            <CardContent className="p-3">
              <div className="space-y-1.5">
                {([
                  { tab: 'managers', icon: Users, label: 'Accounts', meta: `${approvedManagers} approved` },
                  { tab: 'billing', icon: Receipt, label: 'Subscriptions', meta: 'Billing' },
                  { tab: 'security', icon: ShieldCheck, label: 'Security & audit', meta: 'Protected' },
                  { tab: 'error-logs', icon: Bug, label: 'Issues', meta: 'Support' },
                  { tab: 'tiers', icon: Layers, label: 'Subscription tiers', meta: 'Configured' },
                  { tab: 'billing-rules', icon: ScrollText, label: 'Billing rules', meta: 'Active' },
                  { tab: 'custom-pricing', icon: Tag, label: 'Custom pricing', meta: 'Manage' },
                  { tab: 'unlinked-landlords', icon: Home, label: 'System landlords', meta: `${systemLandlords} unlinked` },
                ] as const).map(item => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.tab}
                      type="button"
                      onClick={() => onNavigateTab?.(item.tab)}
                      className="w-full min-h-10 p-2.5 rounded-xl border border-border bg-card hover:bg-secondary-background hover:border-primary/40 flex items-center justify-between text-xs transition-all text-left group focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <span className="font-semibold text-foreground flex items-center gap-2 group-hover:text-primary">
                        <Icon className="h-3.5 w-3.5 text-primary" />
                        {item.label}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <Badge variant="outline" className="text-[10px] border-border bg-secondary-background text-secondary-foreground font-bold">{item.meta}</Badge>
                        <ChevronRight className="h-3 w-3 text-secondary-foreground group-hover:text-primary" />
                      </div>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card
            onClick={() => onNavigateTab?.('security')}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onNavigateTab?.('security'); } }}
            className="enterprise-card hover:border-primary/40 transition-all cursor-pointer group rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <CardContent className="p-4 flex items-start gap-3">
              <div className="h-9 w-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                <ShieldCheck className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center justify-between gap-2">
                  <span>Tenant data isolation</span>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground group-hover:translate-x-0.5 transition-transform shrink-0" />
                </p>
                <p className="text-xs text-secondary-foreground mt-1.5 leading-relaxed font-normal">
                  Webhost administrators operate at the platform level only. Tenant identities, rent payments, and lease details stay isolated from this view.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Demoted: recent organizations — not first-screen operational clutter */}
      <Card className="enterprise-card rounded-2xl overflow-hidden">
        <CardHeader className="pb-3 pt-4 px-4 sm:px-5 border-b border-border">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-sm font-bold flex items-center gap-2 text-foreground">
                <Building className="h-4 w-4 text-primary" />
                Recent organizations
              </CardTitle>
              <CardDescription className="text-xs text-secondary-foreground">
                Latest properties registered across manager accounts
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative min-w-[200px] flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-secondary-foreground" />
                <Input
                  type="text"
                  placeholder="Search organizations…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  aria-label="Search recent organizations"
                  className="h-10 pl-8 text-xs bg-card border-border text-foreground placeholder:text-secondary-foreground focus:border-primary/50 rounded-lg"
                />
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => queryClient.invalidateQueries()}
                aria-label="Refresh data"
                className="h-10 w-10 p-0 text-secondary-foreground hover:text-primary hover:bg-soft-blue"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4">
          {isLoadingProperties ? (
            <div className="space-y-2">
              {Array.from({length:4}).map((_,i) => <Skeleton key={i} className="h-14 w-full bg-secondary-background rounded-xl" />)}
            </div>
          ) : filteredProperties.length === 0 ? (
            <EmptyState
              icon={Building}
              title={searchQuery ? 'No matching organizations' : 'No organizations on record yet'}
              description={searchQuery ? 'Try a different search term.' : 'Newly registered properties will appear here.'}
              className="border-0 bg-transparent min-h-[160px]"
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {(filteredProperties as (PropertyRow & { manager_profile: ProfileRow | null })[]).map(prop => {
                const hasManager = !!prop.manager_profile;
                const registeredAt = prop.created_at ? formatDistanceToNow(new Date(prop.created_at), { addSuffix: true }) : '';
                return (
                  <div
                    key={prop.id}
                    onClick={() => onNavigateTab?.('properties')}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onNavigateTab?.('properties'); } }}
                    className="flex items-start justify-between gap-3 rounded-xl border border-border bg-card p-3 hover:bg-secondary-background hover:border-primary/40 transition-all cursor-pointer group focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-foreground truncate group-hover:text-primary transition-colors">{prop.name}</p>
                      <p className="text-[11px] text-secondary-foreground truncate flex items-center gap-1 mt-0.5">
                        <MapPin className="h-3 w-3 text-secondary-foreground shrink-0" />
                        {prop.address || 'No location specified'}
                      </p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <Badge variant="outline" className={`text-[9px] h-4 px-1.5 font-bold ${hasManager ? 'border-success/30 text-success bg-success/10' : 'border-border text-secondary-foreground bg-secondary-background'}`}>
                          {hasManager ? 'Linked' : 'Unlinked'}
                        </Badge>
                        {registeredAt && (
                          <span className="text-[10px] text-secondary-foreground flex items-center gap-1">
                            <Clock className="h-2.5 w-2.5" /> {registeredAt}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0 max-w-[130px]">
                      <p className="text-[11px] font-semibold text-primary truncate">
                        {prop.manager_profile?.full_name || (hasManager ? 'Manager' : '—')}
                      </p>
                      <p className="text-[10px] text-secondary-foreground truncate">
                        {prop.manager_profile?.email || (hasManager ? '—' : 'No manager')}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default WebhostOverview;