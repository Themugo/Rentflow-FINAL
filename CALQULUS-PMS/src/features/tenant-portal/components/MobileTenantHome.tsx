import React from 'react';
import { Card, CardContent } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import { format, differenceInDays, isPast } from 'date-fns';
import {
  Clock,
  AlertCircle,
  CreditCard,
  Smartphone,
  ChevronRight,
  History,
  FileText,
  Wallet,
  Home,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Wrench,
  Bell,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { ManagerBankDetails } from './ManagerBankDetails';
import { ManagerContactCard } from './ManagerContactCard';
import { invoiceStatusLabel, invoiceStatusTone, statusBadgeClass } from '@/shared/lib/statusBadge';

interface Invoice {
  id: string;
  invoice_number: string;
  amount: number;
  due_date: string;
  paid_date: string | null;
  status: string;
  description: string | null;
  balance_due?: number | null;
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

interface MobileTenantHomeProps {
  tenantName: string;
  greeting: string;
  propertyInfo: string;
  stats: {
    totalDue: number;
    paidThisYear: number;
    pendingCount: number;
    overdueCount: number;
  };
  urgentInvoices: Invoice[];
  lease?: Lease | null;
  managerId?: string | null;
  propertyId?: string | null;
  formatCurrency: (amount: number) => string;
  onPayInvoice: (invoice: Invoice) => void;
  onPayNow?: () => void;
  lastPayment?: { invoice_number: string; amount: number; paid_date: string } | null;
  maintenance?: { openCount: number; urgentCount: number; latestTitle: string | null };
}

const amountDue = (invoice: Invoice) => Number(invoice.balance_due ?? invoice.amount);

const MobileTenantHome: React.FC<MobileTenantHomeProps> = ({
  tenantName,
  greeting,
  propertyInfo,
  stats,
  urgentInvoices,
  lease,
  managerId,
  propertyId,
  formatCurrency,
  onPayInvoice,
  onPayNow,
  lastPayment,
  maintenance,
}) => {
  const firstName = tenantName.split(' ')[0];
  const nextDue = urgentInvoices[0];
  const payNow = () => {
    if (onPayNow) {
      onPayNow();
      return;
    }
    if (nextDue) onPayInvoice(nextDue);
  };

  const getLeaseExpiryInfo = () => {
    if (!lease) return null;

    const endDate = new Date(lease.end_date);
    const today = new Date();
    const daysUntilExpiry = differenceInDays(endDate, today);

    if (isPast(endDate)) {
      return {
        status: 'expired',
        message: 'Lease expired',
        variant: 'destructive' as const,
        days: Math.abs(daysUntilExpiry),
        icon: AlertTriangle,
      };
    } else if (daysUntilExpiry <= 30) {
      return {
        status: 'expiring',
        message: `${daysUntilExpiry} days left`,
        variant: 'destructive' as const,
        days: daysUntilExpiry,
        icon: Clock,
      };
    } else if (daysUntilExpiry <= 90) {
      return {
        status: 'upcoming',
        message: `${daysUntilExpiry} days left`,
        variant: 'secondary' as const,
        days: daysUntilExpiry,
        icon: Calendar,
      };
    } else {
      return {
        status: 'active',
        message: 'Active',
        variant: 'default' as const,
        days: daysUntilExpiry,
        icon: CheckCircle2,
      };
    }
  };

  const leaseInfo = getLeaseExpiryInfo();
  const isOverdue = stats.overdueCount > 0;
  const hasBalance = stats.totalDue > 0;

  return (
    <div className="space-y-5 pb-20">
      <Card className={`bg-card border overflow-hidden shadow-sm ${isOverdue ? 'border-destructive/40' : hasBalance ? 'border-warning/40' : 'border-success/30'}`}>
        <CardContent className="pt-5 pb-5">
          <p className="text-sm text-muted-foreground mb-1">
            {greeting}, {firstName}
          </p>
          <p className="text-xs text-muted-foreground mb-4">{propertyInfo}</p>

          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
            {hasBalance ? 'Current balance' : 'Balance'}
          </p>
          <p className={`amount-display text-[1.75rem] font-bold leading-tight tracking-tight sm:text-4xl ${isOverdue ? 'text-destructive' : hasBalance ? 'text-warning' : 'text-success'}`}>
            {formatCurrency(stats.totalDue)}
          </p>
          {nextDue ? (
            <p className="text-sm text-muted-foreground mt-1">
              Due {format(new Date(nextDue.due_date), 'dd MMM yyyy')}
              {nextDue.status === 'overdue' ? ' · Overdue' : ''}
            </p>
          ) : (
            <p className="text-sm text-success mt-1">Nothing due</p>
          )}

          {lastPayment && (
            <p className="text-xs text-muted-foreground mt-2">
              Last payment · {lastPayment.invoice_number} · {formatCurrency(lastPayment.amount)} · {format(new Date(lastPayment.paid_date), 'dd/MM/yy')}
            </p>
          )}

          <Button
            className={`w-full h-12 mt-4 text-base font-semibold ${isOverdue ? 'bg-destructive hover:bg-destructive/90' : 'bg-teal hover:bg-teal/90'} text-white`}
            disabled={!hasBalance}
            onClick={payNow}
          >
            <Smartphone className="h-5 w-5 mr-2" />
            {hasBalance ? 'Pay now' : 'All paid'}
          </Button>
        </CardContent>
      </Card>

      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl border border-border bg-card p-3 text-center">
          <Wallet className="h-4 w-4 mx-auto mb-1 text-success" />
          <p className="text-[10px] text-muted-foreground">Paid</p>
          <p className="font-semibold text-xs text-foreground truncate">{formatCurrency(stats.paidThisYear)}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-3 text-center">
          <Clock className="h-4 w-4 mx-auto mb-1 text-warning" />
          <p className="text-[10px] text-muted-foreground">Pending</p>
          <p className="font-semibold text-xs text-foreground">{stats.pendingCount}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-3 text-center">
          <AlertCircle className="h-4 w-4 mx-auto mb-1 text-destructive" />
          <p className="text-[10px] text-muted-foreground">Overdue</p>
          <p className="font-semibold text-xs text-destructive">{stats.overdueCount}</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <button
          type="button"
          onClick={payNow}
          disabled={!hasBalance}
          className="rounded-xl border border-border bg-card p-3 flex flex-col items-center text-center active:scale-[0.98] disabled:opacity-50"
        >
          <div className="h-10 w-10 rounded-xl bg-teal/10 flex items-center justify-center mb-1.5">
            <Smartphone className="h-5 w-5 text-teal" />
          </div>
          <p className="font-medium text-xs">Pay rent</p>
        </button>
        <Link to="/portal/payments" className="rounded-xl border border-border bg-card p-3 flex flex-col items-center text-center active:scale-[0.98]">
          <div className="h-10 w-10 rounded-xl bg-success/10 flex items-center justify-center mb-1.5">
            <History className="h-5 w-5 text-success" />
          </div>
          <p className="font-medium text-xs">History</p>
        </Link>
        <Link to="/portal/documents" className="rounded-xl border border-border bg-card p-3 flex flex-col items-center text-center active:scale-[0.98]">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center mb-1.5">
            <FileText className="h-5 w-5 text-primary" />
          </div>
          <p className="font-medium text-xs">Documents</p>
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Link to="/portal/maintenance" className="rounded-xl border border-border bg-card p-3 flex items-center gap-3 active:scale-[0.98]">
          <div className="h-10 w-10 rounded-xl bg-warning/10 flex items-center justify-center shrink-0">
            <Wrench className="h-5 w-5 text-warning" />
          </div>
          <div className="min-w-0 text-left">
            <p className="font-medium text-sm">Maintenance</p>
            <p className="text-xs text-muted-foreground truncate">
              {maintenance?.openCount
                ? `${maintenance.openCount} open${maintenance.urgentCount ? ` · ${maintenance.urgentCount} urgent` : ''}`
                : 'Request a repair'}
            </p>
          </div>
        </Link>
        <Link to="/portal/contracts" className="rounded-xl border border-border bg-card p-3 flex items-center gap-3 active:scale-[0.98]">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <FileText className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0 text-left">
            <p className="font-medium text-sm">Lease</p>
            <p className="text-xs text-muted-foreground">View & sign</p>
          </div>
        </Link>
      </div>

      {(maintenance?.openCount ?? 0) > 0 && (
        <Link to="/portal/maintenance" className="flex items-start gap-3 rounded-xl border border-warning/30 bg-warning/10 p-3">
          <Bell className="h-4 w-4 text-warning shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="text-sm font-medium">Needs your attention</p>
            <p className="text-xs text-muted-foreground truncate">
              {maintenance?.latestTitle || 'Open maintenance request'}
            </p>
          </div>
        </Link>
      )}

      {lease && leaseInfo && (
        <Card className="overflow-hidden border border-border bg-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Home className="h-4 w-4 text-primary" />
                <span className="font-medium text-sm">Your Lease</span>
              </div>
              <Badge variant={leaseInfo.variant} className="text-xs">
                <leaseInfo.icon className="h-3 w-3 mr-1" />
                {leaseInfo.message}
              </Badge>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <p className="text-muted-foreground text-xs">Property</p>
                <p className="font-medium">{lease.property}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Unit</p>
                <p className="font-medium">{lease.unit}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Monthly Rent</p>
                <p className="font-medium">{formatCurrency(lease.monthly_rent)}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">End Date</p>
                <p className="font-medium">{format(new Date(lease.end_date), 'dd/MM/yy')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {urgentInvoices.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-lg">Pay now</h3>
            <span className={statusBadgeClass(isOverdue ? 'danger' : 'warning')}>
              {urgentInvoices.length} due
            </span>
          </div>
          <div className="space-y-3">
            {urgentInvoices.map((invoice) => (
              <Card key={invoice.id} className="overflow-hidden">
                <CardContent className="p-0">
                  <div className="flex items-center">
                    <div className="flex-1 p-4 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="font-medium">{invoice.invoice_number}</span>
                        <span className={statusBadgeClass(invoiceStatusTone(invoice.status))}>
                          {invoiceStatusLabel(invoice.status)}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground mb-1">{invoice.description || 'Monthly Rent'}</p>
                      <p className="text-xs text-muted-foreground">
                        Due {format(new Date(invoice.due_date), 'dd/MM/yy')}
                      </p>
                    </div>
                    <div className="text-right pr-2 shrink-0">
                      <p className="font-bold text-lg">{formatCurrency(amountDue(invoice))}</p>
                    </div>
                    <Button onClick={() => onPayInvoice(invoice)} className="h-full rounded-none px-4 py-6 bg-teal hover:bg-teal/90 text-white" size="lg">
                      Pay
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {urgentInvoices.length > 0 && managerId && (
        <Card className="bg-success/10 border-success/30 overflow-hidden">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-full bg-success/20 flex items-center justify-center flex-shrink-0">
                <CreditCard className="h-5 w-5 text-success" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-sm mb-1">Ready to pay?</p>
                <p className="text-xs text-muted-foreground">
                  View your landlord's bank details below to make a direct payment via bank transfer or M-Pesa.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {managerId && <ManagerContactCard managerId={managerId} propertyId={propertyId} />}

      {managerId && <ManagerBankDetails managerId={managerId} propertyId={propertyId || undefined} />}

      <Card className="bg-muted/50 border-dashed">
        <CardContent className="p-4">
          <p className="text-sm font-medium mb-3">Accepted Payment Methods</p>
          <div className="flex gap-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CreditCard className="h-4 w-4" />
              <span>Card (USD)</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Smartphone className="h-4 w-4" />
              <span>M-Pesa (KES)</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {urgentInvoices.length === 0 && stats.totalDue === 0 && (
        <Card className="bg-success/10 border-success/20">
          <CardContent className="p-6 text-center">
            <div className="h-16 w-16 mx-auto rounded-full bg-success/20 flex items-center justify-center mb-3">
              <CheckCircle2 className="h-8 w-8 text-success" />
            </div>
            <p className="font-medium text-success">All paid up</p>
            <p className="text-sm text-muted-foreground mt-1">You have no outstanding payments.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default MobileTenantHome;
