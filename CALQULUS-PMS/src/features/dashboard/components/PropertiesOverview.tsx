import { Link } from "react-router-dom";
import { Button } from "@/shared/components/ui/button";
import { Building2 } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/components/ui/table";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { ErrorState } from "@/shared/components/ui/error-state";
import { useDashboardProperties } from "@/features/dashboard/hooks/useDashboardData";

export function PropertiesOverview({ showHeader = true }: { showHeader?: boolean }) {
  const { data: properties = [], isPending, isError, refetch } = useDashboardProperties();

  const occupancyTone = (rate: number) => {
    if (rate >= 90) return "bg-success";
    if (rate >= 70) return "bg-warning";
    return "bg-destructive";
  };

  if (isPending) {
    return (
      <div className="rounded-xl border border-border bg-card p-4 sm:p-6 card-shadow" aria-busy="true">
        {showHeader ? <Skeleton className="mb-4 h-5 w-40" /> : null}
        <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full rounded-lg" />)}</div>
      </div>
    );
  }
  if (isError) return <ErrorState title="Couldn't load property performance" onRetry={() => { void refetch(); }} />;

  return (
    <div className="rounded-xl border border-border bg-card p-4 sm:p-6 card-shadow">
      {showHeader ? (
        <div className="mb-4 flex items-center justify-between">
          <h3 className="type-card-title flex items-center gap-2"><Building2 className="h-4 w-4 text-muted-foreground" aria-hidden />Properties</h3>
          <Button variant="ghost" size="sm" asChild><Link to="/properties">View all</Link></Button>
        </div>
      ) : (
        <div className="mb-3 flex justify-end"><Button variant="ghost" size="sm" asChild><Link to="/properties">View all</Link></Button></div>
      )}
      {properties.length === 0 ? (
        <div className="py-8 text-center"><p className="mb-3 text-sm text-muted-foreground">No properties yet</p><Button variant="outline" size="sm" asChild><Link to="/properties">Add property</Link></Button></div>
      ) : (
        <Table>
          <TableHeader><TableRow><TableHead>Property</TableHead><TableHead>Address</TableHead><TableHead className="text-right">Occupancy</TableHead></TableRow></TableHeader>
          <TableBody>{[...properties]
            .sort((a, b) => {
              const aRate = a.units > 0 ? a.occupied / a.units : 0;
              const bRate = b.units > 0 ? b.occupied / b.units : 0;
              return aRate - bRate || a.name.localeCompare(b.name);
            })
            .slice(0, 8)
            .map((property) => {
              const occupancyRate = property.units > 0 ? Math.round((property.occupied / property.units) * 100) : 0;
              return <TableRow key={property.id}>
                <TableCell>
                  <div className="min-w-0">
                    <Link to={`/properties/${property.id}`} className="font-medium text-foreground hover:underline">{property.name}</Link>
                    {occupancyRate < 70 && property.units > 0 && (
                      <p className="mt-0.5 text-[11px] text-muted-foreground">Needs occupancy attention</p>
                    )}
                  </div>
                </TableCell>
                <TableCell className="max-w-[16rem] truncate text-muted-foreground">{property.address}</TableCell>
                <TableCell className="text-right"><div className="inline-flex min-w-[7rem] flex-col items-end gap-1"><span className="text-sm text-foreground">{property.occupied}/{property.units} <span className="text-muted-foreground">({occupancyRate}%)</span></span><div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted"><div className={cn("h-full rounded-full", occupancyTone(occupancyRate))} style={{ width: `${occupancyRate}%` }} /></div></div></TableCell>
              </TableRow>;
            })}</TableBody>
        </Table>
      )}
    </div>
  );
}
