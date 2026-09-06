import React, { useState } from "react";
import { ShieldAlert, Search, Download, CheckCircle2, AlertTriangle, MinusCircle } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Badge } from "@/shared/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { cn } from "@/shared/lib/utils";
import { useAuditLogs, type AuditLog } from "@/shared/hooks/useAuditLogs";
import { format } from "date-fns";

function exportLogsCsv(logs: AuditLog[]) {
  const header = ["Timestamp", "Actor Email", "Actor Role", "Action", "Entity Type", "Entity Label", "Entity ID"];
  const rows = logs.map((l) => [
    l.created_at,
    l.actor_email ?? "",
    l.actor_role ?? "",
    l.action,
    l.entity_type,
    l.entity_label ?? "",
    l.entity_id ?? "",
  ]);
  const csv = [header, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", `calqulus-audit-log-${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function SecurityAuditCenter({ className }: { className?: string }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Real audit log source: the activity_logs table via the existing useAuditLogs hook.
  const { data: logs, isLoading, error } = useAuditLogs({ limit: 200 });

  const filtered = (logs ?? []).filter((log) => {
    const q = searchTerm.toLowerCase();
    const matchesSearch =
      !q ||
      (log.actor_email?.toLowerCase().includes(q) ?? false) ||
      log.action.toLowerCase().includes(q) ||
      log.entity_type.toLowerCase().includes(q) ||
      (log.entity_label?.toLowerCase().includes(q) ?? false);
    const isFailure = log.action.toLowerCase().includes("failed") || log.action.toLowerCase().includes("flag");
    const matchesStatus =
      statusFilter === "all" || (statusFilter === "failed" && isFailure) || (statusFilter === "flag" && isFailure);
    return matchesSearch && matchesStatus;
  });

  const flaggedCount = (logs ?? []).filter(
    (l) => l.action.toLowerCase().includes("failed") || l.action.toLowerCase().includes("flag")
  ).length;

  return (
    <Card className={cn("border-border/80 bg-card shadow-sm", className)}>
      <CardHeader className="p-4 border-b bg-muted/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-primary" />
            <CardTitle className="text-base font-bold text-foreground">Security & Audit Log</CardTitle>
          </div>
          <CardDescription className="text-xs text-muted-foreground">
            Administrative events, authentication attempts, and resource changes from the platform audit log.
          </CardDescription>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-48">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search audit logs..."
              className="pl-8 text-xs h-8"
            />
          </div>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-8 text-xs w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">All Events</SelectItem>
              <SelectItem value="failed" className="text-xs">Failures</SelectItem>
              <SelectItem value="flag" className="text-xs">Flagged</SelectItem>
            </SelectContent>
          </Select>

          <Button
            size="sm"
            variant="outline"
            onClick={() => exportLogsCsv(filtered)}
            disabled={filtered.length === 0}
            className="h-8 text-xs font-semibold gap-1"
          >
            <Download className="h-3.5 w-3.5" /> Export CSV
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-4 space-y-4">
        {/* Security overview — only show values backed by real data; others labelled unavailable */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-3 rounded-lg border bg-muted/20 border-border/80 text-xs space-y-1">
            <span className="text-muted-foreground block text-[10px] font-bold uppercase flex items-center gap-1">
              <MinusCircle className="h-3 w-3" /> MFA Adoption Rate
            </span>
            <strong className="text-muted-foreground text-base">—</strong>
            <span className="text-[10px] text-muted-foreground block">Not reported by auth provider in this view</span>
          </div>

          <div className="p-3 rounded-lg border border-border/80 text-xs space-y-1">
            <span className="text-muted-foreground block text-[10px] font-bold uppercase">Flagged / Failed Events</span>
            {isLoading ? (
              <Skeleton className="h-5 w-12" />
            ) : (
              <strong className={cn("text-base", flaggedCount > 0 ? "text-warning" : "text-success")}>{flaggedCount}</strong>
            )}
            <span className="text-[10px] text-muted-foreground block">In current result set</span>
          </div>

          <div className="p-3 rounded-lg border bg-muted/20 border-border/80 text-xs space-y-1">
            <span className="text-muted-foreground block text-[10px] font-bold uppercase flex items-center gap-1">
              <MinusCircle className="h-3 w-3" /> Session Timeout
            </span>
            <strong className="text-muted-foreground text-base">—</strong>
            <span className="text-[10px] text-muted-foreground block">JWT policy not exposed in this view</span>
          </div>
        </div>

        {/* Audit Log Table — real data from activity_logs */}
        <div className="border border-border/80 rounded-xl overflow-hidden text-xs">
          {error ? (
            <div className="p-4 text-destructive flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" /> Error loading audit logs. You may not have permission to view this data.
            </div>
          ) : isLoading ? (
            <div className="p-3 space-y-2">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-6 text-center">
              <CheckCircle2 className="h-6 w-6 mx-auto text-muted-foreground/50 mb-2" />
              <p className="text-muted-foreground">{searchTerm || statusFilter !== "all" ? "No matching audit events" : "No audit events recorded yet"}</p>
            </div>
          ) : (
            <table className="w-full text-left">
              <thead className="bg-muted/30 border-b border-border/80 text-[11px] font-bold text-muted-foreground uppercase">
                <tr>
                  <th className="p-3">Actor</th>
                  <th className="p-3">Action</th>
                  <th className="p-3">Resource</th>
                  <th className="p-3 text-right">Timestamp</th>
                  <th className="p-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {filtered.map((log) => {
                  const isFailure = log.action.toLowerCase().includes("failed") || log.action.toLowerCase().includes("flag");
                  return (
                    <tr key={log.id} className="hover:bg-muted/20 transition-colors">
                      <td className="p-3 font-bold text-foreground truncate max-w-[180px]">{log.actor_email ?? "system"}</td>
                      <td className="p-3 font-mono text-[11px]">{log.action}</td>
                      <td className="p-3 text-muted-foreground truncate max-w-[180px]">{log.entity_label ?? log.entity_type}</td>
                      <td className="p-3 text-right text-muted-foreground text-[11px]">{format(new Date(log.created_at), "MMM d, HH:mm")}</td>
                      <td className="p-3 text-center">
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[9px] font-bold h-4 uppercase",
                            isFailure ? "bg-red-500/10 text-red-600 border-red-500/20" : "bg-success/10 text-success border-success/20"
                          )}
                        >
                          {isFailure ? "flag" : "ok"}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
