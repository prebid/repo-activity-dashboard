import { defineConfig } from "@playwright/test";
import { resolve } from "node:path";
export default defineConfig({
  testDir: ".",
  testMatch: "*.pw.ts",
  workers: 1,
  retries: 0,
  forbidOnly: true,
  globalSetup: "./setup.ts",
  outputDir: resolve("test-results/live-login"),
  reporter: [
    ["list"],
    ["json", { outputFile: resolve("test-results/live-login.json") }],
  ],
  use: { baseURL: "http://localhost:3300", trace: "retain-on-failure" },
  projects: [
    { name: "chromium", use: { browserName: "chromium" } },
    { name: "webkit", use: { browserName: "webkit" } },
  ],
});
