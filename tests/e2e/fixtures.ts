import { test as base, expect, type Page } from '@playwright/test';
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

/** Canvas token values (src/styles/prebid.css) that show which theme's tokens are in effect. */
const canvas = { light: '#eef2f6', dark: '#0d161f' } as const;
/** Waits until the document resolves a theme's tokens, which is what applying the theme means. */
export async function expectTheme(page: Page, theme: string) {
  if (theme !== 'light' && theme !== 'dark') throw new Error('Unknown theme ' + theme);
  await expect
    .poll(() =>
      page.evaluate(() =>
        getComputedStyle(document.documentElement).getPropertyValue('--prebid-background').trim(),
      ),
    )
    .toBe(canvas[theme]);
}
