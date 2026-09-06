import { format } from "date-fns";
import { Link } from "react-router-dom";
import {
  Bell,
  Building2,
  CheckCircle2,
  CreditCard,
  FileText,
  Receipt,
  ScrollText,
  Wrench,
} from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { TENANT_OPS_ROUTES, TENANT_ROUTES } from "@/features/tenant-portal/lib/tenantPaths";
import { cn } from "@/shared/lib/utils";

type ActivityItem = {
  id: string;
  label: string;
  detail: string;
};

type MaintenanceItem = {
  title: string;
  status: string;
  href: string;
};

type NoticeItem = {
  id: string;
  notice_type: string;
  title: string;
  created_at: string;
  unread: boolean;
};

interface TenantHomeProps {
  greeting: string;
  firstName: string;
  propertyName: string | null;
  unit: string | null;
  propertyImage: string | null;
  propertyType: string | null;
  unitBedrooms: number | null;
  amountDue: number;
  dueDate: string | null;
  overdue: boolean;
  formatCurrency: (amount: number) => string;
  onPayRent: () => void;
  payDisabled?: boolean;
  maintenanceOpen?: number;
  activeMaintenance?: MaintenanceItem[];
  recentNotices?: NoticeItem[];
  recentActivity: ActivityItem[];
}

const SHORTCUTS = [
  { label: "Lease", href: TENANT_ROUTES.lease, icon: ScrollText },
  { label: "Maintenance", href: TENANT_ROUTES.maintenance, icon: Wrench },
  { label: "Receipts", href: TENANT_ROUTES.receipts, icon: Receipt },
  { label: "Documents", href: TENANT_ROUTES.documents, icon: FileText },
] as const;

const NOTICE_LABEL: Record<string, string> = {
  rent_increase: "Rent notice",
  eviction_warning: "Notice",
  rule_violation: "Notice",
  entry_notice: "Maintenance entry",
  maintenance_entry: "Maintenance entry",
  lease_renewal: "Lease renewal",
  general: "Building notice",
  arrears_demand: "Payment notice",
};

