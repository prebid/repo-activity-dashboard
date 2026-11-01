import { test, expect } from './fixtures';
import AxeBuilder from '@axe-core/playwright';
async function login(page: import('@playwright/test').Page) {
  await page.goto('/auth/login');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/repos$/);
}
const context =
  '/repos?repo=repo-prebidjs&repo=repo-salesagent&period=this-month&period2=last-month&age=60&backlog.sort=totalOpenPrs&backlog.dir=desc&activity.sort=prsOpened&activity.dir=desc';
test('summary PR and issue links reconcile, paginate, search the full list, and return to both period filters', async ({
  page,
}) => {
  await login(page);
  await page.goto(context);
  const backlog = page.getByRole('table', { name: 'Current backlog', exact: true });
  const js = backlog
    .getByRole('row')
    .filter({ has: page.getByRole('link', { name: 'Prebid.js', exact: true }) });
  await js.locator('[data-column="totalOpenPrs"] a').click();
  await expect(page.getByText('137 matching records', { exact: true })).toBeVisible();
  await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(50);
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(50);
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(37);
  expect(new URL(page.url()).searchParams.get('metric')).toBe('totalOpenPrs');
  await page.getByRole('link', { name: 'All repositories', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'All repositories', exact: true })).toBeVisible();
  for (const [key, value] of new URLSearchParams(context.split('?')[1]))
    expect(new URL(page.url()).searchParams.getAll(key)).toContain(value);
  await js.locator('[data-column="agedPrs60"] a').click();
  await expect(page.getByText('60 matching records', { exact: true })).toBeVisible();
  await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(50);
  const ages = await page.locator('tbody [data-column="ageDays"]').allTextContents();
  expect(ages.every((value) => Number(value) > 60)).toBe(true);
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(10);
  await page.getByRole('button', { name: 'Author', exact: true }).click();
  await page.reload();
  expect(new URL(page.url()).searchParams.get('age')).toBe('60');
  await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(50);
  await page.getByRole('link', { name: 'All repositories', exact: true }).click();
  await js.locator('[data-column="openIssues"] a').click();
  await expect(page.getByText('834 matching records', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page
    .getByRole('textbox', { name: 'Search Open issues', exact: true })
    .fill('Oldest sample issue');
  await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(1);
  await expect(
    page.getByRole('link', { name: 'Oldest sample issue: keyboard navigation', exact: true }),
  ).toHaveAttribute('href', 'https://github.example/example-fixtures/prebidjs/issues/1');
  expect(new URL(page.url()).searchParams.get('metric')).toBe('openIssues');
  await page.getByRole('link', { name: 'All repositories', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Period 2 preset' })).toHaveValue('last-month');
});
test('each stacked period opens its own cohort, retains branch scope, and differences stay informational', async ({
  page,
}, testInfo) => {
  await login(page);
  await page.goto(context);
  const rows = page
    .getByRole('table', { name: 'Period activity' })
    .locator('tbody tr')
    .filter({ hasText: 'Prebid.js' });
  await expect(rows).toHaveCount(3);
  await expect(rows.nth(2).getByRole('link')).toHaveCount(0);
  await expect(rows.nth(0).locator('[data-column="prAuthors"] a')).toHaveCount(1);
  await rows.nth(1).locator('[data-column="prsMerged"] a').click();
  await expect(page.getByText('50 matching records', { exact: true })).toBeVisible();
  await expect(page.getByText('Primary branch: master', { exact: true })).toBeVisible();
  expect(new URL(page.url()).searchParams.get('from')).toBe('2026-09-01T00:00:00.000Z');
  await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(50);
  expect(await page.locator('tbody [data-column="title"] [data-state]').allTextContents()).toEqual(
    Array(50).fill('Merged'),
  );
  await page.getByRole('button', { name: 'Title', exact: true }).click();
  await page.reload();
  expect(new URL(page.url()).searchParams.get('branch')).toBe('master');
  await expect(page.getByRole('columnheader', { name: 'Title ↑', exact: true })).toHaveAttribute(
    'aria-sort',
    'ascending',
  );
  for (const width of [1440, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      width,
    );
    expect((await new AxeBuilder({ page }).include('main').analyze()).violations).toEqual([]);
    await page.screenshot({
      path: testInfo.outputPath('merged-records-' + width + '.png'),
      fullPage: true,
    });
  }
  await page.getByRole('link', { name: 'All repositories', exact: true }).click();
  await rows.nth(0).locator('[data-column="issuesClosed"] a').click();
  await expect(page.getByText('72 matching records', { exact: true })).toBeVisible();
  expect(new URL(page.url()).searchParams.get('from')).toBe('2026-10-01T00:00:00.000Z');
  await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(50);
});
test('known zero, partial, missing, invalid, and author scopes remain distinct', async ({
  page,
}) => {
  await login(page);
  await page.goto('/repos?repo=repo-prebidjs&age=180');
  await page.locator('[data-column="agedPrs180"] a').click();
  await expect(page.getByText('0 matching records', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'No items', exact: true })).toBeVisible();
  await page.goto('/repos/prebid-cache-java?scope=current&metric=agentFeedbackPrs');
  await expect(page.getByText(/Partial sample coverage:/)).toBeVisible();
  await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(2);
  await page.goto('/repos/prebid-agent-skills?scope=current&metric=humanApprovals0');
  await expect(
    page.getByRole('heading', { name: 'Sample records unavailable', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'No items', exact: true })).toHaveCount(0);
  for (const suffix of [
    'scope=current&metric=agedPrs&age=31',
    'scope=current&metric=unknown',
    'returnTo=https://evil.example',
    'scope=period&metric=prsMerged&branch=main&from=2026-10-01T00:00:00.000Z&to=2026-10-24T12:00:00.000Z&inclusive=1',
  ]) {
    await page.goto('/repos/prebidjs?' + suffix);
    await expect(
      page.getByRole('heading', { name: 'Invalid repository filter', exact: true }),
    ).toBeVisible();
    await expect(page.getByRole('table')).toHaveCount(0);
  }
  // The sample record set starts in 2024, so an earlier range has no prepared coverage.
  await page.goto(
    '/repos/prebidjs?scope=period&metric=prsOpened&from=2023-10-01T00:00:00.000Z&to=2023-10-02T00:00:00.000Z&inclusive=0',
  );
  await expect(
    page.getByRole('heading', { name: 'Sample records unavailable', exact: true }),
  ).toBeVisible();
  await page.goto(
    '/repos/prebidjs?scope=period&metric=prAuthors&from=2026-10-01T00:00:00.000Z&to=2026-10-24T12:00:00.000Z&inclusive=1',
  );
  await expect(page.getByRole('heading', { name: 'PR authors', exact: true })).toBeVisible();
});
