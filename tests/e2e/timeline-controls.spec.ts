import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { observeBrowserErrors } from '../support/browser-errors';
async function login(page: Page, email?: string) {
  await page.goto('/auth/login');
  if (email) await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/repos$/);
}
test('restoration preserves a valid near-limit incoming link when canonical defaults would exceed its budget', async ({
  page,
}) => {
  await login(page);
  const params = new URLSearchParams('timeline=1&period=this-year');
  params.set('summary', '/repos?x=');
  const padding = 7498 - new TextEncoder().encode('/repos?' + params.toString()).length;
  params.set('summary', '/repos?x=' + 'a'.repeat(padding));
  const href = '/repos?' + params.toString();
  await page.goto(href);
  await expect(page.getByRole('heading', { name: 'All repositories', exact: true })).toBeVisible();
  await expect(
    page.getByText(
      'Saved Timeline preferences do not fit this report. The requested view is unchanged.',
      { exact: true },
    ),
  ).toBeVisible();
  await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(18);
  await expect(page).toHaveURL('http://127.0.0.1:3100' + href);
});
async function ready(page: Page) {
  await expect(page.getByLabel('Group by', { exact: true })).toBeEnabled();
}
test('canonical presentation restoration does not fetch the Timeline data again', async ({
  page,
}) => {
  await login(page);
  const requests: string[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (
      url.pathname === '/repos' &&
      url.searchParams.get('timeline') === '1' &&
      url.searchParams.has('_rsc')
    )
      requests.push(request.url());
  });
  await page.goto('/repos?timeline=1');
  await ready(page);
  await expect(page).toHaveURL(/timeline\.state=1/);
  await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(18);
  expect(requests).toEqual([]);
});
async function repos(page: Page, names: string[]) {
  await page.getByRole('button', { name: /^Choose repositories/ }).click();
  const dialog = page.getByRole('dialog', { name: 'Choose repositories', exact: true });
  await dialog.getByRole('button', { name: 'Clear selection', exact: true }).click();
  for (const name of names) await dialog.getByRole('checkbox', { name, exact: true }).check();
  await dialog.getByRole('button', { name: 'Apply selection', exact: true }).click();
  await expect(dialog).toBeHidden();
  await ready(page);
}
test('matrix filters, period windows and copied repository returns preserve full context', async ({
  page,
  browser,
}, info) => {
  await login(page);
  await page.goto('/repos?timeline=1&timeline.group=day');
  await ready(page);
  await repos(page, ['Prebid.js', 'Prebid Server (Go)']);
  await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(2);
  await page.getByRole('button', { name: 'Oct 21, 2026', exact: true }).click();
  await page.getByRole('button', { name: 'Oct 21, 2026 ↑', exact: true }).click();
  await page.getByRole('button', { name: 'Earlier', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Window 24 of 25');
  await expect(page.getByText(/outside visible periods/)).toBeVisible();
  const matrix = page.url();
  await page.getByRole('table').getByRole('link', { name: 'Prebid.js', exact: true }).click();
  await ready(page);
  await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(50);
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByText('Page 2 of 6', { exact: true })).toBeVisible();
  const copied = page.url();
  const isolated = await browser.newContext(),
    copy = await isolated.newPage();
  const errors = observeBrowserErrors(copy);
  try {
    await login(copy);
    await copy.goto(copied);
    await ready(copy);
    await expect(copy.getByText('Page 2 of 6', { exact: true })).toBeVisible();
    await copy.getByRole('link', { name: /Repository timeline$/ }).click();
    await ready(copy);
    await expect(copy).toHaveURL(matrix);
    await expect(copy.getByRole('table').locator('tbody tr')).toHaveCount(2);
    errors.assertClean();
  } finally {
    errors.dispose();
    await isolated.close();
  }
  await page.goto(copied);
  await ready(page);
  await expect(page.getByText('Page 2 of 6', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: /Repository timeline$/ }).click();
  await ready(page);
  await expect(page).toHaveURL(matrix);
  await expect(page.getByRole('status')).toContainText('Window 24 of 25');
  await page.getByLabel('Group by', { exact: true }).selectOption('month');
  await ready(page);
  await expect(page.getByRole('status')).toContainText('Window 1 of 1');
  await page.goBack();
  await ready(page);
  await expect(page).toHaveURL(matrix);
  await page.goForward();
  await ready(page);
  await expect(page.getByLabel('Group by', { exact: true })).toHaveValue('month');
  await page.screenshot({ path: info.outputPath('timeline-matrix-controls.png'), fullPage: true });
});
test('saved matrix scope and presentation remain isolated from explicit links and other accounts', async ({
  page,
}) => {
  await login(page);
  await page.goto('/repos?timeline=1');
  await ready(page);
  await page.getByLabel('Group by', { exact: true }).selectOption('quarter');
  await ready(page);
  await page.getByRole('button', { name: 'Metrics · 1', exact: true }).click();
  const metricsDialog = page.getByRole('dialog', { name: 'Choose metrics' });
  await metricsDialog.getByRole('button', { name: 'Clear selection', exact: true }).click();
  await metricsDialog
    .getByRole('group', { name: 'Period activity · Pull requests', exact: true })
    .getByRole('checkbox', { name: 'Merged', exact: true })
    .check();
  await metricsDialog.getByRole('button', { name: 'Apply metrics', exact: true }).click();
  await ready(page);
  await repos(page, ['Prebid.js']);
  await page.goto('/repos?timeline=1');
  await ready(page);
  await expect(page.getByLabel('Group by', { exact: true })).toHaveValue('quarter');
  expect(new URL(page.url()).searchParams.getAll('timeline.metric')).toEqual(['prsMerged']);
  await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(1);
  await page.goto('/repos?timeline=1&timeline.state=1&timeline.group=week&repo=repo-prebidserver');
  await ready(page);
  await expect(page.getByLabel('Group by', { exact: true })).toHaveValue('week');
  await expect(page.getByRole('table')).toContainText('Prebid Server (Go)');
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page).toHaveURL(/\/auth\/login/);
  await login(page, 'bob@example.test');
  await page.goto('/repos?timeline=1');
  await ready(page);
  await expect(page.getByLabel('Group by', { exact: true })).toHaveValue('month');
  await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(18);
});
test('contribution entry keeps list search on return and filters before 50-row timeline pagination', async ({
  page,
}, info) => {
  await login(page);
  await page.goto('/contributors?scope=1&period=this-year&report.q=Alice');
  await page.getByRole('link', { name: 'Over time', exact: true }).click();
  await ready(page);
  expect(new URL(page.url()).searchParams.has('report.q')).toBe(false);
  const table = page.getByRole('table');
  await expect(table.locator('tbody tr').last().locator('[data-column="prsAuthored"]')).toHaveText(
    '6',
  );
  await page.getByLabel('Group by', { exact: true }).selectOption('day');
  await ready(page);
  await expect(table.locator('tbody tr')).toHaveCount(50);
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByText('Page 2 of 6', { exact: true })).toBeVisible();
  await repos(page, ['Prebid.js']);
  await expect(page.getByText('Page 1 of 6', { exact: true })).toBeVisible();
  await page.getByLabel('Group by', { exact: true }).selectOption('month');
  await ready(page);
  await expect(table.locator('tbody tr').last().locator('[data-column="prsAuthored"]')).toHaveText(
    '3',
  );
  await page.getByRole('link', { name: 'Report', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Search Contributors', exact: true })).toHaveValue(
    'Alice',
  );
  expect(new URL(page.url()).searchParams.get('period')).toBe('this-year');
  await page.goto('/companies?timeline=1&scope=1&period=this-year');
  await ready(page);
  await page.getByRole('button', { name: 'All accounts', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Include and exclude accounts' });
  await dialog.getByRole('radio', { name: 'Selected accounts', exact: true }).check();
  await dialog
    .getByRole('group', { name: /^Individuals/ })
    .getByRole('checkbox', { name: /Alice/ })
    .check();
  await dialog.getByRole('button', { name: 'Apply accounts', exact: true }).click();
  await expect(dialog).toBeHidden();
  await ready(page);
  await expect(page.getByLabel('Timeline scope')).toContainText('1 included account');
  await page.screenshot({ path: info.outputPath('timeline-company-filters.png'), fullPage: true });
});
test('repository entry retains title filters and exact activity dates, with review exclusions visible', async ({
  page,
}) => {
  await login(page);
  await page.goto('/repos/prebidjs?prs.filter.approvals=1&prs.q=Sample');
  await page.getByRole('link', { name: 'Timeline', exact: true }).click();
  await ready(page);
  await expect(page.getByText(/Current backlog constraints remain/)).toBeVisible();
  expect(new URL(page.url()).searchParams.get('prs.q')).toBe('Sample');
  expect(new URL(page.url()).searchParams.has('prs.filter.approvals')).toBe(false);
  await page.getByRole('link', { name: /Previous repository view$/ }).click();
  await expect(page).toHaveURL(/prs.filter.approvals=1/);
  expect(new URL(page.url()).searchParams.get('prs.filter.approvals')).toBe('1');
  await page.goto(
    '/repos/prebidjs?scope=period&metric=prsOpened&from=2026-10-01T14%3A00%3A00.000Z&to=2026-10-08T00%3A00%3A00.000Z&inclusive=0',
  );
  await page.getByRole('link', { name: 'Timeline', exact: true }).click();
  await ready(page);
  const q = new URL(page.url()).searchParams;
  expect(q.get('timeline.from')).toBe('2026-10-01T14:00:00.000Z');
  expect(q.get('timeline.to')).toBe('2026-10-08T00:00:00.000Z');
  await page.getByLabel('Group by', { exact: true }).selectOption('day');
  await ready(page);
  await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(7);
  await page.getByRole('button', { name: 'Show chart', exact: true }).click();
  await expect(page.getByRole('figure')).toBeVisible();
  await page.reload();
  await ready(page);
  await expect(page.getByRole('button', { name: 'Hide chart', exact: true })).toBeVisible();
});
test('invalid custom-date drafts remain editable and narrow controls preserve the design', async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 375, height: 1000 });
  await login(page);
  await page.goto('/repos?timeline=1&timeline.group=day');
  await ready(page);
  const before = page.url();
  await page
    .getByRole('button', { name: 'Custom range for Reporting period', exact: true })
    .click();
  const dialog = page.getByRole('dialog', { name: 'Custom date range' });
  await dialog.getByLabel('Start date', { exact: true }).fill('2020-01-01');
  await dialog.getByRole('button', { name: 'Apply dates', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('500 intervals');
  await expect(dialog.getByLabel('Start date')).toHaveValue('2020-01-01');
  await expect(page).toHaveURL(before);
  await dialog.getByLabel('Start date').fill('2026-10-01');
  await dialog.getByRole('button', { name: 'Apply dates', exact: true }).click();
  await ready(page);
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('status')).toContainText('of 24');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  expect((await new AxeBuilder({ page }).include('main').analyze()).violations).toEqual([]);
  await page.screenshot({ path: info.outputPath('timeline-mobile-controls.png'), fullPage: true });
});
test('repository record filters remain independent of table pages and snapshot family changes', async ({
  page,
}) => {
  await login(page);
  await page.goto('/repos/prebidjs?timeline=1&timeline.group=day');
  await ready(page);
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByText('Page 2 of 6', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Record filters', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Filter timeline records' });
  await dialog.locator('summary').filter({ hasText: 'Authors' }).click();
  await dialog
    .getByRole('group', { name: 'Authors', exact: true })
    .getByRole('checkbox', { name: 'sample-alice', exact: true })
    .check();
  await dialog.getByRole('button', { name: 'Apply filters', exact: true }).click();
  await ready(page);
  await expect(page.getByText('Page 1 of 6', { exact: true })).toBeVisible();
  expect(new URL(page.url()).searchParams.getAll('prs.filter.authors')).toEqual(['sample-alice']);
  await page.getByLabel('Measure', { exact: true }).selectOption('snapshot');
  await ready(page);
  expect(new URL(page.url()).searchParams.has('prs.filter.authors')).toBe(false);
  await expect(page.getByRole('heading', { name: 'Backlog over time', exact: true })).toBeVisible();
  await page.getByLabel('Records', { exact: true }).selectOption('issues');
  await ready(page);
  await expect(page.getByRole('columnheader', { name: 'Open', exact: true })).toBeVisible();
});
test('duplicate company IDs canonicalize without a loading deadlock on presentation changes', async ({
  page,
}) => {
  await login(page);
  await page.goto(
    '/companies?timeline=1&scope=1&period=this-year&population=selected&company=company-acme&company=company-acme',
  );
  await ready(page);
  const table = page.getByRole('table'),
    before = await table
      .locator('tbody tr')
      .last()
      .locator('[data-column="prsAuthored"]')
      .textContent();
  await page.getByRole('button', { name: 'Columns', exact: true }).click();
  await page.getByRole('menuitemcheckbox', { name: 'Comment activity', exact: true }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('menu')).toBeHidden();
  await ready(page);
  expect(new URL(page.url()).searchParams.getAll('company')).toEqual(['company-acme']);
  await expect(table.locator('tbody tr').last().locator('[data-column="prsAuthored"]')).toHaveText(
    before!,
  );
  await expect(table.getByRole('columnheader', { name: 'PR comments', exact: true })).toBeVisible();
});
test('matrix entry preserves its population while restoring only compatible repository presentation preferences', async ({
  page,
}) => {
  await login(page);
  await page.goto('/repos/prebidjs?timeline=1');
  await ready(page);
  await page.getByRole('button', { name: 'Record filters', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Filter timeline records' });
  await dialog.locator('summary').filter({ hasText: 'Authors' }).click();
  await dialog
    .getByRole('group', { name: 'Authors', exact: true })
    .getByRole('checkbox', { name: 'sample-alice', exact: true })
    .check();
  await dialog.getByRole('button', { name: 'Apply filters', exact: true }).click();
  await expect(dialog).toBeHidden();
  await ready(page);
  await page.getByRole('button', { name: 'Show chart', exact: true }).click();
  await page
    .getByRole('combobox', { name: 'Chart metric', exact: true })
    .selectOption('medianMergeDays');
  await page.goto('/repos?timeline=1');
  await ready(page);
  await page.getByRole('table').getByRole('link', { name: 'Prebid.js', exact: true }).click();
  await ready(page);
  await expect(page.getByRole('button', { name: 'Hide chart', exact: true })).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Chart metric', exact: true })).toHaveValue(
    'prsOpened',
  );
  expect(new URL(page.url()).searchParams.has('prs.filter.authors')).toBe(false);
  await expect(
    page.getByRole('table').locator('tbody tr').last().locator('[data-column="prsOpened"]'),
  ).toHaveText('3');
});
test('issue-author insight entry inherits its metric and exact period without turning author-table search into record search', async ({
  page,
}) => {
  await login(page);
  await page.goto(
    '/repos/prebidjs?scope=period&metric=issueAuthors&from=2026-10-01T00%3A00%3A00.000Z&to=2026-10-08T00%3A00%3A00.000Z&inclusive=0&authors.q=alice',
  );
  await page.getByRole('link', { name: 'Timeline', exact: true }).click();
  await ready(page);
  const q = new URL(page.url()).searchParams;
  expect(q.get('timeline.kind')).toBe('issues');
  expect(q.get('timeline.metric')).toBe('issueAuthors');
  expect(q.get('timeline.to')).toBe('2026-10-08T00:00:00.000Z');
  expect(q.has('issues.q')).toBe(false);
  await page.getByRole('link', { name: /Previous repository view$/ }).click();
  await expect(page).toHaveURL(/authors.q=alice/);
  await expect(
    page.getByRole('heading', { name: 'Sample records unavailable', exact: true }),
  ).toBeVisible();
});
