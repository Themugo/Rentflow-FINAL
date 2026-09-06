import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Activity, AlertTriangle, CheckCircle2, Clock3, RefreshCw, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useManagerScope } from "@/shared/hooks/useManagerScope";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { Input } from "@/shared/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { Textarea } from "@/shared/components/ui/textarea";
import { toast } from "sonner";

const badgeVariant = (value: string) => value === "fail" || value === "overdue" ? "destructive" : value === "partial" || value === "due" ? "secondary" : "outline";

export default function OperationalResilienceRecoveryAssuranceCenter() {
  const { managerId } = useManagerScope();
  const q = useQuery({
    queryKey: ["manager-recovery-assurance", managerId],
    enabled: !!managerId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_manager_recovery_assurance", { p_manager_id: managerId!, p_horizon_days: 30 });
      if (error) throw error;
      return data as any;
    },
  });
  const [planName, setPlanName] = useState("");
  const [propertyId, setPropertyId] = useState("");
  const [processes, setProcesses] = useState("");
  const [rto, setRto] = useState("60");
  const [rpo, setRpo] = useState("60");
  const [status, setStatus] = useState("draft");
  const [reviewDue, setReviewDue] = useState("");
  const [notes, setNotes] = useState("");
  const [planSaving, setPlanSaving] = useState(false);
  const [drillPlan, setDrillPlan] = useState("");
  const [drillDate, setDrillDate] = useState("");
  const [scenario, setScenario] = useState("");
  const [result, setResult] = useState("pass");
  const [actualRto, setActualRto] = useState("");
  const [actualRpo, setActualRpo] = useState("");
  const [findings, setFindings] = useState("");
  const [actions, setActions] = useState("");
  const [drillSaving, setDrillSaving] = useState(false);
  const d = q.data as any;
  const plans = d?.plans ?? [];
  const drills = d?.drills ?? [];

  const savePlan = async () => {
    if (!managerId || !planName.trim() || !processes.trim()) return;
    setPlanSaving(true);
    try {
      const { error } = await supabase.rpc("upsert_business_continuity_plan_atomic", {
        p_manager_id: managerId, p_plan_name: planName.trim(), p_property_id: propertyId.trim() || null,
        p_critical_processes: processes.trim(), p_rto_minutes: Number(rto), p_rpo_minutes: Number(rpo),
        p_accountable_owner_id: managerId, p_status: status, p_review_due_on: reviewDue || null,
        p_notes: notes.trim() || null,
      });
      if (error) throw error;
      setPlanName(""); setPropertyId(""); setProcesses(""); setReviewDue(""); setNotes("");
      await q.refetch(); toast.success("Continuity plan recorded.");
    } catch (e) { toast.error((e as Error).message); } finally { setPlanSaving(false); }
  };

  const recordDrill = async () => {
    if (!managerId || !drillPlan || !drillDate || !scenario.trim()) return;
    setDrillSaving(true);
    try {
      const { error } = await supabase.rpc("record_recovery_drill_atomic", {
        p_manager_id: managerId, p_plan_id: drillPlan, p_drill_date: drillDate, p_scenario: scenario.trim(), p_result: result,
        p_actual_rto_minutes: actualRto === "" ? null : Number(actualRto), p_actual_rpo_minutes: actualRpo === "" ? null : Number(actualRpo),
        p_findings: findings.trim() || null, p_corrective_actions: actions.trim() || null,
      });
      if (error) throw error;
      setDrillPlan(""); setDrillDate(""); setScenario(""); setActualRto(""); setActualRpo(""); setFindings(""); setActions("");
      await q.refetch(); toast.success("Recovery drill recorded.");
    } catch (e) { toast.error((e as Error).message); } finally { setDrillSaving(false); }
  };

  const stat = (label: string, value: any, icon: React.ReactNode) => <div className="rounded-lg border p-3"><p className="flex items-center gap-1 text-xs text-muted-foreground">{icon}{label}</p><p className="text-lg font-semibold tabular-nums">{value ?? 0}</p></div>;
  return <Card className="enterprise-card"><CardHeader><div className="flex items-start justify-between gap-3"><div><CardTitle className="section-title flex items-center gap-2"><ShieldCheck className="h-5 w-5" /> Operational Resilience & Recovery Assurance</CardTitle><CardDescription>Maintain continuity plans, RTO/RPO targets and management recovery drills using the existing evidence register. This is operational assurance—not proof of infrastructure backup or PITR restore capability.</CardDescription></div><Button variant="outline" size="icon" onClick={() => q.refetch()} aria-label="Refresh recovery assurance"><RefreshCw className="h-4 w-4" /></Button></div></CardHeader><CardContent className="space-y-5">
    {d && <div className="grid gap-3 md:grid-cols-7">{stat("Active plans", d.active_plans, <CheckCircle2 className="h-3 w-3" />)}{stat("Draft plans", d.draft_plans, <Activity className="h-3 w-3" />)}{stat("Overdue reviews", d.overdue_reviews, <AlertTriangle className="h-3 w-3" />)}{stat("Reviews ≤30d", d.reviews_due, <Clock3 className="h-3 w-3" />)}{stat("Drills 90d", d.drills_90d, <Activity className="h-3 w-3" />)}{stat("Failed 90d", d.failed_drills_90d, <AlertTriangle className="h-3 w-3" />)}{stat("Partial 90d", d.partial_drills_90d, <Clock3 className="h-3 w-3" />)}</div>}
    <div className="rounded-lg border p-4 space-y-3"><p className="font-medium">Record continuity plan</p><div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4"><Input placeholder="Plan name" value={planName} onChange={e => setPlanName(e.target.value)} /><Input placeholder="Property ID (optional)" value={propertyId} onChange={e => setPropertyId(e.target.value)} /><div className="rounded-md border px-3 py-2 text-sm text-muted-foreground">Accountable owner: current manager</div><Select value={status} onValueChange={setStatus}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["draft", "active", "retired"].map(x => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent></Select><Input type="number" min="1" placeholder="RTO minutes" value={rto} onChange={e => setRto(e.target.value)} /><Input type="number" min="0" placeholder="RPO minutes" value={rpo} onChange={e => setRpo(e.target.value)} /><Input type="date" value={reviewDue} onChange={e => setReviewDue(e.target.value)} /><Textarea className="lg:col-span-4" placeholder="Critical processes covered" value={processes} onChange={e => setProcesses(e.target.value)} /><Textarea className="lg:col-span-4" placeholder="Notes" value={notes} onChange={e => setNotes(e.target.value)} /></div><Button onClick={savePlan} disabled={planSaving || !planName.trim() || !processes.trim()}>Record plan</Button></div>
    <div className="rounded-lg border p-4 space-y-3"><p className="font-medium">Record recovery drill</p><div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4"><Select value={drillPlan} onValueChange={setDrillPlan}><SelectTrigger><SelectValue placeholder="Continuity plan" /></SelectTrigger><SelectContent>{plans.filter((p: any) => p.status !== "retired").map((p: any) => <SelectItem key={p.id} value={p.id}>{p.plan_name}</SelectItem>)}</SelectContent></Select><Input type="date" value={drillDate} onChange={e => setDrillDate(e.target.value)} /><Input placeholder="Scenario" value={scenario} onChange={e => setScenario(e.target.value)} /><Select value={result} onValueChange={setResult}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["pass", "partial", "fail"].map(x => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent></Select><Input type="number" min="0" placeholder="Actual RTO minutes" value={actualRto} onChange={e => setActualRto(e.target.value)} /><Input type="number" min="0" placeholder="Actual RPO minutes" value={actualRpo} onChange={e => setActualRpo(e.target.value)} /><Textarea placeholder="Findings" value={findings} onChange={e => setFindings(e.target.value)} /><Textarea placeholder="Corrective actions" value={actions} onChange={e => setActions(e.target.value)} /></div><Button onClick={recordDrill} disabled={drillSaving || !drillPlan || !drillDate || !scenario.trim()}>Record drill</Button></div>
    {plans.length === 0 ? <p className="text-sm text-muted-foreground">No continuity plans recorded.</p> : <div className="space-y-2">{plans.map((p: any) => <div key={p.id} className="grid gap-3 rounded-lg border p-3 md:grid-cols-[1fr_130px_130px_auto] md:items-center"><div><p className="font-medium">{p.plan_name}</p><p className="text-xs text-muted-foreground">RTO {p.rto_minutes}m · RPO {p.rpo_minutes}m · {p.has_drill ? "Drill evidence present" : "No drill recorded"}</p></div><Badge variant={badgeVariant(p.status) as any}>{p.status}</Badge><div><p className="text-xs text-muted-foreground">Review</p><p className="text-sm">{p.review_due_on || "Not set"}</p></div><Badge variant={p.days_to_review != null && p.days_to_review < 0 ? "destructive" : p.days_to_review != null && p.days_to_review <= 30 ? "secondary" : "outline"}>{p.days_to_review == null ? "No review date" : p.days_to_review < 0 ? `${Math.abs(p.days_to_review)}d overdue` : `${p.days_to_review}d`}</Badge></div>)}</div>}
    {drills.length === 0 ? <p className="text-sm text-muted-foreground">No recovery drills recorded.</p> : <div className="space-y-2">{drills.slice(0, 12).map((r: any) => <div key={r.id} className="grid gap-3 rounded-lg border p-3 md:grid-cols-[1fr_120px_150px_auto] md:items-center"><div><p className="font-medium">{r.scenario}</p><p className="text-xs text-muted-foreground">{r.plan_name} · {r.drill_date}{r.rto_missed ? " · RTO target missed" : ""}{r.rpo_missed ? " · RPO target missed" : ""}</p></div><Badge variant={badgeVariant(r.result) as any}>{r.result}</Badge><div className="text-xs">Actual RTO: {r.actual_rto_minutes ?? "—"}m · RPO: {r.actual_rpo_minutes ?? "—"}m</div><Badge variant={r.rto_missed || r.rpo_missed || r.result === "fail" ? "destructive" : "outline"}>{r.evidence_document_id ? "Evidence linked" : "Evidence not linked"}</Badge></div>)}</div>}
    <div className="rounded-lg border p-4 text-xs text-muted-foreground"><ShieldCheck className="mr-1 inline h-3 w-3" /> Recovery assurance chain: continuity plan → RTO/RPO target → drill result → findings/corrective action → evidence. Existing document evidence remains canonical; infrastructure backup/PITR capability must be proven separately by platform-level controls.</div>
  </CardContent></Card>;
}
