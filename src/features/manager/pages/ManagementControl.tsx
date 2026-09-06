import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import ManagerLayout from "@/features/manager/components/ManagerLayout";
import { useManagerScope } from "@/shared/hooks/useManagerScope";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { Switch } from "@/shared/components/ui/switch";
import { Textarea } from "@/shared/components/ui/textarea";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { Badge } from "@/shared/components/ui/badge";
import { ErrorState } from "@/shared/components/ui/error-state";
import { toast } from "sonner";

interface PropertyLink { id: string; property_id: string; landlord_user_id: string; revenue_share_pct: number; notes: string | null; }
interface Property { id: string; name: string; address: string | null; }
interface Mandate { [key: string]: unknown; id: string; property_landlord_id: string; property_id: string; owner_user_id: string; }

type Draft = {
  client_type: string; display_name: string; client_reference: string;
  mandate_status: string; management_fee_model: string; management_fee_value: string;
  owner_controls_collections: boolean; owner_controls_financials: boolean; owner_controls_distributions: boolean;
  manager_can_collect: boolean; manager_can_approve_financials: boolean; manager_can_distribute: boolean;
  manager_can_manage_tenants: boolean; manager_can_manage_leases: boolean; manager_can_manage_maintenance: boolean;
  manager_can_manage_vendors: boolean; manager_can_communicate_with_tenants: boolean; manager_can_approve_operational_spend: boolean;
  operational_spend_limit: string; owner_approval_required_above_limit: boolean; owner_portal_enabled: boolean; owner_visibility: Record<string, boolean>; report_sections: Record<string, boolean>;
  reporting_frequency: string; reporting_delivery: string; notes: string;
};

const defaults: Draft = {
  client_type: "individual", display_name: "", client_reference: "", mandate_status: "active", management_fee_model: "flat_monthly", management_fee_value: "0",
  owner_controls_collections: true, owner_controls_financials: true, owner_controls_distributions: true,
  manager_can_collect: false, manager_can_approve_financials: false, manager_can_distribute: false,
  manager_can_manage_tenants: true, manager_can_manage_leases: true, manager_can_manage_maintenance: true, manager_can_manage_vendors: true,
  manager_can_communicate_with_tenants: true, manager_can_approve_operational_spend: true, operational_spend_limit: "0", owner_approval_required_above_limit: true,
  owner_portal_enabled: true,
  owner_visibility: { property: true, units: true, occupancy: true, tenants: true, maintenance: true, vendors: true, documents: true, contracts: true, leases: true, collections: true, financials: true, distributions: true },
  report_sections: { occupancy: true, tenant_service: true, maintenance: true, vendors: true, compliance: true, financial_summary: false, collections: false, distributions: false, documents: true },
  reporting_frequency: "monthly", reporting_delivery: "portal", notes: "",
};

