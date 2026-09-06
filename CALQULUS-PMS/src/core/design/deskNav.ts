import { cn } from "@/shared/lib/utils";

/**
 * Selected desk navigation.
 * Interactive blue wash — never a portal-accent fill. Portal colour stays the 2px stripe.
 */
export const DESK_NAV_ACTIVE =
  "border-border bg-primary/10 text-foreground font-semibold";

export const DESK_NAV_IDLE =
  "border-transparent text-muted-foreground hover:bg-muted hover:text-foreground";

/** Navy manager rail: unmistakable blue wash selected, slate-on-navy idle. */
export const SIDEBAR_NAV_ACTIVE =
  "bg-primary/85 text-primary-foreground font-semibold";

export const SIDEBAR_NAV_IDLE =
  "text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-foreground";

export function deskNavClass(active: boolean): string {
  return cn("border", active ? DESK_NAV_ACTIVE : DESK_NAV_IDLE);
}

export function sidebarNavClass(active: boolean): string {
  return active ? SIDEBAR_NAV_ACTIVE : SIDEBAR_NAV_IDLE;
}
