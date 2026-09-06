import { PROPERTY_IMAGES } from "@/features/marketing/propertyImages";
import { PUBLIC_ROUTES } from "@/features/marketing/publicConfig";

export type PublicSiteSectionId = "hero" | "property-types" | "portals" | "why" | "featured" | "trust" | "cta";
export type PublicSiteRailId = "search" | "highlights" | "insights";
export type HeroFitMode = "screen" | "window";

export interface PublicSiteHeroSlide {
  id: string;
  eyebrow: string;
  title: string;
  copy: string;
  signature: string[];
  primaryLabel: string;
  primaryHref: string;
  secondaryLabel: string;
  secondaryHref: string;
  image: string | null;
  mobileImage: string | null;
  enabled: boolean;
}

export interface PublicSiteHeroPromo {
  id: string;
  label: string;
  title: string;
  copy: string;
  image: string | null;
  href: string;
  enabled: boolean;
}

export interface PublicSiteHeroPill {
  id: string;
  label: string;
  icon: "portals" | "secure" | "insights" | "reliable";
  enabled: boolean;
}

export interface PublicSitePropertyType {
  id: string;
  title: string;
  description: string;
  image: string | null;
  icon: "home" | "building" | "office" | "landmark";
  href: string;
  enabled: boolean;
}

export interface PublicSitePortal {
  id: "manager" | "landlord" | "agency" | "tenant";
  eyebrow: string;
  title: string;
  description: string;
  image: string | null;
  href: string;
  enabled: boolean;
}

export interface PublicSiteWhyCard {
  id: string;
  title: string;
  copy: string;
  icon: "stack" | "gear" | "chart" | "leaf";
  enabled: boolean;
}

export interface PublicSiteFeaturedCard {
  id: string;
  eyebrow: string;
  title: string;
  location: string;
  detail: string;
  price: string;
  image: string | null;
  href: string;
  enabled: boolean;
}

export interface PublicSiteInsight {
  id: string;
  category: string;
  title: string;
  meta: string;
  image: string | null;
  href: string;
  enabled: boolean;
}

export interface PublicSiteHighlight {
  id: string;
  value: string;
  label: string;
  icon: "property" | "users" | "uptime" | "support";
  enabled: boolean;
}

export interface PublicSiteTrustLogo {
  id: string;
  name: string;
  image: string | null;
  href: string;
  enabled: boolean;
}

export interface PublicSiteTrust {
  eyebrow: string;
  title: string;
  copy: string;
  logos: PublicSiteTrustLogo[];
  quote: string;
  person: string;
  role: string;
  avatar: string | null;
}


export type PublicSiteAdPlacement = "hero" | "property-types" | "portals" | "why" | "featured" | "trust" | "cta";
export type PublicSiteAdMode = "overlay" | "replace";
export type PublicSiteAdPosition = "top-left" | "top-right" | "bottom-left" | "bottom-right";
export type PublicSiteAdSize = "compact" | "standard" | "wide";

export interface PublicSiteMarketingAd {
  id: string;
  label: string;
  title: string;
  copy: string;
  image: string | null;
  href: string;
  enabled: boolean;
  placement: PublicSiteAdPlacement;
  mode: PublicSiteAdMode;
  targetId: string | null;
  position: PublicSiteAdPosition;
  size: PublicSiteAdSize;
}

export interface PublicSiteBrand {
  name: string;
  descriptor: string;
  logoUrl: string | null;
}

export interface PublicSiteConfig {
  version: 1;
  brand: PublicSiteBrand;
  shell: {
    header: {
      nav: Array<{ id: string; label: string; href: string; enabled: boolean }>;
      searchLabel: string;
      signInLabel: string;
      getStartedLabel: string;
      utilityWords: string[];
    };
    footer: {
      tagline: string;
      copyright: string;
      endTagline: string;
      columns: Array<{ id: string; title: string; items: Array<{ id: string; label: string; href: string }> }>;
      socials: Array<{ id: string; label: string; href: string; enabled: boolean }>;
      newsletterTitle: string;
      newsletterPlaceholder: string;
      showNewsletter: boolean;
    };
  };
  hero: {
    fitMode: HeroFitMode;
    autoplay: boolean;
    intervalMs: number;
    transitionMs: number;
    overlay: "soft" | "medium" | "strong";
    slides: PublicSiteHeroSlide[];
    floatingCards: PublicSiteHeroPromo[];
    pills: PublicSiteHeroPill[];
  };
  propertyTypes: PublicSitePropertyType[];
  portals: PublicSitePortal[];
  why: {
    eyebrow: string;
    title: string;
    copy: string;
    cards: PublicSiteWhyCard[];
  };
  featured: PublicSiteFeaturedCard[];
  highlights: PublicSiteHighlight[];
  insights: PublicSiteInsight[];
  trust: PublicSiteTrust;
  marketingAds: PublicSiteMarketingAd[];
  search: {
    title: string;
    copy: string;
    tabs: Array<{ id: string; label: string; enabled: boolean }>;
    placeholder: string;
    chips: Array<{ id: string; label: string; href: string; icon: "home" | "building" | "office" | "landmark"; enabled: boolean }>;
  };
  cta: {
    eyebrow: string;
    title: string;
    copy: string;
    primaryLabel: string;
    primaryHref: string;
    secondaryLabel: string;
    secondaryHref: string;
  };
  sections: Array<{ id: PublicSiteSectionId; visible: boolean; order: number; variant: "default" | "compact" | "wide" }>;
  rail: {
    visible: boolean;
    width: "narrow" | "standard";
    sections: Array<{ id: PublicSiteRailId; visible: boolean; order: number }>;
  };
}

