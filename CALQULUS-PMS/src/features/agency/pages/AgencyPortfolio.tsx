import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Building2 } from "lucide-react";
import AgencyLayout from "@/features/agency/components/AgencyLayout";
import { useAgencyPortfolio } from "@/features/agency/lib/useAgencyPortfolio";
import { AGENCY_OPS_ROUTES, agencyPropertyPath } from "@/features/agency/lib/agencyPaths";
import { formatKes } from "@/features/landlord/lib/formatKes";
import { AGENCY_SERVICE_MODELS, AGENCY_SERVICE_MODEL_SHORT_LABELS, type AgencyServiceModel } from "@/shared/constants/authorityModels";
import { Badge } from "@/shared/components/ui/badge";
import { occupancyRateColor } from "@/shared/lib/statusBadge";
import { Button } from "@/shared/components/ui/button";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { ErrorState } from "@/shared/components/ui/error-state";
import { EmptyState } from "@/shared/components/ui/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/components/ui/table";

export default function AgencyPortfolio() {
  const { data, isLoading, isError, refetch } = useAgencyPortfolio();
  const [serviceFilter, setServiceFilter] = useState<AgencyServiceModel | "all" | "unconfigured">("all");
  const maxCollected = Math.max(0, ...(data?.properties ?? []).map((p) => p.collectedMtd));
  const filteredProperties = useMemo(() => {
    const properties = data?.properties ?? [];
    if (serviceFilter === "all") return properties;
    if (serviceFilter === "unconfigured") return properties.filter((property) => !property.serviceModel);
    return properties.filter((property) => property.serviceModel === serviceFilter);
  }, [data?.properties, serviceFilter]);

  return (
    <AgencyLayout
      title="Portfolio"
      description="Every building on the book, with the client, occupancy, and collections for this month."
      actions={
        <Button variant="outline" asChild>
          <Link to={AGENCY_OPS_ROUTES.buildings}>Manage buildings</Link>
        </Button>
      }
    >
      {isError ? <ErrorState title="Couldn't load portfolio" onRetry={() => void refetch()} className="mb-6" /> : null}

      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
      ) : (data?.properties.length ?? 0) === 0 ? (
        <EmptyState
          icon={Building2}
          title="No properties on the book"
          description="Add a building, then link a client."
        />
      ) : (
        <>
          <div
            className="mb-5 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-3 lg:grid-cols-6"
            aria-label="Portfolio totals"
          >
            {[
              { label: "Properties", value: String(data!.totalProperties) },
              { label: "Units", value: `${data!.totalOccupied}/${data!.totalUnits}` },
              { label: "Occupancy", value: `${data!.occupancyRate}%` },
              { label: "Collected this month", value: formatKes(data!.collectedMtd) },
              { label: "Outstanding", value: formatKes(data!.outstanding), attention: data!.outstanding > 0 },
              { label: "Clients", value: String(data!.clientCount) },
            ].map((cell) => (
              <div key={cell.label} className="bg-card p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{cell.label}</p>
                <p className={`mt-1 font-heading text-base font-bold sm:text-lg ${cell.attention ? "text-destructive" : ""}`}>
                  {cell.value}
                </p>
              </div>
            ))}
          </div>

          <div className="mb-4 rounded-xl border border-border bg-card p-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-semibold text-foreground">Operating model</p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">Filter the book by what your agency is contracted to do.</p>
              </div>
              <div className="flex min-w-0 flex-wrap gap-1.5">
                <button type="button" onClick={() => setServiceFilter("all")} className={`rounded-full border px-2.5 py-1.5 text-[10px] font-semibold transition ${serviceFilter === "all" ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-muted-foreground hover:border-primary/40"}`}>All</button>
                {AGENCY_SERVICE_MODELS.map((model) => (
                  <button key={model.id} type="button" onClick={() => setServiceFilter(model.id)} className={`rounded-full border px-2.5 py-1.5 text-[10px] font-semibold transition ${serviceFilter === model.id ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-muted-foreground hover:border-primary/40"}`}>
                    {AGENCY_SERVICE_MODEL_SHORT_LABELS[model.id]}
                  </button>
                ))}
                {(data?.serviceMix.unconfigured ?? 0) > 0 ? <button type="button" onClick={() => setServiceFilter("unconfigured")} className={`rounded-full border px-2.5 py-1.5 text-[10px] font-semibold transition ${serviceFilter === "unconfigured" ? "border-warning bg-warning text-white" : "border-warning/30 bg-warning/5 text-warning hover:bg-warning/10"}`}>Unconfigured · {data?.serviceMix.unconfigured ?? 0}</button> : null}
              </div>
            </div>
            <p className="mt-2 text-[10px] text-muted-foreground">Showing {filteredProperties.length} of {data?.totalProperties ?? 0} properties.</p>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Property</TableHead>
                <TableHead>Client</TableHead>
                <TableHead className="hidden min-w-[170px] lg:table-cell">Service</TableHead>
                <TableHead className="text-right">Units</TableHead>
                <TableHead className="text-right">Occupancy</TableHead>
                <TableHead className="text-right">Collected</TableHead>
                <TableHead className="text-right">Outstanding</TableHead>
                <TableHead className="hidden w-32 lg:table-cell">Performance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProperties.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-10 text-center">
                    <p className="text-sm font-medium">No properties match this operating model.</p>
                    <button type="button" onClick={() => setServiceFilter("all")} className="mt-1 text-xs font-semibold text-primary hover:underline">Show all properties</button>
                  </TableCell>
                </TableRow>
              ) : null}
              {filteredProperties.map((property) => (
                <TableRow key={property.id}>
                  <TableCell>
                    <Link to={agencyPropertyPath(property.id)} className="font-medium hover:underline">
                      {property.name}
                    </Link>
                    {property.address ? <p className="text-xs text-muted-foreground">{property.address}</p> : null}
                  </TableCell>
                  <TableCell className="text-sm">{property.clientName}</TableCell>
                  <TableCell className="hidden lg:table-cell">
                    {property.serviceModel ? (
                      <Badge variant="outline" className="whitespace-nowrap font-medium">
                        {AGENCY_SERVICE_MODEL_SHORT_LABELS[property.serviceModel]}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">Set mandate</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right text-sm">{property.occupied}/{property.units}</TableCell>
                  <TableCell className={`text-right text-sm ${occupancyRateColor(property.occupancyRate)}`}>
                    {property.occupancyRate}%
                  </TableCell>
                  <TableCell className="text-right text-sm font-medium">{formatKes(property.collectedMtd)}</TableCell>
                  <TableCell className={`text-right text-sm ${property.outstanding > 0 ? "text-destructive" : ""}`}>
                    {formatKes(property.outstanding)}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    <div
                      className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
                      role="img"
                      aria-label={`Collected ${formatKes(property.collectedMtd)} this month`}
                    >
                      <div
                        className="h-full rounded-full bg-[var(--portal-accent)]"
                        style={{ width: `${maxCollected > 0 ? Math.max(4, Math.round((property.collectedMtd / maxCollected) * 100)) : 0}%` }}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </>
      )}
    </AgencyLayout>
  );
}
