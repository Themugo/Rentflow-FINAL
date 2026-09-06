/**
 * WebhookDeadLetterPanel.tsx
 *
 * Webhost-only view onto the `webhook_dead_letter` table.
 *
 * What this is for:
 *   When a payment provider (M-Pesa / a bank / Stripe) successfully takes
 *   money from a tenant but our handler failed to reconcile it on our side
 *   (DB blip, process-payment crashed, downstream function broken, etc),
 *   the failure is persisted to `webhook_dead_letter` instead of vanishing.
 *
 *   Without this panel, those rows are invisible unless someone runs SQL
 *   against Postgres by hand — which defeats the point of having a safety
 *   net. This is the operator UI for that safety net.
 *
 * What it shows:
 *   - Count of unresolved entries per source (mpesa / bank / stripe)
 *   - A table of pending failures with the external reference, error
 *     message, and timestamp
 *   - A button to view the raw payload (in a dialog) so an operator can
 *     decide whether to replay the original request or just mark it
 *     resolved after fixing the underlying state by hand
 *   - A button to mark an entry resolved with optional notes
 *
 * What it deliberately does NOT do:
 *   - Auto-replay. Replaying a payment-side webhook means re-invoking the
 *     edge function with the same payload — that's a money-moving action
 *     and a webhost should make the call by hand. We surface the payload
 *     so they can copy it into a curl command or use Supabase's
 *     "Invoke function" UI directly.
 *   - Delete rows. Resolved entries stay on the record forever — an
 *     auditable history of every reconciliation failure the platform
 *     has had. Compliance and post-mortem use.
 *
 * RLS:
 *   The `webhook_dead_letter` table is webhost-only by RLS (see
 *   `20260519000000_webhook_dead_letter_and_idempotency.sql`). This panel
 *   should only render inside the webhost dashboard.
 */

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/shared/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/components/ui/table";
import { Textarea } from "@/shared/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import {
  AlertTriangle, Banknote, CheckCircle2, CreditCard, Eye, Filter, RefreshCw, Smartphone,
} from "lucide-react";
import { toast } from "@/shared/hooks/use-toast";

interface DeadLetterRow {
  id: string;
  source: "mpesa" | "bank" | "stripe";
  external_ref: string | null;
  payload: unknown;
  error: string | null;
  status: "pending" | "replayed" | "resolved" | "ignored";
  created_at: string;
  resolved_at: string | null;
  notes: string | null;
}

type SourceFilter = "all" | "mpesa" | "bank" | "stripe";
type StatusFilter = "pending" | "all" | "resolved" | "ignored";

const sourceMeta: Record<DeadLetterRow["source"], { label: string; icon: typeof Smartphone; tone: string }> = {
  mpesa:  { label: "M-Pesa", icon: Smartphone,  tone: "bg-success/15 text-success border-success/20" },
  bank:   { label: "Bank",   icon: Banknote,    tone: "bg-[hsl(214_73%_48%/0.12)] text-[hsl(214_73%_35%)] border-[hsl(214_73%_48%/0.25)]" },
  stripe: { label: "Stripe", icon: CreditCard,  tone: "bg-[hsl(218_58%_38%/0.12)] text-[hsl(218_58%_30%)] border-[hsl(218_58%_38%/0.25)]" },
};

const statusMeta: Record<DeadLetterRow["status"], { label: string; tone: string }> = {
  pending:  { label: "Pending",  tone: "bg-destructive/15 text-destructive border-red-200" },
  replayed: { label: "Replayed", tone: "bg-warning/10 text-warning border-amber-200" },
  resolved: { label: "Resolved", tone: "bg-green-100 text-green-800 border-green-200" },
  ignored:  { label: "Ignored",  tone: "bg-secondary-background text-secondary-foreground border-border" },
};