export default function ManagementControl() {
  const { managerId } = useManagerScope();
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string>("");
  const [draft, setDraft] = useState<Draft>(defaults);
  const [saving, setSaving] = useState(false);

  const links = useQuery({
    queryKey: ["manager-management-links", managerId],
    queryFn: async () => {
      if (!managerId) return { links: [] as PropertyLink[], properties: [] as Property[], mandates: [] as Mandate[] };
      const [linksResult, propertiesResult, mandatesResult] = await Promise.all([
        supabase.from("property_landlords").select("id,property_id,landlord_user_id,revenue_share_pct,notes").eq("manager_id", managerId).order("created_at", { ascending: false }),
        supabase.from("properties").select("id,name,address").eq("manager_id", managerId).order("name"),
        supabase.from("manager_management_mandates" as never).select("*").eq("manager_id", managerId),
      ]);
      if (linksResult.error) throw linksResult.error;
      if (propertiesResult.error) throw propertiesResult.error;
      if (mandatesResult.error) throw mandatesResult.error;
      return { links: (linksResult.data ?? []) as PropertyLink[], properties: (propertiesResult.data ?? []) as Property[], mandates: (mandatesResult.data ?? []) as Mandate[] };
    },
    enabled: !!managerId,
  });

  const rows = useMemo(() => {
    const propertyMap = new Map((links.data?.properties ?? []).map((p) => [p.id, p]));
    return (links.data?.links ?? []).map((link) => ({ ...link, property: propertyMap.get(link.property_id), mandate: links.data?.mandates.find((m) => m.property_landlord_id === link.id) }));
  }, [links.data]);

  const selectRow = (id: string) => {
    const row = rows.find((r) => r.id === id);
    if (!row) return;
    setSelectedId(id);
    const m = row.mandate as Mandate | undefined;
    setDraft({
      ...defaults,
      client_type: "individual",
      display_name: "",
      client_reference: "",
      ...Object.fromEntries(Object.entries(m ?? {}).filter(([k]) => k in defaults).map(([k, v]) => [k, typeof v === "number" ? String(v) : v])) as Partial<Draft>,
      management_fee_value: String(m?.management_fee_value ?? 0),
      owner_visibility: (m?.owner_visibility as Record<string, boolean>) ?? defaults.owner_visibility,
      report_sections: (m?.report_sections as Record<string, boolean>) ?? defaults.report_sections,
      operational_spend_limit: String(m?.operational_spend_limit ?? 0),
    });
  };

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }));
  const setMap = (key: "owner_visibility" | "report_sections", name: string, value: boolean) => setDraft((d) => ({ ...d, [key]: { ...d[key], [name]: value } }));

  const save = async () => {
    if (!selectedId) return;
    const row = rows.find((r) => r.id === selectedId);
    if (!row) return;
    setSaving(true);
    try {
      const ownerPayload = { client_type: draft.client_type, display_name: draft.display_name || row.property?.name || "Owner", client_reference: draft.client_reference, notes: draft.notes };
      const ownerResult = await supabase.rpc("save_manager_owner_profile_atomic" as never, { p_owner_user_id: row.landlord_user_id, p_payload: ownerPayload });
      if (ownerResult.error) throw ownerResult.error;
      const mandatePayload = { ...draft, management_fee_value: Number(draft.management_fee_value) || 0, operational_spend_limit: Number(draft.operational_spend_limit) || 0 };
      const mandateResult = await supabase.rpc("save_manager_management_mandate_atomic" as never, { p_property_landlord_id: row.id, p_payload: mandatePayload });
      if (mandateResult.error) throw mandateResult.error;
      await queryClient.invalidateQueries({ queryKey: ["manager-management-links", managerId] });
      toast.success("Management mandate saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save management mandate");
    } finally { setSaving(false); }
  };

  return (
    <ManagerLayout title="Management control" description="Define what you operate, what the owner controls, what the owner sees, and how reporting works for every managed property.">
      {links.isError ? <ErrorState title="Couldn't load management relationships" onRetry={() => void links.refetch()} className="mb-6" /> : null}
      <div className="grid gap-6 lg:grid-cols-[minmax(280px,0.8fr)_minmax(0,1.8fr)]">
        <Card className="h-fit">
          <CardHeader><CardTitle>Managed relationships</CardTitle><CardDescription>Each property can have its own owner mandate.</CardDescription></CardHeader>
          <CardContent className="space-y-2">
            {links.isLoading ? Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-lg" />) : rows.length === 0 ? <p className="text-sm text-muted-foreground">Link an owner to a managed property first. Existing property and landlord flows remain the source of truth.</p> : rows.map((row) => {
              const m = row.mandate as Mandate | undefined;
              return <button key={row.id} type="button" onClick={() => selectRow(row.id)} className={`w-full rounded-xl border p-3 text-left transition-colors ${selectedId === row.id ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40"}`}>
                <div className="flex items-center justify-between gap-2"><span className="truncate font-medium">{row.property?.name ?? "Property"}</span><Badge variant="outline">{m ? String(m.mandate_status) : "Not configured"}</Badge></div>
                <p className="mt-1 text-xs text-muted-foreground">Owner account · {row.landlord_user_id.slice(0, 8)}…</p>
              </button>;
            })}
          </CardContent>
        </Card>

        <div className="space-y-6">
          {!selectedId ? <Card><CardContent className="py-16 text-center"><p className="font-medium">Select a managed property</p><p className="mt-1 text-sm text-muted-foreground">The configuration below applies to one owner relationship at a time.</p></CardContent></Card> : <>
            <Card><CardHeader><CardTitle>Client profile</CardTitle><CardDescription>Classify the owner without turning an independent manager into an agency.</CardDescription></CardHeader><CardContent className="grid gap-4 sm:grid-cols-2">
              <Field label="Client type"><Select value={draft.client_type} onValueChange={(v) => set("client_type", v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["individual","family","company","institution","staff_quarters","nonprofit","other"].map((v) => <SelectItem key={v} value={v}>{v.replaceAll("_", " ")}</SelectItem>)}</SelectContent></Select></Field>
              <Field label="Display name"><Input value={draft.display_name} onChange={(e) => set("display_name", e.target.value)} placeholder="Owner or institution name" /></Field>
              <Field label="Client reference"><Input value={draft.client_reference} onChange={(e) => set("client_reference", e.target.value)} placeholder="Internal reference" /></Field>
              <Field label="Management fee"><div className="flex gap-2"><Select value={draft.management_fee_model} onValueChange={(v) => set("management_fee_model", v)}><SelectTrigger className="w-[190px]"><SelectValue /></SelectTrigger><SelectContent>{["none","flat_monthly","percent_of_collections","flat_per_unit","custom"].map((v) => <SelectItem key={v} value={v}>{v.replaceAll("_", " ")}</SelectItem>)}</SelectContent></Select><Input type="number" min="0" value={draft.management_fee_value} onChange={(e) => set("management_fee_value", e.target.value)} /></div></Field>
            </CardContent></Card>

            <Card><CardHeader><CardTitle>Authority boundary</CardTitle><CardDescription>Default operating model: you run the property and occupants; the owner keeps collections, financial control and distributions.</CardDescription></CardHeader><CardContent className="grid gap-3 sm:grid-cols-2">
              <Toggle label="Owner controls collections" checked={draft.owner_controls_collections} onChange={(v) => set("owner_controls_collections", v)} />
              <Toggle label="Owner controls financials" checked={draft.owner_controls_financials} onChange={(v) => set("owner_controls_financials", v)} />
              <Toggle label="Owner controls distributions" checked={draft.owner_controls_distributions} onChange={(v) => set("owner_controls_distributions", v)} />
              <Toggle label="Manager can collect" checked={draft.manager_can_collect} onChange={(v) => set("manager_can_collect", v)} />
              <Toggle label="Manager can approve financials" checked={draft.manager_can_approve_financials} onChange={(v) => set("manager_can_approve_financials", v)} />
              <Toggle label="Manager can distribute" checked={draft.manager_can_distribute} onChange={(v) => set("manager_can_distribute", v)} />
            </CardContent></Card>

            <Card><CardHeader><CardTitle>Property operations</CardTitle><CardDescription>These controls define the manager-to-tenant and manager-to-provider operating relationship.</CardDescription></CardHeader><CardContent className="grid gap-3 sm:grid-cols-2">
              <Toggle label="Manage tenants" checked={draft.manager_can_manage_tenants} onChange={(v) => set("manager_can_manage_tenants", v)} />
              <Toggle label="Manage leases" checked={draft.manager_can_manage_leases} onChange={(v) => set("manager_can_manage_leases", v)} />
              <Toggle label="Manage maintenance" checked={draft.manager_can_manage_maintenance} onChange={(v) => set("manager_can_manage_maintenance", v)} />
              <Toggle label="Manage external providers" checked={draft.manager_can_manage_vendors} onChange={(v) => set("manager_can_manage_vendors", v)} />
              <Toggle label="Communicate with tenants" checked={draft.manager_can_communicate_with_tenants} onChange={(v) => set("manager_can_communicate_with_tenants", v)} />
              <Toggle label="Approve operational spend" checked={draft.manager_can_approve_operational_spend} onChange={(v) => set("manager_can_approve_operational_spend", v)} />
              <Field label="Operational spend limit"><Input type="number" min="0" value={draft.operational_spend_limit} onChange={(e) => set("operational_spend_limit", e.target.value)} /></Field>
              <Toggle label="Owner approval above limit" checked={draft.owner_approval_required_above_limit} onChange={(v) => set("owner_approval_required_above_limit", v)} />
            </CardContent></Card>

            <Card><CardHeader><CardTitle>Owner portal & reporting</CardTitle><CardDescription>Give each owner the right level of visibility and a predictable reporting relationship.</CardDescription></CardHeader><CardContent className="grid gap-4 sm:grid-cols-2">
              <Toggle label="Owner portal enabled" checked={draft.owner_portal_enabled} onChange={(v) => set("owner_portal_enabled", v)} />
              <div className="sm:col-span-2 rounded-xl border border-border p-4"><p className="text-sm font-semibold">Owner visibility</p><p className="mt-1 text-xs text-muted-foreground">Choose what the owner can see in their existing Landlord portal for this managed property.</p><div className="mt-3 grid gap-2 sm:grid-cols-2">{["property","units","occupancy","tenants","maintenance","vendors","documents","contracts","leases","collections","financials","distributions"].map((key) => <Toggle key={key} label={key.replaceAll("_", " ")} checked={draft.owner_visibility[key] ?? false} onChange={(v) => setMap("owner_visibility", key, v)} />)}</div></div>
              <Field label="Reporting frequency"><Select value={draft.reporting_frequency} onValueChange={(v) => set("reporting_frequency", v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["none","exception_only","weekly","monthly","quarterly"].map((v) => <SelectItem key={v} value={v}>{v.replaceAll("_", " ")}</SelectItem>)}</SelectContent></Select></Field>
              <Field label="Reporting delivery"><Select value={draft.reporting_delivery} onValueChange={(v) => set("reporting_delivery", v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["portal","email","portal_and_email"].map((v) => <SelectItem key={v} value={v}>{v.replaceAll("_", " + ")}</SelectItem>)}</SelectContent></Select></Field>
              <div className="sm:col-span-2 rounded-xl border border-border p-4"><p className="text-sm font-semibold">Report sections</p><p className="mt-1 text-xs text-muted-foreground">Control the content of scheduled owner reports without creating another reporting engine.</p><div className="mt-3 grid gap-2 sm:grid-cols-2">{["occupancy","tenant_service","maintenance","vendors","compliance","financial_summary","collections","distributions","documents"].map((key) => <Toggle key={key} label={key.replaceAll("_", " ")} checked={draft.report_sections[key] ?? false} onChange={(v) => setMap("report_sections", key, v)} />)}</div></div>
              <div className="sm:col-span-2"><Label>Relationship notes</Label><Textarea className="mt-2" value={draft.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Special approvals, institution rules, escalation contacts, reporting notes…" /></div>
            </CardContent></Card>

            <div className="flex justify-end"><Button onClick={() => void save()} disabled={saving}>{saving ? "Saving…" : "Save management mandate"}</Button></div>
          </>}
        </div>
      </div>
    </ManagerLayout>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div><Label>{label}</Label><div className="mt-2">{children}</div></div>; }
function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) { return <div className="flex min-h-11 items-center justify-between gap-4 rounded-lg border border-border px-3 py-2.5"><span className="text-sm font-medium">{label}</span><Switch checked={checked} onCheckedChange={onChange} /></div>; }
