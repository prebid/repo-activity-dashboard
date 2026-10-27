import { test as base, expect } from '@playwright/test';
import { observeBrowserErrors } from '../support/browser-errors';
import { captureHydrationMismatch } from '../support/hydration-debug';
export const test = base.extend({
  page: async ({ page }, provide, testInfo) => {
    await captureHydrationMismatch(page, testInfo.outputPath('hydration-debug.jsonl'));
    const observed = observeBrowserErrors(page);
    try {
      await provide(page);
      observed.assertClean();
    } finally {
      observed.dispose();
    }
  },
});
export { expect };
