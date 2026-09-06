import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Settings,
  LogOut,
  ChevronRight,
  ChevronLeft,
  X,
  Globe,
  Star,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { useAuth } from "@/features/auth/AuthContext";
import { useRBAC, type PermissionKey } from "@/shared/hooks/useRBAC";
import { useViewOnly } from "@/shared/contexts/ViewOnlyContext";
import { useNavHistory } from "@/shared/hooks/useNavHistory";
import { WorkspaceSwitcher } from "./WorkspaceSwitcher";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { BrandMark } from "@/shared/components/branding/BrandMark";
import { PortalAccentBar, sidebarNavClass } from "@/core/design";
import {
  MANAGER_NAV_GROUPS,
  WEBHOST_NAV_GROUPS,
  AGENCY_NAV_GROUPS,
  LANDLORD_NAV_GROUPS,
  TENANT_NAV_GROUPS,
} from "@/shared/navigation/portalNavigation";


interface NavItem {
  name: string;
  href: string;
  icon: LucideIcon;
  badge?: string | number;
  permission?: PermissionKey;
}

interface NavGroup {
  title?: string;
  items: NavItem[];
}

const toSidebarGroups = (groups: typeof MANAGER_NAV_GROUPS): NavGroup[] =>
  groups.map((group) => ({
    title: group.label.toUpperCase(),
    items: group.items.map((item) => ({
      name: item.label,
      href: item.href,
      icon: item.icon as LucideIcon,
      permission: item.permission as PermissionKey | undefined,
    })),
  }));

