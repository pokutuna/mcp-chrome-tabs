import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: "list",
  timeout: 60000,
  use: {
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chrome-integration",
      testMatch: "**/chrome-integration.test.ts",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
