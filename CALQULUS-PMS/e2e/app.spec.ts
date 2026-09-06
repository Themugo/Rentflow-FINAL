import { test, expect } from "@playwright/test";

// ── Credential-dependent tests ─────────────────────────────────────
// When you have fresh accounts ready, set these env vars and this file
// will automatically include login + portal + payment tests.
//
//   E2E_MANAGER_EMAIL    E2E_MANAGER_PASSWORD
//   E2E_TENANT_EMAIL     E2E_TENANT_PASSWORD
//
// We keep the env-var plumbing in place so nothing needs changing later.

const MANAGER_EMAIL = process.env.E2E_MANAGER_EMAIL || "";
const MANAGER_PASSWORD = process.env.E2E_MANAGER_PASSWORD || "";
const TENANT_EMAIL = process.env.E2E_TENANT_EMAIL || "";
const TENANT_PASSWORD = process.env.E2E_TENANT_PASSWORD || "";

test.describe("CALQULUS PMS E2E Tests", () => {

  test.describe("Public pages", () => {
    test("public homepage presents CALQULUS", async ({ page }) => {
      await page.goto("/");
      await expect(page.locator("#main-content h1")).toContainText("clarity and control", { timeout: 15000 });
    });

    test("auth page loads login form", async ({ page }) => {
      await page.goto("/auth");
      await expect(page.getByRole("heading", { name: /^sign in$/i })).toBeVisible({ timeout: 15000 });
      await expect(page.locator("#login-email")).toBeVisible();
      await expect(page.locator("#login-password")).toBeVisible();
    });

    test("tenant login page loads", async ({ page }) => {
      await page.goto("/tenant/login");
      await expect(page.getByRole("heading", { name: /your home, connected/i })).toBeVisible({
        timeout: 15000,
      });
      await expect(page.locator("#email")).toBeVisible();
    });

    test("reset password page loads", async ({ page }) => {
      await page.goto("/reset-password");
      await expect(page.getByText(/Reset Password|Link Expired/)).toBeVisible({ timeout: 15000 });
    });
  });

  test.describe("Navigation", () => {
    test("landlord login page loads", async ({ page }) => {
      await page.goto("/landlord/login");
      await expect(page).toHaveURL(/\/landlord\/login/);
      await expect(page.getByRole("heading", { name: /how are my properties performing/i })).toBeVisible({
        timeout: 15000,
      });
      await expect(page.locator("#email")).toBeVisible();
    });

    test("legal page loads", async ({ page }) => {
      await page.goto("/legal");
      await expect(page.locator("body")).toBeVisible();
    });
  });

  test.describe("Auth flows (requires E2E_* env vars)", () => {
    test("login with invalid credentials shows error", async ({ page }) => {
      test.skip(!MANAGER_EMAIL, "Set E2E_MANAGER_EMAIL");
      await page.goto("/auth");
      await page.fill("input[type='email']", "invalid@example.com");
      await page.fill("input[type='password']", "wrongpassword");
      await page.click("button:has-text('Sign In')");
      await expect(page.locator("text=Invalid login credentials")).toBeVisible({ timeout: 15000 });
    });

    test("manager can sign in and reach dashboard", async ({ page }) => {
      test.skip(!MANAGER_EMAIL || !MANAGER_PASSWORD, "Set E2E_MANAGER_EMAIL and E2E_MANAGER_PASSWORD");
      await page.goto("/auth");
      await page.fill("input[type='email']", MANAGER_EMAIL);
      await page.fill("input[type='password']", MANAGER_PASSWORD);
      await page.click("button:has-text('Sign In')");
      await expect(page).toHaveURL("/", { timeout: 15000 });
      await expect(page.locator("text=Dashboard")).toBeVisible({ timeout: 10000 });
    });

    test("manager dashboard shows key metrics", async ({ page }) => {
      test.skip(!MANAGER_EMAIL || !MANAGER_PASSWORD, "Set E2E_MANAGER_EMAIL and E2E_MANAGER_PASSWORD");
      await page.goto("/auth");
      await page.fill("input[type='email']", MANAGER_EMAIL);
      await page.fill("input[type='password']", MANAGER_PASSWORD);
      await page.click("button:has-text('Sign In')");
      await expect(page).toHaveURL("/", { timeout: 15000 });
      await expect(page.locator("text=Properties").or(page.locator("text=Tenants"))).toBeVisible({ timeout: 10000 });
    });

    test("tenant can sign in and view portal", async ({ page }) => {
      test.skip(!TENANT_EMAIL || !TENANT_PASSWORD, "Set E2E_TENANT_EMAIL and E2E_TENANT_PASSWORD");
      await page.goto("/tenant/login");
      await page.fill("input[type='email']", TENANT_EMAIL);
      await page.fill("input[type='password']", TENANT_PASSWORD);
      await page.click("button:has-text('Sign In')");
      await expect(page).toHaveURL(/\/portal/, { timeout: 15000 });
      await expect(page.locator("text=Dashboard").or(page.locator("text=Home"))).toBeVisible({ timeout: 10000 });
    });

    test("tenant can navigate to payments page", async ({ page }) => {
      test.skip(!TENANT_EMAIL || !TENANT_PASSWORD, "Set E2E_TENANT_EMAIL and E2E_TENANT_PASSWORD");
      await page.goto("/tenant/login");
      await page.fill("input[type='email']", TENANT_EMAIL);
      await page.fill("input[type='password']", TENANT_PASSWORD);
      await page.click("button:has-text('Sign In')");
      await expect(page).toHaveURL(/\/portal/, { timeout: 15000 });
      await page.goto("/portal/payments");
      await expect(page.locator("text=Payment").or(page.locator("text=Billing"))).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe("Responsive design", () => {
    test("mobile viewport renders correctly", async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto("/auth");
      await expect(page.locator("input[type='email']")).toBeVisible({ timeout: 15000 });
    });

    test("tablet viewport renders correctly", async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.goto("/auth");
      await expect(page.locator("input[type='email']")).toBeVisible({ timeout: 15000 });
    });
  });

  test.describe("404 handling", () => {
    test("unknown public route returns to the homepage", async ({ page }) => {
      await page.goto("/this-page-does-not-exist");
      await expect(page).toHaveURL(/\/$/, { timeout: 15000 });
      await expect(page.locator("#main-content h1")).toContainText("clarity and control", { timeout: 15000 });
    });
  });
});
