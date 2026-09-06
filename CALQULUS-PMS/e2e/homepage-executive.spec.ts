import { test, expect } from "@playwright/test";

const VIEWPORTS = [
  { width: 1440, height: 900 },
  { width: 1280, height: 800 },
  { width: 1024, height: 768 },
  { width: 768, height: 1024 },
  { width: 480, height: 900 },
  { width: 390, height: 844 },
  { width: 360, height: 800 },
] as const;

test.describe("Executive homepage", () => {
  test("presents the approved positioning and live portal routes", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#main-content h1")).toHaveText(
      "Run your properties. Without the chaos.",
      { timeout: 15000 },
    );
    await expect(page.getByRole("navigation", { name: "Primary" })).toContainText("Platform");
    await expect(page.getByRole("link", { name: /^start managing$/i })).toHaveAttribute(
      "href",
      "/auth?tab=signup",
    );
    await expect(page.getByRole("link", { name: /manager portal/i })).toHaveAttribute(
      "href",
      "/auth?tab=signup",
    );
    await expect(page.getByRole("link", { name: /landlord portal/i })).toHaveAttribute(
      "href",
      "/landlord/login",
    );
    await expect(page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: "Pricing" })).toHaveAttribute(
      "href",
      "/pricing",
    );
    await expect(page.locator("footer")).toContainText(
      "Run every property from one place.",
    );
  });

  for (const viewport of VIEWPORTS) {
    test(`does not overflow horizontally at ${viewport.width}px`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto("/");
      await expect(page.locator("#main-content h1")).toBeVisible({ timeout: 15000 });
      const overflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth - document.documentElement.clientWidth;
      });
      expect(overflow, `horizontal overflow at ${viewport.width}px`).toBeLessThanOrEqual(1);

      if (viewport.width < 1024) {
        await expect(page.getByRole("button", { name: /open menu/i })).toBeVisible();
      }
    });
  }
});
