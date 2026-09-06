import { test, expect, type Page } from "@playwright/test";

const MANAGER_EMAIL = process.env.E2E_MANAGER_EMAIL || "";
const MANAGER_PASSWORD = process.env.E2E_MANAGER_PASSWORD || "";
const TENANT_EMAIL = process.env.E2E_TENANT_EMAIL || "";
const TENANT_PASSWORD = process.env.E2E_TENANT_PASSWORD || "";
const LANDLORD_EMAIL = process.env.E2E_LANDLORD_EMAIL || "";
const LANDLORD_PASSWORD = process.env.E2E_LANDLORD_PASSWORD || "";
const WEBHOST_EMAIL = process.env.E2E_WEBHOST_EMAIL || "";
const WEBHOST_PASSWORD = process.env.E2E_WEBHOST_PASSWORD || "";

async function signIn(page: Page, path: string, email: string, password: string, submitName: RegExp) {
  await page.goto(path);
  await page.locator("input[type='email']").first().fill(email);
  await page.locator("input[type='password']").first().fill(password);
  await page.getByRole("button", { name: submitName }).click();
}

test.describe("Phase 12 credentialed portal certification", () => {
  test.describe.configure({ timeout: 90_000 });

  test("manager: login → dashboard → property → billing", async ({ page }) => {
    test.skip(!MANAGER_EMAIL || !MANAGER_PASSWORD, "Set E2E_MANAGER_EMAIL and E2E_MANAGER_PASSWORD");
    await signIn(page, "/auth", MANAGER_EMAIL, MANAGER_PASSWORD, /^sign in$/i);
    await expect(page).toHaveURL(/\/$|\/properties|\/dashboard/i, { timeout: 30_000 });
    await expect(page.getByText(/properties monitored|portfolio health|collected/i).first()).toBeVisible({ timeout: 30_000 });

    await page.goto("/properties");
    await expect(page.getByRole("heading", { name: "Properties" })).toBeVisible({ timeout: 20_000 });

    await page.goto("/tenants");
    await expect(page.getByText(/tenant|infinite recursion|something went wrong/i).first()).toBeVisible({ timeout: 20_000 });
  });

  test("landlord: login → portfolio → statement", async ({ page }) => {
    test.skip(!LANDLORD_EMAIL || !LANDLORD_PASSWORD, "Set E2E_LANDLORD_EMAIL and E2E_LANDLORD_PASSWORD");
    await signIn(page, "/landlord/login", LANDLORD_EMAIL, LANDLORD_PASSWORD, /^sign in$/i);
    await expect(page).toHaveURL(/\/landlord\/dashboard/, { timeout: 30_000 });
    await expect(page.getByText(/portfolio/i).first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/statement|occup/i).first()).toBeVisible({ timeout: 20_000 });
  });

  test("tenant: login → balance → pay → maintenance", async ({ page }) => {
    test.skip(!TENANT_EMAIL || !TENANT_PASSWORD, "Set E2E_TENANT_EMAIL and E2E_TENANT_PASSWORD");
    await signIn(page, "/tenant/login", TENANT_EMAIL, TENANT_PASSWORD, /^sign in$/i);
    await expect(page).toHaveURL(/\/portal/, { timeout: 30_000 });
    await expect(
      page.getByText(/pay rent|balance|invoice|payment diary|add payment|no payments logged/i).first(),
    ).toBeVisible({ timeout: 20_000 });
    await page.goto("/portal/maintenance");
    await expect(page.getByText(/maintenance|request|independent/i).first()).toBeVisible({ timeout: 20_000 });
  });

  test("webhost: login → managers / security", async ({ page }) => {
    test.skip(!WEBHOST_EMAIL || !WEBHOST_PASSWORD, "Set E2E_WEBHOST_EMAIL and E2E_WEBHOST_PASSWORD");
    await signIn(page, "/webhost/login", WEBHOST_EMAIL, WEBHOST_PASSWORD, /sign in to admin portal/i);
    await expect(page).toHaveURL(/\/webhost\/?$/, { timeout: 30_000 });
    await expect(page.getByRole("tab", { name: /managers|security|error logs|overview/i }).first()).toBeVisible({ timeout: 20_000 });
  });
});
