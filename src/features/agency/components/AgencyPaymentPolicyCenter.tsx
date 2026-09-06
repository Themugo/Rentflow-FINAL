import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BellRing, CalendarDays, CheckCircle2, CreditCard, LockKeyhole, Megaphone, RefreshCw, Save, ShieldCheck, SlidersHorizontal, UserCheck, UsersRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { Switch } from "@/shared/components/ui/switch";
import { Checkbox } from "@/shared/components/ui/checkbox";
import { Textarea } from "@/shared/components/ui/textarea";
import { Badge } from "@/shared/components/ui/badge";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/shared/components/ui/alert";
import { useToast } from "@/shared/hooks/use-toast";
import AgencyPaymentRoutingPanel from "@/features/billing/components/AgencyPaymentRoutingPanel";
import PaymentCollectionRoutingPanel from "@/features/billing/components/PaymentCollectionRoutingPanel";
import { useAgencyOperationsConfig } from "@/features/agency/lib/useAgencyOperationsConfig";

const METHODS = [
  ["mpesa_paybill", "M-Pesa Paybill"],
  ["mpesa_till", "M-Pesa Till"],
  ["bank_transfer", "Bank transfer"],
  ["cash", "Cash / office"],
] as const;

const DESTINATIONS = [
  ["agency", "Agency collects"],
  ["landlord", "Landlord collects"],
  ["tenant_direct", "Direct to nominated party"],
  ["external", "External / outside source"],
  ["split", "Split collection"],
] as const;

const CHARGE_COMPONENTS = [
  ["rent", "Rent"], ["water", "Water"], ["security", "Security"], ["garbage", "Garbage"],
  ["service_charge", "Service charge"], ["parking", "Parking"], ["maintenance", "Maintenance"], ["other", "Other"],
] as const;

const SCOPE_COPY = {
  agency: "Fallback payment behaviour for the Agency book. Property and unit policies override it where configured.",
  property: "One property-wide rule for all active and future tenancies in this property, unless a unit rule overrides it.",
  unit: "The most specific rule. Use it for unit-level exceptions without rewriting the property's general payment behaviour.",
} as const;

type ScopeType = keyof typeof SCOPE_COPY;
type Candidate = { tenant_id: string; tenant_name: string; property_id: string | null; property_name: string | null; unit_id: string | null; unit_number: string | null };
type Policy = { id: string; agency_id: string; scope_type: ScopeType; property_id: string | null; unit_id: string | null; policy_name: string; status: string; version: number; effective_from: string; effective_to: string | null; config: Record<string, unknown>; tenant_visible: boolean; tenant_notice_title: string | null; tenant_notice_body: string | null; updated_at: string };

function defaultsConfig() {
  return {
    allowed_payment_methods: ["mpesa_paybill", "mpesa_till", "bank_transfer", "cash"],
    collection_destination: "agency",
    allow_partial_payments: true,
    allow_third_party_payers: true,
    manual_payment_enabled: true,
    manual_payment_requires_approval: true,
    proof_required_for_manual: true,
    allow_external_consolidation: true,
    payment_reference_required: false,
    reminder_before_days: 3,
    overdue_reminder_interval_days: 3,
    late_fee_type: "none",
    late_fee_value: 0,
    agency_split_percent: 100,
    tenant_visible: true,
    charge_components: ["rent", "water", "security", "garbage", "service_charge", "parking", "maintenance", "other"],
  } satisfies Record<string, unknown>;
}

function asBool(v: unknown, fallback: boolean) { return typeof v === "boolean" ? v : fallback; }
function asNumber(v: unknown, fallback: number) { const n = Number(v); return Number.isFinite(n) ? n : fallback; }
function asArray(v: unknown, fallback: string[]) { return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : fallback; }

