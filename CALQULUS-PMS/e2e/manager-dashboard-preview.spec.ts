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

test.describe("Manager dashboard layout preview", () => {
  test("shows the executive operations hierarchy without invented KPIs", async ({ page }) => {
    await page.goto("/design-preview/manager-dashboard");
    await expect(page.getByRole("heading", { name: "Dashboard", exact: true })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Portfolio overview and today's operational priorities.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Add property" })).toBeVisible();
    await expect(page.getByRole("button", { name: "View reports" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Collections performance" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Property performance" })).toBeVisible();
    await expect(page.getByText(/KES 1.24M/i)).toHaveCount(0);
    await expect(page.locator("[data-preview='manager-dashboard']")).toBeVisible();
  });

  for (const viewport of VIEWPORTS) {
    test(`does not overflow horizontally at ${viewport.width}px`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto("/design-preview/manager-dashboard");
      await expect(page.getByRole("heading", { name: "Dashboard", exact: true })).toBeVisible({ timeout: 15_000 });
      const overflow = await horizontalOverflow(page);
      expect(overflow, `horizontal overflow at ${viewport.width}px`).toBeLessThanOrEqual(1);
    });
  }
});
