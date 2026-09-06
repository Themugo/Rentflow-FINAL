import React from 'react';
import { Badge } from '@/shared/components/ui/badge';
import { cn } from '@/shared/lib/utils';
import { format, differenceInDays, isPast } from 'date-fns';
import { Calendar, FileText, TrendingUp, AlertTriangle, CheckCircle2, Clock, Home } from 'lucide-react';

interface Lease {
  id: string;
  property: string;
  unit: string;
  start_date: string;
  end_date: string;
  monthly_rent: number;
  status: string;
}

interface Payment {
  id: string;
  amount: number;
  paid_date: string;
  invoice_number: string;
}

interface TenantDashboardStatsProps {
  lease: Lease | null;
  recentPayments: Payment[];
  pendingInvoicesCount: number;
  overdueInvoicesCount: number;
  formatCurrency: (amount: number) => string;
}

interface StatTileProps {
  label: string;
  value: React.ReactNode;
  sub?: string;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  accent: string;
  badge?: { label: string; variant: 'default' | 'destructive' | 'secondary' | 'outline' };
}

function StatTile({ label, value, sub, icon: Icon, iconBg, iconColor, accent, badge }: StatTileProps) {
  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-2xl border bg-card p-4 sm:p-5',
        'shadow-sm transition-all duration-300 hover:shadow-lg hover:-translate-y-1',
        'border-border/60 hover:border-warning/40 animate-fade-in',
      )}
    >
      <div
        className={cn(
          'absolute top-0 left-0 right-0 h-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-300',
          `bg-gradient-to-r from-transparent ${accent} to-transparent`,
        )}
      />

      <div className="flex items-start justify-between gap-3 mb-3">
        <p className="text-xs font-semibold text-muted-foreground/70 uppercase tracking-widest">{label}</p>
        <div
          className={cn(
            'rounded-xl border p-2 flex-shrink-0 transition-all duration-300 group-hover:scale-110',
            iconBg,
          )}
        >
          <Icon className={cn('h-4 w-4', iconColor)} />
        </div>
      </div>

      <div className="space-y-1">
        <div className="flex items-end gap-2">
          <div className="font-heading text-2xl font-bold text-card-foreground leading-none">{value}</div>
          {badge && (
            <Badge variant={badge.variant} className="text-[10px] h-4 px-1.5 mb-0.5">
              {badge.label}
            </Badge>
          )}
        </div>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </div>
    </div>
  );
}

const TenantDashboardStats: React.FC<TenantDashboardStatsProps> = ({
  lease,
  recentPayments,
  pendingInvoicesCount,
  overdueInvoicesCount,
  formatCurrency,
}) => {
  const getLeaseExpiryInfo = () => {
    if (!lease) return null;
    const endDate = new Date(lease.end_date);
    const today = new Date();
    const daysUntilExpiry = differenceInDays(endDate, today);

    if (isPast(endDate)) {
      return {
        status: 'expired',
        message: 'Expired',
        variant: 'destructive' as const,
        days: Math.abs(daysUntilExpiry),
        icon: AlertTriangle,
      };
    } else if (daysUntilExpiry <= 30) {
      return {
        status: 'expiring',
        message: `${daysUntilExpiry}d left`,
        variant: 'destructive' as const,
        days: daysUntilExpiry,
        icon: Clock,
      };
    } else if (daysUntilExpiry <= 90) {
      return {
        status: 'upcoming',
        message: `${daysUntilExpiry}d left`,
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
  const totalPaid = recentPayments.reduce((s, p) => s + p.amount, 0);
  const allClear = overdueInvoicesCount === 0 && pendingInvoicesCount === 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
      {/* Lease Status */}
      {lease && leaseInfo && (
        <div
          className={cn(
            'group relative overflow-hidden rounded-2xl border bg-card p-4 sm:p-5',
            'shadow-sm transition-all duration-300 hover:shadow-lg hover:-translate-y-1',
            'border-border/60 hover:border-warning/40 animate-fade-in',
          )}
        >
          <div className="absolute top-0 left-0 right-0 h-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-r from-transparent via-success to-transparent" />

          <div className="flex items-start justify-between gap-3 mb-3">
            <p className="text-xs font-semibold text-muted-foreground/70 uppercase tracking-widest">Lease Status</p>
            <div className="rounded-xl border p-2 flex-shrink-0 bg-gradient-to-br from-success to-success border-success transition-all duration-300 group-hover:scale-110">
              <Home className="h-4 w-4 text-success" />
            </div>
          </div>

          <div className="space-y-2.5">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-semibold truncate">{lease.property}</p>
                <p className="text-xs text-muted-foreground">Unit {lease.unit}</p>
              </div>
              <Badge variant={leaseInfo.variant} className="flex items-center gap-1 shrink-0 text-xs">
                <leaseInfo.icon className="h-3 w-3" />
                {leaseInfo.message}
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-muted/50 rounded-lg p-2">
                <p className="text-muted-foreground">Start</p>
                <p className="font-medium">{format(new Date(lease.start_date), 'dd/MM/yy')}</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-2">
                <p className="text-muted-foreground">End</p>
                <p className="font-medium">{format(new Date(lease.end_date), 'dd/MM/yy')}</p>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-border/40">
              <span className="text-xs text-muted-foreground">Monthly Rent</span>
              <span className="font-semibold text-sm">{formatCurrency(lease.monthly_rent)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Invoice Summary */}
      <StatTile
        label="Invoice Summary"
        icon={FileText}
        iconBg={
          allClear
            ? 'bg-gradient-to-br from-success to-success border-success'
            : overdueInvoicesCount > 0
              ? 'bg-gradient-to-br from-destructive to-destructive border-destructive'
              : 'bg-gradient-to-br from-orange-500/15 to-orange-500/5 border-orange-500/20'
        }
        iconColor={allClear ? 'text-success' : overdueInvoicesCount > 0 ? 'text-destructive' : 'text-orange-500'}
        accent={allClear ? 'via-success' : overdueInvoicesCount > 0 ? 'via-destructive' : 'via-orange-500/60'}
        value={
          allClear ? (
            <span className="flex items-center gap-2 text-success">
              <CheckCircle2 className="h-5 w-5" />
              All paid
            </span>
          ) : (
            <span className={overdueInvoicesCount > 0 ? 'text-destructive' : 'text-orange-500'}>
              {pendingInvoicesCount + overdueInvoicesCount}
            </span>
          )
        }
        sub={
          allClear
            ? 'No outstanding invoices'
            : [
                overdueInvoicesCount > 0 ? `${overdueInvoicesCount} overdue` : null,
                pendingInvoicesCount > 0 ? `${pendingInvoicesCount} pending` : null,
              ]
                .filter(Boolean)
                .join(' · ')
        }
        badge={overdueInvoicesCount > 0 ? { label: 'Action needed', variant: 'destructive' } : undefined}
      />

      {/* Recent Payments */}
      <StatTile
        label="Recent Payments"
        icon={TrendingUp}
        iconBg="bg-gradient-to-br from-primary/20 to-primary/10 border-primary/30"
        iconColor="text-primary"
        accent="via-primary/60"
        value={recentPayments.length > 0 ? formatCurrency(totalPaid) : '—'}
        sub={
          recentPayments.length > 0
            ? `${recentPayments.length} payment${recentPayments.length !== 1 ? 's' : ''} · last ${format(new Date(recentPayments[0].paid_date), 'dd MMM')}`
            : 'No recent payments'
        }
      />
    </div>
  );
};

export default TenantDashboardStats;
