import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Building2, CheckCircle2, ChevronLeft, ChevronRight, CreditCard, Home, Landmark, LayoutDashboard, Play, TrendingUp, Users, Wrench } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/shared/components/ui/button";
import { PublicPricing } from "@/features/marketing/components/PublicPricing";
import { PublicShell } from "@/features/marketing/components/PublicShell";
import { usePublicTiers } from "@/features/marketing/hooks/usePublicTiers";
import { usePublicSiteConfig } from "@/features/marketing/hooks/usePublicSiteConfig";
import { PUBLIC_ROUTES } from "@/features/marketing/publicConfig";
import { PROPERTY_IMAGES } from "@/features/marketing/propertyImages";
import { DEFAULT_PUBLIC_SITE_CONFIG, type PublicSiteConfig, type PublicSiteSectionId } from "@/features/marketing/publicSiteConfig";

const CONTAINER = "mx-auto max-w-7xl px-4 sm:px-6 lg:px-8";
const ICONS = { home: Home, building: Building2, office: Building2, landmark: Landmark } as const;

function imageOrFallback(url: string | null, fallback: string) { return url || fallback; }

function Hero({ config }: { config: PublicSiteConfig }) {
  const slides = Array.isArray(config.hero.slides) ? config.hero.slides.filter((slide) => slide.enabled) : [];
  const [active, setActive] = useState(0);
  useEffect(() => {
    if (!config.hero.autoplay || slides.length < 2) return;
    const timer = window.setInterval(() => setActive((value) => (value + 1) % slides.length), config.hero.intervalMs);
    return () => window.clearInterval(timer);
  }, [config.hero.autoplay, config.hero.intervalMs, slides.length]);
  const slide = slides[Math.min(active, Math.max(slides.length - 1, 0))] || config.hero.slides?.[0];
  if (!slide) return null;
  const overlay = config.hero.overlay === "strong" ? "bg-navy-deep/70" : config.hero.overlay === "medium" ? "bg-navy-deep/52" : "bg-navy-deep/35";
  const next = () => setActive((value) => (value + 1) % Math.max(slides.length, 1));
  const previous = () => setActive((value) => (value - 1 + Math.max(slides.length, 1)) % Math.max(slides.length, 1));
  const href = slide.secondaryHref.startsWith("#") ? slide.secondaryHref : slide.secondaryHref;
  return (
    <section className={`relative overflow-hidden ${config.hero.fitMode === "screen" ? "min-h-[calc(100svh-72px)]" : "min-h-[610px] lg:min-h-[680px]"}`}>
      <div className="absolute inset-0">
        <picture>
          <source media="(max-width: 640px)" srcSet={imageOrFallback(slide.mobileImage, PROPERTY_IMAGES.residential)} />
          <img src={imageOrFallback(slide.image, PROPERTY_IMAGES.residential)} alt="CALQULUS property" className="h-full w-full object-cover" fetchPriority="high" />
        </picture>
        <div className={`absolute inset-0 ${overlay}`} />
        <div className="absolute inset-0 bg-gradient-to-r from-navy-deep/90 via-navy-deep/45 to-transparent" />
      </div>
      <div className={`relative flex h-full items-center ${config.hero.fitMode === "screen" ? "min-h-[calc(100svh-72px)]" : "min-h-[610px] lg:min-h-[680px]"}`}>
        <div className={`${CONTAINER} w-full py-16 sm:py-20 lg:py-24`}>
          <div className="max-w-3xl text-white">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[10px] font-semibold tracking-[0.2em] backdrop-blur-sm sm:text-[11px]">
              <span className="h-1.5 w-1.5 rounded-full bg-success" /> {slide.eyebrow}
            </div>
            <h1 className="mt-6 max-w-3xl font-heading text-[clamp(2.7rem,6.5vw,5.8rem)] font-semibold leading-[.94] tracking-[-.055em]">{slide.title}</h1>
            <p className="mt-6 max-w-2xl text-base leading-7 text-white/78 sm:text-lg sm:leading-8">{slide.copy}</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="btn-brand min-h-12 px-6 text-[15px]"><Link to={slide.primaryHref}>{slide.primaryLabel}<ArrowRight className="h-4 w-4" /></Link></Button>
              {href.startsWith("#") ? <Button asChild size="lg" variant="outline" className="min-h-12 border-white/25 bg-white/8 px-6 text-white hover:bg-white/15 hover:text-white"><a href={href}>{slide.secondaryLabel}</a></Button> : <Button asChild size="lg" variant="outline" className="min-h-12 border-white/25 bg-white/8 px-6 text-white hover:bg-white/15 hover:text-white"><Link to={href}>{slide.secondaryLabel}</Link></Button>}
            </div>
            <div className="mt-10 flex flex-wrap gap-5 text-xs font-medium text-white/65">
              {["Managers", "Landlords", "Agencies", "Tenants"].map((item) => <span key={item} className="inline-flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-success" />{item}</span>)}
            </div>
          </div>
        </div>
      </div>
      {slides.length > 1 ? <div className="absolute bottom-6 right-4 flex items-center gap-2 sm:right-8"><button aria-label="Previous hero" onClick={previous} className="flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-navy-deep/30 text-white backdrop-blur-sm hover:bg-white/15"><ChevronLeft className="h-4 w-4" /></button><span className="px-2 text-xs font-medium text-white/70">{active + 1} / {slides.length}</span><button aria-label="Next hero" onClick={next} className="flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-navy-deep/30 text-white backdrop-blur-sm hover:bg-white/15"><ChevronRight className="h-4 w-4" /></button></div> : null}
    </section>
  );
}

