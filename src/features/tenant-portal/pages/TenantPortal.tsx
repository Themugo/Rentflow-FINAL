import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ErrorState } from '@/shared/components/ui/error-state';
import { useAuth } from '@/features/auth/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/shared/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { useToast } from '@/shared/hooks/use-toast';
import { formatDate } from '@/shared/lib/dateFormat';
import { CreditCard, Smartphone, RefreshCw, Loader2 } from 'lucide-react';
import OrphanTenantHome from '@/features/tenant-portal/components/OrphanTenantHome';
import { useSearchParams } from 'react-router-dom';

import type { SupportedCurrency } from '@/shared/types/payment';
import TenantLayout from '@/features/tenant-portal/components/TenantLayout';
import TenantHome from '@/features/tenant-portal/components/TenantHome';
import TenantManagementStatusCard from '@/features/tenant-portal/components/TenantManagementStatusCard';
import { useOfflineData } from '@/shared/hooks/useOfflineData';
import { OfflineBanner, OfflineIndicator } from '@/shared/components/ui/offline-indicator';
import TenantPayNowDialog, { type PayableInvoice } from '@/features/tenant-portal/components/TenantPayNowDialog';
import { TENANT_INVOICE_COLUMNS } from '@/features/tenant-portal/lib/tenantInvoiceSelect';
import { redirectBrowser } from '@/shared/lib/redirectBrowser';

interface Invoice {
  id: string;
  invoice_number: string;
  amount: number;
  due_date: string;
  paid_date: string | null;
  status: string;
  description: string | null;
}

interface TenantInfo {
  id: string;
  name: string;
  email: string;
  property: string | null;
  unit: string | null;
  manager_id: string | null;
  managing_landlord_id?: string | null;
  management_mode?: 'agency' | 'manager' | 'landlord' | 'independent' | null;
  property_id: string | null;
  unit_id: string | null;
  statement_history_months: number | null;
}

interface Lease {
  id: string;
  property: string;
  unit: string;
  start_date: string;
  end_date: string;
  monthly_rent: number;
  status: string;
}

const payableStatuses = new Set(['pending', 'overdue', 'partially_paid']);

