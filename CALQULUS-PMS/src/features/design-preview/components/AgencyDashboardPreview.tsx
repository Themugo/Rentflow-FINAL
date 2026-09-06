import {
  Building2,
  CheckCircle2,
  CreditCard,
  FileChartColumn,
  Handshake,
  UserPlus,
} from "lucide-react";
import { PageHeader } from "@/shared/components/layout/PageHeader";
import { Button } from "@/shared/components/ui/button";
import { cn } from "@/shared/lib/utils";
import { portalSurfaceProps } from "@/core/design";
import {
  AGENCY_ACCENT,
  AGENCY_CARD,
} from "@/features/agency/theme";

const KPI_SLOTS = [
  "Clients",
  "Properties",
  "Units",
  "Occupancy",
  "Collections",
] as const;

const ATTENTION_SLOTS = [
  { icon: CreditCard, label: "Overdue invoices" },
  { icon: FileChartColumn, label: "Expiring leases" },
  { icon: Building2, label: "Unlinked buildings" },
  { icon: CheckCircle2, label: "Pending actions" },
] as const;

const CLIENT_SLOTS = [
  "Client",
  "Properties",
  "Units",
  "Occupancy",
  "Collected",
  "Outstanding",
  "Status",
] as const;

/**
 * Layout chrome for the Agency executive command centre.
 * Slots are labelled — this preview does not invent KPI numbers or
 * client rows. Live values come from useAgencyPortfolio().
 */
export function AgencyDashboardPreview() {
  const today = new Date();
  const dateLabel = today.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

  return (
    <div className="min-w-0 bg-background text-foreground" data-preview="agency-dashboard" {...portalSurfaceProps("agency")}>
      <PageHeader
        title="Your agency at a glance."
        description="Monitor client portfolios, occupancy, collections and operational performance from one connected workspace."
        className="px-0 pb-5"
        actions={
          <p className="type-meta inline-flex items-center gap-2 text-muted-foreground">
            Today · {dateLabel}
          </p>
        }
      />

      {/* Setup banner */}
      <section
        aria-label="Agency setup progress"
        className="mb-6 flex flex-col gap-3 rounded-xl border border-[var(--portal-accent-border)] bg-[var(--portal-accent-surface)] p-4 sm:flex-row sm:items-center"
      >
        <div className="min-w-0 flex-1">
          <p className="meta-text mb-1 flex items-center gap-1.5 uppercase tracking-wider text-[var(--portal-accent)]">
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> Agency setup
          </p>
          <h2 className="type-subtitle">Complete your agency profile</h2>
          <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1 text-success">✓ Profile</span>
            <span className="inline-flex items-center gap-1">Portfolio defaults</span>
            <span className="inline-flex items-center gap-1">First client</span>
            <span className="inline-flex items-center gap-1">First property</span>
          </div>
        </div>
        <Button size="sm" className="min-h-11 shrink-0">
          Continue setup
        </Button>
      </section>

      {/* Executive KPI row */}
      <section className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5" aria-label="Executive summary">
        {KPI_SLOTS.map((label) => (
          <div key={label} className="min-w-0 rounded-xl border border-border bg-card p-4 card-shadow">
            <p className="meta-text uppercase tracking-wider">{label}</p>
            <p className="mt-1 font-heading text-2xl font-bold text-foreground">Live value</p>
            <p className="mt-1 text-[11px] text-muted-foreground">Supporting context</p>
          </div>
        ))}
      </section>

      {/* Portfolio performance + snapshot */}
      <div className="mb-6 grid grid-cols-1 gap-5 xl:grid-cols-12">
        <section className={AGENCY_CARD.panel + " xl:col-span-8"} aria-label="Portfolio performance">
          <div className="mb-4 flex items-start justify-between gap-2">
            <div>
              <h2 className="type-card-title">Portfolio performance</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">Collected versus outstanding invoices over six months</p>
            </div>
            <Button variant="ghost" size="sm">
              View portfolio
            </Button>
          </div>
          <div className="chart-frame h-[230px] rounded-lg border border-dashed border-border bg-muted/20" aria-hidden />
          <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: AGENCY_ACCENT.accent }} /> Collected
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: AGENCY_ACCENT.accent }} /> Outstanding
            </span>
          </div>
        </section>

        <section className={AGENCY_CARD.panel + " xl:col-span-5"} aria-label="Portfolio snapshot">
          <h2 className="mb-4 type-card-title">Portfolio snapshot</h2>
          {[
            { label: "Properties", value: "Live" },
            { label: "Units", value: "Live" },
            { label: "Occupancy", value: "Live", bar: true },
            { label: "Collected", value: "Live" },
            { label: "Outstanding", value: "Live" },
          ].map((row) => (
            <div key={row.label} className="flex items-center justify-between gap-3 border-b border-border/60 py-2.5 last:border-0">
              <span className="text-sm text-muted-foreground">{row.label}</span>
              <span className="text-sm font-semibold text-foreground">{row.value}</span>
            </div>
          ))}
          <div className="mt-3" role="img" aria-label="Occupancy indicator">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full w-0 rounded-full" style={{ background: AGENCY_ACCENT.accent }} />
            </div>
          </div>
        </section>
      </div>

      {/* Needs attention */}
      <section className="mb-6" aria-labelledby="preview-attention">
        <h2 id="preview-attention" className="section-title">Needs attention</h2>
        <p className="supporting-text mb-3">Items requiring action across your client portfolios.</p>
        <div className="flex flex-wrap gap-2">
          {ATTENTION_SLOTS.map(({ label, icon: Icon }) => (
            <span
              key={label}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border bg-card px-3 text-sm text-muted-foreground"
            >
              <Icon className="h-4 w-4 text-[var(--portal-accent)]" aria-hidden />
              {label}
            </span>
          ))}
        </div>
      </section>

      {/* Client portfolio performance */}
      <section className="mb-6 min-w-0 rounded-xl border border-border bg-card p-5 card-shadow" aria-labelledby="preview-clients">
        <div className="mb-3 flex items-start justify-between gap-2">
          <div>
            <h2 id="preview-clients" className="type-card-title">Client portfolio performance</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">See how each landlord portfolio is performing this month.</p>
          </div>
          <Button variant="ghost" size="sm">
            Clients
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">Client portfolio performance columns</caption>
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                {CLIENT_SLOTS.map((col, i) => (
                  <th
                    key={col}
                    scope="col"
                    className={cn(
                      "py-2 pr-4 font-medium",
                      i > 0 && "text-right",
                    )}
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="py-3 text-muted-foreground" colSpan={CLIENT_SLOTS.length}>
                  Rows populate from linked landlord portfolios.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Quick actions */}
      <section className="mb-6 flex flex-wrap items-center gap-2" aria-label="Quick actions">
        <h2 className="section-title mr-auto pr-4">Quick actions</h2>
        <Button size="sm" variant="outline" className="min-h-11">
          <Handshake className="h-4 w-4" aria-hidden /> Add client
        </Button>
        <Button size="sm" variant="outline" className="min-h-11">
          <Building2 className="h-4 w-4" aria-hidden /> Add property
        </Button>
        <Button size="sm" variant="outline" className="min-h-11">
          <UserPlus className="h-4 w-4" aria-hidden /> Invite tenant
        </Button>
        <Button size="sm" variant="outline" className="min-h-11">
          <CreditCard className="h-4 w-4" aria-hidden /> Create billing
        </Button>
        <Button size="sm" variant="outline" className="min-h-11">
          <FileChartColumn className="h-4 w-4" aria-hidden /> View reports
        </Button>
      </section>
    </div>
  );
}