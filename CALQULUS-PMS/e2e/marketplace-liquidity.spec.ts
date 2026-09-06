import { test, expect } from '@playwright/test';

// E2E tests for Marketplace Liquidity Features
// Tests for Contractor Marketplace, Financial Partners, Insurance Marketplace, Utility Providers, and Workflow Orchestration

const webhostEmail = process.env.E2E_WEBHOST_EMAIL;
const webhostPassword = process.env.E2E_WEBHOST_PASSWORD;

test.describe('Marketplace Liquidity Features', () => {
  test.beforeEach(async ({ page }) => {
    // Skip tests if credentials are not set
    if (!webhostEmail || !webhostPassword) {
      test.skip(true, 'Webhost credentials not set');
    }
  });

  // Helper function to login with credentials
  const loginAsWebhost = async (page: any) => {
    await page.goto('/webhost/login');
    await page.fill('input[type="email"]', webhostEmail!);
    await page.fill('input[type="password"]', webhostPassword!);
    await page.click('button[type="submit"]');
  };

  test.describe('Contractor Marketplace', () => {
    test('should display contractor marketplace dashboard', async ({ page }) => {
      await loginAsWebhost(page);
      
      // Navigate to contractor marketplace
      await page.goto('/webhost/contractor-marketplace');
      
      // Verify dashboard loads
      await expect(page.locator('h2')).toContainText('Contractor Marketplace');
      
      // Verify summary cards
      await expect(page.locator('text=Total Contractors')).toBeVisible();
      await expect(page.locator('text=Available')).toBeVisible();
      await expect(page.locator('text=Active Work Orders')).toBeVisible();
      await expect(page.locator('text=Pending Bids')).toBeVisible();
    });

    test('should display contractor directory with search and filters', async ({ page }) => {
      await loginAsWebhost(page);
      
      await page.goto('/webhost/contractor-marketplace');
      
      // Verify contractors tab is active
      await expect(page.locator('text=Contractors')).toBeVisible();
      
      // Verify search functionality
      const searchInput = page.locator('input[placeholder="Search contractors..."]');
      await expect(searchInput).toBeVisible();
      await searchInput.fill('plumbing');
      
      // Verify filter dropdowns
      await expect(page.locator('select')).toHaveCount(2);
    });

    test('should display work orders', async ({ page }) => {
      await loginAsWebhost(page);
      
      await page.goto('/webhost/contractor-marketplace');
      await page.click('text=Work Orders');
      
      // Verify work orders are displayed
      await expect(page.locator('text=Work Orders')).toBeVisible();
      await expect(page.locator('text=Leaking faucet in bathroom')).toBeVisible();
    });

    test('should display contractor bids', async ({ page }) => {
      await loginAsWebhost(page);
      
      await page.goto('/webhost/contractor-marketplace');
      await page.click('text=Bids');
      
      // Verify bids are displayed
      await expect(page.locator('text=Contractor Bids')).toBeVisible();
      await expect(page.locator('text=Peter Ochieng')).toBeVisible();
    });

    test('should display contractor performance metrics', async ({ page }) => {
      await loginAsWebhost(page);
      
      await page.goto('/webhost/contractor-marketplace');
      await page.click('text=Performance');
      
      // Verify performance metrics are displayed
      await expect(page.locator('text=Contractor Performance')).toBeVisible();
      await expect(page.locator('text=On-Time Completion')).toBeVisible();
      await expect(page.locator('text=Quality Score')).toBeVisible();
    });
  });

  test.describe('Financial Partners', () => {
    test('should display financial partners dashboard', async ({ page }) => {
      await loginAsWebhost(page);
      
      await page.goto('/webhost/financial-partners');
      
      // Verify dashboard loads
      await expect(page.locator('h2')).toContainText('Financial Partners');
      
      // Verify summary cards
      await expect(page.locator('text=Total Partners')).toBeVisible();
      await expect(page.locator('text=Active Loans')).toBeVisible();
      await expect(page.locator('text=Pending Applications')).toBeVisible();
      await expect(page.locator('text=Total Volume')).toBeVisible();
    });

    test('should display financial partners directory', async ({ page }) => {
      await loginAsWebhost(page);
      
      await page.goto('/webhost/financial-partners');
      
      // Verify partners tab is active
      await expect(page.locator('text=Partners')).toBeVisible();
      
      // Verify search functionality
      const searchInput = page.locator('input[placeholder="Search partners..."]');
      await expect(searchInput).toBeVisible();
      
      // Verify partners are displayed
      await expect(page.locator('text=Equity Bank')).toBeVisible();
      await expect(page.locator('text=M-Pesa Financial Services')).toBeVisible();
    });

    test('should display loan applications', async ({ page }) => {
      await loginAsWebhost(page);
      
      await page.goto('/webhost/financial-partners');
      await page.click('text=Loan Applications');
      
      // Verify loan applications are displayed
      await expect(page.locator('text=Loan Applications')).toBeVisible();
      await expect(page.locator('text=John Kamau')).toBeVisible();
    });

    test('should display payment processing', async ({ page }) => {
      await loginAsWebhost(page);
      
      await page.goto('/webhost/financial-partners');
      await page.click('text=Payment Processing');
      
      // Verify payment processing is displayed
      await expect(page.locator('text=Payment Processing')).toBeVisible();
      await expect(page.locator('text=Safaricom M-Pesa')).toBeVisible();
    });

    test('should display partner performance metrics', async ({ page }) => {
      await loginAsWebhost(page);
      
      await page.goto('/webhost/financial-partners');
      await page.click('text=Performance');
      
      // Verify performance metrics are displayed
      await expect(page.locator('text=Partner Performance')).toBeVisible();
      await expect(page.locator('text=Approval Rate')).toBeVisible();
      await expect(page.locator('text=Customer Satisfaction')).toBeVisible();
    });
  });

  test.describe('Insurance Marketplace', () => {
    test('should display insurance marketplace dashboard', async ({ page }) => {
      await loginAsWebhost(page);
      
      await page.goto('/webhost/insurance-marketplace');
      
      // Verify dashboard loads
      await expect(page.locator('h2')).toContainText('Insurance Marketplace');
      
      // Verify summary cards
      await expect(page.locator('text=Total Providers')).toBeVisible();
      await expect(page.locator('text=Active Policies')).toBeVisible();
      await expect(page.locator('text=Pending Claims')).toBeVisible();
      await expect(page.locator('text=Total Coverage')).toBeVisible();
    });

    test('should display insurance providers directory', async ({ page }) => {
      await loginAsWebhost(page);
      
      await page.goto('/webhost/insurance-marketplace');
      
      // Verify providers tab is active
      await expect(page.locator('text=Providers')).toBeVisible();
      
      // Verify search functionality
      const searchInput = page.locator('input[placeholder="Search providers..."]');
      await expect(searchInput).toBeVisible();
      
      // Verify providers are displayed
      await expect(page.locator('text=APA Insurance')).toBeVisible();
      await expect(page.locator('text=Jubilee Insurance')).toBeVisible();
    });

    test('should display insurance policies', async ({ page }) => {
      await loginAsWebhost(page);
      
      await page.goto('/webhost/insurance-marketplace');
      await page.click('text=Policies');
      
      // Verify policies are displayed
      await expect(page.locator('text=Insurance Policies')).toBeVisible();
      await expect(page.locator('text=APA Insurance')).toBeVisible();
    });

    test('should display insurance claims', async ({ page }) => {
      await loginAsWebhost(page);
      
      await page.goto('/webhost/insurance-marketplace');
      await page.click('text=Claims');
      
      // Verify claims are displayed
      await expect(page.locator('text=Insurance Claims')).toBeVisible();
      await expect(page.locator('text=Water Damage')).toBeVisible();
    });

    test('should display provider performance metrics', async ({ page }) => {
      await loginAsWebhost(page);
      
      await page.goto('/webhost/insurance-marketplace');
      await page.click('text=Performance');
      
      // Verify performance metrics are displayed
      await expect(page.locator('text=Provider Performance')).toBeVisible();
      await expect(page.locator('text=Approval Rate')).toBeVisible();
      await expect(page.locator('text=Customer Satisfaction')).toBeVisible();
    });
  });

  test.describe('Utility Providers', () => {
    test('should display utility providers dashboard', async ({ page }) => {
      await loginAsWebhost(page);
      
      await page.goto('/webhost/utility-providers');
      
      // Verify dashboard loads
      await expect(page.locator('h2')).toContainText('Utility Providers');
      
      // Verify summary cards
      await expect(page.locator('text=Total Providers')).toBeVisible();
      await expect(page.locator('text=Active Connections')).toBeVisible();
      await expect(page.locator('text=Pending Bills')).toBeVisible();
      await expect(page.locator('text=Monthly Cost')).toBeVisible();
    });

    test('should display utility providers directory', async ({ page }) => {
      await loginAsWebhost(page);
      
      await page.goto('/webhost/utility-providers');
      
      // Verify providers tab is active
      await expect(page.locator('text=Providers')).toBeVisible();
      
      // Verify search functionality
      const searchInput = page.locator('input[placeholder="Search providers..."]');
      await expect(searchInput).toBeVisible();
      
      // Verify providers are displayed
      await expect(page.locator('text=Kenya Power')).toBeVisible();
      await expect(page.locator('text=Nairobi Water')).toBeVisible();
    });

    test('should display utility connections', async ({ page }) => {
      await loginAsWebhost(page);
      
      await page.goto('/webhost/utility-providers');
      await page.click('text=Connections');
      
      // Verify connections are displayed
      await expect(page.locator('text=Utility Connections')).toBeVisible();
      await expect(page.locator('text=Kenya Power')).toBeVisible();
    });

    test('should display utility billing', async ({ page }) => {
      await loginAsWebhost(page);
      
      await page.goto('/webhost/utility-providers');
      await page.click('text=Billing');
      
      // Verify billing is displayed
      await expect(page.locator('text=Utility Billing')).toBeVisible();
      await expect(page.locator('text=Kenya Power')).toBeVisible();
    });

    test('should display provider performance metrics', async ({ page }) => {
      await loginAsWebhost(page);
      
      await page.goto('/webhost/utility-providers');
      await page.click('text=Performance');
      
      // Verify performance metrics are displayed
      await expect(page.locator('text=Provider Performance')).toBeVisible();
      await expect(page.locator('text=Reliability')).toBeVisible();
      await expect(page.locator('text=Customer Satisfaction')).toBeVisible();
    });
  });

  test.describe('Workflow Orchestration', () => {
    test('should display workflow orchestration dashboard', async ({ page }) => {
      await loginAsWebhost(page);
      
      await page.goto('/webhost/workflow-orchestration');
      
      // Verify dashboard loads
      await expect(page.locator('h2')).toContainText('Workflow Orchestration');
      
      // Verify summary cards
      await expect(page.locator('text=Total Templates')).toBeVisible();
      await expect(page.locator('text=Running Workflows')).toBeVisible();
      await expect(page.locator('text=Active Automations')).toBeVisible();
      await expect(page.locator('text=Completed Today')).toBeVisible();
    });

    test('should display workflow templates', async ({ page }) => {
      await loginAsWebhost(page);
      
      await page.goto('/webhost/workflow-orchestration');
      
      // Verify templates tab is active
      await expect(page.locator('text=Templates')).toBeVisible();
      
      // Verify search functionality
      const searchInput = page.locator('input[placeholder="Search templates..."]');
      await expect(searchInput).toBeVisible();
      
      // Verify templates are displayed
      await expect(page.locator('text=Tenant Onboarding')).toBeVisible();
      await expect(page.locator('text=Maintenance Request Processing')).toBeVisible();
    });

    test('should display workflow instances', async ({ page }) => {
      await loginAsWebhost(page);
      
      await page.goto('/webhost/workflow-orchestration');
      await page.click('text=Instances');
      
      // Verify instances are displayed
      await expect(page.locator('text=Workflow Instances')).toBeVisible();
      await expect(page.locator('text=John Kamau')).toBeVisible();
    });

    test('should display workflow steps', async ({ page }) => {
      await loginAsWebhost(page);
      
      await page.goto('/webhost/workflow-orchestration');
      await page.click('text=Steps');
      
      // Verify steps are displayed
      await expect(page.locator('text=Workflow Steps')).toBeVisible();
      await expect(page.locator('text=Identity Verification')).toBeVisible();
    });

    test('should display workflow automations', async ({ page }) => {
      await loginAsWebhost(page);
      
      await page.goto('/webhost/workflow-orchestration');
      await page.click('text=Automations');
      
      // Verify automations are displayed
      await expect(page.locator('text=Workflow Automations')).toBeVisible();
      await expect(page.locator('text=Monthly Invoice Generation')).toBeVisible();
    });
  });
});
