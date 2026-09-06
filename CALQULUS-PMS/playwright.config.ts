import { defineConfig, devices } from "@playwright/test";

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const isRemoteBase = /^https?:\/\//.test(BASE_URL) && !/localhost|127\.0\.0\.1/.test(BASE_URL);

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] },
    },
    {
      name: "webkit",
      use: { ...devices["Desktop Safari"] },
    },
  ],
  webServer: isRemoteBase
    ? undefined
    : {
        command: "npm run dev",
        url: "http://localhost:3000",
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        env: {
          ...process.env,
          VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL || "https://example.supabase.co",
          VITE_SUPABASE_PUBLISHABLE_KEY: process.env.VITE_SUPABASE_PUBLISHABLE_KEY || "ci-placeholder-anon-key",
          VITE_ENABLE_PUBLIC_DEMO: process.env.VITE_ENABLE_PUBLIC_DEMO || "false",
          VITE_ENABLE_DEMO_SEED: process.env.VITE_ENABLE_DEMO_SEED || "false",
          VITE_ENABLE_DEV_ACCESS: "false",
          VITE_AUTH_TIMEOUT_MS: process.env.VITE_AUTH_TIMEOUT_MS || "1000",
        },
      },
});
