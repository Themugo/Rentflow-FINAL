import { AlertTriangle, CheckCircle2, CircleAlert, XCircle } from "lucide-react";
import { INFRA_STATUS, type InfraStatus } from "@/features/webhost/lib/infrastructure";
import { cn } from "@/shared/lib/utils";

function StatusIcon({ status, className }: { status: InfraStatus; className?: string }) {
  const cls = cn("h-3.5 w-3.5", INFRA_STATUS[status].text, className);
  if (status === "operational") return <CheckCircle2 className={cls} />;
  if (status === "down") return <XCircle className={cls} />;
  if (status === "degraded") return <AlertTriangle className={cls} />;
  return <CircleAlert className={cls} />;
}

/** Status rendered as dot + icon + text — never colour alone. */
export function StatusCell({ status, className }: { status: InfraStatus; className?: string }) {
  const meta = INFRA_STATUS[status];
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span aria-hidden className={cn("h-2 w-2 rounded-full", meta.dot)} />
      <StatusIcon status={status} />
      <span className={cn("text-xs font-semibold", meta.text)}>{meta.label}</span>
    </span>
  );
}
