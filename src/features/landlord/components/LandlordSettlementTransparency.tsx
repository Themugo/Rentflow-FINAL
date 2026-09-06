import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, ExternalLink, CheckCircle2, Clock3, Banknote } from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/features/auth/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { EmptyState } from "@/shared/components/ui/empty-state";
import { ErrorState } from "@/shared/components/ui/error-state";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { formatKes } from "@/features/landlord/lib/formatKes";

type SettlementRow = {
  batch_id: string;
  batch_status: string;
  period_start: string;
  period_end: string;
  property_id: string;
  property_name: string;
  payout_request_id: string;
  gross_amount: number;
  fee_amount: number;
  net_amount: number;
  payout_status: string;
  settlement_reference: string | null;
  approved_at: string | null;
  settled_at: string | null;
  requested_at: string;
  paid_at: string | null;
  notes: string | null;
};

type TransparencyPayload = {
  summary: { approved_net: number; settled_net: number; settled_count: number; pending_count: number };
  settlements: SettlementRow[];
};

function downloadCsv(rows: SettlementRow[]) {
  const headers = ["Property", "Period start", "Period end", "Gross", "Fee", "Net", "Status", "Settlement reference", "Settled at"];
  const esc = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  const csv = [headers.join(","), ...rows.map(r => [r.property_name,r.period_start,r.period_end,r.gross_amount,r.fee_amount,r.net_amount,r.batch_status,r.settlement_reference,r.settled_at].map(esc).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `calqulus-owner-settlements-${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

const statusIcon = (status: string) => status === "settled" ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Clock3 className="h-3.5 w-3.5" />;

export default function LandlordSettlementTransparency() {
  const { user } = useAuth();
  const query = useQuery({
    queryKey: ["landlord-settlement-transparency", user?.id],
    queryFn: async (): Promise<TransparencyPayload> => {
      if (!user) return { summary: { approved_net: 0, settled_net: 0, settled_count: 0, pending_count: 0 }, settlements: [] };
      const { data, error } = await supabase.rpc("get_landlord_settlement_transparency" as never, { p_landlord_user_id: user.id });
      if (error) throw error;
      return (data ?? { summary: { approved_net: 0, settled_net: 0, settled_count: 0, pending_count: 0 }, settlements: [] }) as TransparencyPayload;
    },
    enabled: Boolean(user),
  });
  const rows = query.data?.settlements ?? [];
  const summary = query.data?.summary ?? { approved_net: 0, settled_net: 0, settled_count: 0, pending_count: 0 };
  const hasRows = rows.length > 0;
  const latestSettled = useMemo(() => rows.find(r => r.batch_status === "settled"), [rows]);

  if (query.isLoading) return <Skeleton className="h-80 w-full" />;
  if (query.isError) return <ErrorState title="Couldn't load settlement history" onRetry={() => void query.refetch()} />;

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <Metric label="Settled to you" value={formatKes(Number(summary.settled_net))} />
        <Metric label="Approved / pending" value={formatKes(Number(summary.approved_net))} />
        <Metric label="Settled batches" value={String(summary.settled_count)} />
      </div>

      <Card className="enterprise-card">
        <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2 text-base"><Banknote className="h-4 w-4" /> Settlement history</CardTitle>
            <CardDescription>Only your own payout requests and settlement outcomes are shown.</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => downloadCsv(rows)} disabled={!hasRows}>
            <Download className="mr-2 h-4 w-4" /> Export CSV
          </Button>
        </CardHeader>
        <CardContent>
          {!hasRows ? (
            <EmptyState icon={Banknote} title="No settlement record yet" description="Approved and settled owner payouts will appear here." />
          ) : (
            <div className="space-y-3">
              {rows.map(row => (
                <div key={`${row.batch_id}-${row.payout_request_id}`} className="rounded-lg border border-border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{row.property_name}</p>
                      <p className="text-xs text-muted-foreground mt-1">{format(new Date(row.period_start), "dd MMM yyyy")} – {format(new Date(row.period_end), "dd MMM yyyy")}</p>
                    </div>
                    <Badge variant={row.batch_status === "settled" ? "default" : "outline"} className="inline-flex items-center gap-1">
                      {statusIcon(row.batch_status)} {row.batch_status}
                    </Badge>
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-3">
                    <Metric label="Gross" value={formatKes(Number(row.gross_amount))} compact />
                    <Metric label="Fee" value={formatKes(Number(row.fee_amount))} compact />
                    <Metric label="Net" value={formatKes(Number(row.net_amount))} compact />
                  </div>
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span>{row.batch_status === "settled" && row.settled_at ? `Settled ${format(new Date(row.settled_at), "dd MMM yyyy, HH:mm")}` : "Awaiting settlement"}</span>
                    {row.settlement_reference ? <span className="font-medium text-foreground">Reference: {row.settlement_reference}</span> : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {latestSettled ? (
        <div className="rounded-xl border border-border bg-muted/20 p-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">Latest settlement confirmed</p>
            <p className="text-xs text-muted-foreground mt-1">{latestSettled.property_name} · {formatKes(Number(latestSettled.net_amount))}{latestSettled.settlement_reference ? ` · ${latestSettled.settlement_reference}` : ""}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => window.print()}><ExternalLink className="mr-2 h-4 w-4" /> Print statement</Button>
        </div>
      ) : null}
    </div>
  );
}

function Metric({ label, value, compact = false }: { label: string; value: string; compact?: boolean }) {
  return <div className={`rounded-lg border border-border bg-muted/20 ${compact ? "p-2" : "p-3"}`}><p className="text-[11px] text-muted-foreground">{label}</p><p className={`${compact ? "text-sm" : "text-lg"} font-semibold tabular-nums mt-0.5`}>{value}</p></div>;
}
