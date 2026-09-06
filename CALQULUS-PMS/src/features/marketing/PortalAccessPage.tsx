import { useMemo } from "react";
import { ArrowLeft, ArrowRight, Building2, Home, Settings2, TrendingUp, UsersRound } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { BrandMark } from "@/shared/components/branding/BrandMark";
import { PublicShell } from "@/features/marketing/components/PublicShell";
import { usePublicSiteConfig } from "@/features/marketing/hooks/usePublicSiteConfig";
import { DEFAULT_PUBLIC_SITE_CONFIG, type PublicSitePortal } from "@/features/marketing/publicSiteConfig";
import { PUBLIC_ROUTES } from "@/features/marketing/publicConfig";
import { PROPERTY_IMAGES } from "@/features/marketing/propertyImages";
import { usePortalIdentity } from "@/core/product/PortalIdentityProvider";
import { Button } from "@/shared/components/ui/button";

const PORTAL_META = {
  agency: {
    icon: UsersRound,
    gradient: "from-[#123FB7] via-[#1658D6] to-transparent",
    accent: "#123FB7",
    features: ["Clients", "Portfolios", "Opportunities"],
    signin: PUBLIC_ROUTES.agencyLogin,
    signup: PUBLIC_ROUTES.agencyLogin,
    signinLabel: "Continue to Agency",
    signupLabel: "Continue to Agency",
  },
  manager: {
    icon: Settings2,
    gradient: "from-[#356FE5] via-[#4B78DD] to-transparent",
    accent: "#356FE5",
    features: ["Operations", "Maintenance", "Compliance"],
    signin: PUBLIC_ROUTES.managerSignIn,
    signup: PUBLIC_ROUTES.managerSignUp,
    signinLabel: "Continue to Manager",
    signupLabel: "Create manager account",
  },
  landlord: {
    icon: TrendingUp,
    gradient: "from-[#2F9B74] via-[#46B48F] to-transparent",
    accent: "#2F9B74",
    features: ["Earnings", "Properties", "Insights"],
    signin: PUBLIC_ROUTES.landlordLogin,
    signup: PUBLIC_ROUTES.landlordLogin,
    signinLabel: "Continue to Landlord",
    signupLabel: "Continue to Landlord",
  },
  tenant: {
    icon: Home,
    gradient: "from-[#7C5FD3] via-[#936EE9] to-transparent",
    accent: "#7C5FD3",
    features: ["Payments", "Requests", "Updates"],
    signin: PUBLIC_ROUTES.tenantLogin,
    signup: "/tenant/signup",
    signinLabel: "Continue to Tenant",
    signupLabel: "Create tenant account",
  },
} as const;

type PortalId = keyof typeof PORTAL_META;
type AccessMode = "signin" | "signup";

function PortalCard({ portal, mode, identities }: { portal: PublicSitePortal; mode: AccessMode; identities: Record<keyof typeof PORTAL_META, { primaryHex?: string }> }) {
  const meta = PORTAL_META[portal.id];
  const Icon = meta.icon;
  const href = mode === "signup" ? meta.signup : meta.signin;
  const actionLabel = mode === "signup" ? meta.signupLabel : meta.signinLabel;
  const accent = identities[portal.id]?.primaryHex || meta.accent;
  const image = portal.image || (
    portal.id === "agency"
      ? PROPERTY_IMAGES.commercial
      : portal.id === "manager"
        ? PROPERTY_IMAGES.office
        : PROPERTY_IMAGES.residential
  );

  return (
    <article className="group flex min-w-0 flex-col overflow-hidden rounded-[24px] border border-slate-200/90 bg-white shadow-[0_14px_34px_rgba(17,43,73,0.10)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_22px_50px_rgba(17,43,73,0.16)]">
      <div className="relative h-[220px] overflow-hidden sm:h-[250px] xl:h-[270px]">
        <img src={image} alt="" className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-[1.035]" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/18 via-transparent to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-1.5" style={{ backgroundColor: accent }} aria-hidden />
        <div className="absolute right-4 top-4 flex h-12 w-12 items-center justify-center rounded-full border border-white/60 bg-white/90 shadow-lg backdrop-blur-sm" style={{ color: accent }}>
          <Icon className="h-5 w-5" aria-hidden />
        </div>
      </div>
      <div className="flex min-h-[188px] flex-1 flex-col p-4 sm:min-h-[198px] sm:p-5">
        <p className="text-[11px] font-bold tracking-[0.2em]" style={{ color: accent }}>{portal.eyebrow}</p>
        <h2 className="mt-1 font-heading text-xl font-semibold leading-tight tracking-[-0.03em] text-navy-deep sm:text-[1.35rem]">{portal.title.replace(/ Portal$/i, "")}</h2>
        <p className="mt-2 text-sm leading-5.5 text-slate-600 sm:text-[15px]">{portal.description}</p>
        <div className="mt-auto pt-4">
          <div className="flex flex-wrap gap-1.5">
            {meta.features.map((feature) => (
              <span key={feature} className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-600">{feature}</span>
            ))}
          </div>
          <Button asChild className="mt-4 h-11 w-full rounded-xl text-sm font-semibold text-white shadow-sm" style={{ backgroundColor: accent }}>
            <Link to={href}>{actionLabel}<ArrowRight className="ml-1.5 h-4 w-4" aria-hidden /></Link>
          </Button>
        </div>
      </div>
    </article>
  );
}

