import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { DollarSign, CheckCircle, Clock, Receipt, Users, Percent, TrendingUp, Building, Smartphone, Info } from 'lucide-react';
import { BILLING_CONFIG } from './ManagerInvoices';
import { Badge } from '@/shared/components/ui/badge';

interface Manager {
  id: string;
  user_id: string;
  email: string;
  full_name: string | null;
  property_count: number;
  has_registration_invoice: boolean;
  net_collection: number;
}

interface ManagerInvoice {
  id: string;
  manager_user_id: string;
  invoice_number: string;
  amount: number;
  description: string | null;
  status: string;
  due_date: string;
  paid_date: string | null;
  created_at: string;
  property_count: number;
  rate_per_property: number;
  invoice_type: string;
  net_collection: number;
  commission_rate: number;
}

interface PaymentSettings {
  id: string;
  registration_fee: number;
  subscription_rate: number;
  bank_name: string | null;
  bank_account_name: string | null;
  bank_account_number: string | null;
  bank_branch: string | null;
  mpesa_paybill_number: string | null;
  mpesa_paybill_account: string | null;
  mpesa_till_number: string | null;
  mpesa_phone_number: string | null;
  payment_instructions: string | null;
}

interface BillingOverviewProps {
  managers: Manager[] | undefined;
  invoices: ManagerInvoice[] | undefined;
  paymentSettings?: PaymentSettings | null;
}

