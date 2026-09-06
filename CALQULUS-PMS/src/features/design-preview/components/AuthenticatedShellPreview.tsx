import { useState } from "react";
import {
  Bell,
  ChevronDown,
  ChevronsUpDown,
  Menu,
  Search,
  X,
} from "lucide-react";
import { BrandMark } from "@/shared/components/branding/BrandMark";
import { PageHeader } from "@/shared/components/layout/PageHeader";
import { Button } from "@/shared/components/ui/button";
import { EmptyState } from "@/shared/components/ui/empty-state";
import { ErrorState } from "@/shared/components/ui/error-state";
import { LoadingState } from "@/shared/components/ui/loading-state";
import { PortalAccentBar } from "@/core/design";
import { CALQULUS_BRAND } from "@/shared/theme/tokens";
import { cn } from "@/shared/lib/utils";
import {
  SHELL_PREVIEW_SAMPLE_ALERTS,
  type ShellCanvasState,
  type ShellPreviewPortal,
} from "@/features/design-preview/shellPreviewConfig";

interface AuthenticatedShellPreviewProps {
  portal: ShellPreviewPortal;
  canvas: ShellCanvasState;
}

/**
 * Preview-only authenticated chrome. Does not wrap live portal routes
 * and does not query production data.
 */
export function AuthenticatedShellPreview({ portal, canvas }: AuthenticatedShellPreviewProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeId, setActiveId] = useState(portal.nav[0]?.id ?? "dashboard");
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const activeItem = portal.nav.find((item) => item.id === activeId) ?? portal.nav[0];

  const selectItem = (id: string) => {
    setActiveId(id);
    setMenuOpen(false);
  };

  return (
    <div
      data-shell-preview=""
      data-portal={portal.dataPortal}
      className="relative min-h-[720px] overflow-hidden rounded-[14px] border border-border bg-background text-foreground"
      style={{ ["--portal-accent" as string]: portal.accent }}
    >
      <PortalAccentBar />

      {menuOpen ? (
        <button
          type="button"
          className="absolute inset-0 z-30 bg-navy-deep/40 lg:hidden"
          aria-label="Close menu"
          onClick={() => setMenuOpen(false)}
        />
      ) : null}

      <div className="flex min-h-[720px]">
        <aside
          className={cn(
            "absolute inset-y-0 left-0 z-40 flex w-64 flex-col bg-sidebar transition-transform lg:static lg:translate-x-0",
            menuOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
          )}
          aria-label={`${portal.label} navigation`}
        >
          <div className="flex h-[68px] items-center justify-between border-b border-sidebar-border px-4">
            <BrandMark size="nav" showWordmark subtitle={portal.subtitle} forcePlatform inverse />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="lg:hidden text-sidebar-muted hover:text-sidebar-foreground hover:bg-sidebar-accent"
              aria-label="Close menu"
              onClick={() => setMenuOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="border-b border-sidebar-border px-3 py-3">
            <button
              type="button"
              className="flex min-h-11 w-full items-center justify-between rounded-md border border-sidebar-border bg-sidebar-accent/50 px-3 text-left text-sm text-sidebar-foreground"
              aria-label="Workspace selector"
            >
              <span className="truncate">{CALQULUS_BRAND.name} workspace</span>
              <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-sidebar-muted" aria-hidden />
            </button>
          </div>

          <nav className="flex-1 overflow-y-auto px-2 py-3" aria-label="Desk">
            <ul className="space-y-1">
              {portal.nav.map((item) => {
                const active = item.id === activeId;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      aria-current={active ? "page" : undefined}
                      onClick={() => selectItem(item.id)}
                      className={cn(
                        "relative flex min-h-11 w-full items-center gap-3 rounded-md px-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
                        active
                          ? "bg-primary/85 font-semibold text-primary-foreground"
                          : "text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-foreground",
                      )}
                    >
                      <span
                        className={cn(
                          "flex h-7 w-7 items-center justify-center rounded-md",
                          active
                            ? "bg-white/15 text-primary-foreground"
                            : "bg-sidebar-accent text-sidebar-muted",
                        )}
                      >
                        <item.icon className="h-4 w-4" aria-hidden />
                      </span>
                      {item.label}
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col bg-background">
          <header className="flex h-[68px] items-center justify-between gap-3 border-b border-border bg-card px-4 sm:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="lg:hidden"
                aria-label="Open menu"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen(true)}
              >
                <Menu className="h-4 w-4" />
              </Button>
              <p className="truncate text-[13px] text-muted-foreground">
                <span className="text-foreground">{portal.label}</span>
                <span aria-hidden> / </span>
                {activeItem?.label}
              </p>
            </div>

            <div className="flex items-center gap-1.5">
              <Button type="button" variant="ghost" size="icon" aria-label="Search" className="hidden sm:inline-flex">
                <Search className="h-4 w-4" />
              </Button>
              <div className="relative">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Notifications"
                  aria-expanded={alertsOpen}
                  onClick={() => {
                    setAlertsOpen((open) => !open);
                    setUserOpen(false);
                  }}
                >
                  <Bell className="h-4 w-4" />
                </Button>
                <span className="sr-only">3 illustrative alerts</span>
                <span
                  className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full"
                  style={{ backgroundColor: portal.accent }}
                  aria-hidden
                />
                {alertsOpen ? (
                  <div className="absolute right-0 top-12 z-20 w-72 rounded-md border border-border bg-card p-3 shadow-sm">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      Notifications
                    </p>
                    <ul className="mt-2 space-y-2">
                      {SHELL_PREVIEW_SAMPLE_ALERTS.map((item) => (
                        <li key={item.title} className="rounded-md border border-border bg-background px-3 py-2">
                          <p className="text-sm font-medium text-foreground">{item.title}</p>
                          <p className="text-xs text-muted-foreground">{item.detail}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
              <div className="relative">
                <Button
                  type="button"
                  variant="ghost"
                  className="min-h-11 gap-2 px-2"
                  aria-label="User menu"
                  aria-expanded={userOpen}
                  onClick={() => {
                    setUserOpen((open) => !open);
                    setAlertsOpen(false);
                  }}
                >
                  <span
                    className="flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-semibold text-white"
                    style={{ backgroundColor: portal.accent }}
                  >
                    JM
                  </span>
                  <span className="hidden text-sm text-foreground sm:inline">Jordan M.</span>
                  <ChevronDown className="hidden h-3.5 w-3.5 text-muted-foreground sm:block" aria-hidden />
                </Button>
                {userOpen ? (
                  <div className="absolute right-0 top-12 z-20 w-48 rounded-md border border-border bg-card p-2 shadow-sm">
                    <p className="px-2 py-1.5 text-xs text-muted-foreground">Preview account</p>
                    <button type="button" className="flex min-h-11 w-full items-center rounded-md px-2 text-sm hover:bg-muted">
                      Profile
                    </button>
                    <button type="button" className="flex min-h-11 w-full items-center rounded-md px-2 text-sm hover:bg-muted">
                      Sign out
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </header>

          <PageHeader
            className="bg-card px-4 py-4 sm:px-6"
            breadcrumbs={
              <p className="text-xs text-muted-foreground">
                {portal.label} <span aria-hidden>›</span> {activeItem?.label}
              </p>
            }
            title={activeItem?.label ?? portal.label}
            description={portal.description}
            actions={
              <>
                <Button type="button" variant="outline">
                  {portal.secondaryAction}
                </Button>
                <Button type="button">
                  {portal.primaryAction}
                </Button>
              </>
            }
          />

          <main id="shell-preview-main" tabIndex={-1} className="flex-1 px-4 py-5 sm:px-6">
            <CanvasBody state={canvas} portalLabel={portal.label} />
          </main>
        </div>
      </div>
    </div>
  );
}

function CanvasBody({ state, portalLabel }: { state: ShellCanvasState; portalLabel: string }) {
  if (state === "loading") {
    return <LoadingState label="Loading desk canvas…" />;
  }
  if (state === "empty") {
    return (
      <EmptyState
        title="Nothing on this desk yet"
        description="Empty-state preview only. Live records are not loaded here."
        actionLabel="Primary action"
      />
    );
  }
  if (state === "error") {
    return (
      <ErrorState
        title="Desk could not load"
        message="Error-state preview only. This is not a live query failure."
      />
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {["Attention", "Next action", "Status"].map((label) => (
        <article key={label} className="rounded-[14px] border border-border bg-card p-4 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
          <p className="mt-2 text-sm font-semibold text-foreground">{portalLabel} canvas</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Illustrative shell only. Dashboards are not redesigned in this phase.
          </p>
        </article>
      ))}
    </div>
  );
}
