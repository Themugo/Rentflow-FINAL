import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/features/auth/AuthContext";
import LandlordLayout from "@/features/landlord/components/LandlordLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Textarea } from "@/shared/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/shared/components/ui/dialog";
import { EmptyState } from "@/shared/components/ui/empty-state";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { Handshake, ShieldCheck, WalletCards, Eye, FileBarChart, Send } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface Row {
  link_id: string; property_id: string; property_name: string; address: string | null;
  manager_id: string | null; manager_name: string | null; manager_email: string | null;
  operating_model: string; payment_destination: string | null; revenue_share_pct: number;
  management_fee_pct: number | null; mandate_status: string | null;
  owner_controls_collections: boolean | null; owner_controls_financials: boolean | null; owner_controls_distributions: boolean | null;
  manager_can_collect: boolean | null; manager_can_approve_financials: boolean | null; manager_can_distribute: boolean | null;
  owner_portal_enabled: boolean; owner_visibility: Record<string, boolean>; reporting_frequency: string; reporting_delivery: string;
}

const label = (value: string) => value.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());

export default function LandlordManagement() {
  const { user, userRole } = useAuth();
  const qc = useQueryClient();
  const [request, setRequest] = useState<{ propertyId: string; title: string; change: string } | null>(null);
  const [reason, setReason] = useState("");
  const enabled = Boolean(user?.id) && userRole?.role === "landlord";
  const query = useQuery({
    queryKey: ["landlord-management-overview", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_landlord_management_overview" as never);
      if (error) throw error;
      return (data ?? []) as Row[];
    }, enabled,
  });
  const submit = useMutation({
    mutationFn: async () => {
      if (!request) return;
      const { error } = await supabase.rpc("create_landlord_management_change_request_atomic" as never, {
        p_property_id: request.propertyId,
        p_requested_change: request.change,
        p_requested_value: { requested: request.title },
        p_reason: reason,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Management request submitted"); setRequest(null); setReason(""); qc.invalidateQueries({ queryKey: ["landlord-management-overview"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return <LandlordLayout title="Management" description="See who operates each property, who controls money, what you can see, and how owner reporting is configured.">
    {query.isLoading ? <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-36 w-full" />)}</div> : null}
    {query.isError ? <Card><CardContent className="py-10 text-center text-sm text-destructive">Could not load management arrangements. Please retry.</CardContent></Card> : null}
    {!query.isLoading && !query.isError && query.data?.length === 0 ? <EmptyState icon={Handshake} title="No managed properties yet" description="Properties linked to your ownership account will appear here." /> : null}
    <div className="space-y-4">
      {query.data?.map((r) => {
        const ownerMoney = [r.owner_controls_collections, r.owner_controls_financials, r.owner_controls_distributions].filter(Boolean).length;
        const managerOps = [r.manager_can_collect, r.manager_can_approve_financials, r.manager_can_distribute].filter(Boolean).length;
        return <Card key={r.link_id} className="overflow-hidden">
          <CardHeader className="pb-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div><CardTitle className="text-base">{r.property_name}</CardTitle><CardDescription>{r.address || "Address not provided"}</CardDescription></div>
              <Badge variant="outline" className="w-fit capitalize">{label(r.operating_model)}</Badge>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 lg:grid-cols-4">
            <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Operator</p><p className="mt-1 font-medium">{r.manager_name || "Owner / self-managed"}</p><p className="text-xs text-muted-foreground">{r.manager_email || "No external manager"}</p></div>
            <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Money authority</p><p className="mt-1 font-medium">{ownerMoney === 3 ? "Owner controls finance" : managerOps > 0 ? "Shared / delegated" : "Owner controlled"}</p><p className="text-xs text-muted-foreground">Collections: {r.owner_controls_collections ? "owner" : r.manager_can_collect ? "manager" : "not delegated"}</p></div>
            <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Owner portal</p><p className="mt-1 font-medium flex items-center gap-1"><Eye className="h-3.5 w-3.5" />{r.owner_portal_enabled ? "Enabled" : "Disabled"}</p><p className="text-xs text-muted-foreground">Reporting: {label(r.reporting_frequency)} · {label(r.reporting_delivery)}</p></div>
            <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Financial destination</p><p className="mt-1 font-medium flex items-center gap-1"><WalletCards className="h-3.5 w-3.5" />{label(r.payment_destination || "not configured")}</p><p className="text-xs text-muted-foreground">Owner share: {r.revenue_share_pct}%</p></div>
            <div className="lg:col-span-4 flex flex-wrap gap-2 text-xs">
              <Badge variant="secondary"><ShieldCheck className="mr-1 h-3 w-3" /> Tenant operations remain governed by the operating relationship</Badge>
              <Badge variant="secondary"><FileBarChart className="mr-1 h-3 w-3" /> Reports: {label(r.reporting_frequency)}</Badge>
              {r.mandate_status && <Badge variant="outline">Mandate: {label(r.mandate_status)}</Badge>}
            </div>
            <div className="lg:col-span-4 flex flex-wrap gap-2 border-t pt-3">
              <Button variant="outline" size="sm" onClick={() => setRequest({ propertyId: r.property_id, title: "Request a management/control review", change: "change_financial_control" })}>Request control review</Button>
              <Button variant="outline" size="sm" onClick={() => setRequest({ propertyId: r.property_id, title: "Request reporting/visibility change", change: "change_owner_visibility" })}>Request visibility/reporting change</Button>
            </div>
          </CardContent>
        </Card>;
      })}
    </div>
    <Dialog open={!!request} onOpenChange={(open) => !open && setRequest(null)}>
      <DialogContent><DialogHeader><DialogTitle>{request?.title}</DialogTitle><DialogDescription>Requests do not silently change ownership, collections or financial authority. They enter the existing management workflow for review.</DialogDescription></DialogHeader>
        <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Explain what you need changed and why…" rows={5} />
        <DialogFooter><Button variant="outline" onClick={() => setRequest(null)}>Cancel</Button><Button disabled={submit.isPending} onClick={() => submit.mutate()}><Send className="mr-2 h-4 w-4" />{submit.isPending ? "Submitting…" : "Submit request"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </LandlordLayout>;
}
