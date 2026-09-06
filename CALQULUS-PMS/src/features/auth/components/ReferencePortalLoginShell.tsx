import type { ComponentType, CSSProperties, ReactNode } from "react";
import { Building2, Briefcase, UserRound, LockKeyhole, Mail } from "lucide-react";
import { Link } from "react-router-dom";
import { BrandMark } from "@/shared/components/branding/BrandMark";
import { PUBLIC_ROUTES } from "@/features/marketing/publicConfig";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/shared/hooks/use-toast";
import { cn } from "@/shared/lib/utils";
import propertyResidential from "@/assets/marketing/property-residential.webp";
import landlordLivingRoom from "@/assets/marketing/landlord-living-room.svg";
import propertyOffice from "@/assets/marketing/property-office.webp";
import tenantLivingRoom from "@/assets/marketing/tenant-living-room.svg";

export type ReferencePortalId = "manager" | "landlord" | "tenant" | "agency";

type PortalConfig = {
  id: ReferencePortalId;
  title: string;
  subtitle: string;
  description: string;
  accent: string;
  accentSoft: string;
  background: string;
  lightPanel?: boolean;
  icon: ComponentType<{ className?: string }>;
};

export const REFERENCE_PORTAL_LOGIN_CONFIG: Record<ReferencePortalId, PortalConfig> = {
  manager: {
    id: "manager",
    title: "Property Manager",
    subtitle: "Portal",
    description: "Manage properties, tenants, leases, billing and maintenance efficiently.",
    accent: "#0867E8",
    accentSoft: "#0A73FF",
    background: propertyResidential,
    icon: Building2,
  },
  landlord: {
    id: "landlord",
    title: "Landlord",
    subtitle: "Portal",
    description: "Monitor your properties, track performance and earnings in real-time.",
    accent: "#109C94",
    accentSoft: "#11A79E",
    background: landlordLivingRoom,
    icon: UserRound,
  },
  tenant: {
    id: "tenant",
    title: "Tenant",
    subtitle: "Portal",
    description: "Pay rent, submit maintenance requests and stay updated anytime, anywhere.",
    accent: "#8B55D9",
    accentSoft: "#9148E5",
    background: tenantLivingRoom,
    lightPanel: true,
    icon: UserRound,
  },
  agency: {
    id: "agency",
    title: "Agency",
    subtitle: "Portal",
    description: "Manage multiple clients, properties and portfolios with confidence.",
    accent: "#0867E8",
    accentSoft: "#0A73FF",
    background: propertyOffice,
    icon: Briefcase,
  },
};

const LOGIN_ROUTES: Record<ReferencePortalId, string> = {
  manager: PUBLIC_ROUTES.managerSignIn,
  landlord: PUBLIC_ROUTES.landlordLogin,
  tenant: PUBLIC_ROUTES.tenantLogin,
  agency: PUBLIC_ROUTES.agencyLogin,
};

interface ReferencePortalLoginShellProps {
  portal: ReferencePortalId;
  children: ReactNode;
  /** Heading used by the authentication card. Defaults to the screenshot's "Welcome Back!". */
  formTitle?: string;
  formSubtitle?: string;
  /** Signup mode keeps the same visual shell while allowing a taller form. */
  compactCard?: boolean;
}

/**
 * CALQULUS reference login shell.
 *
 * This deliberately mirrors the supplied four-portal design: a 50/50 desktop
 * split, local imagery on the identity side, portal-specific colour treatment,
 * and one consistent white authentication card. Auth pages keep ownership of
 * all business/authentication logic and only provide the card contents.
 */
