import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';
import { contributionSample } from '../../src/mocks/contributions';
import {
  defaultContributionSettings,
  writeContributionSettings,
} from '../../src/lib/presentation/contribution-settings';

const source = contributionSample({ scenario: 'large' });
const people = source.accounts
  .filter((account) => account.id.startsWith('account-person-'))
  .slice(0, 130);
function settings() {
  const value = defaultContributionSettings(source);
  value.selection.population = {
    kind: 'selected',
    accountIds: people.map((account) => account.id),
    companyIds: [],
  };
  return value;
}
async function login(page: Page) {
  await page.goto('/auth/login');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/repos$/);
}
function assertScope(url: string, expected: ReturnType<typeof settings>) {
  const params = new URL(url).searchParams;
  expect(params.getAll('account').sort()).toEqual([...people.map((account) => account.id)].sort());
  expect(params.getAll('exclude').sort()).toEqual(
    [...expected.selection.excludedAccountIds].sort(),
  );
  expect(params.getAll('type')).toEqual(['human']);
  expect(params.get('period')).toBe('this-year');
}
test('130 selected accounts retain every visible drilldown with bounded per-page link text', async ({
  page,
}, info) => {
  await login(page);
  await page.goto('/contributors?' + writeContributionSettings('sample=large', settings()));
  const table = page.getByRole('table', { name: 'Contributors', exact: true });
  await expect(table.locator('tbody tr')).toHaveCount(50);
  await expect(table.getByRole('link', { name: / — view contribution report$/ })).toHaveCount(50);
  await expect(table.getByRole('link', { name: / — view supporting records$/ })).toHaveCount(300);
  const hrefs = await table
    .locator('a[href]')
    .evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute('href')!).filter((href) => href.startsWith('/')),
    );
  const lengths = hrefs.map((href) => Buffer.byteLength(href));
  expect(Math.max(...lengths)).toBeLessThan(5100);
  expect(lengths.reduce((sum, size) => sum + size, 0)).toBeLessThan(2_000_000);
  await expect(page.getByText(/This selection is too large for a detail link/)).toHaveCount(0);
  await page.screenshot({ path: info.outputPath('large-selection-links.png'), fullPage: true });
  await page.screenshot({ path: info.outputPath('large-selection-viewport.png') });
});
test('copied links and browser history retain parent scope after child account, exclusion and period edits', async ({
  page,
  context,
  browser,
}) => {
  await login(page);
  const root = settings();
  root.selection.actorTypes = ['human'];
  root.selection.excludedAccountIds = ['account-person-129'];
  const params = new URLSearchParams(writeContributionSettings('sample=large', root));
  params.set('report.page', '2');
  params.set('report.sort', 'prsAuthored');
  params.set('report.dir', 'desc');
  params.set('report.q', 'Sample contributor');
  const columns = ['name', 'actorType', 'prsAuthored'];
  for (const column of columns) params.append('contributors.columns', column);
  await page.goto('/contributors?' + params.toString());
  const table = page.getByRole('table', { name: 'Contributors', exact: true });
  await expect(page.getByText('Page 2 of 3', { exact: true })).toBeVisible();
  await table
    .getByRole('link', { name: / — view contribution report$/ })
    .first()
    .click();
  await expect(page.getByRole('table', { name: 'By repository', exact: true })).toBeVisible();
  const personPath = new URL(page.url()).pathname;
  const personId = personPath.split('/').at(-1)!;
  await page
    .getByRole('table', { name: 'By repository', exact: true })
    .getByRole('link', { name: /^PRs authored:/ })
    .first()
    .click();
  await expect(page.getByRole('region', { name: 'Supporting record totals' })).toBeVisible();
  const detailHref = page.url();
  await page.goBack();
  await expect(page.getByRole('table', { name: 'By repository', exact: true })).toBeVisible();
  expect(new URL(page.url()).pathname).toBe(personPath);
  assertScope(page.url(), root);
  await page.goForward();
  await expect(page.getByRole('region', { name: 'Supporting record totals' })).toBeVisible();
  expect(new URL(page.url()).searchParams.get('metric')).toBe('prsAuthored');

  // Only authentication cookies are copied; the return trail cannot rely on local preferences.
  const copiedContext = await browser.newContext({
    storageState: { cookies: (await context.storageState()).cookies, origins: [] },
  });
  try {
    const copied = await copiedContext.newPage();
    await copied.goto(detailHref);
    await expect(copied.getByRole('region', { name: 'Supporting record totals' })).toBeVisible();
    const [remove, exclude] = people.filter(
      (account) => account.id !== personId && account.id !== 'account-person-129',
    );
    await copied.getByRole('button', { name: /^Selected accounts/ }).click();
    const dialog = copied.getByRole('dialog');
    const individuals = dialog.getByRole('group', { name: /^Individuals/ });
    await individuals.getByRole('textbox', { name: 'Find individuals' }).fill(remove.login);
    await individuals
      .getByRole('checkbox', { name: remove.name + ' (@' + remove.login + ')', exact: true })
      .uncheck();
    const exclusions = dialog.getByRole('group', { name: /^Exclusions/ });
    await exclusions.getByRole('textbox', { name: 'Find exclusions' }).fill(exclude.login);
    await exclusions
      .getByRole('checkbox', { name: exclude.name + ' (@' + exclude.login + ')', exact: true })
      .check();
    await dialog.getByRole('button', { name: 'Apply accounts', exact: true }).click();
    await expect.poll(() => new URL(copied.url()).searchParams.getAll('account').length).toBe(129);
    expect(new URL(copied.url()).searchParams.getAll('exclude').sort()).toEqual(
      ['account-person-129', exclude.id].sort(),
    );
    await copied
      .getByRole('combobox', { name: 'Reporting period preset', exact: true })
      .selectOption('last-month');
    await expect(copied).toHaveURL(/period=last-month/);
    await copied.reload();
    await copied.getByRole('link', { name: 'Back to report', exact: true }).click();
    await expect(copied.getByRole('table', { name: 'By repository', exact: true })).toBeVisible();
    assertScope(copied.url(), root);
    await copied.getByRole('link', { name: 'Back to report', exact: true }).click();
    await expect(copied.getByRole('table', { name: 'Contributors', exact: true })).toBeVisible();
    await expect(copied.getByText('Page 2 of 3', { exact: true })).toBeVisible();
    await expect(
      copied.getByRole('textbox', { name: 'Search Contributors', exact: true }),
    ).toHaveValue('Sample contributor');
    await expect(copied.getByRole('columnheader', { name: /PRs authored/ })).toHaveAttribute(
      'aria-sort',
      'descending',
    );
    expect(new URL(copied.url()).searchParams.getAll('contributors.columns')).toEqual(columns);
    assertScope(copied.url(), root);
  } finally {
    await copiedContext.close();
  }
});
test('a shared v1 bookmark restores frozen presentation and upgrades its remaining return trail', async ({
  page,
}) => {
  await login(page);
  const nav = Buffer.from(
    JSON.stringify([
      1,
      [['1'], ['large'], ['this-year'], ['name', 'prsAuthored'], ['name'], ['desc'], ['2']],
      [
        [
          '/companies/id/company-acme',
          [
            ['scope', 0],
            ['sample', 1],
            ['period', 2],
            ['members.columns', 3],
            ['members.sort', 4],
            ['members.dir', 5],
            ['members.page', 6],
          ],
        ],
        [
          '/companies',
          [
            ['scope', 0],
            ['sample', 1],
            ['period', 2],
          ],
        ],
      ],
    ]),
  ).toString('base64url');
  await page.goto(
    '/contributors/account-person-001?sample=large&scope=1&period=this-year&nav=' + nav,
  );
  await page.getByRole('link', { name: 'Back to report', exact: true }).click();
  await expect(
    page.getByRole('table', { name: 'Company contributors', exact: true }),
  ).toBeVisible();
  await expect(page.getByText('Page 2 of 2', { exact: true })).toBeVisible();
  expect(new URL(page.url()).searchParams.getAll('members.columns')).toEqual([
    'name',
    'prsAuthored',
  ]);
  const packed = JSON.parse(
    Buffer.from(new URL(page.url()).searchParams.get('nav')!, 'base64url').toString('utf8'),
  ) as unknown[];
  expect(packed[0]).toBe(2);
  await page.reload();
  await page.getByRole('link', { name: 'Back to report', exact: true }).click();
  await expect(page.getByRole('table', { name: 'Companies', exact: true })).toBeVisible();
});
test('malformed compact context falls back safely while the current report remains usable', async ({
  page,
}) => {
  await login(page);
  const nav = Buffer.from(
    JSON.stringify([
      2,
      [{ p: 'x'.repeat(4000), w: 1, s: 'y'.repeat(500) }],
      [['/contributors', [['account', 0]]]],
    ]),
  ).toString('base64url');
  const response = await page.goto(
    '/contributors/account-alice?scope=1&period=this-year&nav=' + nav,
  );
  expect(response?.status()).toBe(200);
  await expect(page.getByRole('table', { name: 'By repository', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Back to report', exact: true }).click();
  await expect(page.getByRole('table', { name: 'Contributors', exact: true })).toBeVisible();
  expect(new URL(page.url()).searchParams.has('nav')).toBe(false);
});
