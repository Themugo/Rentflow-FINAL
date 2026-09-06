import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { ArrowRight, BarChart3, Building2, ChevronLeft, ChevronRight, Clock3, Cloud, FileStack, Home, Landmark, Search, ShieldCheck, Sparkles, TrendingUp, Users, Wrench, Leaf, Settings2 } from "lucide-react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/shared/components/ui/button";
import { PublicPricing } from "@/features/marketing/components/PublicPricing";
import { PublicShell } from "@/features/marketing/components/PublicShell";
import { usePublicTiers } from "@/features/marketing/hooks/usePublicTiers";
import { usePublicSiteConfig } from "@/features/marketing/hooks/usePublicSiteConfig";
import { PUBLIC_ROUTES } from "@/features/marketing/publicConfig";
import { PROPERTY_IMAGES } from "@/features/marketing/propertyImages";
import { DEFAULT_PUBLIC_SITE_CONFIG, type PublicSiteConfig, type PublicSiteSectionId, type PublicSiteRailId, type PublicSiteMarketingAd } from "@/features/marketing/publicSiteConfig";
import { usePortalIdentity } from "@/core/product/PortalIdentityProvider";

const CONTAINER = "mx-auto w-full max-w-[1480px] px-3 sm:px-4 lg:px-6";
const PROPERTY_ICONS = { home: Home, building: Building2, office: Building2, landmark: Landmark } as const;
const PORTAL_ICONS = { agency: Building2, manager: Settings2, landlord: TrendingUp, tenant: Home } as const;
const PORTAL_COLORS = {
  agency: "#123FB7",
  manager: "#356FE5",
  landlord: "#2F9B74",
  tenant: "#7C5FD3",
} as const;
const WHY_ICONS = { stack: FileStack, gear: Settings2, chart: BarChart3, leaf: Leaf } as const;
const HERO_PILL_ICONS = { portals: Users, secure: ShieldCheck, insights: TrendingUp, reliable: Cloud } as const;
const HIGHLIGHT_ICONS = { property: Building2, users: Users, uptime: Clock3, support: ShieldCheck } as const;