export const DEFAULT_PUBLIC_SITE_CONFIG: PublicSiteConfig = {
  version: 1,
  brand: { name: "CALQULUS", descriptor: "PROPERTY MANAGEMENT SYSTEMS", logoUrl: null },
  shell: {
    header: {
      nav: [
        { id: "home", label: "Home", href: "/", enabled: true },
        { id: "properties", label: "Properties", href: "#property-types", enabled: true },
        { id: "portals", label: "Portals", href: "#portals", enabled: true },
        { id: "insights", label: "Insights", href: "#insights", enabled: false },
        { id: "pricing", label: "Pricing", href: PUBLIC_ROUTES.pricing, enabled: true },
      ],
      searchLabel: "Search",
      signInLabel: "Login",
      getStartedLabel: "Get Started",
      utilityWords: ["MANAGE", "GROW", "THRIVE"],
    },
    footer: {
      tagline: "The complete property management solution for modern real estate professionals.",
      copyright: "© {year} CALQULUS PMS. All rights reserved.",
      endTagline: "Manage · Grow · Thrive",
      columns: [
        { id: "solutions", title: "Solutions", items: [{ id: "s1", label: "Property Management", href: "#why" }, { id: "s2", label: "Tenant Management", href: "#portals" }, { id: "s3", label: "Lease Management", href: "#why" }, { id: "s4", label: "Financial Management", href: "#why" }, { id: "s5", label: "Maintenance Management", href: "#why" }] },
        { id: "properties", title: "Properties", items: [{ id: "p1", label: "Residentials", href: "/discover/residential" }, { id: "p2", label: "Estates", href: "/discover/estates" }, { id: "p3", label: "Offices", href: "/discover/offices" }, { id: "p4", label: "Institutions", href: "/discover/institutions" }] },
        { id: "resources", title: "Resources", items: [{ id: "r1", label: "Insights", href: "#insights" }, { id: "r2", label: "Portals", href: "#portals" }, { id: "r3", label: "Pricing", href: PUBLIC_ROUTES.pricing }, { id: "r4", label: "Property Search", href: "/discover/residential" }] },
        { id: "company", title: "Company", items: [{ id: "c1", label: "About Us", href: "#trust" }, { id: "c2", label: "Contact", href: "mailto:enterprise@calqulusrms.com" }, { id: "c3", label: "Privacy Policy", href: PUBLIC_ROUTES.legalPrivacy }, { id: "c4", label: "Terms of Service", href: PUBLIC_ROUTES.legalTerms }] },
      ],
      socials: [
        { id: "linkedin", label: "in", href: "#", enabled: false },
        { id: "x", label: "X", href: "#", enabled: false },
        { id: "facebook", label: "f", href: "#", enabled: false },
        { id: "instagram", label: "◎", href: "#", enabled: false },
        { id: "youtube", label: "▶", href: "#", enabled: false },
      ],
      newsletterTitle: "Request CALQULUS updates",
      newsletterPlaceholder: "Your email address",
      showNewsletter: true,
    },
  },
  hero: {
    fitMode: "window",
    autoplay: true,
    intervalMs: 30000,
    transitionMs: 900,
    overlay: "soft",
    slides: [
      {
        id: "hero-1",
        eyebrow: "REAL ESTATE. SIMPLIFIED.",
        title: "One Platform. Every Property. A Better Tomorrow.",
        copy: "Manage, automate and grow your real estate portfolio with CALQULUS PMS. Built for every type of property.",
        signature: ["People", "Properties", "Progress"],
        primaryLabel: "Get Started",
        primaryHref: PUBLIC_ROUTES.portalAccessSignUp,
        secondaryLabel: "Explore Portals",
        secondaryHref: "#portals",
        image: PROPERTY_IMAGES.residential,
        mobileImage: PROPERTY_IMAGES.residential,
        enabled: true,
      },
      {
        id: "hero-2",
        eyebrow: "ONE CONNECTED PROPERTY EXPERIENCE",
        title: "From Portfolio To People, One System.",
        copy: "Give managers, landlords, agencies and tenants a clear place to work, communicate and stay on top of the property lifecycle.",
        signature: ["Manage", "Grow", "Thrive"],
        primaryLabel: "Explore Portals",
        primaryHref: "#portals",
        secondaryLabel: "View Properties",
        secondaryHref: "#property-types",
        image: PROPERTY_IMAGES.commercial,
        mobileImage: PROPERTY_IMAGES.commercial,
        enabled: true,
      },
    ],
    floatingCards: [
      { id: "hero-promo-1", label: "NEW", title: "Smart Portfolio Insights", copy: "Make better property decisions with CALQULUS.", image: PROPERTY_IMAGES.commercial, href: "#why", enabled: true },
      { id: "hero-promo-2", label: "LIST YOUR PROPERTY", title: "Showcase your available spaces", copy: "Put your property in front of the right audience.", image: PROPERTY_IMAGES.residential, href: "/discover/residential", enabled: true },
      { id: "hero-promo-3", label: "FOR PROPERTY PROFESSIONALS", title: "Modern real estate management", copy: "A complete connected workspace for property teams.", image: PROPERTY_IMAGES.office, href: PUBLIC_ROUTES.managerSignUp, enabled: true },
    ],
    pills: [
      { id: "portals", label: "4 Powerful Portals", icon: "portals", enabled: true },
      { id: "secure", label: "100% Secure", icon: "secure", enabled: true },
      { id: "insights", label: "Real-time Insights", icon: "insights", enabled: true },
      { id: "reliable", label: "Scalable & Reliable", icon: "reliable", enabled: true },
    ],
  },
  propertyTypes: [
    { id: "residential", title: "Residentials", description: "Houses, Apartments, Condos", image: PROPERTY_IMAGES.residential, icon: "home", href: "/discover/residential", enabled: true },
    { id: "estates", title: "Estates", description: "Gated Communities, Developments", image: PROPERTY_IMAGES.commercial, icon: "building", href: "/discover/estates", enabled: true },
    { id: "offices", title: "Offices", description: "Office Buildings, Workspaces", image: PROPERTY_IMAGES.office, icon: "office", href: "/discover/offices", enabled: true },
    { id: "institutions", title: "Institutions", description: "Schools, Hospitals, Organizations", image: PROPERTY_IMAGES.residential, icon: "landmark", href: "/discover/institutions", enabled: true },
  ],
  portals: [
    { id: "agency", eyebrow: "AGENCY", title: "Agency Portal", description: "Grow your agency, manage clients and scale property portfolios with confidence.", image: PROPERTY_IMAGES.commercial, href: PUBLIC_ROUTES.agencyLogin, enabled: true },
    { id: "manager", eyebrow: "PROPERTY MANAGER", title: "Property Manager Portal", description: "Run property operations with clarity, control and confidence.", image: PROPERTY_IMAGES.office, href: PUBLIC_ROUTES.managerSignIn, enabled: true },
    { id: "landlord", eyebrow: "LANDLORD", title: "Landlord Portal", description: "Protect your property, understand performance and grow your return.", image: PROPERTY_IMAGES.residential, href: PUBLIC_ROUTES.landlordLogin, enabled: true },
    { id: "tenant", eyebrow: "TENANT", title: "Tenant Portal", description: "Enjoy a simpler rental experience with payments, requests and updates in one place.", image: PROPERTY_IMAGES.residential, href: PUBLIC_ROUTES.tenantLogin, enabled: true },
  ],
  why: {
    eyebrow: "WHY CHOOSE CALQULUS?",
    title: "More than software. A smarter way to manage property.",
    copy: "",
    cards: [
      { id: "w1", title: "Manage Everything", copy: "Properties, tenants, leases, finances and maintenance — all in one place.", icon: "stack", enabled: true },
      { id: "w2", title: "Automate Operations", copy: "Reduce manual work and increase efficiency.", icon: "gear", enabled: true },
      { id: "w3", title: "Real-time Insights", copy: "Better information for better decisions.", icon: "chart", enabled: true },
      { id: "w4", title: "Grow with Confidence", copy: "Built to scale from one property to thousands.", icon: "leaf", enabled: true },
    ],
  },
  featured: [
    { id: "f1", eyebrow: "RESIDENTIAL", title: "Sunset Apartments", location: "Westlands, Nairobi", detail: "2 – 3 Bedrooms · Modern Amenities", price: "KES 45,000/mo", image: PROPERTY_IMAGES.residential, href: "/discover/residential", enabled: true },
    { id: "f2", eyebrow: "ESTATE", title: "Greenfield Estate", location: "Ruiru, Kiambu", detail: "Gated Community · 24/7 Security", price: "KES 35,000/mo", image: PROPERTY_IMAGES.commercial, href: "/discover/estates", enabled: true },
    { id: "f3", eyebrow: "OFFICE", title: "Executive Towers", location: "Upper Hill, Nairobi", detail: "Premium Offices · Excellent Location", price: "KES 120,000/mo", image: PROPERTY_IMAGES.office, href: "/discover/offices", enabled: true },
    { id: "f4", eyebrow: "RESIDENTIAL", title: "Parkview Villas", location: "Karen, Nairobi", detail: "4 Bedrooms · Private Garden", price: "KES 250,000/mo", image: PROPERTY_IMAGES.residential, href: "/discover/residential", enabled: true },
  ],
  highlights: [
    { id: "h1", value: "Role-based", label: "Workspaces for every stakeholder", icon: "users", enabled: true },
    { id: "h2", value: "Connected", label: "Property records linked across workflows", icon: "property", enabled: true },
    { id: "h3", value: "Auditable", label: "Activity visible across core operations", icon: "support", enabled: true },
    { id: "h4", value: "Configurable", label: "Public experience managed from one studio", icon: "uptime", enabled: true },
  ],
  insights: [
    { id: "i1", category: "Insights", title: "Publish your first CALQULUS guide", meta: "Admin-managed", image: PROPERTY_IMAGES.residential, href: "#insights", enabled: false },
    { id: "i2", category: "Insights", title: "Share a property operations story", meta: "Admin-managed", image: PROPERTY_IMAGES.office, href: "#insights", enabled: false },
    { id: "i3", category: "Insights", title: "Add a market or product update", meta: "Admin-managed", image: PROPERTY_IMAGES.commercial, href: "#insights", enabled: false },
  ],
  trust: {
    eyebrow: "TRUST & PARTNERSHIPS",
    title: "Built for serious property operations",
    copy: "Publish verified organizations, approved partner marks and real customer stories here from Public Site Studio.",
    logos: [],
    quote: "Verified customer stories and partner relationships can be published here as they are approved.",
    person: "Public Site Studio",
    role: "Managed trust content",
    avatar: null,
  },
    marketingAds: [
    { id: "ad-demo-1", label: "FEATURED", title: "Your campaign could appear here", copy: "A flexible promotional slot for approved public-site marketing.", image: PROPERTY_IMAGES.commercial, href: "#", enabled: false, placement: "hero", mode: "overlay", targetId: null, position: "top-right", size: "compact" },
  ],
  search: {
    title: "Quick Search",
    copy: "Find a property or space for your next move.",
    tabs: [{ id: "buy", label: "Buy", enabled: true }, { id: "rent", label: "Rent", enabled: true }, { id: "all", label: "All", enabled: true }],
    placeholder: "Search location, property type...",
    chips: [
      { id: "c1", label: "Residential", href: "/discover/residential", icon: "home", enabled: true },
      { id: "c2", label: "Office", href: "/discover/offices", icon: "office", enabled: true },
      { id: "c3", label: "Estate", href: "/discover/estates", icon: "building", enabled: true },
      { id: "c4", label: "Institution", href: "/discover/institutions", icon: "landmark", enabled: true },
    ],
  },
  cta: {
    eyebrow: "READY TO TRANSFORM YOUR REAL ESTATE MANAGEMENT?",
    title: "Join thousands of property professionals already growing with CALQULUS.",
    copy: "Bring property operations, people and performance into one connected experience.",
    primaryLabel: "Get Started",
    primaryHref: PUBLIC_ROUTES.portalAccessSignUp,
    secondaryLabel: "Contact Sales",
    secondaryHref: "mailto:enterprise@calqulusrms.com",
  },
  sections: [
    { id: "hero", visible: true, order: 10, variant: "default" },
    { id: "property-types", visible: true, order: 20, variant: "default" },
    { id: "portals", visible: true, order: 30, variant: "default" },
    { id: "why", visible: true, order: 40, variant: "compact" },
    { id: "featured", visible: true, order: 50, variant: "default" },
    { id: "trust", visible: true, order: 60, variant: "default" },
    { id: "cta", visible: true, order: 70, variant: "compact" },
  ],
  rail: {
    visible: true,
    width: "standard",
    sections: [
      { id: "search", visible: true, order: 10 },
      { id: "highlights", visible: true, order: 20 },
      { id: "insights", visible: true, order: 30 },
    ],
  },
};

