import { Skeleton } from '@/shared/components/ui/skeleton';

/**
 * Shared loading placeholder for the operational command-center dashboards
 * (Accountant/Leasing/Maintenance/Support), which previously each carried
 * an identical copy of this markup.
 */
export function DashboardLoadingSkeleton() {
  return (
    <div className="p-6 space-y-6">
      <Skeleton className="h-10 w-64" />
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32 rounded-xl" />)}
      </div>
      <Skeleton className="h-80 rounded-xl" />
    </div>
  );
}