const BillingOverview: React.FC<BillingOverviewProps> = ({ managers, invoices, paymentSettings }) => {
  // Get dynamic billing config
  const billingConfig = {
    registration: {
      ...BILLING_CONFIG.registration,
      amount: paymentSettings?.registration_fee || BILLING_CONFIG.registration.amount,
    },
    subscription: {
      ...BILLING_CONFIG.subscription,
      rate: paymentSettings?.subscription_rate || BILLING_CONFIG.subscription.rate,
    },
  };

  // Calculate stats
  const stats = React.useMemo(() => {
    if (!invoices) return {
      totalBilled: 0,
      totalPaid: 0,
      pending: 0,
      pendingAmount: 0,
      registrationsPaid: 0,
      registrationsPending: 0,
      subscriptionsPaid: 0,
      subscriptionsPending: 0,
      collectionRate: 0,
    };

    const totalBilled = invoices.reduce((sum, inv) => sum + Number(inv.amount), 0);
    const totalPaid = invoices.filter(inv => inv.status === 'paid').reduce((sum, inv) => sum + Number(inv.amount), 0);
    const pending = invoices.filter(inv => inv.status === 'pending').length;
    const pendingAmount = invoices.filter(inv => inv.status === 'pending').reduce((sum, inv) => sum + Number(inv.amount), 0);
    const registrationsPaid = invoices.filter(inv => inv.invoice_type === 'registration' && inv.status === 'paid').length;
    const registrationsPending = invoices.filter(inv => inv.invoice_type === 'registration' && inv.status === 'pending').length;
    const subscriptionsPaid = invoices.filter(inv => inv.invoice_type === 'subscription' && inv.status === 'paid').length;
    const subscriptionsPending = invoices.filter(inv => inv.invoice_type === 'subscription' && inv.status === 'pending').length;
    const collectionRate = totalBilled > 0 ? (totalPaid / totalBilled) * 100 : 0;

    return {
      totalBilled,
      totalPaid,
      pending,
      pendingAmount,
      registrationsPaid,
      registrationsPending,
      subscriptionsPaid,
      subscriptionsPending,
      collectionRate,
    };
  }, [invoices]);

  const hasPaymentDetails = paymentSettings && (
    paymentSettings.bank_name || 
    paymentSettings.mpesa_paybill_number || 
    paymentSettings.mpesa_till_number ||
    paymentSettings.mpesa_phone_number
  );

  return (
    <div className="space-y-6">
      {/* Billing Tiers */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="bg-gradient-to-br from-[hsl(214_73%_20%/0.5)] to-[hsl(218_58%_20%/0.5)] border-[hsl(214_73%_40%/0.3)]">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-[hsl(214_73%_48%/0.2)] flex items-center justify-center">
                <Users className="h-5 w-5 text-[hsl(214_73%_58%)]" />
              </div>
              <div>
                <CardTitle className="text-foreground text-lg">{billingConfig.registration.name}</CardTitle>
                <CardDescription className="text-[hsl(214_73%_65%)]">{billingConfig.registration.description}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-bold text-foreground">KES {billingConfig.registration.amount.toLocaleString()}</span>
              <span className="text-[hsl(214_73%_65%)]">one-time</span>
            </div>
            <div className="mt-3 text-xs text-[hsl(214_73%_65%)] space-y-1">
              <p>• Required for new manager registration</p>
              <p>• Paid: {stats.registrationsPaid} / Pending: {stats.registrationsPending}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-[hsl(218_58%_16%/0.5)] to-navy-mid/50 border-warning/12">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-[hsl(218_58%_50%/0.2)] flex items-center justify-center">
                <Percent className="h-5 w-5 text-warning" />
              </div>
              <div>
                <CardTitle className="text-foreground text-lg">{billingConfig.subscription.name}</CardTitle>
                <CardDescription className="text-warning/70">{billingConfig.subscription.description}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-bold text-foreground">{(billingConfig.subscription.rate * 100).toFixed(1)}%</span>
              <span className="text-warning/70">of net collection / month</span>
            </div>
            <div className="mt-3 text-xs text-warning/70 space-y-1">
              <p>• Calculated from paid tenant invoices</p>
              <p>• Paid: {stats.subscriptionsPaid} / Pending: {stats.subscriptionsPending}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card className="bg-card border-warning/15">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-[hsl(218_58%_50%/0.2)] flex items-center justify-center">
                <DollarSign className="h-6 w-6 text-warning" />
              </div>
              <div>
                <p className="text-sm text-warning/70">Total Billed</p>
                <p className="text-2xl font-bold text-foreground">KES {stats.totalBilled.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-warning/15">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-success/20 flex items-center justify-center">
                <CheckCircle className="h-6 w-6 text-success" />
              </div>
              <div>
                <p className="text-sm text-warning/70">Total Collected</p>
                <p className="text-2xl font-bold text-foreground">KES {stats.totalPaid.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-warning/15">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-warning/20 flex items-center justify-center">
                <Clock className="h-6 w-6 text-warning" />
              </div>
              <div>
                <p className="text-sm text-warning/70">Pending</p>
                <p className="text-2xl font-bold text-foreground">{stats.pending}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-warning/15">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-[hsl(214_73%_48%/0.2)] flex items-center justify-center">
                <Receipt className="h-6 w-6 text-[hsl(214_73%_58%)]" />
              </div>
              <div>
                <p className="text-sm text-warning/70">Pending Amount</p>
                <p className="text-2xl font-bold text-foreground">KES {stats.pendingAmount.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-warning/15">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-warning/70">Collection Rate</p>
                <p className="text-2xl font-bold text-foreground">{stats.collectionRate.toFixed(1)}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Payment Details Summary */}
      {hasPaymentDetails && (
        <Card className="bg-card border-warning/15">
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2">
              <Info className="h-5 w-5 text-warning" />
              Configured Payment Details
            </CardTitle>
            <CardDescription className="text-warning/70">
              These payment details are shown to managers when they view their invoices
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              {paymentSettings?.bank_name && (
                <div className="p-4 bg-secondary-background rounded-lg flex items-start gap-3">
                  <Building className="h-5 w-5 text-[hsl(214_73%_58%)] mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-foreground">{paymentSettings.bank_name}</p>
                    <p className="text-xs text-warning/70">{paymentSettings.bank_account_name}</p>
                    <p className="text-xs text-warning/70 font-mono">{paymentSettings.bank_account_number}</p>
                  </div>
                </div>
              )}
              
              {(paymentSettings?.mpesa_paybill_number || paymentSettings?.mpesa_till_number || paymentSettings?.mpesa_phone_number) && (
                <div className="p-4 bg-secondary-background rounded-lg flex items-start gap-3">
                  <Smartphone className="h-5 w-5 text-green-400 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-foreground">M-Pesa</p>
                    {paymentSettings?.mpesa_paybill_number && (
                      <p className="text-xs text-warning/70">Paybill: {paymentSettings.mpesa_paybill_number}</p>
                    )}
                    {paymentSettings?.mpesa_till_number && (
                      <p className="text-xs text-warning/70">Till: {paymentSettings.mpesa_till_number}</p>
                    )}
                    {paymentSettings?.mpesa_phone_number && (
                      <p className="text-xs text-warning/70">Phone: {paymentSettings.mpesa_phone_number}</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {!hasPaymentDetails && (
        <Card className="bg-warning/15 border-warning/30">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Info className="h-5 w-5 text-warning" />
              <div>
                <p className="text-warning font-medium">Payment details not configured</p>
                <p className="text-sm text-warning">Go to Settings tab to add bank and M-Pesa payment details for managers.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Manager Summary */}
      {managers && managers.length > 0 && (
        <Card className="bg-card border-warning/15">
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2">
              <Users className="h-5 w-5 text-warning" />
              Manager Summary
            </CardTitle>
            <CardDescription className="text-warning/70">
              Quick overview of registered managers
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="p-4 bg-secondary-background rounded-lg">
                <p className="text-sm text-warning/70">Total Managers</p>
                <p className="text-2xl font-bold text-foreground">{managers.length}</p>
              </div>
              <div className="p-4 bg-secondary-background rounded-lg">
                <p className="text-sm text-warning/70">With Registration Invoice</p>
                <p className="text-2xl font-bold text-foreground">
                  {managers.filter(m => m.has_registration_invoice).length}
                </p>
              </div>
              <div className="p-4 bg-secondary-background rounded-lg">
                <p className="text-sm text-warning/70">Total Net Collection</p>
                <p className="text-2xl font-bold text-foreground">
                  KES {managers.reduce((sum, m) => sum + m.net_collection, 0).toLocaleString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default BillingOverview;
