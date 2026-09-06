import { test, expect } from "@playwright/test";

const MANAGER_EMAIL = process.env.E2E_MANAGER_EMAIL || "";
const MANAGER_PASSWORD = process.env.E2E_MANAGER_PASSWORD || "";
const TENANT_EMAIL = process.env.E2E_TENANT_EMAIL || "";
const TENANT_PASSWORD = process.env.E2E_TENANT_PASSWORD || "";
const LANDLORD_EMAIL = process.env.E2E_LANDLORD_EMAIL || "";
const LANDLORD_PASSWORD = process.env.E2E_LANDLORD_PASSWORD || "";
const AGENCY_EMAIL = process.env.E2E_AGENCY_EMAIL || "";
const AGENCY_PASSWORD = process.env.E2E_AGENCY_PASSWORD || "";
const WEBHOST_EMAIL = process.env.E2E_WEBHOST_EMAIL || "";
const WEBHOST_PASSWORD = process.env.E2E_WEBHOST_PASSWORD || "";

test.describe("Major User Flows", () => {

  test.describe("Manager Flows", () => {
    test("manager can create a new property", async ({ page }) => {
      test.skip(!MANAGER_EMAIL || !MANAGER_PASSWORD, "Set E2E_MANAGER_EMAIL and E2E_MANAGER_PASSWORD");
      await page.goto("/auth");
      await page.fill("input[type='email']", MANAGER_EMAIL);
      await page.fill("input[type='password']", MANAGER_PASSWORD);
      await page.click("button:has-text('Sign In')");
      await expect(page).toHaveURL("/", { timeout: 15000 });
      
      // Navigate to properties
      await page.click("text=Properties");
      await expect(page.locator("text=Properties")).toBeVisible({ timeout: 10000 });
      
      // Click add property button
      await page.click("button:has-text('Add Property')");
      await expect(page.locator("text=Add Property")).toBeVisible({ timeout: 10000 });
      
      // Fill property form
      await page.fill("input[name='name']", "Test Property");
      await page.fill("input[name='address']", "123 Test Street");
      await page.selectOption("select[name='type']", "apartment");
      await page.fill("input[name='units']", "10");
      
      // Submit form
      await page.click("button:has-text('Save')");
      await expect(page.locator("text=Property created successfully")).toBeVisible({ timeout: 10000 });
    });

    test("manager can add a new tenant", async ({ page }) => {
      test.skip(!MANAGER_EMAIL || !MANAGER_PASSWORD, "Set E2E_MANAGER_EMAIL and E2E_MANAGER_PASSWORD");
      await page.goto("/auth");
      await page.fill("input[type='email']", MANAGER_EMAIL);
      await page.fill("input[type='password']", MANAGER_PASSWORD);
      await page.click("button:has-text('Sign In')");
      await expect(page).toHaveURL("/", { timeout: 15000 });
      
      // Navigate to tenants
      await page.click("text=Tenants");
      await expect(page.locator("text=Tenants")).toBeVisible({ timeout: 10000 });
      
      // Click add tenant button
      await page.click("button:has-text('Add Tenant')");
      await expect(page.locator("text=Add Tenant")).toBeVisible({ timeout: 10000 });
      
      // Fill tenant form
      await page.fill("input[name='name']", "Test Tenant");
      await page.fill("input[name='email']", "testtenant@example.com");
      await page.fill("input[name='phone']", "+254712345678");
      
      // Submit form
      await page.click("button:has-text('Save')");
      await expect(page.locator("text=Tenant added successfully")).toBeVisible({ timeout: 10000 });
    });

    test("manager can create a lease", async ({ page }) => {
      test.skip(!MANAGER_EMAIL || !MANAGER_PASSWORD, "Set E2E_MANAGER_EMAIL and E2E_MANAGER_PASSWORD");
      await page.goto("/auth");
      await page.fill("input[type='email']", MANAGER_EMAIL);
      await page.fill("input[type='password']", MANAGER_PASSWORD);
      await page.click("button:has-text('Sign In')");
      await expect(page).toHaveURL("/", { timeout: 15000 });
      
      // Navigate to leases
      await page.click("text=Leases");
      await expect(page.locator("text=Leases")).toBeVisible({ timeout: 10000 });
      
      // Click add lease button
      await page.click("button:has-text('Add Lease')");
      await expect(page.locator("text=Add Lease")).toBeVisible({ timeout: 10000 });
      
      // Fill lease form
      await page.selectOption("select[name='tenant']", "1");
      await page.selectOption("select[name='property']", "1");
      await page.selectOption("select[name='unit']", "1");
      await page.fill("input[name='start_date']", "2026-06-01");
      await page.fill("input[name='end_date']", "2027-05-31");
      await page.fill("input[name='rent_amount']", "15000");
      
      // Submit form
      await page.click("button:has-text('Save')");
      await expect(page.locator("text=Lease created successfully")).toBeVisible({ timeout: 10000 });
    });

    test("manager can view financial reports", async ({ page }) => {
      test.skip(!MANAGER_EMAIL || !MANAGER_PASSWORD, "Set E2E_MANAGER_EMAIL and E2E_MANAGER_PASSWORD");
      await page.goto("/auth");
      await page.fill("input[type='email']", MANAGER_EMAIL);
      await page.fill("input[type='password']", MANAGER_PASSWORD);
      await page.click("button:has-text('Sign In')");
      await expect(page).toHaveURL("/", { timeout: 15000 });
      
      // Navigate to reports
      await page.click("text=Reports");
      await expect(page.locator("text=Reports")).toBeVisible({ timeout: 10000 });
      
      // Verify financial reports are visible
      await expect(page.locator("text=Revenue")).toBeVisible({ timeout: 10000 });
      await expect(page.locator("text=Occupancy")).toBeVisible({ timeout: 10000 });
      await expect(page.locator("text=Payments")).toBeVisible({ timeout: 10000 });
    });

    test("manager can manage maintenance requests", async ({ page }) => {
      test.skip(!MANAGER_EMAIL || !MANAGER_PASSWORD, "Set E2E_MANAGER_EMAIL and E2E_MANAGER_PASSWORD");
      await page.goto("/auth");
      await page.fill("input[type='email']", MANAGER_EMAIL);
      await page.fill("input[type='password']", MANAGER_PASSWORD);
      await page.click("button:has-text('Sign In')");
      await expect(page).toHaveURL("/", { timeout: 15000 });
      
      // Navigate to maintenance
      await page.click("text=Maintenance");
      await expect(page.locator("text=Maintenance")).toBeVisible({ timeout: 10000 });
      
      // Click add maintenance request button
      await page.click("button:has-text('Add Request')");
      await expect(page.locator("text=Add Maintenance Request")).toBeVisible({ timeout: 10000 });
      
      // Fill maintenance form
      await page.selectOption("select[name='property']", "1");
      await page.selectOption("select[name='unit']", "1");
      await page.selectOption("select[name='category']", "plumbing");
      await page.fill("textarea[name='description']", "Leaking faucet in bathroom");
      await page.selectOption("select[name='priority']", "medium");
      
      // Submit form
      await page.click("button:has-text('Save')");
      await expect(page.locator("text=Maintenance request created successfully")).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe("Tenant Flows", () => {
    test("tenant can view lease information", async ({ page }) => {
      test.skip(!TENANT_EMAIL || !TENANT_PASSWORD, "Set E2E_TENANT_EMAIL and E2E_TENANT_PASSWORD");
      await page.goto("/tenant/login");
      await page.fill("input[type='email']", TENANT_EMAIL);
      await page.fill("input[type='password']", TENANT_PASSWORD);
      await page.click("button:has-text('Sign In')");
      await expect(page).toHaveURL(/\/portal/, { timeout: 15000 });
      
      // Navigate to lease
      await page.click("text=Lease");
      await expect(page.locator("text=Lease Information")).toBeVisible({ timeout: 10000 });
      
      // Verify lease details are visible
      await expect(page.locator("text=Property")).toBeVisible({ timeout: 10000 });
      await expect(page.locator("text=Unit")).toBeVisible({ timeout: 10000 });
      await expect(page.locator("text=Rent")).toBeVisible({ timeout: 10000 });
    });

    test("tenant can make a payment", async ({ page }) => {
      test.skip(!TENANT_EMAIL || !TENANT_PASSWORD, "Set E2E_TENANT_EMAIL and E2E_TENANT_PASSWORD");
      await page.goto("/tenant/login");
      await page.fill("input[type='email']", TENANT_EMAIL);
      await page.fill("input[type='password']", TENANT_PASSWORD);
      await page.click("button:has-text('Sign In')");
      await expect(page).toHaveURL(/\/portal/, { timeout: 15000 });
      
      // Navigate to payments
      await page.click("text=Payments");
      await expect(page.locator("text=Payments")).toBeVisible({ timeout: 10000 });
      
      // Click pay rent button
      await page.click("button:has-text('Pay Rent')");
      await expect(page.locator("text=Payment")).toBeVisible({ timeout: 10000 });
      
      // Select payment method
      await page.selectOption("select[name='payment_method']", "mpesa");
      await page.fill("input[name='amount']", "15000");
      await page.fill("input[name='phone_number']", "+254712345678");
      
      // Submit payment
      await page.click("button:has-text('Pay Now')");
      await expect(page.locator("text=Payment initiated successfully")).toBeVisible({ timeout: 10000 });
    });

    test("tenant can submit maintenance request", async ({ page }) => {
      test.skip(!TENANT_EMAIL || !TENANT_PASSWORD, "Set E2E_TENANT_EMAIL and E2E_TENANT_PASSWORD");
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
      
      // Fill form
      await page.selectOption("select[name='category']", "plumbing");
      await page.fill("textarea[name='description']", "Leaking faucet in bathroom");
      await page.selectOption("select[name='priority']", "medium");
      
      // Submit form
      await page.click("button:has-text('Submit')");
      await expect(page.locator("text=Maintenance request submitted successfully")).toBeVisible({ timeout: 10000 });
    });

    test("tenant can view payment history", async ({ page }) => {
      test.skip(!TENANT_EMAIL || !TENANT_PASSWORD, "Set E2E_TENANT_EMAIL and E2E_TENANT_PASSWORD");
      await page.goto("/tenant/login");
      await page.fill("input[type='email']", TENANT_EMAIL);
      await page.fill("input[type='password']", TENANT_PASSWORD);
      await page.click("button:has-text('Sign In')");
      await expect(page).toHaveURL(/\/portal/, { timeout: 15000 });
      
      // Navigate to payments
      await page.click("text=Payments");
      await expect(page.locator("text=Payments")).toBeVisible({ timeout: 10000 });
      
      // Verify payment history is visible
      await expect(page.locator("text=Payment History")).toBeVisible({ timeout: 10000 });
    });

    test("tenant can update profile", async ({ page }) => {
      test.skip(!TENANT_EMAIL || !TENANT_PASSWORD, "Set E2E_TENANT_EMAIL and E2E_TENANT_PASSWORD");
      await page.goto("/tenant/login");
      await page.fill("input[type='email']", TENANT_EMAIL);
      await page.fill("input[type='password']", TENANT_PASSWORD);
      await page.click("button:has-text('Sign In')");
      await expect(page).toHaveURL(/\/portal/, { timeout: 15000 });
      
      // Navigate to profile
      await page.click("text=Profile");
      await expect(page.locator("text=Profile")).toBeVisible({ timeout: 10000 });
      
      // Update profile
      await page.fill("input[name='phone']", "+254712345679");
      await page.click("button:has-text('Save')");
      await expect(page.locator("text=Profile updated successfully")).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe("Landlord Flows", () => {
    test("landlord can view revenue dashboard", async ({ page }) => {
      test.skip(!LANDLORD_EMAIL || !LANDLORD_PASSWORD, "Set E2E_LANDLORD_EMAIL and E2E_LANDLORD_PASSWORD");
      await page.goto("/landlord/login");
      await page.fill("input[type='email']", LANDLORD_EMAIL);
      await page.fill("input[type='password']", LANDLORD_PASSWORD);
      await page.click("button:has-text('Sign In')");
      await expect(page).toHaveURL(/\/landlord\/dashboard/, { timeout: 15000 });
      
      // Verify revenue dashboard is visible
      await expect(page.locator("text=Revenue")).toBeVisible({ timeout: 10000 });
      await expect(page.locator("text=Occupancy")).toBeVisible({ timeout: 10000 });
    });

    test("landlord can view property overview", async ({ page }) => {
      test.skip(!LANDLORD_EMAIL || !LANDLORD_PASSWORD, "Set E2E_LANDLORD_EMAIL and E2E_LANDLORD_PASSWORD");
      await page.goto("/landlord/login");
      await page.fill("input[type='email']", LANDLORD_EMAIL);
      await page.fill("input[type='password']", LANDLORD_PASSWORD);
      await page.click("button:has-text('Sign In')");
      await expect(page).toHaveURL(/\/landlord\/dashboard/, { timeout: 15000 });
      
      // Navigate to properties
      await page.click("text=Properties");
      await expect(page.locator("text=Properties")).toBeVisible({ timeout: 10000 });
    });

    test("landlord can request payout", async ({ page }) => {
      test.skip(!LANDLORD_EMAIL || !LANDLORD_PASSWORD, "Set E2E_LANDLORD_EMAIL and E2E_LANDLORD_PASSWORD");
      await page.goto("/landlord/login");
      await page.fill("input[type='email']", LANDLORD_EMAIL);
      await page.fill("input[type='password']", LANDLORD_PASSWORD);
      await page.click("button:has-text('Sign In')");
      await expect(page).toHaveURL(/\/landlord\/dashboard/, { timeout: 15000 });
      
      // Navigate to payouts
      await page.click("text=Payouts");
      await expect(page.locator("text=Payouts")).toBeVisible({ timeout: 10000 });
      
      // Click request payout button
      await page.click("button:has-text('Request Payout')");
      await expect(page.locator("text=Request Payout")).toBeVisible({ timeout: 10000 });
      
      // Fill payout form
      await page.fill("input[name='amount']", "50000");
      await page.fill("input[name='bank_account']", "1234567890");
      
      // Submit form
      await page.click("button:has-text('Submit')");
      await expect(page.locator("text=Payout request submitted successfully")).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe("Agency Flows", () => {
    test("agency can view multi-property dashboard", async ({ page }) => {
      test.skip(!AGENCY_EMAIL || !AGENCY_PASSWORD, "Set E2E_AGENCY_EMAIL and E2E_AGENCY_PASSWORD");
      await page.goto("/agency/login");
      await page.fill("input[type='email']", AGENCY_EMAIL);
      await page.fill("input[type='password']", AGENCY_PASSWORD);
      await page.click("button:has-text('Sign In')");
      await expect(page).toHaveURL(/\/agency/, { timeout: 15000 });
      
      // Verify dashboard is visible
      await expect(page.locator("text=Dashboard")).toBeVisible({ timeout: 10000 });
      await expect(page.locator("text=Properties")).toBeVisible({ timeout: 10000 });
      await expect(page.locator("text=Landlords")).toBeVisible({ timeout: 10000 });
    });

    test("agency can manage landlord relationships", async ({ page }) => {
      test.skip(!AGENCY_EMAIL || !AGENCY_PASSWORD, "Set E2E_AGENCY_EMAIL and E2E_AGENCY_PASSWORD");
      await page.goto("/agency/login");
      await page.fill("input[type='email']", AGENCY_EMAIL);
      await page.fill("input[type='password']", AGENCY_PASSWORD);
      await page.click("button:has-text('Sign In')");
      await expect(page).toHaveURL(/\/agency/, { timeout: 15000 });
      
      // Navigate to landlords
      await page.click("text=Landlords");
      await expect(page.locator("text=Landlords")).toBeVisible({ timeout: 10000 });
    });

    test("agency can view commission reports", async ({ page }) => {
      test.skip(!AGENCY_EMAIL || !AGENCY_PASSWORD, "Set E2E_AGENCY_EMAIL and E2E_AGENCY_PASSWORD");
      await page.goto("/agency/login");
      await page.fill("input[type='email']", AGENCY_EMAIL);
      await page.fill("input[type='password']", AGENCY_PASSWORD);
      await page.click("button:has-text('Sign In')");
      await expect(page).toHaveURL(/\/agency/, { timeout: 15000 });
      
      // Navigate to commission
      await page.click("text=Commission");
      await expect(page.locator("text=Commission")).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe("Webhost Flows", () => {
    test("webhost can view platform overview", async ({ page }) => {
      test.skip(!WEBHOST_EMAIL || !WEBHOST_PASSWORD, "Set E2E_WEBHOST_EMAIL and E2E_WEBHOST_PASSWORD");
      await page.goto("/webhost/login");
      await page.fill("input[type='email']", WEBHOST_EMAIL);
      await page.fill("input[type='password']", WEBHOST_PASSWORD);
      await page.click("button:has-text('Sign In')");
      await expect(page).toHaveURL(/\/webhost/, { timeout: 15000 });
      
      // Verify overview is visible
      await expect(page.locator("text=Overview")).toBeVisible({ timeout: 10000 });
    });

    test("webhost can manage managers", async ({ page }) => {
      test.skip(!WEBHOST_EMAIL || !WEBHOST_PASSWORD, "Set E2E_WEBHOST_EMAIL and E2E_WEBHOST_PASSWORD");
      await page.goto("/webhost/login");
      await page.fill("input[type='email']", WEBHOST_EMAIL);
      await page.fill("input[type='password']", WEBHOST_PASSWORD);
      await page.click("button:has-text('Sign In')");
      await expect(page).toHaveURL(/\/webhost/, { timeout: 15000 });
      
      // Navigate to managers
      await page.click("text=Managers");
      await expect(page.locator("text=Managers")).toBeVisible({ timeout: 10000 });
    });

    test("webhost can view compliance dashboard", async ({ page }) => {
      test.skip(!WEBHOST_EMAIL || !WEBHOST_PASSWORD, "Set E2E_WEBHOST_EMAIL and E2E_WEBHOST_PASSWORD");
      await page.goto("/webhost/login");
      await page.fill("input[type='email']", WEBHOST_EMAIL);
      await page.fill("input[type='password']", WEBHOST_PASSWORD);
      await page.click("button:has-text('Sign In')");
      await expect(page).toHaveURL(/\/webhost/, { timeout: 15000 });
      
      // Navigate to compliance
      await page.click("text=Compliance");
      await expect(page.locator("text=Compliance")).toBeVisible({ timeout: 10000 });
    });
  });
});