const managerNavGroups = toSidebarGroups(MANAGER_NAV_GROUPS);
const webhostNavGroups = toSidebarGroups(WEBHOST_NAV_GROUPS);
const agencyNavGroups = toSidebarGroups(AGENCY_NAV_GROUPS);
const landlordNavGroups = toSidebarGroups(LANDLORD_NAV_GROUPS);
const tenantNavGroups = toSidebarGroups(TENANT_NAV_GROUPS);

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export function Sidebar({ isOpen = false, onClose }: SidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, user, isWebhost, isAgency, isLandlord, isTenant, isSubmanager } = useAuth();
  const { can } = useRBAC();
  const { isViewOnly } = useViewOnly();
  const { favorites } = useNavHistory();
  const [collapsed, setCollapsed] = useState(false);

  const workspaceLabel = isWebhost
    ? "Platform control"
    : isAgency
    ? "Agency workspace"
    : isLandlord
    ? "Landlord workspace"
    : isTenant
    ? "Tenant workspace"
    : "Property management";

  const rawNavGroups = isWebhost
    ? webhostNavGroups
    : isAgency
    ? agencyNavGroups
    : isLandlord
    ? landlordNavGroups
    : isTenant
    ? tenantNavGroups
    : managerNavGroups;

  // Filter items dynamically based on permission checks
  const navGroups = rawNavGroups.map((group) => ({
    ...group,
    items: group.items.filter((item) =>
      (!isSubmanager || item.href !== "/management-control") && (!item.permission || can(item.permission)),
    ),
  })).filter((group) => group.items.length > 0);

  const isActive = (href: string) => {
    if (href === "/" || href === "/webhost" || href === "/agency" || href === "/portal") {
      return location.pathname === href;
    }
    return location.pathname === href || location.pathname.startsWith(href + "/");
  };

  const handleNavClick = () => {
    if (onClose) onClose();
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-navy-deep/70 backdrop-blur-sm lg:hidden transition-opacity"
          onClick={() => onClose?.()}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={cn(
          "fixed left-0 top-0 z-50 h-screen flex flex-col bg-sidebar-background border-r border-sidebar-border text-sidebar-foreground transition-[width,transform] duration-200 ease-out select-none",
          "lg:translate-x-0",
          collapsed ? "w-16" : "w-64",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Top identity stripe — portal accent, not cyan */}
        <PortalAccentBar />

        {/* Workspace Brand Header */}
        <div
          className={cn(
            "flex h-16 items-center border-b border-sidebar-border/80 flex-shrink-0 px-3",
            collapsed ? "justify-center" : "justify-between"
          )}
        >
          {collapsed ? (
            <BrandMark size="nav" inverse />
          ) : (
            <BrandMark size="md" showWordmark subtitle="PMS" inverse />
          )}

          <div className="flex items-center gap-1 flex-shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="hidden lg:flex text-sidebar-muted hover:text-sidebar-foreground hover:bg-sidebar-accent/60 rounded-md"
              onClick={() => setCollapsed(!collapsed)}
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-expanded={!collapsed}
            >
              {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Close sidebar"
              className="lg:hidden text-sidebar-muted hover:text-sidebar-foreground hover:bg-sidebar-accent/60 rounded-md"
              onClick={onClose}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Workspace Context Switcher Bar */}
        <div className="p-2 border-b border-sidebar-border/60">
          <WorkspaceSwitcher collapsed={collapsed} />
        </div>

        {/* Navigation Section */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden px-2 py-3 space-y-4 scrollbar-thin scrollbar-thumb-sidebar-border">
          {/* Pinned / Favorites Group */}
          {!collapsed && favorites.length > 0 && (
            <div className="space-y-0.5 pb-2 border-b border-sidebar-border/40">
              <div className="px-3 py-1 text-[10px] font-semibold text-sidebar-muted uppercase tracking-wider flex items-center justify-between">
                <span>PINNED MODULES</span>
              </div>
              {favorites.map((fav) => {
                const active = isActive(fav.href);
                return (
                  <Link
                    key={fav.href}
                    to={fav.href}
                    onClick={handleNavClick}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "group relative flex min-h-11 items-center gap-2.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-150",
                      sidebarNavClass(active),
                    )}
                  >
                    <Star className={cn("h-3.5 w-3.5 shrink-0", active ? "text-primary" : "text-sidebar-muted group-hover:text-sidebar-foreground")} />
                    <span className="flex-1 truncate">{fav.name}</span>
                  </Link>
                );
              })}
            </div>
          )}

          {/* Regular Groups */}
          {!collapsed && (
            <div className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-sidebar-muted">
              {workspaceLabel}
            </div>
          )}
          {navGroups.map((group, groupIdx) => (
            <div key={groupIdx} className="space-y-0.5">
              {!collapsed && group.title && (
                <div className="px-3 py-1 text-[10px] font-semibold text-sidebar-muted uppercase tracking-wider">
                  {group.title}
                </div>
              )}
              {group.items.map((item) => {
                const active = isActive(item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    onClick={handleNavClick}
                    aria-current={active ? "page" : undefined}
                    aria-label={collapsed ? item.name : undefined}
                    className={cn(
                      "group relative flex items-center gap-3 rounded-md text-xs font-medium transition-all duration-150 touch-manipulation",
                      collapsed ? "justify-center min-h-11 min-w-11 p-2.5" : "min-h-11 px-3 py-2",
                      sidebarNavClass(active),
                    )}
                    title={collapsed ? item.name : undefined}
                  >
                    <Icon
                      className={cn(
                        "h-4 w-4 flex-shrink-0 transition-colors",
                        active
                          ? "text-primary"
                          : "text-sidebar-muted group-hover:text-sidebar-foreground"
                      )}
                    />
                    {!collapsed && (
                      <>
                        <span className="flex-1 truncate">{item.name}</span>
                        {item.badge && (
                          <Badge className="h-4 min-w-4 px-1 text-[10px] bg-primary/20 text-primary border-primary/30">
                            {item.badge}
                          </Badge>
                        )}
                      </>
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Footer Area */}
        <div className={cn("border-t border-sidebar-border/80 flex-shrink-0", collapsed ? "p-2" : "p-3")}>
          {!collapsed && user && (
            <div className="px-2.5 py-2 mb-2 rounded-md bg-sidebar-accent/30 border border-sidebar-border/50">
              <p className="text-[10px] text-sidebar-muted font-medium uppercase tracking-wider">Signed in</p>
              <p className="text-xs font-semibold text-sidebar-foreground truncate mt-0.5">{user.email}</p>
            </div>
          )}

          {isViewOnly ? (
            <button
              onClick={() => navigate("/webhost")}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-md text-xs font-medium transition-colors touch-manipulation text-warning hover:bg-warning/10",
                collapsed ? "justify-center p-2.5" : "px-3 py-2"
              )}
              title={collapsed ? "Back to Webhost" : undefined}
            >
              <Globe className="h-4 w-4 shrink-0" />
              {!collapsed && <span className="truncate">Back to Webhost</span>}
            </button>
          ) : (
            <button
              onClick={handleSignOut}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-md text-xs font-medium text-sidebar-muted hover:text-destructive hover:bg-destructive/10 transition-colors touch-manipulation",
                collapsed ? "justify-center p-2.5" : "px-3 py-2"
              )}
              title={collapsed ? "Sign Out" : undefined}
            >
              <LogOut className="h-4 w-4 shrink-0" />
              {!collapsed && <span>Sign Out</span>}
            </button>
          )}
        </div>
      </aside>
    </>
  );
}
