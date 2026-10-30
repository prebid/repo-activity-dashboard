import { contributionReturnHref } from '../../src/lib/presentation/contribution-return';
import { test, expect } from './fixtures';
import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
async function login(page: Page) {
  await page.goto('/auth/login');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/repos$/);
}
async function ready(page: Page) {
  await expect(
    page.getByRole('region', { name: 'Contribution report scope' }).getByRole('status'),
  ).toHaveText('Preferences saved for your account on this browser.');
}
async function chooseRepos(page: Page, names: string[]) {
  await page.getByRole('button', { name: /^Choose repositories/ }).click();
  const dialog = page.getByRole('dialog', { name: 'Choose repositories' });
  await dialog.getByRole('button', { name: 'Clear selection', exact: true }).click();
  for (const name of names) await dialog.getByRole('checkbox', { name, exact: true }).check();
  await dialog.getByRole('button', { name: 'Apply selection', exact: true }).click();
  await ready(page);
}
test('company inclusion, duplicate individual inclusion and exclusions keep 50-row pages and full export totals aligned', async ({
  page,
}) => {
  await login(page);
  await page.goto('/contributors?sample=large');
  await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(50);
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByText('Page 2 of 6', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'All accounts', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Include and exclude accounts' });
  await dialog.getByRole('radio', { name: 'Selected accounts', exact: true }).check();
  await dialog
    .getByRole('group', { name: /^Companies/ })
    .getByRole('checkbox', { name: 'Example Acme', exact: true })
    .check();
  const individuals = dialog.getByRole('group', { name: /^Individuals/ });
  await individuals.getByRole('textbox').fill('sample-person-001');
  await individuals.getByRole('checkbox', { name: /Sample contributor 1 / }).check();
  const exclusions = dialog.getByRole('group', { name: /^Exclusions/ });
  await exclusions.getByRole('textbox').fill('sample-person-001');
  await exclusions.getByRole('checkbox', { name: /Sample contributor 1 / }).check();
  await dialog.getByRole('button', { name: 'Apply accounts', exact: true }).click();
  await expect(page.getByText('Page 1 of 2', { exact: true })).toBeVisible();
  await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(50);
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(49);
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
  expect(new URL(page.url()).searchParams.get('exclude')).toBe('account-person-001');
  expect(new URL(page.url()).searchParams.get('company')).toBe('company-acme');
  await page.getByRole('link', { name: 'Back to report', exact: true }).click();
  await expect(page).toHaveURL(new URL(parent, page.url()).href);
  await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(49);
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export CSV', exact: true }).click();
  await page.getByRole('button', { name: 'Download CSV', exact: true }).click();
  const stream = await (await downloaded).createReadStream();
  let csv = '';
  for await (const chunk of stream) csv += String(chunk);
  expect(csv.split('\r\n')).toHaveLength(100);
  expect(csv).not.toContain('"sample-person-001"');
  expect(csv).toContain('account-person-001'); // Exclusion metadata remains explicit.
  await page
    .getByRole('navigation', { name: 'Contribution reports' })
    .getByRole('link', { name: /^Companies/ })
    .click();
  await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(1);
  await expect(page.getByRole('table').locator('tbody [data-column="prsAuthored"]')).toHaveText(
    '99',
  );
  await page.getByRole('table').getByRole('link', { name: 'Example Acme', exact: true }).click();
  await expect(
    page.getByRole('region', { name: 'Report totals' }).locator('dd').first(),
  ).toHaveText('99');
  await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(50);
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(49);
  await chooseRepos(page, ['Prebid.js']);
  await expect(page.getByText('Page 1 of 2', { exact: true })).toBeVisible();
  // People 19,37,55,73,91 each authored one PR in Prebid.js; excluded person 1 is omitted.
  await expect(
    page.getByRole('region', { name: 'Report totals' }).locator('dd').first(),
  ).toHaveText('5');
  await page
    .getByRole('navigation', { name: 'Company breakdown' })
    .getByRole('link', { name: 'By repository', exact: true })
    .click();
  await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(1);
  await expect(page.getByRole('table').locator('tbody [data-column="prsAuthored"]')).toHaveText(
    '5',
  );
});
test('periods, repository selection, saved defaults, explicit URLs and Back/Forward agree', async ({
  page,
}) => {
  await login(page);
  await page.goto('/contributors');
  await page.getByRole('combobox', { name: 'Reporting period preset' }).selectOption('this-month');
  await ready(page);
  await chooseRepos(page, ['Prebid.js']);
  const filtered = page.url();
  await page.goto('/companies');
  await expect(page.getByRole('combobox', { name: 'Reporting period preset' })).toHaveValue(
    'this-month',
  );
  await expect(page.getByRole('button', { name: /^Choose repositories 1 \/ 18/ })).toBeVisible();
  await page.goto('/contributors?period=this-year');
  await expect(page.getByRole('button', { name: /^Choose repositories 18 \/ 18/ })).toBeVisible();
  await page.goto(filtered);
  await page
    .getByRole('button', { name: 'Custom range for Reporting period', exact: true })
    .click();
  const dates = page.getByRole('dialog', { name: 'Custom date range' });
  await dates.getByLabel('Start date', { exact: true }).fill('2026-10-01');
  await dates.getByLabel('End date', { exact: true }).fill('2026-10-01');
  await dates.getByRole('button', { name: 'Apply dates', exact: true }).click();
  await ready(page);
  await expect(page.getByRole('region', { name: 'Contribution report scope' })).toContainText(
    'Custom range',
  );
  await page.goBack();
  await expect(page.getByRole('combobox', { name: 'Reporting period preset' })).toHaveValue(
    'this-month',
  );
  await page.goForward();
  await expect(
    page.getByRole('button', { name: 'Edit custom range for Reporting period' }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole('button', { name: 'Edit custom range for Reporting period' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Reset filters', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Reporting period preset' })).toHaveValue(
    'this-year',
  );
  await expect(page.getByRole('button', { name: /^Choose repositories 18 \/ 18/ })).toBeVisible();
});
test('explicit empty repository/population selections stay empty and incomplete history stays distinct from zero', async ({
  page,
}) => {
  await login(page);
  await page.goto('/contributors?sample=large&population=selected');
  await expect(page.getByRole('heading', { name: 'No accounts match this report' })).toBeVisible();
  await page.getByRole('button', { name: 'Reset filters', exact: true }).click();
  await chooseRepos(page, []);
  await expect(page.getByRole('heading', { name: 'No repositories selected' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'No repositories selected' })).toBeVisible();
  await page.getByRole('button', { name: 'Reset filters', exact: true }).click();
  await page
    .getByRole('combobox', { name: 'Reporting period preset' })
    .selectOption('last-full-year');
  await expect(page.getByLabel('Data coverage')).toContainText('Reporting values are unavailable');
  await expect(
    page.getByRole('heading', { name: 'No confirmed contributions to list' }),
  ).toBeVisible();
  await expect(page.getByRole('table')).toHaveCount(0);
  await page.goto('/contributors?exclude=removed-account');
  await expect(page.getByRole('heading', { name: 'Invalid contribution view' })).toBeVisible();
});
test('filter toolbar and population dialog remain accessible on desktop and mobile', async ({
  page,
}, info) => {
  await login(page);
  await page.goto('/contributors');
  await ready(page);
  expect((await new AxeBuilder({ page }).include('main').analyze()).violations).toEqual([]);
  await page.screenshot({
    path: info.outputPath('contribution-controls-desktop.png'),
    fullPage: true,
  });
  await page.setViewportSize({ width: 375, height: 900 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  await page.getByRole('button', { name: 'All accounts', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Include and exclude accounts' });
  await expect(dialog).toHaveCSS('opacity', '1');
  await dialog.getByRole('radio', { name: 'Selected accounts', exact: true }).check();
  expect((await new AxeBuilder({ page }).include('[role="dialog"]').analyze()).violations).toEqual(
    [],
  );
  await expect(
    dialog.getByRole('button', { name: 'Apply accounts', exact: true }),
  ).toBeInViewport();
  await expect(dialog.getByRole('button', { name: 'Cancel', exact: true })).toBeInViewport();
  await page.screenshot({ path: info.outputPath('contribution-population-mobile.png') });
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'All accounts', exact: true })).toBeFocused();
  await page.screenshot({
    path: info.outputPath('contribution-controls-mobile.png'),
    fullPage: true,
  });
});