export default function AgencyPaymentPolicyCenter() {
  const { data: operations } = useAgencyOperationsConfig();
  const agencyId = operations?.agency_id;
  const canManage = Boolean(operations?.viewer?.is_admin || operations?.viewer?.can_manage_billing_rules);
  const { toast } = useToast();
  const qc = useQueryClient();

  const [scope, setScope] = useState<ScopeType>("agency");
  const [propertyId, setPropertyId] = useState("");
  const [unitId, setUnitId] = useState("");
  const [policyName, setPolicyName] = useState("Agency payment policy");
  const [effectiveFrom, setEffectiveFrom] = useState(new Date().toISOString().slice(0, 10));
  const [effectiveTo, setEffectiveTo] = useState("");
  const [config, setConfig] = useState<Record<string, unknown>>(defaultsConfig());
  const [noticeMode, setNoticeMode] = useState<"selected" | "global" | "none">("none");
  const [selectedTenants, setSelectedTenants] = useState<string[]>([]);
  const [noticeTitle, setNoticeTitle] = useState("");
  const [noticeBody, setNoticeBody] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  const { data: optionsData, isLoading: optionsLoading } = useQuery({
    queryKey: ["agency-payment-policy-options", agencyId], enabled: Boolean(agencyId),
    queryFn: async () => { const { data, error } = await supabase.rpc("get_agency_payment_policy_options" as any, { p_agency_id: agencyId }); if (error) throw error; return (data ?? { properties: [], units: [] }) as { properties: Array<{ id: string; name: string; address: string | null }>; units: Array<{ id: string; property_id: string; unit_number: string; property_name: string }> }; },
  });
  const { data: policies = [], isLoading: policiesLoading, refetch: refetchPolicies } = useQuery({
    queryKey: ["agency-payment-policies", agencyId], enabled: Boolean(agencyId),
    queryFn: async () => { const { data, error } = await (supabase as any).from("agency_payment_policies").select("id,agency_id,scope_type,property_id,unit_id,policy_name,status,version,effective_from,effective_to,config,tenant_visible,tenant_notice_title,tenant_notice_body,updated_at").eq("agency_id", agencyId!).order("updated_at", { ascending: false }).limit(250); if (error) throw error; return (data ?? []) as Policy[]; },
  });
  const { data: candidates = [], isLoading: candidatesLoading } = useQuery({
    queryKey: ["agency-payment-policy-candidates", agencyId, scope, propertyId, unitId], enabled: Boolean(agencyId && canManage),
    queryFn: async () => { const { data, error } = await supabase.rpc("get_agency_payment_policy_notice_candidates" as any, { p_agency_id: agencyId, p_scope_type: scope, p_property_id: scope === "agency" ? null : propertyId || null, p_unit_id: scope === "unit" ? unitId || null : null }); if (error) throw error; return (data ?? []) as Candidate[]; },
  });
  const { data: noticeCampaigns = [] } = useQuery({
    queryKey: ["agency-payment-policy-campaigns", agencyId], enabled: Boolean(agencyId),
    queryFn: async () => { const { data, error } = await (supabase as any).from("agency_payment_policy_notice_campaigns").select("id,policy_id,audience_mode,title,body,recipient_count,sent_by,created_at").eq("agency_id", agencyId!).order("created_at", { ascending: false }).limit(20); if (error) throw error; return (data ?? []) as Array<{ id: string; policy_id: string | null; audience_mode: string; title: string; body: string; recipient_count: number; sent_by: string; created_at: string }>; },
  });

  const selectedProperty = optionsData?.properties.find((p) => p.id === propertyId);
  const selectedUnit = optionsData?.units.find((u) => u.id === unitId);

  useEffect(() => {
    if (scope === "agency") { setPropertyId(""); setUnitId(""); }
    if (scope === "property") setUnitId("");
  }, [scope]);
  useEffect(() => {
    if (scope === "unit" && selectedUnit && selectedUnit.property_id !== propertyId) setPropertyId(selectedUnit.property_id);
  }, [scope, selectedUnit, propertyId]);

  const loadPolicy = (policy: Policy) => {
    setEditingId(policy.status === "scheduled" ? policy.id : null);
    setScope(policy.scope_type); setPropertyId(policy.property_id ?? ""); setUnitId(policy.unit_id ?? ""); setPolicyName(policy.policy_name);
    setEffectiveFrom(policy.effective_from); setEffectiveTo(policy.effective_to ?? ""); setConfig({ ...defaultsConfig(), ...(policy.config ?? {}) });
    setNoticeTitle(policy.tenant_notice_title ?? ""); setNoticeBody(policy.tenant_notice_body ?? ""); setSelectedTenants([]); setNoticeMode("none");
  };
  const setC = (key: string, value: unknown) => setConfig((prev) => ({ ...prev, [key]: value }));
  const toggleMethod = (method: string, checked: boolean) => setC("allowed_payment_methods", checked ? Array.from(new Set([...asArray(config.allowed_payment_methods, []), method])) : asArray(config.allowed_payment_methods, []).filter((x) => x !== method));

  const savePolicy = useMutation({
    mutationFn: async () => {
      if (!agencyId) throw new Error("Agency not found");
      if (!canManage) throw new Error("Billing-rule permission required");
      if (scope !== "agency" && !propertyId) throw new Error("Select a property");
      if (scope === "unit" && !unitId) throw new Error("Select a unit");
      const payload = { policy_name: policyName, effective_from: effectiveFrom, effective_to: effectiveTo || null, config: { ...config, tenant_visible: asBool(config.tenant_visible, true) }, tenant_notice_title: noticeTitle || null, tenant_notice_body: noticeBody || null };
      const { data, error } = await supabase.rpc("save_agency_payment_policy_atomic" as any, {
        p_policy_id: editingId,
        p_agency_id: agencyId,
        p_scope_type: scope,
        p_property_id: scope === "agency" ? null : propertyId || null,
        p_unit_id: scope === "unit" ? unitId || null : null,
        p_payload: payload,
        p_notice_mode: noticeMode,
        p_notice_tenant_ids: noticeMode === "selected" ? selectedTenants : [],
        p_notice_title: noticeTitle || null,
        p_notice_body: noticeBody || null,
      });
      if (error) throw error;
      return data as { recipient_count?: number; notified?: boolean };
    },
    onSuccess: async (result) => {
      toast({ title: "Payment policy saved", description: result?.notified ? `Saved and communicated to ${result.recipient_count ?? 0} tenant(s).` : "The rule is saved. No tenant notice was required for this scope." });
      setEditingId(null); await qc.invalidateQueries({ queryKey: ["agency-payment-policies", agencyId] }); await qc.invalidateQueries({ queryKey: ["agency-payment-policy-campaigns", agencyId] }); await qc.invalidateQueries({ queryKey: ["tenant-effective-agency-payment-policy"] }); await refetchPolicies();
    },
    onError: (error: Error) => toast({ title: "Could not save payment policy", description: error.message, variant: "destructive" }),
  });

  if (!agencyId) return <Alert><LockKeyhole className="h-4 w-4"/><AlertTitle>Agency context unavailable</AlertTitle><AlertDescription>Sign in with an Agency account before configuring payment policies.</AlertDescription></Alert>;
  if (!canManage) return <Alert><ShieldCheck className="h-4 w-4"/><AlertTitle>Read-only</AlertTitle><AlertDescription>Your Agency account does not have the billing-rule permission required to change payment policies.</AlertDescription></Alert>;

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader className="pb-3"><div className="flex flex-wrap items-start justify-between gap-3"><div className="flex items-start gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/5 text-primary"><SlidersHorizontal className="h-5 w-5"/></div><div><CardTitle>Payment rules & tenant-facing settings</CardTitle><CardDescription className="mt-1 max-w-3xl">Configure the rule once at Agency level, narrow it to a property, or make a unit-level exception. Actual payment destinations remain on the canonical payment-routing records.</CardDescription></div></div><Badge variant="outline">Precedence · Unit → Property → Agency</Badge></div></CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-3 md:grid-cols-3">
            {(["agency","property","unit"] as ScopeType[]).map((item) => <button key={item} type="button" onClick={() => setScope(item)} className={`rounded-xl border p-4 text-left transition ${scope === item ? "border-primary bg-primary/5 shadow-sm" : "border-border bg-background hover:bg-muted/30"}`}><div className="flex items-center justify-between"><span className="text-xs font-bold uppercase tracking-wide text-primary">{item}</span>{scope === item ? <CheckCircle2 className="h-4 w-4 text-primary"/> : null}</div><p className="mt-2 text-sm font-semibold">{item === "agency" ? "Agency-wide" : item === "property" ? "Property-wide" : "Unit exception"}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{SCOPE_COPY[item]}</p></button>)}
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {scope !== "agency" ? <div className="space-y-1.5"><Label>Property</Label><Select value={propertyId} onValueChange={setPropertyId}><SelectTrigger><SelectValue placeholder={optionsLoading ? "Loading properties…" : "Select property"}/></SelectTrigger><SelectContent>{(optionsData?.properties ?? []).map((p) => <SelectItem key={p.id} value={p.id}>{p.name}{p.address ? ` · ${p.address}` : ""}</SelectItem>)}</SelectContent></Select></div> : null}
            {scope === "unit" ? <div className="space-y-1.5"><Label>Unit</Label><Select value={unitId} onValueChange={(value) => { setUnitId(value); const unit = optionsData?.units.find((u) => u.id === value); if (unit) setPropertyId(unit.property_id); }} disabled={!propertyId}><SelectTrigger><SelectValue placeholder={propertyId ? "Select unit" : "Select property first"}/></SelectTrigger><SelectContent>{(optionsData?.units ?? []).filter((u) => u.property_id === propertyId).map((u) => <SelectItem key={u.id} value={u.id}>{u.property_name} · Unit {u.unit_number}</SelectItem>)}</SelectContent></Select></div> : null}
            <div className="space-y-1.5"><Label>Policy name</Label><Input value={policyName} onChange={(e) => setPolicyName(e.target.value)} placeholder="e.g. Riverside resident payment rules"/></div>
            <div className="space-y-1.5"><Label>Effective from</Label><div className="relative"><CalendarDays className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground"/><Input className="pl-9" type="date" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)}/></div></div>
            <div className="space-y-1.5"><Label>Effective to <span className="font-normal text-muted-foreground">(optional)</span></Label><Input type="date" value={effectiveTo} min={effectiveFrom} onChange={(e) => setEffectiveTo(e.target.value)}/></div>
          </div>

          <section className="rounded-2xl border border-border bg-background p-4 space-y-4">
            <div><h3 className="text-sm font-semibold">Allowed payment methods</h3><p className="mt-1 text-xs text-muted-foreground">Only these methods are accepted by the Agency evidence workflow for this scope.</p></div>
            <div className="grid gap-2 sm:grid-cols-2">{METHODS.map(([id,label]) => <label key={id} className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5 text-sm"><Checkbox checked={asArray(config.allowed_payment_methods, []).includes(id)} onCheckedChange={(checked) => toggleMethod(id, Boolean(checked))}/><span>{label}</span></label>)}</div>
          </section>

          <section className="grid gap-3 lg:grid-cols-2">
            <Card className="border-border shadow-none"><CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><CreditCard className="h-4 w-4 text-primary"/>Collection & allocation</CardTitle></CardHeader><CardContent className="space-y-3"><div className="space-y-1.5"><Label>Collection destination</Label><Select value={String(config.collection_destination ?? "agency")} onValueChange={(value) => setC("collection_destination", value)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{DESTINATIONS.map(([id,label]) => <SelectItem key={id} value={id}>{label}</SelectItem>)}</SelectContent></Select></div><label className="flex items-center justify-between gap-4 rounded-lg border border-border px-3 py-2.5 text-sm"><span>Allow partial payments</span><Switch checked={asBool(config.allow_partial_payments,true)} onCheckedChange={(v) => setC("allow_partial_payments",v)}/></label><label className="flex items-center justify-between gap-4 rounded-lg border border-border px-3 py-2.5 text-sm"><span>Auto-allocate rent</span><Switch checked={true} disabled/><Badge variant="secondary">Existing flow</Badge></label><label className="flex items-center justify-between gap-4 rounded-lg border border-border px-3 py-2.5 text-sm"><span>Allow third-party payers</span><Switch checked={asBool(config.allow_third_party_payers,true)} onCheckedChange={(v) => setC("allow_third_party_payers",v)}/></label>{config.collection_destination === "split" ? <div className="space-y-1.5"><Label>Agency share (%)</Label><Input type="number" min="0" max="100" step="0.01" value={String(asNumber(config.agency_split_percent,100))} onChange={(e) => setC("agency_split_percent",Number(e.target.value))}/></div> : null}</CardContent></Card>
            <Card className="border-border shadow-none"><CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><UserCheck className="h-4 w-4 text-primary"/>Manual & outside payments</CardTitle></CardHeader><CardContent className="space-y-3"><label className="flex items-center justify-between gap-4 rounded-lg border border-border px-3 py-2.5 text-sm"><span>Manual/outside payments enabled</span><Switch checked={asBool(config.manual_payment_enabled,true)} onCheckedChange={(v) => setC("manual_payment_enabled",v)}/></label><label className="flex items-center justify-between gap-4 rounded-lg border border-border px-3 py-2.5 text-sm"><span>Manual payments require approval</span><Switch checked={asBool(config.manual_payment_requires_approval,true)} onCheckedChange={(v) => setC("manual_payment_requires_approval",v)}/></label><label className="flex items-center justify-between gap-4 rounded-lg border border-border px-3 py-2.5 text-sm"><span>Require a different reviewer</span><Switch checked={asBool(config.separate_manual_payment_reviewer,false)} onCheckedChange={(v) => setC("separate_manual_payment_reviewer",v)}/></label><label className="flex items-center justify-between gap-4 rounded-lg border border-border px-3 py-2.5 text-sm"><span>Proof required</span><Switch checked={asBool(config.proof_required_for_manual,true)} onCheckedChange={(v) => setC("proof_required_for_manual",v)}/></label><label className="flex items-center justify-between gap-4 rounded-lg border border-border px-3 py-2.5 text-sm"><span>External consolidation allowed</span><Switch checked={asBool(config.allow_external_consolidation,true)} onCheckedChange={(v) => setC("allow_external_consolidation",v)}/></label><label className="flex items-center justify-between gap-4 rounded-lg border border-border px-3 py-2.5 text-sm"><span>Payment reference required</span><Switch checked={asBool(config.payment_reference_required,false)} onCheckedChange={(v) => setC("payment_reference_required",v)}/></label></CardContent></Card>
          </section>

          <section className="rounded-2xl border border-border bg-background p-4 space-y-3"><div><h3 className="text-sm font-semibold">Charge visibility</h3><p className="mt-1 text-xs text-muted-foreground">Choose the components tenants and Agency statements should expect when this policy applies. Actual invoice line amounts remain driven by billing and charge records.</p></div><div className="grid gap-2 sm:grid-cols-2 md:grid-cols-4">{CHARGE_COMPONENTS.map(([id,label]) => <label key={id} className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2.5 text-sm"><Checkbox checked={asArray(config.charge_components,["rent"]).includes(id)} onCheckedChange={(checked) => { const current=asArray(config.charge_components,["rent"]); setC("charge_components", checked ? Array.from(new Set([...current,id])) : current.filter((x)=>x!==id)); }}/><span>{label}</span></label>)}</div></section>

          <section className="rounded-2xl border border-border bg-background p-4 space-y-4"><div><h3 className="text-sm font-semibold">Tenant-facing notice</h3><p className="mt-1 text-xs text-muted-foreground">Tenant-visible changes are communicated inside the platform. Choose selected tenants or everyone in this scope.</p></div><label className="flex items-center justify-between gap-4 rounded-lg border border-border bg-card px-3 py-2.5 text-sm"><span>Show these payment rules in the Tenant Portal</span><Switch checked={asBool(config.tenant_visible,true)} onCheckedChange={(v) => setC("tenant_visible",v)}/></label>{asBool(config.tenant_visible,true) ? <><div className="grid gap-3 md:grid-cols-3"><button type="button" onClick={() => setNoticeMode("none")} className={`rounded-lg border p-3 text-left ${noticeMode === "none" ? "border-primary bg-primary/5" : "border-border bg-card"}`}><p className="text-xs font-semibold">No notice</p><p className="mt-1 text-[11px] text-muted-foreground">Allowed only where there are no tenant recipients.</p></button><button type="button" onClick={() => setNoticeMode("selected")} className={`rounded-lg border p-3 text-left ${noticeMode === "selected" ? "border-primary bg-primary/5" : "border-border bg-card"}`}><p className="text-xs font-semibold">Selected reach</p><p className="mt-1 text-[11px] text-muted-foreground">Pick the affected tenants.</p></button><button type="button" onClick={() => setNoticeMode("global")} className={`rounded-lg border p-3 text-left ${noticeMode === "global" ? "border-primary bg-primary/5" : "border-border bg-card"}`}><p className="text-xs font-semibold">Global in scope</p><p className="mt-1 text-[11px] text-muted-foreground">Every active/pending tenant in this scope.</p></button></div>{noticeMode !== "none" ? <><div className="grid gap-3 md:grid-cols-2"><div className="space-y-1.5"><Label>Notice title</Label><Input value={noticeTitle} onChange={(e) => setNoticeTitle(e.target.value)} placeholder="Payment settings updated"/></div><div className="space-y-1.5"><Label>Communication reach</Label><div className="flex h-10 items-center gap-2 rounded-md border border-border bg-card px-3 text-sm"><Megaphone className="h-4 w-4 text-primary"/>{noticeMode === "global" ? `${candidates.length} tenant(s)` : `${selectedTenants.length} selected`}</div></div></div><div className="space-y-1.5"><Label>Notice message</Label><Textarea rows={3} value={noticeBody} onChange={(e) => setNoticeBody(e.target.value)} placeholder="Explain what changed, when it takes effect, and what the tenant should do."/></div>{noticeMode === "selected" ? <div className="rounded-xl border border-border bg-card p-3"><div className="mb-2 flex items-center justify-between"><p className="text-xs font-semibold">Select tenants</p><Button type="button" size="sm" variant="outline" onClick={() => setSelectedTenants(candidates.map((c) => c.tenant_id))}>Select all</Button></div><div className="max-h-48 space-y-1.5 overflow-auto">{candidatesLoading ? <Skeleton className="h-20 w-full"/> : candidates.map((candidate) => <label key={candidate.tenant_id} className="flex items-center gap-3 rounded-lg border border-border px-3 py-2"><Checkbox checked={selectedTenants.includes(candidate.tenant_id)} onCheckedChange={(checked) => setSelectedTenants((prev) => checked ? Array.from(new Set([...prev,candidate.tenant_id])) : prev.filter((id) => id !== candidate.tenant_id))}/><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{candidate.tenant_name}</span><span className="block truncate text-[10px] text-muted-foreground">{candidate.property_name ?? "Property"}{candidate.unit_number ? ` · Unit ${candidate.unit_number}` : ""}</span></span></label>)}</div></div> : null}</> : null}</> : null}</section>

          {scope === "agency" ? <AgencyPaymentRoutingPanel agencyId={agencyId}/> : scope !== "agency" && propertyId ? <PaymentCollectionRoutingPanel title={`${selectedProperty?.name ?? "Property"} payment destination`} propertyId={propertyId} unitId={scope === "unit" ? unitId || undefined : undefined}/> : null}

          <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-muted-foreground">Saving creates a versioned rule. Historical invoice/payment records are not rewritten.</p><Button onClick={() => savePolicy.mutate()} disabled={savePolicy.isPending}>{savePolicy.isPending ? <RefreshCw className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4"/>}{savePolicy.isPending ? "Saving…" : "Save payment policy"}</Button></div>
        </CardContent>
      </Card>

      <Card><CardHeader className="pb-3"><CardTitle className="text-sm">Configured policy versions</CardTitle><CardDescription>Use the effective scope hierarchy instead of copying the same payment rule into multiple records.</CardDescription></CardHeader><CardContent><div className="space-y-2">{policiesLoading ? <Skeleton className="h-24 w-full"/> : policies.length === 0 ? <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">No Agency payment policies yet.</div> : policies.slice(0, 40).map((policy) => <div key={policy.id} className="flex flex-col gap-3 rounded-xl border border-border p-3 sm:flex-row sm:items-center"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/5 text-primary"><CreditCard className="h-4 w-4"/></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-semibold truncate">{policy.policy_name}</p><Badge variant="outline" className="capitalize">{policy.scope_type}</Badge><Badge variant={policy.status === "active" ? "default" : "secondary"}>{policy.status}</Badge></div><p className="mt-0.5 text-xs text-muted-foreground">v{policy.version} · effective {policy.effective_from}{policy.property_id ? ` · ${optionsData?.properties.find((p) => p.id === policy.property_id)?.name ?? "Property"}` : ""}{policy.unit_id ? ` · ${optionsData?.units.find((u) => u.id === policy.unit_id)?.unit_number ?? "Unit"}` : ""}</p></div><Button size="sm" variant="outline" onClick={() => loadPolicy(policy)}>{policy.status === "scheduled" ? "Edit" : "Clone & refine"}</Button></div>)}</div></CardContent></Card>

      <Card><CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-sm"><BellRing className="h-4 w-4 text-primary"/>Payment-policy communications</CardTitle><CardDescription>Auditable tenant notices sent from Agency payment-rule changes.</CardDescription></CardHeader><CardContent>{noticeCampaigns.length === 0 ? <p className="text-sm text-muted-foreground">No payment-policy notices have been sent yet.</p> : <div className="space-y-2">{noticeCampaigns.map((campaign) => <div key={campaign.id} className="flex items-start gap-3 rounded-xl border border-border p-3"><div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/5 text-primary"><UsersRound className="h-4 w-4"/></div><div className="min-w-0 flex-1"><p className="text-sm font-semibold">{campaign.title}</p><p className="mt-0.5 text-xs text-muted-foreground">{campaign.audience_mode === "global" ? "Global in scope" : "Selected reach"} · {campaign.recipient_count} recipient(s) · {new Date(campaign.created_at).toLocaleString("en-KE")}</p></div></div>)}</div>}</CardContent></Card>
    </div>
  );
}
