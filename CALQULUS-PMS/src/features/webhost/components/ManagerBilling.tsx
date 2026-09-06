import React, { useEffect, useRef, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';
import { Button } from '@/shared/components/ui/button';
import { useToast } from '@/shared/hooks/use-toast';
import { FileText, Receipt, LayoutDashboard, TrendingUp, Settings, Users, Building2, RefreshCw, AlertTriangle, Banknote, CheckCircle, Clock, Layers, ScrollText, FileSignature, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { startOfMonth, subMonths, endOfMonth, isAfter } from 'date-fns';
import { cn } from '@/shared/lib/utils';
import BillingOverview from './BillingOverview';
import ManagerInvoices, { ManagerInvoice, BILLING_CONFIG } from './ManagerInvoices';
import ManagerReceipts from './ManagerReceipts';
import BillingAnalytics from './BillingAnalytics';
import WebhostPaymentSettings from './WebhostPaymentSettings';
import LandlordBilling from './LandlordBilling';
import ManagerBillingDrilldown from './ManagerBillingDrilldown';

interface Manager {
  id: string;
  user_id: string;
  email: string;
  full_name: string | null;
  property_count: number;
  has_registration_invoice: boolean;
  net_collection: number;
}

const ManagerBilling = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const paymentProcessedRef = useRef(false);

  // Check for payment success/failure in URL
  useEffect(() => {
    const payment = searchParams.get('payment');
    if (!payment || paymentProcessedRef.current) return;

    paymentProcessedRef.current = true;
    if (payment === 'success') {
      toast({ 
        title: 'Payment processing', 
        description: 'Please wait while we confirm your payment. This may take a few moments.' 
      });
      setTimeout(() => queryClient.invalidateQueries({ queryKey: ['manager-invoices'] }), 3000);
      setSearchParams({});
    } else if (payment === 'cancelled') {
      toast({ title: 'Payment cancelled', variant: 'destructive' });
      setSearchParams({});
    }
  }, [searchParams, toast, queryClient, setSearchParams]);

  // Fetch payment settings
  const { data: paymentSettings } = useQuery({
    queryKey: ['webhost-payment-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('webhost_payment_settings')
        .select('*')
        .limit(1)
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
  });

  // Fetch managers with property count and net collection
  const { data: managers } = useQuery({
    queryKey: ['webhost-managers-for-billing'],
    queryFn: async () => {
      const { data: roles, error } = await supabase
        .from('user_roles')
        .select('id, user_id, created_at')
        .eq('role', 'manager');

      if (error) throw error;

      const managersWithDetails = await Promise.all(
        (roles || []).map(async (role) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('email, full_name')
            .eq('id', role.user_id)
            .single();

          // Count properties for this manager
          const { count: propertyCount } = await supabase
            .from('properties')
            .select('*', { count: 'exact', head: true })
            .eq('manager_id', role.user_id);

          // Check if manager has a registration invoice
          const { data: regInvoice } = await supabase
            .from('manager_invoices')
            .select('id')
            .eq('manager_user_id', role.user_id)
            .eq('invoice_type', 'registration')
            .maybeSingle();

          // net_collection: platform billing only — how much the manager has paid to the platform
          // We do NOT query tenant rent payments (that data belongs to the manager only)
          const { data: paidManagerInvoices } = await supabase
            .from('manager_invoices')
            .select('amount')
            .eq('manager_user_id', role.user_id)
            .eq('status', 'paid');

          const netCollection = (paidManagerInvoices || []).reduce(
            (sum, inv) => sum + Number(inv.amount), 0
          );

          return {
            id: role.id,
            user_id: role.user_id,
            email: profile?.email || 'Unknown',
            full_name: profile?.full_name || null,
            property_count: propertyCount || 0,
            has_registration_invoice: !!regInvoice,
            net_collection: netCollection,
          };
        })
      );

      return managersWithDetails as Manager[];
    },
  });

  // Fetch manager invoices
  const { data: invoices, isLoading } = useQuery({
    queryKey: ['manager-invoices'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('manager_invoices')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as ManagerInvoice[];
    },
  });

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['manager-invoices'] });
    queryClient.invalidateQueries({ queryKey: ['webhost-managers-for-billing'] });
    queryClient.invalidateQueries({ queryKey: ['webhost-payment-settings'] });
  };

  // ── Real revenue/billing KPIs derived from existing invoice data ──
  const billing = useMemo(() => {
    const list = invoices ?? [];
    const fmtKES = (n: number) => n.toLocaleString('en-KE');
    const paidInvoices = list.filter(i => i.status === 'paid');
    const totalPaid = paidInvoices.reduce((s, i) => s + Number(i.amount), 0);

    const now = new Date();
    const mtdStart = startOfMonth(now);
    const lastMonthStart = startOfMonth(subMonths(now, 1));
    const lastMonthEnd = endOfMonth(subMonths(now, 1));

    const paidInMonth = (from: Date, to: Date) => paidInvoices
      .filter(i => { const d = i.paid_date ? new Date(i.paid_date) : null; return d && d >= from && d <= to; })
      .reduce((s, i) => s + Number(i.amount), 0);

    const revenueMTD = paidInMonth(mtdStart, now);
    const revenuePrevMonth = paidInMonth(lastMonthStart, lastMonthEnd);

    const outstanding = list
      .filter(i => i.status === 'pending' || i.status === 'overdue')
      .reduce((s, i) => s + Number(i.amount), 0);
    const outstandingCount = list.filter(i => i.status === 'pending' || i.status === 'overdue').length;
    const overdueCount = list.filter(i => (i.status === 'pending' || i.status === 'overdue') && isAfter(now, new Date(i.due_date))).length;
    const paidCount = paidInvoices.length;

    const totalBilled = list.reduce((s, i) => s + Number(i.amount), 0);
    const collectionRate = totalBilled > 0 ? (totalPaid / totalBilled) * 100 : 0;

    // Honest trend: only meaningful when previous month had revenue
    const hasHistory = revenuePrevMonth > 0;
    const momChange = hasHistory ? ((revenueMTD - revenuePrevMonth) / revenuePrevMonth) * 100 : 0;
    const isPositive = momChange >= 0;

    // Subscription billing health (from existing invoice_type field — no new query)
    const activeSubs = new Set(paidInvoices.filter(i => i.invoice_type === 'subscription').map(i => i.manager_user_id)).size;

    return { fmtKES, totalPaid, revenueMTD, revenuePrevMonth, outstanding, outstandingCount, overdueCount, paidCount, collectionRate, hasHistory, momChange, isPositive, activeSubs, total: list.length };
  }, [invoices]);

  const hasActivity = (invoices?.length ?? 0) > 0 || (managers?.length ?? 0) > 0;

  return (
    <div className="space-y-5">
      {/* Control-center header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 enterprise-card p-4 sm:p-5">
        <div>
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <Banknote className="h-5 w-5 text-warning" />
            Platform Billing &amp; Revenue Control Center
          </h2>
          <p className="text-muted-foreground text-xs mt-1">
            Platform revenue, manager invoices, and subscription billing health. Payment operations remain backend-authorized.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" className="border-border text-muted-foreground hover:bg-secondary-background hover:text-foreground h-9 rounded-xl text-xs" onClick={handleRefresh} aria-label="Refresh billing data">
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />Refresh
          </Button>
        </div>
      </div>

      {/* Billing navigation — connects the commercial controls without duplicating them */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {[
          { label: 'Billing', desc: 'Invoices & revenue', icon: Banknote, current: true },
          { label: 'Tiers', desc: 'Tier configuration', icon: Layers, current: false },
          { label: 'Billing Rules', desc: 'Platform rules', icon: ScrollText, current: false },
          { label: 'Custom Pricing', desc: 'Per-unit overrides', icon: FileSignature, current: false },
          { label: 'Contracts', desc: 'Service agreements', icon: FileText, current: false },
        ].map(({ label, desc, icon: Icon, current }) => (
          <div key={label} className={cn('flex items-center gap-2 p-2.5 rounded-lg border text-left', current ? 'border-warning/40 bg-warning/10' : 'border-border bg-secondary-background opacity-70')}>
            <Icon className={cn('h-4 w-4 shrink-0', current ? 'text-warning' : 'text-secondary-foreground')} />
            <div className="min-w-0">
              <p className={cn('text-xs font-semibold truncate', current ? 'text-warning' : 'text-secondary-foreground')}>{label}{current && ' (here)'}</p>
              <p className="text-[10px] text-muted-foreground truncate">{desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* KPI strip — real data derived from existing invoices query */}
      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-24 rounded-xl bg-card border border-border animate-pulse" />)}
        </div>
      ) : !hasActivity ? (
        <div className="p-10 text-center rounded-2xl border border-border bg-secondary-background">
          <Banknote className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">No billing activity recorded.</p>
          <p className="text-xs text-muted-foreground mt-1">Invoices and revenue will appear here once managers are billed.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="flex items-center justify-between gap-2 p-3 rounded-xl border border-success/40 bg-success/10 text-success">
            <div className="min-w-0">
              <span className="text-[10px] font-bold uppercase tracking-wide opacity-80 block">Revenue MTD</span>
              <strong className="font-['Outfit'] text-xl font-bold text-foreground">KES {billing.fmtKES(billing.revenueMTD)}</strong>
              {billing.hasHistory ? (
                <span className={cn('text-[10px] flex items-center gap-0.5 mt-0.5', billing.isPositive ? 'text-success' : 'text-destructive')}>
                  {billing.isPositive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                  {Math.abs(billing.momChange).toFixed(1)}% vs last month
                </span>
              ) : (
                <span className="text-[10px] text-muted-foreground mt-0.5 block">No prior-month revenue to compare</span>
              )}
            </div>
            <TrendingUp className="h-5 w-5 shrink-0 opacity-80" />
          </div>

          <div className="flex items-center justify-between gap-2 p-3 rounded-xl border border-border bg-secondary-background text-muted-foreground">
            <div className="min-w-0">
              <span className="text-[10px] font-bold uppercase tracking-wide opacity-80 block">Outstanding</span>
              <strong className="font-['Outfit'] text-xl font-bold text-foreground">KES {billing.fmtKES(billing.outstanding)}</strong>
              <span className="text-[10px] text-muted-foreground mt-0.5 block">{billing.outstandingCount} open{billing.overdueCount > 0 ? ` · ${billing.overdueCount} overdue` : ''}</span>
            </div>
            <Clock className="h-5 w-5 shrink-0 opacity-80" />
          </div>

          <div className="flex items-center justify-between gap-2 p-3 rounded-xl border border-primary/40 bg-primary/10 text-primary">
            <div className="min-w-0">
              <span className="text-[10px] font-bold uppercase tracking-wide opacity-80 block">Paid Invoices</span>
              <strong className="font-['Outfit'] text-xl font-bold text-foreground">{billing.paidCount}</strong>
              <span className="text-[10px] text-muted-foreground mt-0.5 block">of {billing.total} total</span>
            </div>
            <CheckCircle className="h-5 w-5 shrink-0 opacity-80" />
          </div>

          <div className="flex items-center justify-between gap-2 p-3 rounded-xl border border-warning/40 bg-warning/10 text-warning">
            <div className="min-w-0">
              <span className="text-[10px] font-bold uppercase tracking-wide opacity-80 block">Collection Rate</span>
              <strong className="font-['Outfit'] text-xl font-bold text-foreground">{billing.collectionRate.toFixed(1)}%</strong>
              <span className="text-[10px] text-muted-foreground mt-0.5 block">{billing.activeSubs} active subscriptions</span>
            </div>
            <Banknote className="h-5 w-5 shrink-0 opacity-80" />
          </div>
        </div>
      )}

      {/* Payment-issues surfacing — real overdue invoices only */}
      {hasActivity && billing.overdueCount > 0 && (
        <div className="flex items-center gap-2.5 p-3.5 rounded-xl border border-destructive/30 bg-destructive/5">
          <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" />
          <span className="text-xs text-destructive">
            <strong className="text-destructive">{billing.overdueCount}</strong> overdue invoice{billing.overdueCount > 1 ? 's' : ''} require attention. Review under Invoices.
          </span>
        </div>
      )}

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="bg-card/80 border border-warning/12">
          <TabsTrigger 
            value="overview" 
            className="data-[state=active]:bg-primary data-[state=active]:text-white text-warning/70"
          >
            <LayoutDashboard className="h-4 w-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger 
            value="invoices" 
            className="data-[state=active]:bg-primary data-[state=active]:text-white text-warning/70"
          >
            <FileText className="h-4 w-4 mr-2" />
            Invoices
          </TabsTrigger>
          <TabsTrigger 
            value="receipts" 
            className="data-[state=active]:bg-primary data-[state=active]:text-white text-warning/70"
          >
            <Receipt className="h-4 w-4 mr-2" />
            Receipts
          </TabsTrigger>
          <TabsTrigger 
            value="analytics" 
            className="data-[state=active]:bg-primary data-[state=active]:text-white text-warning/70"
          >
            <TrendingUp className="h-4 w-4 mr-2" />
            Analytics
          </TabsTrigger>
          <TabsTrigger 
            value="settings" 
            className="data-[state=active]:bg-primary data-[state=active]:text-white text-warning/70"
          >
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </TabsTrigger>
          <TabsTrigger 
            value="landlords"
            className="data-[state=active]:bg-primary data-[state=active]:text-white text-warning/70"
          >
            <Building2 className="h-4 w-4 mr-2" />
            Landlords
          </TabsTrigger>
          <TabsTrigger 
            value="per-manager"
            className="data-[state=active]:bg-primary data-[state=active]:text-white text-warning/70"
          >
            <Users className="h-4 w-4 mr-2" />
            Per Manager
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <BillingOverview managers={managers} invoices={invoices} paymentSettings={paymentSettings} />
        </TabsContent>

        <TabsContent value="invoices">
          <ManagerInvoices 
            managers={managers} 
            invoices={invoices} 
            isLoading={isLoading}
            onRefresh={handleRefresh}
          />
        </TabsContent>

        <TabsContent value="receipts">
          <ManagerReceipts 
            managers={managers} 
            invoices={invoices} 
            isLoading={isLoading}
          />
        </TabsContent>

        <TabsContent value="analytics">
          <BillingAnalytics />
        </TabsContent>

        <TabsContent value="settings">
          <WebhostPaymentSettings />
        </TabsContent>

        <TabsContent value="landlords">
          <LandlordBilling />
        </TabsContent>

        <TabsContent value="per-manager">
          <ManagerBillingDrilldown />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ManagerBilling;
