import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Building2 } from "lucide-react";
import LandlordLayout from "@/features/landlord/components/LandlordLayout";
import LandlordPropertyDetail from "@/features/landlord/components/LandlordPropertyDetail";
import { useLandlordPortfolio } from "@/features/landlord/hooks/useLandlordPortfolio";
import { LANDLORD_ROUTES } from "@/features/landlord/lib/landlordPaths";
import { Button } from "@/shared/components/ui/button";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { EmptyState } from "@/shared/components/ui/empty-state";
import { ErrorState } from "@/shared/components/ui/error-state";

export default function LandlordPropertyPage() {
  const { id } = useParams<{ id: string }>();
  const { properties, isLoading, isError, refetch } = useLandlordPortfolio();
  const property = properties.find((p) => p.id === id);

  return (
    <LandlordLayout
      title={property?.name ?? "Property"}
      description="Units, occupancy, and maintenance for this building. No tenant names, emails, or phone numbers."
      actions={
        <Button variant="outline" asChild>
          <Link to={LANDLORD_ROUTES.portfolio}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Portfolio
          </Link>
        </Button>
      }
    >
      {isError ? <ErrorState title="Couldn't load this property" onRetry={() => void refetch()} /> : null}
      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : !property ? (
        <EmptyState
          icon={Building2}
          title="Property not in your portfolio"
          description="This building is not linked to your landlord account."
        />
      ) : (
        <LandlordPropertyDetail
          propertyId={property.id}
          propertyName={property.name}
          revenueSharePct={property.revenue_share_pct}
        />
      )}
    </LandlordLayout>
  );
}
