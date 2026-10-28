import { test, expect } from './fixtures';
import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
const context =
  '/repos?repo=repo-prebidjs&repo=repo-salesagent&period=this-month&period2=last-month&age=60&activity.sort=prsOpened&activity.dir=desc';
const range = 'from=2026-10-01T00%3A00%3A00.000Z&to=2026-10-24T12%3A00%3A00.000Z&inclusive=1';
async function login(page: Page) {
  await page.goto('/auth/login');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/repos$/);
}
function periodRows(page: Page) {
  return page
    .getByRole('table', { name: 'Period activity', exact: true })
    .locator('tbody tr')
    .filter({ hasText: 'Prebid.js' });
}
test('unique-author drilldowns preserve the selected period, expand source links, and search beyond page one', async ({
  page,
}) => {
  await login(page);
  await page.goto(context);
  await periodRows(page).nth(1).locator('[data-column="prAuthors"] a').click();
  await expect(page.getByText('29 unique accounts', { exact: true })).toBeVisible();
  expect(new URL(page.url()).searchParams.get('from')).toBe('2026-09-01T00:00:00.000Z');
  await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(29);
  const disclosure = page.locator('details summary').first();
  await disclosure.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('details').first()).toHaveAttribute('open', '');
  await expect(page.locator('details').first().getByRole('link').first()).toHaveAttribute(
    'href',
    /^https:\/\/github\.example\/example-fixtures\/prebidjs\/pull\//,
  );
  await page.getByRole('link', { name: '← All repositories', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Period 2 preset' })).toHaveValue('last-month');
  expect(new URL(page.url()).searchParams.getAll('repo')).toEqual([
    'repo-prebidjs',
    'repo-salesagent',
  ]);
  expect(new URL(page.url()).searchParams.get('age')).toBe('60');
  await page.goto('/repos?repo=repo-prebidjs&period=this-year');
  await periodRows(page).nth(0).locator('[data-column="issueAuthors"] a').click();
  await expect(page.getByText('194 unique accounts', { exact: true })).toBeVisible();
  await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(100);
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(94);
  await page
    .getByRole('textbox', { name: 'Search Issue authors', exact: true })
    .fill('sample-author-194');
  await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(1);
  expect(new URL(page.url()).searchParams.get('metric')).toBe('issueAuthors');
});
test('all agent and bot contribution links reconcile credits, retain context, and page the full credit population', async ({
  page,
}) => {
  await login(page);
  await page.goto(context);
  const activity = page.getByRole('region', { name: 'Period activity', exact: true });
  await activity.getByRole('button', { name: 'Columns', exact: true }).click();
  await page.getByRole('menuitemcheckbox', { name: 'Prebid agents', exact: true }).click();
  await page.getByRole('menuitemcheckbox', { name: 'Other bots', exact: true }).click();
  await page.keyboard.press('Escape');
  for (const [metric, count, distinct] of [
    ['agentFeedbackCredits', 18, 9],
    ['agentApprovalCredits', 9, 5],
    ['botFeedbackCredits', 11, 6],
    ['botApprovalCredits', 4, 2],
  ] as const) {
    await periodRows(page)
      .nth(0)
      .locator('[data-column="' + metric + '"] a')
      .click();
    await expect(page.getByText(count + ' contribution credits', { exact: true })).toBeVisible();
    await expect(page.getByText(distinct + ' distinct PRs', { exact: true })).toBeVisible();
    await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(count);
    expect(new URL(page.url()).searchParams.get('metric')).toBe(metric);
    await page.getByRole('link', { name: '← All repositories', exact: true }).click();
    await expect(
      page.getByRole('heading', { name: 'All repositories', exact: true }),
    ).toBeVisible();
  }
  await page.goto(
    '/repos/prebidjs?scope=period&metric=agentFeedbackCredits&from=2026-01-01T00:00:00.000Z&to=2026-10-24T12:00:00.000Z&inclusive=1',
  );
  await expect(page.getByText('145 contribution credits', { exact: true })).toBeVisible();
  await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(100);
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(45);
  await page
    .getByRole('textbox', { name: 'Search Prebid agent reviewer contributions', exact: true })
    .fill('sample-prebid-agent-a');
  await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(73);
  await page.reload();
  await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(73);
  expect(new URL(page.url()).searchParams.get('metric')).toBe('agentFeedbackCredits');
});
test('duration links show median and sample size separately with numeric sorting and valid branch scope', async ({
  page,
}) => {
  await login(page);
  await page.goto(context);
  await periodRows(page).nth(0).locator('[data-column="medianMergeDays"] a').click();
  await expect(page.getByText('5.5 d', { exact: true })).toBeVisible();
  await expect(page.getByText('38 merged PRs', { exact: true })).toBeVisible();
  await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(38);
  await page.getByRole('button', { name: 'Merge time', exact: true }).click();
  await page.reload();
  await expect(
    page.getByRole('columnheader', { name: 'Merge time ↑', exact: true }),
  ).toHaveAttribute('aria-sort', 'ascending');
  const days = (await page.locator('[data-column="mergeDays"]').allTextContents()).map(
    Number.parseFloat,
  );
  expect(new Set(days).size).toBeGreaterThan(1);
  expect(days).toEqual([...days].sort((a, b) => a - b));
  expect(new URL(page.url()).searchParams.get('branch')).toBe('master');
  expect(new URL(page.url()).searchParams.get('metric')).toBe('medianMergeDays');
  await page.getByRole('link', { name: '← All repositories', exact: true }).click();
  await periodRows(page).nth(1).locator('[data-column="medianMergeDays"] a').click();
  await expect(page.getByText('6.5 d', { exact: true })).toBeVisible();
  await expect(page.getByText('48 merged PRs', { exact: true })).toBeVisible();
  await page.goto(
    '/repos/prebid-mobile-ios-sdk?scope=period&metric=medianMergeDays&branch=main&' + range,
  );
  await expect(
    page.getByRole('heading', { name: 'No merged PRs in this period', exact: true }),
  ).toBeVisible();
  await page.goto('/repos/prebidjs?scope=period&metric=medianMergeDays&branch=main&' + range);
  await expect(
    page.getByRole('heading', { name: 'Invalid repository filter', exact: true }),
  ).toBeVisible();
  await page.goto('/repos/prebidjs?scope=period&metric=prAuthors&branch=master&' + range);
  await expect(
    page.getByRole('heading', { name: 'Invalid repository filter', exact: true }),
  ).toBeVisible();
});
test('supporting detail tables stay accessible in both themes at desktop and narrow widths', async ({
  page,
}, testInfo) => {
  await login(page);
  for (const metric of ['prAuthors', 'agentFeedbackCredits', 'medianMergeDays']) {
    await page.goto(
      '/repos/prebidjs?scope=period&metric=' +
        metric +
        (metric === 'medianMergeDays' ? '&branch=master' : '') +
        '&' +
        range,
    );
    await expect(page.getByRole('table')).toBeVisible();
    if (metric === 'prAuthors') await page.locator('details summary').first().click();
    for (const theme of ['dark', 'light']) {
      await page.getByRole('button', { name: 'Theme settings', exact: true }).click();
      await page
        .getByRole('menuitemradio', { name: theme === 'dark' ? 'Dark' : 'Light', exact: true })
        .click();
      for (const width of [1440, 320]) {
        await page.setViewportSize({ width, height: 1000 });
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
          width,
        );
        expect((await new AxeBuilder({ page }).include('main').analyze()).violations).toEqual([]);
        await page.screenshot({
          path: testInfo.outputPath(metric + '-' + theme + '-' + width + '.png'),
          fullPage: true,
        });
      }
    }
  }
});
