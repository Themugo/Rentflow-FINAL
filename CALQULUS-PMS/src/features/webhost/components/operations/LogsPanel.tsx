import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ScrollText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  levelClass,
  parseLogRows,
  type LogLevel,
  type LogRowInput,
  type ParsedLogRow,
} from "@/features/webhost/lib/operations";
import { isTenantEntityType } from "@/features/webhost/lib/adminSecurity";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { cn } from "@/shared/lib/utils";

type Filter = "all" | LogLevel;

const LEVEL_ORDER: LogLevel[] = ["debug", "info", "warn", "error", "critical"];

export function LogsPanel() {
  const [filter, setFilter] = useState<Filter>("all");

  const { data: logsRaw = [], isLoading } = useQuery<LogRowInput[]>({
    queryKey: ["platform-admin-logs"],
    queryFn: async () => {
      // Structured platform logs from the observability logger —
      // entity_type = 'log', action = `{level}:{component}:{action}`.
      const { data, error } = await supabase
        .from("activity_logs")
        .select("id, action, entity_type, entity_label, metadata, created_at")
        .eq("entity_type", "log")
        .order("created_at", { ascending: false })
        .limit(80);
      if (error) throw error;
      const rows = ((data ?? []) as LogRowInput[]).filter((row) => !isTenantEntityType(row.entity_type));
      return rows;
    },
    staleTime: 15_000,
  });
  const logs = useMemo(() => parseLogRows(logsRaw), [logsRaw]);
  const visible = useMemo(
    () => (filter === "all" ? logs : logs.filter((row) => row.level === filter)),
    [logs, filter],
  );

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2.5">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Logs</h2>
        <div className="flex items-center gap-1" role="group" aria-label="Filter logs">
          {(["all", ...LEVEL_ORDER] as Filter[]).map((level) => (
            <button
              key={level}
              type="button"
              onClick={() => setFilter(level)}
              aria-pressed={filter === level}
              className={cn(
                "min-h-8 rounded-md px-2.5 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                filter === level ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {level === "all" ? "All" : level}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-1.5 p-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-7 rounded" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <p className="flex items-center gap-2 px-4 py-6 text-xs text-muted-foreground">
          <ScrollText className="h-4 w-4" />
          No structured log entries
          {filter !== "all" ? ` at level "${filter}"` : ""}.
        </p>
      ) : (
        <div className="max-h-96 overflow-y-auto">
          <table className="w-full text-left font-mono text-[11px]">
            <thead className="sticky top-0 bg-muted/60 backdrop-blur-sm">
              <tr className="border-b border-border text-[10px] uppercase tracking-wide text-muted-foreground">
                <th className="whitespace-nowrap px-3 py-2 font-medium">Timestamp</th>
                <th className="px-3 py-2 font-medium">Level</th>
                <th className="hidden px-3 py-2 font-medium sm:table-cell">Source</th>
                <th className="px-3 py-2 font-medium">Message</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {visible.map((row: ParsedLogRow) => (
                <tr key={row.id} className="align-top hover:bg-muted/30">
                  <td className="whitespace-nowrap px-3 py-2 tabular-nums text-muted-foreground">
                    {row.timestamp.replace("T", " ").slice(0, 19) + "Z"}
                  </td>
                  <td className="px-3 py-2">
                    <span className={cn("inline-block rounded px-1.5 py-0.5 font-semibold", levelClass(row.level))}>
                      {row.level.toUpperCase()}
                    </span>
                  </td>
                  <td className="hidden whitespace-nowrap px-3 py-2 sm:table-cell">
                    {row.source}
                  </td>
                  <td className="max-w-0 truncate px-3 py-2" title={row.message}>
                    {row.message}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!isLoading && visible.length > 0 ? (
        <p className="border-t border-border px-3 py-1.5 font-mono text-[10px] text-muted-foreground">
          {visible.length} of {logs.length} entries · newest first · secrets masked
        </p>
      ) : null}
    </section>
  );
}
