import { test, expect } from './fixtures';
import type { Locator, Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
async function login(page: Page) {
  await page.goto('/auth/login');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/repos$/);
}
async function counts(chart: Locator) {
  return (await chart.locator('[data-chart-count]').allTextContents()).map((text) =>
    Number(text.split('*')[0].replace(/[^0-9]/g, '')),
  );
}
const figure = (page: Page, name: string) => page.getByRole('figure', { name, exact: true });
async function showCharts(page: Page) {
  await page.getByRole('button', { name: 'Show charts', exact: true }).click();
}

test('PR charts use the full population and keyboard selections combine without mixing approvals and reviewers', async ({
  page,
}) => {
  await login(page);
  await page.goto('/repos/prebidjs?returnTo=%2Frepos%3Fage%3D60');
  await expect(page.getByRole('figure')).toHaveCount(0);
  await showCharts(page);
  const age = figure(page, 'Age distribution'),
    reviews = figure(page, 'Human reviewers'),
    approvals = figure(page, 'Current human approvals');
  expect(await counts(age)).toEqual([47, 30, 30, 30, 0, 0, 0]);
  expect(await counts(reviews)).toEqual([39, 40, 40, 1, 0]);
  expect(await counts(approvals)).toEqual([60, 40, 19, 1, 0]);
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByText('Page 2 of 3', { exact: true })).toBeVisible();
  expect(await counts(age)).toEqual([47, 30, 30, 30, 0, 0, 0]);
  const zero = approvals.getByRole('button', { name: 'Zero 60', exact: true });
  await zero.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByText('60 matching records', { exact: true })).toBeVisible();
  await expect(page.getByText('Excludes drafts', { exact: true })).toBeVisible();
  await expect(page.getByText('Page 1 of 2', { exact: true })).toBeVisible();
  await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(50);
  await reviews.getByRole('button', { name: 'One 21', exact: true }).click();
  await expect(page.getByText('21 matching records', { exact: true })).toBeVisible();
  await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(21);
  await expect(reviews.getByRole('button', { name: 'One 21', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.reload();
  await expect(
    page.getByRole('button', { name: 'Remove Human reviewers: One', exact: true }),
  ).toBeVisible();
  await reviews.getByRole('button', { name: 'One 21', exact: true }).click();
  await expect(page.getByText('60 matching records', { exact: true })).toBeVisible();
  await page.goBack();
  await expect(page.getByText('21 matching records', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Clear filters', exact: true }).click();
  await expect(page.getByText('137 matching records', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: '← All repositories', exact: true })).toHaveAttribute(
    'href',
    '/repos?age=60',
  );
});
test('issue age bars reconcile across fifty-row pages and chart visibility stays a presentation preference', async ({
  page,
}) => {
  await login(page);
  await page.goto('/repos/prebidjs?view=issues');
  await showCharts(page);
  const age = figure(page, 'Age distribution');
  expect(await counts(age)).toEqual([30, 30, 30, 30, 60, 180, 474]);
  await age.getByRole('button', { name: '>360 days 474', exact: true }).click();
  await expect(page.getByText('474 matching records', { exact: true })).toBeVisible();
  await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(50);
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByText('Page 2 of 10', { exact: true })).toBeVisible();
  expect(await counts(age)).toEqual([0, 0, 0, 0, 0, 0, 474]);
  await page.getByRole('button', { name: 'Hide charts', exact: true }).click();
  await expect(page.getByRole('figure')).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Show charts', exact: true })).toBeVisible();
  await expect(page.getByText('Page 2 of 10', { exact: true })).toBeVisible();
  await page.goto('/repos/prebidjs?view=issues');
  await expect(page.getByText('834 matching records', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Show charts', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Reset view preferences', exact: true }).click();
  await expect(age).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Show charts', exact: true })).toBeVisible();
});
test('period bars filter the correct event dates and retain the base period and branch', async ({
  page,
}) => {
  await login(page);
  await page.goto(
    '/repos/prebidjs?scope=period&metric=prsMerged&branch=master&from=2026-01-01T00%3A00%3A00.000Z&to=2026-10-24T12%3A00%3A00.000Z&inclusive=1',
  );
  await showCharts(page);
  const chart = figure(page, 'PRs merged');
  expect((await counts(chart)).reduce((a, b) => a + b, 0)).toBe(448);
  const button = chart.getByRole('button').first(),
    label = await button.locator('[data-chart-count]').innerText(),
    count = Number(label);
  expect(count).toBeGreaterThan(0);
  await button.click();
  await expect(page.getByText(count + ' matching records', { exact: true })).toBeVisible();
  await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(Math.min(50, count));
  const url = new URL(page.url());
  expect(url.searchParams.get('prs.filter.eventFrom')).toBe('2026-01-01T00:00:00.000Z');
  expect(url.searchParams.get('prs.filter.eventTo')).toBe('2026-02-01T00:00:00.000Z');
  expect(url.searchParams.get('prs.filter.eventInclusive')).toBe('0');
  expect(url.searchParams.get('to')).toBe('2026-10-24T12:00:00.000Z');
  expect(url.searchParams.get('branch')).toBe('master');
  await expect(
    page.getByRole('button', { name: /Activity dates: Jan 1, 2026 – Jan 31, 2026/ }),
  ).toBeVisible();
  expect((await counts(chart)).reduce((a, b) => a + b, 0)).toBe(count);
  await page.reload();
  await expect(chart.getByRole('button').first()).toHaveAttribute('aria-pressed', 'true');
  await chart.getByRole('button').first().click();
  await expect(page.getByText('448 matching records', { exact: true })).toBeVisible();
});
test('known zero, partial and missing charts preserve their meanings', async ({ page }) => {
  await login(page);
  await page.goto('/repos/prebidjs?scope=current&metric=agedPrs&age=180');
  await showCharts(page);
  expect(await counts(figure(page, 'Age distribution'))).toEqual([0, 0, 0, 0, 0, 0, 0]);
  await expect(figure(page, 'Age distribution').getByRole('button').first()).toBeDisabled();
  await page.goto('/repos/prebid-cache-java?scope=current&metric=agentFeedbackPrs');
  await showCharts(page);
  await expect(page.getByText(/Partial sample coverage:/)).toBeVisible();
  const age = figure(page, 'Age distribution');
  const point = age.locator('button:enabled').first();
  const count = Number(
    (await point.locator('[data-chart-count]').innerText()).split('*')[0].replace(/[^0-9]/g, ''),
  );
  expect(count).toBeGreaterThan(0);
  await point.click();
  await expect(page.getByText(count + ' available sample records', { exact: true })).toBeVisible();
  await page.goto('/repos/prebid-agent-skills?scope=current&metric=humanApprovals0');
  await showCharts(page);
  await expect(
    page.getByRole('heading', { name: 'Sample records unavailable', exact: true }),
  ).toBeVisible();
  await expect(figure(page, 'Current human approvals').getByRole('button')).toHaveCount(0);
});
for (const [kind, theme, width] of [
  ['current', 'dark', 1440],
  ['current', 'light', 375],
  ['period', 'light', 1440],
  ['period', 'dark', 375],
] as const) {
  test(`charts remain readable and accessible (${kind}, ${theme}, ${width}px)`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: 1100 });
    await login(page);
    await page.getByRole('button', { name: 'Theme settings', exact: true }).click();
    await page
      .getByRole('menuitemradio', { name: theme === 'dark' ? 'Dark' : 'Light', exact: true })
      .click();
    await page.goto(
      kind === 'current'
        ? '/repos/prebidjs'
        : '/repos/prebidjs?scope=period&metric=issuesOpened&from=2026-10-01T00%3A00%3A00.000Z&to=2026-10-24T12%3A00%3A00.000Z&inclusive=1',
    );
    await showCharts(page);
    const chart = figure(page, kind === 'current' ? 'Age distribution' : 'Issues created');
    await expect(chart).toBeVisible();
    expect((await new AxeBuilder({ page }).include('main').analyze()).violations).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      width,
    );
    await page.screenshot({ path: info.outputPath(`charts-${kind}-${theme}-${width}.png`) });
  });
}
