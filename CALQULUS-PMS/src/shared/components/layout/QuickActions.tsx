import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus,
  FileText,
  UserPlus,
  CreditCard,
  Droplets,
  Wrench,
  FileSpreadsheet,
  UserX,
} from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";

export function QuickActions() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const actions = [
    {
      label: "New Lease",
      description: "Create or assign a lease agreement",
      icon: FileText,
      route: "/leases",
      shortcut: "L",
    },
    {
      label: "Invite Tenant",
      description: "Send invitation to a new tenant",
      icon: UserPlus,
      route: "/invites",
      shortcut: "I",
    },
    {
      label: "Record Payment",
      description: "Process rent or invoice payment",
      icon: CreditCard,
      route: "/billing",
      shortcut: "P",
    },
    {
      label: "Water Meter Reading",
      description: "Log water usage per unit",
      icon: Droplets,
      route: "/water-billing",
      shortcut: "W",
    },
    {
      label: "Log Work Order",
      description: "Submit new maintenance task",
      icon: Wrench,
      route: "/maintenance",
      shortcut: "M",
    },
    {
      label: "Generate Statement",
      description: "Owner or property financial statement",
      icon: FileSpreadsheet,
      route: "/statements",
      shortcut: "S",
    },
    {
      label: "Tenant Screening",
      description: "Perform applicant background check",
      icon: UserX,
      route: "/tenant-screening",
      shortcut: "T",
    },
  ];

  const handleAction = (route: string) => {
    navigate(route);
    setOpen(false);
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          size="sm"
          aria-label="Quick actions"
          className="min-h-11 h-11 gap-1.5 bg-primary text-primary-foreground font-semibold px-3 shadow-sm hover:bg-primary/90 transition-all text-xs"
        >
          <Plus className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Quick Action</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 p-1.5" sideOffset={8}>
        <DropdownMenuLabel className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Quick Actions
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="my-1" />
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <DropdownMenuItem
              key={action.label}
              onClick={() => handleAction(action.route)}
              className="flex items-start gap-3 px-2.5 py-2 cursor-pointer focus:bg-muted/80 rounded-md"
            >
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary shrink-0 mt-0.5">
                <Icon className="h-3.5 w-3.5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-foreground leading-snug">{action.label}</p>
                </div>
                <p className="text-[11px] text-muted-foreground truncate">{action.description}</p>
              </div>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
