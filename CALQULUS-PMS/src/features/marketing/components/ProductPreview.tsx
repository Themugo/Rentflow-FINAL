import { Bell, Building2, LayoutDashboard, Search, Users, Receipt, Wrench, BarChart3 } from "lucide-react";
import { BrandMark } from "@/shared/components/branding/BrandMark";
import { invoiceStatusTone, statusBadgeClass } from "@/shared/lib/statusBadge";
import { PROPERTY_THUMBS } from "@/features/marketing/propertyImages";

const SIDEBAR_ITEMS = [
  { label: "Dashboard", icon: LayoutDashboard, active: true },
  { label: "Properties", icon: Building2, active: false },
  { label: "Tenants", icon: Users, active: false },
  { label: "Billing", icon: Receipt, active: false },
  { label: "Maintenance", icon: Wrench, active: false },
  { label: "Reports", icon: BarChart3, active: false },
] as const;

const SNAPSHOT = [
  { label: "Occupancy", value: "92%" },
  { label: "Collected", value: "KES 1.24M" },
  { label: "Collection rate", value: "93%" },
  { label: "Open repairs", value: "2" },
] as const;

/** Relative bar heights only — illustrative, not measured data. */
const COLLECTION_TREND = [58, 64, 61, 74, 69, 83, 93] as const;
const WEEK_TICKS = ["W1", "W2", "W3", "W4", "W5", "W6", "W7"] as const;

const MAINTENANCE_ACTIVITY = [
  { label: "Leaking tap · Kilimani Court", status: "pending" },
  { label: "Gate motor repaired · West View", status: "paid" },
  { label: "Inspection scheduled · Block C", status: "pending" },
] as const;

interface ProductPreviewProps {
  /** Tone for the caption — dark heroes need a light caption. */
  captionClassName?: string;
  /** Stronger elevation for placement on dark hero surfaces. */
  elevated?: boolean;
}

/**
 * Restrained collections bar chart — CALQULUS blue for the current week,
 * lighter blue for history. Subtle hairline grid, rounded tops, small axis
 * ticks, and the latest value in a clean pill.
 */
function CollectionsChart() {
  return (
    <div
      className="relative flex items-end gap-[7px] pt-6"
      role="img"
      aria-label="Illustrative collections chart for the last seven weeks"
    >
      <div className="pointer-events-none absolute inset-x-0 top-6 bottom-5 flex flex-col justify-between" aria-hidden>
        <span className="border-t border-border/50" />
        <span className="border-t border-border/50" />
        <span className="border-t border-border/50" />
        <span className="border-t border-border/50" />
      </div>
      {COLLECTION_TREND.map((height, index) => {
        const latest = index === COLLECTION_TREND.length - 1;
        return (
          <div key={index} className="relative z-[1] flex-1">
            {latest ? (
              <span className="absolute -top-6 left-1/2 -translate-x-1/2 rounded-full bg-primary/10 px-1.5 py-0.5 font-heading text-[10px] font-semibold leading-none text-primary">
                {height}%
              </span>
            ) : null}
            <div className="flex h-14 items-end">
              <div
                className={`w-full rounded-t-[3px] transition-colors duration-200 ${
                  latest ? "bg-primary" : "bg-primary/35 hover:bg-primary/55"
                }`}
                style={{ height: `${height}%` }}
              />
            </div>
            <p className="mt-1.5 border-t border-border pb-0 pt-1.5 text-center text-[8px] font-medium tracking-wide text-muted-foreground" aria-hidden>
              {WEEK_TICKS[index]}
            </p>
          </div>
        );
      })}
    </div>
  );
}

/** Static illustration of the manager desk — not a live data view. */
export function ProductPreview({ captionClassName = "text-muted-foreground", elevated = false }: ProductPreviewProps) {
  return (
    <figure className="mx-auto w-full max-w-lg md:max-w-none">
      <div
        className={
          elevated
            ? "flex overflow-hidden rounded-[14px] border border-border bg-card shadow-2xl shadow-navy-primary/15"
            : "flex overflow-hidden rounded-[14px] border border-border bg-card shadow-sm"
        }
      >
        <nav
          aria-hidden
          className="hidden w-12 shrink-0 flex-col items-center gap-3 border-r border-border bg-sidebar py-3 sm:flex"
        >
          <BrandMark size="xs" forcePlatform />
          <ul className="mt-1 flex flex-col gap-2">
            {SIDEBAR_ITEMS.map((item) => (
              <li key={item.label}>
                <span
                  className={
                    item.active
                      ? "flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary"
                      : "flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground"
                  }
                >
                  <item.icon className="h-3.5 w-3.5" />
                </span>
              </li>
            ))}
          </ul>
        </nav>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3 border-b border-border bg-card px-3 py-2 sm:px-4">
            <div className="min-w-0">
              <p className="truncate font-heading text-sm font-semibold text-foreground">
                CALQULUS / Manager dashboard
              </p>
              <p className="truncate text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Illustrative manager dashboard
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1.5 text-muted-foreground" aria-hidden>
              <Search className="h-3.5 w-3.5" />
              <Bell className="h-3.5 w-3.5" />
              <span className="ml-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-navy-primary text-[9px] font-semibold text-white">
                JM
              </span>
            </div>
          </div>

          <div className="bg-background p-3 sm:p-4">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {SNAPSHOT.map((metric) => (
                <div key={metric.label} className="rounded-lg border border-border bg-card p-2">
                  <p className="truncate text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
                    {metric.label}
                  </p>
                  <p className="mt-1 truncate font-heading text-sm font-semibold leading-none tracking-tight text-foreground">
                    {metric.value}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-3 rounded-lg border border-border bg-card p-3 pb-3">
              <p className="type-label mb-3">Collections, last 7 weeks</p>
              <CollectionsChart />
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <p className="type-label mb-2">Maintenance activity</p>
                <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
                  {MAINTENANCE_ACTIVITY.map((item) => (
                    <li key={item.label} className="flex items-center justify-between gap-2 px-2.5 py-2 text-xs">
                      <span className="min-w-0 truncate text-muted-foreground">{item.label}</span>
                      <span className={`${statusBadgeClass(invoiceStatusTone(item.status))} shrink-0`}>
                        {item.status === "paid" ? "Done" : "Open"}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="type-label mb-2">Property summary</p>
                <div className="group overflow-hidden rounded-lg border border-border bg-card">
                  <img
                    src={PROPERTY_THUMBS.residential}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className="h-14 w-full object-cover transition-transform duration-500 ease-out motion-safe:group-hover:scale-105"
                  />
                  <div className="flex items-center justify-between gap-2 p-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-foreground">Kilimani Court</p>
                      <p className="mt-0.5 truncate text-[11px] text-muted-foreground">24 units · 22 occupied</p>
                    </div>
                    <span className="shrink-0 rounded-md bg-primary/10 px-1.5 py-0.5 font-heading text-[10px] font-semibold leading-none text-primary">
                      92%
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <figcaption className={`mt-2.5 text-center text-xs ${captionClassName}`}>
        Illustrative manager dashboard. Sample figures only — not live customer data.
      </figcaption>
    </figure>
  );
}
