import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { CheckCircle2, FileClock, RotateCcw, ShieldCheck, TriangleAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useManagerScope } from "@/shared/hooks/useManagerScope";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { toast } from "sonner";

const LedgerAdjustmentsReversalsGovernance = () => {
  const { managerId } = useManagerScope();
  const qc = useQueryClient();
  const [reason, setReason] = useState("");
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["ledger-adjustment-governance", managerId], enabled: !!managerId,
    queryFn: async () => { const { data, error } = await supabase.rpc("get_manager_ledger_adjustment_governance", { p_manager_id: managerId! }); if (error) throw error; return data as any; },
  });
  const action = useMutation({ mutationFn: async ({ fn, id }: { fn: string; id: string }) => { const args: any = { p_adjustment_id: id }; if (fn === "reject_ledger_adjustment_atomic") args.p_reason = reason; const { data, error } = await supabase.rpc(fn as any, args); if (error) throw error; return data; }, onSuccess: () => { setReason(""); qc.invalidateQueries({ queryKey: ["ledger-adjustment-governance", managerId] }); refetch(); toast.success("Ledger governance action completed"); }, onError: (e: Error) => toast.error(e.message || "Ledger governance action failed") });
  const reverse = useMutation({ mutationFn: async (id: string) => { if (!reason.trim()) throw new Error("Enter a reversal reason first"); const { data, error } = await supabase.rpc("reverse_ledger_entry_atomic", { p_journal_entry_id: id, p_reason: reason.trim(), p_reversal_date: new Date().toISOString().slice(0,10) }); if (error) throw error; return data; }, onSuccess: () => { setReason(""); qc.invalidateQueries({ queryKey: ["ledger-adjustment-governance", managerId] }); toast.success("Journal entry reversed with an immutable counter-entry"); }, onError: (e: Error) => toast.error(e.message || "Reversal failed") });
  const adjustments = (data?.adjustments ?? []) as any[]; const journals = (data?.recent_journals ?? []) as any[];
  return <Card className="enterprise-card"><CardHeader><div className="flex items-start justify-between gap-3"><div><CardTitle className="section-title flex items-center gap-2"><FileClock className="h-5 w-5" /> Ledger Adjustments & Reversals</CardTitle><CardDescription>Approval-gated adjustments and append-only corrections. Closed periods cannot be silently changed.</CardDescription></div><Badge variant="outline" className="gap-1"><ShieldCheck className="h-3 w-3" /> Immutable</Badge></div></CardHeader><CardContent className="space-y-5">
    <div className="rounded-lg border p-4"><p className="text-xs text-muted-foreground mb-2">Reversal / rejection reason</p><input value={reason} onChange={e => setReason(e.target.value)} className="w-full rounded-md border bg-background px-3 py-2 text-sm" placeholder="Explain the correction or rejection" /></div>
    {isLoading ? <p className="text-sm text-muted-foreground">Loading ledger governance…</p> : <>
      <div><div className="mb-2 flex items-center justify-between"><p className="font-semibold">Adjustment queue</p><Badge variant="outline">{adjustments.length}</Badge></div><div className="space-y-2">{adjustments.slice(0,12).map(a => <div key={a.id} className="rounded-md border p-3"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="font-medium">{a.description}</p><p className="text-xs text-muted-foreground">{a.period_start} → {a.period_end} · {a.reason}</p></div><Badge variant={a.status === "posted" || a.status === "approved" ? "default" : a.status === "rejected" ? "destructive" : "outline"}>{a.status}</Badge></div><div className="mt-2 flex flex-wrap gap-2">{a.status === "submitted" && <><Button size="sm" onClick={() => action.mutate({ fn: "approve_ledger_adjustment_atomic", id: a.id })}><CheckCircle2 className="mr-1 h-3 w-3" /> Approve</Button><Button size="sm" variant="outline" onClick={() => action.mutate({ fn: "reject_ledger_adjustment_atomic", id: a.id })}>Reject</Button></>}{a.status === "approved" && <Button size="sm" onClick={() => action.mutate({ fn: "post_ledger_adjustment_atomic", id: a.id })}>Post adjustment</Button>}</div></div>)}</div></div>
      <div><div className="mb-2 flex items-center justify-between"><p className="font-semibold">Recent journal entries</p><TriangleAlert className="h-4 w-4 text-muted-foreground" /></div><div className="space-y-2">{journals.slice(0,12).map(j => <div key={j.id} className="rounded-md border p-3 flex flex-wrap items-center justify-between gap-2"><div><p className="font-medium">{j.description}</p><p className="text-xs text-muted-foreground">{j.entry_date} · {j.source_type} · {j.status}</p></div>{j.status === "posted" && <Button size="sm" variant="outline" onClick={() => reverse.mutate(j.id)} disabled={reverse.isPending}><RotateCcw className="mr-1 h-3 w-3" /> Reverse</Button>}</div>)}</div></div>
      <p className="text-xs text-muted-foreground">Posted journals cannot be edited or deleted. A correction is represented by a balanced reversal entry in an open period, preserving the original audit trail.</p>
    </>}
  </CardContent></Card>;
};
export default LedgerAdjustmentsReversalsGovernance;
