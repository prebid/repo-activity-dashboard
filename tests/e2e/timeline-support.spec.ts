import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';
import { readCsv } from '../support/csv';
import AxeBuilder from '@axe-core/playwright';
async function login(page: Page) {
  await page.goto('/auth/login');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/repos$/);
}
async function ready(page: Page) {
  await expect(page.getByLabel('Group by', { exact: true })).toBeEnabled();
}
async function csv(page: Page) {
  await page.getByRole('button', { name: 'Export CSV', exact: true }).click();
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download CSV', exact: true }).click();
  const stream = await (await pending).createReadStream();
  let text = '';
  for await (const chunk of stream) text += String(chunk);
  await expect(page.getByRole('dialog')).toBeHidden();
  return readCsv(text);
}
test('repository counts, nested authors, child search and copied returns retain the original timeline', async ({
  page,
  browser,
}, info) => {
  await login(page);
  await page.goto('/repos/prebidjs?timeline=1&timeline.sort=prsOpened&timeline.dir=desc');
  await ready(page);
  const parent = await page
    .getByRole('navigation', { name: 'Repository lists' })
    .getByRole('link', { name: 'Timeline', exact: true })
    .getAttribute('href');
  await page
    .getByRole('link', { name: 'Pull requests — Opened, Oct 2026: 78', exact: true })
    .click();
  await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(50);
  const records = await csv(page);
  expect(records.records).toHaveLength(78);
  expect(records.records.map((row) => row['PR'])).toEqual(
    expect.arrayContaining(['105', '107', '108']),
  );
  expect(records.records.every((row) => row['Full Timeline interval value'] === '78')).toBe(true);
  await page.getByRole('link', { name: '← Back to timeline', exact: true }).click();
  await expect(page).toHaveURL('http://127.0.0.1:3100' + parent);
  await ready(page);
  await page.getByRole('link', { name: 'Unique authors — PRs, Oct 2026: 18', exact: true }).click();
  await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(18);
  await page
    .getByRole('textbox', { name: 'Search Unique authors', exact: true })
    .fill('sample-bob');
  await page.getByRole('link', { name: 'sample-bob: 26 authored records', exact: true }).click();
  await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(26);
  const copied = page.url(),
    isolated = await browser.newContext(),
    other = await isolated.newPage();
  try {
    await login(other);
    await other.goto(copied);
    await expect(other.getByRole('table').locator('tbody tr')).toHaveCount(26);
    await other.getByRole('link', { name: '← Back to authors', exact: true }).click();
    await expect(
      other.getByRole('textbox', { name: 'Search Unique authors', exact: true }),
    ).toHaveValue('sample-bob');
    await expect(other.getByRole('table').locator('tbody tr')).toHaveCount(1);
  } finally {
    await isolated.close();
  }
  await page
    .getByRole('textbox', { name: 'Search Records by @sample-bob', exact: true })
    .fill('105');
  const filtered = await csv(page);
  expect(filtered.records).toHaveLength(1);
  expect(filtered.records[0]['PR']).toBe('105');
  expect(filtered.records[0]['Export row search']).toBe('105');
  await page.getByRole('link', { name: '← Back to authors', exact: true }).click();
  await expect(
    page.getByRole('textbox', { name: 'Search Unique authors', exact: true }),
  ).toHaveValue('sample-bob');
  await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(1);
  await page.getByRole('link', { name: '← Back to timeline', exact: true }).click();
  await ready(page);
  await expect(page).toHaveURL('http://127.0.0.1:3100' + parent);
  await page.screenshot({ path: info.outputPath('timeline-drilldown-return.png'), fullPage: true });
});
test('merge medians, known zero and supplied historical approvals open the correct supporting records', async ({
  page,
}, info) => {
  await login(page);
  await page.goto('/repos/prebidjs?timeline=1');
  await ready(page);
  await page
    .getByRole('link', { name: 'Duration — Median merge time, Oct 2026: 8.3 d', exact: true })
    .click();
  await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(44);
  const duration = await csv(page);
  // The supporting merge times reproduce the interval's median.
  const times = duration.records.map((row) => Number(row['Merge time'])).sort((a, b) => a - b);
  expect(times).toHaveLength(44);
  const middle = times.length / 2;
  expect((times[middle - 1] + times[middle]) / 2).toBeCloseTo(
    Number(duration.records[0]['Full Timeline interval value']),
    6,
  );
  // The empty sample repository has a known zero for every interval.
  await page.goto('/repos/prebid-mobile-ios-sdk?timeline=1');
  await ready(page);
  await page
    .getByRole('link', { name: 'Pull requests — Opened, Jan 2026: 0', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'No supporting records in this interval' }),
  ).toBeVisible();
  expect((await csv(page)).records).toHaveLength(0);
  await page.goto(
    '/repos/prebidjs?timeline=1&timeline.group=day&timeline.family=snapshot&period=custom&from=2026-10-21&through=2026-10-21',
  );
  await ready(page);
  await page
    .getByRole('link', { name: 'Human approvals — 1 approval, Oct 21, 2026: 32', exact: true })
    .click();
  await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(32);
  await expect(page.getByRole('table').locator('[data-column="approvals"]')).toHaveText(
    Array(32).fill('1'),
  );
  await expect(page.getByRole('link', { name: '107', exact: true })).toHaveAttribute(
    'target',
    '_blank',
  );
  const historical = await csv(page);
  expect(historical.records[0]['Historical cutoff (UTC)']).toBe('2026-10-22T00:00:00.000Z');
  expect(historical.records[0]['Human approvals at cutoff']).toBe('1');
  await page.screenshot({
    path: info.outputPath('timeline-historical-support.png'),
    fullPage: true,
  });
});
test('contribution credits, comment counts and final merged volume exports match their interval values', async ({
  page,
}, info) => {
  await login(page);
  await page.goto(
    '/contributors?timeline=1&repo=repo-prebidjs&account=account-bob&timeline.columns=reviewed.filesChanged',
  );
  await ready(page);
  await page.getByRole('link', { name: /Files changed, Oct 2026: 10$/ }).click();
  await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(1);
  const volume = await csv(page);
  expect(volume.records[0]['Files changed']).toBe('10');
  expect(volume.records[0]['Full Timeline interval value']).toBe('10');
  expect(volume.records[0]['Counting basis']).toBe('merged-volume');
  expect(volume.headers).toContain('GitHub account');
  expect(volume.records[0]['GitHub account']).toBe('sample-bob');
  await page.goto('/contributors?timeline=1&timeline.columns=prComments');
  await ready(page);
  const october = page
    .getByRole('table')
    .locator('tbody tr')
    .last()
    .locator('[data-column="prComments"] a');
  const label = await october.getAttribute('aria-label');
  const count = Number(label!.split(': ').at(-1));
  expect(count).toBeGreaterThan(0);
  await october.click();
  const comments = await csv(page);
  expect(comments.records.reduce((sum, row) => sum + Number(row['Comments']), 0)).toBe(count);
  expect(comments.records.every((row) => row['Counting basis'] === 'comments')).toBe(true);
  expect(comments.headers).not.toContain('Comment body');
  await page.goto('/contributors?timeline=1&type=human&exclude=account-alice');
  await ready(page);
  const credits = page
    .getByRole('table')
    .locator('tbody tr')
    .last()
    .locator('[data-column="reviewerContributions"] a');
  const creditCount = Number((await credits.getAttribute('aria-label'))!.split(': ').at(-1));
  await credits.click();
  const exported = await csv(page);
  expect(exported.records.reduce((sum, row) => sum + Number(row['Credits']), 0)).toBe(creditCount);
  expect(exported.records.some((row) => row['Account ID'] === 'account-alice')).toBe(false);
  await page.screenshot({
    path: info.outputPath('timeline-contribution-support.png'),
    fullPage: true,
  });
});
test('supporting lists paginate fifty rows while CSV exports every matching record', async ({
  page,
}) => {
  await login(page);
  await page.goto(
    '/contributors/account-heavy-agent?timeline=1&sample=large&timeline.columns=issuesAuthored',
  );
  await ready(page);
  const link = page
    .getByRole('table')
    .locator('tbody tr')
    .last()
    .locator('[data-column="issuesAuthored"] a');
  const count = Number((await link.getAttribute('aria-label'))!.split(': ').at(-1));
  expect(count).toBeGreaterThan(100);
  await link.click();
  await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(50);
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByText(/Page 2 of/)).toBeVisible();
  const exported = await csv(page);
  expect(exported.records).toHaveLength(count);
  expect(new Set(exported.records.map((row) => row['Record ID'])).size).toBe(count);
  const pageTwo = page.url();
  const recordHref = await page
    .getByRole('table')
    .locator('tbody tr')
    .first()
    .locator('[data-column="record"] a')
    .getAttribute('href');
  const number = new URL(recordHref!).pathname.split('/').at(-1)!;
  await page
    .getByRole('textbox', { name: 'Search Supporting contributions', exact: true })
    .fill('#' + number);
  const filtered = await csv(page);
  expect(filtered.records).toHaveLength(1);
  expect(filtered.records[0]['Export row search']).toBe('#' + number);
  await page.goto(pageTwo);
  await expect(page.getByText(/Page 2 of/)).toBeVisible();
  await page
    .getByRole('textbox', { name: 'Search Supporting contributions', exact: true })
    .fill('#' + number);
  await page.getByRole('button', { name: 'Columns', exact: true }).click();
  await page.getByRole('menuitemcheckbox', { name: 'Credited on', exact: true }).click();
  await page.keyboard.press('Escape');
  await expect(
    page.getByRole('textbox', { name: 'Search Supporting contributions', exact: true }),
  ).toHaveValue('#' + number);
  await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(1);
  expect(new URL(page.url()).searchParams.get('support.records.q')).toBe('#' + number);
});
test('full-range matrix and series downloads ignore windows/pages and matrix cells restore their parent', async ({
  page,
}) => {
  await login(page);
  await page.goto(
    '/repos?timeline=1&timeline.group=day&period=custom&from=2025-06-12&through=2026-10-24&timeline.window=40&repo=repo-prebidjs&repo=repo-prebidserver',
  );
  await ready(page);
  const responsePromise = page.waitForResponse((response) =>
    response.url().endsWith('/api/reporting/timeline-export'),
  );
  await page.getByRole('button', { name: 'Export CSV', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText(
    'beyond the visible period window and repository page',
  );
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
  const matrix = await csv(page);
  expect(matrix.records).toHaveLength(1000);
  expect(matrix.records[0]['Covered start (UTC)']).toBe('2025-06-12T00:00:00.000Z');
  expect((await responsePromise).headers()['cache-control']).toBe('private, no-store');
  await page.goto(
    '/repos?timeline=1&timeline.group=month&repo=repo-prebidjs&repo=repo-prebidserver',
  );
  await ready(page);
  const parent = await page
    .getByRole('link', { name: 'Timeline', exact: true })
    .getAttribute('href');
  await page.getByRole('link', { name: 'Prebid.js, Oct 2026: 78', exact: true }).click();
  await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(50);
  await page.getByRole('link', { name: '← Back to timeline', exact: true }).click();
  await expect(page).toHaveURL('http://127.0.0.1:3100' + parent);
  await page.goto(
    '/repos/prebidjs?timeline=1&timeline.group=day&period=custom&from=2025-06-12&through=2026-10-24',
  );
  await ready(page);
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  const series = await csv(page);
  expect(series.records).toHaveLength(500);
  expect(series.records.at(-1)!['Covered end (UTC)']).toBe('2026-10-24T12:00:00.000Z');
});
test('chart points use the same interval details; partial values remain inspectable on mobile', async ({
  page,
}, info) => {
  await login(page);
  await page.goto('/repos/prebidjs?timeline=1');
  await ready(page);
  await page.getByRole('button', { name: 'Show chart', exact: true }).click();
  const dots = page.locator('.recharts-line-dots circle');
  await expect(dots).toHaveCount(10);
  await dots.last().click();
  await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(50);
  await expect(page).toHaveURL(/timeline.detail=prsOpened/);
  await page.setViewportSize({ width: 375, height: 1000 });
  await page.goto('/repos?timeline=1&sample=mixed&timeline.group=quarter&repo=repo-prebidserver');
  await ready(page);
  // Prepared history for this repository starts in February, so Q1 records are partial.
  await page
    .getByRole('link', { name: /^Prebid Server \(Go\), Q1 2026: 95, partial value\. / })
    .click();
  await expect(page.getByLabel('Supporting data coverage')).toBeVisible();
  await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(50);
  expect((await new AxeBuilder({ page }).include('main').analyze()).violations).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  await page.screenshot({
    path: info.outputPath('timeline-partial-support-mobile.png'),
    fullPage: true,
  });
});
test('downloads and copied support links remain protected and stale source identities are rejected', async ({
  page,
  request,
}) => {
  const denied = await request.post('/api/reporting/timeline-export', {
    data: { href: '/repos?timeline=1', columns: ['period'] },
    maxRedirects: 0,
  });
  expect(denied.status()).toBe(307);
  expect(denied.headers()['location']).toContain('/auth/login');
  await login(page);
  await page.goto('/repos/prebidjs?timeline=1');
  await ready(page);
  const href = await page
    .getByRole('link', { name: 'Pull requests — Opened, Oct 2026: 78', exact: true })
    .getAttribute('href');
  const url = new URL(href!, 'http://127.0.0.1:3100');
  url.searchParams.set('timeline.revision', 'stale');
  await page.goto(url.toString());
  await expect(page.getByRole('heading', { name: 'Invalid timeline view' })).toBeVisible();
  await expect(page.getByRole('table')).toHaveCount(0);
  await page.getByRole('link', { name: 'Return to report', exact: true }).click();
  await ready(page);
  expect(new URL(page.url()).searchParams.has('timeline.detail')).toBe(false);
  expect(new URL(page.url()).searchParams.get('timeline')).toBe('1');
});
test('Back and Forward restore supporting-view search and author steps', async ({ page }) => {
  await login(page);
  await page.goto('/repos/prebidjs?timeline=1');
  await ready(page);
  await page.getByRole('link', { name: 'Unique authors — PRs, Oct 2026: 18', exact: true }).click();
  const authors = page.getByRole('table');
  await expect(authors.locator('tbody tr')).toHaveCount(18);
  const search = page.getByRole('textbox', { name: /^Search / });
  await search.fill('bob');
  await search.press('Enter');
  await expect(authors.locator('tbody tr')).toHaveCount(1);
  const searched = new URL(page.url()).searchParams;
  await authors.locator('a[href*="support.author"]').first().click();
  await expect(page).toHaveURL(/support\.author=/);
  const author = page.url();
  await page.goBack();
  // The author link freezes the visible columns into this entry; everything else is unchanged.
  await expect(page).toHaveURL(
    (url) =>
      !url.searchParams.has('support.author') &&
      url.searchParams.has('support.authors.columns') &&
      [...searched].every(([name, value]) => url.searchParams.getAll(name).includes(value)),
  );
  await expect(page.getByRole('textbox', { name: /^Search / })).toHaveValue('bob');
  await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(1);
  await page.goForward();
  await expect(page).toHaveURL(author);
  await page.goBack();
  await page.goBack();
  await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(18);
});
