import { Link } from "react-router-dom";
import {
  Building2,
  CreditCard,
  DoorOpen,
  Home,
  TrendingUp,
  Wrench,
} from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { CALQULUS_COLOR } from "@/shared/theme/tokens";
import propertyResidentialThumb from "@/assets/marketing/property-residential-thumb.webp";
import propertyOfficeThumb from "@/assets/marketing/property-office-thumb.webp";
import propertyCommercialThumb from "@/assets/marketing/property-commercial.webp";

const KPI_SLOTS = [
  { label: "Properties", icon: Building2 },
  { label: "Units", icon: DoorOpen },
  { label: "Occupancy", icon: Home },
  { label: "Collected", icon: CreditCard },
] as const;

const ATTENTION_SLOTS = [
  { label: "Overdue invoices", tone: "danger" },
  { label: "Urgent repairs", tone: "danger" },
  { label: "Leases expiring", tone: "warning" },
  { label: "Vacant units", tone: "info" },
] as const;

const PROPERTY_ROWS = [
  {
    name: "Kilimani Highview Apartments",
    address: "Argwings Kodhek, Nairobi",
    src: propertyResidentialThumb,
  },
  {
    name: "Riverside Business Plaza",
    address: "Riverside Drive, Nairobi",
    src: propertyOfficeThumb,
  },
  {
    name: "Windsor Commercial Court",
    address: "Windsor Crescent, Nairobi",
    src: propertyCommercialThumb,
  },
] as const;

const MAINTENANCE_ROWS = [
  { label: "Water pump", priority: "urgent", tone: "danger" },
  { label: "Electric fault · Unit 4A", priority: "medium", tone: "warning" },
  { label: "Repaint corridor", priority: "low", tone: "neutral" },
] as const;

function PropertyThumbnail({ src, name }: { src: string; name: string }) {
  return (
    <img
      src={src}
      alt={name}
      loading="lazy"
      className="h-14 w-16 rounded-lg border border-border object-cover"
    />
  );
}

