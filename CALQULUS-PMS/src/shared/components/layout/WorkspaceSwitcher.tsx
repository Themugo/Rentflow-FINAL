import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, ChevronDown, Shield, Handshake, Home, Check, Plus } from "lucide-react";
import { useAuth } from "@/features/auth/AuthContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { Badge } from "@/shared/components/ui/badge";
import { BrandMark } from "@/shared/components/branding/BrandMark";

interface WorkspaceSwitcherProps {
  collapsed?: boolean;
}

export function WorkspaceSwitcher({ collapsed }: WorkspaceSwitcherProps) {
  const navigate = useNavigate();
  const { isWebhost, isAgency, isLandlord, isTenant, isManager } = useAuth();
  const [open, setOpen] = useState(false);

  const activeWorkspace = isWebhost
    ? { name: "Webhost Admin Platform", role: "Super Admin", icon: Shield, badge: "System", route: "/webhost" }
    : isAgency
    ? { name: "Agency Workspace", role: "Blended Agent", icon: Handshake, badge: "Agency", route: "/agency" }
    : isLandlord
    ? { name: "Landlord Owner Portal", role: "Property Owner", icon: Building2, badge: "Landlord", route: "/landlord/dashboard" }
    : isTenant
    ? { name: "Tenant Portal", role: "Resident", icon: Home, badge: "Tenant", route: "/portal" }
    : { name: "CALQULUS PMS Enterprise", role: "Property Manager", icon: Building2, badge: "Pro", route: "/" };

  const workspaces = [
    { name: "CALQULUS PMS Enterprise", subtitle: "Primary Management Hub", role: "Manager", route: "/", active: isManager && !isAgency && !isWebhost && !isLandlord && !isTenant },
    ...(isAgency || isWebhost ? [{ name: "Agency Workspace", subtitle: "Client & Owner Commission Management", role: "Agency", route: "/agency", active: isAgency }] : []),
    ...(isWebhost ? [{ name: "Webhost Admin Platform", subtitle: "Platform Oversight & Billing Tiers", role: "Webhost", route: "/webhost", active: isWebhost }] : []),
    ...(isLandlord || isWebhost ? [{ name: "Landlord Owner Portal", subtitle: "Revenue & Occupancy Statements", role: "Landlord", route: "/landlord/dashboard", active: isLandlord }] : []),
  ];

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          className="w-full flex items-center justify-between p-2 rounded-lg bg-sidebar-accent/40 hover:bg-sidebar-accent/70 border border-sidebar-border/60 transition-all text-left group"
          title={collapsed ? activeWorkspace.name : undefined}
        >
          {collapsed ? (
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary mx-auto">
              <BrandMark size="xs" />
            </div>
          ) : (
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary shrink-0 border border-primary/20">
                <BrandMark size="xs" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1">
                  <p className="text-xs font-bold text-sidebar-foreground truncate leading-tight">
                    {activeWorkspace.name}
                  </p>
                </div>
                <p className="text-[10px] text-sidebar-muted truncate leading-none mt-1">
                  {activeWorkspace.role}
                </p>
              </div>
              <ChevronDown className="h-3.5 w-3.5 text-sidebar-muted group-hover:text-sidebar-foreground transition-transform duration-200" />
            </div>
          )}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-64 p-1.5" sideOffset={6}>
        <DropdownMenuLabel className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          Switch Workspace
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="my-1" />

        {workspaces.map((ws) => (
          <DropdownMenuItem
            key={ws.name}
            onClick={() => {
              navigate(ws.route);
              setOpen(false);
            }}
            className="flex items-start gap-2.5 px-2.5 py-2 cursor-pointer focus:bg-muted rounded-md"
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-muted text-muted-foreground shrink-0 mt-0.5">
              <Building2 className="h-3.5 w-3.5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-foreground truncate">{ws.name}</p>
                {ws.active && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
              </div>
              <p className="text-[11px] text-muted-foreground truncate">{ws.subtitle}</p>
            </div>
          </DropdownMenuItem>
        ))}

        <DropdownMenuSeparator className="my-1" />
        <DropdownMenuItem
          onClick={() => {
            navigate("/settings");
            setOpen(false);
          }}
          className="flex items-center gap-2 px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>Workspace Settings</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
