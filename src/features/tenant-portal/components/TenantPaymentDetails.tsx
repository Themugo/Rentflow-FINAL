// @ts-nocheck — Phase 12: remaining local types until live supabase gen types
/**
 * TenantPaymentDetails
 *
 * Shows a tenant exactly what the manager set at registration:
 * - Monthly rent amount
 * - House + water deposit amounts and balance
 * - Other charges (service charge, garbage, etc.)
 * - Payment day (when rent is due each month)
 * - M-Pesa paybill/till + account reference
 * - Tenancy type (standard / formal lease / etc.)
 *
 * This data comes from tenant_payment_details which is populated when
 * the manager registers the tenant. It is read-only for the tenant.
 */
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/AuthContext';
import { Badge } from '@/shared/components/ui/badge';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { Progress } from '@/shared/components/ui/progress';
import { CreditCard, Building2, Smartphone, Calendar, Shield, Info, Copy, CheckCircle } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { supabase } from '@/integrations/supabase/client';

const fmt = (n: number | null | undefined) =>
  n == null
    ? '—'
    : new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 0 }).format(n);

const TENANCY_LABELS: Record<string, string> = {
  standard: 'Standard tenancy',
  formal_lease: 'Formal lease',
  short_term: 'Short-term tenancy',
  commercial: 'Commercial tenancy',
};

