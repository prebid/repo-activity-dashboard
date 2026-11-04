import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';
import { readCsv } from '../support/csv';
import { reportMetricIds } from '../../src/models/contribution-metrics';

// The Contributors and Reviewers lenses over one contribution report (Phase 6), and the Companies
// lens, lens=all (Phase 7).

async function login(page: Page) {
  await page.goto('/auth/login');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/repos$/);
}
const masthead = (page: Page) =>
  page.getByRole('navigation', { name: 'Main navigation', exact: true });
const lensNames = ['Contributors', 'Reviewers', 'Companies'] as const;
const lensLink = (page: Page, name: (typeof lensNames)[number]) =>
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
    for (const [path, on] of [
      ['/reviewers', 'Reviewers'],
      ['/companies?lens=reviewers', 'Reviewers'],
      ['/contributors/account-alice?lens=reviewers', 'Reviewers'],
      ['/companies', 'Contributors'],
      ['/contributors/account-alice', 'Contributors'],
      ['/companies?lens=all', 'Companies'],
      ['/companies/id/company-acme?lens=all', 'Companies'],
      ['/contributors/account-alice?lens=all', 'Companies'],
    ] as const) {
      expect((await html.goto(path))?.status(), path).toBe(200);
      // Exactly one destination is marked.
      for (const name of lensNames)
        await expect(lensLink(html, name), path + ' ' + name).toHaveAttribute(
          'data-active',
          String(name === on),
        );
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
  await lensLink(page, 'Companies').click();
  await expect(page).toHaveURL(/\/companies\?lens=all$/);
  await expect(lensLink(page, 'Companies')).toHaveAttribute('aria-current', 'page');
  await expect(lensLink(page, 'Reviewers')).toHaveAttribute('data-active', 'false');
  await expect(lensLink(page, 'Contributors')).toHaveAttribute('data-active', 'false');
  await expect(page).toHaveTitle('Companies · All activity');
  expect(documents).toEqual([]);
  expect(hydration).toEqual([]);
});

test('the Companies lens lists companies with the six credits and keeps the lens on their pages', async ({
  page,
}) => {
  await login(page);
  await page.goto('/companies?lens=all');
  await expect(
    page.getByRole('heading', { name: 'Companies', level: 1, exact: true }),
  ).toBeVisible();
  await expect(page).toHaveTitle('Companies · All activity');
  const table = page.getByRole('table', { name: 'Companies', exact: true });
  await expect(table).toBeVisible();
  expect(await visibleMetrics(page)).toEqual(allCredits);
  for (const name of [
    'PRs authored',
    'Authored PRs merged',
    'Reviewer contributions',
    'Approval contributions',
    'Merges performed',
    'Issues authored',
  ])
    await expect(table.getByRole('columnheader', { name, exact: true }), name).toBeVisible();
  await expect(
    table.getByRole('columnheader', { name: 'Authored PRs merged', exact: true }),
  ).toHaveAttribute('aria-sort', 'descending');
  await expect(
    page.getByRole('button', { name: 'Columns · All credits', exact: true }),
  ).toBeVisible();
  // The lens has no subject tabs: the view bar holds Report and Over time only.
  await expect(
    page.getByRole('navigation', { name: 'Contribution reports', exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('navigation', { name: 'Report view', exact: true }).getByRole('link'),
  ).toHaveText(['Report', 'Over time']);
  await expect(lensLink(page, 'Companies')).toHaveAttribute('aria-current', 'page');
  // The rows are sorted by Authored PRs merged, largest first.
  const merged = (
    await rows(page).locator('[data-column="authoredPrsMerged"]').allTextContents()
  ).map((text) => Number(text.replace(/[^0-9]/g, '')));
  expect(merged.length).toBeGreaterThan(1);
  expect(merged).toEqual([...merged].sort((a, b) => b - a));
  // A company link carries the lens, and its crumb returns to the Companies lens.
  await table.getByRole('link', { name: 'Example Acme', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Example Acme', level: 1, exact: true }),
  ).toBeVisible();
  expect(new URL(page.url()).pathname).toBe('/companies/id/company-acme');
  expect(new URL(page.url()).searchParams.get('lens')).toBe('all');
  await expect(page).toHaveTitle('Example Acme · Companies · All activity');
  await expect(lensLink(page, 'Companies')).toHaveAttribute('data-active', 'true');
  await expect(page.getByRole('table', { name: 'Company members', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Back to Companies', exact: true }).click();
  await expect(page).toHaveURL(/\/companies\?lens=all(&v=1)?$/);
  await expect(
    table.getByRole('columnheader', { name: 'Authored PRs merged', exact: true }),
  ).toHaveAttribute('aria-sort', 'descending');
  await expect(page).toHaveTitle('Companies · All activity');
});

test('every metric stays addable in the Companies lens', async ({ page }) => {
  await login(page);
  await page.goto('/companies?lens=all');
  await page.getByRole('button', { name: 'Columns · All credits', exact: true }).click();
  // No metric is locked in the menu; only the required identity column is.
  const locked = columnsMenu(page).getByRole('menuitemcheckbox', { disabled: true });
  await expect(locked).toHaveCount(1);
  await expect(locked).toHaveAccessibleName('Company (required)');
  await columnsMenu(page).getByRole('menuitemradio', { name: 'All columns', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Columns · All columns', exact: true }),
  ).toBeVisible();
  await page.keyboard.press('Escape');
  await expect.poll(async () => (await visibleMetrics(page)).length).toBe(39);
  expect(new Set(await visibleMetrics(page))).toEqual(metrics);
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

test('Over time draws the report headings over the core metrics, outside its CSV headers', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await login(page);
  await page.goto('/contributors?timeline');
  const table = page.getByRole('table').first();
  const box = async (name: string) =>
    (await table.getByRole('columnheader', { name, exact: true }).boundingBox())!;
  await expect(table.getByRole('columnheader', { name: 'Authoring', exact: true })).toBeVisible();
  // Each heading spans exactly the headers of its metrics.
  for (const [heading, first, last] of [
    ['Authoring', 'PRs authored', 'Authored PRs merged'],
    ['Issues', 'Issues authored', 'Issues authored'],
  ] as const) {
    const group = await box(heading),
      start = await box(first),
      end = await box(last);
    expect(Math.abs(group.x - start.x), heading).toBeLessThanOrEqual(1);
    expect(Math.abs(group.x + group.width - (end.x + end.width)), heading).toBeLessThanOrEqual(1);
    expect(group.y + group.height, heading).toBeLessThanOrEqual(start.y + 1);
  }
  const { headers } = await csvDownload(page);
  expect(
    headers.filter((header) => /Authoring|Reviewing|^Issues\b(?! authored)/.test(header)),
  ).toEqual([]);
  expect(headers.slice(headers.indexOf('PRs authored'), headers.indexOf('Metric IDs'))).toEqual(
    ['PRs authored', 'Authored PRs merged', 'Issues authored'].flatMap((label) => [
      label,
      label + ' coverage',
      label + ' coverage detail',
      label + ' unit',
    ]),
  );
});
