import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Archive, CheckCircle2, Download, FileLock2, RefreshCw, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useManagerScope } from "@/shared/hooks/useManagerScope";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { Input } from "@/shared/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { toast } from "sonner";

const sha256 = async (text: string) => {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
};

export function FinancialAuditPackCenter() {
  const { managerId } = useManagerScope();
  const queryClient = useQueryClient();
  const [periodId, setPeriodId] = useState("");
  const [pack, setPack] = useState<any>(null);
  const [artifactHash, setArtifactHash] = useState("");

  const periods = useQuery({
    queryKey: ["financial-close-periods", managerId], enabled: !!managerId,
    queryFn: async () => { const { data, error } = await supabase.from("financial_close_periods").select("id,period_start,period_end,status,closed_at").eq("manager_id", managerId!).order("period_end", { ascending: false }).limit(24); if (error) throw error; return data ?? []; },
  });

  const generate = useMutation({ mutationFn: async () => { const { data, error } = await supabase.rpc("generate_manager_financial_audit_pack" as any, { p_manager_id: managerId, p_close_period_id: periodId }); if (error) throw error; return data; }, onSuccess: (data) => { setPack(data); setArtifactHash(""); toast.success("Audit pack generated from the closed period."); }, onError: (e: Error) => toast.error(e.message || "Could not generate audit pack.") });

  const finalize = useMutation({ mutationFn: async () => { const snapshot = JSON.stringify(pack?.snapshot ?? {}, null, 2); const hash = await sha256(snapshot); const { data, error } = await supabase.rpc("finalize_manager_financial_audit_pack" as any, { p_pack_id: pack?.pack_id, p_artifact_sha256: hash }); if (error) throw error; return { data, hash, snapshot }; }, onSuccess: ({ hash }) => { setArtifactHash(hash); setPack((p: any) => ({ ...p, status: "finalized", artifact_sha256: hash })); toast.success("Audit pack finalized and fingerprinted."); }, onError: (e: Error) => toast.error(e.message || "Could not finalize audit pack.") });

  const download = () => {
    if (!pack?.snapshot) return;
    const text = JSON.stringify(pack.snapshot, null, 2);
    const blob = new Blob([text], { type: "application/json" });
    const url = URL.createObjectURL(blob); const a = document.createElement("a");
    a.href = url; a.download = `calqulus-audit-pack-${pack.snapshot.close_period.period_start}-${pack.snapshot.close_period.period_end}.json`; a.click(); URL.revokeObjectURL(url);
  };

  const selected = periods.data?.find((p: any) => p.id === periodId);
  return <Card className="border-border/80 shadow-[0_8px_28px_-22px_rgb(13_39_68/0.28)]">
    <CardHeader className="pb-3"><div className="flex items-start justify-between gap-3"><div><CardTitle className="flex items-center gap-2 text-base"><Archive className="h-4 w-4" /> Period-End Audit Pack</CardTitle><p className="mt-1 text-xs text-muted-foreground">Create a reproducible, evidence-linked snapshot from a closed financial period.</p></div><Badge variant="outline"><FileLock2 className="mr-1 h-3 w-3" /> Immutable fingerprint</Badge></div></CardHeader>
    <CardContent className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row"><Select value={periodId} onValueChange={setPeriodId}><SelectTrigger className="sm:max-w-sm"><SelectValue placeholder="Select a closed period" /></SelectTrigger><SelectContent>{(periods.data ?? []).filter((p: any) => p.status === "closed").map((p: any) => <SelectItem key={p.id} value={p.id}>{p.period_start} → {p.period_end}</SelectItem>)}</SelectContent></Select><Button onClick={() => generate.mutate()} disabled={!periodId || generate.isPending}><RefreshCw className={generate.isPending ? "mr-2 h-4 w-4 animate-spin" : "mr-2 h-4 w-4"} />Generate pack</Button></div>
      {selected && <p className="text-xs text-muted-foreground">Only closed periods can be packaged. The source period was closed {selected.closed_at ? new Date(selected.closed_at).toLocaleString() : "without a recorded timestamp"}.</p>}
      {pack?.snapshot && <div className="space-y-3 rounded-lg border border-border p-4"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-sm font-semibold">Period {pack.snapshot.close_period.period_start} → {pack.snapshot.close_period.period_end}</p><p className="text-xs text-muted-foreground">Generated {new Date(pack.snapshot.generated_at).toLocaleString()}</p></div><Badge variant={pack.status === "finalized" ? "default" : "secondary"}>{pack.status}</Badge></div><div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{[["Invoices",pack.snapshot.financials.invoice_count],["Collected",pack.snapshot.financials.collected_amount],["Expenses",pack.snapshot.financials.expenses],["Open work",pack.snapshot.operations.open_work_item_count],["Unmatched bank",pack.snapshot.bank_reconciliation.unmatched_count],["Active exceptions",pack.snapshot.reconciliation.active_at_period_end],["Critical exceptions",pack.snapshot.reconciliation.critical_at_period_end],["Unverified docs",pack.snapshot.evidence.unverified_document_count]].map(([label,value])=><div key={label as string} className="rounded-md border p-2"><p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-1 text-sm font-semibold tabular-nums">{value}</p></div>)}</div><div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={download}><Download className="mr-1 h-3.5 w-3.5" />Download JSON</Button>{pack.status !== "finalized" ? <Button size="sm" onClick={() => finalize.mutate()} disabled={finalize.isPending}><CheckCircle2 className="mr-1 h-3.5 w-3.5" />Finalize & fingerprint</Button> : <Badge variant="outline" className="px-3 py-1">SHA-256: {artifactHash || pack.artifact_sha256}</Badge>}</div><div className="flex items-center gap-2 text-xs text-muted-foreground"><ShieldCheck className="h-3.5 w-3.5" />Snapshot values are derived from authoritative records at generation time.</div></div>}
    </CardContent>
  </Card>;
}