const TenantPortal = () => {
  const { user, userRole } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const paymentProcessedRef = useRef(false);

  // Time-based greeting
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const [payDialogOpen, setPayDialogOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  // STK push dialog — opens for KES payments via M-Pesa STK directly
  const [stkDialogOpen, setStkDialogOpen] = useState(false);
  const [stkInvoices, setStkInvoices] = useState<PayableInvoice[]>([]);
  const [tenantPhone, setTenantPhone] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedCurrency, setSelectedCurrency] = useState<SupportedCurrency>('USD');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [pendingPaymentRef, setPendingPaymentRef] = useState<string | null>(null);
  const [pendingInvoiceId, setPendingInvoiceId] = useState<string | null>(null);
  const [verifyDialogOpen, setVerifyDialogOpen] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [maintenanceSummary, setMaintenanceSummary] = useState<{
    openCount: number;
    latestTitle: string | null;
  }>({ openCount: 0, latestTitle: null });
  const [managementContext, setManagementContext] = useState<{ management_mode: 'agency' | 'manager' | 'landlord' | 'independent'; manager_name: string | null; agency_name: string | null; landlord_name: string | null; has_active_lease: boolean; } | null>(null);

  // Fetch tenant info with offline support
  // eslint-disable-next-line react-hooks/preserve-manual-memoization
  const fetchTenantInfo = useCallback(async (): Promise<TenantInfo | null> => {
    if (!userRole?.tenant_id) return null;
    const { data, error } = await supabase
      .from('tenants')
      .select('id, name, email, property, unit, property_id, unit_id, manager_id, managing_landlord_id, management_mode, statement_history_months')
      .eq('id', userRole.tenant_id)
      .single();
    if (error) throw error;

    // Use manager_id from tenant directly, fallback to property's manager_id
    let managerId: string | null = data.manager_id;
    if (!managerId && data?.property_id) {
      const { data: propertyData } = await supabase
        .from('properties')
        .select('manager_id')
        .eq('id', data.property_id)
        .single();
      managerId = propertyData?.manager_id || null;
    }

    // If manager_id is a submanager, resolve to the main manager
    // (submanagers don't own invoices / payment settings — the main manager does)
    if (managerId) {
      const { data: subPerm } = await supabase
        .from('submanager_permissions')
        .select('manager_id')
        .eq('submanager_user_id', managerId)
        .maybeSingle();
      if (subPerm?.manager_id) {
        managerId = subPerm.manager_id;
      }
    }

    return {
      id: data.id,
      name: data.name,
      email: data.email,
      property: data.property,
      unit: data.unit,
      manager_id: managerId,
      property_id: data.property_id || null,
      unit_id: data.unit_id || null,
      managing_landlord_id: data.managing_landlord_id ?? null,
      management_mode: data.management_mode ?? (data.manager_id ? 'manager' : data.property_id ? 'landlord' : 'independent'),
      statement_history_months: data.statement_history_months,
    };
  }, [userRole?.tenant_id]);

  useEffect(() => {
    if (!userRole?.tenant_id) { setManagementContext(null); return; }
    void supabase.rpc('get_my_tenant_management_context' as any).then(({ data }) => {
      const row = Array.isArray(data) ? data[0] : data;
      setManagementContext(row ? {
        management_mode: row.management_mode ?? 'independent',
        manager_name: row.manager_name ?? null,
        agency_name: row.agency_name ?? null,
        landlord_name: row.landlord_name ?? null,
        has_active_lease: Boolean(row.has_active_lease),
      } : null);
    });
  }, [userRole?.tenant_id]);

  // Fetch invoices with offline support
  // eslint-disable-next-line react-hooks/preserve-manual-memoization
  const fetchInvoices = useCallback(async (): Promise<Invoice[]> => {
    if (!userRole?.tenant_id) return [];
    const { data, error } = await supabase
      .from('invoices')
      .select(TENANT_INVOICE_COLUMNS)
      .eq('tenant_id', userRole.tenant_id)
      .order('due_date', { ascending: false });
    if (error) throw error;
    return (data as Invoice[]) || [];
  }, [userRole?.tenant_id]);

  // Fetch lease with offline support
  // eslint-disable-next-line react-hooks/preserve-manual-memoization
  const fetchLease = useCallback(async (): Promise<Lease | null> => {
    if (!userRole?.tenant_id) return null;
    const { data, error } = await supabase
      .from('leases')
      .select('id, property, unit, start_date, end_date, monthly_rent, status')
      .eq('tenant_id', userRole.tenant_id)
      .eq('status', 'active')
      .maybeSingle();
    if (error) throw error;
    return data as Lease | null;
  }, [userRole?.tenant_id]);

  const {
    data: tenantInfo,
    loading: tenantLoading,
    isOffline,
    isFromCache: tenantFromCache,
    error: tenantError,
    refetch: refetchTenant,
  } = useOfflineData(`tenant_${userRole?.tenant_id}`, fetchTenantInfo, {
    enabled: !!userRole?.tenant_id,
  });

  const {
    data: invoices,
    loading: invoicesLoading,
    isFromCache: invoicesFromCache,
    refetch: refetchInvoices,
    error: invoicesError,
  } = useOfflineData(`invoices_${userRole?.tenant_id}`, fetchInvoices, {
    enabled: !!userRole?.tenant_id,
  });

  const {
    loading: leaseLoading,
    isFromCache: leaseFromCache,
    data: lease,
    error: leaseError,
    refetch: refetchLease,
  } = useOfflineData(`lease_${userRole?.tenant_id}`, fetchLease, {
    enabled: !!userRole?.tenant_id,
  });

  const loading = tenantLoading || invoicesLoading || leaseLoading;
  const isFromCache = tenantFromCache || invoicesFromCache || leaseFromCache;

  useEffect(() => {
    if (!user?.id) return;
    supabase
      .from('profiles')
      .select('phone')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => setTenantPhone(data?.phone ?? null));
  }, [user?.id]);

  // Active maintenance requests (open / in_progress) for the home surface
  // eslint-disable-next-line react-hooks/preserve-manual-memoization
  const fetchActiveMaintenance = useCallback(async (): Promise<
    { id: string; title: string; status: string }[]
  > => {
    if (!userRole?.tenant_id) return [];
    const { data, error } = await supabase
      .from('maintenance_requests')
      .select('id, title, status')
      .eq('tenant_id', userRole.tenant_id)
      .in('status', ['open', 'in_progress'])
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []) as { id: string; title: string; status: string }[];
  }, [userRole?.tenant_id]);

  // Property + unit details for the home identity card (real image/type/bedrooms when present)
  // eslint-disable-next-line react-hooks/preserve-manual-memoization
  const fetchHomeProperty = useCallback(async (): Promise<{
    image_url: string | null;
    property_type: string | null;
    bedrooms: number | null;
  }> => {
    const empty = { image_url: null, property_type: null, bedrooms: null };
    if (!tenantInfo?.property_id) return empty;
    const [prop, unit] = await Promise.all([
      supabase
        .from('properties')
        .select('image_url, property_type')
        .eq('id', tenantInfo.property_id)
        .maybeSingle(),
      tenantInfo.unit_id
        ? supabase.from('units').select('bedrooms').eq('id', tenantInfo.unit_id).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
    return {
      image_url: prop.data?.image_url ?? null,
      property_type: prop.data?.property_type ?? null,
      bedrooms: unit.data?.bedrooms ?? null,
    };
  }, [tenantInfo?.property_id, tenantInfo?.unit_id]);

  // Recent notices (non-draft) surfaced to the tenant home
  // eslint-disable-next-line react-hooks/preserve-manual-memoization
  const fetchRecentNotices = useCallback(async (): Promise<
    { id: string; notice_type: string; title: string; created_at: string; unread: boolean }[]
  > => {
    if (!userRole?.tenant_id) return [];
    const { data, error } = await supabase
      .from('tenant_notices')
      .select('id, notice_type, title, created_at, tenant_acknowledged')
      .eq('tenant_id', userRole.tenant_id)
      .neq('status', 'draft')
      .order('created_at', { ascending: false })
      .limit(4);
    if (error) throw error;
    return (data || []).map((n) => ({
      id: n.id,
      notice_type: n.notice_type,
      title: n.title,
      created_at: n.created_at,
      unread: !n.tenant_acknowledged,
    }));
  }, [userRole?.tenant_id]);

  const { data: activeMaintenance = [] } = useOfflineData(
    `active-maintenance-${userRole?.tenant_id}`,
    fetchActiveMaintenance,
    { enabled: !!userRole?.tenant_id },
  );

  const { data: homeDetails = { image_url: null, property_type: null, bedrooms: null } } = useOfflineData(
    `home-details-${userRole?.tenant_id}`,
    fetchHomeProperty,
    { enabled: !!userRole?.tenant_id && !!tenantInfo?.property_id },
  );

  const { data: recentNotices = [] } = useOfflineData(
    `recent-notices-${userRole?.tenant_id}`,
    fetchRecentNotices,
    { enabled: !!userRole?.tenant_id },
  );

  useEffect(() => {
    if (!userRole?.tenant_id) return;
    supabase
      .from('maintenance_requests')
      .select('id, title, status, priority')
      .eq('tenant_id', userRole.tenant_id)
      .then(({ data }) => {
        const rows = data || [];
        const openReqs = rows.filter((r) => r.status === 'open' || r.status === 'in_progress');
        setMaintenanceSummary({
          openCount: openReqs.length,
          latestTitle: rows[0]?.title || null,
        });
      });
  }, [userRole?.tenant_id]);

  // Filter invoices based on statement_history_months setting
  // eslint-disable-next-line react-hooks/preserve-manual-memoization
  const filteredInvoices = React.useMemo(() => {
    if (!invoices) return [];
    if (!tenantInfo?.statement_history_months) return invoices;

    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - tenantInfo.statement_history_months);

    return invoices.filter((invoice) => new Date(invoice.due_date) >= cutoffDate);
  }, [invoices, tenantInfo?.statement_history_months]);

  // Handle payment return from Stripe - only show notification, actual update via webhook
  useEffect(() => {
    const payment = searchParams.get('payment');
    if (!payment || paymentProcessedRef.current) return;

    paymentProcessedRef.current = true;
    if (payment === 'success') {
      toast({
        title: 'Payment processing',
        description: 'Please wait while we confirm your payment. This may take a few moments.',
      });
      // Refetch invoices after a delay - webhook will have updated status
      setTimeout(() => refetchInvoices(), 3000);
      setSearchParams({});
    } else if (payment === 'cancelled') {
      toast({
        title: 'Payment cancelled',
        description: 'Your payment was not processed.',
        variant: 'destructive',
      });
      setSearchParams({});
    }
  }, [searchParams, setSearchParams, toast, refetchInvoices]);

  const handlePayInvoice = async () => {
    if (!selectedInvoice) return;

    // Validate phone number for M-Pesa payments
    if (selectedCurrency === 'KES' && !phoneNumber.trim()) {
      toast({
        title: 'Phone number required',
        description: 'Please enter your M-Pesa phone number.',
        variant: 'destructive',
      });
      return;
    }

    setIsProcessing(true);

    try {
      if (selectedCurrency === 'USD') {
        // Stripe checkout for USD
        const { data, error } = await supabase.functions.invoke('create-invoice-checkout', {
          body: {
            invoiceId: selectedInvoice.id,
            invoiceNumber: selectedInvoice.invoice_number,
            amount: Number(selectedInvoice.amount),
            description: selectedInvoice.description || 'Monthly Rent Payment',
          },
        });

        if (error) throw error;

        if (data?.url) {
          redirectBrowser(data.url);
        } else {
          throw new Error('No checkout URL received');
        }
      } else {
        openStkPay([selectedInvoice as PayableInvoice]);
        setPayDialogOpen(false);
        setSelectedInvoice(null);
        setIsProcessing(false);
      }
    } catch (error) {
      toast({
        title: 'Payment failed',
        description: 'Unable to start payment process. Please try again.',
        variant: 'destructive',
      });
      setIsProcessing(false);
      setPayDialogOpen(false);
      setSelectedInvoice(null);
    }
  };

  const formatCurrency = (amount: number) => {
    // For tenant portal, always use KES as the default display currency
    // since this is primarily a Kenyan rental platform
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const openStkPay = (invoices: PayableInvoice[]) => {
    if (!invoices.length) return;
    setStkInvoices(invoices);
    setStkDialogOpen(true);
  };

  const handleVerifyPayment = async () => {
    if (!pendingPaymentRef) return;

    setIsVerifying(true);
    try {
      const { data, error } = await supabase.functions.invoke('verify-mpesa-payment', {
        body: { reference: pendingPaymentRef },
      });

      if (error) throw error;

      if (data?.status === 'success') {
        toast({
          title: 'Payment Successful!',
          description: 'Your M-Pesa payment has been confirmed.',
        });
        // Refresh invoices to get updated status
        refetchInvoices();
        setVerifyDialogOpen(false);
        setPendingPaymentRef(null);
        setPendingInvoiceId(null);
      } else if (data?.status === 'pending') {
        toast({
          title: 'Payment Pending',
          description: 'Your payment is still being processed. Please complete the M-Pesa prompt on your phone.',
        });
      } else if (data?.status === 'failed') {
        toast({
          title: 'Payment Failed',
          description: 'The payment was not successful. Please try again.',
          variant: 'destructive',
        });
        setVerifyDialogOpen(false);
        setPendingPaymentRef(null);
        setPendingInvoiceId(null);
      } else {
        toast({
          title: 'Status Update',
          description: data?.message || `Payment status: ${data?.status}`,
        });
      }
    } catch (error) {
      toast({
        title: 'Verification Failed',
        description: 'Unable to check payment status. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const safeInvoices = filteredInvoices || [];

  const stats = {
    totalDue: safeInvoices
      .filter((i) => payableStatuses.has(i.status))
      .reduce((acc, i) => acc + Number((i as PayableInvoice).balance_due ?? i.amount), 0),
    overdueCount: safeInvoices.filter((i) => i.status === 'overdue').length,
  };

  // Get recent paid invoices for the dashboard
  const recentPayments = safeInvoices
    .filter((i) => i.status === 'paid' && i.paid_date)
    .sort((a, b) => new Date(b.paid_date!).getTime() - new Date(a.paid_date!).getTime())
    .slice(0, 3)
    .map((i) => ({
      id: i.id,
      amount: Number(i.amount),
      paid_date: i.paid_date!,
      invoice_number: i.invoice_number,
    }));

  const urgentInvoices = safeInvoices.filter((i) => payableStatuses.has(i.status));
  const mostUrgent = [...urgentInvoices].sort((a, b) => {
    if (a.status === "overdue" && b.status !== "overdue") return -1;
    if (b.status === "overdue" && a.status !== "overdue") return 1;
    return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
  })[0];
  const recentActivity = [
    ...recentPayments.map((payment) => ({
      id: payment.id,
      label: `Paid ${formatCurrency(payment.amount)}`,
      detail: `${payment.invoice_number} · ${formatDate(payment.paid_date)}`,
    })),
    ...(maintenanceSummary.openCount > 0
      ? [
          {
            id: "maintenance",
            label: maintenanceSummary.latestTitle || "Maintenance request",
            detail: `${maintenanceSummary.openCount} open`,
          },
        ]
      : []),
  ].slice(0, 5);

  if (loading) {
    return (
      <TenantLayout title="Home" hideHeader>
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
        </div>
      </TenantLayout>
    );
  }

  const independentTenant = tenantInfo?.management_mode === 'independent' || (!tenantInfo?.management_mode && !tenantInfo?.manager_id && !tenantInfo?.property_id);

  return (
    <TenantLayout title="Home" hideHeader>
      {(isOffline || isFromCache) && (
        <OfflineIndicator isOffline={isOffline} isFromCache={isFromCache} className="mb-4" />
      )}

      {(tenantError || invoicesError || leaseError) && (
        <ErrorState
          title="Couldn't load your home"
          message={
            tenantError?.message ||
            invoicesError?.message ||
            leaseError?.message ||
            "An unexpected error occurred."
          }
          onRetry={() => {
            refetchTenant();
            refetchInvoices();
            refetchLease();
          }}
        />
      )}

      {user?.email?.includes("@calqulusrms.com") && (
        <p className="mb-4 text-sm text-muted-foreground">Demo mode — sample data</p>
      )}

      {tenantInfo && !tenantLoading ? (
        <TenantManagementStatusCard
          tenantId={tenantInfo.id}
          mode={independentTenant ? 'independent' : (managementContext?.management_mode ?? tenantInfo.management_mode ?? (tenantInfo.manager_id ? 'manager' : 'landlord'))}
          managerName={managementContext?.manager_name}
          agencyName={managementContext?.agency_name}
          landlordName={managementContext?.landlord_name}
          propertyName={tenantInfo.property}
          hasActiveLease={Boolean(managementContext?.has_active_lease || lease)}
        />
      ) : null}

      {independentTenant && !tenantLoading && (
        <OrphanTenantHome />
      )}

      {userRole?.tenant_id && !independentTenant && tenantInfo && (
        <TenantHome
          greeting={getGreeting()}
          firstName={tenantInfo.name?.split(" ")[0] || "there"}
          propertyName={tenantInfo.property}
          unit={tenantInfo.unit}
          propertyImage={homeDetails?.image_url ?? null}
          propertyType={homeDetails?.property_type ?? null}
          unitBedrooms={homeDetails?.bedrooms ?? null}
          amountDue={stats.totalDue}
          dueDate={mostUrgent?.due_date ?? null}
          overdue={stats.overdueCount > 0}
          formatCurrency={formatCurrency}
          onPayRent={() => openStkPay(urgentInvoices as PayableInvoice[])}
          payDisabled={isOffline || urgentInvoices.length === 0}
          maintenanceOpen={maintenanceSummary.openCount}
          activeMaintenance={(activeMaintenance ?? []).map((m) => ({ title: m.title, status: m.status, href: '/portal/maintenance' }))}
          recentNotices={recentNotices ?? []}
          recentActivity={recentActivity}
        />
      )}

            {/* Pay Invoice Dialog */}
      <Dialog open={payDialogOpen} onOpenChange={setPayDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Pay Invoice
            </DialogTitle>
            <DialogDescription>Choose your preferred payment method and currency.</DialogDescription>
          </DialogHeader>
          {selectedInvoice && (
            <div className="space-y-4 py-4">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Invoice Number</span>
                <span className="font-medium">{selectedInvoice.invoice_number}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Amount</span>
                <span className="font-semibold text-lg">{formatCurrency(Number(selectedInvoice.amount))}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Due Date</span>
                <span>{formatDate(selectedInvoice.due_date)}</span>
              </div>

              {/* Currency Selector */}
              <div className="space-y-2 pt-2 border-t">
                <Label>Payment Method</Label>
                <Select
                  value={selectedCurrency}
                  onValueChange={(value: SupportedCurrency) => setSelectedCurrency(value)}
                >
                  <SelectTrigger className="w-full bg-background">
                    <SelectValue placeholder="Select currency" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover z-50">
                    <SelectItem value="USD">
                      <div className="flex items-center gap-2">
                        <CreditCard className="h-4 w-4" />
                        <span>USD - Pay with Card (Stripe)</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="KES">
                      <div className="flex items-center gap-2">
                        <Smartphone className="h-4 w-4" />
                        <span>KES - Pay with M-Pesa</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* M-Pesa Phone Number Input */}
              {selectedCurrency === 'KES' && (
                <div className="space-y-2">
                  <Label htmlFor="phoneNumber">M-Pesa Phone Number</Label>
                  <Input
                    id="phoneNumber"
                    type="tel"
                    placeholder="0712345678 or +254712345678"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    className="bg-background"
                  />
                  <p className="text-xs text-muted-foreground">Format: 07XXXXXXXX, +254XXXXXXXXX or 254XXXXXXXXX</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayDialogOpen(false)} disabled={isProcessing}>
              Cancel
            </Button>
            <Button onClick={handlePayInvoice} disabled={isProcessing} className="gap-2">
              {selectedCurrency === 'USD' ? (
                <>
                  <CreditCard className="h-4 w-4" />
                  {isProcessing ? 'Redirecting...' : 'Pay with Card'}
                </>
              ) : (
                <>
                  <Smartphone className="h-4 w-4" />
                  {isProcessing ? 'Processing...' : 'Pay with M-Pesa'}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment Verification Dialog */}
      <Dialog open={verifyDialogOpen} onOpenChange={setVerifyDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Smartphone className="h-5 w-5" />
              M-Pesa Payment Status
            </DialogTitle>
            <DialogDescription>Check the status of your M-Pesa payment.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex items-center justify-center py-6">
              <div className="text-center space-y-3">
                <div className="h-16 w-16 mx-auto rounded-full bg-warning/10 flex items-center justify-center">
                  <Smartphone className="h-8 w-8 text-warning" />
                </div>
                <p className="text-sm text-muted-foreground">
                  Complete the M-Pesa prompt on your phone, then click below to verify.
                </p>
                {pendingPaymentRef && <p className="text-xs text-muted-foreground">Reference: {pendingPaymentRef}</p>}
              </div>
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setVerifyDialogOpen(false);
                setPendingPaymentRef(null);
                setPendingInvoiceId(null);
              }}
            >
              Close
            </Button>
            <Button onClick={handleVerifyPayment} disabled={isVerifying} className="gap-2">
              {isVerifying ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Checking...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4" />
                  Check Payment Status
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* M-Pesa STK Push Dialog — real-time polling, replaces manual verify flow */}
      {stkInvoices.length > 0 && (
        <TenantPayNowDialog
          invoices={stkInvoices}
          tenantPhone={tenantPhone ?? undefined}
          open={stkDialogOpen}
          onOpenChange={(open) => {
            setStkDialogOpen(open);
            if (!open) setStkInvoices([]);
          }}
          onPaymentSuccess={() => {
            setStkDialogOpen(false);
            setStkInvoices([]);
            queryClient.invalidateQueries({ queryKey: ['tenant-invoices'] });
            queryClient.invalidateQueries({ queryKey: ['tenant-bills-hub'] });
          }}
        />
      )}

      <OfflineBanner isOffline={isOffline} />
    </TenantLayout>
  );
};

export default TenantPortal;