export function ReferencePortalLoginShell({
  portal,
  children,
  formTitle = "Welcome Back!",
  formSubtitle,
  compactCard = false,
}: ReferencePortalLoginShellProps) {
  const config = REFERENCE_PORTAL_LOGIN_CONFIG[portal];
  const Icon = config.icon;
  const { toast } = useToast();

  const handleGoogleSignIn = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}${LOGIN_ROUTES[portal]}` },
    });
    if (error) {
      toast({
        title: "Google sign-in unavailable",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const style = {
    "--reference-accent": config.accent,
    "--reference-accent-soft": config.accentSoft,
  } as CSSProperties;

  return (
    <div
      className={cn(
        "min-h-screen w-full overflow-x-hidden bg-white",
        config.lightPanel ? "text-[#10234F]" : "text-white",
      )}
      style={style}
      data-reference-portal={portal}
    >
      <div className="grid min-h-screen lg:grid-cols-2">
        <section
          className={cn(
            "relative isolate min-h-[520px] overflow-hidden lg:min-h-screen",
            config.lightPanel ? "bg-[#f3effb]" : "bg-[#061d4c]",
          )}
          aria-label={`${config.title} ${config.subtitle}`}
        >
          <img
            src={config.background}
            alt=""
            className={cn(
              "absolute inset-0 h-full w-full object-cover",
              config.lightPanel ? "opacity-70" : "opacity-100",
            )}
            fetchPriority="high"
            decoding="async"
          />
          <div
            className={cn(
              "absolute inset-0",
              config.lightPanel
                ? "bg-gradient-to-r from-[#f6f2fb]/90 via-[#f6f2fb]/45 to-transparent"
                : "bg-gradient-to-r from-[#061b49]/95 via-[#06275f]/75 to-transparent",
            )}
          />
          <div
            className={cn(
              "absolute inset-0",
              config.lightPanel ? "bg-gradient-to-t from-[#f6f2fb]/80 via-transparent to-[#f6f2fb]/20" : "bg-gradient-to-t from-[#031638]/70 via-transparent to-transparent",
            )}
          />

          <div className="relative z-10 flex min-h-[520px] flex-col p-7 sm:p-10 lg:min-h-screen lg:p-11 xl:p-12">
            <Link to={PUBLIC_ROUTES.home} aria-label="CALQULUS home" className="self-start">
              <BrandMark
                size="nav"
                showWordmark
                subtitle="PMS"
                inverse={!config.lightPanel}
                forcePlatform
                imgClassName={cn(config.lightPanel && "ring-1 ring-[#7c3aed]/20")}
              />
            </Link>

            <div className="my-auto max-w-[420px] pb-5 pt-16 lg:pt-24">
              <h1
                className={cn(
                  "font-heading text-[2.45rem] font-bold leading-[1.02] tracking-[-0.035em] sm:text-[3rem] xl:text-[3.15rem]",
                  config.lightPanel ? "text-[#0f2450]" : "text-white",
                )}
              >
                <span className="block">{config.title}</span>
                <span className="mt-1 block" style={{ color: config.accent }}>{config.subtitle}</span>
              </h1>
              <div className="mt-5 h-[2px] w-8" style={{ backgroundColor: config.accent }} />

              <div className="mt-7 flex h-14 w-14 items-center justify-center rounded-full border-2" style={{ borderColor: config.accent }}>
                <Icon className={cn("h-7 w-7", config.lightPanel ? "text-[#6f43c5]" : "text-white")} aria-hidden />
              </div>

              <p
                className={cn(
                  "mt-5 max-w-[340px] text-[15px] font-medium leading-6 sm:text-base",
                  config.lightPanel ? "text-[#172b55]" : "text-white/95",
                )}
              >
                {config.description}
              </p>
            </div>
          </div>
        </section>

        <section className="relative flex min-h-[560px] items-center justify-center bg-[#f8fafc] px-4 py-8 sm:px-8 lg:min-h-screen lg:px-10 xl:px-14">
          <div className={cn("w-full max-w-[470px]", compactCard ? "py-4" : "py-1")}>
            <div className="rounded-[16px] border border-[#e4e8ef] bg-white p-7 shadow-[0_16px_45px_rgba(15,35,70,0.12)] sm:p-8 lg:p-8 xl:p-9">
              <div className="mb-6">
                <h2 className="font-heading text-[1.75rem] font-bold leading-tight tracking-[-0.025em] text-[#0e214a] sm:text-[1.9rem]">
                  {formTitle}
                </h2>
                <p className="mt-1.5 text-sm text-[#52617a]">
                  {formSubtitle ?? `Sign in to access your ${config.title.toLowerCase()} portal`}
                </p>
              </div>

              <div className="[&_input]:border-[#d5dce8] [&_input]:bg-white [&_input]:text-[#15284e] [&_input]:placeholder:text-[#6f7b90] [&_input]:focus-visible:ring-2 [&_input]:focus-visible:border-[var(--reference-accent)]">
                {children}
              </div>

              <button
                type="button"
                onClick={handleGoogleSignIn}
                className="mt-5 flex h-11 w-full items-center justify-center gap-3 rounded-md border border-[#d7dee9] bg-white text-sm font-semibold text-[#1b2b4d] transition-colors hover:bg-[#f8fafc] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--reference-accent)]/25"
              >
                <span className="font-heading text-[18px] font-bold" aria-hidden>G</span>
                <span>Sign in with Google</span>
              </button>

              <div className="mt-6 flex items-center justify-center gap-2 text-[11px] font-medium text-[#31425f]">
                <LockKeyhole className="h-3.5 w-3.5" aria-hidden />
                <span>Secure</span><span aria-hidden>•</span><span>Encrypted</span><span aria-hidden>•</span><span>Protected</span>
              </div>
            </div>

            <div className="mt-5 flex items-center justify-center gap-4 text-xs text-[#68758a]">
              <Link to={PUBLIC_ROUTES.legalPrivacy} className="hover:text-[#172b55]">Privacy</Link>
              <span aria-hidden>•</span>
              <Link to={PUBLIC_ROUTES.legalTerms} className="hover:text-[#172b55]">Terms</Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

/** Small helper kept exported for auth forms that want screenshot-matching field icons. */
export const ReferenceLoginIcons = { Mail, LockKeyhole };
