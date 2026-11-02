import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';
import { readCsv } from '../support/csv';
import { reportMetricIds } from '../../src/models/contribution-metrics';

// The Contributors and Reviewers lenses over one contribution report (Phase 6).

async function login(page: Page) {
  await page.goto('/auth/login');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/repos$/);
}
const masthead = (page: Page) =>
  page.getByRole('navigation', { name: 'Main navigation', exact: true });
const lensLink = (page: Page, name: 'Contributors' | 'Reviewers') =>
  masthead(page).getByRole('link', { name, exact: true });
const rows = (page: Page) => page.getByRole('table').first().locator('tbody tr');
const columnsButton = (page: Page) => page.getByRole('button', { name: /^Columns · / });
const columnsMenu = (page: Page) => page.getByRole('menu', { name: /^Columns · / });
const metrics: ReadonlySet<string> = new Set(reportMetricIds);
/** The visible columns, in order, read from the first body row's cells. */
function visibleColumns(page: Page) {
  return rows(page)
    .first()
    .locator('td[data-column]')
    .evaluateAll((cells) => cells.map((cell) => cell.getAttribute('data-column') ?? ''));
}
async function visibleMetrics(page: Page) {
  return (await visibleColumns(page)).filter((id) => metrics.has(id));
}
async function chooseSet(page: Page, from: string, set: string) {
  await page.getByRole('button', { name: 'Columns · ' + from, exact: true }).click();
  await columnsMenu(page).getByRole('menuitemradio', { name: set, exact: true }).click();
  await expect(page.getByRole('button', { name: 'Columns · ' + set, exact: true })).toBeVisible();
}
async function csvDownload(page: Page) {
  await page.getByRole('button', { name: 'Export CSV', exact: true }).click();
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download CSV', exact: true }).click();
  const stream = await (await pending).createReadStream();
  let csv = '';
  for await (const chunk of stream) csv += String(chunk);
  await expect(page.getByRole('dialog')).toBeHidden();
  return readCsv(csv);
}
const contributorSet = ['prsAuthored', 'authoredPrsMerged', 'issuesAuthored'];
const reviewerSet = ['reviewerContributions', 'approvalContributions', 'mergesPerformed'];
/** The six core credit columns in the report order the people table showed before the lenses. */
const allCredits = [
  'prsAuthored',
  'authoredPrsMerged',
  'reviewerContributions',
  'approvalContributions',
  'mergesPerformed',
  'issuesAuthored',
];

test('the masthead reads the lens on the server render and follows in-app navigation', async ({
  browser,
  page,
  baseURL,
}) => {
  const hydration: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error' && /hydrat|did not match/i.test(message.text()))
      hydration.push(message.text());
  });
  await login(page);
  // 1. Server render only: without JavaScript the markup is the force-dynamic layout's.
  const noScript = await browser.newContext({
    baseURL,
    javaScriptEnabled: false,
    storageState: await page.context().storageState(),
  });
  try {
    const html = await noScript.newPage();
    for (const [path, on, off] of [
      ['/reviewers', 'Reviewers', 'Contributors'],
      ['/companies?lens=reviewers', 'Reviewers', 'Contributors'],
      ['/contributors/account-alice?lens=reviewers', 'Reviewers', 'Contributors'],
      ['/companies', 'Contributors', 'Reviewers'],
      ['/contributors/account-alice', 'Contributors', 'Reviewers'],
    ] as const) {
      expect((await html.goto(path))?.status(), path).toBe(200);
      await expect(lensLink(html, on), path).toHaveAttribute('data-active', 'true');
      await expect(lensLink(html, off), path).toHaveAttribute('data-active', 'false');
    }
  } finally {
    await noScript.close();
  }
  // 2. Client navigation: a query-only change, Back and Forward, and path changes, with no
  // document request.
  await page.goto('/companies');
  await expect(page.getByRole('button', { name: 'Theme settings', exact: true })).toBeEnabled();
  const documents: string[] = [];
  page.on('request', (request) => {
    if (request.resourceType() === 'document') documents.push(request.url());
  });
  await page.evaluate(() =>
    (window as unknown as { next: { router: { push(href: string): void } } }).next.router.push(
      '/companies?lens=reviewers',
    ),
  );
  await expect(page).toHaveURL(/\/companies\?lens=reviewers$/);
  await expect(lensLink(page, 'Reviewers')).toHaveAttribute('data-active', 'true');
  await page.goBack();
  await expect(lensLink(page, 'Contributors')).toHaveAttribute('data-active', 'true');
  await page.goForward();
  await expect(lensLink(page, 'Reviewers')).toHaveAttribute('data-active', 'true');
  await lensLink(page, 'Contributors').click();
  await expect(page).toHaveURL(/\/contributors$/);
  await expect(lensLink(page, 'Contributors')).toHaveAttribute('aria-current', 'page');
  await expect(lensLink(page, 'Reviewers')).toHaveAttribute('data-active', 'false');
  await lensLink(page, 'Reviewers').click();
  await expect(page).toHaveURL(/\/reviewers$/);
  await expect(lensLink(page, 'Reviewers')).toHaveAttribute('aria-current', 'page');
  await expect(page).toHaveTitle('Reviewers');
  expect(documents).toEqual([]);
  expect(hydration).toEqual([]);
});

