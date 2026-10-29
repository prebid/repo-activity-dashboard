import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
async function login(page: Page) {
  await page.goto('/auth/login');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/repos$/);
}
async function exportCsv(page: Page, name: string) {
  if (name === 'Export CSV') {
    await page.getByRole('button', { name, exact: true }).click();
    name = 'Download CSV';
  }
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name, exact: true }).click();
  const stream = await (await download).createReadStream();
  let text = '';
  for await (const chunk of stream) text += String(chunk);
  return text;
}
test('known-zero member filtering survives history and agrees with both full-result exports', async ({
  page,
}, info) => {
  await login(page);
  await page.goto('/companies/id/company-acme?sample=large&period=this-month&repo=repo-prebidjs');
  await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(50);
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByText('Page 2 of 2', { exact: true })).toBeVisible();
  await page.getByRole('checkbox', { name: 'Hide zero totals', exact: true }).check();
  await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(6);
  await expect(
    page.getByRole('region', { name: 'Report totals' }).locator('dd').first(),
  ).toHaveText('6');
  const quick = await exportCsv(page, 'Export CSV');
  expect(quick.split('\r\n')).toHaveLength(7);
  expect(quick).toContain('Hide zero member totals');
  await page.getByRole('button', { name: 'Export CSV', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: /CSV export$/ });
  await dialog.getByRole('radio', { name: 'By repository', exact: true }).check();
  await dialog.getByRole('button', { name: 'Clear selection', exact: true }).click();
  await dialog.getByRole('checkbox', { name: 'PRs authored', exact: true }).check();
  const flat = await exportCsv(page, 'Download CSV');
  expect(flat.split('\r\n')).toHaveLength(7);
  expect(flat).toContain('Hide zero member totals');
  await page.goBack();
  await expect(
    page.getByRole('checkbox', { name: 'Hide zero totals', exact: true }),
  ).not.toBeChecked();
  await expect(page.getByText('Page 2 of 2', { exact: true })).toBeVisible();
  await page.goForward();
  await expect(page.getByRole('checkbox', { name: 'Hide zero totals', exact: true })).toBeChecked();
  await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(6);
  await page.reload();
  await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(6);
  await page.screenshot({ path: info.outputPath('company-hide-zero.png'), fullPage: true });
  await page.goto('/companies/id/company-acme?sample=missing&period=this-year&members.zero=hide');
  await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(3);
  await expect(page.getByLabel('Data coverage')).toBeVisible();
});
test('returning through nested reports restores the original presentation after preferences change in another report', async ({
  page,
}) => {
  await login(page);
  await page.goto('/companies/id/company-acme?sample=large');
  await page.getByRole('button', { name: 'Columns', exact: true }).click();
  await page.getByRole('menuitemcheckbox', { name: 'Issues authored', exact: true }).click();
  await page.keyboard.press('Escape');
  await page.goto('/companies/id/company-acme?sample=large');
  await expect(
    page.getByRole('table', { name: 'Company contributors', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('columnheader', { name: 'Issues authored', exact: true }),
  ).toHaveCount(0);
  expect(new URL(page.url()).searchParams.has('members.columns')).toBe(false);
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page
    .getByRole('table')
    .getByRole('link', { name: / — view contribution report$/ })
    .first()
    .click();
  await page.getByRole('link', { name: 'Example Acme', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Example Acme', level: 1 })).toBeVisible();
  await expect(
    page.getByRole('table', { name: 'Company contributors', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('columnheader', { name: 'Issues authored', exact: true }),
  ).toHaveCount(0);
  await page.getByRole('button', { name: 'Columns', exact: true }).click();
  await page.getByRole('menuitemcheckbox', { name: 'Issues authored', exact: true }).click();
  await page.keyboard.press('Escape');
  await expect(
    page.getByRole('columnheader', { name: 'Issues authored', exact: true }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Back to report', exact: true }).click();
  await expect(page.getByRole('heading', { name: /^Sample contributor /, level: 1 })).toBeVisible();
  await expect(page.getByRole('table', { name: 'By repository', exact: true })).toBeVisible();
  const parentHref = await page
    .getByRole('link', { name: 'Back to report', exact: true })
    .getAttribute('href');
  expect(new URL(parentHref!, page.url()).searchParams.get('members.page')).toBe('2');
  await page.getByRole('link', { name: 'Back to report', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Example Acme', level: 1 })).toBeVisible();
  await expect(page.getByText('Page 2 of 2', { exact: true })).toBeVisible();
  await expect(
    page.getByRole('columnheader', { name: 'Issues authored', exact: true }),
  ).toHaveCount(0);
});
test('a canceled stalled export cannot download late, and the dialog remains reusable', async ({
  page,
}) => {
  await login(page);
  await page.goto('/contributors');
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  let requests = 0;
  await page.route('**/contributors/export?**', async (route) => {
    requests++;
    await held;
    await route.fulfill({ status: 200, contentType: 'text/csv', body: 'stale response' });
  });
  const downloads: string[] = [];
  page.on('download', (download) => downloads.push(download.suggestedFilename()));
  await page.getByRole('button', { name: 'Export CSV', exact: true }).click();
  await page.getByRole('radio', { name: 'By repository', exact: true }).check();
  await page.getByRole('button', { name: 'Download CSV', exact: true }).click();
  await expect.poll(() => requests).toBe(1);
  await expect(page.getByRole('button', { name: 'Cancel', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  release();
  await page.unrouteAll({ behavior: 'wait' });
  await page.getByRole('button', { name: 'Export CSV', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Download CSV', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  expect(downloads).toEqual([]);
});
for (const [name, path] of [
  ['contributors', '/contributors?period=this-year'],
  ['companies', '/companies?period=this-year'],
  ['company', '/companies/id/company-acme?period=this-year&members.zero=hide'],
  ['person', '/contributors/account-alice?period=this-year'],
  ['details', '/companies/id/company-acme?period=this-year&metric=reviewed.filesChanged'],
] as const)
  test('final contribution visual matrix: ' + name, async ({ page }, info) => {
    await login(page);
    await page.goto(path);
    await expect(page.getByRole('table')).toBeVisible();
    for (const theme of ['Dark', 'Light'] as const) {
      await page.getByRole('button', { name: 'Theme settings', exact: true }).click();
      await page.getByRole('menuitemradio', { name: theme, exact: true }).click();
      for (const width of [375, 768, 1440]) {
        await page.setViewportSize({ width, height: 1000 });
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
          width,
        );
        expect((await new AxeBuilder({ page }).include('main').analyze()).violations).toEqual([]);
        await page.screenshot({
          path: info.outputPath(name + '-' + theme.toLowerCase() + '-' + width + '.png'),
          fullPage: true,
        });
      }
    }
  });
