import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import WebhostLayout from "@/features/webhost/components/WebhostLayout";
import WebhostManagement from "@/features/webhost/components/WebhostManagement";

export default function AdminUsers() {
  const { data: counts, isLoading } = useQuery({
    queryKey: ["platform-admin-user-role-counts"],
    queryFn: async () => {
      const roles = ["webhost", "manager", "agency", "landlord", "submanager"] as const;
      const rows = await Promise.all(
        roles.map(async (role) => {
          const { count } = await supabase.from("user_roles").select("id", { count: "exact", head: true }).eq("role", role);
          return [role, count ?? 0] as const;
        }),
      );
      return Object.fromEntries(rows) as Record<(typeof roles)[number], number>;
    },
  });

  return (
    <WebhostLayout
      title="Users"
      description="Master user registry for every non-tenant account. Tenant accounts are intentionally excluded from this control room."
    >
      <div className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-5">
        {(
          [
            ["webhost", "Admins"],
            ["manager", "Managers"],
            ["agency", "Agency"],
            ["landlord", "Landlords"],
            ["submanager", "Submanagers"],
          ] as const
        ).map(([key, label]) => (
          <div key={key} className="rounded-xl border border-border bg-card p-3">
            <p className="type-label">{label}</p>
            <p className="mt-1 font-heading text-lg font-semibold">{isLoading ? "…" : counts?.[key] ?? 0}</p>
          </div>
        ))}
      </div>
      <WebhostManagement />
    </WebhostLayout>
  );
}
