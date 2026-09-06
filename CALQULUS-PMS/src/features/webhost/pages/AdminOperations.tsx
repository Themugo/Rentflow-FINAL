import { useMemo } from "react";
import { ShieldAlert } from "lucide-react";
import WebhostLayout from "@/features/webhost/components/WebhostLayout";
import { DomainsPanel } from "@/features/webhost/components/operations/DomainsPanel";
import { ServicesPanel } from "@/features/webhost/components/operations/ServicesPanel";
import { MonitoringPanel } from "@/features/webhost/components/operations/MonitoringPanel";
import { LogsPanel } from "@/features/webhost/components/operations/LogsPanel";
import { getApplicationFacts } from "@/features/webhost/lib/infrastructure";

export default function AdminOperations() {
  const environment = useMemo(
    () =>
      getApplicationFacts(
        { PROD: import.meta.env.PROD, VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL as string | undefined },
        window.location,
      ).environment,
    [],
  );

  return (
    <WebhostLayout
      title="Operations"
      description="Domains, services, monitoring, and structured logs — without tenant records."
    >
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <DomainsPanel />
          <MonitoringPanel />
          <ServicesPanel environment={environment} />
        </div>
        <LogsPanel />
        <p className="flex items-start gap-2 text-xs text-muted-foreground">
          <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--portal-accent)]" />
          Secret-shaped values in log metadata are masked on this desk. Tenant identities stay hidden.
        </p>
      </div>
    </WebhostLayout>
  );
}
