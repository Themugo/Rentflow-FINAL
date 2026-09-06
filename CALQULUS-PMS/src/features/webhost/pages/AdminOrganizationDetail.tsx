import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import WebhostLayout from "@/features/webhost/components/WebhostLayout";
import WebhostPermissionGate from "@/features/webhost/components/WebhostPermissionGate";
import { WEBHOST_ROUTES, webhostOrganizationPath } from "@/features/webhost/lib/webhostPaths";
import { Button } from "@/shared/components/ui/button";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { useAuth } from "@/features/auth/AuthContext";

type OrgDetail = {
  userId: string;
  email: string;
  fullName: string | null;
  status: string;
  tier: string | null;
  propertyCount: number;
  unitCount: number;
  lastActiveAt: string | null;
  createdAt: string;
  agencyName: string | null;
};

export default function AdminOrganizationDetail() {
  const { userId = "" } = useParams();
  const { hasWebhostPermission, isSuperAdmin, loading: authLoading } = useAuth();
  // WebhostPermissionGate below only hides the rendered DOM — it doesn't
  // stop this query from firing on mount. Without gating `enabled` here
  // too, a webhost admin lacking can_manage_managers could still pull this
  // org's email/subscription/usage data over the network (visible in the
  // query cache / network tab) even though the page renders nothing for
  // them.
  const canView = isSuperAdmin || hasWebhostPermission("can_manage_managers");

  const { data, isLoading, error } = useQuery<OrgDetail | null>({
    queryKey: ["platform-admin-org", userId],
    enabled: Boolean(userId) && !authLoading && canView,
    queryFn: async () => {
      const { data: role, error: roleError } = await supabase
        .from("user_roles")
        .select("user_id, created_at, approval_status")
        .eq("user_id", userId)
        .in("role", ["manager", "agency"])
        .maybeSingle();
      if (roleError) throw roleError;
      if (!role) return null;

      const [profileRes, mpRes, agencyRes] = await Promise.all([
        supabase.from("profiles").select("email, full_name").eq("id", userId).maybeSingle(),
        supabase
          .from("manager_profiles")
          .select("status, property_count, unit_count, subscription_tier, last_active_at")
          .eq("manager_user_id", userId)
          .maybeSingle(),
        supabase.from("agencies").select("name").eq("manager_id", userId).maybeSingle(),
      ]);

      const mp = mpRes.data as {
        status?: string;
        property_count?: number;
        unit_count?: number;
        subscription_tier?: string | null;
        last_active_at?: string | null;
      } | null;

      return {
        userId: role.user_id,
        email: (profileRes.data as { email?: string } | null)?.email ?? "",
        fullName: (profileRes.data as { full_name?: string | null } | null)?.full_name ?? null,
        status: mp?.status ?? role.approval_status,
        tier: mp?.subscription_tier ?? null,
        propertyCount: mp?.property_count ?? 0,
        unitCount: mp?.unit_count ?? 0,
        lastActiveAt: mp?.last_active_at ?? null,
        createdAt: role.created_at,
        agencyName: (agencyRes.data as { name?: string } | null)?.name ?? null,
      };
    },
  });

  return (
    <WebhostLayout
      title={data?.fullName || data?.email || "Organization"}
      description="Account status, usage, and subscription — no tenant records."
      actions={
        <Button variant="outline" size="sm" asChild>
          <Link to={WEBHOST_ROUTES.organizations}>
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            Organizations
          </Link>
        </Button>
      }
    >
      <WebhostPermissionGate permission="can_manage_managers">
      {isLoading ? (
        <Skeleton className="h-48 rounded-xl" />
      ) : error ? (
        <p className="text-sm text-destructive">Could not load this organization. You may not have access.</p>
      ) : !data ? (
        <p className="text-sm text-muted-foreground">No manager or agency account matches this id.</p>
      ) : (
        <div className="mx-auto max-w-xl space-y-4 rounded-xl border border-border bg-card p-5">
          <dl className="space-y-3 text-sm">
            {[
              ["Name", data.fullName || "—"],
              ["Email", data.email || "—"],
              ["Status", data.status.replace(/_/g, " ")],
              ["Tier", data.tier || "—"],
              ["Agency", data.agencyName || "—"],
              ["Properties", String(data.propertyCount)],
              ["Units", String(data.unitCount)],
              ["Created", format(new Date(data.createdAt), "d MMM yyyy")],
              ["Last active", data.lastActiveAt ? format(new Date(data.lastActiveAt), "d MMM yyyy HH:mm") : "—"],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between gap-4 border-b border-border pb-2 last:border-0">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="font-medium text-right">{value}</dd>
              </div>
            ))}
          </dl>
          <div className="flex flex-wrap gap-2 pt-2">
            <Button asChild>
              <Link to={WEBHOST_ROUTES.subscriptions}>Subscriptions</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to={webhostOrganizationPath(data.userId)}>Refresh</Link>
            </Button>
          </div>
        </div>
      )}
      </WebhostPermissionGate>
    </WebhostLayout>
  );
}
