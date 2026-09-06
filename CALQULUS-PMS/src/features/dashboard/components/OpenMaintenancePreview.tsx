import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, ArrowRight, CheckCircle2, Wrench } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useManagerScope } from "@/shared/hooks/useManagerScope";
import { useDashboardProperties } from "@/features/dashboard/hooks/useDashboardData";
import { logError } from "@/shared/lib/errorLogger";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { Button } from "@/shared/components/ui/button";
import { Link } from "react-router-dom";
import { EmptyState } from "@/shared/components/ui/empty-state";
import { ErrorState } from "@/shared/components/ui/error-state";
import { statusBadgeClass } from "@/shared/lib/statusBadge";
import { formatDate } from "@/shared/lib/dateFormat";

interface OpenTicket {
  id: string;
  title: string;
  property_name: string;
  unit_number: string | null;
  priority: string;
  status: string;
  created_at: string;
}

const PRIORITY_RANK: Record<string, number> = { urgent: 4, high: 3, medium: 2, low: 1 };

function priorityTone(priority: string): string {
  if (priority === "urgent" || priority === "high") return statusBadgeClass("danger");
  if (priority === "medium") return statusBadgeClass("warning");
  return statusBadgeClass("neutral");
}

export function OpenMaintenancePreview() {
  const navigate = useNavigate();
  const { managerId, restrictToAssignedProperties, assignedPropertyIds } = useManagerScope();
  const assignedKey = assignedPropertyIds.join(",");
  const { data: dashboardProperties = [], isPending: propertiesLoading } = useDashboardProperties();

  const { data: tickets = [], isPending, isError, refetch } = useQuery({
    queryKey: ["dashboard-open-maintenance", managerId, assignedKey],
    queryFn: async (): Promise<OpenTicket[]> => {
      if (!managerId) return [];
      if (restrictToAssignedProperties && assignedPropertyIds.length === 0) return [];

      const names = restrictToAssignedProperties
        ? dashboardProperties.map((property) => property.name).filter(Boolean)
        : null;
      if (restrictToAssignedProperties && !names?.length) return [];

      let query = supabase
        .from("maintenance_requests")
        .select("id, title, property_name, unit_number, priority, status, created_at")
        .eq("manager_id", managerId)
        .in("status", ["open", "pending", "in_progress"])
        .order("created_at", { ascending: false })
        .limit(8);

      if (names) {
        query = query.in("property_name", names);
      }

      const { data, error } = await query;
      if (error) {
        logError("OpenMaintenancePreview", error);
        throw error;
      }

      return [...((data ?? []) as OpenTicket[])].sort(
        (a, b) => (PRIORITY_RANK[b.priority] ?? 0) - (PRIORITY_RANK[a.priority] ?? 0),
      );
    },
    enabled: !!managerId && !propertiesLoading,
    staleTime: 30 * 1000,
  });

  if (isPending) {
    return (
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <ErrorState
        title="Couldn't load open work orders"
        onRetry={() => { void refetch(); }}
      />
    );
  }

  if (tickets.length === 0) {
    return (
      <EmptyState
        icon={CheckCircle2}
        title="No open maintenance"
        description="There are no open or in-progress work orders in this portfolio."
        actionLabel="Open maintenance"
        onAction={() => navigate("/maintenance")}
      />
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <ul className="divide-y divide-border">
        {tickets.map((ticket) => (
          <li key={ticket.id} className="flex items-center justify-between gap-3 px-4 py-3">
            <Link
              to={`/maintenance?priority=${encodeURIComponent(ticket.priority)}`}
              className="min-w-0 flex flex-1 items-start gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={`Open ${ticket.priority} priority maintenance: ${ticket.title}`}
            >
              <div className="mt-0.5 h-8 w-8 rounded-lg bg-muted border border-border flex items-center justify-center shrink-0">
                {(ticket.priority === "urgent" || ticket.priority === "high")
                  ? <AlertTriangle className="h-4 w-4 text-destructive" />
                  : <Wrench className="h-4 w-4 text-muted-foreground" />}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{ticket.title}</p>
                <p className="text-xs text-muted-foreground truncate mt-0.5">
                  {ticket.property_name}
                  {ticket.unit_number ? ` · ${ticket.unit_number}` : ""}
                  {" · "}
                  {formatDate(ticket.created_at)}
                </p>
              </div>
            </Link>
            <span className={`${priorityTone(ticket.priority)} shrink-0 capitalize`}>
              {ticket.priority}
            </span>
          </li>
        ))}
      </ul>
      <div className="border-t border-border px-4 py-3">
        <Button variant="outline" size="sm" className="min-h-11" onClick={() => navigate("/maintenance?priority=urgent")}>
          Prioritise urgent work <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
        </Button>
      </div>
    </div>
  );
}
