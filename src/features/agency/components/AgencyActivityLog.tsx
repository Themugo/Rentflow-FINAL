import { Activity, Bell, Building2, CreditCard, FileSignature, FileText, UserRound, Users, Wrench } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { useAgencyActivityLog } from "@/features/agency/lib/useAgencyActivityLog";

const ICONS: Record<string, typeof Activity> = {
  tenant: Users,
  property: Building2,
  lease: FileText,
  invoice: CreditCard,
  payment: CreditCard,
  contract: FileSignature,
  maintenance: Wrench,
  notice: Bell,
  user: UserRound,
};

export default function AgencyActivityLog({ landlordUserId }: { landlordUserId?: string }) {
  const { data = [], isLoading, isError } = useAgencyActivityLog(8, landlordUserId);

  if (isLoading) {
    return <div className="space-y-1">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>;
  }

  if (isError) {
    return <div className="py-6 text-center text-xs text-muted-foreground">Activity is temporarily unavailable.</div>;
  }

  if (!data.length) {
    return <div className="py-6 text-center text-xs text-muted-foreground">No Agency activity recorded yet.</div>;
  }

  return (
    <div className="space-y-1">
      {data.map((log) => {
        const Icon = ICONS[log.entity_type ?? ""] ?? Activity;
        return (
          <div key={log.id} className="flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-muted/40">
            <span className="h-2 w-2 shrink-0 rounded-full bg-[var(--portal-accent)]" />
            <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs">
                <span className="font-medium">{log.action.replace(/_/g, " ")}</span>
                {log.entity_label ? <span className="text-muted-foreground"> · {log.entity_label}</span> : null}
              </p>
              <p className="text-xs text-muted-foreground">
                {log.actor_email ?? "System"} · {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
