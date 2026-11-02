import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e',
  outputDir: 'test-results/browser-artifacts',
  // Without {platform} or {projectName}, so macOS and Linux runs compare one committed file.
  snapshotPathTemplate: 'tests/fixtures/golden/{arg}{ext}',
  fullyParallel: false,
  forbidOnly: true,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['json', { outputFile: 'test-results/playwright.json' }]],
  use: {
    baseURL: 'http://127.0.0.1:3100',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
      // The golden URL set is recorded once, in Chromium; ignoring it here leaves no skipped case.
      testIgnore: 'golden-urls.spec.ts',
    },
  ],
  webServer: [
    {
      command: 'npm run start:preview -- --hostname 127.0.0.1 --port 3100',
      url: 'http://127.0.0.1:3100/api/health',
      reuseExistingServer: false,
      timeout: 60000,
    },
    {
      command: 'npm run preview:storybook',
      url: 'http://127.0.0.1:6007/iframe.html',
      reuseExistingServer: false,
      timeout: 60000,
    },
  ],
});