function PreviewTable({ rows }: { rows: typeof PROPERTY_ROWS }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <caption className="sr-only">Property performance columns</caption>
        <thead>
          <tr className="border-b border-border text-left text-muted-foreground">
            <th scope="col" className="py-2 pr-4 font-medium">Property</th>
            <th scope="col" className="hidden py-2 pr-4 font-medium sm:table-cell">Units</th>
            <th scope="col" className="hidden py-2 pr-4 font-medium md:table-cell">Occupancy</th>
            <th scope="col" className="py-2 pr-4 text-right font-medium">Collections</th>
            <th scope="col" className="py-2 text-right font-medium">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((row) => (
            <tr key={row.name}>
              <td className="py-3 pr-4">
                <div className="flex items-center gap-3">
                  <PropertyThumbnail src={row.src} name={row.name} />
                  <div className="min-w-0">
                    <p className="truncate font-medium text-foreground">{row.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{row.address}</p>
                  </div>
                </div>
              </td>
              <td className="hidden py-3 pr-4 text-muted-foreground sm:table-cell">Live</td>
              <td className="hidden py-3 pr-4 md:table-cell">
                <div className="flex flex-col gap-1">
                  <span className="text-sm text-foreground">Live<sup>%</sup></span>
                  <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
                    <div className="h-full w-0 rounded-full bg-success" />
                  </div>
                </div>
              </td>
              <td className="py-3 pr-4 text-right text-muted-foreground">Live</td>
              <td className="py-3 text-right">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2 py-0.5 text-xs text-muted-foreground">
                  On track
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Manager operational command centre — layout chrome only.
 * Slots are labelled; live values come from manager stats. No invented figures.
 */
export function ManagerOperationsPreview() {
  return (
    <div className="min-w-0 space-y-6 bg-background text-foreground" data-preview="manager-operations">
      {/* Greeting / context hero with restrained property imagery */}
      <section
        aria-labelledby="preview-greeting"
        className="relative overflow-hidden rounded-xl border border-border bg-card shadow-[0_1px_2px_0_rgb(13_39_68/0.06)]"
      >
        <div className="relative flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="min-w-0">
            <p className="meta-text mb-1 uppercase tracking-wider text-muted-foreground">
              Portfolio overview
            </p>
            <h1 id="preview-greeting" className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              Good morning, — <span className="text-navy-mid normal-case">Manager</span>
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              A snapshot of how your portfolio is performing today.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-3.5 text-sm font-medium text-primary-foreground hover:bg-primary-hover"
            >
              <Building2 className="h-4 w-4" aria-hidden /> Add property
            </button>
            <button
              type="button"
              className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border bg-card px-3.5 text-sm font-medium text-foreground hover:bg-muted"
            >
              <TrendingUp className="h-4 w-4" aria-hidden /> View reports
            </button>
          </div>
        </div>
        {/* Subtle photographic strip — restrained, navy-veil-preserving contrast */}
        <div className="pointer-events-none absolute inset-0 -z-0" aria-hidden>
          <img
            src={propertyResidentialThumb}
            alt=""
            loading="lazy"
            className="absolute inset-y-0 right-0 hidden h-full w-64 object-cover opacity-[0.14] lg:block"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-card via-card/90 to-card/20" />
        </div>
      </section>

      {/* Executive KPI row — one unified card system */}
      <section className="min-w-0" aria-labelledby="preview-kpis">
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <h2 id="preview-kpis" className="section-title">Portfolio</h2>
            <p className="supporting-text">Four exec metrics drawn from live manager stats.</p>
          </div>
          <span className="type-meta hidden text-right text-muted-foreground sm:block">
            Live values
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {KPI_SLOTS.map(({ label, icon: Icon }) => (
            <div key={label} className="rounded-xl border border-border bg-card p-4 shadow-[0_1px_2px_0_rgba(13_39_68/0.06)]">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="meta-text uppercase tracking-wider">{label}</p>
                  <p className="mt-1 font-heading text-2xl font-bold tracking-tight text-foreground">
                    Live
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">Supporting context</p>
                </div>
                <Icon className="h-4 w-4 shrink-0 text-primary" aria-hidden />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Portfolio performance + insight */}
      <section className="min-w-0" aria-labelledby="preview-performance">
        <div className="mb-3">
          <h2 id="preview-performance" className="section-title">Portfolio performance</h2>
          <p className="supporting-text">Collected versus expected rent across the last six months.</p>
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="rounded-xl border border-border bg-card p-5 card-shadow lg:col-span-2">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="font-heading text-base font-semibold text-foreground">Revenue overview</p>
                <p className="text-xs text-muted-foreground">Last 6 months</p>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: CALQULUS_COLOR.primary }} />
                  Collected
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: CALQULUS_COLOR.warning }} />
                  Outstanding
                </span>
              </div>
            </div>
            <div className="chart-frame h-[210px] rounded-lg" aria-hidden>
              <div className="flex h-full items-end gap-1 px-2 pb-1">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="flex flex-1 items-end gap-1">
                    <div className="w-full rounded-t-sm bg-primary/60" style={{ height: `${40 + (i * 9) % 35}%` }} />
                    <div className="w-full rounded-t-sm bg-warning/50" style={{ height: `${18 + (i * 6) % 20}%` }} />
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-success" aria-hidden /> Live collection rate
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="text-success">▲</span> vs previous period (from real data)
              </span>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5 card-shadow">
            <div className="mb-3">
              <h3 className="text-sm font-semibold text-foreground">Occupancy</h3>
              <p className="text-xs text-muted-foreground">Occupied versus vacant, per property</p>
            </div>
            <div className="chart-frame h-[210px] rounded-lg" aria-hidden />
            <p className="mt-3 text-xs text-muted-foreground">
              Occupied vs vacant units from live leases.
            </p>
          </div>
        </div>
      </section>

      {/* Needs attention — operational panel */}
      <section className="min-w-0" aria-labelledby="preview-attention">
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <h2 id="preview-attention" className="section-title">Needs attention</h2>
            <p className="supporting-text">Live operational alerts across the portfolio.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {ATTENTION_SLOTS.map(({ label, tone }) => (
            <span
              key={label}
              className={cn(
                "inline-flex min-h-11 items-center gap-2 rounded-xl border px-3 text-sm",
                tone === "danger" && "border-destructive/20 bg-destructive/5 text-destructive",
                tone === "warning" && "border-warning/20 bg-warning/5 text-warning",
                tone === "info" && "border-primary/20 bg-primary/5 text-primary",
              )}
            >
              <span className={cn("h-2 w-2 rounded-full", tone === "danger" && "bg-destructive", tone === "warning" && "bg-warning", tone === "info" && "bg-primary")} aria-hidden />
              {label}
            </span>
          ))}
        </div>
      </section>

      {/* Properties table */}
      <section className="rounded-xl border border-border bg-card p-5 card-shadow" aria-labelledby="preview-properties">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 id="preview-properties" className="type-card-title">Properties</h2>
            <p className="text-xs text-muted-foreground">Portfolio occupancy and collections per building.</p>
          </div>
          <Link to="/properties" className="text-xs font-medium text-primary hover:underline">
            View all
          </Link>
        </div>
        <PreviewTable rows={PROPERTY_ROWS} />
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Recent collections */}
        <section className="rounded-xl border border-border bg-card p-5 card-shadow" aria-labelledby="preview-collections">
          <div className="mb-3">
            <h2 id="preview-collections" className="type-card-title">Recent collections</h2>
            <p className="text-xs text-muted-foreground">Latest payments received from live records.</p>
          </div>
          <div className="divide-y divide-border">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between gap-3 py-2.5">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    <CreditCard className="h-4 w-4" aria-hidden />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">Tenant payment</p>
                    <p className="text-xs text-muted-foreground">Property name · date</p>
                  </div>
                </div>
                <span className="text-sm font-semibold text-foreground">Live</span>
              </div>
            ))}
          </div>
        </section>

        {/* Maintenance */}
        <section className="rounded-xl border border-border bg-card p-5 card-shadow" aria-labelledby="preview-maintenance">
          <div className="mb-3">
            <h2 id="preview-maintenance" className="type-card-title">Maintenance</h2>
            <p className="text-xs text-muted-foreground">Open work orders by priority.</p>
          </div>
          <ul className="divide-y divide-border">
            {MAINTENANCE_ROWS.map((row) => (
              <li key={row.label} className="flex items-center justify-between gap-3 py-2.5">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    <Wrench className="h-4 w-4" aria-hidden />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{row.label}</p>
                    <p className="text-xs text-muted-foreground">Property · date</p>
                  </div>
                </div>
                <span className={cn(
                  "rounded-full border px-2 py-0.5 text-xs capitalize",
                  row.tone === "danger" && "border-destructive/20 bg-destructive/5 text-destructive",
                  row.tone === "warning" && "border-warning/20 bg-warning/5 text-warning",
                  row.tone === "neutral" && "border-border bg-muted text-muted-foreground",
                )}>
                  {row.priority}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}