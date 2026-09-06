import {
  BarChart3,
  Building2,
  ChevronDown,
  ChevronRight,
  CreditCard,
  FileText,
  LayoutGrid,
  Receipt,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { WORKFLOW_STEPS } from "@/features/marketing/publicConfig";

const STEP_ICONS: Record<(typeof WORKFLOW_STEPS)[number]["label"], LucideIcon> = {
  Property: Building2,
  Units: LayoutGrid,
  Tenants: Users,
  Leases: FileText,
  Billing: Receipt,
  Payments: CreditCard,
  Maintenance: Wrench,
  Reporting: BarChart3,
};

/** Visual operational lifecycle — compact UI cards chained by direction arrows. */
export function OperationalWorkflow() {
  return (
    <section id="how-it-works" className="scroll-mt-20 border-b border-border bg-background py-8 sm:py-10">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="public-section-title">All under control.</h2>
          <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground sm:text-base">
            One connected workspace for the daily work of managing property.
          </p>
        </div>

        <ol className="mt-10 flex flex-col sm:grid sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
          {WORKFLOW_STEPS.map((step, index) => {
            const Icon = STEP_ICONS[step.label];
            const last = index === WORKFLOW_STEPS.length - 1;
            return (
              <li key={step.label} className="flex flex-col">
                <div className="flex flex-1 items-center gap-3 rounded-[12px] border border-border bg-card p-3.5 shadow-sm">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <Icon className="h-4 w-4" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-heading text-sm font-semibold leading-tight text-foreground">
                      {step.label}
                    </h3>
                    <p className="mt-0.5 truncate text-[13px] text-muted-foreground">{step.note}</p>
                  </div>
                  {!last && (
                    <ChevronRight className="hidden h-4 w-4 shrink-0 text-primary/45 sm:block" aria-hidden />
                  )}
                </div>
                {!last && (
                  <ChevronDown className="mx-auto h-4 w-4 py-0.5 text-primary/45 sm:hidden" aria-hidden />
                )}
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
