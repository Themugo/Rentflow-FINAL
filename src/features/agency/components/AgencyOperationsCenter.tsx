import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BriefcaseBusiness, CreditCard, FileCog, LockKeyhole, Plus, Save, Settings2, ShieldCheck, Users, WalletCards } from "lucide-react";
import AgencyLayout from "@/features/agency/components/AgencyLayout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Textarea } from "@/shared/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { Switch } from "@/shared/components/ui/switch";
import { Checkbox } from "@/shared/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import { Badge } from "@/shared/components/ui/badge";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/shared/components/ui/alert";
import { useToast } from "@/shared/hooks/use-toast";
import { useAgencyOperationsConfig, type AgencyChargeCatalogItem, type AgencyContractRule, type AgencyMemberPermission, saveAgencyOperationsConfig } from "@/features/agency/lib/useAgencyOperationsConfig";
import AgencyPaymentPolicyCenter from "@/features/agency/components/AgencyPaymentPolicyCenter";

const MANAGEMENT_KEYS = [
  ["property_operations", "Property operations"],
  ["unit_operations", "Unit operations"],
  ["lease_operations", "Lease operations"],
  ["tenant_operations", "Tenant operations"],
  ["maintenance_operations", "Maintenance operations"],
  ["caretaker_operations", "Caretaker operations"],
  ["inspection_operations", "Inspections"],
  ["utility_operations", "Utilities & meters"],
  ["compliance_operations", "Compliance & risk"],
  ["vendor_operations", "Vendor & procurement"],
] as const;

const PERMISSION_KEYS = [
  ["view_settings", "View settings"],
  ["manage_settings", "Manage settings"],
  ["manage_team", "Manage team permissions"],
  ["manage_contract_rules", "Manage client contracts"],
  ["manage_billing_rules", "Manage billing rules & charges"],
  ["view_financials", "View financials"],
  ["record_payments", "Record payments"],
  ["verify_payment_evidence", "Verify payment evidence"],
  ["close_books", "Close books"],
  ["manage_operations", "Manage operations"],
] as const;

const DESTINATIONS = [
  ["agency", "Agency collects"],
  ["landlord", "Landlord collects"],
  ["tenant_direct", "Direct to nominated party"],
  ["external", "External / outside source"],
  ["split", "Split collection"],
] as const;

const DEFAULT_TOGGLES: Array<[string, string, boolean]> = [
  ["auto_allocate_rent", "Auto-allocate rent after successful payment", true],
  ["allow_partial_payments", "Allow partial payments", true],
  ["allow_external_consolidation", "Allow outside-source consolidation", true],
  ["manual_payment_requires_approval", "Manual payments require review", true],
  ["proof_required_for_manual", "Proof required for manual payments", true],
];

const DEFAULT_PAYMENT_RULES = {
  agency_collects: true,
  allow_payment_arrangements: true,
  allow_partial_payments: true,
  auto_allocate_rent: true,
  allow_third_party_payers: true,
  require_evidence: true,
};

const DEFAULT_MANAGEMENT_MODULES = Object.fromEntries(MANAGEMENT_KEYS.map(([key]) => [key, false]));

