import { defineConfig } from "vitest/config";
import { resolve } from "node:path";
export default defineConfig({
  resolve: { alias: { "@": resolve("src") } },
  test: {
    allowOnly: false,
    environment: "node",
    include: ["tests/live-login/*.test.ts"],
    reporters: ["default", "json"],
    outputFile: "test-results/live-login-unit.json",
    restoreMocks: true,
    unstubEnvs: true,
  },
});