function img(url: string | null | undefined, fallback: string) { return typeof url === "string" && url.trim() ? url : fallback; }
function isWebExternal(href: string) { return /^https?:\/\//i.test(href); }
function isProtocolLink(href: string) { return /^(?:https?:\/\/|mailto:|tel:)/i.test(href); }
function NavLink({ href, children, onClick, className = "", tabIndex, ariaLabel }: { href: string; children: ReactNode; onClick?: () => void; className?: string; tabIndex?: number; ariaLabel?: string }) {
  if (href.startsWith("#")) return <a href={href} onClick={onClick} className={className} tabIndex={tabIndex} aria-label={ariaLabel}>{children}</a>;
  if (isProtocolLink(href)) return <a href={href} target={isWebExternal(href) ? "_blank" : undefined} rel={isWebExternal(href) ? "noreferrer" : undefined} onClick={onClick} className={className} tabIndex={tabIndex} aria-label={ariaLabel}>{children}</a>;
  return <Link to={href} onClick={onClick} className={className} tabIndex={tabIndex} aria-label={ariaLabel}>{children}</Link>;
}

function AdCard({ ad, className = "" }: { ad: PublicSiteMarketingAd; className?: string }) {
  const sizeClass = ad.size === "wide" ? "min-h-[150px]" : ad.size === "standard" ? "min-h-[118px]" : "min-h-[92px]";
  return (
    <NavLink
      href={ad.href}
      ariaLabel={ad.title}
      className={`group relative block overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-[0_14px_34px_rgba(16,42,67,0.16)] backdrop-blur-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 ${sizeClass} ${className}`}
    >
      {ad.image ? <img src={ad.image} alt="" className="absolute inset-0 h-full w-full object-cover opacity-30 transition duration-500 group-hover:scale-105" /> : null}
      <div className="absolute inset-0 bg-gradient-to-r from-white via-white/92 to-white/55" />
      <div className="relative flex h-full items-center gap-3 px-4 py-3">
        <div className="min-w-0 flex-1">
          <span className="inline-flex rounded-md bg-primary px-2 py-0.5 text-[10px] font-bold tracking-[0.15em] text-white">{ad.label}</span>
          <p className="mt-1.5 line-clamp-2 text-sm font-bold leading-4.5 text-navy-deep">{ad.title}</p>
          <p className="mt-1 line-clamp-2 text-xs leading-4.5 text-muted-foreground">{ad.copy}</p>
        </div>
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-white shadow-sm">
          <ArrowRight className="h-4 w-4" />
        </span>
      </div>
    </NavLink>
  );
}

function replacementAd(ads: PublicSiteMarketingAd[], targetId: string) {
  return ads.find((ad) => ad.enabled && ad.mode === "replace" && ad.targetId === targetId) ?? null;
}

function overlayAd(ads: PublicSiteMarketingAd[], placement: PublicSiteMarketingAd["placement"]) {
  return ads.find((ad) => ad.enabled && ad.mode === "overlay" && ad.placement === placement) ?? null;
}

function adPositionClass(position: PublicSiteMarketingAd["position"]) {
  switch (position) {
    case "top-left": return "left-3 top-3";
    case "bottom-left": return "bottom-3 left-3";
    case "bottom-right": return "bottom-3 right-3";
    default: return "right-3 top-3";
  }
}

function Hero({ config }: { config: PublicSiteConfig }) {
  const enabledSlides = config.hero.slides.filter((slide) => slide?.enabled);
  const slides = enabledSlides.length ? enabledSlides : DEFAULT_PUBLIC_SITE_CONFIG.hero.slides;
  const heroMarketingAd = overlayAd(config.marketingAds, "hero");
  const enabledPromos = config.hero.floatingCards.filter((card) => card?.enabled).slice(0, 3);
  const promos = heroMarketingAd ? [] : (enabledPromos.length ? enabledPromos : DEFAULT_PUBLIC_SITE_CONFIG.hero.floatingCards);
  const pills = config.hero.pills.filter((pill) => pill?.enabled);
  const [active, setActive] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setPrefersReducedMotion(media.matches);
    update();
    media.addEventListener?.("change", update);
    return () => media.removeEventListener?.("change", update);
  }, []);

  useEffect(() => {
    if (!config.hero.autoplay || slides.length < 2 || isPaused || prefersReducedMotion) return;
    const timer = window.setInterval(
      () => setActive((value) => (value + 1) % slides.length),
      config.hero.intervalMs,
    );
    return () => window.clearInterval(timer);
  }, [config.hero.autoplay, config.hero.intervalMs, slides.length, isPaused, prefersReducedMotion]);

  useEffect(() => {
    setActive((value) => Math.min(value, Math.max(slides.length - 1, 0)));
  }, [slides.length]);

  const previous = () => setActive((value) => (value - 1 + slides.length) % slides.length);
  const next = () => setActive((value) => (value + 1) % slides.length);

  return (
    <section
      aria-roledescription="carousel"
      aria-label="CALQULUS property highlights"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocusCapture={() => setIsPaused(true)}
      onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setIsPaused(false); }}
      className={`relative isolate overflow-hidden py-2 sm:py-3 ${
        config.hero.fitMode === "screen" ? "min-h-[calc(100svh-72px)]" : ""
      }`}
    >
      <div className={`${CONTAINER} ${config.hero.fitMode === "screen" ? "h-full" : ""}`}>
        <div className="relative overflow-hidden rounded-[20px] border border-border bg-card shadow-[0_18px_55px_rgba(10,32,54,0.12)]">
          {/* Fixed slide frame: every hero page occupies exactly the same footprint. */}
          <div className="relative h-[350px] min-h-0 sm:h-[370px] xl:h-[390px]">
            {slides.map((slide, index) => {
              const activeSlide = index === active;
              const image = img(slide.image, PROPERTY_IMAGES.residential);
              const secondaryHref = slide.secondaryHref;
              return (
                <article
                  key={slide.id}
                  role="group"
                  aria-roledescription="slide"
                  aria-label={`${index + 1} of ${slides.length}: ${slide.title}`}
                  aria-hidden={!activeSlide}
                  className={`absolute inset-0 grid lg:grid-cols-[1.04fr_1.25fr] transition-[opacity,transform] ease-in-out ${
                    activeSlide
                      ? "z-10 translate-x-0 opacity-100"
                      : "pointer-events-none z-0 translate-x-2 opacity-0"
                  }`}
                  style={{ transitionDuration: `${prefersReducedMotion ? 0 : config.hero.transitionMs}ms` }}
                >
                  <div className="relative z-10 flex min-h-0 min-w-0 flex-col justify-center overflow-hidden bg-[linear-gradient(135deg,#ffffff_0%,#f7fbff_58%,#edf5fb_100%)] px-5 py-7 sm:px-8 sm:py-8 lg:px-10 xl:px-12">
                    <div className="min-w-0 max-w-[540px]">
                      <p className="font-heading text-xs font-semibold tracking-[0.26em] text-primary sm:text-sm">
                        {slide.eyebrow}
                      </p>
                      <div className="mt-4 flex items-start gap-3">
                        <h1 className="min-w-0 max-w-[640px] flex-1 line-clamp-3 font-heading text-[clamp(1.95rem,3.7vw,3.55rem)] font-semibold leading-[0.97] tracking-[-0.05em] text-navy-deep">
                          {slide.title}
                        </h1>
                        <div className="hidden w-[82px] shrink-0 pt-3 text-right sm:block" aria-hidden>
                          {slide.signature.slice(0, 3).map((line) => (
                            <div key={line} className="font-serif text-[21px] italic leading-[0.95] text-primary/70 drop-shadow-sm">
                              {line}
                            </div>
                          ))}
                          <div className="mt-1 h-1.5 w-14 rounded-full bg-primary/70" />
                        </div>
                      </div>
                      <p className="mt-4 max-w-xl text-[15px] leading-6.5 text-muted-foreground sm:text-base">
                        {slide.copy}
                      </p>
                      <div className="mt-4 flex flex-wrap gap-2.5">
                        <Button
                          asChild
                          tabIndex={activeSlide ? 0 : -1}
                          className="btn-brand h-10 rounded-xl px-5 text-sm font-semibold"
                        >
                          <Link tabIndex={activeSlide ? 0 : -1} to={slide.primaryHref}>
                            {slide.primaryLabel}
                            <ArrowRight className="ml-1 h-4 w-4" />
                          </Link>
                        </Button>
                        <Button
                          asChild
                          tabIndex={activeSlide ? 0 : -1}
                          variant="outline"
                          className="h-10 rounded-xl border-primary/20 bg-white px-5 text-[17px] font-semibold text-navy-deep hover:bg-muted"
                        >
                          <NavLink tabIndex={activeSlide ? 0 : -1} href={secondaryHref}>
                            {slide.secondaryLabel}
                            <ArrowRight className="ml-1 h-4 w-4" />
                          </NavLink>
                        </Button>
                      </div>
                    </div>
                  </div>
                  <div className="relative min-h-0 overflow-hidden">
                    <picture>
                      <source media="(max-width: 640px)" srcSet={img(slide.mobileImage, image)} />
                      <img
                      src={image}
                      alt=""
                      className="absolute inset-0 h-full w-full object-cover"
                      loading={index === 0 ? "eager" : "lazy"}
                    />
                    </picture>
                    <div
                      className={`absolute inset-0 ${
                        config.hero.overlay === "strong"
                          ? "bg-navy-deep/40"
                          : config.hero.overlay === "medium"
                            ? "bg-navy-deep/20"
                            : "bg-navy-deep/10"
                      }`}
                    />
                  </div>
                </article>
              );
            })}

            {promos.length ? (
              <div className="absolute inset-y-3 right-3 z-20 hidden w-[24%] min-w-[245px] max-w-[325px] flex-col gap-2.5 lg:flex xl:right-4">
                {promos.map((promo) => (
                  <NavLink
                    key={promo.id}
                    href={promo.href}
                    className="group relative min-h-[74px] overflow-hidden rounded-xl border border-white/50 bg-white/92 shadow-lg backdrop-blur-sm"
                  >
                    <img
                      src={img(promo.image, PROPERTY_IMAGES.office)}
                      alt=""
                      className="absolute inset-0 h-full w-full object-cover opacity-30 transition group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-r from-white via-white/90 to-white/35" />
                    <div className="relative flex h-full items-center gap-3 px-3.5 py-2.5">
                      <div className="min-w-0 flex-1">
                        <span className="inline-flex rounded-md bg-primary px-2 py-0.5 text-xs font-bold tracking-[0.16em] text-white">
                          {promo.label}
                        </span>
                        <p className="mt-1 truncate text-[13px] font-semibold text-navy-deep">{promo.title}</p>
                        <p className="truncate text-[13px] text-muted-foreground">{promo.copy}</p>
                      </div>
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-white">
                        <ArrowRight className="h-3.5 w-3.5" />
                      </span>
                    </div>
                  </NavLink>
                ))}
              </div>
            ) : null}

            {slides.length > 1 ? (
              <div className="absolute bottom-12 right-4 z-30 flex items-center gap-1.5 sm:right-6">
                <button
                  aria-label="Previous hero slide"
                  onClick={previous}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-white/35 bg-navy-deep/50 text-white backdrop-blur transition hover:bg-navy-deep/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span aria-live="polite" className="rounded-full bg-navy-deep/45 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur">
                  {active + 1}/{slides.length}
                </span>
                <button
                  aria-label="Next hero slide"
                  onClick={next}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-white/35 bg-navy-deep/50 text-white backdrop-blur transition hover:bg-navy-deep/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            ) : null}
          </div>

          <div className="relative z-20 border-t border-border/70 bg-white/95 px-4 py-2.5 backdrop-blur sm:px-6 lg:pr-[27%]">
            <div className="flex flex-wrap items-center gap-2.5">
              {(pills.length ? pills : DEFAULT_PUBLIC_SITE_CONFIG.hero.pills).map((pill) => {
                const Icon = HERO_PILL_ICONS[pill.icon];
                return (
                  <span
                    key={pill.id}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1 text-[13px] font-semibold text-muted-foreground"
                  >
                    <Icon className="h-3.5 w-3.5 text-primary" />
                    {pill.label}
                  </span>
                );
              })}
            </div>
          </div>
        </div>
      </div>
      {heroMarketingAd ? <div className="pointer-events-auto absolute z-40 hidden w-[270px] md:block lg:w-[300px]" style={{ right: "1.5rem", top: "1.5rem" }}><AdCard ad={heroMarketingAd}/></div> : null}
    </section>
  );
}