test('/reviewers opens the Reviewer set sorted by Reviewer contributions', async ({ page }) => {
  await login(page);
  await page.goto('/reviewers');
  await expect(
    page.getByRole('heading', { name: 'Reviewers', level: 1, exact: true }),
  ).toBeVisible();
  await expect(page).toHaveTitle('Reviewers');
  const table = page.getByRole('table', { name: 'Reviewers', exact: true });
  await expect(table).toBeVisible();
  await expect(
    table.getByRole('columnheader', { name: 'Reviewer contributions', exact: true }),
  ).toHaveAttribute('aria-sort', 'descending');
  expect(await visibleMetrics(page)).toEqual(reviewerSet);
  await expect(page.getByRole('button', { name: 'Columns · Reviewer', exact: true })).toBeVisible();
  await expect(
    page
      .getByRole('navigation', { name: 'Contribution reports', exact: true })
      .getByRole('link', { name: 'Reviewers', exact: true }),
  ).toHaveAttribute('aria-current', 'page');
  await expect(lensLink(page, 'Reviewers')).toHaveAttribute('aria-current', 'page');
});

test('All credits gives the six core columns in each lens, and every metric stays addable', async ({
  page,
}) => {
  await login(page);
  for (const [path, set] of [
    ['/contributors', 'Contributor'],
    ['/reviewers', 'Reviewer'],
  ] as const) {
    await page.goto(path);
    expect(await visibleMetrics(page), path).toEqual(
      set === 'Contributor' ? contributorSet : reviewerSet,
    );
    await chooseSet(page, set, 'All credits');
    await page.keyboard.press('Escape');
    // The people table before the lenses: its identity columns and the six core credits.
    await expect
      .poll(() => visibleColumns(page), { message: path })
      .toEqual(['name', 'actorType', 'company', ...allCredits]);
    // No metric is locked in the menu; only the required identity column is.
    await columnsButton(page).click();
    const locked = columnsMenu(page).getByRole('menuitemcheckbox', { disabled: true });
    await expect(locked, path).toHaveCount(1);
    await expect(locked, path).toHaveAccessibleName('Contributor (required)');
    await columnsMenu(page)
      .getByRole('menuitemradio', { name: 'All columns', exact: true })
      .click();
    await expect(
      page.getByRole('button', { name: 'Columns · All columns', exact: true }),
    ).toBeVisible();
    await page.keyboard.press('Escape');
    await expect.poll(async () => (await visibleMetrics(page)).length, { message: path }).toBe(39);
    expect(new Set(await visibleMetrics(page)), path).toEqual(metrics);
  }
});

test('a set that hides the sort column applies its lead sort in one history entry', async ({
  page,
}) => {
  await login(page);
  await page.goto('/reviewers');
  const table = page.getByRole('table', { name: 'Reviewers', exact: true });
  await expect(
    table.getByRole('columnheader', { name: 'Reviewer contributions', exact: true }),
  ).toHaveAttribute('aria-sort', 'descending');
  const entries = await page.evaluate(() => history.length);
  await chooseSet(page, 'Reviewer', 'Contributor');
  await expect(
    table.getByRole('columnheader', { name: 'Authored PRs merged', exact: true }),
  ).toHaveAttribute('aria-sort', 'descending');
  expect(new URL(page.url()).searchParams.get('sort')).toBe('-authoredPrsMerged');
  expect(await page.evaluate(() => history.length)).toBe(entries + 1);
  await page.keyboard.press('Escape');
  expect(await visibleMetrics(page)).toEqual(contributorSet);
  await page.goBack();
  await expect(page).toHaveURL(/\/reviewers(\?v=1)?$/);
  await expect(
    table.getByRole('columnheader', { name: 'Reviewer contributions', exact: true }),
  ).toHaveAttribute('aria-sort', 'descending');
  await expect(page.getByRole('button', { name: 'Columns · Reviewer', exact: true })).toBeVisible();
  // A set that keeps the sort column leaves the sort alone.
  await chooseSet(page, 'Reviewer', 'All credits');
  await expect(
    table.getByRole('columnheader', { name: 'Reviewer contributions', exact: true }),
  ).toHaveAttribute('aria-sort', 'descending');
  expect(new URL(page.url()).searchParams.get('sort')).toBeNull();
});

