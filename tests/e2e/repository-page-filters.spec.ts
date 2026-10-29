import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
async function login(page: Page) {
  await page.goto('/auth/login');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/repos$/);
}
async function filters(page: Page) {
  await page.getByRole('button', { name: /^Filters(?: \(|$)/ }).click();
  return page.getByRole('dialog', { name: /^Filter (pull requests|issues)$/ });
}
const numbers = (page: Page) => page.locator('tbody [data-column="number"]').allTextContents();

test('filters the full PR population before fifty-row paging and restores page/filter history', async ({
  page,
}) => {
  await login(page);
  await page.goto('/repos/prebidjs?returnTo=%2Frepos%3Fage%3D60');
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByText('Page 2 of 3', { exact: true })).toBeVisible();
  const second = await numbers(page);
  const dialog = await filters(page);
  await dialog
    .locator('summary')
    .filter({ hasText: /^Labels/ })
    .click();
  await dialog.getByRole('checkbox', { name: 'enhancement', exact: true }).check();
  await dialog.getByRole('button', { name: 'Apply filters', exact: true }).click();
  await expect(page.getByText('92 matching records', { exact: true })).toBeVisible();
  await expect(page.getByText('Page 1 of 2', { exact: true })).toBeVisible();
  const first = await numbers(page);
  expect(first).toHaveLength(50);
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(42);
  const last = await numbers(page);
  expect(new Set([...first, ...last]).size).toBe(92);
  expect([...first, ...last].map(Number).sort((a, b) => a - b)).toEqual(
    Array.from({ length: 137 }, (_, i) => i + 1)
      .filter((n) => n % 3 !== 0)
      .map((n) => n + 1000),
  );
  await page.reload();
  await expect(page.getByText('Page 2 of 2', { exact: true })).toBeVisible();
  await page.goBack();
  await expect(page.getByText('Page 1 of 2', { exact: true })).toBeVisible();
  await page.goBack();
  await expect(page.getByText('Page 2 of 3', { exact: true })).toBeVisible();
  expect(await numbers(page)).toEqual(second);
  await page.goForward();
  await expect(page.getByText('92 matching records', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Remove Labels: enhancement', exact: true }).click();
  await expect(page.getByText('137 matching records', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: '← All repositories', exact: true })).toHaveAttribute(
    'href',
    '/repos?age=60',
  );
});

test('combines issue facets, handles partial metadata honestly and searches beyond the current page', async ({
  page,
}) => {
  await login(page);
  await page.goto('/repos/prebidjs?view=issues');
  const dialog = await filters(page);
  await dialog
    .getByRole('combobox', { name: 'Assignment', exact: true })
    .selectOption('unassigned');
  await dialog.getByRole('button', { name: 'Apply filters', exact: true }).click();
  await expect(page.getByText('334 available sample records', { exact: true })).toBeVisible();
  await expect(page.getByText(/Partial sample coverage:/)).toBeVisible();
  await expect(page.getByText('Page 1 of 7', { exact: true })).toBeVisible();
  await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(50);
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  const search = page.getByRole('textbox', { name: 'Search Open issues', exact: true });
  await search.fill('Sample issue 2:');
  await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(1);
  await expect(page.getByText('1 matching records', { exact: true })).toBeVisible();
  await expect(search).toBeFocused();
  expect(await numbers(page)).toEqual(['2']);
  await search.fill('cannot match anything');
  await expect(page.getByRole('heading', { name: 'No matching items', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Clear filters', exact: true }).click();
  await expect(page.getByText('834 matching records', { exact: true })).toBeVisible();
  const ageDialog = await filters(page);
  await ageDialog.getByRole('combobox', { name: 'Age', exact: true }).selectOption('0');
  await ageDialog
    .getByRole('combobox', { name: 'Assignment', exact: true })
    .selectOption('unassigned');
  await ageDialog.getByRole('button', { name: 'Apply filters', exact: true }).click();
  await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(12);
  expect((await numbers(page)).map(Number).sort((a, b) => a - b)).toEqual([
    806, 808, 812, 814, 816, 818, 822, 824, 826, 828, 832, 834,
  ]);
});

test('keeps reviewer and approval filters independent and preserves an incoming metric scope', async ({
  page,
}) => {
  await login(page);
  await page.goto(
    '/repos/prebidjs?scope=current&metric=humanApprovals0&returnTo=%2Frepos%3Fperiod%3Dthis-week',
  );
  const dialog = await filters(page);
  await dialog.getByRole('combobox', { name: 'Human reviewers', exact: true }).selectOption('1');
  await dialog.getByRole('button', { name: 'Apply filters', exact: true }).click();
  await expect(page.getByText('21 matching records', { exact: true })).toBeVisible();
  expect(await page.locator('tbody [data-column="humanReviewers"]').count()).toBe(0); // Context keeps approvals visible; filters do not force extra columns.
  await expect(page.locator('tbody [data-column="approvals"]')).toHaveCount(21);
  expect(await page.locator('tbody [data-column="approvals"]').allTextContents()).toEqual(
    Array(21).fill('0'),
  );
  expect(new URL(page.url()).searchParams.get('metric')).toBe('humanApprovals0');
  await page.getByRole('button', { name: 'Clear filters', exact: true }).click();
  await expect(page.getByText('60 matching records', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'All open PRs', exact: true }).click();
  await expect(page.getByText('137 matching records', { exact: true })).toBeVisible();
});

test('saves columns and sorting without saving historical scope or filters', async ({ page }) => {
  await login(page);
  await page.goto('/repos/prebidjs');
  await page.getByRole('button', { name: 'Columns', exact: true }).click();
  await page.getByRole('menuitemcheckbox', { name: 'Latest activity', exact: true }).click();
  await page.keyboard.press('Escape');
  await expect(
    page.locator('thead [aria-sort]').filter({ hasText: 'Latest activity' }),
  ).toHaveCount(0);
  await page.getByRole('button', { name: 'PR', exact: true }).click();
  await page.getByRole('combobox', { name: 'Record scope', exact: true }).selectOption('created');
  await expect(
    page.getByRole('combobox', { name: 'Activity period preset', exact: true }),
  ).toBeVisible();
  await page
    .getByRole('combobox', { name: 'Activity period preset', exact: true })
    .selectOption('this-year');
  await expect(page.getByText('529 matching records', { exact: true })).toBeVisible();
  await page.goto('/repos/prebidjs');
  await expect(page.getByText('137 matching records', { exact: true })).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Record scope', exact: true })).toHaveValue(
    'current',
  );
  await expect(page.locator('th[aria-sort="ascending"]')).toHaveText('PR ↑');
  await expect(page.locator('tbody [data-column="latestActivity"]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Reset view preferences', exact: true }).click();
  await expect(page.locator('tbody [data-column="latestActivity"]')).toHaveCount(50);
  await page.goto('/repos/prebidjs');
  await expect(page.getByText('Newest created first', { exact: true })).toBeVisible();
});

for (const [theme, width] of [
  ['dark', 1440],
  ['light', 375],
] as const) {
  test(`repository filter dialog is readable and accessible (${theme}, ${width}px)`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 1000 });
    await login(page);
    await page.getByRole('button', { name: 'Theme settings', exact: true }).click();
    await page
      .getByRole('menuitemradio', { name: theme === 'dark' ? 'Dark' : 'Light', exact: true })
      .click();
    await page.goto('/repos/prebidjs');
    const dialog = await filters(page);
    await dialog.getByRole('combobox', { name: 'Age', exact: true }).selectOption('30');
    await dialog
      .locator('summary')
      .filter({ hasText: /^Authors/ })
      .click();
    await dialog.getByRole('checkbox', { name: 'sample-alice', exact: true }).check();
    expect(
      (await new AxeBuilder({ page }).include('[role="dialog"]').analyze()).violations,
    ).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      width,
    );
    await page.screenshot({ path: testInfo.outputPath(`repository-filter-${theme}-${width}.png`) });
    await dialog.getByRole('button', { name: 'Apply filters', exact: true }).click();
    // Audit the settled page, after Radix has removed the fading dialog and backdrop.
    await expect(dialog).toHaveCount(0);
    await expect(
      page.getByRole('button', { name: 'Remove Authors: sample-alice', exact: true }),
    ).toBeVisible();
    expect((await new AxeBuilder({ page }).include('main').analyze()).violations).toEqual([]);
    await page.screenshot({
      path: testInfo.outputPath(`repository-filtered-${theme}-${width}.png`),
    });
  });
}

