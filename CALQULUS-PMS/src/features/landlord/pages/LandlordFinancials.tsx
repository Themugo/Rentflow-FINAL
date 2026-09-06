import LandlordLayout from "@/features/landlord/components/LandlordLayout";
import LandlordFinancialStatement from "@/features/landlord/components/LandlordFinancialStatement";
import { useLandlordPortfolio } from "@/features/landlord/hooks/useLandlordPortfolio";
import { BarChart3 } from "lucide-react";
import { EmptyState } from "@/shared/components/ui/empty-state";
import { ErrorState } from "@/shared/components/ui/error-state";
import { Skeleton } from "@/shared/components/ui/skeleton";

export default function LandlordFinancials() {
  const { properties, isLoading, isError, refetch } = useLandlordPortfolio();

  return (
    <LandlordLayout
      title="Financial performance"
      description="Collected, management fee, and net to you. Figures come from your linked properties — not tenant payment lists."
    >
      {isError ? <ErrorState title="Couldn't load financials" onRetry={() => void refetch()} className="mb-6" /> : null}
      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : properties.length === 0 ? (
        <EmptyState icon={BarChart3} title="Link a property to see performance" description="Income trend and net share appear after your manager links a building." />
      ) : (
        <LandlordFinancialStatement properties={properties} mode="performance" />
      )}
    </LandlordLayout>
  );
}
