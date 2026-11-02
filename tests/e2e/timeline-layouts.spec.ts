import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
async function login(page: Page) {
  await page.goto('/auth/login');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/repos$/);
}
for (const [path, title, theme, width] of [
  ['/repos/prebidjs?timeline=1', 'Prebid.js', 'dark', 1440],
  ['/repos/prebidjs?timeline=1', 'Prebid.js', 'light', 375],
  ['/contributors?timeline=1', 'Contributors', 'light', 1440],
  ['/contributors?timeline=1', 'Contributors', 'dark', 375],
  ['/companies?timeline=1', 'Companies', 'dark', 1440],
  ['/companies?timeline=1', 'Companies', 'light', 375],
  ['/contributors/account-alice?timeline=1', 'Alice', 'light', 1440],
  ['/companies/id/company-acme?timeline=1', 'Example Acme', 'dark', 375],
] as const) {
  test(`timeline layout ${title} ${theme} ${width}`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 1000 });
    await login(page);
    await page.getByRole('button', { name: 'Theme settings', exact: true }).click();
    await page
      .getByRole('menuitemradio', { name: theme === 'dark' ? 'Dark' : 'Light', exact: true })
      .click();
    await page.goto(path);
    await expect(page.getByRole('heading', { name: title, level: 1, exact: true })).toBeVisible();
    const table = page.getByRole('table');
    await expect(table.locator('tbody tr')).toHaveCount(10);
    await expect(table.locator('tbody tr').first()).toContainText('Jan 2026');
    const lastPeriod = table.locator('tbody tr').last().locator('[data-column="period"]');
    const dates = (await lastPeriod.getByText('Oct 1–24, 2026', { exact: true }).boundingBox())!;
    const partial = (await lastPeriod.getByText('Partial', { exact: true }).boundingBox())!;
    // The partial-period caption sits on its own line under the covered dates.
    expect(partial.y).toBeGreaterThanOrEqual(dates.y + dates.height - 0.5);
    await expect(page.getByRole('button', { name: 'Export CSV', exact: true })).toBeVisible();
    await expect(page.getByRole('textbox')).toHaveCount(0);
    const period = table.locator('tbody [data-column="period"]').first();
    const before = (await period.boundingBox())!;
    const scroll = table.locator('..');
    const overflowing = await scroll.evaluate((node) => node.scrollWidth > node.clientWidth);
    if (width === 375) expect(overflowing).toBe(true);
    if (overflowing) {
      await scroll.evaluate((node) => {
        node.scrollLeft = node.scrollWidth;
      });
      expect(await scroll.evaluate((node) => node.scrollLeft)).toBeGreaterThan(0);
    }
    expect(Math.abs((await period.boundingBox())!.x - before.x)).toBeLessThan(2);
    await scroll.evaluate((node) => {
      node.scrollLeft = 0;
    });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      width,
    );
    await page.getByRole('button', { name: 'Columns', exact: true }).click();
    await expect(page.getByRole('menu')).toBeVisible();
    await page.keyboard.press('Escape');
    if (path.startsWith('/repos/')) {
      await expect(page.getByRole('figure')).toHaveCount(0);
      expect((await new AxeBuilder({ page }).include('main').analyze()).violations).toEqual([]);
      await page.getByRole('button', { name: 'Show chart', exact: true }).click();
      await expect(page.getByRole('figure')).toBeVisible();
      await expect(page.locator('path.recharts-line-curve').first()).toBeVisible();
      await page.getByLabel('Chart metric').selectOption('medianMergeDays');
      await expect(page.getByText('Whole-range median', { exact: true })).toBeVisible();
    } else
      await expect(page.getByRole('button', { name: 'Show chart', exact: true })).toHaveCount(0);
    expect((await new AxeBuilder({ page }).include('main').analyze()).violations).toEqual([]);
    await page.screenshot({
      path: info.outputPath(
        'timeline-' + title.toLowerCase().replaceAll(' ', '-') + '-' + theme + '-' + width + '.png',
      ),
      fullPage: true,
    });
  });
}
test('timeline periods, missing data and empty populations retain distinct meanings', async ({
  page,
}, info) => {
  await login(page);
  await page.goto('/contributors?timeline=1&sample=empty');
  await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(10);
  await expect(page.getByLabel('Timeline data coverage')).toHaveCount(0);
  await page.goto('/contributors?timeline=1&sample=missing');
  await expect(page.getByLabel('Timeline data coverage')).toBeVisible();
  await expect(
    page.getByRole('table').locator('tbody tr').first().locator('[data-column="prsAuthored"]'),
  ).toContainText('—');
  await page.screenshot({ path: info.outputPath('timeline-missing.png'), fullPage: true });
  await page.goto('/repos/prebidjs?timeline=1&timeline.group=quarter&timeline.gap=1');
  await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(4);
  await expect(
    page.getByRole('table').locator('tbody tr').first().locator('sup').first(),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Show chart', exact: true }).click();
  await expect(page.getByRole('figure')).toBeVisible();
  await page.screenshot({ path: info.outputPath('timeline-partial.png'), fullPage: true });
  await page.goto('/companies?timeline=1&population=selected');
  await expect(page.getByRole('heading', { name: 'No accounts match this report' })).toBeVisible();
  await expect(page.getByRole('table')).toHaveCount(0);
  await page.goto(
    '/repos/prebidjs?timeline=1&timeline.family=snapshot&timeline.group=day&period=custom&from=2026-10-11&through=2026-10-21',
  );
  await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(11);
  await expect(
    page.getByRole('table').locator('tbody tr').first().locator('[data-column="totalOpenPrs"]'),
  ).toHaveText('108');
  await expect(
    page.getByRole('table').locator('tbody tr').last().locator('[data-column="totalOpenPrs"]'),
  ).toHaveText('116');
  await page.screenshot({ path: info.outputPath('timeline-snapshots.png'), fullPage: true });
});
test('a 500-interval timeline keeps a full chart and fifty-row table, and rejects excess ranges', async ({
  page,
}, info) => {
  await login(page);
  await page.goto(
    '/repos/prebidjs?timeline=1&timeline.group=day&period=custom&from=2025-06-12&through=2026-10-24',
  );
  await expect(page.getByText('Page 1 of 10', { exact: true })).toBeVisible();
  await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(50);
  await page.getByRole('button', { name: 'Show chart', exact: true }).click();
  await expect(
    page.getByText('All 500 intervals, independent of table sorting and pages.'),
  ).toBeVisible();
  await expect(page.locator('path.recharts-line-curve').first()).toBeVisible();
  const curve = await page.locator('path.recharts-line-curve').first().getAttribute('d');
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByText('Page 2 of 10', { exact: true })).toBeVisible();
  await expect(page.locator('path.recharts-line-curve').first()).toHaveAttribute('d', curve!);
  await page.screenshot({ path: info.outputPath('timeline-dense.png') });
  await page.goto(
    '/contributors?timeline=1&timeline.group=day&period=custom&from=2020-01-01&through=2026-10-24',
  );
  await expect(page.getByRole('heading', { name: 'Invalid timeline view' })).toBeVisible();
  await expect(page.getByRole('status')).toContainText('500 intervals');
});
test('timeline previews keep ordinary reports reachable and remain protected', async ({
  page,
  browser,
}, info) => {
  await login(page);
  await page.goto(
    '/contributors/account-alice?timeline=1&period=this-month&repo=repo-prebidjs&type=human',
  );
  await page.getByRole('link', { name: 'Report', exact: true }).click();
  await expect(page).not.toHaveURL(/[?&]timeline=/);
  await expect(page.getByRole('heading', { name: 'Alice', level: 1 })).toBeVisible();
  expect(new URL(page.url()).searchParams.get('timeline')).toBeNull();
  expect(new URL(page.url()).searchParams.getAll('repo')).toEqual(['repo-prebidjs']);
  await page.goto('/repos/prebidjs');
  // The record scope select names the scope, so the summary beside it does not repeat it.
  await expect(
    page
      .getByRole('region', { name: 'Selected repository scope' })
      .getByRole('combobox', { name: 'Record scope', exact: true }),
  ).toHaveValue('current');
  await page.screenshot({ path: info.outputPath('timeline-entry.png') });
  await page
    .getByRole('navigation', { name: 'Repository lists' })
    .getByRole('link', { name: 'Timeline', exact: true })
    .click();
  await expect(page).toHaveURL(/\/repos\/prebidjs\?.*timeline=1/);
  await expect(
    page.getByRole('heading', { name: 'Activity over time', exact: true }),
  ).toBeVisible();
  await page.getByRole('link', { name: /^Issues / }).click();
  // The issue list's own Timeline link carries the issue kind, so wait for that page first.
  await expect(page).toHaveURL(/metric=openIssues/);
  await page
    .getByRole('navigation', { name: 'Repository lists' })
    .getByRole('link', { name: 'Timeline', exact: true })
    .click();
  await expect(page).toHaveURL(/timeline.kind=issues/);
  await expect(
    page.getByRole('table').getByRole('columnheader', { name: 'Closed', exact: true }),
  ).toBeVisible();
  const context = await browser.newContext();
  const anonymous = await context.newPage();
  await anonymous.goto('http://127.0.0.1:3100/contributors?timeline=1');
  await expect(anonymous).toHaveURL(/\/auth\/login/);
  await context.close();
});
test('timeline catalog specimens, not application routes, render loading and retry states', async ({
  page,
}) => {
  await page.goto('http://127.0.0.1:6007/iframe.html?id=timelines-layouts--loading&viewMode=story');
  await expect(page.getByRole('heading', { name: 'Loading timeline' })).toBeVisible();
  await page.goto('http://127.0.0.1:6007/iframe.html?id=timelines-layouts--error&viewMode=story');
  await expect(page.getByRole('heading', { name: 'Timeline could not load' })).toBeVisible();
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await expect(page.getByRole('table')).toBeVisible();
});

