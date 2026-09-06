import { test, expect } from "@playwright/test";

test.describe("Design preview", () => {
  test("renders the Design Bible gallery on a white desk", async ({ page }) => {
    await page.goto("/design-preview");
    await expect(page.getByRole("heading", { name: "CALQULUS design preview" })).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/where you are, what matters, what needs attention/i)).toBeVisible();
    await expect(page.getByText(/Colour foundation/)).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Design preview screens" })).toContainText("Brand Studio");
    await expect(page.locator("[data-preview='design']")).toBeVisible();
    await page.getByRole("navigation", { name: "Design preview screens" }).getByRole("button", { name: "Brand Studio" }).click();
    await expect(page.getByText("Brand configuration")).toBeVisible();
    const brandPreview = page.locator("[data-preview='brand-studio']");
    await expect(brandPreview.getByRole("heading", { name: "Identity", exact: true })).toBeVisible();
    await expect(brandPreview.getByRole("heading", { name: "Colours", exact: true })).toBeVisible();
    await expect(brandPreview.getByRole("heading", { name: "Portal themes", exact: true })).toBeVisible();
    await expect(brandPreview.getByRole("heading", { name: "Communications", exact: true })).toBeVisible();
    await expect(brandPreview.getByRole("heading", { name: "Documents", exact: true })).toBeVisible();
    await expect(brandPreview.getByRole("heading", { name: "Domain", exact: true })).toBeVisible();
    await expect(brandPreview.getByRole("button", { name: "Login", exact: true })).toBeVisible();
    await expect(brandPreview.getByRole("button", { name: "Header", exact: true })).toBeVisible();
    await expect(brandPreview.getByRole("button", { name: "Sidebar", exact: true })).toBeVisible();
    await expect(brandPreview.getByRole("button", { name: "Dashboard", exact: true })).toBeVisible();
    await expect(brandPreview.getByRole("button", { name: "Buttons", exact: true })).toBeVisible();
    await expect(brandPreview.getByRole("button", { name: "Document", exact: true })).toBeVisible();
    await page.getByRole("navigation", { name: "Design preview screens" }).getByRole("button", { name: "Manager" }).click();
    await expect(page.getByText("Professional Blue")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Manager" })).toBeVisible();
    await expect(page.getByText("Where you are · what needs attention · the next action")).toBeVisible();
    await page.getByRole("navigation", { name: "Design preview screens" }).getByRole("button", { name: "Landlord" }).click();
    await expect(page.getByText("Landlord is a portfolio desk")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Dashboard", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Portfolio", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Statements", exact: true })).toBeVisible();
    await expect(page.getByText("No tenant PII")).toBeVisible();
    await page.getByRole("navigation", { name: "Design preview screens" }).getByRole("button", { name: "Agency" }).click();
    await expect(page.getByText("Agency is a client-and-portfolio desk")).toBeVisible();
    const agencyPreview = page.locator("[data-preview='agency-pages']");
    await expect(agencyPreview.getByText("Clients", { exact: true }).first()).toBeVisible();
    await expect(agencyPreview.getByText("Properties", { exact: true }).first()).toBeVisible();
    await expect(agencyPreview.getByText("Units", { exact: true }).first()).toBeVisible();
    await expect(agencyPreview.getByText("Occupancy", { exact: true }).first()).toBeVisible();
    await expect(agencyPreview.getByText("Collections", { exact: true }).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "Clients", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Portfolio", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Property detail", exact: true })).toBeVisible();
    await page.getByRole("navigation", { name: "Design preview screens" }).getByRole("button", { name: "Tenant", exact: true }).click();
    await expect(page.getByText("Tenant is a simple mobile-first home")).toBeVisible();
    const tenantPreview = page.locator("[data-preview='tenant-pages']");
    await expect(tenantPreview.getByRole("button", { name: "Pay rent" }).first()).toBeVisible();
    await expect(tenantPreview.getByText("Your home", { exact: true }).first()).toBeVisible();
    await expect(tenantPreview.getByText("Rent due", { exact: true }).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "Lease", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Receipts", exact: true })).toBeVisible();
    await page.getByRole("navigation", { name: "Design preview screens" }).getByRole("button", { name: "Platform Admin", exact: true }).click();
    await expect(page.getByText("Platform Admin is a control tower")).toBeVisible();
    const adminPreview = page.locator("[data-preview='admin-pages']");
    await expect(adminPreview.getByText("Organizations", { exact: true }).first()).toBeVisible();
    await expect(adminPreview.getByText("Users", { exact: true }).first()).toBeVisible();
    await expect(adminPreview.getByText("Active sessions", { exact: true }).first()).toBeVisible();
    await expect(adminPreview.getByText("Revenue", { exact: true }).first()).toBeVisible();
    await expect(adminPreview.getByText("Transactions", { exact: true }).first()).toBeVisible();
    await expect(adminPreview.getByText("Payments", { exact: true }).first()).toBeVisible();
    await expect(adminPreview.getByText("Not probed").first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "Organizations", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Organization Detail", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Subscriptions", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Audit Log", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Brand Studio", exact: true })).toBeVisible();
    await page.getByRole("navigation", { name: "Design preview screens" }).getByRole("button", { name: "Maintenance" }).click();
    await expect(page.getByRole("tab", { name: "New" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Assigned" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "In Progress" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Awaiting" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Completed" })).toBeVisible();
    await page.getByRole("navigation", { name: "Design preview screens" }).getByRole("button", { name: "Reports" }).click();
    await expect(page.getByLabel("Period")).toBeVisible();
    await expect(page.getByLabel("Property")).toBeVisible();
    await expect(page.getByLabel("Report type")).toBeVisible();
    await page.getByRole("navigation", { name: "Design preview screens" }).getByRole("button", { name: "Settings" }).click();
    await expect(page.getByRole("navigation", { name: "Settings groups" })).toContainText("Organization");
    await expect(page.getByRole("navigation", { name: "Settings groups" })).toContainText("Users");
    await expect(page.getByRole("navigation", { name: "Settings groups" })).toContainText("Roles");
    await expect(page.getByRole("navigation", { name: "Settings groups" })).toContainText("Notifications");
    await expect(page.getByRole("navigation", { name: "Settings groups" })).toContainText("Billing");
    await expect(page.getByRole("navigation", { name: "Settings groups" })).toContainText("Integrations");
    await expect(page.getByRole("navigation", { name: "Settings groups" })).toContainText("Security");
    await expect(page.getByRole("navigation", { name: "Settings groups" })).toContainText("Branding");
    await expect(page.getByRole("navigation", { name: "Settings groups" })).toContainText("Brand Studio");
  });

  test("does not overflow horizontally at 390px", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/design-preview");
    await expect(page.getByRole("heading", { name: "CALQULUS design preview" })).toBeVisible({ timeout: 15000 });
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
  });

  for (const width of [360, 390, 480, 768, 1024, 1280, 1440] as const) {
    test(`tenant preview does not overflow at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: width < 768 ? 844 : 800 });
      await page.goto("/design-preview");
      await expect(page.getByRole("heading", { name: "CALQULUS design preview" })).toBeVisible({ timeout: 15000 });
      await page.getByRole("navigation", { name: "Design preview screens" }).getByRole("button", { name: "Tenant", exact: true }).click();
      await expect(page.locator("[data-preview='tenant-pages']")).toBeVisible();
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `horizontal overflow at ${width}px`).toBeLessThanOrEqual(1);
    });
  }

  for (const width of [360, 390, 480, 768, 1024, 1280, 1440] as const) {
    test(`platform admin preview does not overflow at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: width < 768 ? 844 : 800 });
      await page.goto("/design-preview");
      await expect(page.getByRole("heading", { name: "CALQULUS design preview" })).toBeVisible({ timeout: 15000 });
      await page.getByRole("navigation", { name: "Design preview screens" }).getByRole("button", { name: "Platform Admin", exact: true }).click();
      await expect(page.locator("[data-preview='admin-pages']")).toBeVisible();
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `horizontal overflow at ${width}px`).toBeLessThanOrEqual(1);
    });
  }
});