export default function PortalAccessPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { data } = usePublicSiteConfig();
  const { identities } = usePortalIdentity();
  const config = data ?? DEFAULT_PUBLIC_SITE_CONFIG;
  const mode: AccessMode = new URLSearchParams(location.search).get("mode") === "signup" ? "signup" : "signin";

  const portals = useMemo(() => {
    const fallback = DEFAULT_PUBLIC_SITE_CONFIG.portals;
    const source = config.portals.filter((portal) => portal.enabled);
    const items = source.length ? source : fallback;
    const ordered = ["agency", "manager", "landlord", "tenant"] as PortalId[];
    return ordered.map((id) => items.find((portal) => portal.id === id)).filter(Boolean) as PublicSitePortal[];
  }, [config.portals]);

  const goBack = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate(PUBLIC_ROUTES.home);
  };

  const partnerLogos = config.trust.logos.filter((logo) => logo.enabled);

  return (
    <PublicShell>
      <section className="relative min-h-[calc(100svh-66px)] overflow-hidden bg-[radial-gradient(circle_at_10%_0%,rgba(18,63,183,0.09),transparent_28%),linear-gradient(180deg,#F2F7FD_0%,#FFFFFF_42%,#F7FAFD_100%)] py-5 sm:py-6 lg:py-7">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_88%_16%,rgba(18,63,183,0.07),transparent_24%)]" aria-hidden />
        <div className="relative mx-auto flex w-full max-w-[1450px] flex-col px-3 sm:px-5 lg:px-7">
          <div className="flex items-center justify-between gap-3">
            <button type="button" onClick={goBack} className="inline-flex min-h-9 items-center gap-2 rounded-full border border-slate-200 bg-white/90 px-3 py-1.5 text-[13px] font-semibold text-slate-700 shadow-sm transition hover:border-primary/25 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
              <ArrowLeft className="h-4 w-4" aria-hidden /> Back
            </button>
            <Button asChild variant="outline" className="min-h-9 rounded-full border-slate-200 bg-white/90 px-4 text-[13px] text-slate-700 hover:text-primary">
              <Link to={PUBLIC_ROUTES.home}>Home</Link>
            </Button>
          </div>

          <div className="mx-auto max-w-3xl pt-4 text-center sm:pt-5">
            <BrandMark size="sm" showWordmark className="mx-auto w-fit" />
            <p className="mt-3 font-heading text-[11px] font-bold tracking-[0.28em] text-primary">CALQULUS SECURE ACCESS</p>
            <h1 className="mt-1.5 font-heading text-[clamp(1.8rem,3.5vw,2.65rem)] font-semibold leading-[1.02] tracking-[-0.045em] text-navy-deep">
              {mode === "signup" ? "Choose how you want to get started." : "Choose your portal to sign in."}
            </h1>
            <p className="mx-auto mt-2 max-w-2xl text-sm leading-5.5 text-slate-600 sm:text-[15px]">
              {mode === "signup" ? "Choose your role and continue to the right CALQULUS workspace." : "One connected platform, with a focused experience for every property role."}
            </p>
          </div>

          <div className="mx-auto mt-5 grid w-full max-w-[1400px] gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {portals.map((portal) => <PortalCard key={portal.id} portal={portal} mode={mode} identities={identities} />)}
          </div>

          <div className="mx-auto mt-4 flex max-w-5xl items-center justify-center gap-3 text-center text-[11px] text-slate-500">
            <span className="inline-flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-primary" />Secure role-based access</span>
            <span>·</span><span>One connected property platform</span>
          </div>

          {partnerLogos.length ? (
            <div className="mx-auto mt-4 w-full max-w-[1400px] rounded-xl border border-slate-200/80 bg-white/70 px-3 py-2.5 shadow-sm">
              <div className="flex flex-wrap items-center justify-center gap-2.5">
                <span className="mr-1 text-[10px] font-bold tracking-[0.16em] text-primary">PARTNERS & ASSURANCE</span>
                {partnerLogos.slice(0, 8).map((logo) => logo.image ? (
                  <span key={logo.id} className="flex h-8 min-w-[88px] items-center justify-center rounded-md border border-slate-200 bg-white px-2">
                    <img src={logo.image} alt={logo.name} className="max-h-5 max-w-[82px] object-contain" />
                  </span>
                ) : (
                  <span key={logo.id} className="flex h-8 min-w-[88px] items-center justify-center rounded-md border border-slate-200 bg-white px-2 text-[10px] font-semibold text-slate-600">{logo.name}</span>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </section>
    </PublicShell>
  );
}
