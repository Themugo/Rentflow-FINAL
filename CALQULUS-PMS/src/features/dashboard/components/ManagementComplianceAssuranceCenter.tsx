import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ClipboardCheck, RefreshCw, ShieldCheck, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useManagerScope } from "@/shared/hooks/useManagerScope";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { Textarea } from "@/shared/components/ui/textarea";
import { toast } from "sonner";

export function ManagementComplianceAssuranceCenter() {
  const { managerId } = useManagerScope();
  const queryClient = useQueryClient();
  const [periodId, setPeriodId] = useState("");
  const [note, setNote] = useState("");

  const periods = useQuery({
    queryKey: ["assurance-close-periods", managerId], enabled: !!managerId,
    queryFn: async () => { const { data, error } = await supabase.from("financial_close_periods").select("id,period_start,period_end,status,closed_at").eq("manager_id", managerId!).order("period_end", { ascending: false }).limit(24); if (error) throw error; return data ?? []; },
  });
  const reviews = useQuery({
    queryKey: ["management-assurance-reviews", managerId], enabled: !!managerId,
    queryFn: async () => { const { data, error } = await supabase.rpc("get_manager_assurance_reviews" as any, { p_manager_id: managerId }); if (error) throw error; return (data ?? []) as any[]; },
  });
  const create = useMutation({
    mutationFn: async () => { const { data, error } = await supabase.rpc("create_manager_assurance_review_atomic" as any, { p_manager_id: managerId, p_close_period_id: periodId || null, p_audit_pack_id: null }); if (error) throw error; return data; },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["management-assurance-reviews", managerId] }); toast.success("Assurance review refreshed from authoritative controls."); },
    onError: (e: Error) => toast.error(e.message || "Could not create assurance review."),
  });
  const review = useMutation({
    mutationFn: async ({ status }: { status: "in_review" | "approved" | "rejected" }) => { const active = reviews.data?.find((r: any) => r.close_period_id === (periodId || null) && ["draft", "in_review"].includes(r.status)) ?? reviews.data?.[0]; if (!active) throw new Error("Generate an assurance review first."); const { data, error } = await supabase.rpc("review_manager_assurance_atomic" as any, { p_review_id: active.id, p_target_status: status, p_decision_note: note || null }); if (error) throw error; return data; },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["management-assurance-reviews", managerId] }); setNote(""); toast.success("Assurance decision recorded."); },
    onError: (e: Error) => toast.error(e.message || "Could not update assurance review."),
  });

  const active = reviews.data?.find((r: any) => r.close_period_id === (periodId || null) && ["draft", "in_review"].includes(r.status)) ?? reviews.data?.[0];
  const controls = active?.snapshot?.controls ?? {};
  return <Card className="border-border/80 shadow-[0_8px_28px_-22px_rgb(13_39_68/0.28)]">
    <CardHeader className="pb-3"><div className="flex items-start justify-between gap-3"><div><CardTitle className="flex items-center gap-2 text-base"><ClipboardCheck className="h-4 w-4" /> Management & Compliance Assurance</CardTitle><p className="mt-1 text-xs text-muted-foreground">Explicit review and approval over close, reconciliation, evidence and audit controls.</p></div><Badge variant="outline"><ShieldCheck className="mr-1 h-3 w-3" /> Reviewable control record</Badge></div></CardHeader>
    <CardContent className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row"><Select value={periodId} onValueChange={setPeriodId}><SelectTrigger className="sm:max-w-sm"><SelectValue placeholder="Select a financial period" /></SelectTrigger><SelectContent>{(periods.data ?? []).map((p: any) => <SelectItem key={p.id} value={p.id}>{p.period_start} → {p.period_end} ({p.status})</SelectItem>)}</SelectContent></Select><Button onClick={() => create.mutate()} disabled={create.isPending}><RefreshCw className={create.isPending ? "mr-2 h-4 w-4 animate-spin" : "mr-2 h-4 w-4"} />Refresh assurance</Button></div>
      {active && <div className="space-y-3 rounded-lg border p-4"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-sm font-semibold">Control score: {active.control_score}/100</p><p className="text-xs text-muted-foreground">Updated {new Date(active.updated_at).toLocaleString()}</p></div><Badge variant={active.status === "approved" ? "default" : active.status === "rejected" ? "destructive" : "secondary"}>{active.status}</Badge></div><div className="grid grid-cols-2 gap-2 sm:grid-cols-5">{[["Critical exceptions",controls.critical_reconciliation_cases], ["Active exceptions",controls.active_reconciliation_cases], ["Unmatched bank",controls.unmatched_bank_transactions], ["Unverified docs",controls.unverified_documents], ["Open work",controls.open_work_items]].map(([label,value]) => <div key={label as string} className="rounded-md border p-2"><p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-1 text-sm font-semibold tabular-nums">{value ?? 0}</p></div>)}</div><Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Decision note or required remediation..." className="min-h-20" /><div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => review.mutate({ status: "in_review" })} disabled={review.isPending}><ClipboardCheck className="mr-1 h-3.5 w-3.5" />Mark in review</Button><Button size="sm" onClick={() => review.mutate({ status: "approved" })} disabled={review.isPending || active.control_score < 80}><ShieldCheck className="mr-1 h-3.5 w-3.5" />Approve</Button><Button size="sm" variant="destructive" onClick={() => review.mutate({ status: "rejected" })} disabled={review.isPending}><XCircle className="mr-1 h-3.5 w-3.5" />Reject</Button></div>{active.control_score < 80 && <p className="text-xs text-destructive">Approval is blocked below 80/100; resolve material control exceptions first.</p>}</div>}
    </CardContent>
  </Card>;
}
