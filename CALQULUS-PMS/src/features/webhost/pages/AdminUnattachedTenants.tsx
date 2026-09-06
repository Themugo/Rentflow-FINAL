import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import WebhostLayout from "@/features/webhost/components/WebhostLayout";
import WebhostPermissionGate from "@/features/webhost/components/WebhostPermissionGate";
import { Button } from "@/shared/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/shared/components/ui/table";
import { Badge } from "@/shared/components/ui/badge";
import { useToast } from "@/shared/hooks/use-toast";
import {
  UnattachedTenant,
  summarizeQueue,
  unattachedReason,
  UNATTACHED_REASON_LABEL,
  UNATTACHED_REASON_DESCRIPTION,
} from "@/features/webhost/lib/unattachedTenants";

/**
 * Unattached Tenants — the System Admin / Webhost recovery boundary.
 *
 * This is the ONLY tenant surface available to platform operators (owner,
 * business, or a System Admin granted can_read_unattached_tenants). It is
 * strictly for accounts with no valid property/organization relationship
 * (tenants.manager_id IS NULL OR property_id/unit_id missing). Normal
 * tenant operations, billing, leases, maintenance and PII browsing are NOT
 * part of this surface — the rows are recovered only so the account can be
 * re-attached to its authorized manager, after which it leaves this queue.
 *
 * Server-side enforcement lives in list_unattached_tenants /
 * resolve_unattached_tenant (SECURITY DEFINER). This page only renders what
 * those RPCs return; it never reads the tenants table directly.
 */
export default function AdminUnattachedTenants() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: rows = [], isLoading, error } = useQuery<UnattachedTenant[]>({
    queryKey: ["platform-admin-unattached-tenants"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("list_unattached_tenants");
      if (error) throw error;
      return (data ?? []) as UnattachedTenant[];
    },
  });

  const resolve = useMutation({
    mutationFn: async (t: UnattachedTenant) => {
      // Re-attach the account to its manager (identity via the tenant row).
      // manager_id is the operating manager; property/unit are the record's
      // existing links. Operator must choose the manager before this runs.
      const { error } = await supabase.rpc("resolve_unattached_tenant", {
        p_tenant_id: t.tenant_id,
        p_manager_id: t.manager_id,
        p_property_id: t.property_id,
        p_unit_id: t.unit_id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Tenant re-attached", description: "The record left the unattached queue." });
      queryClient.invalidateQueries({ queryKey: ["platform-admin-unattached-tenants"] });
    },
    onError: (err) => {
      toast({ title: "Could not resolve", description: err instanceof Error ? err.message : "Unknown error" });
    },
  });

  const summary = summarizeQueue(rows);

  return (
    <WebhostLayout
      title="Unattached tenants"
      description="Platform-level recovery for accounts with no valid property relationship."
    >
      <WebhostPermissionGate permission="can_manage_managers">
        <section className="rounded-xl border border-border bg-card p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="section-title">Recovery queue</h2>
              <p className="text-sm text-muted-foreground">
                {summary.hasQueue
                  ? `${summary.total} account(s) waiting for an authorized property relationship.`
                  : "All accounts are attached. No recovery action needed."}
              </p>
            </div>
            <Badge variant="outline" className="border-border text-muted-foreground">
              {summary.total} unattached
            </Badge>
          </div>

          {isLoading ? (
            <p className="mt-4 text-sm text-muted-foreground">Loading recovery queue…</p>
          ) : error ? (
            <p className="mt-4 text-sm text-destructive">
              Could not load the recovery queue. You need platform operator access.
            </p>
          ) : rows.length === 0 ? (
            <div className="mt-4 rounded-lg border border-border bg-muted/40 p-6 text-center">
              <p className="text-sm font-medium text-muted-foreground">All clear</p>
              <p className="mt-1 text-sm text-muted-foreground">
                No unattached tenants currently require recovery.
              </p>
            </div>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <TableHead>Tenant</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Explanation</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.map((row) => {
                    const reason = unattachedReason(row);
                    return (
                      <TableRow key={row.tenant_id}>
                        <TableCell className="font-medium">{row.tenant_name}</TableCell>
                        <TableCell className="font-mono text-xs">{UNATTACHED_REASON_LABEL[reason]}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {UNATTACHED_REASON_DESCRIPTION[reason]}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="border-border text-muted-foreground">
                            {row.status ?? "unattached"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={!row.manager_id}
                            onClick={() => resolve.mutate(row)}
                            title={row.manager_id ? "Re-attach to the record's manager" : "No manager to attach"}
                          >
                            Resolve
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </WebhostPermissionGate>
    </WebhostLayout>
  );
}