test('filters are shared across the lenses while each lens keeps its own sort', async ({
  page,
}) => {
  await login(page);
  await page.goto('/contributors');
  const period = page.getByRole('combobox', { name: 'Reporting period preset' });
  await period.selectOption('last-month');
  await expect(page).toHaveURL(/[?&]period=last-month(&|$)/);
  await lensLink(page, 'Reviewers').click();
  await expect(page).toHaveURL(/\/reviewers\?(.*&)?period=last-month(&|$)/);
  await expect(
    page.getByRole('heading', { name: 'Reviewers', level: 1, exact: true }),
  ).toBeVisible();
  await expect(period).toHaveValue('last-month');
  const reviewers = page.getByRole('table', { name: 'Reviewers', exact: true });
  const approvals = reviewers.getByRole('columnheader', {
    name: 'Approval contributions',
    exact: true,
  });
  await approvals.getByRole('button').click();
  await expect(approvals).not.toHaveAttribute('aria-sort', 'none');
  const direction = await approvals.getAttribute('aria-sort');
  await lensLink(page, 'Contributors').click();
  await expect(page).toHaveURL(/\/contributors\?(.*&)?period=last-month(&|$)/);
  await expect(
    page
      .getByRole('table', { name: 'Contributors', exact: true })
      .getByRole('columnheader', { name: 'Authored PRs merged', exact: true }),
  ).toHaveAttribute('aria-sort', 'descending');
  expect(new URL(page.url()).searchParams.get('sort')).toBeNull();
  await lensLink(page, 'Reviewers').click();
  await expect(page).toHaveURL(/\/reviewers\?/);
  await expect(approvals).toHaveAttribute('aria-sort', direction!);
  await expect(period).toHaveValue('last-month');
});

