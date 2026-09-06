import { Link } from "react-router-dom";
import { ArrowRight, Home, LayoutDashboard, TrendingUp, Users, type LucideIcon } from "lucide-react";
import { HOMEPAGE_ROLE_ACCENTS, PUBLIC_ROUTES } from "@/features/marketing/publicConfig";

const ROLES: {
  id: keyof typeof HOMEPAGE_ROLE_ACCENTS;
  icon: LucideIcon;
  title: string;
  visual: string;
  purpose: string;
  href: string;
}[] = [
  {
    id: "manager",
    icon: LayoutDashboard,
    title: "Manager",
    visual: "Property operations",
    purpose: "Run operations.",
    href: PUBLIC_ROUTES.managerSignUp,
  },
  {
    id: "landlord",
    icon: TrendingUp,
    title: "Landlord",
    visual: "Portfolio and income",
    purpose: "Track your portfolio.",
    href: PUBLIC_ROUTES.landlordLogin,
  },
  {
    id: "agency",
    icon: Users,
    title: "Agency",
    visual: "Client portfolios",
    purpose: "Manage properties and clients.",
    href: PUBLIC_ROUTES.agencyLogin,
  },
  {
    id: "tenant",
    icon: Home,
    title: "Tenant",
    visual: "Home and rent",
    purpose: "Pay rent and manage requests.",
    href: PUBLIC_ROUTES.tenantLogin,
  },
];

/**
 * "One system. Every role." — compact role strip: small accent marker, role
 * name, one-line purpose, portal action. Role colours are accents only.
 */
export function PortalExperiences() {
  return (
    <section id="solutions" className="scroll-mt-20 bg-card py-8 sm:py-9">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="public-section-title">One system. Every role.</h2>
          <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground sm:text-base">
            Each role gets its own portal on the same data.
          </p>
        </div>

        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {ROLES.map((role) => {
            const accent = HOMEPAGE_ROLE_ACCENTS[role.id];
            return (
              <li
                key={role.title}
                className="relative flex flex-col overflow-hidden rounded-[14px] border border-border bg-background shadow-sm transition-shadow duration-200 hover:shadow-md"
              >
                <span className="absolute inset-x-0 top-0 h-[3px]" style={{ backgroundColor: accent }} aria-hidden />
                <div className="flex flex-1 flex-col p-4 pt-5">
                  <div className="flex items-center gap-2.5">
                    <span
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md"
                      style={{ backgroundColor: `color-mix(in srgb, ${accent} 12%, #FFFFFF)`, color: accent }}
                    >
                      <role.icon className="h-4 w-4" aria-hidden />
                    </span>
                    <div className="min-w-0">
                      <h3 className="font-heading text-sm font-semibold leading-tight text-foreground">
                        {role.title}
                      </h3>
                      <p className="truncate text-xs text-muted-foreground">{role.visual}</p>
                    </div>
                  </div>
                  <p className="mt-3 text-[13px] leading-relaxed text-foreground/80">{role.purpose}</p>
                  <Link
                    to={role.href}
                    aria-label={`View ${role.title} portal`}
                    className="mt-4 inline-flex min-h-11 items-center gap-1 text-sm font-medium hover:underline"
                    style={{ color: `color-mix(in srgb, ${accent} 50%, var(--navy-deep))` }}
                  >
                    View portal
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
