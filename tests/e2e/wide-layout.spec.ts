import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';

// Widest gutter the dashboard frame uses, plus the panel border.
const edge = 64 + 1;

async function login(page: Page) {
  await page.goto('/auth/login');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/repos$/);
}

for (const width of [1920, 2560]) {
  test(`dashboard content spans a ${width}px screen`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1200 });
    await login(page);
    for (const path of [
      '/repos',
      '/repos?timeline=1',
      '/repos/prebidjs',
      '/repos/prebidjs?timeline=1',
      '/contributors',
      '/companies?timeline=1',
      '/contributors/account-alice',
    ]) {
      await page.goto(path);
      const scroll = page.getByRole('region', { name: /table scroll area$/ }).first();
      await expect(scroll).toBeVisible();
      const box = (await scroll.boundingBox())!;
      expect(box.x).toBeLessThanOrEqual(edge);
      expect(box.x + box.width).toBeGreaterThanOrEqual(width - edge);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        width,
      );
    }
  });
}