function PropertyTypes({ items }: { items: PublicSiteConfig["propertyTypes"] }) {
  const visible = items.filter((item) => item.enabled);
  return <section id="property-types" className="scroll-mt-20 border-b border-border bg-background py-16 sm:py-20"><div className={CONTAINER}><div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between"><div><p className="text-[11px] font-semibold tracking-[.2em] text-primary">EXPLORE PROPERTY</p><h2 className="mt-2 max-w-2xl font-heading text-3xl font-semibold tracking-[-.03em] sm:text-4xl">Find the property that fits your next move.</h2></div><p className="max-w-md text-sm leading-6 text-muted-foreground md:text-right">Residentials, estates, offices and institutions — presented through one connected property experience.</p></div><div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{visible.map((item) => { const Icon = ICONS[item.icon]; return <Link key={item.id} to={item.href} className="group relative min-h-[310px] overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl"><img src={imageOrFallback(item.image, PROPERTY_IMAGES.residential)} alt="" className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105"/><div className="absolute inset-0 bg-gradient-to-t from-navy-deep via-navy-deep/30 to-transparent"/><div className="relative flex h-full min-h-[310px] flex-col justify-end p-5 text-white"><span className="mb-auto flex h-10 w-10 items-center justify-center rounded-xl border border-white/20 bg-white/10 backdrop-blur-sm"><Icon className="h-5 w-5" /></span><div><p className="text-[10px] font-semibold tracking-[.18em] text-success">PROPERTY</p><h3 className="mt-1 font-heading text-xl font-semibold">{item.title}</h3><p className="mt-1 text-sm leading-5 text-white/70">{item.description}</p><span className="mt-4 inline-flex items-center gap-2 text-sm font-semibold">View properties <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" /></span></div></div></Link>; })}</div></div></section>;
}

