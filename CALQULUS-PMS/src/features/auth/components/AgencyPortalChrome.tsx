import type { ReactNode } from "react";
import {
  BarChart3,
  BadgeDollarSign,
  BriefcaseBusiness,
  Building2,
  CheckCircle2,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import { Link } from "react-router-dom";
import { BrandMark } from "@/shared/components/branding/BrandMark";
import { PROPERTY_IMAGES } from "@/features/marketing/propertyImages";
import { CALQULUS_PORTAL_ACCENT } from "@/shared/theme/tokens";
import { PUBLIC_ROUTES } from "@/features/marketing/publicConfig";
import { usePortalIdentity } from "@/core/product/PortalIdentityProvider";
import { usePublicSiteConfig } from "@/features/marketing/hooks/usePublicSiteConfig";
import { DEFAULT_PUBLIC_SITE_CONFIG } from "@/features/marketing/publicSiteConfig";
import { PortalLoginCard } from "@/features/auth/components/PortalLoginScreen";

/**
 * Agency portal identity: premium sharp-navy visual treatment that directly
 * follows the Agency card on the public homepage. The background photography
 * runs edge-to-edge behind the entire desktop experience; the auth card floats
 * above it as the focal interaction surface.
 */
export const AGENCY_ACCENT = CALQULUS_PORTAL_ACCENT.agency.hex;

interface AgencyPortalShellProps {
  children: ReactNode;
}

const FEATURES = [
  { icon: UsersRound, label: "Clients", text: "Keep every landlord relationship organized and visible." },
  { icon: Building2, label: "Portfolios", text: "Manage buildings, units and property performance together." },
  { icon: BadgeDollarSign, label: "Collections", text: "Track collections, balances and revenue share." },
] as const;

const TRUST_POINTS = ["Client portfolios", "Property operations", "Collections visibility"] as const;

export function AgencyPortalShell({ children }: AgencyPortalShellProps) {
  const { identities } = usePortalIdentity();
  const { data: publicConfig = DEFAULT_PUBLIC_SITE_CONFIG } = usePublicSiteConfig();
  const identity = identities.agency;
  const brand = publicConfig.brand;
  const backgroundImage = identity.backgroundImageUrl || PROPERTY_IMAGES.office;
  const agencyAccent = identity.primaryHex || AGENCY_ACCENT;

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#061A2A] text-white">
      {/* Full-bleed photographic background */}
      <div className="absolute inset-0" aria-hidden>
        <img
          src={backgroundImage}
          alt=""
          loading="eager"
          decoding="async"
          className="h-full w-full object-cover object-center"
        />
        <div className="absolute inset-0" style={{ background: `linear-gradient(90deg,#061A2AF2 0%,${agencyAccent}D9 38%,${agencyAccent}B8 64%,#061A2AE8 100%)` }} />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_72%_14%,rgba(88,196,255,0.18),transparent_26%),radial-gradient(circle_at_15%_84%,rgba(35,156,255,0.14),transparent_30%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(0deg,rgba(6,26,42,0.40),transparent_30%,rgba(6,26,42,0.24))]" />
      </div>

      <div className="relative z-10 flex min-h-screen flex-col">
        {/* Shared premium header */}
        <header className="flex items-center justify-between gap-4 px-5 py-5 sm:px-8 lg:px-10 xl:px-14">
          <Link to={PUBLIC_ROUTES.home} aria-label="CALQULUS home">
            <BrandMark size="nav" showWordmark subtitleOverride={brand.descriptor} wordmarkOverride={brand.name} logoUrl={brand.logoUrl} inverse forcePlatform />
          </Link>
          <Link
            to={PUBLIC_ROUTES.home}
            className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold tracking-wide text-white/90 shadow-lg backdrop-blur-md transition hover:border-white/30 hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
          >
            Back to CALQULUS
          </Link>
        </header>

        {/* Main experience: identity content left, floating auth card right */}
        <main className="flex flex-1 items-stretch px-4 pb-5 sm:px-7 sm:pb-7 lg:px-10 lg:pb-10 xl:px-14">
          <div className="mx-auto grid w-full max-w-[1500px] items-center gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(390px,470px)] xl:gap-14">
            <section className="flex min-h-0 flex-col justify-center px-2 py-8 sm:min-h-[500px] sm:px-4 lg:min-h-[calc(100vh-122px)] lg:py-10">
              <div className="max-w-3xl">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3.5 py-2 text-xs font-bold tracking-[0.22em] text-white/92 shadow-lg backdrop-blur-md">
                  <BriefcaseBusiness className="h-4 w-4 text-[#58C4FF]" aria-hidden />
                  AGENCY PORTAL
                </div>

                <h1 className="mt-6 max-w-3xl font-heading text-[clamp(2.8rem,5.8vw,5.5rem)] font-semibold leading-[0.94] tracking-[-0.05em] text-white drop-shadow-[0_3px_18px_rgba(0,0,0,0.24)]">
                  Agency
                </h1>

                <p className="mt-4 max-w-2xl font-heading text-[clamp(1.5rem,2.45vw,2.2rem)] font-medium leading-[1.1] tracking-[-0.03em] text-white/96">
                  {identity.tagline || "Grow your agency. Manage every portfolio with confidence."}
                </p>

                <p className="mt-5 max-w-2xl text-base leading-7.5 text-white/88 sm:text-lg sm:leading-8">
                  Manage clients, portfolios, collections and agency operations from one connected workspace.
                </p>

                <div className="mt-7 flex flex-wrap gap-2.5">
                  {TRUST_POINTS.map((point) => (
                    <span
                      key={point}
                      className="inline-flex items-center gap-2 rounded-full border border-white/14 bg-white/9 px-3.5 py-2 text-sm font-semibold text-white/90 backdrop-blur-md"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5 text-[#58C4FF]" aria-hidden />
                      {point}
                    </span>
                  ))}
                </div>

                <div className="mt-8 flex w-fit items-center gap-2.5 rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-sm font-semibold text-white/90 backdrop-blur-md shadow-lg">
                  <ShieldCheck className="h-4 w-4 text-[#58C4FF]" aria-hidden />
                  Secure access to your agency workspace
                </div>

                <div className="mt-9 grid max-w-3xl gap-3 sm:grid-cols-3">
                  {FEATURES.map(({ icon: Icon, label, text }) => (
                    <div
                      key={label}
                      className="min-w-0 rounded-2xl border border-white/12 bg-black/10 p-4 shadow-lg backdrop-blur-md"
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-white/10">
                        <Icon className="h-5 w-5 text-[#58C4FF]" aria-hidden />
                      </div>
                      <p className="mt-3 text-xs font-bold text-white">{label}</p>
                      <p className="mt-1 text-xs leading-5 text-white/68">{text}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <aside className="relative flex items-center justify-center lg:py-8" aria-label="Agency sign in">
              {/* Soft halo separates the auth surface from the photograph without creating a second page background. */}
              <div className="absolute inset-x-6 inset-y-10 rounded-[36px] bg-white/8 blur-3xl" aria-hidden />
              <div className="relative w-full max-w-md rounded-[28px] border border-white/20 bg-white/96 p-1 shadow-[0_28px_90px_rgba(2,15,28,0.42)] backdrop-blur-xl">
                <div className="rounded-[24px] border border-slate-200/80 bg-white p-2 sm:p-3">
                  {children}
                </div>
                <div className="px-5 pb-4 pt-3 text-center text-xs leading-4.5 text-slate-500">
                  <span className="font-semibold text-[#123FB7]">Agency workspace</span>
                  {" · "}portfolio operations, client service and collections in one place.
                </div>
              </div>
            </aside>
          </div>
        </main>

        <footer className="flex items-center justify-between gap-4 border-t border-white/10 px-5 py-4 text-xs text-white/60 sm:px-8 lg:px-10 xl:px-14">
          <span>© 2026 CALQULUS Limited</span>
          <span className="inline-flex items-center gap-2">
            <BarChart3 className="h-3.5 w-3.5 text-[#58C4FF]" aria-hidden />
            Portfolio operations
          </span>
        </footer>
      </div>
    </div>
  );
}
