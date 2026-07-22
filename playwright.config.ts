import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI === undefined ? 0 : 1,
  reporter: [["list"], ["html", { open: "never" }]],
  use: { ...devices["Desktop Chrome"], trace: "retain-on-failure" },
  webServer: [
    {
      command: "pnpm e2e:services",
      url: "http://127.0.0.1:4310/health",
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: "pnpm --filter @skymenders/content-studio run dev",
      url: "http://127.0.0.1:4311",
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: "pnpm --filter @skymenders/admin-console run dev",
      url: "http://127.0.0.1:4312",
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
