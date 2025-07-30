import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/integration",
  testMatch: "**/*.e2e.ts",
  workers: 1,
  reporter: "list",
});
