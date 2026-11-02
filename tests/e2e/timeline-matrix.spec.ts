import { test, expect } from './fixtures';
import type { Locator, Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
async function login(page: Page) {
  await page.goto('/auth/login');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/repos$/);
}
test('normal Summary entry preserves selected repositories and both Summary periods', async ({
  page,
}) => {
  await login(page);
  await page.goto(
    '/repos?repo=repo-prebidjs&repo=repo-prebidserver&period=this-week&period2=last-month&age=30&age=60&activity.sort=prsMerged&activity.dir=desc',
  );
  const tabs = page.getByRole('navigation', { name: 'Repository overview views' });
  await expect(tabs.getByRole('link', { name: 'Summary' })).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('table')).toHaveCount(2);
  const href = await tabs.getByRole('link', { name: 'Timeline' }).getAttribute('href');
  const summary = new URL(href!, 'http://localhost').searchParams.get('summary')!;
  await tabs.getByRole('link', { name: 'Timeline' }).click();
  await expect(tabs.getByRole('link', { name: 'Timeline' })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await expect(page.getByRole('table')).toHaveCount(1);
  await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(2);
  // The repository control states the selection; the scope summary does not repeat it.
  await expect(
    page
      .getByRole('region', { name: 'Timeline scope' })
      .getByRole('button', { name: 'Choose repositories 2 / 18', exact: true }),
  ).toBeVisible();
  await tabs.getByRole('link', { name: 'Summary' }).click();
  await expect(page).toHaveURL('http://127.0.0.1:3100' + summary);
  await expect(page.getByRole('table')).toHaveCount(2);
  const restored = new URL(page.url()).searchParams;
  expect(restored.get('period')).toBe('this-week');
  expect(restored.get('period2')).toBe('last-month');
  expect(restored.getAll('age')).toEqual(['30', '60']);
  expect(restored.get('activity.sort')).toBe('prsMerged');
  expect(restored.get('activity.dir')).toBe('desc');
});
for (const [theme, width] of [
  ['dark', 1440],
  ['light', 375],
  ['dark', 768],
] as const) {
  test(`matrix layout ${theme} ${width}`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 1000 });
    await login(page);
    await page.getByRole('button', { name: 'Theme settings', exact: true }).click();
    await page
      .getByRole('menuitemradio', { name: theme === 'dark' ? 'Dark' : 'Light', exact: true })
      .click();
    await page.goto('/repos?timeline=1');
    const table = page.getByRole('table');
    await expect(table.locator('tbody tr')).toHaveCount(18);
    await expect(table.locator('thead th')).toHaveCount(11);
    await expect(
      table.getByRole('columnheader', { name: 'Oct 2026 (partial)', exact: true }),
    ).toBeVisible();
    for (const name of ['Columns', 'Show chart'])
      await expect(page.getByRole('button', { name, exact: true })).toHaveCount(0);
    await expect(page.getByRole('textbox')).toHaveCount(0);
    const pinned = table.locator('tbody [data-column="repository"]').first();
    const before = (await pinned.boundingBox())!;
    const scroll = table.locator('..');
    const overflows = await scroll.evaluate((node) => node.scrollWidth > node.clientWidth);
    if (width < 1440) expect(overflows).toBe(true);
    if (overflows) {
      await scroll.evaluate((node) => {
        node.scrollLeft = node.scrollWidth;
      });
      expect(await scroll.evaluate((node) => node.scrollLeft)).toBeGreaterThan(0);
    }
    expect(Math.abs((await pinned.boundingBox())!.x - before.x)).toBeLessThan(2);
    await scroll.evaluate((node) => {
      node.scrollLeft = 0;
    });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      width,
    );
    expect((await new AxeBuilder({ page }).include('main').analyze()).violations).toEqual([]);
    await page.getByRole('button', { name: /Column definitions for/ }).click();
    await expect(page.getByRole('dialog')).toContainText('Partial calendar period');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toBeHidden();
    await page.screenshot({
      path: info.outputPath(`matrix-${theme}-${width}.png`),
      fullPage: true,
    });
  });
}
test('matrix repository names read like the Summary repository names', async ({ page }) => {
  await login(page);
  const look = async (link: Locator) => {
    await expect(link).toBeVisible();
    await page.mouse.move(0, 0);
    return link.evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        color: style.color,
        size: style.fontSize,
        weight: style.fontWeight,
        line: style.textDecorationLine,
      };
    });
  };
  await page.goto('/repos');
  const summary = await look(
    page
      .getByRole('table', { name: 'Current backlog', exact: true })
      .getByRole('link', { name: 'Prebid.js', exact: true }),
  );
  await page.goto('/repos?timeline=1');
  const matrix = await look(
    page.getByRole('table').getByRole('link', { name: 'Prebid.js', exact: true }),
  );
  expect(matrix).toEqual(summary);
});
test('dense matrix renders only a period window and retains an offscreen sort', async ({
  page,
}, info) => {
  await login(page);
  await page.goto(
    '/repos?timeline=1&sample=large&timeline.group=day&period=custom&from=2025-06-12&through=2026-10-24',
  );
  const table = page.getByRole('table');
  await expect(page.getByRole('status', { name: 'Period window', exact: true })).toContainText(
    'Periods 493–500 of 500',
  );
  await expect(table.locator('tbody tr')).toHaveCount(18);
  await expect(table.locator('thead th')).toHaveCount(9);
  const names = await table.locator('tbody [data-column="repository"]').allTextContents();
  await page.getByRole('button', { name: 'Earlier', exact: true }).click();
  await expect(page.getByRole('status', { name: 'Period window', exact: true })).toContainText(
    'Periods 481–492 of 500',
  );
  await page.getByRole('button', { name: 'Earlier', exact: true }).click();
  await expect(page.getByRole('status', { name: 'Period window', exact: true })).toContainText(
    'Periods 469–480 of 500',
  );
  // Sep 23, 2026 is led by Prebid.js (32 PRs opened), unlike name order.
  await table.getByRole('button', { name: 'Sep 23, 2026', exact: true }).click();
  await expect(
    table.getByRole('columnheader', { name: 'Sep 23, 2026', exact: true }),
  ).toHaveAttribute('aria-sort', 'ascending');
  await table.getByRole('button', { name: 'Sep 23, 2026', exact: true }).click();
  // Header state and row order come from the same render, so this waits for the sorted rows.
  await expect(
    table.getByRole('columnheader', { name: 'Sep 23, 2026', exact: true }),
  ).toHaveAttribute('aria-sort', 'descending');
  const ordering = await table.locator('tbody [data-column="repository"]').allTextContents();
  expect(ordering[0]).toContain('Prebid.js');
  expect(ordering).not.toEqual(names);
  await page.getByRole('button', { name: 'Later', exact: true }).click();
  await expect(page.getByRole('status', { name: 'Period window', exact: true })).toContainText(
    'Periods 481–492 of 500',
  );
  await expect(table.locator('thead th')).toHaveCount(13);
  expect(await table.locator('tbody [data-column="repository"]').allTextContents()).toEqual(
    ordering,
  );
  await expect(
    page.getByText(
      'Sorted by Sep 23, 2026 (descending); its column is outside the visible periods.',
      { exact: true },
    ),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Earlier', exact: true }).click();
  await expect(
    table.getByRole('columnheader', { name: 'Sep 23, 2026', exact: true }),
  ).toHaveAttribute('aria-sort', 'descending');
  // With the sorted column back in view, its header is the one description of the sort.
  await expect(page.getByText(/^Sorted by/)).toHaveCount(0);
  await page.screenshot({ path: info.outputPath('matrix-dense.png'), fullPage: true });
});
test('mixed coverage, durations, snapshots and empty selections retain their meanings', async ({
  page,
}, info) => {
  await login(page);
  await page.goto('/repos?timeline=1&sample=mixed&timeline.group=quarter');
  const ready = () => expect(page.getByLabel('Group by', { exact: true })).toBeEnabled();
  await ready();
  const table = page.getByRole('table');
  const row = (name: string) =>
    table.locator('tbody tr').filter({ has: page.getByRole('cell', { name, exact: true }) });
  await expect(page.getByLabel('Timeline data coverage')).toBeVisible();
  await expect(row('Prebid Server (Java)').getByRole('cell').nth(1)).toContainText('—');
  await expect(row('Prebid Server (Go)').getByRole('cell').nth(1).locator('sup')).toHaveText('*');
  await expect(row('Prebid Mobile iOS SDK').getByRole('cell').nth(1)).toHaveText('0');
  await page.screenshot({ path: info.outputPath('matrix-mixed.png'), fullPage: true });
  await page.goto('/repos?timeline=1&timeline.metric=medianMergeDays');
  await ready();
  await expect(row('Prebid.js').getByRole('cell').nth(9)).toHaveText('4.9 d');
  await expect(row('Prebid.js').getByRole('cell').nth(10)).toHaveText('8.3 d');
  await page.goto(
    '/repos?timeline=1&timeline.metric=totalOpenPrs&timeline.group=day&period=custom&from=2026-10-11&through=2026-10-21',
  );
  await ready();
  await expect(row('Prebid.js').getByRole('cell').nth(1)).toHaveText('108');
  await expect(row('Prebid.js').getByRole('cell').last()).toHaveText('116');
  await page.goto('/repos?timeline=1&repo=');
  await ready();
  await expect(page.getByRole('heading', { name: 'No repositories selected' })).toBeVisible();
  await expect(table).toHaveCount(0);
  await page.goto(
    '/repos?timeline=1&timeline.group=day&period=custom&from=2020-01-01&through=2026-10-24',
  );
  await expect(page.getByRole('heading', { name: 'Invalid timeline view' })).toBeVisible();
  await expect(page.getByText(/exceeds 500 intervals/)).toBeVisible();
});
test('weekly issue periods and window controls fit on mobile', async ({ page }, info) => {
  await page.setViewportSize({ width: 375, height: 1000 });
  await login(page);
  await page.goto('/repos?timeline=1&timeline.metric=issuesClosed&timeline.group=week');
  await expect(page.getByRole('heading', { name: 'Issues — Closed', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Earlier', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Earlier', exact: true }).click();
  await expect(
    page.getByRole('navigation', { name: 'Timeline period windows', exact: true }),
  ).toContainText('Window 3 of 4');
  await expect(page.getByRole('status', { name: 'Period window', exact: true })).toContainText(
    'Jun 15, 2026 – Sep 6, 2026',
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  expect((await new AxeBuilder({ page }).include('main').analyze()).violations).toEqual([]);
  await page.screenshot({ path: info.outputPath('matrix-weekly-mobile.png'), fullPage: true });
});
test('matrix preview requires sign-in and its Storybook empty layout remains reviewable', async ({
  page,
}) => {
  await page.goto('/repos?timeline=1');
  await expect(page).toHaveURL(/\/auth\/login/);
  await page.goto(
    'http://127.0.0.1:6007/iframe.html?id=timelines-repository-matrix--no-repositories&viewMode=story',
  );
  await expect(page.getByRole('heading', { name: 'No repositories selected' })).toBeVisible();
});
