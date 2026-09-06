import { Card, CardContent } from '@/shared/components/ui/card';
import { AlertCircle, CheckCircle, Clock } from 'lucide-react';

interface TenantStatsCardsProps {
  totalDue: number;
  paidThisYear: number;
  pendingCount: number;
  overdueCount: number;
  formatCurrency: (amount: number) => string;
}

export const TenantStatsCards = ({
  totalDue,
  paidThisYear,
  pendingCount,
  overdueCount,
  formatCurrency,
}: TenantStatsCardsProps) => {
  return (
    <div className="mb-8 grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-destructive/10 flex items-center justify-center">
              <AlertCircle className="h-6 w-6 text-destructive" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Due</p>
              <p className="amount-display text-2xl font-bold">{formatCurrency(totalDue)}</p>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-success/10 flex items-center justify-center">
              <CheckCircle className="h-6 w-6 text-success" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Paid This Year</p>
              <p className="amount-display text-2xl font-bold">{formatCurrency(paidThisYear)}</p>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-warning flex items-center justify-center">
              <Clock className="h-6 w-6 text-warning" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Pending</p>
              <p className="text-2xl font-bold">{pendingCount}</p>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-destructive/10 flex items-center justify-center">
              <AlertCircle className="h-6 w-6 text-destructive" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Overdue</p>
              <p className="text-2xl font-bold">{overdueCount}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
