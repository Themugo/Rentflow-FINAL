import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import WebhostLayout from "@/features/webhost/components/WebhostLayout";
import WebhostPermissionGate from "@/features/webhost/components/WebhostPermissionGate";
import WebhostAccountSecurity from "@/features/webhost/components/WebhostAccountSecurity";
import { groupSecurityEvents } from "@/features/webhost/lib/adminSecurity";
import { WEBHOST_OPS_ROUTES } from "@/features/webhost/lib/webhostPaths";

type LogRow = {
  id: string;
  action: string;
  actor_email: string | null;
  entity_type: string | null;
  created_at: string;
};

function EventList({ title, empty, rows }: { title: string; empty: string; rows: LogRow[] }) {
  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <h2 className="section-title mb-3">{title}</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="divide-y divide-border">
          {rows.slice(0, 12).map((row) => (
            <li key={row.id} className="py-2">
              <p className="text-sm font-medium">{row.action}</p>
              <p className="text-xs text-muted-foreground">
                {row.actor_email || "system"} · {format(new Date(row.created_at), "d MMM yyyy HH:mm")}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function AdminSecurity() {
  const { data: logs = [] } = useQuery<LogRow[]>({
    queryKey: ["platform-admin-security-events"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activity_logs")
        .select("id, action, actor_email, entity_type, created_at")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as LogRow[];
    },
  });

  const { authEvents, failedLogins, permissionEvents } = groupSecurityEvents(logs);

  return (
    <WebhostLayout
      title="Security"
      description="Admin access, authentication events from the audit log, and operational alerts. No invented fraud scores."
    >
      <WebhostPermissionGate permission="can_view_activity_logs">
        <div className="space-y-6">
          <WebhostAccountSecurity />
          <div className="grid gap-4 lg:grid-cols-3">
            <EventList
              title="Authentication events"
              empty="No login or session events in the latest audit window."
              rows={authEvents}
            />
            <EventList
              title="Failed logins"
              empty="No failed-login events in the audit log. There is no separate failed-login table."
              rows={failedLogins}
            />
            <EventList
              title="Permission events"
              empty="No permission or admin-hierarchy events in the latest audit window."
              rows={permissionEvents}
            />
          </div>
          <p className="text-sm text-muted-foreground">
            Operational error alerts live on{" "}
            <Link className="text-primary hover:underline" to={WEBHOST_OPS_ROUTES.issues}>
              Issues
            </Link>
            . This page does not invent fraud or threat scores.
          </p>
        </div>
      </WebhostPermissionGate>
    </WebhostLayout>
  );
}
