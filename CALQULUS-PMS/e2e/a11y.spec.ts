import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

async function expectNoBlockingAxe(page: Parameters<typeof AxeBuilder>[0]["page"]) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  const blocking = results.violations.filter((v) => v.impact === "critical" || v.impact === "serious");
  expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([]);
}

test.describe("Accessibility", () => {
  test("design preview has no critical or serious axe violations", async ({ page }) => {
    await page.goto("/design-preview");
    await expect(page.getByRole("heading", { name: "CALQULUS design preview" })).toBeVisible({ timeout: 15000 });
    await expectNoBlockingAxe(page);
  });

  test("homepage has no critical or serious axe violations", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#main-content h1")).toBeVisible({ timeout: 15000 });
    await expectNoBlockingAxe(page);
  });

  test("manager login has no critical or serious axe violations", async ({ page }) => {
    await page.goto("/auth");
    await expect(page.getByRole("heading", { name: /^sign in$/i })).toBeVisible({ timeout: 15000 });
    await expectNoBlockingAxe(page);
  });

  test("tenant login has no critical or serious axe violations", async ({ page }) => {
    await page.goto("/tenant/login");
    await expect(page.getByRole("heading", { name: /welcome home/i })).toBeVisible({ timeout: 15000 });
    await expectNoBlockingAxe(page);
  });

  test("landlord login has no critical or serious axe violations", async ({ page }) => {
    await page.goto("/landlord/login");
    await expect(page.getByRole("heading", { name: /^sign in$/i })).toBeVisible({ timeout: 15000 });
    await expectNoBlockingAxe(page);
  });

  test("agency login has no critical or serious axe violations", async ({ page }) => {
    await page.goto("/agency/login");
    await expect(page.getByRole("heading", { name: /^sign in$/i })).toBeVisible({ timeout: 15000 });
    await expectNoBlockingAxe(page);
  });

  test("webhost login has no critical or serious axe violations", async ({ page }) => {
    await page.goto("/webhost/login");
    await expect(page.getByRole("heading", { name: /administrator login/i })).toBeVisible({ timeout: 15000 });
    await expectNoBlockingAxe(page);
  });

  test("homepage skip link moves keyboard focus to main content", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#main-content h1")).toBeVisible({ timeout: 15000 });
    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", { name: /skip to content/i });
    await expect(skip).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.locator("#main-content")).toBeFocused();
  });

  test("design preview dialog is labelled and has a close control", async ({ page }) => {
    await page.goto("/design-preview");
    await expect(page.getByRole("heading", { name: "CALQULUS design preview" })).toBeVisible({ timeout: 15000 });
    await page.getByRole("button", { name: "Dialogs" }).click();
    await page.getByRole("button", { name: /open dialog/i }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("heading")).toBeVisible();
    await expect(dialog.getByRole("button", { name: /close/i })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  });

  test("design preview tables expose column headers", async ({ page }) => {
    await page.goto("/design-preview");
    await expect(page.getByRole("heading", { name: "CALQULUS design preview" })).toBeVisible({ timeout: 15000 });
    await page.getByRole("button", { name: "Tables" }).click();
    const table = page.getByRole("table").first();
    await expect(table).toBeVisible();
    await expect(table.locator("th[scope='col']").first()).toBeVisible();
  });

  test("design preview desk chrome at 390px has skip link and no blocking axe", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/design-preview");
    await expect(page.getByRole("heading", { name: "CALQULUS design preview" })).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole("link", { name: /skip to main content/i })).toBeAttached();
    await expectNoBlockingAxe(page);
  });
});
