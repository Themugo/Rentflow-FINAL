import { BarChart3, Plus } from "lucide-react";
import { PageHeader } from "@/shared/components/layout/PageHeader";
import { Button } from "@/shared/components/ui/button";
import { cn } from "@/shared/lib/utils";

const KPI_SLOTS = ["Properties", "Units", "Occupancy", "Collections"] as const;
const ATTENTION_SLOTS = [
  "Overdue payments",
  "Open maintenance",
  "Expiring leases",
  "Pending actions",
] as const;

function PreviewSlot({
  title,
  description,
  className,
}: {
  title: string;
  description: string;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "min-w-0 rounded-xl border border-border bg-card p-4 card-shadow",
        className,
      )}
    >
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      <div className="mt-4 h-24 rounded-xl border border-dashed border-border bg-muted/30" aria-hidden />
    </section>
  );
}

/**
 * Layout chrome for the Manager executive operations dashboard.
 * Slots are labelled — this preview does not invent KPI numbers or alerts.
 */
export function ManagerDashboardPreview() {
  return (
    <div className="min-w-0 bg-background text-foreground" data-preview="manager-dashboard">
      <PageHeader
        title="Dashboard"
        description="Portfolio overview and today's operational priorities."
        className="px-0 pb-5"
        actions={
          <>
            <Button size="sm" className="min-h-11" type="button">
              <Plus className="h-4 w-4" aria-hidden />
              Add property
            </Button>
            <Button size="sm" variant="outline" className="min-h-11" type="button">
              <BarChart3 className="h-4 w-4" aria-hidden />
              View reports
            </Button>
          </>
        }
      />

      <p className="mb-6 text-xs text-muted-foreground">
        Layout preview — regions only. Live values come from manager stats; this canvas does not invent figures.
      </p>

      <section className="mb-6 min-w-0" aria-labelledby="preview-attention">
        <h2 id="preview-attention" className="section-title">
          Attention
        </h2>
        <p className="supporting-text mb-3">
          Shown only when live overdue payments, open maintenance, expiring leases, or pending actions exist.
        </p>
        <div className="flex flex-wrap gap-2">
          {ATTENTION_SLOTS.map((label) => (
            <span
              key={label}
              className="inline-flex min-h-11 items-center rounded-xl border border-dashed border-border bg-card px-3 text-sm text-muted-foreground"
            >
              {label}
            </span>
          ))}
        </div>
      </section>

      <section className="mb-6 min-w-0" aria-labelledby="preview-kpis">
        <h2 id="preview-kpis" className="section-title">
          Portfolio
        </h2>
        <p className="supporting-text mb-3">Four restrained metrics. Trend lines appear only from actual history.</p>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {KPI_SLOTS.map((label) => (
            <div key={label} className="min-w-0 rounded-xl border border-border bg-card p-3.5 card-shadow">
              <p className="meta-text uppercase tracking-wider">{label}</p>
              <p className="mt-1 text-sm text-muted-foreground">Live value</p>
            </div>
          ))}
        </div>
      </section>

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <PreviewSlot
          className="lg:col-span-2 min-h-[220px]"
          title="Collections performance"
          description="Live collected versus expected rent. Occupies the primary column."
        />
        <div className="flex min-w-0 flex-col gap-4">
          <PreviewSlot
            title="Occupancy"
            description="Live occupied versus vacant units."
          />
          <PreviewSlot
            title="Maintenance"
            description="Live open work orders."
          />
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <PreviewSlot
          title="Recent activity"
          description="Latest tenant, lease, and payment events from the activity log."
        />
        <PreviewSlot
          title="Upcoming actions"
          description="Pending and overdue invoices that are actually due."
        />
      </div>

      <section className="min-w-0 rounded-xl border border-border bg-card p-4 card-shadow" aria-labelledby="preview-property">
        <h3 id="preview-property" className="text-sm font-semibold text-foreground">
          Property performance
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Occupancy per property from live records — table, not nested cards.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">Property performance columns</caption>
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th scope="col" className="py-2 pr-4 font-medium">Property</th>
                <th scope="col" className="py-2 pr-4 font-medium">Address</th>
                <th scope="col" className="py-2 font-medium">Occupancy</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="py-3 text-muted-foreground" colSpan={3}>
                  Rows populate from the manager&apos;s properties.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