function bool(value: unknown, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function blankRule(propertyLandlordId = ""): AgencyContractRule {
  return {
    id: "",
    agency_id: "",
    property_landlord_id: propertyLandlordId,
    contract_name: "",
    status: "active",
    effective_from: new Date().toISOString().slice(0, 10),
    effective_to: null,
    collection_destination: "agency",
    service_model: "Custom client agreement",
    management_modules: { ...DEFAULT_MANAGEMENT_MODULES },
    financial_modules: { track_expenses: true, break_down_charges: true, include_external_evidence: true, close_books: true },
    payment_rules: { ...DEFAULT_PAYMENT_RULES },
    enforcement_rules: { enabled: true },
    settlement_rules: { fee_model: "none", fee_value: 0 },
    approval_rules: { manual_payments_require_review: true, external_consolidation_requires_review: true },
    owner_controls_collections: false,
    owner_controls_financials: true,
    owner_controls_distributions: true,
    agency_controls_operations: true,
    agency_controls_tenant_communications: true,
    owner_approval_required: false,
    manual_payment_tolerance: 0,
    expense_approval_threshold: 0,
    notes: null,
  };
}

function blankCharge(agencyId = ""): AgencyChargeCatalogItem {
  return { id: "", agency_id: agencyId, code: "", label: "", category: "income", charge_type: "other", calculation_method: "fixed", default_rate: 0, unit_label: null, payer: "tenant", is_active: true, display_order: 999, notes: null };
}

function PanelHeader({ icon: Icon, eyebrow, title, description }: { icon: typeof Settings2; eyebrow: string; title: string; description: string }) {
  return <div className="mb-5 flex items-start gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary/15 bg-primary/5 text-primary"><Icon className="h-5 w-5" /></div><div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">{eyebrow}</p><h2 className="mt-1 font-heading text-xl font-semibold tracking-[-0.02em]">{title}</h2><p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">{description}</p></div></div>;
}

export default function AgencyOperationsCenter() {
  const { data, isLoading, isError, refetch } = useAgencyOperationsConfig();
  const { toast } = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("rules");
  const [selectedRule, setSelectedRule] = useState<AgencyContractRule | null>(null);
  const [selectedCharge, setSelectedCharge] = useState<AgencyChargeCatalogItem | null>(null);
  const [selectedMemberId, setSelectedMemberId] = useState("");
  const [memberDraft, setMemberDraft] = useState<AgencyMemberPermission | null>(null);
  const [defaultsDraft, setDefaultsDraft] = useState<Record<string, unknown>>({});

  const agencyId = data?.agency_id;
  const canAdmin = Boolean(data?.viewer?.is_admin);
  const canContracts = canAdmin || Boolean(data?.viewer?.can_manage_contract_rules);
  const canCharges = canAdmin || Boolean(data?.viewer?.can_manage_billing_rules);
  const canTeam = canAdmin || Boolean(data?.viewer?.can_manage_team);
  const canSettings = canAdmin || Boolean(data?.viewer?.can_manage_settings);
  const canAnyConfiguration = canContracts || canCharges || canTeam || canSettings;
  const members = data?.members ?? [];

  useEffect(() => {
    if (data) {
      setDefaultsDraft(data.defaults ?? {});
      if (!selectedMemberId && data.members[0]) setSelectedMemberId(data.members[0].member_user_id);
      if (selectedRule && !data.contract_rules.some((rule) => rule.id === selectedRule.id)) setSelectedRule(null);
      if (selectedCharge && !data.charge_catalog.some((charge) => charge.id === selectedCharge.id)) setSelectedCharge(null);
    }
  }, [data, selectedMemberId, selectedRule, selectedCharge]);

  useEffect(() => {
    const next = members.find((member) => member.member_user_id === selectedMemberId) ?? members[0];
    setMemberDraft(next ? { ...next, permissions: { ...(next.permissions ?? {}) } } : null);
  }, [members, selectedMemberId]);

  const { data: relationships = [] } = useQuery({
    queryKey: ["agency-contract-relationships", agencyId],
    enabled: Boolean(agencyId),
    queryFn: async () => {
      const { data: agency, error: agencyError } = await (supabase as any).from("agencies").select("id,manager_id").eq("id", agencyId).maybeSingle();
      if (agencyError) throw agencyError;
      if (!agency?.manager_id) return [];
      const { data: rows, error } = await (supabase as any).from("property_landlords").select("id,property_id,landlord_user_id,agency_service_model,operating_model,properties(name,address)").eq("manager_id", agency.manager_id).order("updated_at", { ascending: false });
      if (error) throw error;
      const ids = (rows ?? []).map((row: any) => row.landlord_user_id).filter(Boolean);
      const { data: profiles } = ids.length ? await supabase.from("profiles").select("id,full_name,email").in("id", ids) : { data: [] };
      const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));
      return (rows ?? []).map((row: any) => ({ ...row, propertyName: row.properties?.name ?? "Property", address: row.properties?.address ?? "", landlordName: profileMap.get(row.landlord_user_id)?.full_name ?? profileMap.get(row.landlord_user_id)?.email ?? "Landlord" }));
    },
  });

  const { data: memberProfiles = [] } = useQuery({
    queryKey: ["agency-member-profiles", members.map((m) => m.member_user_id).join(",")],
    enabled: members.length > 0,
    queryFn: async () => {
      const ids = members.map((member) => member.member_user_id).filter(Boolean);
      if (!ids.length) return [];
      const { data: profiles, error } = await supabase.from("profiles").select("id,full_name,email").in("id", ids);
      if (error) throw error;
      return profiles ?? [];
    },
  });

  const selectedMemberProfile = memberDraft ? memberProfiles.find((profile) => profile.id === memberDraft.member_user_id) : undefined;
  const selectedRuleRelation = selectedRule ? relationships.find((relation: any) => relation.id === selectedRule.property_landlord_id) : undefined;
  const currentContractCount = data?.contract_rules.length ?? 0;

  const updateRule = (patch: Partial<AgencyContractRule>) => setSelectedRule((rule) => ({ ...(rule ?? blankRule()), ...patch }));
  const updateRuleMap = (map: "management_modules" | "payment_rules" | "financial_modules" | "enforcement_rules" | "settlement_rules" | "approval_rules", key: string, value: unknown) => setSelectedRule((rule) => ({ ...(rule ?? blankRule()), [map]: { ...(rule?.[map] ?? {}), [key]: value } } as AgencyContractRule));
  const updateCharge = (patch: Partial<AgencyChargeCatalogItem>) => setSelectedCharge((charge) => ({ ...(charge ?? blankCharge(agencyId)), ...patch }));

  async function save(action: string, payload: Record<string, unknown>, success: string) {
    if (!agencyId) return;
    setBusy(action);
    try {
      await saveAgencyOperationsConfig(agencyId, action, payload);
      await refetch();
      toast({ title: "Saved", description: success });
    } catch (error: any) {
      toast({ title: "Couldn't save", description: error?.message ?? "The Agency configuration could not be saved.", variant: "destructive" });
    } finally { setBusy(null); }
  }

  if (isLoading) return <AgencyLayout title="Agency Operations" description="Your contract rules, financial rules and team permissions."><Skeleton className="h-[620px] w-full rounded-2xl" /></AgencyLayout>;
  if (isError || !data) return <AgencyLayout title="Agency Operations" description="Your contract rules, financial rules and team permissions."><Alert variant="destructive"><AlertTitle>Couldn't load Agency configuration</AlertTitle><AlertDescription><Button className="mt-3" variant="outline" onClick={() => void refetch()}>Try again</Button></AlertDescription></Alert></AgencyLayout>;

  return (
    <AgencyLayout title="Agency Operations" description="Your Agency defines client contracts, permissions, billing rules and operating controls. CALQULUS enforces the rules you set." actions={<Badge variant="outline" className="gap-1.5"><BriefcaseBusiness className="h-3.5 w-3.5 text-primary" /> {canAdmin ? "Agency Admin" : canAnyConfiguration ? "Configured access" : "Read only"}</Badge>}>
      {!canAnyConfiguration ? <Alert className="mb-5"><LockKeyhole className="h-4 w-4" /><AlertTitle>Read-only access</AlertTitle><AlertDescription>An Agency owner or administrator must grant you configuration permissions before you can change these controls.</AlertDescription></Alert> : null}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="h-auto w-full flex-wrap justify-start gap-1 bg-muted/70 p-1">
          <TabsTrigger value="rules" className="gap-2"><FileCog className="h-4 w-4" /> Client Contracts</TabsTrigger>
          <TabsTrigger value="charges" className="gap-2"><WalletCards className="h-4 w-4" /> Charges</TabsTrigger>
          <TabsTrigger value="payments" className="gap-2"><CreditCard className="h-4 w-4" /> Payment Rules</TabsTrigger>
          <TabsTrigger value="defaults" className="gap-2"><Settings2 className="h-4 w-4" /> Operating Defaults</TabsTrigger>
          <TabsTrigger value="team" className="gap-2"><Users className="h-4 w-4" /> Team Permissions</TabsTrigger>
        </TabsList>

        <TabsContent value="rules" className="space-y-5">
          <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <PanelHeader icon={FileCog} eyebrow="Agency-owned contracts" title="Configure each client relationship" description="Build the exact operating arrangement you agreed with a client. There is no requirement that every property use the same model." />
            <div className="grid gap-5 xl:grid-cols-[1.1fr_.9fr]">
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" disabled={!canContracts} onClick={() => setSelectedRule(blankRule())}><Plus className="mr-2 h-4 w-4" /> New contract rule</Button>
                  {selectedRuleRelation ? <Badge variant="secondary">{selectedRuleRelation.propertyName} · {selectedRuleRelation.landlordName}</Badge> : null}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5 sm:col-span-2"><Label>Landlord client / property relationship</Label><Select value={selectedRule?.property_landlord_id ?? ""} onValueChange={(value) => { const existing = data.contract_rules.find((rule) => rule.property_landlord_id === value); setSelectedRule(existing ? { ...existing, management_modules: { ...(existing.management_modules ?? {}) }, payment_rules: { ...DEFAULT_PAYMENT_RULES, ...(existing.payment_rules ?? {}) } } : blankRule(value)); }} disabled={!canContracts}><SelectTrigger><SelectValue placeholder="Choose a property / client" /></SelectTrigger><SelectContent>{relationships.map((relation: any) => <SelectItem key={relation.id} value={relation.id}>{relation.propertyName} · {relation.landlordName}</SelectItem>)}</SelectContent></Select></div>
                  <div className="space-y-1.5"><Label>Contract name</Label><Input value={selectedRule?.contract_name ?? ""} onChange={(e) => updateRule({ contract_name: e.target.value })} placeholder="e.g. Full estate management agreement" disabled={!canContracts} /></div>
                  <div className="space-y-1.5"><Label>Effective from</Label><Input type="date" value={selectedRule?.effective_from ?? ""} onChange={(e) => updateRule({ effective_from: e.target.value })} disabled={!canContracts} /></div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2"><div className="space-y-1.5"><Label>Collection destination</Label><Select value={selectedRule?.collection_destination ?? "agency"} onValueChange={(v: any) => updateRule({ collection_destination: v })} disabled={!canContracts}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{DESTINATIONS.map(([id,label]) => <SelectItem key={id} value={id}>{label}</SelectItem>)}</SelectContent></Select></div><div className="space-y-1.5"><Label>Commercial service label</Label><Input value={selectedRule?.service_model ?? ""} onChange={(e) => updateRule({ service_model: e.target.value })} placeholder="e.g. Rent collection only" disabled={!canContracts} /></div></div>
                <div className="rounded-xl border border-border bg-background p-4"><div className="mb-3"><p className="text-sm font-semibold">Management modules</p><p className="text-xs text-muted-foreground">Only selected responsibilities become part of the Agency operating scope for this contract.</p></div><div className="grid gap-2 sm:grid-cols-2">{MANAGEMENT_KEYS.map(([key,label]) => <label key={key} className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2.5 text-sm"><Checkbox checked={bool(selectedRule?.management_modules?.[key])} onCheckedChange={(checked) => updateRuleMap("management_modules", key, Boolean(checked))} disabled={!canContracts} /><span>{label}</span></label>)}</div></div>
                <div className="rounded-xl border border-primary/15 bg-primary/5 p-4"><div className="mb-3"><p className="text-sm font-semibold">Client authority matrix</p><p className="text-xs text-muted-foreground">The Agency owns these settings. They define who is responsible for collections, financial control, distributions and property operations under this client agreement.</p></div><div className="grid gap-2 sm:grid-cols-2">{([ ["owner_controls_collections","Landlord controls collections",false], ["owner_controls_financials","Landlord controls financial wellbeing",true], ["owner_controls_distributions","Landlord controls distributions",true], ["agency_controls_operations","Agency controls property operations",true], ["agency_controls_tenant_communications","Agency controls tenant communications",true], ["owner_approval_required","Owner approval required for governed actions",false] ] as Array<["owner_controls_collections" | "owner_controls_financials" | "owner_controls_distributions" | "agency_controls_operations" | "agency_controls_tenant_communications" | "owner_approval_required", string, boolean]>).map(([key,label,fallback]) => <label key={key} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2.5 text-sm"><span>{label}</span><Switch checked={selectedRule?.[key] ?? fallback} onCheckedChange={(checked) => updateRule({ [key]: Boolean(checked) })} disabled={!canContracts}/></label>)}</div><div className="mt-3 grid gap-3 sm:grid-cols-2"><div className="space-y-1.5"><Label>Manual-payment tolerance (KES)</Label><Input type="number" min="0" step="0.01" value={String((selectedRule as any)?.manual_payment_tolerance ?? 0)} onChange={(e)=>updateRule({ manual_payment_tolerance: Number(e.target.value) } as any)} disabled={!canContracts}/></div><div className="space-y-1.5"><Label>Expense approval threshold (KES)</Label><Input type="number" min="0" step="0.01" value={String((selectedRule as any)?.expense_approval_threshold ?? 0)} onChange={(e)=>updateRule({ expense_approval_threshold: Number(e.target.value) } as any)} disabled={!canContracts}/></div></div></div>
                <div className="rounded-xl border border-border bg-background p-4"><div className="mb-3"><p className="text-sm font-semibold">Payment & enforcement rules</p><p className="text-xs text-muted-foreground">These settings follow the signed Agency/client arrangement.</p></div><div className="grid gap-2 sm:grid-cols-2">{Object.entries(DEFAULT_PAYMENT_RULES).map(([key]) => { const label = key === "agency_collects" ? "Agency may collect" : key === "allow_payment_arrangements" ? "Allow payment arrangements" : key === "allow_partial_payments" ? "Allow partial payments" : key === "auto_allocate_rent" ? "Auto-allocate rent" : key === "allow_third_party_payers" ? "Allow third-party payers" : "Require proof for manual payments"; return <label key={key} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2.5 text-sm"><span>{label}</span><Switch checked={bool(selectedRule?.payment_rules?.[key], DEFAULT_PAYMENT_RULES[key as keyof typeof DEFAULT_PAYMENT_RULES])} onCheckedChange={(checked) => updateRuleMap("payment_rules", key, checked)} disabled={!canContracts} /></label>; })}<label className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2.5 text-sm"><span>Manual payments require review</span><Switch checked={bool(selectedRule?.approval_rules?.manual_payments_require_review, true)} onCheckedChange={(checked) => updateRuleMap("approval_rules", "manual_payments_require_review", checked)} disabled={!canContracts} /></label><label className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2.5 text-sm"><span>Outside consolidation requires review</span><Switch checked={bool(selectedRule?.approval_rules?.external_consolidation_requires_review, true)} onCheckedChange={(checked) => updateRuleMap("approval_rules", "external_consolidation_requires_review", checked)} disabled={!canContracts} /></label><label className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2.5 text-sm sm:col-span-2"><span>Enforcement enabled</span><Switch checked={bool(selectedRule?.enforcement_rules?.enabled, true)} onCheckedChange={(checked) => updateRuleMap("enforcement_rules", "enabled", checked)} disabled={!canContracts} /></label></div><div className="mt-4 rounded-xl border border-border bg-card p-3"><p className="text-xs font-semibold uppercase tracking-wide text-primary">Payment arrangement template</p><p className="mt-1 text-xs text-muted-foreground">Set the Agency's default boundaries for negotiated installment arrangements; the actual agreement remains a client-specific business decision.</p><div className="mt-3 grid gap-3 sm:grid-cols-3"><div className="space-y-1.5"><Label>Max installments</Label><Input type="number" min="1" max="60" value={String(selectedRule?.payment_rules?.arrangement_max_installments ?? 1)} onChange={(e)=>updateRuleMap("payment_rules","arrangement_max_installments",Number(e.target.value))} disabled={!canContracts}/></div><div className="space-y-1.5"><Label>Grace days</Label><Input type="number" min="0" max="365" value={String(selectedRule?.payment_rules?.arrangement_grace_days ?? 0)} onChange={(e)=>updateRuleMap("payment_rules","arrangement_grace_days",Number(e.target.value))} disabled={!canContracts}/></div><div className="space-y-1.5"><Label>Late fee model</Label><Select value={String(selectedRule?.payment_rules?.late_fee_model ?? "none")} onValueChange={(v)=>updateRuleMap("payment_rules","late_fee_model",v)} disabled={!canContracts}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">None</SelectItem><SelectItem value="flat">Flat amount</SelectItem><SelectItem value="percent">Percentage</SelectItem></SelectContent></Select></div></div><div className="mt-3 space-y-1.5"><Label>Late fee value</Label><Input type="number" min="0" step="0.01" value={String(selectedRule?.payment_rules?.late_fee_value ?? 0)} onChange={(e)=>updateRuleMap("payment_rules","late_fee_value",Number(e.target.value))} disabled={!canContracts}/></div></div></div>
                <div className="grid gap-3 sm:grid-cols-2"><div className="rounded-xl border border-border bg-background p-4"><p className="text-sm font-semibold">Financial controls</p><div className="mt-3 space-y-2">{[["track_expenses","Track expenses"],["break_down_charges","Show charge breakdowns"],["include_external_evidence","Include outside-source evidence"],["close_books","Enable month-end close"]].map(([key,label])=><label key={key} className="flex items-center justify-between gap-3 text-sm"><span>{label}</span><Switch checked={bool(selectedRule?.financial_modules?.[key], true)} onCheckedChange={(checked)=>updateRuleMap("financial_modules", key, checked)} disabled={!canContracts}/></label>)}</div></div><div className="rounded-xl border border-border bg-background p-4"><p className="text-sm font-semibold">Settlement & split</p><div className="mt-3 grid gap-2"><Select value={String(selectedRule?.settlement_rules?.fee_model ?? "none")} onValueChange={(v)=>updateRuleMap("settlement_rules","fee_model",v)} disabled={!canContracts}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">No agency fee</SelectItem><SelectItem value="percent_of_collections">% of collections</SelectItem><SelectItem value="flat_monthly">Flat monthly</SelectItem><SelectItem value="flat_per_invoice">Flat per invoice</SelectItem></SelectContent></Select><Input type="number" min="0" step="0.01" value={String(selectedRule?.settlement_rules?.fee_value ?? 0)} onChange={(e)=>updateRuleMap("settlement_rules","fee_value",Number(e.target.value))} placeholder="Fee value" disabled={!canContracts}/>{selectedRule?.collection_destination === "split" ? <div className="grid gap-2 sm:grid-cols-2"><div className="space-y-1.5"><Label>Agency collection share %</Label><Input type="number" min="0.01" max="99.99" step="0.01" value={String(selectedRule?.settlement_rules?.collection_split_agency_percent ?? 50)} onChange={(e)=>updateRuleMap("settlement_rules","collection_split_agency_percent",Number(e.target.value))} disabled={!canContracts}/></div><div className="space-y-1.5"><Label>Outside / owner share %</Label><Input type="number" min="0.01" max="99.99" step="0.01" value={String(selectedRule?.settlement_rules?.collection_split_external_percent ?? 50)} onChange={(e)=>updateRuleMap("settlement_rules","collection_split_external_percent",Number(e.target.value))} disabled={!canContracts}/></div></div> : null}</div></div></div>
                <div className="space-y-1.5"><Label>Contract notes / dispute context</Label><Textarea value={selectedRule?.notes ?? ""} onChange={(e)=>updateRule({ notes: e.target.value })} placeholder="Record unusual arrangements, owner settlement rules, escalation rules, evidence requirements and anything needed to resolve disputes later." disabled={!canContracts} /></div>
                <Button disabled={!canContracts || busy === "contract" || !selectedRule?.property_landlord_id} onClick={() => selectedRule && void save("contract", { ruleId: selectedRule.id || null, propertyLandlordId: selectedRule.property_landlord_id, contract_name: selectedRule.contract_name || "Client operating agreement", effective_from: selectedRule.effective_from, collection_destination: selectedRule.collection_destination, service_model: selectedRule.service_model, management_modules: selectedRule.management_modules, payment_rules: selectedRule.payment_rules, enforcement_rules: selectedRule.enforcement_rules, financial_modules: selectedRule.financial_modules, settlement_rules: selectedRule.settlement_rules, approval_rules: selectedRule.approval_rules, notes: selectedRule.notes, owner_controls_collections: (selectedRule as any).owner_controls_collections, owner_controls_financials: (selectedRule as any).owner_controls_financials, owner_controls_distributions: (selectedRule as any).owner_controls_distributions, agency_controls_operations: (selectedRule as any).agency_controls_operations, agency_controls_tenant_communications: (selectedRule as any).agency_controls_tenant_communications, owner_approval_required: (selectedRule as any).owner_approval_required, manual_payment_tolerance: (selectedRule as any).manual_payment_tolerance, expense_approval_threshold: (selectedRule as any).expense_approval_threshold }, "The Agency's contract rule is active. Existing history stays intact.")}><Save className="mr-2 h-4 w-4" />{busy === "contract" ? "Saving…" : selectedRule?.id ? "Save new contract version" : "Save contract rule"}</Button>
              </div>
              <div className="rounded-xl border border-border bg-background p-4"><div className="mb-3 flex items-center justify-between"><div><p className="text-sm font-semibold">Active client agreements</p><p className="text-xs text-muted-foreground">Each relationship can have its own mix of responsibilities.</p></div><Badge variant="outline">{currentContractCount}</Badge></div><div className="space-y-2.5">{data.contract_rules.map((rule) => { const relation = relationships.find((r: any) => r.id === rule.property_landlord_id); return <button key={rule.id} type="button" onClick={() => setSelectedRule(rule)} className="w-full rounded-xl border border-border bg-card p-3 text-left transition hover:border-primary/40 hover:shadow-sm"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-semibold">{relation?.propertyName ?? rule.contract_name}</p><p className="mt-0.5 truncate text-xs text-muted-foreground">{relation?.landlordName ?? "Client"} · {rule.contract_name}</p></div><Badge variant="secondary">{rule.collection_destination.replace(/_/g, " ")}</Badge></div><div className="mt-2 flex flex-wrap gap-1.5"><span className="rounded-full bg-primary/5 px-2 py-1 text-[10px] font-semibold text-primary">{Object.values(rule.management_modules ?? {}).filter(Boolean).length} modules</span><span className="rounded-full bg-muted px-2 py-1 text-[10px] font-semibold text-muted-foreground">{bool(rule.enforcement_rules?.enabled, true) ? "Enforcement on" : "Enforcement off"}</span></div></button>; })}{!data.contract_rules.length ? <div className="rounded-xl border border-dashed border-border p-6 text-center"><p className="text-sm font-semibold">No agreements configured yet</p><p className="mt-1 text-xs text-muted-foreground">Select a client relationship above to build one.</p></div> : null}</div></div>
            </div>
          </section>
        </TabsContent>

        <TabsContent value="charges">
          <section className="rounded-2xl border border-border bg-card p-5 shadow-sm"><PanelHeader icon={WalletCards} eyebrow="Billing catalogue" title="Define every charge once" description="Create the charge vocabulary your Agency uses in invoices, receipts, external reconciliations and month-end reports." /><div className="mb-3 flex flex-wrap gap-2"><Button variant="outline" size="sm" disabled={!canCharges} onClick={() => setSelectedCharge(blankCharge(agencyId))}><Plus className="mr-2 h-4 w-4" /> New charge</Button></div><div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]"><div className="overflow-x-auto rounded-xl border border-border"><table className="w-full text-sm"><thead className="bg-muted/50"><tr><th className="p-3 text-left">Charge</th><th className="p-3 text-left">Category</th><th className="p-3 text-left">Method</th><th className="p-3 text-right">Rate</th><th className="p-3 text-right">Status</th></tr></thead><tbody>{data.charge_catalog.map((charge) => <tr key={charge.id} className="border-t border-border"><td className="p-3"><button type="button" className="text-left font-semibold hover:text-primary" onClick={() => setSelectedCharge(charge)}>{charge.label}<span className="ml-2 text-[10px] font-normal text-muted-foreground">{charge.code}</span></button></td><td className="p-3 text-muted-foreground">{charge.category.replace(/_/g, " ")}</td><td className="p-3 text-muted-foreground">{charge.calculation_method.replace(/_/g, " ")}</td><td className="p-3 text-right">KES {Number(charge.default_rate).toLocaleString("en-KE")}</td><td className="p-3 text-right">{charge.is_active ? <Badge variant="secondary">Active</Badge> : <Badge variant="outline">Off</Badge>}</td></tr>)}</tbody></table></div><div className="rounded-xl border border-border bg-background p-4 space-y-3"><div className="flex items-center justify-between"><p className="font-semibold">Charge editor</p><WalletCards className="h-4 w-4 text-primary"/></div><div className="space-y-1.5"><Label>Code</Label><Input value={selectedCharge?.code ?? ""} onChange={(e)=>updateCharge({code:e.target.value.toUpperCase()})} placeholder="WATER" disabled={!canCharges}/></div><div className="space-y-1.5"><Label>Label</Label><Input value={selectedCharge?.label ?? ""} onChange={(e)=>updateCharge({label:e.target.value})} placeholder="Water" disabled={!canCharges}/></div><div className="grid gap-3 sm:grid-cols-2"><div className="space-y-1.5"><Label>Category</Label><Select value={selectedCharge?.category ?? "income"} onValueChange={(v:any)=>updateCharge({category:v})} disabled={!canCharges}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="income">Income</SelectItem><SelectItem value="pass_through">Pass-through</SelectItem><SelectItem value="expense">Expense</SelectItem></SelectContent></Select></div><div className="space-y-1.5"><Label>Method</Label><Select value={selectedCharge?.calculation_method ?? "fixed"} onValueChange={(v:any)=>updateCharge({calculation_method:v})} disabled={!canCharges}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["fixed","per_unit","metered","percentage","manual"].map(v=><SelectItem key={v} value={v}>{v.replace(/_/g, " ")}</SelectItem>)}</SelectContent></Select></div></div><div className="grid gap-3 sm:grid-cols-2"><div className="space-y-1.5"><Label>Default rate</Label><Input type="number" min="0" step="0.01" value={selectedCharge?.default_rate ?? 0} onChange={(e)=>updateCharge({default_rate:Number(e.target.value)})} disabled={!canCharges}/></div><div className="space-y-1.5"><Label>Payer</Label><Select value={selectedCharge?.payer ?? "tenant"} onValueChange={(v:any)=>updateCharge({payer:v})} disabled={!canCharges}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["tenant","landlord","agency","third_party","shared"].map(v=><SelectItem key={v} value={v}>{v.replace(/_/g, " ")}</SelectItem>)}</SelectContent></Select></div></div><div className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2.5"><div><p className="text-sm font-medium">Active</p><p className="text-xs text-muted-foreground">Keep available for Agency billing.</p></div><Switch checked={selectedCharge?.is_active ?? true} onCheckedChange={(v)=>updateCharge({is_active:v})} disabled={!canCharges}/></div><Textarea value={selectedCharge?.notes ?? ""} onChange={(e)=>updateCharge({notes:e.target.value})} placeholder="Notes / contract definition" disabled={!canCharges}/><Button disabled={!canCharges || busy === "charge" || !selectedCharge?.code || !selectedCharge?.label} onClick={()=>selectedCharge && void save("charge", { itemId:selectedCharge.id || null, code:selectedCharge.code,label:selectedCharge.label,category:selectedCharge.category,charge_type:selectedCharge.charge_type,calculation_method:selectedCharge.calculation_method,default_rate:selectedCharge.default_rate,unit_label:selectedCharge.unit_label,payer:selectedCharge.payer,is_active:selectedCharge.is_active,display_order:selectedCharge.display_order,notes:selectedCharge.notes }, "Charge catalogue updated.")}><Save className="mr-2 h-4 w-4"/>{busy === "charge" ? "Saving…" : selectedCharge?.id ? "Save charge" : "Add charge"}</Button></div></div></section>
        </TabsContent>

        <TabsContent value="payments" className="space-y-5"><AgencyPaymentPolicyCenter /></TabsContent>

        <TabsContent value="defaults"><section className="rounded-2xl border border-border bg-card p-5 shadow-sm"><PanelHeader icon={Settings2} eyebrow="Operating defaults" title="Set the Agency's baseline" description="Use these settings for new relationships, then override them per client contract when the commercial agreement differs." /><div className="grid gap-5 lg:grid-cols-2"><div className="space-y-3 rounded-xl border border-border bg-background p-4"><div className="space-y-1.5"><Label>Default collection destination</Label><Select value={String(defaultsDraft.collection_destination ?? "agency")} onValueChange={(v)=>setDefaultsDraft((x)=>({...x,collection_destination:v}))} disabled={!canSettings}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{DESTINATIONS.map(([id,label])=><SelectItem key={id} value={id}>{label}</SelectItem>)}</SelectContent></Select></div>{DEFAULT_TOGGLES.map(([key,label,fallback])=><label key={key} className="flex items-center justify-between gap-4 rounded-lg border border-border bg-card px-3 py-2.5 text-sm"><span>{label}</span><Switch checked={bool(defaultsDraft[String(key)],Boolean(fallback))} onCheckedChange={(checked)=>setDefaultsDraft((x)=>({...x,[String(key)]:checked}))} disabled={!canSettings}/></label>)}</div><div className="space-y-3 rounded-xl border border-border bg-background p-4"><div className="grid gap-3 sm:grid-cols-2"><div className="space-y-1.5"><Label>Month close day</Label><Input type="number" min="1" max="31" value={String(defaultsDraft.month_close_day ?? 1)} onChange={(e)=>setDefaultsDraft((x)=>({...x,month_close_day:Number(e.target.value)}))} disabled={!canSettings}/></div><div className="space-y-1.5"><Label>Dispute window (days)</Label><Input type="number" min="0" max="365" value={String(defaultsDraft.dispute_window_days ?? 30)} onChange={(e)=>setDefaultsDraft((x)=>({...x,dispute_window_days:Number(e.target.value)}))} disabled={!canSettings}/></div></div><div className="rounded-xl border border-primary/15 bg-primary/5 p-4"><div className="flex items-start gap-3"><ShieldCheck className="h-5 w-5 shrink-0 text-primary"/><div><p className="text-sm font-semibold">Automatic tallying</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Completed rent payments continue through the existing atomic payment lifecycle. Invoice allocations, receipts and Agency financial reporting update from those records rather than from manually entered totals.</p></div></div></div><Button disabled={!canSettings || busy === "defaults"} onClick={()=>void save("defaults", defaultsDraft, "Agency operating defaults saved.")}><Save className="mr-2 h-4 w-4"/>{busy === "defaults" ? "Saving…" : "Save defaults"}</Button></div></div></section></TabsContent>

        <TabsContent value="team"><section className="rounded-2xl border border-border bg-card p-5 shadow-sm"><PanelHeader icon={Users} eyebrow="Agency-controlled access" title="Permission matrix" description="Owners and administrators control who can configure contracts, billing, evidence and month-end close." /><div className="grid gap-5 lg:grid-cols-[320px_1fr]"><div className="space-y-2 rounded-xl border border-border bg-background p-3">{members.map((member) => { const profile=memberProfiles.find((p)=>p.id===member.member_user_id); const selected=memberDraft?.member_user_id===member.member_user_id; return <button key={member.id} type="button" className={`w-full rounded-lg border px-3 py-3 text-left ${selected ? "border-primary bg-primary/5" : "border-border bg-card"}`} onClick={()=>setSelectedMemberId(member.member_user_id)}><div className="flex items-center gap-2"><div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-bold">{(profile?.full_name??profile?.email??"A").charAt(0).toUpperCase()}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{profile?.full_name??profile?.email??member.member_user_id}</p><p className="text-[10px] text-muted-foreground">{member.role_in_agency} · {member.is_active?"Active":"Inactive"}</p></div></div></button>; })}</div><div className="rounded-xl border border-border bg-background p-4">{memberDraft?<><div className="mb-4"><p className="text-sm font-semibold">Permissions for {selectedMemberProfile?.full_name??memberDraft.member_user_id}</p><p className="mt-1 text-xs text-muted-foreground">This is Agency configuration authority, separate from property service scope.</p></div><div className="grid gap-2 sm:grid-cols-2">{PERMISSION_KEYS.map(([key,label])=><label key={key} className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2.5 text-sm"><Checkbox checked={bool(memberDraft.permissions?.[key])} onCheckedChange={(checked)=>setMemberDraft((x)=>x?({...x,permissions:{...(x.permissions??{}),[key]:Boolean(checked)}}):x)} disabled={!canTeam}/><span>{label}</span></label>)}</div><div className="mt-4 flex justify-end"><Button disabled={!canTeam || busy === "member"} onClick={()=>void save("member", {memberId:memberDraft.member_user_id,roleInAgency:memberDraft.role_in_agency,permissions:memberDraft.permissions}, "Team permissions saved.")}><Save className="mr-2 h-4 w-4"/>{busy === "member"?"Saving…":"Save permissions"}</Button></div></>:<div className="py-12 text-center"><p className="text-sm font-medium">No Agency members configured</p><p className="mt-1 text-xs text-muted-foreground">Use the existing Agency invitation workflow to add staff.</p></div>}</div></div></section></TabsContent>
      </Tabs>
    </AgencyLayout>
  );
}