test('the lens follows a person link, its metric link, Over time and the CSV', async ({ page }) => {
  await login(page);
  await page.goto('/reviewers');
  await page.getByRole('link', { name: 'Alice — view contribution report', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Alice', level: 1, exact: true })).toBeVisible();
  expect(new URL(page.url()).pathname).toBe('/contributors/account-alice');
  expect(new URL(page.url()).searchParams.get('lens')).toBe('reviewers');
  await expect(page).toHaveTitle('Alice · Reviewers');
  await expect(page.getByRole('link', { name: 'Back to Reviewers', exact: true })).toBeVisible();
  await expect(lensLink(page, 'Reviewers')).toHaveAttribute('data-active', 'true');
  const totals = page.getByRole('region', { name: 'Report totals', exact: true });
  await expect(totals.getByRole('group')).toHaveCount(2);
  await expect(totals.getByRole('group').first()).toHaveAccessibleName('Reviewer activity');
  await expect(totals.getByRole('group').nth(1)).toHaveAccessibleName('Contributor activity');
  const report = await csvDownload(page);
  expect(report.records.length).toBeGreaterThan(0);
  expect(new Set(report.records.map((record) => record['Report lens']))).toEqual(
    new Set(['reviewers']),
  );
  const person = page.url();
  await totals
    .getByRole('link', { name: /^Approval contributions: \d+ — view supporting records$/ })
    .click();
  await expect(page).toHaveURL(/[?&]metric=approvalContributions(&|$)/);
  expect(new URL(page.url()).searchParams.get('lens')).toBe('reviewers');
  await expect(page).toHaveTitle('Approval contributions · Alice · Reviewers');
  await page.goto(person);
  await page
    .getByRole('navigation', { name: 'Report view', exact: true })
    .getByRole('link', { name: 'Over time', exact: true })
    .click();
  await expect(page).toHaveURL(/[?&]timeline(&|$)/);
  expect(new URL(page.url()).searchParams.get('lens')).toBe('reviewers');
  await expect(page).toHaveTitle('Over time · Alice · Reviewers');
  await expect(page.getByRole('button', { name: 'Columns · Reviewer', exact: true })).toBeVisible();
  const timeline = await csvDownload(page);
  expect(new Set(timeline.records.map((record) => record['Report lens']))).toEqual(
    new Set(['reviewers']),
  );
});

test('a report with no reviewer evidence says so only in the Reviewers lens', async ({ page }) => {
  await login(page);
  await page.goto('/contributors/account-finn?lens=reviewers');
  await expect(page.getByRole('heading', { name: 'Finn', level: 1, exact: true })).toBeVisible();
  const notice = page.getByRole('complementary', { name: 'Reviewer activity', exact: true });
  await expect(notice).toContainText('No reviewer activity in this scope.');
  await page.goto('/contributors/account-finn');
  await expect(page.getByRole('heading', { name: 'Finn', level: 1, exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Report totals', exact: true })).toBeVisible();
  await expect(notice).toHaveCount(0);
});

test('the Reviewers lens lists reviewer evidence, with Show all for every account', async ({
  page,
}) => {
  await login(page);
  // The large sample's ranking: 50 accounts with at least five reviewer credits, then four.
  await page.goto('/reviewers?sample=large');
  await expect(page.getByText('Page 1 of 5', { exact: true })).toBeVisible();
  await expect(rows(page)).toHaveCount(50);
  await expect(rows(page).last().locator('[data-column="reviewerContributions"]')).toHaveText('5');
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByText('Page 2 of 5', { exact: true })).toBeVisible();
  await expect(rows(page).first().locator('[data-column="reviewerContributions"]')).toHaveText('4');
  // The reference sample: Finn has an issue and an issue comment, no reviewer credit.
  await page.goto('/reviewers');
  const table = page.getByRole('table', { name: 'Reviewers', exact: true });
  await expect(rows(page)).toHaveCount(6);
  const finn = table.getByRole('link', { name: 'Finn — view contribution report', exact: true });
  await expect(finn).toHaveCount(0);
  const reviewerCsv = await csvDownload(page);
  expect(reviewerCsv.records).toHaveLength(6);
  expect(new Set(reviewerCsv.records.map((record) => record['Listed accounts']))).toEqual(
    new Set(['Reviewer activity']),
  );
  await page.getByRole('switch', { name: 'Show all 7 accounts', exact: true }).click();
  await expect(page).toHaveURL(/\/reviewers\?(.*&)?all(&|$)/);
  await expect(rows(page)).toHaveCount(7);
  await expect(finn).toBeVisible();
  const allCsv = await csvDownload(page);
  expect(allCsv.records).toHaveLength(7);
  expect(new Set(allCsv.records.map((record) => record['Listed accounts']))).toEqual(
    new Set(['All accounts with activity']),
  );
  // Companies qualify through a reviewer member; Example Prebid's only member does not review.
  await page.goto('/companies?lens=reviewers&sample=large');
  await expect(
    page.getByRole('heading', { name: 'Companies', level: 1, exact: true }),
  ).toBeVisible();
  await expect(rows(page)).toHaveCount(3);
  await page.getByRole('switch', { name: 'Show all 4 companies', exact: true }).click();
  await expect(rows(page)).toHaveCount(4);
});

test('company rosters hide zero totals by the lens role', async ({ page }) => {
  await login(page);
  const finn = (page: Page) =>
    page.getByRole('link', { name: 'Finn — view contribution report', exact: true });
  await page.goto('/companies/id/company-beacon');
  await expect(
    page.getByRole('table', { name: 'Company contributors', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('checkbox', { name: 'Hide zero reviewer totals' })).toHaveCount(0);
  await page.getByRole('checkbox', { name: 'Hide zero totals', exact: true }).check();
  await expect(finn(page)).toBeVisible();
  await page.goto('/companies/id/company-beacon?lens=reviewers');
  const members = page.getByRole('table', { name: 'Company members', exact: true });
  await expect(members).toBeVisible();
  await expect(finn(page)).toBeVisible();
  await expect(page.getByRole('checkbox', { name: 'Hide zero totals', exact: true })).toHaveCount(
    0,
  );
  await page.getByRole('checkbox', { name: 'Hide zero reviewer totals', exact: true }).check();
  await expect(finn(page)).toHaveCount(0);
  await expect(
    members.getByRole('link', { name: 'Carol — view contribution report', exact: true }),
  ).toBeVisible();
});
