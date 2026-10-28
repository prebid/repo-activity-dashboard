import { test, expect } from './fixtures';
import AxeBuilder from '@axe-core/playwright';

for (const [kind, theme, width] of [
  ['prs', 'dark', 1440],
  ['issues', 'light', 1440],
  ['prs', 'light', 375],
  ['issues', 'dark', 375],
] as const) {
  test(`repository layout ${kind}, ${theme}, ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/auth/login');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page).toHaveURL(/\/repos$/);
    await page.getByRole('button', { name: 'Theme settings', exact: true }).click();
    await page
      .getByRole('menuitemradio', { name: theme === 'dark' ? 'Dark' : 'Light', exact: true })
      .click();
    await page.goto('/repos/prebidjs?view=' + kind);
    await expect(page.getByRole('heading', { name: 'Prebid.js', exact: true })).toBeVisible();
    await expect(
      page
        .getByRole('navigation', { name: 'Repository lists' })
        .getByRole('link', { name: kind === 'prs' ? /^Pull requests/ : /^Issues/ }),
    ).toHaveAttribute('aria-current', 'page');
    await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(100);
    const numberCell = page.locator('tbody [data-column="number"]').first();
    expect((await numberCell.boundingBox())!.width).toBeLessThan(150);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      width,
    );
    await expect(page.getByRole('link', { name: /View repository on GitHub/ })).toHaveAttribute(
      'href',
      'https://github.com/prebid/Prebid.js',
    );
    const columns = page.getByRole('button', { name: 'Columns', exact: true });
    await columns.click();
    await expect(page.getByRole('menu')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(columns).toBeFocused();
    expect((await new AxeBuilder({ page }).include('main').analyze()).violations).toEqual([]);
    await page.screenshot({
      path: testInfo.outputPath('repository-' + kind + '-' + theme + '-' + width + '.png'),
    });
  });
}

test('direct lists share the drilldown layout and retain pagination through tab navigation', async ({
  page,
}) => {
  await page.goto('/auth/login');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/repos$/);
  await page.goto('/repos/prebidjs');
  await expect(page.getByText('137 matching records', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(37);
  await page
    .getByRole('navigation', { name: 'Repository lists' })
    .getByRole('link', { name: /^Issues/ })
    .click();
  await expect(page.getByText('834 matching records', { exact: true })).toBeVisible();
  await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(100);
  await page.goBack();
  await expect(page.getByText('Page 2 of 2', { exact: true })).toBeVisible();
  await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(37);
  await page.goto(
    '/repos/prebidjs?scope=current&metric=humanApprovals0&returnTo=%2Frepos%3Fage%3D60',
  );
  await expect(page.getByText('60 matching records', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: '← All repositories', exact: true })).toHaveAttribute(
    'href',
    '/repos?age=60',
  );
  await expect(page.getByRole('heading', { name: 'Prebid.js', exact: true })).toBeVisible();
});
