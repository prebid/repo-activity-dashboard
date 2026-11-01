import { contributionReturnHref } from '../../src/lib/presentation/contribution-return';
import { test, expect } from './fixtures';
import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
async function login(page: Page) {
  await page.goto('/auth/login');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/repos$/);
}
for (const [path, title, theme, width] of [
  ['/contributors', 'Contributors', 'dark', 1440],
  ['/contributors', 'Contributors', 'light', 375],
  ['/companies', 'Companies', 'light', 1440],
  ['/companies', 'Companies', 'dark', 375],
  ['/contributors/account-alice', 'Alice', 'light', 1440],
  ['/contributors/account-alice', 'Alice', 'dark', 375],
  ['/companies/id/company-acme', 'Example Acme', 'dark', 1440],
  ['/companies/id/company-acme?view=repositories', 'Example Acme', 'light', 375],
] as const) {
  test(`contribution layout ${path}, ${theme}, ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 1000 });
    await login(page);
    await page.getByRole('button', { name: 'Theme settings', exact: true }).click();
    await page
      .getByRole('menuitemradio', { name: theme === 'dark' ? 'Dark' : 'Light', exact: true })
      .click();
    await page.goto(path);
    await expect(page.getByRole('heading', { name: title, exact: true, level: 1 })).toBeVisible();
    await expect(page.getByRole('table')).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Authored PRs merged ↓', exact: true }),
    ).toBeVisible();
    // Widths are measured with the web fonts, not their fallback.
    await page.evaluate(() => document.fonts.ready);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      width,
    );
    const identity = page.locator('tbody [data-column="name"]').first();
    expect((await identity.boundingBox())!.width).toBeLessThanOrEqual(width < 600 ? 185 : 255);
    await expect(
      page
        .getByRole('navigation', { name: 'Main navigation' })
        .getByRole('link', { name: 'Contributions', exact: true }),
    ).toHaveAttribute('data-active', 'true');
    const columns = page.getByRole('button', { name: 'Columns', exact: true });
    await columns.click();
    await expect(page.getByRole('menu')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(columns).toBeFocused();
    expect((await new AxeBuilder({ page }).include('main').analyze()).violations).toEqual([]);
    await page.screenshot({
      path: testInfo.outputPath(
        'contributions-' +
          title.toLowerCase().replaceAll(' ', '-') +
          '-' +
          theme +
          '-' +
          width +
          '.png',
      ),
      fullPage: true,
    });
  });
}
test('overview, company breakdown and contributor return links preserve their parent tables', async ({
  page,
}) => {
  await login(page);
  await page.goto('/companies?sample=large');
  await page.getByRole('table').getByRole('link', { name: 'Example Acme', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Example Acme', level: 1 })).toBeVisible();
  await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(50);
  await expect(page.getByText('Page 1 of 2', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByText('Page 2 of 2', { exact: true })).toBeVisible();
  await page
    .getByRole('navigation', { name: 'Company breakdown' })
    .getByRole('link', { name: 'By repository', exact: true })
    .click();
  await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(18);
  await page
    .getByRole('navigation', { name: 'Company breakdown' })
    .getByRole('link', { name: 'By contributor', exact: true })
    .click();
  await expect(page.getByText('Page 2 of 2', { exact: true })).toBeVisible();
  const originalParent = new URL(page.url());
  const parentLink = await page
    .getByRole('table')
    .getByRole('link', { name: / — view contribution report$/ })
    .first()
    .getAttribute('href');
  if (!parentLink) throw Error('Missing child report link');
  const parent = contributionReturnHref(
    new URL(parentLink, page.url()).searchParams,
    '/contributors',
  );
  expect(new URL(parent, page.url()).pathname).toBe(originalParent.pathname);
  await page
    .getByRole('table')
    .getByRole('link', { name: / — view contribution report$/ })
    .first()
    .click();
  await expect(page.getByRole('region', { name: 'Report totals' })).toBeVisible();
  await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(1);
  await page.getByRole('link', { name: 'Back to report', exact: true }).click();
  await expect(page).toHaveURL(new URL(parent, page.url()).href);
  await expect(page.getByText('Page 2 of 2', { exact: true })).toBeVisible();
});
test('high-volume identity search and focused totals remain bounded and readable', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 375, height: 900 });
  await login(page);
  await page.goto('/contributors?sample=large');
  await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(50);
  await page
    .getByRole('textbox', { name: 'Search Contributors', exact: true })
    .fill('sample-heavy-agent');
  await page
    .getByRole('table')
    .getByRole('link', { name: /^Sample agent with hundreds.* — view contribution report$/ })
    .click();
  await expect(page.getByRole('region', { name: 'Report totals' })).toContainText('240');
  await expect(page.getByRole('region', { name: 'Report totals' })).toContainText('350');
  expect(contributionReturnHref(new URL(page.url()).searchParams, '/contributors')).toContain(
    'report.q=sample-heavy-agent',
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  await page.screenshot({
    path: testInfo.outputPath('busy-contributor-mobile.png'),
    fullPage: true,
  });
  await page.getByRole('link', { name: 'Back to report', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Search Contributors', exact: true })).toHaveValue(
    'sample-heavy-agent',
  );
  await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(1);
});
test('missing, partial, empty and invalid contribution views retain their meanings', async ({
  page,
}, testInfo) => {
  await login(page);
  for (const sample of ['missing', 'partial', 'empty']) {
    await page.goto('/contributors?sample=' + sample);
    if (sample === 'empty')
      await expect(
        page.getByRole('heading', { name: 'No counted contributions in this period', exact: true }),
      ).toBeVisible();
    else {
      await expect(page.getByLabel('Data coverage')).toBeVisible();
      if (sample === 'missing') {
        await expect(
          page.getByRole('heading', { name: 'No confirmed contributions to list' }),
        ).toBeVisible();
        await expect(page.getByRole('table')).toHaveCount(0);
      } else await expect(page.getByRole('table')).toBeVisible();
    }
    await page.screenshot({
      path: testInfo.outputPath('contributions-' + sample + '.png'),
      fullPage: true,
    });
  }
  await page.goto('/contributors?sample=unknown');
  await expect(page.getByRole('heading', { name: 'Invalid contribution view' })).toBeVisible();
  expect((await page.goto('/contributors/no-such-account'))?.status()).toBe(404);
  expect((await page.goto('/companies/id/no-such-company'))?.status()).toBe(404);
  await page.goto('/companies/unmapped');
  await expect(page.getByRole('heading', { name: 'Unmapped company', level: 1 })).toBeVisible();
});
test('catalog contribution states render independently with functional company breakdowns', async ({
  page,
}) => {
  await page.goto(
    'http://127.0.0.1:6007/iframe.html?id=contributions-pages--company&viewMode=story',
  );
  await expect(page.getByRole('heading', { name: 'Example Acme', level: 1 })).toBeVisible();
  await page.getByRole('button', { name: 'By repository', exact: true }).click();
  await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(2);
  for (const [story, title] of [['error', 'This page could not load']] as const) {
    await page.goto(
      'http://127.0.0.1:6007/iframe.html?id=contributions-pages--' + story + '&viewMode=story',
    );
    await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
  }
});