function Featured({ items }: { items: PublicSiteConfig["featured"] }) {
  const visible = items.filter((item) => item.enabled);
  if (!visible.length) return <section id="featured" className="border-b border-border bg-card py-16 sm:py-20"><div className={CONTAINER}><div className="rounded-2xl border border-dashed border-border bg-background p-8 text-center sm:p-12"><p className="text-[11px] font-semibold tracking-[.2em] text-primary">FEATURED PROPERTIES</p><h2 className="mt-2 font-heading text-2xl font-semibold">Your featured listings will appear here.</h2><p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-muted-foreground">Platform administrators can publish and reorder featured adverts without changing the homepage code.</p></div></div></section>;
  return <section id="featured" className="border-b border-border bg-card py-16 sm:py-20"><div className={CONTAINER}><div className="flex items-end justify-between gap-4"><div><p className="text-[11px] font-semibold tracking-[.2em] text-primary">FEATURED</p><h2 className="mt-2 font-heading text-3xl font-semibold tracking-tight sm:text-4xl">Properties worth a closer look.</h2></div><span className="hidden items-center gap-2 text-xs font-medium text-muted-foreground sm:inline-flex"><Play className="h-3.5 w-3.5 text-primary" /> Curated by Admin</span></div><div className="mt-10 grid gap-5 lg:grid-cols-3">{visible.map((item) => <Link key={item.id} to={item.href} className="group overflow-hidden rounded-2xl border border-border bg-background shadow-sm hover:shadow-lg"><div className="relative aspect-[16/10] overflow-hidden"><img src={imageOrFallback(item.image, PROPERTY_IMAGES.residential)} alt="" className="h-full w-full object-cover transition duration-500 group-hover:scale-105"/><span className="absolute left-4 top-4 rounded-full bg-navy-deep/85 px-2.5 py-1 text-[10px] font-semibold tracking-[.15em] text-white">{item.eyebrow}</span></div><div className="p-5"><p className="text-xs font-medium text-primary">{item.location}</p><h3 className="mt-1 font-heading text-lg font-semibold">{item.title}</h3><p className="mt-2 text-sm text-muted-foreground">{item.detail}</p><div className="mt-4 flex items-center justify-between border-t border-border pt-4"><span className="text-sm font-semibold text-foreground">{item.price}</span><ArrowRight className="h-4 w-4 text-primary transition group-hover:translate-x-1"/></div></div></Link>)}</div></div></section>;
}

