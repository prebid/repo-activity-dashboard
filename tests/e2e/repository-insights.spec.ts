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
test('unique-author drilldowns preserve the selected period, open author-filtered lists, and search beyond page one', async ({
  page,
}) => {
  await login(page);
  await page.goto(context);
  await periodRows(page).nth(1).locator('[data-column="prAuthors"] a').click();
  await expect(page.getByText('29 unique accounts', { exact: true })).toBeVisible();
  expect(new URL(page.url()).searchParams.get('from')).toBe('2026-09-01T00:00:00.000Z');
  await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(29);
  await page.getByRole('link', { name: 'View 3 PRs by sample-author-1', exact: true }).click();
  await expect(page.getByText('3 matching records', { exact: true })).toBeVisible();
  await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(3);
  await expect(page.locator('tbody [data-column="title"] a').first()).toHaveAttribute(
    'href',
    /^https:\/\/github\.example\/example-fixtures\/prebidjs\/pull\//,
  );
  await page.getByRole('link', { name: '← PR authors', exact: true }).click();
  await expect(page.getByText('29 unique accounts', { exact: true })).toBeVisible();
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
  await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(50);
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(50);
  const recordLink = page.locator('tbody [data-column="records"] a').first();
  await recordLink.click();
  await expect(
    page.getByText('Created during this period · All statuses', { exact: true }),
  ).toBeVisible();
  await page.getByRole('link', { name: '← Issue authors', exact: true }).click();
  await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(50);
  expect(new URL(page.url()).searchParams.get('authors.page')).toBe('2');
  await page
    .getByRole('textbox', { name: 'Search Issue authors', exact: true })
    .fill('sample-author-194');
  await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(1);
  expect(new URL(page.url()).searchParams.get('metric')).toBe('issueAuthors');
});

for (const [metric, noun, authorLabel] of [
  ['prAuthors', 'PRs', 'PR authors'],
  ['issueAuthors', 'Issues', 'Issue authors'],
] as const) {
  test(`bot ${noun} authors open matching records and preserve their parent scope`, async ({
    page,
  }) => {
    await login(page);
    await page.goto(context);
    await periodRows(page)
      .nth(0)
      .locator('[data-column="' + metric + '"] a')
      .click();
    const account = 'sample-author-3[bot]';
    await page.getByRole('textbox', { name: 'Search ' + authorLabel, exact: true }).fill(account);
    await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(1);
    const link = page.getByRole('link', { name: 'View 2 ' + noun + ' by ' + account, exact: true });
    await expect(link).toHaveAttribute('href', /sample-author-3%5Bbot%5D/);
    await link.click();
    const heading = page.getByRole('heading', { name: noun + ' by ' + account, exact: true });
    await expect(heading).toBeVisible();
    await expect(page.getByText('2 matching records', { exact: true })).toBeVisible();
    await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(2);
    expect(
      await page
        .locator('tbody [data-column="author"]')
        .getByText(account, { exact: true })
        .allTextContents(),
    ).toEqual([account, account]);
    await expect(
      page.locator('tbody [data-column="author"]').getByText('Bot', { exact: true }),
    ).toHaveCount(2);
    const query = new URL(page.url()).search;
    expect(new URL(page.url()).searchParams.get('metric')).toBe(metric);
    expect(new URL(page.url()).searchParams.get('from')).toBe('2026-10-01T00:00:00.000Z');
    expect(new URL(page.url()).searchParams.get('to')).toBe('2026-10-24T12:00:00.000Z');
    const returnTo = new URL(page.url()).searchParams.get('returnTo')!;
    const overview = new URL(returnTo, 'http://127.0.0.1:3100');
    const selected = new URL(context, 'http://127.0.0.1:3100');
    expect(overview.pathname).toBe('/repos');
    for (const key of ['repo', 'period', 'period2', 'age', 'activity.sort', 'activity.dir'])
      expect(overview.searchParams.getAll(key)).toEqual(selected.searchParams.getAll(key));
    expect(overview.searchParams.get('backlog.sort')).toBe('totalOpenPrs');
    expect(overview.searchParams.get('backlog.dir')).toBe('desc');
    await page.reload();
    await expect(heading).toBeVisible();
    await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(2);
    await page.getByRole('link', { name: '← ' + authorLabel, exact: true }).click();
    await expect(
      page.getByRole('textbox', { name: 'Search ' + authorLabel, exact: true }),
    ).toHaveValue(account);
    await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(1);
    await page.getByRole('link', { name: '← All repositories', exact: true }).click();
    await expect(page).toHaveURL(overview.href);
    await page.goto('/repos/prebidjs/authors/not-in-this-sample%5Bbot%5D' + query);
    await expect(
      page.getByRole('heading', { name: noun + ' by not-in-this-sample[bot]', exact: true }),
    ).toBeVisible();
    await expect(page.getByText('0 matching records', { exact: true })).toBeVisible();
    await page.goto('/repos/prebidjs/authors/sample-author-3%255Bbot%255D' + query);
    await expect(
      page.getByRole('heading', { name: 'Invalid author filter', exact: true }),
    ).toBeVisible();
    await expect(page.getByRole('table')).toHaveCount(0);
  });
}

