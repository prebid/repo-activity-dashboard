import { test as base, expect } from '@playwright/test';
import { observeBrowserErrors } from '../support/browser-errors';
export const test = base.extend({
  page: async ({ page }, provide) => {
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
