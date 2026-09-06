import { Link } from "react-router-dom";
import { format } from "date-fns";
import { Wrench } from "lucide-react";
import LandlordLayout from "@/features/landlord/components/LandlordLayout";
import { useLandlordPortfolio } from "@/features/landlord/hooks/useLandlordPortfolio";
import { useLandlordMaintenance } from "@/features/landlord/hooks/useLandlordOps";
import { formatKes } from "@/features/landlord/lib/formatKes";
import { landlordPropertyPath } from "@/features/landlord/lib/landlordPaths";
import { Badge } from "@/shared/components/ui/badge";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { EmptyState } from "@/shared/components/ui/empty-state";
import { ErrorState } from "@/shared/components/ui/error-state";
import { maintenancePriorityTone, maintenanceStatusTone, statusBadgeClass } from "@/shared/lib/statusBadge";

export default function LandlordMaintenance() {
  const { properties, isLoading: portfolioLoading, isError: portfolioError, refetch } = useLandlordPortfolio();
  const { data: items = [], isLoading, isError, refetch: refetchMaint } = useLandlordMaintenance(properties);
  const openCount = items.filter((m) => m.status !== "completed").length;

  return (
    <LandlordLayout
      title="Maintenance"
      description="Open work on your buildings by unit and category. Your manager runs the jobs — this view does not include tenant contact details."
    >
      {portfolioError || isError ? (
        <ErrorState
          title="Couldn't load maintenance"
          onRetry={() => {
            void refetch();
            void refetchMaint();
          }}
          className="mb-6"
        />
      ) : null}

      {portfolioLoading || isLoading ? (
        <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
      ) : items.length === 0 ? (
        <EmptyState icon={Wrench} title="No maintenance requests" description="Open jobs will appear here by unit and category." />
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">{openCount} open · {items.length} recorded</p>
          {items.map((m) => (
            <div
              key={m.id}
              className={`flex items-center justify-between gap-3 rounded-lg border p-3 ${
                m.status === "completed"
                  ? "border-success/30 bg-success/5"
                  : m.priority === "urgent" || m.priority === "high"
                    ? "border-destructive/30 bg-destructive/5"
                    : "border-border bg-card"
              }`}
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Link to={landlordPropertyPath(m.propertyId)} className="text-sm font-medium hover:underline">
                    {m.propertyName}
                  </Link>
                  <span className="text-sm text-muted-foreground">{m.unit_number ? `Unit ${m.unit_number}` : "Common area"}</span>
                  <Badge variant="outline" className={`text-xs ${statusBadgeClass(maintenanceStatusTone(m.status))}`}>
                    {m.status.replace("_", " ")}
                  </Badge>
                  {(m.priority === "urgent" || m.priority === "high") && (
                    <span className={statusBadgeClass(maintenancePriorityTone(m.priority))}>{m.priority}</span>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {m.category || "Maintenance"}
                  {m.requested_date ? ` · ${format(new Date(m.requested_date), "dd/MM/yy")}` : ""}
                </p>
              </div>
              {m.budget ? <p className="shrink-0 text-xs text-muted-foreground">Budget {formatKes(m.budget)}</p> : null}
            </div>
          ))}
        </div>
      )}
    </LandlordLayout>
  );
}
