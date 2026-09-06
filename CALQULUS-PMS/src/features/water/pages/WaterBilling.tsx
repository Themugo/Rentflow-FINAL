import { Layout } from "@/shared/components/layout/Layout";
import { WaterBillingManager } from "@/features/water/components/WaterBillingManager";
import { useManagerPropertiesSimple } from "@/shared/hooks/useManagerPropertiesSimple";
import { PropertySelectDropdown } from "@/shared/components/PropertySelectDropdown";
import { useState } from "react";
import { Droplets } from "lucide-react";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { Card, CardContent } from "@/shared/components/ui/card";
import { FeatureGate } from "@/shared/components/FeatureGate";

const WaterBilling = () => {
  const [selectedProperty, setSelectedProperty] = useState<string | null>(null);
  const { properties, isLoading } = useManagerPropertiesSimple();

  return (
    <Layout
      title="Water Billing"
      subtitle="Meter readings and water charges by property and unit"
      headerActions={
        <PropertySelectDropdown
          properties={properties}
          selectedProperty={selectedProperty}
          onSelect={setSelectedProperty}
        />
      }
    >
      <FeatureGate feature="water_billing" featureLabel="Water billing">
      {!selectedProperty && !isLoading && (
        <Card className="border-dashed">
          <CardContent className="py-16 text-center">
            <Droplets className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
            <h3 className="font-medium text-muted-foreground">Select a property</h3>
            <p className="text-sm text-muted-foreground/70 mt-1">
              Choose a property from the dropdown above to manage its water billing.
            </p>
          </CardContent>
        </Card>
      )}

      {isLoading && (
        <div className="space-y-4">
          <Skeleton className="h-48 w-full rounded-xl" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      )}

      {selectedProperty && !isLoading && (
        <WaterBillingManager
          propertyId={selectedProperty}
          propertyName={properties.find((p) => p.id === selectedProperty)?.name ?? "Property"}
        />
      )}
      </FeatureGate>
    </Layout>
  );
};

export default WaterBilling;
