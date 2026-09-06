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

test.describe("Manager properties layout preview", () => {
  test("shows properties, detail, and units chrome without invented metrics", async ({ page }) => {
    await page.goto("/design-preview/manager-properties");
    await expect(page.getByRole("heading", { name: "Properties", exact: true })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("button", { name: "Add property" })).toBeVisible();
    await expect(page.getByRole("button", { name: "View units" })).toBeVisible();
    await expect(page.getByText("Rows populate from the manager's properties.")).toBeVisible();
    await expect(page.getByText(/KES 1.24M/i)).toHaveCount(0);

    await page.getByRole("tab", { name: "Property detail" }).click();
    await expect(page.getByRole("heading", { name: "Property name", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Add tenant" })).toBeVisible();
    await expect(page.getByText("Outstanding")).toBeVisible();

    await page.getByRole("tab", { name: "Units" }).click();
    await expect(page.getByRole("heading", { name: "Units", exact: true })).toBeVisible();
    await expect(page.getByText("Rows populate from units, tenants, leases, and unpaid invoices.")).toBeVisible();
    await expect(page.locator("[data-preview='manager-properties']")).toBeVisible();
  });

  for (const viewport of VIEWPORTS) {
    test(`does not overflow horizontally at ${viewport.width}px`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto("/design-preview/manager-properties");
      await expect(page.getByRole("heading", { name: "Properties", exact: true })).toBeVisible({ timeout: 15_000 });
      const overflow = await horizontalOverflow(page);
      expect(overflow, `horizontal overflow at ${viewport.width}px`).toBeLessThanOrEqual(1);

      await page.getByRole("tab", { name: "Property detail" }).click();
      await expect(page.getByRole("heading", { name: "Property name", exact: true })).toBeVisible();
      expect(await horizontalOverflow(page), `detail overflow at ${viewport.width}px`).toBeLessThanOrEqual(1);

      await page.getByRole("tab", { name: "Units" }).click();
      await expect(page.getByRole("heading", { name: "Units", exact: true })).toBeVisible();
      expect(await horizontalOverflow(page), `units overflow at ${viewport.width}px`).toBeLessThanOrEqual(1);
    });
  }
});
