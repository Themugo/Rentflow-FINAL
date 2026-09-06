import { test, expect, type Page } from "@playwright/test";

const roles = {
  manager: { email: process.env.E2E_MANAGER_EMAIL || "", password: process.env.E2E_MANAGER_PASSWORD || "", login: "/auth", submit: /^sign in$/i },
  landlord: { email: process.env.E2E_LANDLORD_EMAIL || "", password: process.env.E2E_LANDLORD_PASSWORD || "", login: "/landlord/login", submit: /^sign in$/i },
  tenant: { email: process.env.E2E_TENANT_EMAIL || "", password: process.env.E2E_TENANT_PASSWORD || "", login: "/tenant/login", submit: /^sign in$/i },
  webhost: { email: process.env.E2E_WEBHOST_EMAIL || "", password: process.env.E2E_WEBHOST_PASSWORD || "", login: "/webhost/login", submit: /sign in to admin portal/i },
};

async function signIn(page: Page, role: keyof typeof roles) {
  const cfg = roles[role];
  await page.goto(cfg.login);
  await page.locator("input[type='email']").first().fill(cfg.email);
  await page.locator("input[type='password']").first().fill(cfg.password);
  await page.getByRole("button", { name: cfg.submit }).click();
  await page.waitForLoadState("domcontentloaded");
}

for (const [name, cfg] of Object.entries(roles)) {
  test(`${name}: authenticated portal smoke`, async ({ page }) => {
    test.skip(!cfg.email || !cfg.password, `Set credentials for ${name}`);
    await signIn(page, name as keyof typeof roles);
    const expected = name === "webhost" ? /\/webhost\/?/ : name === "landlord" ? /\/landlord\/dashboard/ : name === "tenant" ? /\/portal/ : /\/$|\/properties|\/dashboard/i;
    await expect(page).toHaveURL(expected, { timeout: 30_000 });
  });
}

const isolation = [
  ["manager", "/webhost"],
  ["landlord", "/webhost"],
  ["tenant", "/webhost"],
  ["tenant", "/properties"],
  ["landlord", "/properties"],
] as const;

for (const [role, forbiddenPath] of isolation) {
  test(`${role}: denied from ${forbiddenPath}`, async ({ page }) => {
    const cfg = roles[role];
    test.skip(!cfg.email || !cfg.password, `Set credentials for ${role}`);
    await signIn(page, role);
    await page.goto(forbiddenPath);
    await page.waitForLoadState("domcontentloaded");
    const url = page.url();
    const stayedOnForbidden = new URL(url).pathname === forbiddenPath || new URL(url).pathname.startsWith(`${forbiddenPath}/`);
    expect(stayedOnForbidden, `${role} retained access to ${forbiddenPath}`).toBeFalsy();
  });
}