function isRecord(value: unknown): value is Record<string, unknown> { return Boolean(value && typeof value === "object" && !Array.isArray(value)); }
function asArray<T>(value: unknown): T[] { return Array.isArray(value) ? value.filter(Boolean) as T[] : []; }
function validIcon(value: unknown, allowed: readonly string[], fallback: string): string { return typeof value === "string" && allowed.includes(value) ? value : fallback; }
function safeBool(value: unknown, fallback: boolean): boolean { return typeof value === "boolean" ? value : fallback; }
function safeText(value: unknown, fallback: string): string { return typeof value === "string" ? value : fallback; }
function safeUrl(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const url = value.trim();
  if (!url || /^(?:javascript|data|vbscript):/i.test(url)) return fallback;
  if (/^(?:https?:\/\/|mailto:|tel:|#|\/|\?)/i.test(url)) return url;
  return fallback;
}

export function mergePublicSiteConfig(input: unknown): PublicSiteConfig {
  if (!isRecord(input)) return DEFAULT_PUBLIC_SITE_CONFIG;
  const s = input as Record<string, unknown>;
  const shell = isRecord(s.shell) ? s.shell : {};
  const header = isRecord(shell.header) ? shell.header : {};
  const footer = isRecord(shell.footer) ? shell.footer : {};
  const hero = isRecord(s.hero) ? s.hero : {};
  const why = isRecord(s.why) ? s.why : {};
  const trust = isRecord(s.trust) ? s.trust : {};
  const search = isRecord(s.search) ? s.search : {};
  const cta = isRecord(s.cta) ? s.cta : {};
  const sourceNav = asArray<Record<string, unknown>>(header.nav);
  const sourceColumns = asArray<Record<string, unknown>>(footer.columns);
  const sourceSocials = asArray<Record<string, unknown>>(footer.socials);
  const sourceSlides = asArray<Record<string, unknown>>(hero.slides);
  const sourcePromos = asArray<Record<string, unknown>>(hero.floatingCards);
  const sourcePills = asArray<Record<string, unknown>>(hero.pills);
  const sourcePropertyTypes = asArray<Record<string, unknown>>(s.propertyTypes);
  const sourcePortals = asArray<Record<string, unknown>>(s.portals);
  const sourceWhyCards = asArray<Record<string, unknown>>(why.cards);
  const sourceFeatured = asArray<Record<string, unknown>>(s.featured);
  const sourceHighlights = asArray<Record<string, unknown>>(s.highlights);
  const sourceInsights = asArray<Record<string, unknown>>(s.insights);
  const sourceTrustLogos = asArray<Record<string, unknown>>(trust.logos);
  const sourceMarketingAds = asArray<Record<string, unknown>>(s.marketingAds);
  const sourceSearchTabs = asArray<Record<string, unknown>>(search.tabs);
  const sourceSearchChips = asArray<Record<string, unknown>>(search.chips);
  const sourceSections = asArray<Record<string, unknown>>(s.sections);
  const sourceRail = isRecord(s.rail) ? s.rail : {};
  const sourceRailSections = asArray<Record<string, unknown>>(sourceRail.sections);
  const brand = isRecord(s.brand) ? s.brand : {};

  const supportedNav = DEFAULT_PUBLIC_SITE_CONFIG.shell.header.nav;
  const sourceNavById = new Map(sourceNav.map((item) => [safeText(item.id, ""), item]));
  const nav = supportedNav.map((fallback) => {
    const item = sourceNavById.get(fallback.id);
    return item
      ? { id: fallback.id, label: safeText(item.label, fallback.label), href: safeUrl(item.href, fallback.href), enabled: safeBool(item.enabled, fallback.enabled) }
      : fallback;
  });
  const columns = sourceColumns.length ? sourceColumns.map((column, i) => ({ id: safeText(column.id, `column-${i}`), title: safeText(column.title, DEFAULT_PUBLIC_SITE_CONFIG.shell.footer.columns[i]?.title ?? ""), items: asArray<Record<string, unknown>>(column.items).map((item, j) => ({ id: safeText(item.id, `item-${i}-${j}`), label: safeText(item.label, "Link"), href: safeUrl(item.href, "#") })) })) : DEFAULT_PUBLIC_SITE_CONFIG.shell.footer.columns;

  const normalizedSlides = sourceSlides.length ? sourceSlides.map((slide, i) => ({
    id: safeText(slide.id, `slide-${i}`), eyebrow: safeText(slide.eyebrow, DEFAULT_PUBLIC_SITE_CONFIG.hero.slides[i % 2].eyebrow), title: safeText(slide.title, DEFAULT_PUBLIC_SITE_CONFIG.hero.slides[i % 2].title), copy: safeText(slide.copy, DEFAULT_PUBLIC_SITE_CONFIG.hero.slides[i % 2].copy), signature: asArray<string>(slide.signature).filter((v) => typeof v === "string"), primaryLabel: safeText(slide.primaryLabel, "Get Started"), primaryHref: safeUrl(slide.primaryHref, PUBLIC_ROUTES.portalAccessSignUp), secondaryLabel: safeText(slide.secondaryLabel, "Explore"), secondaryHref: safeUrl(slide.secondaryHref, "#portals"), image: typeof slide.image === "string" ? slide.image : null, mobileImage: typeof slide.mobileImage === "string" ? slide.mobileImage : null, enabled: safeBool(slide.enabled, true),
  })) : DEFAULT_PUBLIC_SITE_CONFIG.hero.slides;
  const heroSlides = normalizedSlides.length ? normalizedSlides : DEFAULT_PUBLIC_SITE_CONFIG.hero.slides;

  const mergedPropertyTypes = sourcePropertyTypes.length ? sourcePropertyTypes.map((item, i) => ({ id: safeText(item.id, `property-${i}`), title: safeText(item.title, "Property type"), description: safeText(item.description, "Discover more"), image: typeof item.image === "string" ? item.image : null, icon: validIcon(item.icon, ["home", "building", "office", "landmark"], "building") as PublicSitePropertyType["icon"], href: safeUrl(item.href, `/discover/${safeText(item.id, "residential")}`), enabled: safeBool(item.enabled, true) })) : DEFAULT_PUBLIC_SITE_CONFIG.propertyTypes;
  const normalizedPortals = sourcePortals.length ? sourcePortals.map((item, i) => ({ id: validIcon(item.id, ["manager", "landlord", "agency", "tenant"], DEFAULT_PUBLIC_SITE_CONFIG.portals[i % 4].id) as PublicSitePortal["id"], eyebrow: safeText(item.eyebrow, "PORTAL"), title: safeText(item.title, "Portal"), description: safeText(item.description, "A connected property workspace."), image: typeof item.image === "string" ? item.image : null, href: safeUrl(item.href, PUBLIC_ROUTES.managerSignIn), enabled: safeBool(item.enabled, true) })) : DEFAULT_PUBLIC_SITE_CONFIG.portals;
  const dedupedPortals = normalizedPortals.filter((portal, index, array) => array.findIndex((item) => item.id === portal.id) === index);
  const legacyPortalOrder: PublicSitePortal["id"][] = ["manager", "landlord", "tenant", "agency"];
  const requestedPortalOrder: PublicSitePortal["id"][] = ["agency", "manager", "landlord", "tenant"];
  const currentPortalIds = dedupedPortals.map((portal) => portal.id);
  const mergedPortals = currentPortalIds.join("|") === legacyPortalOrder.join("|")
    ? requestedPortalOrder.map((id) => dedupedPortals.find((portal) => portal.id === id)).filter((portal): portal is PublicSitePortal => Boolean(portal))
    : dedupedPortals;

  return {
    ...DEFAULT_PUBLIC_SITE_CONFIG,
    ...s,
    version: 1,
    brand: {
      ...DEFAULT_PUBLIC_SITE_CONFIG.brand,
      name: safeText(brand.name, DEFAULT_PUBLIC_SITE_CONFIG.brand.name),
      descriptor: safeText(brand.descriptor, DEFAULT_PUBLIC_SITE_CONFIG.brand.descriptor),
      logoUrl: typeof brand.logoUrl === "string" && brand.logoUrl.trim() ? brand.logoUrl : null,
    },
    shell: {
      ...DEFAULT_PUBLIC_SITE_CONFIG.shell,
      ...shell,
      header: {
        ...DEFAULT_PUBLIC_SITE_CONFIG.shell.header,
        ...header,
        nav,
        utilityWords: asArray<string>(header.utilityWords).length ? asArray<string>(header.utilityWords).filter((v) => typeof v === "string") : DEFAULT_PUBLIC_SITE_CONFIG.shell.header.utilityWords,
      },
      footer: {
        ...DEFAULT_PUBLIC_SITE_CONFIG.shell.footer,
        ...footer,
        columns,
        socials: sourceSocials.length ? sourceSocials.map((item, i) => ({ id: safeText(item.id, `social-${i}`), label: safeText(item.label, "•"), href: safeUrl(item.href, "#"), enabled: safeBool(item.enabled, true) })) : DEFAULT_PUBLIC_SITE_CONFIG.shell.footer.socials,
        newsletterTitle: safeText(footer.newsletterTitle, DEFAULT_PUBLIC_SITE_CONFIG.shell.footer.newsletterTitle),
        newsletterPlaceholder: safeText(footer.newsletterPlaceholder, DEFAULT_PUBLIC_SITE_CONFIG.shell.footer.newsletterPlaceholder),
        showNewsletter: safeBool(footer.showNewsletter, DEFAULT_PUBLIC_SITE_CONFIG.shell.footer.showNewsletter),
      },
    },
    hero: {
      ...DEFAULT_PUBLIC_SITE_CONFIG.hero,
      ...hero,
      fitMode: hero.fitMode === "screen" ? "screen" : "window",
      overlay: hero.overlay === "medium" || hero.overlay === "strong" ? hero.overlay : "soft",
      autoplay: safeBool(hero.autoplay, true),
      intervalMs: typeof hero.intervalMs === "number" && Number.isFinite(hero.intervalMs) ? (hero.intervalMs === 7000 ? DEFAULT_PUBLIC_SITE_CONFIG.hero.intervalMs : Math.min(Math.max(hero.intervalMs, 5000), 300000)) : DEFAULT_PUBLIC_SITE_CONFIG.hero.intervalMs,
      transitionMs: typeof hero.transitionMs === "number" && Number.isFinite(hero.transitionMs) ? Math.min(Math.max(hero.transitionMs, 300), 2000) : DEFAULT_PUBLIC_SITE_CONFIG.hero.transitionMs,
      slides: heroSlides,
      floatingCards: sourcePromos.length ? sourcePromos.map((item, i) => ({ id: safeText(item.id, `promo-${i}`), label: safeText(item.label, "FEATURED"), title: safeText(item.title, "Discover CALQULUS"), copy: safeText(item.copy, "Explore the connected property experience."), image: typeof item.image === "string" ? item.image : null, href: safeUrl(item.href, "#portals"), enabled: safeBool(item.enabled, true) })) : DEFAULT_PUBLIC_SITE_CONFIG.hero.floatingCards,
      pills: sourcePills.length ? sourcePills.map((item, i) => ({ id: safeText(item.id, `pill-${i}`), label: safeText(item.label, "CALQULUS"), icon: validIcon(item.icon, ["portals", "secure", "insights", "reliable"], "insights") as PublicSiteHeroPill["icon"], enabled: safeBool(item.enabled, true) })) : DEFAULT_PUBLIC_SITE_CONFIG.hero.pills,
    },
    propertyTypes: mergedPropertyTypes,
    portals: mergedPortals,
    why: {
      ...DEFAULT_PUBLIC_SITE_CONFIG.why,
      ...why,
      eyebrow: safeText(why.eyebrow, DEFAULT_PUBLIC_SITE_CONFIG.why.eyebrow),
      title: safeText(why.title, DEFAULT_PUBLIC_SITE_CONFIG.why.title),
      copy: safeText(why.copy, DEFAULT_PUBLIC_SITE_CONFIG.why.copy),
      cards: sourceWhyCards.length ? sourceWhyCards.map((item, i) => ({ id: safeText(item.id, `why-${i}`), title: safeText(item.title, "Manage Everything"), copy: safeText(item.copy, "Connected property operations."), icon: validIcon(item.icon, ["stack", "gear", "chart", "leaf"], "stack") as PublicSiteWhyCard["icon"], enabled: safeBool(item.enabled, true) })) : DEFAULT_PUBLIC_SITE_CONFIG.why.cards,
    },
    featured: sourceFeatured.length ? sourceFeatured.map((item, i) => ({ id: safeText(item.id, `featured-${i}`), eyebrow: safeText(item.eyebrow, "FEATURED"), title: safeText(item.title, "Featured Property"), location: safeText(item.location, "Add location"), detail: safeText(item.detail, "Add property details"), price: safeText(item.price, "Add price or rent"), image: typeof item.image === "string" ? item.image : null, href: safeUrl(item.href, "/discover/residential"), enabled: safeBool(item.enabled, false) })) : DEFAULT_PUBLIC_SITE_CONFIG.featured,
    highlights: sourceHighlights.length ? sourceHighlights.map((item, i) => ({ id: safeText(item.id, `highlight-${i}`), value: safeText(item.value, "—"), label: safeText(item.label, "Configured metric"), icon: validIcon(item.icon, ["property", "users", "uptime", "support"], "property") as PublicSiteHighlight["icon"], enabled: safeBool(item.enabled, true) })) : DEFAULT_PUBLIC_SITE_CONFIG.highlights,
    insights: sourceInsights.length ? sourceInsights.map((item, i) => ({ id: safeText(item.id, `insight-${i}`), category: safeText(item.category, "Insights"), title: safeText(item.title, "Latest insight"), meta: safeText(item.meta, "Read now"), image: typeof item.image === "string" ? item.image : null, href: safeUrl(item.href, "#insights"), enabled: safeBool(item.enabled, true) })) : DEFAULT_PUBLIC_SITE_CONFIG.insights,
    trust: {
      ...DEFAULT_PUBLIC_SITE_CONFIG.trust,
      ...trust,
      eyebrow: safeText(trust.eyebrow, DEFAULT_PUBLIC_SITE_CONFIG.trust.eyebrow),
      title: safeText(trust.title, DEFAULT_PUBLIC_SITE_CONFIG.trust.title),
      copy: safeText(trust.copy, DEFAULT_PUBLIC_SITE_CONFIG.trust.copy),
      quote: safeText(trust.quote, DEFAULT_PUBLIC_SITE_CONFIG.trust.quote),
      person: safeText(trust.person, DEFAULT_PUBLIC_SITE_CONFIG.trust.person),
      role: safeText(trust.role, DEFAULT_PUBLIC_SITE_CONFIG.trust.role),
      avatar: typeof trust.avatar === "string" ? trust.avatar : null,
      logos: sourceTrustLogos.length ? sourceTrustLogos.map((item, i) => ({ id: safeText(item.id, `logo-${i}`), name: safeText(item.name, "Organization"), image: typeof item.image === "string" ? item.image : null, href: safeUrl(item.href, "#"), enabled: safeBool(item.enabled, true) })) : DEFAULT_PUBLIC_SITE_CONFIG.trust.logos,
    },
    marketingAds: sourceMarketingAds.length ? sourceMarketingAds.map((item, i) => ({
      id: safeText(item.id, `ad-${i}`),
      label: safeText(item.label, "FEATURED"),
      title: safeText(item.title, "Public promotion"),
      copy: safeText(item.copy, "Promote a message across the public experience."),
      image: typeof item.image === "string" ? item.image : null,
      href: safeUrl(item.href, "#"),
      enabled: safeBool(item.enabled, false),
      placement: validIcon(item.placement, ["hero", "property-types", "portals", "why", "featured", "trust", "cta"], "hero") as PublicSiteAdPlacement,
      mode: validIcon(item.mode, ["overlay", "replace"], "overlay") as PublicSiteAdMode,
      targetId: typeof item.targetId === "string" && item.targetId.trim() ? item.targetId : null,
      position: validIcon(item.position, ["top-left", "top-right", "bottom-left", "bottom-right"], "top-right") as PublicSiteAdPosition,
      size: validIcon(item.size, ["compact", "standard", "wide"], "compact") as PublicSiteAdSize,
    })) : DEFAULT_PUBLIC_SITE_CONFIG.marketingAds,
    search: {
      ...DEFAULT_PUBLIC_SITE_CONFIG.search,
      ...search,
      title: safeText(search.title, DEFAULT_PUBLIC_SITE_CONFIG.search.title),
      copy: safeText(search.copy, DEFAULT_PUBLIC_SITE_CONFIG.search.copy),
      placeholder: safeText(search.placeholder, DEFAULT_PUBLIC_SITE_CONFIG.search.placeholder),
      tabs: sourceSearchTabs.length ? sourceSearchTabs.map((item, i) => ({ id: safeText(item.id, `tab-${i}`), label: safeText(item.label, "All"), enabled: safeBool(item.enabled, true) })) : DEFAULT_PUBLIC_SITE_CONFIG.search.tabs,
      chips: sourceSearchChips.length ? sourceSearchChips.map((item, i) => ({ id: safeText(item.id, `chip-${i}`), label: safeText(item.label, "Property"), href: safeUrl(item.href, "/discover/residential"), icon: validIcon(item.icon, ["home", "building", "office", "landmark"], "building") as PublicSiteConfig["search"]["chips"][number]["icon"], enabled: safeBool(item.enabled, true) })) : DEFAULT_PUBLIC_SITE_CONFIG.search.chips,
    },
    cta: {
      ...DEFAULT_PUBLIC_SITE_CONFIG.cta,
      ...cta,
      eyebrow: safeText(cta.eyebrow, DEFAULT_PUBLIC_SITE_CONFIG.cta.eyebrow),
      title: safeText(cta.title, DEFAULT_PUBLIC_SITE_CONFIG.cta.title),
      copy: safeText(cta.copy, DEFAULT_PUBLIC_SITE_CONFIG.cta.copy),
      primaryLabel: safeText(cta.primaryLabel, DEFAULT_PUBLIC_SITE_CONFIG.cta.primaryLabel),
      primaryHref: safeUrl(cta.primaryHref, PUBLIC_ROUTES.portalAccessSignUp),
      secondaryLabel: safeText(cta.secondaryLabel, DEFAULT_PUBLIC_SITE_CONFIG.cta.secondaryLabel),
      secondaryHref: safeUrl(cta.secondaryHref, DEFAULT_PUBLIC_SITE_CONFIG.cta.secondaryHref),
    },
    sections: sourceSections.length ? sourceSections.map((item, i) => ({ id: validIcon(item.id, ["hero", "property-types", "portals", "why", "featured", "trust", "cta"], DEFAULT_PUBLIC_SITE_CONFIG.sections[i % DEFAULT_PUBLIC_SITE_CONFIG.sections.length].id) as PublicSiteSectionId, visible: safeBool(item.visible, true), order: typeof item.order === "number" ? item.order : (i + 1) * 10, variant: item.variant === "compact" || item.variant === "wide" ? item.variant : "default" })) : DEFAULT_PUBLIC_SITE_CONFIG.sections,
    rail: {
      visible: safeBool(sourceRail.visible, true),
      width: sourceRail.width === "narrow" ? "narrow" : "standard",
      sections: sourceRailSections.length ? sourceRailSections.map((item, i) => ({ id: validIcon(item.id, ["search", "highlights", "insights"], DEFAULT_PUBLIC_SITE_CONFIG.rail.sections[i % 3].id) as PublicSiteRailId, visible: safeBool(item.visible, true), order: typeof item.order === "number" ? item.order : (i + 1) * 10 })) : DEFAULT_PUBLIC_SITE_CONFIG.rail.sections,
    },
  };
}

export const PUBLIC_SITE_SECTION_LABELS: Record<PublicSiteSectionId, string> = {
  hero: "Hero",
  "property-types": "Property types",
  portals: "Portals",
  why: "Why CALQULUS",
  featured: "Featured properties",
  trust: "Trust & testimonial",
  cta: "Conversion CTA",
};

export const PUBLIC_SITE_RAIL_LABELS: Record<PublicSiteRailId, string> = {
  search: "Quick search",
  highlights: "Platform highlights",
  insights: "Latest insights",
};
