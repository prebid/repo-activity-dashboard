import { test, expect } from './fixtures';
import type { Locator, Page } from '@playwright/test';

async function login(page: Page) {
  await page.goto('/auth/login');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/repos$/);
}
/** The logo is the vector file itself at every device scale: no srcset and no optimizer proxy. */
async function expectVectorLogo(page: Page, image: Locator, scale: number, width: number) {
  expect(await page.evaluate(() => window.devicePixelRatio)).toBe(scale);
  await expect(image).toHaveAttribute('alt', 'Prebid');
  expect(await image.getAttribute('srcset')).toBeNull();
  const loaded = await image.evaluate(async (element: HTMLImageElement) => {
    await element.decode();
    const box = element.getBoundingClientRect();
    return {
      currentSrc: element.currentSrc,
      naturalWidth: element.naturalWidth,
      size: [box.width, box.height],
    };
  });
  expect(new URL(loaded.currentSrc).pathname).toBe('/images/prebid-logo.svg');
  expect(loaded.naturalWidth).toBeGreaterThan(0);
  // Preflight's height:auto keeps the lockup's 140:25 ratio at the requested width. The height
  // attribute is that ratio rounded, up to 0.46px away, so the tolerance stays well under it.
  expect(loaded.size[0]).toBeCloseTo(width, 0);
  expect(Math.abs(loaded.size[1] - (width * 25) / 140)).toBeLessThan(0.1);
  const response = await page.request.get(loaded.currentSrc);
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toContain('image/svg+xml');
  expect(await response.text()).toMatch(/^\s*(?:<\?xml[^>]*>\s*)?<svg[\s>]/);
}

for (const scale of [1, 2]) {
  test.describe('device scale ' + scale, () => {
    test.use({ deviceScaleFactor: scale });
    test('renders the header logo as SVG', async ({ page }) => {
      await login(page);
      await expectVectorLogo(
        page,
        page.locator('header a[aria-label="Repository activity"] img'),
        scale,
        143,
      );
    });
    test('renders the sign-in logo as SVG', async ({ page }) => {
      await page.goto('/auth/login');
      await expectVectorLogo(page, page.locator('main header img'), scale, 171);
    });
  });
}

test('links public icons from the sign-in page', async ({ page }) => {
  await page.goto('/auth/login');
  for (const [selector, pathname, type] of [
    ['link[rel="icon"][href^="/favicon.ico"]', '/favicon.ico', 'image/x-icon'],
    ['link[rel="icon"][type="image/svg+xml"]', '/icon.svg', 'image/svg+xml'],
    ['link[rel="apple-touch-icon"]', '/apple-icon.png', 'image/png'],
  ]) {
    const href = await page.locator(selector).first().getAttribute('href');
    expect(href).not.toBeNull();
    expect(new URL(href!, page.url()).pathname).toBe(pathname);
    const response = await page.request.get(href!, { maxRedirects: 0 });
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toBe(type);
  }
});
