import { test, expect } from "@playwright/test";

const MANAGER_EMAIL = process.env.E2E_MANAGER_EMAIL || "";
const MANAGER_PASSWORD = process.env.E2E_MANAGER_PASSWORD || "";

test.describe("Marketplace Features E2E Tests", () => {

  test.describe("Contractor Network", () => {
    test("manager can view contractor network", async ({ page }) => {
      test.skip(!MANAGER_EMAIL || !MANAGER_PASSWORD, "Set E2E_MANAGER_EMAIL and E2E_MANAGER_PASSWORD");
      await page.goto("/auth");
      await page.fill("input[type='email']", MANAGER_EMAIL);
      await page.fill("input[type='password']", MANAGER_PASSWORD);
      await page.click("button:has-text('Sign In')");
      await expect(page).toHaveURL("/", { timeout: 15000 });
      
      // Navigate to marketplace/contractors
      await page.goto("/marketplace/contractors");
      await expect(page.locator("text=Contractors")).toBeVisible({ timeout: 10000 });
    });

    test("manager can search for contractors", async ({ page }) => {
      test.skip(!MANAGER_EMAIL || !MANAGER_PASSWORD, "Set E2E_MANAGER_EMAIL and E2E_MANAGER_PASSWORD");
      await page.goto("/auth");
      await page.fill("input[type='email']", MANAGER_EMAIL);
      await page.fill("input[type='password']", MANAGER_PASSWORD);
      await page.click("button:has-text('Sign In')");
      await expect(page).toHaveURL("/", { timeout: 15000 });
      
      // Navigate to marketplace/contractors
      await page.goto("/marketplace/contractors");
      await expect(page.locator("text=Contractors")).toBeVisible({ timeout: 10000 });
      
      // Search for contractor
      await page.fill("input[placeholder*='search']", "plumbing");
      await page.press("input[placeholder*='search']", "Enter");
      await expect(page.locator("text=Contractors")).toBeVisible({ timeout: 10000 });
    });

    test("manager can view contractor profile", async ({ page }) => {
      test.skip(!MANAGER_EMAIL || !MANAGER_PASSWORD, "Set E2E_MANAGER_EMAIL and E2E_MANAGER_PASSWORD");
      await page.goto("/auth");
      await page.fill("input[type='email']", MANAGER_EMAIL);
      await page.fill("input[type='password']", MANAGER_PASSWORD);
      await page.click("button:has-text('Sign In')");
      await expect(page).toHaveURL("/", { timeout: 15000 });
      
      // Navigate to marketplace/contractors
      await page.goto("/marketplace/contractors");
      await expect(page.locator("text=Contractors")).toBeVisible({ timeout: 10000 });
      
      // Click on first contractor
      await page.click(".contractor-card:first-child");
      await expect(page.locator("text=Contractor Profile")).toBeVisible({ timeout: 10000 });
    });

    test("manager can create work order", async ({ page }) => {
      test.skip(!MANAGER_EMAIL || !MANAGER_PASSWORD, "Set E2E_MANAGER_EMAIL and E2E_MANAGER_PASSWORD");
      await page.goto("/auth");
      await page.fill("input[type='email']", MANAGER_EMAIL);
      await page.fill("input[type='password']", MANAGER_PASSWORD);
      await page.click("button:has-text('Sign In')");
      await expect(page).toHaveURL("/", { timeout: 15000 });
      
      // Navigate to marketplace/contractors
      await page.goto("/marketplace/contractors");
      await expect(page.locator("text=Contractors")).toBeVisible({ timeout: 10000 });
      
      // Click on first contractor
      await page.click(".contractor-card:first-child");
      await expect(page.locator("text=Contractor Profile")).toBeVisible({ timeout: 10000 });
      
      // Click create work order
      await page.click("button:has-text('Create Work Order')");
      await expect(page.locator("text=Create Work Order")).toBeVisible({ timeout: 10000 });
      
      // Fill work order form
      await page.selectOption("select[name='property']", "1");
      await page.selectOption("select[name='unit']", "1");
      await page.fill("textarea[name='description']", "Repair leaking faucet");
      await page.fill("input[name='budget']", "5000");
      
      // Submit work order
      await page.click("button:has-text('Submit')");
      await expect(page.locator("text=Work order created successfully")).toBeVisible({ timeout: 10000 });
    });

    test("manager can view contractor performance", async ({ page }) => {
      test.skip(!MANAGER_EMAIL || !MANAGER_PASSWORD, "Set E2E_MANAGER_EMAIL and E2E_MANAGER_PASSWORD");
      await page.goto("/auth");
      await page.fill("input[type='email']", MANAGER_EMAIL);
      await page.fill("input[type='password']", MANAGER_PASSWORD);
      await page.click("button:has-text('Sign In')");
      await expect(page).toHaveURL("/", { timeout: 15000 });
      
      // Navigate to marketplace/contractors
      await page.goto("/marketplace/contractors");
      await expect(page.locator("text=Contractors")).toBeVisible({ timeout: 10000 });
      
      // Click on first contractor
      await page.click(".contractor-card:first-child");
      await expect(page.locator("text=Contractor Profile")).toBeVisible({ timeout: 10000 });
      
      // Verify performance metrics are visible
      await expect(page.locator("text=Rating")).toBeVisible({ timeout: 10000 });
      await expect(page.locator("text=Completed Jobs")).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe("Financial Partners", () => {
    test("manager can view financial partners", async ({ page }) => {
      test.skip(!MANAGER_EMAIL || !MANAGER_PASSWORD, "Set E2E_MANAGER_EMAIL and E2E_MANAGER_PASSWORD");
      await page.goto("/auth");
      await page.fill("input[type='email']", MANAGER_EMAIL);
      await page.fill("input[type='password']", MANAGER_PASSWORD);
      await page.click("button:has-text('Sign In')");
      await expect(page).toHaveURL("/", { timeout: 15000 });
      
      // Navigate to marketplace/financial
      await page.goto("/marketplace/financial");
      await expect(page.locator("text=Financial Partners")).toBeVisible({ timeout: 10000 });
    });

    test("manager can apply for loan", async ({ page }) => {
      test.skip(!MANAGER_EMAIL || !MANAGER_PASSWORD, "Set E2E_MANAGER_EMAIL and E2E_MANAGER_PASSWORD");
      await page.goto("/auth");
      await page.fill("input[type='email']", MANAGER_EMAIL);
      await page.fill("input[type='password']", MANAGER_PASSWORD);
      await page.click("button:has-text('Sign In')");
      await expect(page).toHaveURL("/", { timeout: 15000 });
      
      // Navigate to marketplace/financial
      await page.goto("/marketplace/financial");
      await expect(page.locator("text=Financial Partners")).toBeVisible({ timeout: 10000 });
      
      // Click on apply for loan
      await page.click("button:has-text('Apply for Loan')");
      await expect(page.locator("text=Loan Application")).toBeVisible({ timeout: 10000 });
      
      // Fill loan application form
      await page.fill("input[name='amount']", "500000");
      await page.selectOption("select[name='term']", "12");
      await page.selectOption("select[name='purpose']", "property_improvement");
      await page.fill("textarea[name='description']", "Property renovation");
      
      // Submit application
      await page.click("button:has-text('Submit Application')");
      await expect(page.locator("text=Loan application submitted successfully")).toBeVisible({ timeout: 10000 });
    });

    test("manager can view loan status", async ({ page }) => {
      test.skip(!MANAGER_EMAIL || !MANAGER_PASSWORD, "Set E2E_MANAGER_EMAIL and E2E_MANAGER_PASSWORD");
      await page.goto("/auth");
      await page.fill("input[type='email']", MANAGER_EMAIL);
      await page.fill("input[type='password']", MANAGER_PASSWORD);
      await page.click("button:has-text('Sign In')");
      await expect(page).toHaveURL("/", { timeout: 15000 });
      
      // Navigate to marketplace/financial
      await page.goto("/marketplace/financial");
      await expect(page.locator("text=Financial Partners")).toBeVisible({ timeout: 10000 });
      
      // Click on loan applications
      await page.click("text=Loan Applications");
      await expect(page.locator("text=Loan Applications")).toBeVisible({ timeout: 10000 });
    });

    test("manager can view payment processing options", async ({ page }) => {
      test.skip(!MANAGER_EMAIL || !MANAGER_PASSWORD, "Set E2E_MANAGER_EMAIL and E2E_MANAGER_PASSWORD");
      await page.goto("/auth");
      await page.fill("input[type='email']", MANAGER_EMAIL);
      await page.fill("input[type='password']", MANAGER_PASSWORD);
      await page.click("button:has-text('Sign In')");
      await expect(page).toHaveURL("/", { timeout: 15000 });
      
      // Navigate to marketplace/financial
      await page.goto("/marketplace/financial");
      await expect(page.locator("text=Financial Partners")).toBeVisible({ timeout: 10000 });
      
      // Click on payment processing
      await page.click("text=Payment Processing");
      await expect(page.locator("text=Payment Processing")).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe("Insurers", () => {
    test("manager can view insurance providers", async ({ page }) => {
      test.skip(!MANAGER_EMAIL || !MANAGER_PASSWORD, "Set E2E_MANAGER_EMAIL and E2E_MANAGER_PASSWORD");
      await page.goto("/auth");
      await page.fill("input[type='email']", MANAGER_EMAIL);
      await page.fill("input[type='password']", MANAGER_PASSWORD);
      await page.click("button:has-text('Sign In')");
      await expect(page).toHaveURL("/", { timeout: 15000 });
      
      // Navigate to marketplace/insurance
      await page.goto("/marketplace/insurance");
      await expect(page.locator("text=Insurance")).toBeVisible({ timeout: 10000 });
    });

    test("manager can purchase insurance policy", async ({ page }) => {
      test.skip(!MANAGER_EMAIL || !MANAGER_PASSWORD, "Set E2E_MANAGER_EMAIL and E2E_MANAGER_PASSWORD");
      await page.goto("/auth");
      await page.fill("input[type='email']", MANAGER_EMAIL);
      await page.fill("input[type='password']", MANAGER_PASSWORD);
      await page.click("button:has-text('Sign In')");
      await expect(page).toHaveURL("/", { timeout: 15000 });
      
      // Navigate to marketplace/insurance
      await page.goto("/marketplace/insurance");
      await expect(page.locator("text=Insurance")).toBeVisible({ timeout: 10000 });
      
      // Click on get quote
      await page.click("button:has-text('Get Quote')");
      await expect(page.locator("text=Get Insurance Quote")).toBeVisible({ timeout: 10000 });
      
      // Fill quote form
      await page.selectOption("select[name='property']", "1");
      await page.selectOption("select[name='coverage_type']", "property_damage");
      await page.fill("input[name='coverage_amount']", "1000000");
      
      // Submit quote request
      await page.click("button:has-text('Get Quote')");
      await expect(page.locator("text=Quote generated successfully")).toBeVisible({ timeout: 10000 });
    });

    test("manager can view insurance policies", async ({ page }) => {
      test.skip(!MANAGER_EMAIL || !MANAGER_PASSWORD, "Set E2E_MANAGER_EMAIL and E2E_MANAGER_PASSWORD");
      await page.goto("/auth");
      await page.fill("input[type='email']", MANAGER_EMAIL);
      await page.fill("input[type='password']", MANAGER_PASSWORD);
      await page.click("button:has-text('Sign In')");
      await expect(page).toHaveURL("/", { timeout: 15000 });
      
      // Navigate to marketplace/insurance
      await page.goto("/marketplace/insurance");
      await expect(page.locator("text=Insurance")).toBeVisible({ timeout: 10000 });
      
      // Click on policies
      await page.click("text=Policies");
      await expect(page.locator("text=Insurance Policies")).toBeVisible({ timeout: 10000 });
    });

    test("manager can file insurance claim", async ({ page }) => {
      test.skip(!MANAGER_EMAIL || !MANAGER_PASSWORD, "Set E2E_MANAGER_EMAIL and E2E_MANAGER_PASSWORD");
      await page.goto("/auth");
      await page.fill("input[type='email']", MANAGER_EMAIL);
      await page.fill("input[type='password']", MANAGER_PASSWORD);
      await page.click("button:has-text('Sign In')");
      await expect(page).toHaveURL("/", { timeout: 15000 });
      
      // Navigate to marketplace/insurance
      await page.goto("/marketplace/insurance");
      await expect(page.locator("text=Insurance")).toBeVisible({ timeout: 10000 });
      
      // Click on file claim
      await page.click("button:has-text('File Claim')");
      await expect(page.locator("text=File Insurance Claim")).toBeVisible({ timeout: 10000 });
      
      // Fill claim form
      await page.selectOption("select[name='policy']", "1");
      await page.selectOption("select[name='claim_type']", "property_damage");
      await page.fill("input[name='incident_date']", "2026-06-01");
      await page.fill("textarea[name='description']", "Water damage from burst pipe");
      await page.fill("input[name='claim_amount']", "50000");
      
      // Submit claim
      await page.click("button:has-text('Submit Claim')");
      await expect(page.locator("text=Claim submitted successfully")).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe("Utility Providers", () => {
    test("manager can view utility providers", async ({ page }) => {
      test.skip(!MANAGER_EMAIL || !MANAGER_PASSWORD, "Set E2E_MANAGER_EMAIL and E2E_MANAGER_PASSWORD");
      await page.goto("/auth");
      await page.fill("input[type='email']", MANAGER_EMAIL);
      await page.fill("input[type='password']", MANAGER_PASSWORD);
      await page.click("button:has-text('Sign In')");
      await expect(page).toHaveURL("/", { timeout: 15000 });
      
      // Navigate to marketplace/utilities
      await page.goto("/marketplace/utilities");
      await expect(page.locator("text=Utility Providers")).toBeVisible({ timeout: 10000 });
    });

    test("manager can request utility connection", async ({ page }) => {
      test.skip(!MANAGER_EMAIL || !MANAGER_PASSWORD, "Set E2E_MANAGER_EMAIL and E2E_MANAGER_PASSWORD");
      await page.goto("/auth");
      await page.fill("input[type='email']", MANAGER_EMAIL);
      await page.fill("input[type='password']", MANAGER_PASSWORD);
      await page.click("button:has-text('Sign In')");
      await expect(page).toHaveURL("/", { timeout: 15000 });
      
      // Navigate to marketplace/utilities
      await page.goto("/marketplace/utilities");
      await expect(page.locator("text=Utility Providers")).toBeVisible({ timeout: 10000 });
      
      // Click on request connection
      await page.click("button:has-text('Request Connection')");
      await expect(page.locator("text=Request Utility Connection")).toBeVisible({ timeout: 10000 });
      
      // Fill connection form
      await page.selectOption("select[name='property']", "1");
      await page.selectOption("select[name='utility_type']", "electricity");
      await page.fill("input[name='connection_date']", "2026-06-15");
      
      // Submit request
      await page.click("button:has-text('Submit Request')");
      await expect(page.locator("text=Connection request submitted successfully")).toBeVisible({ timeout: 10000 });
    });

    test("manager can view utility connections", async ({ page }) => {
      test.skip(!MANAGER_EMAIL || !MANAGER_PASSWORD, "Set E2E_MANAGER_EMAIL and E2E_MANAGER_PASSWORD");
      await page.goto("/auth");
      await page.fill("input[type='email']", MANAGER_EMAIL);
      await page.fill("input[type='password']", MANAGER_PASSWORD);
      await page.click("button:has-text('Sign In')");
      await expect(page).toHaveURL("/", { timeout: 15000 });
      
      // Navigate to marketplace/utilities
      await page.goto("/marketplace/utilities");
      await expect(page.locator("text=Utility Providers")).toBeVisible({ timeout: 10000 });
      
      // Click on connections
      await page.click("text=Connections");
      await expect(page.locator("text=Utility Connections")).toBeVisible({ timeout: 10000 });
    });

    test("manager can view utility billing", async ({ page }) => {
      test.skip(!MANAGER_EMAIL || !MANAGER_PASSWORD, "Set E2E_MANAGER_EMAIL and E2E_MANAGER_PASSWORD");
      await page.goto("/auth");
      await page.fill("input[type='email']", MANAGER_EMAIL);
      await page.fill("input[type='password']", MANAGER_PASSWORD);
      await page.click("button:has-text('Sign In')");
      await expect(page).toHaveURL("/", { timeout: 15000 });
      
      // Navigate to marketplace/utilities
      await page.goto("/marketplace/utilities");
      await expect(page.locator("text=Utility Providers")).toBeVisible({ timeout: 10000 });
      
      // Click on billing
      await page.click("text=Billing");
      await expect(page.locator("text=Utility Billing")).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe("Ecosystem Participant Management", () => {
    test("manager can view ecosystem participants", async ({ page }) => {
      test.skip(!MANAGER_EMAIL || !MANAGER_PASSWORD, "Set E2E_MANAGER_EMAIL and E2E_MANAGER_PASSWORD");
      await page.goto("/auth");
      await page.fill("input[type='email']", MANAGER_EMAIL);
      await page.fill("input[type='password']", MANAGER_PASSWORD);
      await page.click("button:has-text('Sign In')");
      await expect(page).toHaveURL("/", { timeout: 15000 });
      
      // Navigate to marketplace/participants
      await page.goto("/marketplace/participants");
      await expect(page.locator("text=Participants")).toBeVisible({ timeout: 10000 });
    });

    test("manager can onboard new participant", async ({ page }) => {
      test.skip(!MANAGER_EMAIL || !MANAGER_PASSWORD, "Set E2E_MANAGER_EMAIL and E2E_MANAGER_PASSWORD");
      await page.goto("/auth");
      await page.fill("input[type='email']", MANAGER_EMAIL);
      await page.fill("input[type='password']", MANAGER_PASSWORD);
      await page.click("button:has-text('Sign In')");
      await expect(page).toHaveURL("/", { timeout: 15000 });
      
      // Navigate to marketplace/participants
      await page.goto("/marketplace/participants");
      await expect(page.locator("text=Participants")).toBeVisible({ timeout: 10000 });
      
      // Click on onboard participant
      await page.click("button:has-text('Onboard Participant')");
      await expect(page.locator("text=Onboard Participant")).toBeVisible({ timeout: 10000 });
      
      // Fill onboarding form
      await page.fill("input[name='name']", "Test Service Provider");
      await page.fill("input[name='email']", "provider@example.com");
      await page.selectOption("select[name='type']", "contractor");
      await page.fill("input[name='phone']", "+254712345678");
      
      // Submit form
      await page.click("button:has-text('Onboard')");
      await expect(page.locator("text=Participant onboarded successfully")).toBeVisible({ timeout: 10000 });
    });

    test("manager can view participant compliance status", async ({ page }) => {
      test.skip(!MANAGER_EMAIL || !MANAGER_PASSWORD, "Set E2E_MANAGER_EMAIL and E2E_MANAGER_PASSWORD");
      await page.goto("/auth");
      await page.fill("input[type='email']", MANAGER_EMAIL);
      await page.fill("input[type='password']", MANAGER_PASSWORD);
      await page.click("button:has-text('Sign In')");
      await expect(page).toHaveURL("/", { timeout: 15000 });
      
      // Navigate to marketplace/participants
      await page.goto("/marketplace/participants");
      await expect(page.locator("text=Participants")).toBeVisible({ timeout: 10000 });
      
      // Click on compliance
      await page.click("text=Compliance");
      await expect(page.locator("text=Compliance Status")).toBeVisible({ timeout: 10000 });
    });
  });
});