test('unprepared custom dates remain unavailable, with a clear return to current open', async ({
  page,
}) => {
  await login(page);
  await page.goto('/repos/prebidjs');
  await page.getByRole('combobox', { name: 'Record scope', exact: true }).selectOption('completed');
  await expect(page.getByText('Primary branch: master', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Custom range for Activity period', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Custom date range', exact: true });
  await dialog.getByLabel('Start date', { exact: true }).fill('2026-10-02');
  await dialog.getByLabel('End date', { exact: true }).fill('2026-10-03');
  await dialog.getByRole('button', { name: 'Apply dates', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Sample records unavailable', exact: true }),
  ).toBeVisible();
  await expect(page.getByText('0 matching records', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Filters', exact: true })).toBeVisible();
  await page.getByRole('combobox', { name: 'Record scope', exact: true }).selectOption('current');
  await expect(page.getByText('137 matching records', { exact: true })).toBeVisible();
  await page.goto('/repos/prebidjs?prs.filter.reviewers=99');
  await expect(
    page.getByRole('heading', { name: 'Invalid repository filters', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Clear filters', exact: true }).click();
  await expect(page.getByText('137 matching records', { exact: true })).toBeVisible();
});

test('opening filters captures pending search without dismissing the dialog', async ({ page }) => {
  await login(page);
  await page.goto('/repos/prebidjs');
  await page
    .getByRole('textbox', { name: 'Search Open pull requests', exact: true })
    .fill('Sample PR 1:');
  const dialog = await filters(page);
  await expect(dialog).toBeVisible();
  await dialog.getByRole('combobox', { name: 'Draft status', exact: true }).selectOption('drafts');
  await dialog.getByRole('button', { name: 'Apply filters', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByText('1 matching records', { exact: true })).toBeVisible();
  await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(1);
  expect(new URL(page.url()).searchParams.get('prs.q')).toBe('Sample PR 1:');
  expect(new URL(page.url()).searchParams.get('prs.filter.draft')).toBe('drafts');
});
