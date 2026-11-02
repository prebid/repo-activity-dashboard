import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readCsv } from '../support/csv';
async function login(page: Page) {
  await page.goto('/auth/login');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/repos$/);
}
async function ready(page: Page) {
  await expect(page.getByLabel('Group by', { exact: true })).toBeEnabled();
}
async function selectStatistics(page: Page, choices: [string, string][]) {
  await page.getByRole('button', { name: /^Metrics ·/ }).click();
  const dialog = page.getByRole('dialog', { name: 'Choose metrics' });
  await dialog.getByRole('button', { name: 'Clear selection', exact: true }).click();
  for (const [group, name] of choices)
    await dialog
      .getByRole('group', { name: group, exact: true })
      .getByRole('checkbox', { name, exact: true })
      .check();
  await dialog.getByRole('button', { name: 'Apply metrics', exact: true }).click();
}
test('grouped metrics preserve repositories, sorting, pages, saved views, cell destinations and CSV', async ({
  page,
}, info) => {
  await login(page);
  await page.goto('/repos?timeline=1');
  await ready(page);
  await selectStatistics(page, [
    ['Period activity · Pull requests', 'Opened'],
    ['Period activity · Pull requests', 'Merged'],
    ['Period activity · Duration', 'Median merge time'],
  ]);
  await ready(page);
  const table = page.getByRole('table');
  await expect(table.locator('tbody tr')).toHaveCount(48);
  await expect(page.getByText('Page 1 of 2', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Sort metric')).toHaveValue('prsOpened');
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(table.locator('tbody tr')).toHaveCount(6);
  await page.getByRole('button', { name: 'Previous', exact: true }).click();
  await page.getByLabel('Sort metric').selectOption('medianMergeDays');
  await table.getByRole('button', { name: 'Oct 2026 Partial', exact: true }).click();
  await expect(
    table.getByRole('columnheader', { name: 'Oct 2026 Partial', exact: true }),
  ).toHaveAttribute('aria-sort', 'ascending');
  await table.getByRole('button', { name: 'Oct 2026 Partial', exact: true }).click();
  await expect(
    table.getByRole('columnheader', { name: 'Oct 2026 Partial', exact: true }),
  ).toHaveAttribute('aria-sort', 'descending');
  // GitHub Activity DB has October's longest median merge time.
  await expect(table.locator('tbody tr').first()).toContainText('GitHub Activity DB');
  const parent = await page
    .getByRole('link', { name: 'Timeline', exact: true })
    .getAttribute('href');
  await page
    .getByRole('link', { name: 'Prebid.js, Pull requests — Opened, Oct 2026: 78', exact: true })
    .click();
  await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(50);
  await page.getByRole('link', { name: 'Back to timeline', exact: true }).click();
  await expect(page).toHaveURL('http://127.0.0.1:3100' + parent);
  await ready(page);
  await page.getByRole('button', { name: 'Export CSV', exact: true }).click();
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download CSV', exact: true }).click();
  const stream = await (await pending).createReadStream();
  let text = '';
  for await (const chunk of stream) text += String(chunk);
  const csv = readCsv(text);
  expect(csv.records).toHaveLength(180);
  expect(csv.headers).toContain('Duration — Median merge time');
  expect(csv.records[0]['Sort metric']).toBe('medianMergeDays');
  await expect(page.getByRole('dialog')).toBeHidden();
  expect((await new AxeBuilder({ page }).include('main').analyze()).violations).toEqual([]);
  await page.screenshot({
    path: info.outputPath('timeline-grouped-metrics.png'),
    fullPage: true,
  });
  await page.goto('/repos?timeline=1');
  await ready(page);
  await expect(page.getByRole('button', { name: 'Metrics · 3', exact: true })).toBeVisible();
  await expect(page.getByLabel('Sort metric')).toHaveValue('medianMergeDays');
});
test('empty selection, mixed record kinds and rejected cell budgets retain editable choices', async ({
  page,
}, info) => {
  await login(page);
  await page.goto('/repos?timeline=1');
  await ready(page);
  await selectStatistics(page, []);
  await ready(page);
  await expect(page.getByRole('heading', { name: 'No metrics selected' })).toBeVisible();
  await selectStatistics(page, [
    ['Period activity · Pull requests', 'Opened'],
    ['Period activity · Issues', 'Closed'],
  ]);
  await ready(page);
  await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(36);
  await page.goto(
    '/repos?timeline=1&timeline.state=1&timeline.group=day&period=custom&from=2025-06-12&through=2026-10-24',
  );
  await ready(page);
  const before = page.url();
  await selectStatistics(page, [
    ['Period activity · Pull requests', 'Opened'],
    ['Period activity · Issues', 'Closed'],
  ]);
  const dialog = page.getByRole('dialog', { name: 'Choose metrics' });
  await expect(dialog.getByRole('alert')).toContainText('10000');
  await expect(page).toHaveURL(before);
  await expect(
    dialog
      .getByRole('group', { name: 'Period activity · Issues', exact: true })
      .getByRole('checkbox', { name: 'Closed', exact: true }),
  ).toBeChecked();
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(dialog).toBeHidden();
  await page.setViewportSize({ width: 375, height: 1000 });
  await page.goto(
    '/repos?timeline=1&timeline.metric=prsOpened&timeline.metric=issuesClosed&timeline.group=quarter',
  );
  await ready(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  expect((await new AxeBuilder({ page }).include('main').analyze()).violations).toEqual([]);
  await page.screenshot({ path: info.outputPath('timeline-grouped-mobile.png'), fullPage: true });
});
for (const [theme, width] of [
  ['light', 1440],
  ['dark', 768],
  ['light', 375],
] as const) {
  test(`grouped final visual ${theme} ${width}`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 1050 });
    await login(page);
    await page.getByRole('button', { name: 'Theme settings', exact: true }).click();
    await page
      .getByRole('menuitemradio', { name: theme === 'light' ? 'Light' : 'Dark', exact: true })
      .click();
    await page.goto(
      '/repos?timeline=1&timeline.state=1&period=custom&from=2026-08-01&through=2026-10-24&repo=repo-prebidjs&repo=repo-prebidserver&timeline.metric=prsOpened&timeline.metric=prsMerged&timeline.metric=medianMergeDays',
    );
    await ready(page);
    await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(6);
    await expect(
      page.getByRole('link', {
        name: 'Prebid.js, Duration — Median merge time, Oct 2026: 8.3 d',
        exact: true,
      }),
    ).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      width,
    );
    expect((await new AxeBuilder({ page }).include('main').analyze()).violations).toEqual([]);
    await page.screenshot({
      path: info.outputPath(`grouped-${theme}-${width}.png`),
      fullPage: true,
    });
    await page.getByRole('button', { name: 'Metrics · 3', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Choose metrics' });
    await expect(dialog).toBeVisible();
    // Contrast must be measured after the shared dialog's fade-in has completed.
    await dialog.evaluate(async (node) => {
      await Promise.all(
        node.getAnimations({ subtree: true }).map((animation) => animation.finished),
      );
    });
    await expect(dialog).toHaveCSS('opacity', '1');
    expect((await new AxeBuilder({ page }).include('main').analyze()).violations).toEqual([]);
    await page.screenshot({ path: info.outputPath(`metrics-selector-${theme}-${width}.png`) });
  });
}
test.describe('grouped timeline at enlarged content', () => {
  test.use({ viewport: { width: 640, height: 480 }, deviceScaleFactor: 2 });
  test('keeps metric choices and period scrolling keyboard accessible', async ({ page }, info) => {
    await login(page);
    await page.goto(
      '/repos?timeline=1&timeline.metric=prsOpened&timeline.metric=prsMerged&timeline.metric=medianMergeDays',
    );
    await ready(page);
    const choose = page.getByRole('button', { name: 'Metrics · 3', exact: true });
    await choose.focus();
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog', { name: 'Choose metrics' });
    await expect(dialog).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(choose).toBeFocused();
    const scroll = page.getByRole('region', { name: 'Repository metrics table scroll area' });
    await scroll.focus();
    await page.keyboard.down('ArrowRight');
    try {
      await expect.poll(() => scroll.evaluate((node) => node.scrollLeft)).toBeGreaterThan(0);
    } finally {
      await page.keyboard.up('ArrowRight');
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      640,
    );
    expect((await new AxeBuilder({ page }).include('main').analyze()).violations).toEqual([]);
    await page.screenshot({ path: info.outputPath('grouped-200-percent-equivalent.png') });
  });
});
