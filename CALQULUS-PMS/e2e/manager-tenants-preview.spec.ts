import { test, expect, type Page } from "@playwright/test";

const VIEWPORTS = [
  { width: 1440, height: 900 },
  { width: 1280, height: 800 },
  { width: 1024, height: 768 },
  { width: 768, height: 1024 },
  { width: 480, height: 900 },
  { width: 390, height: 844 },
  { width: 360, height: 800 },
] as const;

async function horizontalOverflow(page: Page) {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
}

test.describe("Manager tenants layout preview", () => {
  test("shows tenants, detail, and leases chrome without invented metrics", async ({ page }) => {
    await page.goto("/design-preview/manager-tenants");
    await expect(page.getByRole("heading", { name: "Tenants", exact: true })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("button", { name: "Invite tenant" })).toBeVisible();
    await expect(page.getByText("Rows populate from tenants, leases, and unpaid invoices.")).toBeVisible();
    await expect(page.getByText(/KES 1.24M/i)).toHaveCount(0);

    await page.getByRole("tab", { name: "Tenant detail" }).click();
    await expect(page.getByRole("heading", { name: "Tenant", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "View statement" })).toBeVisible();

    await page.getByRole("tab", { name: "Leases" }).click();
    await expect(page.getByRole("heading", { name: "Leases", exact: true })).toBeVisible();
    await expect(page.getByText("Expiring soon")).toBeVisible();
    await expect(page.locator("[data-preview='manager-tenants']")).toBeVisible();
  });

  for (const viewport of VIEWPORTS) {
    test(`does not overflow horizontally at ${viewport.width}px`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto("/design-preview/manager-tenants");
      await expect(page.getByRole("heading", { name: "Tenants", exact: true })).toBeVisible({ timeout: 15_000 });
      expect(await horizontalOverflow(page), `horizontal overflow at ${viewport.width}px`).toBeLessThanOrEqual(1);

      await page.getByRole("tab", { name: "Tenant detail" }).click();
      await expect(page.getByRole("heading", { name: "Tenant", exact: true })).toBeVisible();
      expect(await horizontalOverflow(page), `detail overflow at ${viewport.width}px`).toBeLessThanOrEqual(1);

      await page.getByRole("tab", { name: "Leases" }).click();
      await expect(page.getByRole("heading", { name: "Leases", exact: true })).toBeVisible();
      expect(await horizontalOverflow(page), `leases overflow at ${viewport.width}px`).toBeLessThanOrEqual(1);
    });
  }
});
