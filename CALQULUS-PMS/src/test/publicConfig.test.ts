import { describe, expect, it } from "vitest";
import {
  CONTACT_EMAIL,
  PUBLIC_ROUTES,
  homeSectionHref,
} from "@/features/marketing/publicConfig";

describe("public marketing config", () => {
  it("uses the live portal login routes", () => {
    expect(PUBLIC_ROUTES.managerSignIn).toBe("/auth");
    expect(PUBLIC_ROUTES.managerSignUp).toBe("/auth?tab=signup");
    expect(PUBLIC_ROUTES.landlordLogin).toBe("/landlord/login");
    expect(PUBLIC_ROUTES.agencyLogin).toBe("/agency/login");
    expect(PUBLIC_ROUTES.tenantLogin).toBe("/tenant/login");
    expect(PUBLIC_ROUTES.webhostLogin).toBe("/webhost/login");
    expect(PUBLIC_ROUTES.designPreview).toBe("/design-preview");
    expect(PUBLIC_ROUTES.shellPreview).toBe("/design-preview/shell");
    expect(PUBLIC_ROUTES.managerDashboardPreview).toBe("/design-preview/manager-dashboard");
    expect(PUBLIC_ROUTES.managerOperationsPreview).toBe("/design-preview/manager-operations");
    expect(PUBLIC_ROUTES.managerPropertiesPreview).toBe("/design-preview/manager-properties");
    expect(PUBLIC_ROUTES.managerTenantsPreview).toBe("/design-preview/manager-tenants");
    expect(PUBLIC_ROUTES.legalPrivacy).toBe("/legal?tab=privacy");
    expect(PUBLIC_ROUTES.legalTerms).toBe("/legal?tab=terms");
  });

  it("keeps the existing support mailbox", () => {
    expect(CONTACT_EMAIL).toBe("enterprise@calqulusrms.com");
  });

  it("builds in-page hashes on the homepage and rooted hashes elsewhere", () => {
    expect(homeSectionHref("platform", "/")).toBe("#platform");
    expect(homeSectionHref("platform", "/pricing")).toBe("/#platform");
    expect(homeSectionHref("contact", "/legal")).toBe("/#contact");
  });

  it("keeps only the live public navigation concepts and legal routes", () => {
    expect(PUBLIC_ROUTES.legalCookies).toBe("/legal?tab=privacy");
    expect(PUBLIC_ROUTES.portalAccess).toBe("/portal-access");
    expect(PUBLIC_ROUTES.pricing).toBe("/pricing");
  });
});
