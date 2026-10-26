import { test, expect } from '@playwright/test';
import { observeBrowserErrors } from '../support/browser-errors';
test('the browser error guard detects an actual uncaught page exception', async ({ page }) => {
  const observed = observeBrowserErrors(page);
  try {
    observed.assertClean();
    const event = page.waitForEvent('pageerror');
    await page.setContent(
      '<script>setTimeout(()=>{throw new Error("controlled-error-guard-fixture")},0)</script>',
    );
    await event;
    expect(() => observed.assertClean()).toThrow('controlled-error-guard-fixture');
  } finally {
    observed.dispose();
  }
});
