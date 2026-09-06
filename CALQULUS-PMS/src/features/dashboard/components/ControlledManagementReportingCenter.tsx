import React, { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useManagerScope } from "@/shared/hooks/useManagerScope";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { Separator } from "@/shared/components/ui/separator";
import { FileCheck2, RefreshCw, ShieldCheck, Download, LockKeyhole } from "lucide-react";
import { toast } from "sonner";

const sha256 = async (value: string) => {
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
};

const ControlledManagementReportingCenter: React.FC = () => {
  const { managerId } = useManagerScope();
  const queryClient = useQueryClient();
  const [periodId, setPeriodId] = useState("");
  const [statementType, setStatementType] = useState<"management" | "compliance">("management");
  const [busy, setBusy] = useState(false);

  const { data: periods = [], isLoading: periodsLoading } = useQuery({
    queryKey: ["controlled-reporting-periods", managerId],
    enabled: !!managerId,
    queryFn: async () => {
      const { data, error } = await supabase.from("financial_close_periods").select("id,period_start,period_end,status").eq("manager_id", managerId).eq("status", "closed").order("period_end", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: statements = [], isLoading } = useQuery({
    queryKey: ["controlled-statements", managerId],
    enabled: !!managerId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_manager_controlled_statements", { p_manager_id: managerId });
      if (error) throw error;
      return Array.isArray(data) ? data : [];
    },
  });

  const selectedPeriod = useMemo(() => periods.find((p) => p.id === periodId), [periods, periodId]);

  const generate = async () => {
    if (!managerId || !periodId) return;
    setBusy(true);
    try {
      const { error } = await supabase.rpc("generate_controlled_statement_atomic", {
        p_manager_id: managerId,
        p_close_period_id: periodId,
        p_statement_type: statementType,
      });
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ["controlled-statements", managerId] });
      toast.success("Controlled statement generated");
    } catch (error: any) {
      toast.error(error?.message ?? "Unable to generate statement");
    } finally { setBusy(false); }
  };

  const release = async (statement: any) => {
    setBusy(true);
    try {
      const artifact = await sha256(JSON.stringify(statement.snapshot));
      const { error } = await supabase.rpc("release_controlled_statement_atomic", { p_statement_id: statement.id, p_artifact_sha256: artifact });
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ["controlled-statements", managerId] });
      toast.success("Statement released and fingerprinted");
    } catch (error: any) {
      toast.error(error?.message ?? "Unable to release statement");
    } finally { setBusy(false); }
  };

  const download = (statement: any) => {
    const blob = new Blob([JSON.stringify(statement.snapshot, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `calqulus-${statement.statement_type}-statement-${statement.period_end}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card className="enterprise-card">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="section-title flex items-center gap-2"><FileCheck2 className="h-5 w-5" /> Controlled Management Reporting</CardTitle>
            <CardDescription>Statements are released only from a finalized audit pack and an approved assurance review. No independent report calculations are introduced.</CardDescription>
          </div>
          <Badge variant="outline" className="gap-1"><LockKeyhole className="h-3 w-3" /> Controlled</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto] items-end">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Closed period</p>
            <Select value={periodId} onValueChange={setPeriodId} disabled={periodsLoading}>
              <SelectTrigger><SelectValue placeholder="Select a closed period" /></SelectTrigger>
              <SelectContent>{periods.map((p) => <SelectItem key={p.id} value={p.id}>{p.period_start} → {p.period_end}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Statement</p>
            <Select value={statementType} onValueChange={(v: "management" | "compliance") => setStatementType(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="management">Management statement</SelectItem><SelectItem value="compliance">Compliance summary</SelectItem></SelectContent>
            </Select>
          </div>
          <Button onClick={generate} disabled={!periodId || busy} className="gap-2"><RefreshCw className="h-4 w-4" /> Generate</Button>
        </div>

        {selectedPeriod && <p className="text-xs text-muted-foreground">Selected period is closed and eligible for controlled reporting. Generation will still fail unless the period has both a finalized audit pack and an approved assurance review.</p>}
        <Separator />
        {isLoading ? <p className="text-sm text-muted-foreground">Loading controlled statements…</p> : statements.length === 0 ? <p className="text-sm text-muted-foreground">No controlled statements have been generated.</p> : (
          <div className="space-y-3">{statements.map((s: any) => (
            <div key={s.id} className="rounded-lg border border-border p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div><p className="font-semibold capitalize">{s.statement_type} statement</p><p className="text-xs text-muted-foreground">{s.period_start} → {s.period_end}</p></div>
                <Badge variant={s.status === "released" ? "default" : "secondary"}>{s.status}</Badge>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
                <div><p className="text-xs text-muted-foreground">Control score</p><p className="font-semibold">{s.snapshot?.control_basis?.control_score ?? "—"}/100</p></div>
                <div><p className="text-xs text-muted-foreground">Invoiced</p><p className="font-semibold">{Number(s.snapshot?.financials?.invoiced_amount ?? 0).toLocaleString()}</p></div>
                <div><p className="text-xs text-muted-foreground">Collected</p><p className="font-semibold">{Number(s.snapshot?.financials?.collected_amount ?? 0).toLocaleString()}</p></div>
                <div><p className="text-xs text-muted-foreground">Unmatched bank</p><p className="font-semibold">{s.snapshot?.bank_reconciliation?.unmatched_count ?? 0}</p></div>
                <div><p className="text-xs text-muted-foreground">Recon exceptions</p><p className="font-semibold">{s.snapshot?.reconciliation?.active_at_period_end ?? 0}</p></div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => download(s)} className="gap-1"><Download className="h-3 w-3" /> Export snapshot</Button>
                {s.status === "draft" && <Button size="sm" onClick={() => release(s)} disabled={busy} className="gap-1"><ShieldCheck className="h-3 w-3" /> Release & fingerprint</Button>}
              </div>
              {s.artifact_sha256 && <p className="text-[11px] text-muted-foreground break-all">SHA-256: {s.artifact_sha256}</p>}
            </div>
          ))}</div>
        )}
      </CardContent>
    </Card>
  );
};

export default ControlledManagementReportingCenter;