function Portals({ items }: { items: PublicSiteConfig["portals"] }) {
  const iconMap = { manager: LayoutDashboard, landlord: TrendingUp, agency: Users, tenant: Home } as const;
  const visible = items.filter((item) => item.enabled);
  return <section id="portals" className="scroll-mt-20 border-b border-border bg-background py-16 sm:py-20"><div className={CONTAINER}><div className="mx-auto max-w-2xl text-center"><p className="text-[11px] font-semibold tracking-[.2em] text-primary">ONE PLATFORM. EVERY ROLE.</p><h2 className="mt-2 font-heading text-3xl font-semibold tracking-[-.03em] sm:text-4xl">The right portal for the way you work.</h2><p className="mt-3 text-sm leading-6 text-muted-foreground sm:text-base">Four focused experiences. One connected property system.</p></div><div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{visible.map((item) => { const Icon = iconMap[item.id]; return <Link key={item.id} to={item.href} className="group relative min-h-[360px] overflow-hidden rounded-2xl bg-navy-deep text-white shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl"><img src={imageOrFallback(item.image, PROPERTY_IMAGES.office)} alt="" className="absolute inset-0 h-full w-full object-cover opacity-60 transition duration-500 group-hover:scale-105 group-hover:opacity-70"/><div className="absolute inset-0 bg-gradient-to-t from-navy-deep via-navy-deep/65 to-navy-deep/10"/><div className="relative flex min-h-[360px] flex-col p-5"><div className="flex items-center justify-between"><span className="rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-[9px] font-semibold tracking-[.18em] text-white/75">{item.eyebrow}</span><span className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/10"><Icon className="h-4 w-4"/></span></div><div className="mt-auto"><h3 className="font-heading text-2xl font-semibold">{item.title}</h3><p className="mt-2 text-sm leading-6 text-white/70">{item.description}</p><span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-success">Enter portal <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1"/></span></div></div></Link>; })}</div></div></section>;
}

function Promotions({ items }: { items: PublicSiteConfig["promotions"] }) { const visible = items.filter((item) => item.enabled); if (!visible.length) return null; return <section id="promotions" className="border-b border-border bg-card py-10 sm:py-12"><div className={CONTAINER}><div className="grid gap-4 lg:grid-cols-2">{visible.map((item) => <Link key={item.id} to={item.href} className="group relative min-h-[190px] overflow-hidden rounded-2xl bg-navy-deep text-white"><img src={imageOrFallback(item.image, PROPERTY_IMAGES.commercial)} alt="" className="absolute inset-0 h-full w-full object-cover opacity-45 transition duration-500 group-hover:scale-105"/><div className="absolute inset-0 bg-gradient-to-r from-navy-deep/95 via-navy-deep/70 to-transparent"/><div className="relative max-w-xl p-6 sm:p-8"><p className="text-[10px] font-semibold tracking-[.2em] text-success">{item.label}</p><h3 className="mt-2 font-heading text-xl font-semibold sm:text-2xl">{item.title}</h3><p className="mt-2 text-sm leading-6 text-white/70">{item.copy}</p><span className="mt-4 inline-flex items-center gap-2 text-sm font-semibold">Explore <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1"/></span></div></Link>)}</div></div></section>; }

function PlatformValue({ config }: { config: PublicSiteConfig["platformValue"] }) {
  const icons = { property: Building2, money: CreditCard, operations: Wrench } as const;
  return <section id="platform" className="scroll-mt-20 bg-background py-16 sm:py-20"><div className={CONTAINER}><div className="rounded-3xl border border-border bg-card p-6 shadow-sm sm:p-10"><div className="grid gap-10 lg:grid-cols-[.8fr_1.2fr] lg:items-center"><div><p className="text-[11px] font-semibold tracking-[.2em] text-primary">{config.eyebrow}</p><h2 className="mt-3 font-heading text-3xl font-semibold tracking-[-.03em] sm:text-4xl">{config.title}</h2><p className="mt-4 text-sm leading-6 text-muted-foreground sm:text-base">{config.copy}</p></div><div className="grid gap-4 sm:grid-cols-3">{config.cards.map((item) => { const Icon = icons[item.icon]; return <div key={item.id} className="rounded-2xl border border-border bg-background p-4"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon className="h-5 w-5"/></span><h3 className="mt-4 font-heading text-sm font-semibold">{item.title}</h3><p className="mt-2 text-xs leading-5 text-muted-foreground">{item.copy}</p></div>; })}</div></div></div></div></section>;
}
function CTA({ config }: { config: PublicSiteConfig["cta"] }) { return <section id="cta" className="border-t border-white/10 bg-navy-deep py-12 text-white sm:py-14"><div className={CONTAINER}><div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between"><div className="max-w-2xl"><p className="text-[11px] font-semibold tracking-[.2em] text-success">{config.eyebrow}</p><h2 className="mt-2 font-heading text-3xl font-semibold tracking-tight sm:text-4xl">{config.title}</h2><p className="mt-2 text-sm leading-6 text-white/65 sm:text-base">{config.copy}</p></div><div className="flex flex-col gap-2 sm:flex-row"><Button asChild size="lg" className="btn-brand min-h-12"><Link to={config.primaryHref}>{config.primaryLabel}<ArrowRight className="h-4 w-4"/></Link></Button><Button asChild size="lg" variant="outline" className="min-h-12 border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white"><Link to={config.secondaryHref}>{config.secondaryLabel}</Link></Button></div></div></div></section>; }

function HomeView() {
  const { data } = usePublicSiteConfig();
  const config = data ?? DEFAULT_PUBLIC_SITE_CONFIG;
  const ordered = useMemo(() => [...config.sections].filter((section) => section.visible).sort((a,b) => a.order-b.order), [config.sections]);
  const render = (id: PublicSiteSectionId) => { switch (id) { case "hero": return <Hero key={id} config={config}/>; case "property-types": return <PropertyTypes key={id} items={config.propertyTypes}/>; case "featured": return <Featured key={id} items={config.featured}/>; case "portals": return <Portals key={id} items={config.portals}/>; case "promotions": return <Promotions key={id} items={config.promotions}/>; case "platform": return <PlatformValue key={id} config={config.platformValue}/>; case "cta": return <CTA key={id} config={config.cta}/>; default: return null; } };
  return <>{ordered.map((section) => render(section.id))}</>;
}

function PricingView() { const { data: tiers = [] } = usePublicTiers(); return <section className={`${CONTAINER} py-12 sm:py-16`}><div className="mb-8 max-w-2xl"><p className="text-[11px] font-semibold tracking-[.2em] text-primary">PRICING</p><h1 className="mt-2 font-heading text-3xl font-semibold tracking-tight sm:text-4xl">Simple pricing for property operations.</h1><p className="mt-2 text-sm leading-6 text-muted-foreground sm:text-base">Published rates in Kenyan shillings, with custom options for larger portfolios.</p></div><PublicPricing tiers={tiers}/></section>; }

export function PublicLandingPage() { const { pathname } = useLocation(); const isPricing = pathname === PUBLIC_ROUTES.pricing; return <PublicShell>{isPricing ? <PricingView/> : <HomeView/>}</PublicShell>; }
export default PublicLandingPage;
