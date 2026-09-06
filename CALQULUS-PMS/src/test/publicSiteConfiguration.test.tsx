import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { DEFAULT_PUBLIC_SITE_CONFIG, mergePublicSiteConfig } from "@/features/marketing/publicSiteConfig";

const migration = "supabase/migrations/20260905000003_public_site_configuration.sql";
const brandMigration = "supabase/migrations/20260905000004_public_site_brand_svg.sql";

it("public site defaults contain the approved four property categories and four portals", () => {
  expect(DEFAULT_PUBLIC_SITE_CONFIG.propertyTypes.map((item) => item.title)).toEqual(["Residentials", "Estates", "Offices", "Institutions"]);
  expect(DEFAULT_PUBLIC_SITE_CONFIG.portals.map((item) => item.id)).toEqual(["agency", "manager", "landlord", "tenant"]);
  expect(DEFAULT_PUBLIC_SITE_CONFIG.brand.descriptor).toBe("PROPERTY MANAGEMENT SYSTEMS");
  expect(DEFAULT_PUBLIC_SITE_CONFIG.hero.intervalMs).toBe(30000);
  expect(DEFAULT_PUBLIC_SITE_CONFIG.shell.header.nav.map((item) => item.id)).toEqual(["home", "properties", "portals", "insights", "pricing"]);
});

describe("public site configuration contract", () => {
  it("falls back safely when persisted config is empty or malformed", () => {
    expect(mergePublicSiteConfig(null)).toEqual(DEFAULT_PUBLIC_SITE_CONFIG);
    expect(mergePublicSiteConfig({})).toEqual(DEFAULT_PUBLIC_SITE_CONFIG);
    expect(mergePublicSiteConfig({ hero: { slides: [] } }).hero.slides).toHaveLength(2);
    expect(mergePublicSiteConfig({ hero: { intervalMs: 7000 } }).hero.intervalMs).toBe(30000);
    expect(mergePublicSiteConfig({ shell: { header: { nav: [{ id: "solutions", label: "Old", href: "#platform", enabled: true }] } } }).shell.header.nav.map((item) => item.id)).toEqual(["home", "properties", "portals", "insights", "pricing"]);
  });

  it("preserves editable shell, sections and content while retaining defaults for missing collections", () => {
    const result = mergePublicSiteConfig({ sections: [{ id: "hero", visible: true, order: 1, variant: "wide" }], propertyTypes: [] });
    expect(result.sections).toHaveLength(1);
    expect(result.sections[0].variant).toBe("wide");
    expect(result.propertyTypes).toHaveLength(DEFAULT_PUBLIC_SITE_CONFIG.propertyTypes.length);
    expect(result.shell.header.getStartedLabel).toBe("Get Started");
  });

  it("supports the compact screenshot composition and configurable proof content", () => {
    expect(DEFAULT_PUBLIC_SITE_CONFIG.hero.floatingCards).toHaveLength(3);
    expect(DEFAULT_PUBLIC_SITE_CONFIG.hero.pills).toHaveLength(4);
    expect(DEFAULT_PUBLIC_SITE_CONFIG.highlights).toHaveLength(4);
    expect(DEFAULT_PUBLIC_SITE_CONFIG.insights).toHaveLength(3);
    expect(DEFAULT_PUBLIC_SITE_CONFIG.trust.logos).toHaveLength(0);
    expect(DEFAULT_PUBLIC_SITE_CONFIG.marketingAds).toHaveLength(1);
    expect(DEFAULT_PUBLIC_SITE_CONFIG.rail.sections.map((x) => x.id)).toEqual(["search", "highlights", "insights"]);
    const ad = mergePublicSiteConfig({ marketingAds: [{ id: "a1", title: "Campaign", placement: "portals", mode: "replace", targetId: "agency", position: "bottom-right", size: "wide", enabled: true }] }).marketingAds[0];
    expect(ad.placement).toBe("portals");
    expect(ad.mode).toBe("replace");
    expect(ad.targetId).toBe("agency");
    expect(ad.size).toBe("wide");
  });
});

describe("public brand media contract", () => {
  it("allows SVG brand marks in the public-site media bucket", () => {
    const sql = readFileSync(brandMigration, "utf8");
    expect(sql).toContain("image/svg+xml");
    expect(sql).toContain("public-site-media");
  });
});

describe("public site security boundary", () => {
  it("uses a public read RPC and permission-gated write RPC rather than direct table writes", () => {
    const sql = readFileSync(migration, "utf8");
    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.get_public_site_config()");
    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.save_public_site_config");
    expect(sql).toContain("can_manage_platform_settings = true");
    expect(sql).toContain("Public site configuration is too large");
    expect(sql).toContain("Unsupported public site configuration version");
    expect(sql).toContain("REVOKE ALL ON public.platform_public_site_config FROM PUBLIC, anon, authenticated");
    expect(sql).toContain("GRANT EXECUTE ON FUNCTION public.get_public_site_config() TO anon, authenticated, service_role");
  });
});
