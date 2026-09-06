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

const PORTALS = ["Manager", "Landlord", "Agency", "Tenant", "Admin", "WebHost"] as const;

async function horizontalOverflow(page: Page) {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
}

test.describe("Authenticated shell preview", () => {
  test("renders the shared chrome for every portal identity", async ({ page }) => {
    await page.goto("/design-preview/shell");
    await expect(page.getByRole("heading", { name: "Dashboard", exact: true })).toBeVisible({ timeout: 15_000 });
    await expect(page.locator("[data-shell-preview]")).toBeVisible();

    for (const portal of PORTALS) {
      await page.getByRole("tab", { name: portal }).click();
      await expect(page.locator("[data-shell-preview]")).toBeVisible();
    }

    await page.getByRole("button", { name: "Loading" }).click();
    await expect(page.getByText(/loading desk canvas/i)).toBeVisible();
    await page.getByRole("button", { name: "Empty" }).click();
    await expect(page.getByText(/nothing on this desk yet/i)).toBeVisible();
    await page.getByRole("button", { name: "Error" }).click();
    await expect(page.getByText(/desk could not load/i)).toBeVisible();
  });

  for (const viewport of VIEWPORTS) {
    test(`does not overflow horizontally at ${viewport.width}px`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto("/design-preview/shell");
      await expect(page.getByRole("heading", { name: "Dashboard", exact: true })).toBeVisible({ timeout: 15_000 });
      expect(await horizontalOverflow(page), `shell overflow at ${viewport.width}px`).toBeLessThanOrEqual(1);

      if (viewport.width < 1024) {
        await page.getByRole("button", { name: "Open menu" }).click();
        await expect(page.getByRole("button", { name: "Close menu" }).first()).toBeVisible();
        expect(await horizontalOverflow(page), `drawer overflow at ${viewport.width}px`).toBeLessThanOrEqual(1);
        await page.getByRole("button", { name: "Close menu" }).first().click();
      }

      for (const portal of PORTALS) {
        await page.getByRole("tab", { name: portal }).click();
        expect(
          await horizontalOverflow(page),
          `${portal} shell overflow at ${viewport.width}px`,
        ).toBeLessThanOrEqual(1);
      }
    });
  }
});