function SectionHeading({ eyebrow, title, copy, action }: { eyebrow?: string; title: string; copy?: string; action?: ReactNode }) {
  return <div className="mb-3 flex min-w-0 items-end justify-between gap-3"><div className="min-w-0"><p className="font-heading text-xs font-bold tracking-[0.22em] text-primary sm:text-xs">{eyebrow}</p><h2 className="mt-1 max-w-3xl font-heading text-[clamp(1.7rem,2.7vw,2.25rem)] font-semibold leading-[1.08] tracking-[-0.045em] text-navy-deep">{title}</h2>{copy ? <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-[15px]">{copy}</p> : null}</div>{action ? <div className="shrink-0">{action}</div> : null}</div>;
}

function PropertyTypes({ items, ads = [] }: { items: PublicSiteConfig["propertyTypes"]; ads?: PublicSiteMarketingAd[] }) {
  const visible = items.filter((item) => item?.enabled);
  return <section id="property-types" className="bg-background py-3 sm:py-4"><div className={CONTAINER}><SectionHeading eyebrow="EXPLORE PROPERTY TYPES" title="Different properties. Smarter management." action={<div className="hidden items-center gap-1.5 sm:flex"><NavLink href="/discover/residential" className="ml-1 rounded-full border border-border bg-white px-3 py-1.5 text-[13px] font-semibold text-navy-deep">Browse Listings <ArrowRight className="ml-1 inline h-3 w-3" /></NavLink></div>} /><div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">{visible.map((item) => { const Icon = PROPERTY_ICONS[item.icon] ?? Building2; const replacement = replacementAd(ads, item.id); if (replacement) return <AdCard key={item.id} ad={replacement} className="min-h-[168px]"/>; return <NavLink key={item.id} href={item.href} className="group min-w-0 overflow-hidden rounded-xl border border-border bg-card shadow-[0_6px_18px_rgba(16,42,67,0.06)] transition hover:-translate-y-0.5 hover:shadow-[0_12px_26px_rgba(16,42,67,0.12)]"><div className="relative h-[96px] overflow-hidden sm:h-[108px]"><img src={img(item.image, PROPERTY_IMAGES.residential)} alt="" className="h-full w-full object-cover transition duration-500 group-hover:scale-105"/><div className="absolute inset-0 bg-gradient-to-t from-navy-deep/50 to-transparent"/></div><div className="relative flex min-h-[64px] items-center gap-3 px-3 py-2.5"><span className="-mt-9 flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-4 border-white bg-white text-primary shadow-sm"><Icon className="h-5 w-5" /></span><div className="min-w-0 flex-1"><h3 className="truncate font-heading text-[18px] font-semibold text-navy-deep">{item.title}</h3><p className="truncate text-sm text-muted-foreground">{item.description}</p></div><span className="ml-auto flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-primary/35 text-primary"><ArrowRight className="h-3.5 w-3.5" /></span></div></NavLink>; })}</div></div></section>;
}

function Portals({ items, ads = [] }: { items: PublicSiteConfig["portals"]; ads?: PublicSiteMarketingAd[] }) {
  const visible = items.filter((item) => item?.enabled);
  const { identities } = usePortalIdentity();
  const portalFeatures: Record<PublicSiteConfig["portals"][number]["id"], string[]> = {
    agency: ["Clients", "Portfolios", "Opportunities"],
    manager: ["Operations", "Maintenance", "Compliance"],
    landlord: ["Earnings", "Properties", "Insights"],
    tenant: ["Payments", "Requests", "Updates"],
  };
  return <section id="portals" className="bg-[radial-gradient(circle_at_50%_0%,rgba(18,63,183,0.055),transparent_42%),#F4F7FB] py-4 sm:py-5"><div className={CONTAINER}><SectionHeading eyebrow="ACCESS YOUR PORTAL" title="Choose your portal to get started." copy="Different needs. One connected property platform."/><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{visible.map((item) => {
    const Icon = PORTAL_ICONS[item.id] ?? Building2;
    const accent = identities[item.id]?.primaryHex || PORTAL_COLORS[item.id];
    const replacement = replacementAd(ads, item.id);
    if (replacement) return <AdCard key={item.id} ad={replacement} className="min-h-[180px] sm:min-h-[188px]" />;
    return <NavLink key={item.id} href={item.href} className="group flex min-w-0 flex-col overflow-hidden rounded-2xl border border-white/90 bg-white shadow-[0_10px_26px_rgba(16,42,67,0.10)] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_16px_34px_rgba(16,42,67,0.15)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60">
      <div className="relative h-[118px] overflow-hidden sm:h-[126px]">
        <img src={img(item.image, PROPERTY_IMAGES.office)} alt="" className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-105"/>
        <div className="absolute inset-0 bg-gradient-to-t from-black/28 via-transparent to-transparent"/>
        <div className="absolute inset-x-0 bottom-0 h-1.5" style={{ backgroundColor: accent }} aria-hidden />
        <span className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full border border-white/60 bg-white/90 shadow-sm backdrop-blur-sm" style={{ color: accent }}><Icon className="h-4 w-4" /></span>
      </div>
      <div className="flex min-h-[76px] min-w-0 items-center gap-2.5 px-3.5 py-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[10px] font-bold tracking-[0.17em]" style={{ color: accent }}>{item.eyebrow}</p>
          <h3 className="truncate font-heading text-[15px] font-semibold text-navy-deep sm:text-base">{item.title.replace(" Portal", "")}</h3>
        </div>
        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition group-hover:border-primary/25 group-hover:text-primary"><ArrowRight className="h-3.5 w-3.5"/></span>
      </div>
    </NavLink>;
  })}</div></div></section>;
}

function WhyChoose({ config, ads = [] }: { config: PublicSiteConfig["why"]; ads?: PublicSiteMarketingAd[] }) {
  return <section id="why" className="bg-background py-2 sm:py-3"><div className={CONTAINER}><div className="flex min-w-0 flex-col gap-3 rounded-2xl border border-border/70 bg-[linear-gradient(90deg,#ffffff,#f4f8ff)] px-3.5 py-3 sm:flex-row sm:items-center sm:px-4"><div className="w-full min-w-0 sm:max-w-[285px]"><p className="font-heading text-[13px] font-bold tracking-[0.18em] text-primary">{config.eyebrow}</p><h2 className="mt-1 font-heading text-lg font-semibold leading-tight tracking-[-0.03em] text-navy-deep">{config.title}</h2>{config.copy ? <p className="mt-1 text-[13px] text-muted-foreground">{config.copy}</p> : null}</div><div className="grid min-w-0 flex-1 grid-cols-2 gap-2 xl:grid-cols-4">{config.cards.filter((card) => card.enabled).map((card) => { const Icon = WHY_ICONS[card.icon] ?? Sparkles; const replacement = replacementAd(ads, card.id); if (replacement) return <AdCard key={card.id} ad={replacement} className="min-h-[88px]"/>; return <div key={card.id} className="flex min-w-0 items-start gap-2 rounded-xl bg-white/90 px-2.5 py-2 shadow-[0_4px_14px_rgba(16,42,67,0.06)]"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"><Icon className="h-4 w-4"/></span><div className="min-w-0"><h3 className="truncate text-[14px] font-bold text-navy-deep">{card.title}</h3><p className="mt-0.5 overflow-hidden text-[13px] leading-4.5 text-muted-foreground [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2]">{card.copy}</p></div></div>; })}</div></div></div></section>;
}

function Featured({ items, ads = [] }: { items: PublicSiteConfig["featured"]; ads?: PublicSiteMarketingAd[] }) {
  const visible = items.filter((item) => item?.enabled);
  return <section id="featured" className="bg-muted/10 py-3 sm:py-4"><div className={CONTAINER}><SectionHeading eyebrow="FEATURED PROPERTIES" title="Discover premium properties across every sector." action={<div className="hidden items-center gap-1.5 sm:flex"><NavLink href="/discover/residential" className="ml-1 rounded-full border border-border bg-white px-3 py-1.5 text-[13px] font-semibold text-navy-deep">Browse Listings <ArrowRight className="ml-1 inline h-3 w-3" /></NavLink></div>} />{visible.length ? <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">{visible.map((item) => { const replacement = replacementAd(ads, item.id); if (replacement) return <AdCard key={item.id} ad={replacement} className="min-h-[220px]"/>; return <NavLink key={item.id} href={item.href} className="group overflow-hidden rounded-xl border border-border bg-card shadow-[0_6px_18px_rgba(16,42,67,0.06)] transition hover:-translate-y-0.5 hover:shadow-[0_12px_26px_rgba(16,42,67,0.12)]"><div className="relative h-[118px] overflow-hidden"><img src={img(item.image, PROPERTY_IMAGES.residential)} alt="" className="h-full w-full object-cover transition duration-500 group-hover:scale-105"/><span className="absolute right-2 top-2 max-w-[45%] truncate rounded-md bg-white/95 px-2 py-1 shadow-sm text-[11px] font-bold text-navy-deep">{item.price}</span></div><div className="min-h-[96px] p-3"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="truncate text-[11px] font-bold uppercase tracking-[0.12em] text-primary">{item.eyebrow}</p><h3 className="truncate mt-0.5 font-heading text-[17px] font-semibold text-navy-deep">{item.title}</h3></div><span className="shrink-0 rounded-full bg-success/10 px-2 py-1 text-xs font-bold text-success">Available</span></div><p className="truncate mt-1 text-sm text-muted-foreground">{item.location}</p><div className="mt-2 flex min-w-0 items-center justify-between gap-2 text-sm text-muted-foreground"><span className="min-w-0 truncate inline-flex items-center gap-1"><Home className="h-3 w-3 text-primary"/>{item.detail}</span><ArrowRight className="h-3.5 w-3.5 text-primary transition group-hover:translate-x-1"/></div></div></NavLink>; })}</div> : <div className="rounded-xl border border-dashed border-border bg-card p-5 text-center text-xs text-muted-foreground">Featured listings will appear here when published in Public Site Studio.</div>}</div></section>;
}

function RailSearch({ config }: { config: PublicSiteConfig["search"] }) {
  const navigate = useNavigate();
  const [mode, setMode] = useState(config.tabs.find((tab) => tab.enabled)?.id ?? "all");
  const [term, setTerm] = useState("");
  const categoryByMode: Record<string, string> = { buy: "residential", rent: "residential", offices: "offices", estates: "estates", institutions: "institutions", all: "residential" };
  const submit = (event: FormEvent) => { event.preventDefault(); navigate(`/discover/${categoryByMode[mode] ?? "residential"}?mode=${encodeURIComponent(mode)}&q=${encodeURIComponent(term.trim())}`); };
  const chips = config.chips.filter((chip) => chip.enabled);
  return <section id="quick-search" className="rounded-xl border border-border bg-white p-3 shadow-[0_6px_18px_rgba(16,42,67,0.07)]"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><h3 className="truncate font-heading text-base font-semibold text-navy-deep">{config.title}</h3><p className="truncate mt-0.5 text-[13px] text-muted-foreground">{config.copy}</p></div><Search className="h-4 w-4 text-primary"/></div><div className="mt-2 grid grid-cols-3 rounded-lg bg-muted p-0.5">{config.tabs.filter((tab) => tab.enabled).map((tab) => <button key={tab.id} type="button" onClick={() => setMode(tab.id)} className={`rounded-md px-2 py-1.5 text-[11px] font-bold capitalize ${mode === tab.id ? "bg-primary text-white" : "text-muted-foreground"}`}>{tab.label}</button>)}</div><form className="mt-2 flex gap-1.5" onSubmit={submit}><input value={term} onChange={(e) => setTerm(e.target.value)} placeholder={config.placeholder} className="min-w-0 flex-1 rounded-lg border border-input bg-background px-2.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20"/><button className="flex w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-white" aria-label="Search"><Search className="h-4 w-4"/></button></form><div className="mt-2 grid grid-cols-2 gap-1.5">{chips.map((chip) => { const Icon = PROPERTY_ICONS[chip.icon]; return <NavLink key={chip.id} href={chip.href} className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1.5 text-[13px] font-semibold text-muted-foreground hover:border-primary hover:text-primary"><Icon className="h-3 w-3 text-primary"/>{chip.label}</NavLink>; })}</div></section>;
}

function RailHighlights({ items }: { items: PublicSiteConfig["highlights"] }) {
  return <section className="rounded-xl border border-border bg-white p-3 shadow-[0_6px_18px_rgba(16,42,67,0.07)]"><div className="flex items-center justify-between"><h3 className="font-heading text-base font-semibold text-navy-deep">Platform Highlights</h3><Sparkles className="h-4 w-4 text-primary"/></div><div className="mt-2 grid grid-cols-2 gap-1.5">{items.filter((item) => item.enabled).map((item) => { const Icon = HIGHLIGHT_ICONS[item.icon] ?? Sparkles; return <div key={item.id} className="rounded-lg border border-border bg-background px-2.5 py-2 shadow-sm"><div className="flex items-center gap-1.5"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10"><Icon className="h-3.5 w-3.5 text-primary"/></span><div className="min-w-0"><p className="truncate font-heading text-[17px] font-semibold text-navy-deep">{item.value}</p><p className="line-clamp-2 text-xs leading-4 text-muted-foreground">{item.label}</p></div></div></div>; })}</div></section>;
}

function RailInsights({ items }: { items: PublicSiteConfig["insights"] }) {
  const published = items.filter((item) => item.enabled);
  if (!published.length) return null;
  return <section id="insights" className="rounded-xl border border-border bg-white p-3 shadow-[0_6px_18px_rgba(16,42,67,0.07)]"><div className="flex items-center justify-between"><h3 className="font-heading text-base font-semibold text-navy-deep">Latest Insights</h3></div><div className="mt-2 space-y-1.5">{items.filter((item) => item.enabled).map((item) => <NavLink key={item.id} href={item.href} className="group flex items-center gap-2 rounded-lg border border-transparent px-1 py-1 transition hover:border-border hover:bg-background"><img src={img(item.image, PROPERTY_IMAGES.residential)} alt="" className="h-11 w-14 rounded-md object-cover"/><div className="min-w-0"><p className="text-xs font-semibold text-primary">{item.category}</p><h4 className="mt-0.5 line-clamp-2 text-xs font-semibold leading-4.5 text-navy-deep">{item.title}</h4><p className="mt-0.5 text-[13px] text-muted-foreground">{item.meta}</p></div><ArrowRight className="ml-auto h-3 w-3 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5"/></NavLink>)}</div></section>;
}

function Trust({ config, ads = [] }: { config: PublicSiteConfig["trust"]; ads?: PublicSiteMarketingAd[] }) {
  const logos = config.logos.filter((logo) => logo.enabled);
  return <section id="trust" className="relative bg-background py-4 sm:py-5"><div className={CONTAINER}><div className="grid gap-3 lg:grid-cols-[1.75fr_1fr]">
    <div className="rounded-2xl border border-[#CFE0EF] bg-[linear-gradient(135deg,#F4F8FC_0%,#FFFFFF_48%,#F3FAF7_100%)] px-4 py-5 shadow-[0_8px_24px_rgba(16,42,67,0.07)] sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-heading text-xs font-bold tracking-[0.22em] text-primary">{config.eyebrow}</p><h2 className="mt-1 font-heading text-[clamp(1.45rem,2.3vw,1.9rem)] font-semibold tracking-[-0.035em] text-navy-deep">{config.title}</h2><p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground sm:text-[15px]">{config.copy}</p></div><span className="inline-flex items-center rounded-full border border-primary/15 bg-primary/8 px-3 py-1.5 text-[10px] font-bold tracking-[0.14em] text-primary">PARTNERSHIPS · ASSURANCE</span></div>
      <div className="mt-4 grid grid-cols-[repeat(auto-fit,minmax(120px,1fr))] gap-2">{logos.map((logo) => { const replacement = replacementAd(ads, logo.id); if (replacement) return <AdCard key={logo.id} ad={replacement} className="min-h-[64px]"/>; {logo.href && logo.href !== "#" ? <NavLink key={logo.id} href={logo.href} className="group flex min-h-[64px] min-w-0 items-center justify-center rounded-xl border border-[#D7E2EC] bg-white px-3 py-3 shadow-[0_4px_12px_rgba(16,42,67,0.045)] transition hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-[0_8px_18px_rgba(16,42,67,0.08)]">{logo.image ? <img src={logo.image} alt={logo.name} className="max-h-9 max-w-[92%] object-contain transition group-hover:scale-[1.02]"/> : <span className="truncate text-center font-heading text-sm font-bold tracking-tight text-navy-deep">{logo.name}</span>}</NavLink> : <div key={logo.id} className="flex min-h-[64px] min-w-0 items-center justify-center rounded-xl border border-[#D7E2EC] bg-white px-3 py-3 shadow-[0_4px_12px_rgba(16,42,67,0.045)]">{logo.image ? <img src={logo.image} alt={logo.name} className="max-h-9 max-w-[92%] object-contain"/> : <span className="truncate text-center font-heading text-sm font-bold tracking-tight text-navy-deep">{logo.name}</span>}</div>} })}</div>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-medium text-muted-foreground"><span>Organization marks</span><span>•</span><span>Partner placements</span><span>•</span><span>Public trust content</span></div>
    </div>
    <div className="rounded-2xl border border-[#D7E2EC] bg-white px-4 py-5 shadow-[0_8px_24px_rgba(16,42,67,0.07)] sm:px-6"><p className="text-2xl leading-none text-primary">❝</p><p className="mt-2 max-h-[88px] overflow-hidden text-[13px] leading-5 text-navy-deep sm:text-sm">{config.quote}</p><div className="mt-4 flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-sm font-bold text-primary">{config.avatar ? <img src={config.avatar} alt="" className="h-full w-full object-cover"/> : config.person.charAt(0)}</div><div className="min-w-0"><p className="truncate text-xs font-semibold text-navy-deep">{config.person}</p><p className="truncate text-[13px] text-muted-foreground">{config.role}</p></div></div></div>
  </div></div></section>;
}

function CTA({ config }: { config: PublicSiteConfig["cta"] }) {
  return <section id="cta" className="bg-background py-2 sm:py-3"><div className={CONTAINER}><div className="relative overflow-hidden rounded-2xl bg-[linear-gradient(135deg,#0B2B7A_0%,#123FB7_58%,#07185E_100%)] px-4 py-5 text-white shadow-[0_12px_34px_rgba(18,63,183,0.18)] sm:px-7"><div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_82%_18%,rgba(255,255,255,0.14),transparent_34%),radial-gradient(circle_at_15%_100%,rgba(118,217,194,0.12),transparent_30%)]"/><div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0 max-w-2xl"><p className="text-xs font-bold tracking-[0.22em] text-white/90">{config.eyebrow}</p><h2 className="mt-1 font-heading text-xl font-semibold leading-[1.12] tracking-[-0.02em] text-white sm:text-2xl">{config.title}</h2><p className="mt-1 max-w-xl text-[13px] leading-5.5 text-white/82 sm:text-sm">{config.copy}</p></div><div className="flex shrink-0 flex-wrap gap-2"><Button asChild className="h-9 rounded-lg bg-white px-4 text-xs font-bold text-[#0B2B7A] shadow-sm hover:bg-white/90"><Link to={config.primaryHref}>{config.primaryLabel}<ArrowRight className="ml-1 h-3.5 w-3.5"/></Link></Button><Button asChild variant="outline" className="h-9 rounded-lg border-white/35 bg-white/10 px-4 text-xs font-semibold text-white hover:bg-white/18 hover:text-white"><NavLink href={config.secondaryHref}>{config.secondaryLabel}</NavLink></Button></div></div></div></div></section>;
}

function MainContent({ config }: { config: PublicSiteConfig }) {
  const ordered = useMemo(() => [...config.sections].filter((section) => section.visible).sort((a, b) => a.order - b.order), [config.sections]);
  const renderMain = (id: PublicSiteSectionId) => { switch (id) { case "property-types": return <PropertyTypes key={id} items={config.propertyTypes} ads={config.marketingAds}/>; case "portals": return <Portals key={id} items={config.portals} ads={config.marketingAds}/>; case "why": return <WhyChoose key={id} config={config.why} ads={config.marketingAds}/>; case "featured": return <Featured key={id} items={config.featured} ads={config.marketingAds}/>; case "trust": return <Trust key={id} config={config.trust} ads={config.marketingAds}/>; case "cta": return <CTA key={id} config={config.cta}/>; default: return null; } };
  return <div className="min-w-0 divide-y divide-border/50">{ordered.filter((s) => s.id !== "hero").map((section) => { const ad = overlayAd(config.marketingAds, section.id); return <div key={section.id} className="relative min-w-0">{renderMain(section.id)}{ad ? <div className={`absolute z-30 hidden max-w-[300px] md:block ${adPositionClass(ad.position)} ${section.id === "trust" ? "lg:hidden" : ""}`}><AdCard ad={ad}/></div> : null}</div>; })}</div>;
}

function Rail({ config }: { config: PublicSiteConfig }) {
  const ordered = useMemo(() => [...config.rail.sections].filter((section) => section.visible).sort((a, b) => a.order - b.order), [config.rail.sections]);
  const render = (id: PublicSiteRailId) => { switch (id) { case "search": return <RailSearch key={id} config={config.search}/>; case "highlights": return <RailHighlights key={id} items={config.highlights}/>; case "insights": return <RailInsights key={id} items={config.insights}/>; } };
  if (!config.rail.visible) return null;
  return <aside className={`${config.rail.width === "narrow" ? "lg:w-[260px]" : "lg:w-[292px] xl:w-[310px]"} min-w-0 shrink-0 space-y-2.5`} aria-label="Public site sidebar">{ordered.map((section) => render(section.id))}</aside>;
}

function HomeView() {
  const { data = DEFAULT_PUBLIC_SITE_CONFIG } = usePublicSiteConfig();
  const config = data ?? DEFAULT_PUBLIC_SITE_CONFIG;
  const heroVisible = config.sections.find((section) => section.id === "hero")?.visible ?? true;
  return <div className="bg-transparent overflow-x-clip">{heroVisible ? <Hero config={config}/> : null}<div className={`${CONTAINER} flex min-w-0 flex-col gap-3 lg:grid lg:grid-cols-[minmax(0,1fr)_292px] lg:items-start xl:grid-cols-[minmax(0,1fr)_310px]`}><main className="min-w-0 overflow-hidden"><MainContent config={config}/></main><Rail config={config}/></div></div>;
}

function PricingView() { const { data: tiers = [] } = usePublicTiers(); return <section className={`${CONTAINER} py-10 sm:py-12`}><div className="mb-6 max-w-2xl"><p className="font-heading text-[13px] font-bold tracking-[0.18em] text-primary">PRICING</p><h1 className="mt-1 font-heading text-3xl font-semibold tracking-tight text-navy-deep sm:text-4xl">Simple pricing for property operations.</h1><p className="mt-1 text-sm leading-6 text-muted-foreground">Published rates in Kenyan shillings, with custom options for larger portfolios.</p></div><PublicPricing tiers={tiers}/></section>; }

export function PublicLandingPage() { const { pathname } = useLocation(); const isPricing = pathname === PUBLIC_ROUTES.pricing; return <PublicShell>{isPricing ? <PricingView/> : <HomeView/>}</PublicShell>; }
export default PublicLandingPage;
