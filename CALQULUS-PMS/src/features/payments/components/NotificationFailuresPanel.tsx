/**
 * NotificationFailuresPanel.tsx
 *
 * Manager-facing view of the `notification_failures` table.
 *
 * What this is for:
 *   When a payment is successfully recorded, process-payment fans out a
 *   receipt email + SMS + (optional) WhatsApp + manager notification in
 *   parallel. If any of them fail (Resend down, Africa's Talking quota
 *   exhausted, Twilio key revoked, etc) the tenant got their money
 *   recorded but never heard about it — and the manager didn't either.
 *
 *   Every failure is captured in `notification_failures` with the
 *   original request payload. This panel surfaces them so a manager
 *   can see what wasn't delivered and act on it (retry by hand, ring
 *   the tenant, fix the integration).
 *
 * What it shows:
 *   - Count of pending failures by channel
 *   - A table of pending failures with channel, error, timestamp
 *   - An inspect dialog with the original payload and a "mark resolved"
 *     button
 *
 * What it deliberately does NOT do (yet):
 *   - Automatic retry. A 1-click retry would need the manager to confirm
 *     it's safe (e.g. the SMS may have actually been sent and the failure
 *     is in our recording of it). For now, "Mark resolved" + manual
 *     phone call is the safer default. A future batch can add a
 *     guarded "Resend now" button that re-invokes the original edge
 *     function with the saved payload.
 *
 * RLS:
 *   `notification_failures` has a `manager_reads_own_notification_failures`
 *   policy — managers only see their own rows. Webhosts (via the separate
 *   policy) see everything; the webhost view could reuse this component
 *   but doesn't need to today.
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
import {
  AlertCircle, Bell, CheckCircle2, Eye, Mail, MessageCircle, MessageSquare, RefreshCw, Users,
} from "lucide-react";
import { toast } from "@/shared/hooks/use-toast";
import { useActivityLog } from "@/shared/hooks/useActivityLog";

type Channel = "email" | "sms" | "whatsapp" | "manager_notify" | "landlord_notify";

interface NotificationFailureRow {
  id: string;
  transaction_id: string | null;
  tenant_id:      string | null;
  manager_id:     string | null;
  channel:        Channel;
  error:          string | null;
  payload:        Record<string, unknown> | null;
  status:         "pending" | "replayed" | "resolved" | "ignored";
  attempts:       number;
  created_at:     string;
}

const channelMeta: Record<Channel, { label: string; icon: typeof Mail; tone: string }> = {
  email:           { label: "Email",       icon: Mail,           tone: "bg-primary/10 text-primary border-primary/20" },
  sms:             { label: "SMS",         icon: MessageSquare,  tone: "bg-success/10 text-success border-success/20" },
  whatsapp:        { label: "WhatsApp",    icon: MessageCircle,  tone: "bg-green-100 text-green-800 border-green-200" },
  manager_notify:  { label: "Manager",     icon: Bell,           tone: "bg-navy-mid/10 text-navy-mid border-navy-mid/20" },
  landlord_notify: { label: "Landlord",    icon: Users,          tone: "bg-amber-100 text-amber-800 border-amber-200" },
};

export default function NotificationFailuresPanel() {
  const queryClient = useQueryClient();
  const { logActivity } = useActivityLog();
  const [viewingRow, setViewingRow] = useState<NotificationFailureRow | null>(null);
  const [resolveNotes, setResolveNotes] = useState("");

  const { data: rows = [], isLoading, refetch } = useQuery<NotificationFailureRow[]>({
    queryKey: ["notification-failures"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notification_failures")
        .select("*")
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data as NotificationFailureRow[]) ?? [];
    },
    refetchInterval: 60_000,
  });

  // Per-channel counts shown in the summary row
  const counts: Record<Channel, number> = {
    email: 0, sms: 0, whatsapp: 0, manager_notify: 0, landlord_notify: 0,
  };
  for (const r of rows) {
    if (r.channel in counts) counts[r.channel]++;
  }

  const retryMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.functions.invoke("retry-notification-failure", { body: { failureId: id } });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error ?? "Retry failed");
      return data;
    },
    onSuccess: () => {
      toast({ title: "Notification resent", description: "The provider accepted the retry." });
      queryClient.invalidateQueries({ queryKey: ["notification-failures"] });
      setViewingRow(null);
    },
    onError: (err: { message?: string }) => {
      toast({ title: "Retry failed", description: err?.message ?? "Try again later.", variant: "destructive" });
      queryClient.invalidateQueries({ queryKey: ["notification-failures"] });
    },
  });

  const resolveMutation = useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes?: string }) => {
      const { error } = await supabase.rpc("transition_notification_failure_atomic", {
        p_id: id,
        p_status: "resolved",
      });
      if (error) throw error;
      if (notes && notes.trim()) {
        logActivity({
          action: "notification_failure_resolved",
          entityType: "notification_failure",
          entityId: id,
          entityLabel: notes.slice(0, 200),
          metadata: { notes },
        });
      }
    },
    onSuccess: () => {
      toast({ title: "Marked resolved", description: "You can stop tracking this entry." });
      queryClient.invalidateQueries({ queryKey: ["notification-failures"] });
      setViewingRow(null);
      setResolveNotes("");
    },
    onError: (err: { message?: string }) => {
      toast({
        title: "Update failed",
        description: err?.message ?? "Try again.",
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
      {/* ── Summary cards ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {(Object.keys(channelMeta) as Channel[]).map((ch) => {
          const meta = channelMeta[ch];
          const Icon = meta.icon;
          const count = counts[ch];
          return (
            <Card key={ch} className={count > 0 ? "border-red-200" : ""}>
              <CardContent className="p-3 flex items-center gap-2">
                <Icon className={`h-6 w-6 ${count > 0 ? "text-red-500" : "text-slate-400"}`} />
                <div>
                  <div className={`text-lg font-bold ${count > 0 ? "text-red-700" : "text-slate-700"}`}>
                    {count}
                  </div>
                  <div className="text-xs text-muted-foreground">{meta.label}</div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* ── Table ─────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-warning" />
              Receipt notification failures
            </CardTitle>
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-10 text-center text-muted-foreground">Loading…</div>
          ) : rows.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground">
              <CheckCircle2 className="h-10 w-10 mx-auto mb-2 text-green-500" />
              No pending failures. Every recent payment notification was delivered.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Channel</TableHead>
                    <TableHead>Error</TableHead>
                    <TableHead>Attempts</TableHead>
                    <TableHead>When</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => {
                    const meta = channelMeta[row.channel];
                    const Icon = meta.icon;
                    return (
                      <TableRow key={row.id}>
                        <TableCell>
                          <Badge variant="outline" className={`gap-1 ${meta.tone}`}>
                            <Icon className="h-3 w-3" />
                            {meta.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-[400px] truncate text-sm" title={row.error ?? ""}>
                          {row.error ?? "—"}
                        </TableCell>
                        <TableCell className="text-sm">{row.attempts}</TableCell>
                        <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                          {new Date(row.created_at).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => { setViewingRow(row); setResolveNotes(""); }}
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

      {/* ── Inspect / resolve dialog ──────────────────────────────── */}
      <Dialog open={!!viewingRow} onOpenChange={(open) => { if (!open) { setViewingRow(null); setResolveNotes(""); } }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-warning" />
              Notification failure
            </DialogTitle>
            <DialogDescription>
              The payment was recorded but this notification didn't go through.
              Decide whether to contact the tenant manually, then mark resolved.
            </DialogDescription>
          </DialogHeader>

          {viewingRow && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-muted-foreground">Channel</div>
                  <div className="font-medium">{channelMeta[viewingRow.channel].label}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Attempts</div>
                  <div>{viewingRow.attempts}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Created</div>
                  <div>{new Date(viewingRow.created_at).toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Transaction</div>
                  <div className="font-mono text-xs">{viewingRow.transaction_id ?? "—"}</div>
                </div>
              </div>

              <div>
                <div className="text-sm font-medium mb-1">Error</div>
                <div className="rounded-md bg-amber-50 border border-amber-200 p-3 text-sm text-amber-900 whitespace-pre-wrap break-words">
                  {viewingRow.error ?? "(no error message)"}
                </div>
              </div>

              <div>
                <div className="text-sm font-medium mb-1">Original payload</div>
                <pre className="rounded-md bg-card text-foreground p-3 text-xs overflow-auto max-h-64">
                  {renderPayload(viewingRow.payload)}
                </pre>
              </div>

              <div>
                <div className="text-sm font-medium mb-1">Notes (optional)</div>
                <Textarea
                  value={resolveNotes}
                  onChange={(e) => setResolveNotes(e.target.value)}
                  placeholder="e.g. Called tenant — confirmed they got the SMS receipt from Safaricom directly."
                  rows={2}
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setViewingRow(null)}>Close</Button>
            {viewingRow && (
              <>
                <Button
                  variant="outline"
                  onClick={() => retryMutation.mutate(viewingRow.id)}
                  disabled={retryMutation.isPending || resolveMutation.isPending || viewingRow.attempts >= 3}
                >
                  <RefreshCw className={`h-4 w-4 mr-1 ${retryMutation.isPending ? "animate-spin" : ""}`} />
                  {retryMutation.isPending ? "Retrying…" : "Retry now"}
                </Button>
                <Button
                  onClick={() => resolveMutation.mutate({ id: viewingRow.id, notes: resolveNotes })}
                  disabled={resolveMutation.isPending || retryMutation.isPending}
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