const TenantPaymentDetails: React.FC = () => {
  const { user, userRole } = useAuth();
  const [copied, setCopied] = useState(false);

  const { data: details, isLoading } = useQuery({
    queryKey: ['tenant-payment-details', user?.id],
    queryFn: async () => {
      // Try tenant_payment_details first (new table)
      const tenantId = userRole?.tenant_id;
      if (tenantId) {
        const { data } = await supabase
          .from('tenant_payment_details')
          .select('*')
          .eq('tenant_id', tenantId)
          .maybeSingle();
        if (data)
          return data as {
            monthly_rent?: number;
            house_deposit?: number;
            water_deposit?: number;
            deposit_balance?: number;
            other_charges?: number;
            other_charges_desc?: string;
            tenancy_type?: string;
            paybill_number?: string | null;
            account_reference?: string;
            payment_day?: number;
          };
      }

      // Fallback: read from tenants table directly
      if (tenantId) {
        const { data } = await supabase
          .from('tenants')
          .select(
            'monthly_rent, deposit_amount, deposit_balance, deposit_months, other_charges, other_charges_description, property, unit, move_in_date',
          )
          .eq('id', tenantId)
          .maybeSingle();
        if (data) {
          const row = data as {
            monthly_rent: number;
            deposit_amount: number;
            deposit_balance: number;
            other_charges: number;
            other_charges_description: string;
            unit: string;
          };
          return {
            monthly_rent: row.monthly_rent,
            house_deposit: row.deposit_amount,
            deposit_balance: row.deposit_balance,
            total_deposit: row.deposit_amount,
            other_charges: row.other_charges,
            other_charges_desc: row.other_charges_description,
            tenancy_type: 'standard',
            paybill_number: null,
            account_reference: row.unit,
            payment_day: 1,
          } as {
            monthly_rent: number;
            house_deposit: number;
            deposit_balance: number;
            total_deposit: number;
            other_charges: number;
            other_charges_desc: string;
            tenancy_type: string;
            paybill_number: null;
            account_reference: string;
            payment_day: number;
          };
        }
      }

      // Fallback: get manager's M-Pesa settings
      return null;
    },
    enabled: !!user?.id && !!userRole?.tenant_id,
  });

  // Also fetch manager's M-Pesa settings for paybill info
  const { data: tenantInfo } = useQuery({
    queryKey: ['tenant-info-for-payment', userRole?.tenant_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tenants')
        .select('property, unit')
        .eq('id', userRole!.tenant_id!)
        .maybeSingle();
      if (error) throw error;
      return data as { property: string; unit: string };
    },
    enabled: !!userRole?.tenant_id,
  });

  const { data: paymentRoutes = [], isLoading: routesLoading } = useQuery({
    queryKey: ['tenant-canonical-payment-routes', userRole?.tenant_id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_tenant_payment_routes' as any);
      if (error) throw error;
      return (data ?? []) as Array<{
        lease_id: string; unit_id: string | null; unit_number: string | null;
        property_id: string; property_name: string; payment_account_id: string | null;
        account_label: string | null; account_reference: string | null; payment_method: string | null;
        paybill_number: string | null; till_number: string | null; bank_name: string | null;
        bank_account_name: string | null; bank_account_number: string | null; bank_branch: string | null;
        payment_instructions: string | null;
      }>;
    },
    enabled: !!user?.id && !!userRole?.tenant_id,
  });

  const { data: agencyPolicy } = useQuery({
    queryKey: ['tenant-effective-agency-payment-policy', userRole?.tenant_id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_tenant_effective_agency_payment_policy' as any);
      if (error) throw error;
      return data as {
        policy_configured?: boolean;
        property_name?: string | null;
        unit_number?: string | null;
        source_scope?: string | null;
        last_updated?: string | null;
        allowed_payment_methods?: string[];
        collection_destination?: string | null;
        policy_config?: Record<string, unknown>;
        billing_due?: { due_day_of_month?: number; overdue_after_days?: number; reminder_before_days?: number } | null;
      } | null;
    },
    enabled: !!user?.id && !!userRole?.tenant_id,
    staleTime: 60_000,
  });

  const copyAccountRef = (ref: string) => {
    navigator.clipboard.writeText(ref);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isLoading || routesLoading) return <Skeleton className="h-48 w-full" />;
  if (!details && paymentRoutes.length === 0) return null;

  const depositPaid =
    Number(details?.house_deposit ?? 0) - Number(details?.deposit_balance ?? details?.house_deposit ?? 0);
  const depositTotal = Number(details?.house_deposit ?? 0) + Number(details?.water_deposit ?? 0);
  const depositPaidPct = depositTotal > 0 ? Math.round((depositPaid / depositTotal) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* Tenancy type + summary */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Your tenancy
            </CardTitle>
            {details?.tenancy_type && (
              <Badge variant="outline" className="text-xs capitalize">
                {TENANCY_LABELS[details.tenancy_type] ?? details.tenancy_type}
              </Badge>
            )}
          </div>
          <CardDescription>
            {tenantInfo?.property}
            {tenantInfo?.unit ? ` · Unit ${tenantInfo.unit}` : ''}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-primary/5 border border-primary/15 p-3 text-center">
              <p className="text-xs text-muted-foreground mb-1">Monthly rent</p>
              <p className="text-xl font-bold text-foreground">{fmt(details?.monthly_rent)}</p>
              {details?.payment_day && (
                <p className="text-xs text-muted-foreground mt-0.5 flex items-center justify-center gap-1">
                  <Calendar className="h-3 w-3" />
                  Due {details.payment_day === 1 ? '1st' : `${details.payment_day}th`} of month
                </p>
              )}
            </div>
            <div className="rounded-xl bg-muted/20 border border-border p-3 text-center">
              <p className="text-xs text-muted-foreground mb-1">Total deposit</p>
              <p className="text-xl font-bold">{fmt(depositTotal || details?.house_deposit)}</p>
              {details?.house_deposit && details?.water_deposit && (
                <p className="text-xs text-muted-foreground mt-0.5">House + Water deposit</p>
              )}
            </div>
          </div>

          {/* Deposit breakdown */}
          {details?.house_deposit != null && (
            <div className="mt-3 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Shield className="h-3 w-3" />
                  Deposit paid
                </span>
                <span className="font-medium">
                  {fmt(depositPaid)} / {fmt(depositTotal || details.house_deposit)}
                  <span className="text-muted-foreground ml-1">({depositPaidPct}%)</span>
                </span>
              </div>
              <Progress value={depositPaidPct} className="h-2" />
            </div>
          )}

          {/* Other charges */}
          {details?.other_charges != null && Number(details.other_charges) > 0 && (
            <div className="mt-3 flex items-start gap-2 p-2 rounded-lg bg-muted/30 text-xs">
              <Info className="h-3.5 w-3.5 shrink-0 mt-0.5 text-muted-foreground" />
              <div>
                <span className="font-medium">Additional charges: </span>
                <span>{fmt(details.other_charges)}/month</span>
                {details.other_charges_desc && (
                  <span className="text-muted-foreground"> ({details.other_charges_desc})</span>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {agencyPolicy?.policy_configured ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2"><Shield className="h-4 w-4 text-primary" /> Payment settings for this tenancy</CardTitle>
            <CardDescription>These are the current Agency payment rules for {agencyPolicy.property_name ?? 'your property'}{agencyPolicy.unit_number ? ` · Unit ${agencyPolicy.unit_number}` : ''}. Unit rules override property rules, which override Agency defaults.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="rounded-xl border border-border bg-background p-3"><p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Collection</p><p className="mt-1 text-sm font-semibold capitalize">{String(agencyPolicy.collection_destination ?? 'agency').replaceAll('_',' ')}</p></div>
              <div className="rounded-xl border border-border bg-background p-3"><p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Policy scope</p><p className="mt-1 text-sm font-semibold capitalize">{agencyPolicy.source_scope ?? 'Agency'} default</p></div>
            </div>
            <div>
              <p className="text-xs font-semibold text-foreground">Accepted methods</p>
              <div className="mt-2 flex flex-wrap gap-1.5">{(agencyPolicy.allowed_payment_methods ?? []).map((method) => <Badge key={method} variant="secondary" className="text-[10px]">{method === 'mpesa_paybill' ? 'M-Pesa Paybill' : method === 'mpesa_till' ? 'M-Pesa Till' : method === 'bank_transfer' ? 'Bank transfer' : method.replaceAll('_',' ')}</Badge>)}</div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg border border-border bg-background px-3 py-2"><p className="text-[10px] text-muted-foreground">Partial payments</p><p className="text-xs font-semibold">{agencyPolicy.policy_config?.allow_partial_payments === false ? 'Not allowed' : 'Allowed'}</p></div>
              <div className="rounded-lg border border-border bg-background px-3 py-2"><p className="text-[10px] text-muted-foreground">Third-party payer</p><p className="text-xs font-semibold">{agencyPolicy.policy_config?.allow_third_party_payers === false ? 'Not allowed' : 'Allowed'}</p></div>
              <div className="rounded-lg border border-border bg-background px-3 py-2"><p className="text-[10px] text-muted-foreground">Manual proof</p><p className="text-xs font-semibold">{agencyPolicy.policy_config?.proof_required_for_manual === false ? 'Optional' : 'Required'}</p></div>
              <div className="rounded-lg border border-border bg-background px-3 py-2"><p className="text-[10px] text-muted-foreground">Payment reference</p><p className="text-xs font-semibold">{agencyPolicy.policy_config?.payment_reference_required === true ? 'Required' : 'Optional'}</p></div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="rounded-lg border border-border bg-background px-3 py-2"><p className="text-[10px] text-muted-foreground">Outside-source payments</p><p className="text-xs font-semibold">{agencyPolicy.policy_config?.allow_external_consolidation === false ? 'Not allowed' : 'Allowed'}</p></div>
              {agencyPolicy.policy_config?.late_fee_type && agencyPolicy.policy_config?.late_fee_type !== 'none' ? <div className="rounded-lg border border-border bg-background px-3 py-2"><p className="text-[10px] text-muted-foreground">Late fee rule</p><p className="text-xs font-semibold">{String(agencyPolicy.policy_config.late_fee_value ?? 0)} {agencyPolicy.policy_config.late_fee_type === 'percentage' ? '%' : 'KES'}</p></div> : null}
            </div>
            {agencyPolicy.billing_due?.due_day_of_month ? <p className="text-xs text-muted-foreground">Rent due on the {agencyPolicy.billing_due.due_day_of_month}{agencyPolicy.billing_due.due_day_of_month % 10 === 1 && agencyPolicy.billing_due.due_day_of_month !== 11 ? 'st' : agencyPolicy.billing_due.due_day_of_month % 10 === 2 && agencyPolicy.billing_due.due_day_of_month !== 12 ? 'nd' : agencyPolicy.billing_due.due_day_of_month % 10 === 3 && agencyPolicy.billing_due.due_day_of_month !== 13 ? 'rd' : 'th'} of each month. {agencyPolicy.billing_due.overdue_after_days ?? 0} day(s) after due date before overdue status.</p> : null}
            <div className="rounded-lg border border-primary/15 bg-primary/5 px-3 py-2 text-[10px] leading-4 text-muted-foreground">Payment-rule changes are announced in the CALQULUS communication centre and remain visible here while they are effective.</div>
            {agencyPolicy.last_updated ? <p className="text-[10px] text-muted-foreground">Last changed: {new Date(agencyPolicy.last_updated).toLocaleDateString('en-KE')}</p> : null}
          </CardContent>
        </Card>
      ) : null}

      {/* Canonical payment destinations — resolved from the same records used by invoices, prompts and STK. */}
      {paymentRoutes.length > 0 && (
        <div className="space-y-3">
          {paymentRoutes.map((route) => {
            const isPaybill = route.payment_method === 'mpesa_paybill';
            const isTill = route.payment_method === 'mpesa_till';
            const destination = isPaybill ? route.paybill_number : isTill ? route.till_number : null;
            const accRef = route.account_reference || route.unit_number || '';
            return (
              <Card key={route.lease_id}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Smartphone className="h-4 w-4 text-success" />
                    Payment destination — {route.unit_number || 'Unit'}
                  </CardTitle>
                  <CardDescription>{route.property_name}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {destination && (
                    <div className="rounded-xl bg-primary/5 border border-primary/15 p-4">
                      <p className="text-xs font-semibold text-primary uppercase tracking-wide">{isPaybill ? 'M-Pesa Paybill' : 'M-Pesa Till'}</p>
                      <p className="text-2xl font-bold font-mono text-foreground">{destination}</p>
                      {isPaybill && accRef && (
                        <div className="mt-2 flex items-center justify-between gap-3">
                          <div>
                            <p className="text-xs text-muted-foreground">Account / reference</p>
                            <p className="font-semibold font-mono text-foreground">{accRef}</p>
                          </div>
                          <Button variant="outline" size="sm" className="gap-2 border-primary/20 text-primary" onClick={() => copyAccountRef(accRef)}>
                            {copied ? <CheckCircle className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                            {copied ? 'Copied!' : 'Copy'}
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                  {route.payment_method === 'bank_transfer' && (
                    <div className="rounded-xl border border-border p-4 text-sm space-y-1">
                      <p className="font-semibold">Bank transfer</p>
                      <p>{route.bank_name || 'Bank'}{route.bank_branch ? ` · ${route.bank_branch}` : ''}</p>
                      {route.bank_account_name && <p>Account name: {route.bank_account_name}</p>}
                      {route.bank_account_number && <p className="font-mono">Account: {route.bank_account_number}</p>}
                    </div>
                  )}
                  {route.payment_instructions && (
                    <div className="rounded-lg bg-muted/30 p-3 text-xs">
                      <p className="font-medium mb-1">Payment instructions</p>
                      <p className="whitespace-pre-line text-muted-foreground">{route.payment_instructions}</p>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">This destination is configured for this unit and is the same route used by your payment prompts and bills.</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default TenantPaymentDetails;
