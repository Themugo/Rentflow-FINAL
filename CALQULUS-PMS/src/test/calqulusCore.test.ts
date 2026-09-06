import { describe, expect, it } from "vitest";
import { CALQULUS_COLOR } from "@/shared/theme/tokens";
import {
  CALQULUS_PORTALS,
  PRODUCT_STACK,
  WHITE_LABEL_CONSUMERS,
  portalFromAppRole,
} from "@/core/product/portals";
import { PLATFORM_BRAND, resolveBrand } from "@/core/brand/resolve";
import { composeBrandConfig } from "@/core/brand/composeBrandConfig";
import { compactBrandOverlay } from "@/core/brand/parseOrgRecord";
import { brandConfigToCompanySettings, documentAccent } from "@/core/brand/pdfCompany";
import { PLATFORM_BRAND_CONFIG } from "@/core/brand/platformBrand";
import { term } from "@/core/brand/terms";

describe("CALQULUS CORE product system", () => {
  it("names the three systems under CORE", () => {
    expect(PRODUCT_STACK).toEqual([
      "CALQULUS CORE",
      "Product system",
      "Design system",
      "Brand system",
      "White-label engine",
    ]);
  });

  it("sells Manager, Landlord, and Agency desks, then Tenant, then Platform Admin", () => {
    expect(Object.keys(CALQULUS_PORTALS)).toEqual([
      "manager",
      "landlord",
      "agency",
      "tenant",
      "platform_admin",
    ]);
    expect(WHITE_LABEL_CONSUMERS).toEqual(["manager", "landlord", "agency", "tenant"]);
    expect(CALQULUS_PORTALS.manager.login).toBe("/auth");
    expect(CALQULUS_PORTALS.landlord.login).toBe("/landlord/login");
    expect(CALQULUS_PORTALS.agency.login).toBe("/agency/login");
    expect(CALQULUS_PORTALS.tenant.login).toBe("/tenant/login");
    expect(CALQULUS_PORTALS.platform_admin.login).toBe("/webhost/login");
  });

  it("maps app roles onto portals", () => {
    expect(portalFromAppRole("manager")).toBe("manager");
    expect(portalFromAppRole("submanager")).toBe("manager");
    expect(portalFromAppRole("landlord")).toBe("landlord");
    expect(portalFromAppRole("agency")).toBe("agency");
    expect(portalFromAppRole("tenant")).toBe("tenant");
    expect(portalFromAppRole("webhost")).toBe("platform_admin");
    expect(portalFromAppRole(null)).toBeNull();
  });
});

describe("white-label brand resolver", () => {
  it("keeps the CALQULUS platform brand when no org overlay exists", () => {
    expect(resolveBrand(null)).toEqual(PLATFORM_BRAND);
    expect(resolveBrand(null).primaryHex).toBe(CALQULUS_COLOR.primary);
  });

  it("does not replace the platform mark when white-label is off", () => {
    const brand = resolveBrand({
      company_name: "Ridgeview Estates",
      logo_url: "https://cdn.example/logo.png",
      brand_primary_hex: "#112233",
      white_label_enabled: false,
    });
    expect(brand.source).toBe("platform");
    expect(brand.name).toBe("CALQULUS");
    expect(brand.workspaceName).toBe("Ridgeview Estates");
    expect(brand.primaryHex).toBe(CALQULUS_COLOR.primary);
  });

  it("applies company name, logo, and a valid hex when white-label is on", () => {
    const brand = resolveBrand({
      company_name: "Ridgeview Estates",
      logo_url: "https://cdn.example/logo.png",
      brand_primary_hex: "#2563EB",
      white_label_enabled: true,
    });
    expect(brand.source).toBe("organization");
    expect(brand.name).toBe("Ridgeview Estates");
    expect(brand.logoUrl).toBe("https://cdn.example/logo.png");
    expect(brand.primaryHex).toBe("#2563EB");
  });

  it("falls back to CALQULUS cyan when the stored hex is invalid", () => {
    const brand = resolveBrand({
      company_name: "Ridgeview",
      logo_url: null,
      brand_primary_hex: "blue",
      white_label_enabled: true,
    });
    expect(brand.primaryHex).toBe(CALQULUS_COLOR.primary);
  });
});

