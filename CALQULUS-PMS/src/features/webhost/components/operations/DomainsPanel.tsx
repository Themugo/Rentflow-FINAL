import { useMemo } from "react";
import { Globe } from "lucide-react";
import {
  getApplicationFacts,
  getApplicationRuntime,
} from "@/features/webhost/lib/infrastructure";
import { useAdminHealthProbes } from "@/features/webhost/hooks/useAdminHealthProbes";
import { cn } from "@/shared/lib/utils";

export function DomainsPanel() {
  const { data: probes = [] } = useAdminHealthProbes();

  const app = useMemo(() => {
    const facts = getApplicationFacts(
      { PROD: import.meta.env.PROD, VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL as string | undefined },
      window.location,
    );
    return getApplicationRuntime(probes, facts);
  }, [probes]);

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2.5">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Domains</h2>
        <Globe className="h-3.5 w-3.5 text-[var(--portal-accent)]" aria-hidden />
      </div>
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted-foreground">
            <th className="px-4 py-2.5 font-medium">Domain</th>
            <th className="hidden px-4 py-2.5 font-medium sm:table-cell">Application</th>
            <th className="px-4 py-2.5 font-medium">Status</th>
            <th className="px-4 py-2.5 font-medium">SSL</th>
            <th className="hidden px-4 py-2.5 font-medium md:table-cell">Expiry</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          <tr className="align-middle">
            <td className="px-4 py-2.5">
              <p className="font-mono text-xs font-semibold">{app.domain}</p>
            </td>
            <td className="hidden px-4 py-2.5 text-xs sm:table-cell">{app.name}</td>
            <td className="px-4 py-2.5">
              <span className="inline-flex items-center gap-1.5 text-xs">
                <span aria-hidden className="h-2 w-2 rounded-full bg-success" />
                <span className="font-semibold text-success">Serving</span>
              </span>
            </td>
            <td className="px-4 py-2.5">
              <span
                className={cn(
                  "font-mono text-xs",
                  app.protocol === "https" ? "text-success" : "text-warning-foreground",
                )}
              >
                {app.protocol.toUpperCase()}
              </span>
            </td>
            <td className="hidden px-4 py-2.5 text-xs text-muted-foreground md:table-cell">Not available</td>
          </tr>
        </tbody>
      </table>
      <p className="border-t border-border px-4 py-2 text-[11px] text-muted-foreground">
        DNS and certificate records are managed outside CALQULUS and are not instrumented here.
      </p>
    </section>
  );
}