for (const [metric, noun, count, finalPageCount, oldestNumber] of [
  ['prAuthors', 'PRs', 240, 40, '500001'],
  ['issueAuthors', 'Issues', 350, 50, '550001'],
] as const) {
  test(
    'high-volume ' +
      noun +
      ' stay author-filtered, paginated, searchable, and return to the parent view',
    async ({ page }) => {
      await login(page);
      const query =
        'scope=period&metric=' +
        metric +
        '&from=2026-01-01T00:00:00.000Z&to=2026-10-24T12:00:00.000Z&inclusive=1&returnTo=%2Frepos%3Fperiod%3Dthis-year%26age%3D60';
      await page.goto('/repos/prebidjs?' + query);
      const searchName = metric === 'prAuthors' ? 'Search PR authors' : 'Search Issue authors';
      await page.getByRole('textbox', { name: searchName, exact: true }).fill('sample-author-2');
      await page
        .getByRole('link', {
          name: 'View ' + count + ' ' + noun + ' by sample-author-2',
          exact: true,
        })
        .click();
      await expect(page.getByText(count + ' matching records', { exact: true })).toBeVisible();
      await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(50);
      expect(new URL(page.url()).pathname).toBe('/repos/prebidjs/authors/sample-author-2');
      await expect(
        page.getByText('Created during this period · All statuses', { exact: true }),
      ).toBeVisible();
      const allAuthors = await page
        .locator('tbody [data-column="author"]')
        .getByText('sample-author-2', { exact: true })
        .allTextContents();
      expect(allAuthors).toEqual(Array(50).fill('sample-author-2'));
      await expect(
        page.locator('tbody [data-column="author"]').getByText('Prebid agent', { exact: true }),
      ).toHaveCount(50);
      for (let pageNumber = 2; pageNumber <= Math.ceil(count / 50); pageNumber++) {
        await page.getByRole('button', { name: 'Next', exact: true }).click();
        await expect(
          page.getByText('Page ' + pageNumber + ' of ' + Math.ceil(count / 50), { exact: true }),
        ).toBeVisible();
      }
      await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(finalPageCount);
      await expect(page.getByRole('button', { name: 'Next', exact: true })).toBeDisabled();
      await page
        .getByRole('textbox', { name: 'Search ' + noun + ' by sample-author-2', exact: true })
        .fill(oldestNumber);
      await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(1);
      await page.reload();
      await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(1);
      expect(new URL(page.url()).searchParams.get('metric')).toBe(metric);
      if (metric === 'prAuthors') {
        await page
          .getByRole('textbox', { name: 'Search PRs by sample-author-2', exact: true })
          .fill('Draft');
        await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(14);
        await expect(page.locator('tbody [data-column="title"] [data-state="Draft"]')).toHaveCount(
          14,
        );
      }
      await page
        .getByRole('link', {
          name: metric === 'prAuthors' ? '← PR authors' : '← Issue authors',
          exact: true,
        })
        .click();
      await expect(page.getByRole('textbox', { name: searchName, exact: true })).toHaveValue(
        'sample-author-2',
      );
      expect(new URL(page.url()).searchParams.get('authors.q')).toBe('sample-author-2');
      expect(
        new URL(page.url()).searchParams.has(metric === 'prAuthors' ? 'prs.q' : 'issues.q'),
      ).toBe(false);
      await page.getByRole('link', { name: '← All repositories', exact: true }).click();
      await expect(page).toHaveURL(/\/repos\?period=this-year&age=60$/);
      for (const invalid of [
        '/repos/prebidjs/authors/bad%20actor?' + query,
        '/repos/prebidjs/authors/sample-author-2?scope=current&metric=totalOpenPrs',
      ]) {
        await page.goto(invalid);
        await expect(
          page.getByRole('heading', { name: 'Invalid author filter', exact: true }),
        ).toBeVisible();
        await expect(page.getByRole('table')).toHaveCount(0);
      }
      await page.setViewportSize({ width: 320, height: 800 });
      await page.goto('/repos/prebidjs/authors/' + 'a'.repeat(100) + '?' + query);
      await expect(page.getByText('0 matching records', { exact: true })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        320,
      );
    },
  );
}
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
  await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(50);
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(50);
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(45);
  await page
    .getByRole('textbox', { name: 'Search Prebid agent reviewer contributions', exact: true })
    .fill('sample-prebid-agent-a');
  await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(50);
  await page.reload();
  await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(50);
  await expect(page.getByText('73 matching contribution credits', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(23);
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
