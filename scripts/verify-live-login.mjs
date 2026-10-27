import { spawnSync } from "node:child_process";
import { readFile, readdir } from "node:fs/promises";
const env = {
  ...process.env,
  NEXTAUTH_SECRET: "local-verification-only-secret-0123456789",
  NEXTAUTH_URL: "http://localhost:3300",
  S3_ACCESS_KEY_ID: "local",
  S3_SECRET_ACCESS_KEY: "local",
  DYNAMODB_USERS_TABLE: "local-users",
  DYNAMODB_WHITELIST_TABLE: "local-whitelist",
  AWS_ENDPOINT_URL_DYNAMODB: "http://127.0.0.1:9",
  AWS_ENDPOINT_URL_S3: "http://127.0.0.1:9",
  AWS_EC2_METADATA_DISABLED: "true",
  AWS_CONFIG_FILE: "/dev/null",
  AWS_SHARED_CREDENTIALS_FILE: "/dev/null",
  NEXT_TELEMETRY_DISABLED: "1",
};
function run(args) {
  const result = spawnSync(process.execPath, args, { stdio: "inherit", env });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
if ((await readdir("public")).includes("store"))
  throw new Error("Public reporting files must not ship.");
run([
  "node_modules/vitest/vitest.mjs",
  "run",
  "--config",
  "tests/live-login/vitest.config.ts",
]);
// Validate with the checked-in report snapshot; never run the live S3 sync in this test build.
run(["node_modules/next/dist/bin/next", "build"]);
run([
  "node_modules/@playwright/test/cli.js",
  "test",
  "--config",
  "tests/live-login/playwright.config.ts",
]);
const unit = JSON.parse(
  await readFile("test-results/live-login-unit.json", "utf8"),
);
const browser = JSON.parse(
  await readFile("test-results/live-login.json", "utf8"),
);
if (
  !unit.success ||
  unit.numFailedTests ||
  unit.numPendingTests ||
  unit.numTotalTests === 0 ||
  browser.stats.expected !== 8 ||
  browser.stats.unexpected ||
  browser.stats.skipped ||
  browser.stats.flaky
)
  throw new Error("Incomplete verification results");
console.log(
  `Verified ${unit.numPassedTests} unit cases and ${browser.stats.expected} Chromium/WebKit scenarios without failures or skips.`,
);