test('weekly issue labels keep the covered dates readable on narrow screens', async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 375, height: 1000 });
  await login(page);
  await page.goto('/repos/prebidjs?timeline=1&timeline.kind=issues&timeline.group=week');
  await expect(page.getByRole('table').locator('tbody tr').first()).toContainText('Dec 29, 2025');
  await expect(page.getByRole('table').locator('tbody tr').first()).toContainText('Jan 1–4, 2026');
  // A full week's range is its heading, printed once.
  await expect(
    page.getByRole('table').locator('tbody tr').nth(1).locator('[data-column="period"]'),
  ).toHaveText('Jan 5–11, 2026');
  await page.getByRole('button', { name: 'Show chart', exact: true }).click();
  await expect(page.getByRole('figure')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  expect((await new AxeBuilder({ page }).include('main').analyze()).violations).toEqual([]);
  await page.screenshot({ path: info.outputPath('timeline-weekly-issues.png') });
});

test('dense contribution timelines hydrate all metrics and retain fifty-row pages', async ({
  page,
}, info) => {
  await login(page);
  await page.goto(
    '/contributors?timeline=1&sample=large&timeline.group=day&period=custom&from=2025-06-12&through=2026-10-24',
  );
  await expect(page.getByLabel('Timeline scope')).toContainText('500 intervals');
  await expect(page.getByLabel('Timeline scope')).toContainText('251 included accounts');
  await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(50);
  await expect(page.getByText('Page 1 of 10', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByText('Page 2 of 10', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Columns', exact: true }).click();
  await page
    .getByRole('menuitemcheckbox', { name: 'Authored merged PR volume', exact: true })
    .click();
  await page.keyboard.press('Escape');
  await expect(
    page.getByRole('table').getByRole('columnheader', { name: 'Files changed', exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: info.outputPath('timeline-dense-contributions.png') });
});