export default function WebhookDeadLetterPanel() {
  const queryClient = useQueryClient();
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("pending");
  const [viewingRow, setViewingRow] = useState<DeadLetterRow | null>(null);
  const [resolveNotes, setResolveNotes] = useState("");

  const { data: rows = [], isLoading, refetch } = useQuery<DeadLetterRow[]>({
    queryKey: ["webhook-dead-letter", sourceFilter, statusFilter],
    queryFn: async () => {
      let q = supabase
        .from("webhook_dead_letter")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (sourceFilter !== "all") q = q.eq("source", sourceFilter);
      if (statusFilter !== "all") q = q.eq("status", statusFilter);
      const { data, error } = await q;
      if (error) throw error;
      return (data as DeadLetterRow[]) ?? [];
    },
    refetchInterval: 30_000, // mirror ErrorLogsTab — operators leave this tab open
  });

  // Counts shown in the summary cards are always for the PENDING set
  // (i.e. work still queued), independent of the active filter, so a
  // webhost can see "I have 3 pending mpesa failures" no matter what
  // they're currently looking at.
  const { data: counts } = useQuery({
    queryKey: ["webhook-dead-letter-counts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("webhook_dead_letter")
        .select("source")
        .eq("status", "pending");
      if (error) throw error;
      const c = { mpesa: 0, bank: 0, stripe: 0 };
      for (const row of (data ?? []) as { source: keyof typeof c }[]) {
        if (row.source in c) c[row.source]++;
      }
      return c;
    },
    refetchInterval: 30_000,
  });

  const resolveMutation = useMutation({
    mutationFn: async ({ id, status, notes }: { id: string; status: "resolved" | "ignored"; notes?: string }) => {
      const { error } = await supabase.rpc("transition_webhook_dead_letter_atomic", {
        p_id: id,
        p_status: status,
        p_notes: notes ?? null,
      });
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      toast({
        title: vars.status === "resolved" ? "Marked resolved" : "Marked ignored",
        description: "The entry has been updated.",
      });
      queryClient.invalidateQueries({ queryKey: ["webhook-dead-letter"] });
      queryClient.invalidateQueries({ queryKey: ["webhook-dead-letter-counts"] });
      setViewingRow(null);
      setResolveNotes("");
    },
    onError: (err: { message?: string }) => {
      toast({
        title: "Update failed",
        description: err?.message ?? "Try again or contact engineering.",
        variant: "destructive",
      });
    },
  });

  const renderPayload = (p: unknown) => {
    try {
      return JSON.stringify(p, null, 2);
    } catch {
      return String(p);
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Summary cards (always-pending counts) ──────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {(["mpesa", "bank", "stripe"] as const).map((src) => {
          const meta = sourceMeta[src];
          const Icon = meta.icon;
          const count = counts?.[src] ?? 0;
          return (
            <Card key={src} className={count > 0 ? "border-red-200" : ""}>
              <CardContent className="p-4 flex items-center gap-3">
                <Icon className={`h-8 w-8 ${count > 0 ? "text-destructive" : "text-muted-foreground"}`} />
                <div>
                  <div className={`text-2xl font-bold ${count > 0 ? "text-destructive" : "text-secondary-foreground"}`}>
                    {count}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Pending {meta.label} failures
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* ── Filter + refresh bar ────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Webhook Dead-Letter Queue
            </CardTitle>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={sourceFilter} onValueChange={(v) => setSourceFilter(v as SourceFilter)}>
                <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All sources</SelectItem>
                  <SelectItem value="mpesa">M-Pesa</SelectItem>
                  <SelectItem value="bank">Bank</SelectItem>
                  <SelectItem value="stripe">Stripe</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
                <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="ignored">Ignored</SelectItem>
                  <SelectItem value="all">All</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading}>
                <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-10 text-center text-muted-foreground">Loading…</div>
          ) : rows.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground">
              <CheckCircle2 className="h-10 w-10 mx-auto mb-2 text-green-500" />
              No {statusFilter !== "all" ? statusFilter : ""} entries.
              {statusFilter === "pending" && " The queue is clear."}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Source</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>Error</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>When</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => {
                    const sm = sourceMeta[row.source];
                    const Icon = sm.icon;
                    return (
                      <TableRow key={row.id}>
                        <TableCell>
                          <Badge variant="outline" className={`gap-1 ${sm.tone}`}>
                            <Icon className="h-3 w-3" />
                            {sm.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs max-w-[180px] truncate">
                          {row.external_ref ?? "—"}
                        </TableCell>
                        <TableCell className="max-w-[300px] truncate text-sm" title={row.error ?? ""}>
                          {row.error ?? "—"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={statusMeta[row.status].tone}>
                            {statusMeta[row.status].label}
                          </Badge>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                          {new Date(row.created_at).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => { setViewingRow(row); setResolveNotes(row.notes ?? ""); }}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            Inspect
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Inspect / resolve dialog ────────────────────────────────── */}
      <Dialog open={!!viewingRow} onOpenChange={(open) => { if (!open) { setViewingRow(null); setResolveNotes(""); } }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Dead-letter entry
            </DialogTitle>
            <DialogDescription>
              The upstream provider succeeded but our handler did not. Review the payload to
              decide whether to replay the request manually (by re-invoking the edge function
              with this payload) or mark resolved after fixing the underlying state by hand.
            </DialogDescription>
          </DialogHeader>

          {viewingRow && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-muted-foreground">Source</div>
                  <div className="font-medium">{sourceMeta[viewingRow.source].label}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">External reference</div>
                  <div className="font-mono text-xs">{viewingRow.external_ref ?? "—"}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Status</div>
                  <div>{statusMeta[viewingRow.status].label}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Created</div>
                  <div>{new Date(viewingRow.created_at).toLocaleString()}</div>
                </div>
              </div>

              <div>
                <div className="text-sm font-medium mb-1">Error</div>
                <div className="rounded-md bg-destructive/10 border border-red-200 p-3 text-sm text-destructive whitespace-pre-wrap break-words">
                  {viewingRow.error ?? "(no error message)"}
                </div>
              </div>

              <div>
                <div className="text-sm font-medium mb-1">Payload</div>
                <pre className="rounded-md bg-card text-foreground p-3 text-xs overflow-auto max-h-64">
                  {renderPayload(viewingRow.payload)}
                </pre>
              </div>

              <div>
                <div className="text-sm font-medium mb-1">Notes (optional)</div>
                <Textarea
                  value={resolveNotes}
                  onChange={(e) => setResolveNotes(e.target.value)}
                  placeholder="e.g. Reconciled by hand — invoice INV-001 marked paid manually."
                  rows={2}
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setViewingRow(null)}>Close</Button>
            {viewingRow && viewingRow.status === "pending" && (
              <>
                <Button
                  variant="outline"
                  onClick={() => resolveMutation.mutate({ id: viewingRow.id, status: "ignored", notes: resolveNotes })}
                  disabled={resolveMutation.isPending}
                >
                  Ignore
                </Button>
                <Button
                  onClick={() => resolveMutation.mutate({ id: viewingRow.id, status: "resolved", notes: resolveNotes })}
                  disabled={resolveMutation.isPending}
                >
                  <CheckCircle2 className="h-4 w-4 mr-1" />
                  Mark resolved
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
