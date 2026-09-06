import { test, expect, type Page } from "@playwright/test";

const VIEWPORTS = [
  { width: 1920, height: 1080 },
  { width: 1440, height: 900 },
  { width: 1280, height: 800 },
  { width: 1024, height: 768 },
  { width: 768, height: 1024 },
  { width: 480, height: 900 },
  { width: 390, height: 844 },
  { width: 360, height: 800 },
] as const;

const PREVIEW_SCREENS: { name: string; exact?: boolean; preview?: string }[] = [
  { name: "Manager" },
  { name: "Landlord", preview: "landlord-pages" },
  { name: "Agency", preview: "agency-pages" },
  { name: "Tenant", exact: true, preview: "tenant-pages" },
  { name: "Platform Admin", exact: true, preview: "admin-pages" },
  { name: "Login", preview: "login" },
  { name: "Maintenance", preview: "maintenance" },
  { name: "Reports", preview: "reports" },
  { name: "Tables", preview: "tables" },
  { name: "Forms", preview: "forms" },
  { name: "Dialogs", preview: "dialogs" },
];

const LOGIN_PATHS = [
  "/auth",
  "/tenant/login",
  "/landlord/login",
  "/agency/login",
  "/webhost/login",
] as const;

async function horizontalOverflow(page: Page) {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
}

async function openPreview(page: Page, name: string, exact?: boolean) {
  const nav = page.getByRole("navigation", { name: "Design preview screens" });
  await nav.getByRole("button", { name, exact: Boolean(exact) }).click();
}

test.describe("Phase 11 responsive certification", () => {
  test.describe.configure({ timeout: 90_000 });

  for (const viewport of VIEWPORTS) {
    test(`design preview portals do not overflow at ${viewport.width}px`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto("/design-preview");
      await expect(page.getByRole("heading", { name: "CALQULUS design preview" })).toBeVisible({ timeout: 15_000 });

      for (const screen of PREVIEW_SCREENS) {
        await openPreview(page, screen.name, screen.exact);
        if (screen.preview) {
          await expect(page.locator(`[data-preview='${screen.preview}']`)).toBeVisible();
        }

        const overflow = await horizontalOverflow(page);
        expect(overflow, `${screen.name} overflow at ${viewport.width}px`).toBeLessThanOrEqual(1);

        if (screen.name === "Tenant") {
          const tenant = page.locator("[data-preview='tenant-pages']");
          if (viewport.width <= 480) {
            const targets = await tenant.locator("nav a, nav button, a, button").evaluateAll((els) =>
              els.filter((el) => (el as HTMLElement).offsetParent !== null)
                .map((el) => el.getBoundingClientRect().height),
            );
            const undersized = targets.filter((h) => h > 0 && h < 44);
            expect(undersized, `Tenant touch targets under 44px: ${undersized}`).toEqual([]);
          }
          await expect(tenant.getByRole("button", { name: "Pay rent" }).first()).toBeVisible();
          await expect(tenant.getByText("KES 45,000").first()).toBeVisible();
          await expect(tenant.getByText("Due 5 Sep 2026").first()).toBeVisible();
          await expect(tenant.getByText("Lease", { exact: true }).first()).toBeVisible();
          await expect(tenant.getByText("Maintenance", { exact: true }).first()).toBeVisible();
          await expect(tenant.getByText("Receipts", { exact: true }).first()).toBeVisible();
          await expect(tenant.getByText("Documents", { exact: true }).first()).toBeVisible();
        }

        if (screen.name === "Maintenance") {
          await expect(page.getByText("Ridgeview · 2B")).toBeVisible();
          await expect(page.getByRole("tab", { name: "New" })).toBeVisible();
          await expect(page.getByRole("tab", { name: "Assigned" })).toBeVisible();
          await expect(page.getByRole("tab", { name: "In Progress" })).toBeVisible();
          await expect(page.getByRole("tab", { name: "Awaiting" })).toBeVisible();
          await expect(page.getByRole("tab", { name: "Completed" })).toBeVisible();
        }

        if (screen.name === "Reports") {
          await expect(page.getByLabel("Period")).toBeVisible();
          await expect(page.getByLabel("Property")).toBeVisible();
          await expect(page.getByLabel("Report type")).toBeVisible();
        }

        if (screen.name === "Forms") {
          await expect(page.getByLabel("Name")).toBeVisible();
          await expect(page.getByRole("button", { name: "Save" })).toBeVisible();
        }
      }
    });
  }

  test("dialogs stay inset on a 360px phone and keep their copy", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto("/design-preview");
    await expect(page.getByRole("heading", { name: "CALQULUS design preview" })).toBeVisible({ timeout: 15_000 });
    await openPreview(page, "Dialogs");
    await page.getByRole("button", { name: "Open dialog" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("Confirm action")).toBeVisible();
    await expect(dialog.getByText(/same radius, type, and navy overlay/i)).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Continue" })).toBeVisible();
    await expect.poll(async () => {
      return dialog.evaluate((el) => el.getBoundingClientRect().x);
    }, { timeout: 5_000 }).toBeGreaterThanOrEqual(8);
    const box = await dialog.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return { x: r.x, right: r.right, width: r.width };
    });
    expect(box.width, "dialog should be narrower than the viewport").toBeLessThanOrEqual(344);
    expect(box.right, "dialog should not kiss the right edge").toBeLessThanOrEqual(352);
  });

  for (const path of LOGIN_PATHS) {
    test(`${path} does not overflow at 360 / 480 / 768`, async ({ page }) => {
      for (const width of [360, 480, 768] as const) {
        await page.setViewportSize({ width, height: 800 });
        await page.goto(path);
        await expect(page.locator("input[type='email']").first()).toBeVisible({ timeout: 15_000 });
        const overflow = await horizontalOverflow(page);
        expect(overflow, `${path} overflow at ${width}px`).toBeLessThanOrEqual(1);
      }
    });
  }
});
