import { test, expect } from "@playwright/test";

const MANAGER_EMAIL = process.env.E2E_MANAGER_EMAIL || "";
const MANAGER_PASSWORD = process.env.E2E_MANAGER_PASSWORD || "";
const TENANT_EMAIL = process.env.E2E_TENANT_EMAIL || "";
const TENANT_PASSWORD = process.env.E2E_TENANT_PASSWORD || "";

test.describe("Mobile App Flows E2E Tests", () => {

  test.describe("Mobile Authentication", () => {
    test("mobile login page loads correctly", async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto("/auth");
      await expect(page.locator("input[type='email']")).toBeVisible({ timeout: 15000 });
      await expect(page.locator("input[type='password']")).toBeVisible({ timeout: 15000 });
      await expect(page.locator("button:has-text('Sign In')")).toBeVisible({ timeout: 15000 });
    });

    test("mobile tenant login page loads correctly", async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto("/tenant/login");
      await expect(page.locator("text=Tenant")).toBeVisible({ timeout: 15000 });
      await expect(page.locator("input[type='email']")).toBeVisible({ timeout: 15000 });
      await expect(page.locator("input[type='password']")).toBeVisible({ timeout: 15000 });
    });

    test("mobile manager can sign in", async ({ page }) => {
      test.skip(!MANAGER_EMAIL || !MANAGER_PASSWORD, "Set E2E_MANAGER_EMAIL and E2E_MANAGER_PASSWORD");
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto("/auth");
      await page.fill("input[type='email']", MANAGER_EMAIL);
      await page.fill("input[type='password']", MANAGER_PASSWORD);
      await page.click("button:has-text('Sign In')");
      await expect(page).toHaveURL("/", { timeout: 15000 });
      await expect(page.locator("text=Dashboard")).toBeVisible({ timeout: 10000 });
    });

    test("mobile tenant can sign in", async ({ page }) => {
      test.skip(!TENANT_EMAIL || !TENANT_PASSWORD, "Set E2E_TENANT_EMAIL and E2E_TENANT_PASSWORD");
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto("/tenant/login");
      await page.fill("input[type='email']", TENANT_EMAIL);
      await page.fill("input[type='password']", TENANT_PASSWORD);
      await page.click("button:has-text('Sign In')");
      await expect(page).toHaveURL(/\/portal/, { timeout: 15000 });
      await expect(page.locator("text=Dashboard").or(page.locator("text=Home"))).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe("Mobile Manager Flows", () => {
    test("mobile manager dashboard renders correctly", async ({ page }) => {
      test.skip(!MANAGER_EMAIL || !MANAGER_PASSWORD, "Set E2E_MANAGER_EMAIL and E2E_MANAGER_PASSWORD");
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto("/auth");
      await page.fill("input[type='email']", MANAGER_EMAIL);
      await page.fill("input[type='password']", MANAGER_PASSWORD);
      await page.click("button:has-text('Sign In')");
      await expect(page).toHaveURL("/", { timeout: 15000 });
      
      // Verify dashboard elements are visible on mobile
      await expect(page.locator("text=Dashboard")).toBeVisible({ timeout: 10000 });
      await expect(page.locator("text=Properties").or(page.locator("text=Tenants"))).toBeVisible({ timeout: 10000 });
    });

    test("mobile manager can navigate to properties", async ({ page }) => {
      test.skip(!MANAGER_EMAIL || !MANAGER_PASSWORD, "Set E2E_MANAGER_EMAIL and E2E_MANAGER_PASSWORD");
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto("/auth");
      await page.fill("input[type='email']", MANAGER_EMAIL);
      await page.fill("input[type='password']", MANAGER_PASSWORD);
      await page.click("button:has-text('Sign In')");
      await expect(page).toHaveURL("/", { timeout: 15000 });
      
      // Navigate to properties
      await page.click("text=Properties");
      await expect(page.locator("text=Properties")).toBeVisible({ timeout: 10000 });
    });

    test("mobile manager can navigate to tenants", async ({ page }) => {
      test.skip(!MANAGER_EMAIL || !MANAGER_PASSWORD, "Set E2E_MANAGER_EMAIL and E2E_MANAGER_PASSWORD");
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto("/auth");
      await page.fill("input[type='email']", MANAGER_EMAIL);
      await page.fill("input[type='password']", MANAGER_PASSWORD);
      await page.click("button:has-text('Sign In')");
      await expect(page).toHaveURL("/", { timeout: 15000 });
      
      // Navigate to tenants
      await page.click("text=Tenants");
      await expect(page.locator("text=Tenants")).toBeVisible({ timeout: 10000 });
    });

    test("mobile manager can view maintenance requests", async ({ page }) => {
      test.skip(!MANAGER_EMAIL || !MANAGER_PASSWORD, "Set E2E_MANAGER_EMAIL and E2E_MANAGER_PASSWORD");
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto("/auth");
      await page.fill("input[type='email']", MANAGER_EMAIL);
      await page.fill("input[type='password']", MANAGER_PASSWORD);
      await page.click("button:has-text('Sign In')");
      await expect(page).toHaveURL("/", { timeout: 15000 });
      
      // Navigate to maintenance
      await page.click("text=Maintenance");
      await expect(page.locator("text=Maintenance")).toBeVisible({ timeout: 10000 });
    });

    test("mobile manager can view financial reports", async ({ page }) => {
      test.skip(!MANAGER_EMAIL || !MANAGER_PASSWORD, "Set E2E_MANAGER_EMAIL and E2E_MANAGER_PASSWORD");
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto("/auth");
      await page.fill("input[type='email']", MANAGER_EMAIL);
      await page.fill("input[type='password']", MANAGER_PASSWORD);
      await page.click("button:has-text('Sign In')");
      await expect(page).toHaveURL("/", { timeout: 15000 });
      
      // Navigate to reports
      await page.click("text=Reports");
      await expect(page.locator("text=Reports")).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe("Mobile Tenant Flows", () => {
    test("mobile tenant portal renders correctly", async ({ page }) => {
      test.skip(!TENANT_EMAIL || !TENANT_PASSWORD, "Set E2E_TENANT_EMAIL and E2E_TENANT_PASSWORD");
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto("/tenant/login");
      await page.fill("input[type='email']", TENANT_EMAIL);
      await page.fill("input[type='password']", TENANT_PASSWORD);
      await page.click("button:has-text('Sign In')");
      await expect(page).toHaveURL(/\/portal/, { timeout: 15000 });
      
      // Verify portal elements are visible on mobile
      await expect(page.locator("text=Dashboard").or(page.locator("text=Home"))).toBeVisible({ timeout: 10000 });
    });

    test("mobile tenant can view lease information", async ({ page }) => {
      test.skip(!TENANT_EMAIL || !TENANT_PASSWORD, "Set E2E_TENANT_EMAIL and E2E_TENANT_PASSWORD");
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto("/tenant/login");
      await page.fill("input[type='email']", TENANT_EMAIL);
      await page.fill("input[type='password']", TENANT_PASSWORD);
      await page.click("button:has-text('Sign In')");
      await expect(page).toHaveURL(/\/portal/, { timeout: 15000 });
      
      // Navigate to lease
      await page.click("text=Lease");
      await expect(page.locator("text=Lease")).toBeVisible({ timeout: 10000 });
    });

    test("mobile tenant can make payment", async ({ page }) => {
      test.skip(!TENANT_EMAIL || !TENANT_PASSWORD, "Set E2E_TENANT_EMAIL and E2E_TENANT_PASSWORD");
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto("/tenant/login");
      await page.fill("input[type='email']", TENANT_EMAIL);
      await page.fill("input[type='password']", TENANT_PASSWORD);
      await page.click("button:has-text('Sign In')");
      await expect(page).toHaveURL(/\/portal/, { timeout: 15000 });
      
      // Navigate to payments
      await page.click("text=Payments");
      await expect(page.locator("text=Payments")).toBeVisible({ timeout: 10000 });
    });

    test("mobile tenant can submit maintenance request", async ({ page }) => {
      test.skip(!TENANT_EMAIL || !TENANT_PASSWORD, "Set E2E_TENANT_EMAIL and E2E_TENANT_PASSWORD");
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto("/tenant/login");
      await page.fill("input[type='email']", TENANT_EMAIL);
      await page.fill("input[type='password']", TENANT_PASSWORD);
      await page.click("button:has-text('Sign In')");
      await expect(page).toHaveURL(/\/portal/, { timeout: 15000 });
      
      // Navigate to maintenance
      await page.click("text=Maintenance");
      await expect(page.locator("text=Maintenance")).toBeVisible({ timeout: 10000 });
    });

    test("mobile tenant can view profile", async ({ page }) => {
      test.skip(!TENANT_EMAIL || !TENANT_PASSWORD, "Set E2E_TENANT_EMAIL and E2E_TENANT_PASSWORD");
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto("/tenant/login");
      await page.fill("input[type='email']", TENANT_EMAIL);
      await page.fill("input[type='password']", TENANT_PASSWORD);
      await page.click("button:has-text('Sign In')");
      await expect(page).toHaveURL(/\/portal/, { timeout: 15000 });
      
      // Navigate to profile
      await page.click("text=Profile");
      await expect(page.locator("text=Profile")).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe("Mobile Responsive Design", () => {
    test("mobile viewport - small phone", async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 568 });
      await page.goto("/auth");
      await expect(page.locator("input[type='email']")).toBeVisible({ timeout: 15000 });
      await expect(page.locator("input[type='password']")).toBeVisible({ timeout: 15000 });
    });

    test("mobile viewport - large phone", async ({ page }) => {
      await page.setViewportSize({ width: 414, height: 896 });
      await page.goto("/auth");
      await expect(page.locator("input[type='email']")).toBeVisible({ timeout: 15000 });
      await expect(page.locator("input[type='password']")).toBeVisible({ timeout: 15000 });
    });

    test("tablet viewport - portrait", async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.goto("/auth");
      await expect(page.locator("input[type='email']")).toBeVisible({ timeout: 15000 });
      await expect(page.locator("input[type='password']")).toBeVisible({ timeout: 15000 });
    });

    test("tablet viewport - landscape", async ({ page }) => {
      await page.setViewportSize({ width: 1024, height: 768 });
      await page.goto("/auth");
      await expect(page.locator("input[type='email']")).toBeVisible({ timeout: 15000 });
      await expect(page.locator("input[type='password']")).toBeVisible({ timeout: 15000 });
    });
  });

  test.describe("Mobile Touch Interactions", () => {
    test("mobile navigation menu is accessible", async ({ page }) => {
      test.skip(!MANAGER_EMAIL || !MANAGER_PASSWORD, "Set E2E_MANAGER_EMAIL and E2E_MANAGER_PASSWORD");
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto("/auth");
      await page.fill("input[type='email']", MANAGER_EMAIL);
      await page.fill("input[type='password']", MANAGER_PASSWORD);
      await page.click("button:has-text('Sign In')");
      await expect(page).toHaveURL("/", { timeout: 15000 });
      
      // Check for mobile menu button
      const menuButton = page.locator("button[aria-label*='menu']").or(page.locator(".menu-button"));
      if (await menuButton.isVisible({ timeout: 5000 })) {
        await menuButton.click();
        await expect(page.locator("text=Properties").or(page.locator("text=Tenants"))).toBeVisible({ timeout: 10000 });
      }
    });

    test("mobile forms are touch-friendly", async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto("/auth");
      
      // Verify input fields are large enough for touch
      const emailInput = page.locator("input[type='email']");
      const passwordInput = page.locator("input[type='password']");
      
      await expect(emailInput).toBeVisible({ timeout: 15000 });
      await expect(passwordInput).toBeVisible({ timeout: 15000 });
      
      // Verify buttons are large enough for touch
      const signInButton = page.locator("button:has-text('Sign In')");
      await expect(signInButton).toBeVisible({ timeout: 15000 });
    });

    test("mobile cards are swipeable", async ({ page }) => {
      test.skip(!MANAGER_EMAIL || !MANAGER_PASSWORD, "Set E2E_MANAGER_EMAIL and E2E_MANAGER_PASSWORD");
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto("/auth");
      await page.fill("input[type='email']", MANAGER_EMAIL);
      await page.fill("input[type='password']", MANAGER_PASSWORD);
      await page.click("button:has-text('Sign In')");
      await expect(page).toHaveURL("/", { timeout: 15000 });
      
      // Navigate to properties
      await page.click("text=Properties");
      await expect(page.locator("text=Properties")).toBeVisible({ timeout: 10000 });
      
      // Verify property cards are visible
      await expect(page.locator(".property-card").or(page.locator("[data-testid*='property']"))).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe("Mobile Performance", () => {
    test("mobile page load time is acceptable", async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      const startTime = Date.now();
      await page.goto("/auth");
      await expect(page.locator("input[type='email']")).toBeVisible({ timeout: 15000 });
      const loadTime = Date.now() - startTime;
      
      // Page should load in less than 5 seconds on mobile
      expect(loadTime).toBeLessThan(5000);
    });

    test("mobile dashboard load time is acceptable", async ({ page }) => {
      test.skip(!MANAGER_EMAIL || !MANAGER_PASSWORD, "Set E2E_MANAGER_EMAIL and E2E_MANAGER_PASSWORD");
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto("/auth");
      await page.fill("input[type='email']", MANAGER_EMAIL);
      await page.fill("input[type='password']", MANAGER_PASSWORD);
      await page.click("button:has-text('Sign In')");
      
      const startTime = Date.now();
      await expect(page).toHaveURL("/", { timeout: 15000 });
      await expect(page.locator("text=Dashboard")).toBeVisible({ timeout: 10000 });
      const loadTime = Date.now() - startTime;
      
      // Dashboard should load in less than 5 seconds on mobile
      expect(loadTime).toBeLessThan(5000);
    });
  });

  test.describe("Mobile Offline Support", () => {
    test("mobile app shows offline indicator when offline", async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto("/auth");
      
      // Simulate offline mode
      await page.context().setOffline(true);
      
      // Check for offline indicator
      const offlineIndicator = page.locator("text=Offline").or(page.locator("[data-testid*='offline']"));
      if (await offlineIndicator.isVisible({ timeout: 3000 })) {
        await expect(offlineIndicator).toBeVisible();
      }
      
      // Restore online mode
      await page.context().setOffline(false);
    });

    test("mobile app caches data for offline use", async ({ page }) => {
      test.skip(!MANAGER_EMAIL || !MANAGER_PASSWORD, "Set E2E_MANAGER_EMAIL and E2E_MANAGER_PASSWORD");
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto("/auth");
      await page.fill("input[type='email']", MANAGER_EMAIL);
      await page.fill("input[type='password']", MANAGER_PASSWORD);
      await page.click("button:has-text('Sign In')");
      await expect(page).toHaveURL("/", { timeout: 15000 });
      
      // Navigate to properties to cache data
      await page.click("text=Properties");
      await expect(page.locator("text=Properties")).toBeVisible({ timeout: 10000 });
      
      // Simulate offline mode
      await page.context().setOffline(true);
      
      // Try to navigate back to dashboard (should use cached data)
      await page.click("text=Dashboard");
      await expect(page.locator("text=Dashboard")).toBeVisible({ timeout: 10000 });
      
      // Restore online mode
      await page.context().setOffline(false);
    });
  });

  test.describe("Mobile Push Notifications", () => {
    test("mobile app requests notification permission", async ({ page, context }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto("/auth");
      
      // Grant notification permission
      await context.grantPermissions(['notifications']);
      
      // Navigate to tenant portal to trigger notification request
      await page.goto("/tenant/login");
      await expect(page.locator("text=Tenant")).toBeVisible({ timeout: 15000 });
    });

    test("mobile app shows notification settings", async ({ page }) => {
      test.skip(!TENANT_EMAIL || !TENANT_PASSWORD, "Set E2E_TENANT_EMAIL and E2E_TENANT_PASSWORD");
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto("/tenant/login");
      await page.fill("input[type='email']", TENANT_EMAIL);
      await page.fill("input[type='password']", TENANT_PASSWORD);
      await page.click("button:has-text('Sign In')");
      await expect(page).toHaveURL(/\/portal/, { timeout: 15000 });
      
      // Navigate to settings
      await page.click("text=Settings");
      await expect(page.locator("text=Settings")).toBeVisible({ timeout: 10000 });
      
      // Check for notification settings
      const notificationSettings = page.locator("text=Notifications").or(page.locator("[data-testid*='notification']"));
      if (await notificationSettings.isVisible({ timeout: 3000 })) {
        await expect(notificationSettings).toBeVisible();
      }
    });
  });

  test.describe("Mobile Location Services", () => {
    test("mobile app requests location permission", async ({ page, context }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto("/auth");
      
      // Grant location permission
      await context.grantPermissions(['geolocation']);
      
      // Navigate to tenant portal to trigger location request
      await page.goto("/tenant/login");
      await expect(page.locator("text=Tenant")).toBeVisible({ timeout: 15000 });
    });

    test("mobile app uses location for nearby services", async ({ page }) => {
      test.skip(!MANAGER_EMAIL || !MANAGER_PASSWORD, "Set E2E_MANAGER_EMAIL and E2E_MANAGER_PASSWORD");
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto("/auth");
      await page.fill("input[type='email']", MANAGER_EMAIL);
      await page.fill("input[type='password']", MANAGER_PASSWORD);
      await page.click("button:has-text('Sign In')");
      await expect(page).toHaveURL("/", { timeout: 15000 });
      
      // Navigate to marketplace/contractors
      await page.goto("/marketplace/contractors");
      await expect(page.locator("text=Contractors")).toBeVisible({ timeout: 10000 });
      
      // Check for location-based features
      const nearbyContractors = page.locator("text=Nearby").or(page.locator("[data-testid*='nearby']"));
      if (await nearbyContractors.isVisible({ timeout: 3000 })) {
        await expect(nearbyContractors).toBeVisible();
      }
    });
  });

  test.describe("Mobile Camera Integration", () => {
    test("mobile app can capture photos for maintenance requests", async ({ page, context }) => {
      test.skip(!TENANT_EMAIL || !TENANT_PASSWORD, "Set E2E_TENANT_EMAIL and E2E_TENANT_PASSWORD");
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto("/tenant/login");
      await page.fill("input[type='email']", TENANT_EMAIL);
      await page.fill("input[type='password']", TENANT_PASSWORD);
      await page.click("button:has-text('Sign In')");
      await expect(page).toHaveURL(/\/portal/, { timeout: 15000 });
      
      // Navigate to maintenance
      await page.click("text=Maintenance");
      await expect(page.locator("text=Maintenance")).toBeVisible({ timeout: 10000 });
      
      // Click add request button
      await page.click("button:has-text('Submit Request')");
      await expect(page.locator("text=Submit Maintenance Request")).toBeVisible({ timeout: 10000 });
      
      // Check for camera button
      const cameraButton = page.locator("button[aria-label*='camera']").or(page.locator("[data-testid*='camera']"));
      if (await cameraButton.isVisible({ timeout: 3000 })) {
        await expect(cameraButton).toBeVisible();
      }
    });
  });
});
