import { Layout } from "@/shared/components/layout/Layout";
import { PropertyStatementTab } from "@/features/properties/components/PropertyStatementTab";
import { useManagerPropertiesSimple } from "@/shared/hooks/useManagerPropertiesSimple";
import { PropertySelectDropdown } from "@/shared/components/PropertySelectDropdown";
import { useState } from "react";
import { FileSpreadsheet } from "lucide-react";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { Card, CardContent } from "@/shared/components/ui/card";

const Statements = () => {
  const [selectedProperty, setSelectedProperty] = useState<string | null>(null);
  const { properties, isLoading } = useManagerPropertiesSimple();

  return (
    <Layout
      title="Statements"
      subtitle="Monthly collection statements by property — export what was billed and paid"
      headerActions={
        <PropertySelectDropdown
          properties={properties}
          selectedProperty={selectedProperty}
          onSelect={setSelectedProperty}
        />
      }
    >
      {!selectedProperty && !isLoading && (
        <Card className="border-dashed">
          <CardContent className="py-16 text-center">
            <FileSpreadsheet className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
            <h3 className="font-medium text-muted-foreground">Select a property</h3>
            <p className="text-sm text-muted-foreground/70 mt-1">
              Choose a property from the dropdown above to generate statements.
            </p>
          </CardContent>
        </Card>
      )}

      {isLoading && (
        <div className="space-y-4">
          <Skeleton className="h-48 w-full rounded-xl" />
        </div>
      )}

      {selectedProperty && !isLoading && (
        <PropertyStatementTab
          propertyId={selectedProperty}
          propertyName={properties.find((p) => p.id === selectedProperty)?.name ?? "Property"}
        />
      )}
    </Layout>
  );
};

export default Statements;
