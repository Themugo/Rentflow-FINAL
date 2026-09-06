import { useEffect, useState } from "react";
import { Wrench } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { EmptyState } from "@/shared/components/ui/empty-state";
import { ErrorState } from "@/shared/components/ui/error-state";
import { formatDate } from "@/shared/lib/dateFormat";
import { statusBadgeClass } from "@/shared/lib/statusBadge";
import { logError } from "@/shared/lib/errorLogger";
import { cn } from "@/shared/lib/utils";

interface TenantMaintenanceRequest {
  id: string;
  title: string;
  priority: string;
  status: string;
  requested_date: string;
}

interface TenantMaintenanceTabProps {
  tenantEmail: string;
}

const toneForStatus: Record<string, "success" | "warning" | "danger" | "info" | "neutral"> = {
  completed: "success",
  in_progress: "info",
  open: "warning",
  cancelled: "neutral",
};

/** Real maintenance requests logged against this tenant's email — no invented rows.
 * maintenance_requests has no tenant_id column, so tenant_email is the real join key
 * (matches how the table is actually populated). */
export function TenantMaintenanceTab({ tenantEmail }: TenantMaintenanceTabProps) {
  const [requests, setRequests] = useState<TenantMaintenanceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    supabase
      .from("maintenance_requests")
      .select("id, title, priority, status, requested_date")
      .eq("tenant_email", tenantEmail)
      .order("requested_date", { ascending: false })
      .limit(25)
      .then(({ data, error: err }) => {
        if (cancelled) return;
        if (err) {
          logError("TenantMaintenanceTab", err);
          setError(err.message || "Failed to load maintenance requests");
        } else {
          setRequests(data ?? []);
        }
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tenantEmail]);

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-md" />)}
      </div>
    );
  }

  if (error) {
    return <ErrorState title="Couldn't load maintenance requests" message={error} />;
  }

  if (requests.length === 0) {
    return (
      <EmptyState
        icon={Wrench}
        title="No maintenance requests"
        description="Repair and maintenance requests from this tenant will appear here."
      />
    );
  }

  return (
    <div className="divide-y divide-border rounded-lg border border-border overflow-hidden bg-card">
      {requests.map((request) => (
        <div key={request.id} className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{request.title}</p>
            <p className="text-xs text-muted-foreground">
              {formatDate(request.requested_date)} · <span className="capitalize">{request.priority}</span> priority
            </p>
          </div>
          <span className={cn("shrink-0", statusBadgeClass(toneForStatus[request.status] ?? "neutral"))}>
            {request.status.replace(/_/g, " ")}
          </span>
        </div>
      ))}
    </div>
  );
}
