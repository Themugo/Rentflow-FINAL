import { useLocation, Link } from "react-router-dom";
import { ChevronRight, Home } from "lucide-react";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/shared/components/ui/breadcrumb";

const ROUTE_LABELS: Record<string, string> = {
  "": "Home",
  "leases": "Leases",
  "tenants": "Tenants",
  "tenant-screening": "Tenant Screening",
  "invites": "Invites",
  "vacation-notices": "Vacation Notices",
  "billing": "Billing & Invoices",
  "water-billing": "Water Meter Billing",
  "statements": "Property Statements",
  "payments": "Payment History",
  "platform-billing": "Platform Subscriptions",
  "maintenance": "Maintenance & Work Orders",
  "contracts": "Contracts & Agreements",
  "landlords": "Landlord Registry",
  "services": "Vendor Services",
  "reports": "Financial & Occupancy Reports",
  "settings": "System Settings",
  "webhost": "Webhost Portal",
  "agency": "Agency Workspace",
  "properties": "Properties",
  "landlord": "Landlord Portal",
  "portal": "Tenant Portal",
  "inbox": "Messages & Inbox",
  "documents": "Legal Documents",
  "activate": "Account Activation",
  "legal": "Terms & Compliance",
  "install": "PWA Installation",
};

export function BreadcrumbSystem() {
  const location = useLocation();
  const pathnames = location.pathname.split("/").filter((x) => x);

  if (pathnames.length === 0) {
    return (
      <Breadcrumb className="hidden sm:block">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbPage className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
              <Home className="h-3.5 w-3.5 text-primary" />
              <span>Workspace Dashboard</span>
            </BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    );
  }

  return (
    <Breadcrumb className="hidden sm:block">
      <BreadcrumbList className="text-xs">
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link to="/" className="flex items-center gap-1 text-muted-foreground hover:text-foreground font-medium transition-colors">
              <Home className="h-3.5 w-3.5" />
            </Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator>
          <ChevronRight className="h-3 w-3 text-muted-foreground/50" />
        </BreadcrumbSeparator>

        {pathnames.map((value, index) => {
          const to = `/${pathnames.slice(0, index + 1).join("/")}`;
          const isLast = index === pathnames.length - 1;
          const label = ROUTE_LABELS[value.toLowerCase()]
            || (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
              ? "Details"
              : decodeURIComponent(value));

          return (
            <div key={to} className="inline-flex items-center gap-1.5">
              <BreadcrumbItem>
                {isLast ? (
                  <BreadcrumbPage className="font-semibold text-foreground truncate max-w-[160px]">
                    {label}
                  </BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link to={to} className="text-muted-foreground hover:text-foreground font-medium transition-colors">
                      {label}
                    </Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
              {!isLast && (
                <BreadcrumbSeparator>
                  <ChevronRight className="h-3 w-3 text-muted-foreground/50" />
                </BreadcrumbSeparator>
              )}
            </div>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
