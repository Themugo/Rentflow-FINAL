import {
  BarChart3,
  Building2,
  CreditCard,
  FileText,
  LayoutGrid,
  Receipt,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { PLATFORM_CAPABILITIES } from "@/features/marketing/publicConfig";

const EYEBROW = "text-[11px] font-semibold uppercase tracking-[0.16em] text-primary";

const CAPABILITY_ICONS: Record<(typeof PLATFORM_CAPABILITIES)[number], LucideIcon> = {
  Properties: Building2,
  Units: LayoutGrid,
  Tenants: Users,
  Leases: FileText,
  Billing: Receipt,
  Payments: CreditCard,
  Maintenance: Wrench,
  Reporting: BarChart3,
};

/**
 * Compact product overview — capability tiles only, no long copy.
 * Properties → Reporting map one-to-one to real manager routes.
 */
export function PlatformOverview() {
  return (
    <section id="platform" className="scroll-mt-20 border-b border-border bg-card py-8 sm:py-10">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className={EYEBROW}>Platform</p>
          <h2 className="public-section-title mt-2">One platform. Every property.</h2>
        </div>
        <ul className="mt-6 flex flex-wrap justify-center gap-3">
          {PLATFORM_CAPABILITIES.map((capability) => {
            const Icon = CAPABILITY_ICONS[capability];
            return (
              <li
                key={capability}
                className="flex items-center gap-3 rounded-full border border-border bg-card px-4 py-2 shadow-sm transition-shadow duration-200 hover:shadow-md"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Icon className="h-4 w-4" aria-hidden />
                </span>
                <span className="font-heading text-sm font-semibold text-foreground">{capability}</span>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
