import { History, Lock, Network, ShieldCheck, type LucideIcon } from "lucide-react";
import { TRUST_POINTS } from "@/features/marketing/publicConfig";

const TRUST_ICONS: Record<(typeof TRUST_POINTS)[number]["title"], LucideIcon> = {
  "Role-based": Lock,
  Secure: ShieldCheck,
  Auditable: History,
  Connected: Network,
};

/** Compact trust row — small icon, short title, one sentence per pillar. */
export function TrustSection() {
  return (
    <section className="border-b border-border bg-background py-8 sm:py-9">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <ul className="grid gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-4">
          {TRUST_POINTS.map((point) => {
            const Icon = TRUST_ICONS[point.title];
            return (
              <li key={point.title} className="flex items-start gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Icon className="h-4 w-4" aria-hidden />
                </span>
                <div className="min-w-0">
                  <h3 className="font-heading text-sm font-semibold text-foreground">{point.title}</h3>
                  <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{point.copy}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