describe("BrandConfig layer", () => {
  it("keeps contact and documents as the company issuer when white-label is off", () => {
    const config = composeBrandConfig({
      company_name: "Ridgeview Estates",
      logo_url: "https://cdn.example/logo.png",
      email: "ops@ridgeview.co.ke",
      phone: "0700000000",
      website: "https://ridgeview.co.ke",
      address: "Westlands",
      city: "Nairobi",
      state: null,
      zip_code: null,
      brand_primary_hex: "#112233",
      white_label_enabled: false,
      brand_config: {
        identity: { legalName: "Ridgeview Estates Ltd", tagline: "Our buildings" },
        terminology: { tenant: "Resident" },
        documents: { invoices: { title: "RENT INVOICE" }, receipts: { footerNote: "Paid in full." } },
      },
    });

    expect(config.source).toBe("platform");
    expect(config.identity.name).toBe("CALQULUS");
    expect(config.identity.workspaceName).toBe("Ridgeview Estates");
    expect(config.identity.legalName).toBe("Ridgeview Estates Ltd");
    expect(config.colors.primary).toBe(CALQULUS_COLOR.primary);
    expect(config.terminology.tenant).toBe("Tenant");
    expect(config.contact.email).toBe("ops@ridgeview.co.ke");
    expect(config.documents.invoices.title).toBe("RENT INVOICE");
    expect(config.documents.receipts.footerNote).toBe("Paid in full.");

    const issuer = brandConfigToCompanySettings(config);
    expect(issuer.company_name).toBe("Ridgeview Estates Ltd");
    expect(issuer.logo_url).toBe("https://cdn.example/logo.png");
    expect(issuer.email).toBe("ops@ridgeview.co.ke");
  });

  it("overlays chrome identity, primary color, and terminology when white-label is on", () => {
    const config = composeBrandConfig({
      company_name: "Ridgeview Estates",
      logo_url: "https://cdn.example/logo.png",
      email: "ops@ridgeview.co.ke",
      brand_primary_hex: "#2563EB",
      white_label_enabled: true,
      brand_config: {
        identity: { tagline: "Homes, billed cleanly." },
        terminology: { tenant: "Resident", landlord: "Owner", manager: "Agent", property: "House" },
        legal: { footer: "© Ridgeview Estates" },
        communications: { email: { fromName: "Ridgeview" } },
        domains: { customDomain: "app.ridgeview.co.ke" },
      },
    });

    expect(config.source).toBe("organization");
    expect(config.identity.name).toBe("Ridgeview Estates");
    expect(config.identity.tagline).toBe("Homes, billed cleanly.");
    expect(config.colors.primary).toBe("#2563EB");
    expect(term(config, "tenant")).toBe("Resident");
    expect(term(config, "landlord")).toBe("Owner");
    expect(config.legal.footer).toBe("© Ridgeview Estates");
    expect(config.communications.email.fromName).toBe("Ridgeview");
    expect(config.domains.customDomain).toBe("app.ridgeview.co.ke");
    expect(documentAccent(config, "invoices")).toBe("#2563EB");
  });

  it("ignores invalid hex and fonts instead of spraying them into the config", () => {
    const config = composeBrandConfig({
      company_name: "Ridgeview",
      logo_url: null,
      brand_primary_hex: "blue",
      white_label_enabled: true,
      brand_config: {
        colors: { primary: "navy", accent: "#GGGGGG" },
        typography: { heading: "Comic Sans", body: "Papyrus" },
      },
    });

    expect(config.colors.primary).toBe(CALQULUS_COLOR.primary);
    expect(config.colors.accent).toBe(PLATFORM_BRAND_CONFIG.colors.accent);
    expect(config.typography.heading).toBe("Outfit");
    expect(config.typography.body).toBe("system-ui");
  });

  it("rejects a high-key yellow so it cannot become active brand colour", () => {
    const config = composeBrandConfig({
      company_name: "Ridgeview",
      logo_url: null,
      brand_primary_hex: "#FFFF00",
      white_label_enabled: true,
    });
    expect(config.colors.primary).toBe(CALQULUS_COLOR.primary);
  });

  it("compacts empty overlay fields so jsonb stays sparse", () => {
    expect(compactBrandOverlay({
      identity: { legalName: "", tagline: "Keep me" },
      terminology: { tenant: "" },
    })).toEqual({
      identity: { tagline: "Keep me" },
    });
  });
});