export default function TenantHome({
  greeting,
  firstName,
  propertyName,
  unit,
  propertyImage,
  propertyType,
  unitBedrooms,
  amountDue,
  dueDate,
  overdue,
  formatCurrency,
  onPayRent,
  payDisabled = false,
  maintenanceOpen = 0,
  activeMaintenance = [],
  recentNotices = [],
  recentActivity,
}: TenantHomeProps) {
  const hasBalance = amountDue > 0;
  const homeLine = [propertyName, unit ? `Unit ${unit}` : null].filter(Boolean).join(" · ") || "Your home";
  const imageSrc = propertyImage || undefined;

  return (
    <div className="mx-auto w-full max-w-xl space-y-6 pt-2 md:pt-4">
      {/* Greeting + context hero */}
      <header>
        <p className="text-sm text-muted-foreground">{greeting}, <span className="capitalize">{firstName}</span></p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Home, bills and requests in one place</h1>
      </header>

      {/* ===== Rent status — the strongest operational element ===== */}
      <section className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {overdue ? "Payment overdue" : hasBalance ? "Rent due" : "Rent status"}
          </p>
          {!hasBalance && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-2.5 py-1 text-xs font-medium text-success">
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
              Paid
            </span>
          )}
        </div>
        <p className={cn("amount-display mt-1 font-heading text-[2rem] font-bold leading-tight tracking-tight sm:text-[2.5rem]", overdue ? "text-destructive" : "text-foreground")}>
          {formatCurrency(amountDue)}
        </p>
        {dueDate ? (
          <p className="mt-1 text-sm text-muted-foreground">
            Due {format(new Date(dueDate), "d MMM yyyy")}
            {overdue ? " · Overdue" : ""}
          </p>
        ) : (
          <p className="mt-1 text-sm text-muted-foreground">Nothing due right now</p>
        )}
        <Button
          className="mt-5 min-h-12 w-full text-base font-semibold bg-[var(--portal-accent)] text-white hover:bg-[var(--portal-accent)] hover:brightness-110"
          size="lg"
          disabled={payDisabled || !hasBalance}
          onClick={onPayRent}
        >
          {hasBalance ? "PAY RENT" : "All paid"}
        </Button>
      </section>

      <p className="max-w-lg text-sm text-muted-foreground">Pay what is due, check your home, and stay on top of requests without digging through menus.</p>

      {/* ===== Property identity card ===== */}
      <section className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex items-stretch">
          {imageSrc ? (
            <div className="relative hidden w-28 flex-shrink-0 sm:block">
              <img src={imageSrc} alt="" className="h-full w-full object-cover" loading="lazy" />
            </div>
          ) : null}
          <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Your home</p>
            <p className="truncate text-base font-semibold text-foreground">{homeLine}</p>
            {(propertyType || unitBedrooms) && (
              <p className="truncate text-xs text-muted-foreground">
                {[propertyType, unitBedrooms ? `${unitBedrooms} bedroom` : null].filter(Boolean).join(" · ")}
              </p>
            )}
          </div>
          <div className="hidden shrink-0 items-center px-4 sm:flex" aria-hidden>
            <Building2 className="h-5 w-5 text-muted-foreground" />
          </div>
        </div>
      </section>

      {/* ===== Common tasks shortcut row ===== */}
      <nav aria-label="Common tasks" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {SHORTCUTS.map((item) => (
          <Link
            key={item.href}
            to={item.href}
            className="flex min-h-11 flex-col items-start gap-1 rounded-xl border border-border bg-card px-3 py-3 text-left hover:bg-muted/50"
          >
            <item.icon className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">
              {item.label}
              {item.label === "Maintenance" && maintenanceOpen > 0 ? ` · ${maintenanceOpen}` : ""}
            </span>
          </Link>
        ))}
      </nav>

      {/* ===== Maintenance ===== */}
      <section>
        <h2 className="section-title mb-3">Maintenance</h2>
        {activeMaintenance.length === 0 ? (
          <p className="text-sm text-muted-foreground">No active maintenance requests.</p>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border bg-card">
            {activeMaintenance.slice(0, 3).map((req) => (
              <li key={req.title + req.status} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <Wrench className="h-4 w-4 shrink-0 text-warning" aria-hidden />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{req.title}</p>
                    <p className="text-xs text-muted-foreground">{propertyName ?? "Your property"}</p>
                  </div>
                </div>
                <Link to={req.href} className="shrink-0">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-warning/10 px-2.5 py-1 text-xs font-medium text-warning">
                    Open
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        <Link
          to={TENANT_ROUTES.maintenance}
          className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
        >
          {maintenanceOpen > 0 ? "View maintenance" : "Report a problem"}
        </Link>
      </section>

      {/* ===== Notices ===== */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="section-title">Important notices</h2>
          <Link to={TENANT_OPS_ROUTES.inbox} className="text-sm font-medium text-primary hover:underline">View all</Link>
        </div>
        {recentNotices.length === 0 ? (
          <p className="text-sm text-muted-foreground">No new notices.</p>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border bg-card">
            {recentNotices.slice(0, 3).map((notice) => (
              <li key={notice.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <Bell className={cn("h-4 w-4 shrink-0", notice.unread ? "text-primary" : "text-muted-foreground")} aria-hidden />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{notice.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {NOTICE_LABEL[notice.notice_type] ?? "Notice"}
                      {" · "}
                      {notice.created_at ? format(new Date(notice.created_at), "d MMM") : ""}
                    </p>
                  </div>
                </div>
                <Link to={TENANT_OPS_ROUTES.inbox} className="shrink-0" aria-label={`View ${notice.title}`}>
                  <span className={cn("text-xs font-medium hover:underline", notice.unread ? "text-primary" : "text-muted-foreground")}>
                    View
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ===== Recent payments / activity ===== */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="section-title">Recent payments</h2>
          <Link to={TENANT_ROUTES.receipts} className="text-sm font-medium text-primary hover:underline">
            View receipts
          </Link>
        </div>
        {recentActivity.length === 0 ? (
          <p className="text-sm text-muted-foreground">No recent payments yet.</p>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border bg-card">
            {recentActivity.map((item) => (
              <li key={item.id} className="flex items-center gap-3 px-4 py-3">
                <CreditCard className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{item.label}</p>
                  <p className="text-xs text-muted-foreground">{item.detail}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
