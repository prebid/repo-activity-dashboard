import { test, expect } from './fixtures';
import { listParam } from '../support/contribution-urls';
import { contributionSample } from '../../src/mocks/contributions';
import {
  defaultContributionSettings,
  writeContributionSettings,
  serializeContributionPreferences,
} from '../../src/lib/presentation/contribution-settings';
import type { Page } from '@playwright/test';
import {
  contributionPreferences,
  seedContributionPreferences,
} from '../support/browser-preferences';
async function login(page: Page) {
  await page.goto('/auth/login');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/repos$/);
}
test('keeps rendered rows visible while controls wait for hydration', async ({ page }) => {
  await login(page);
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  let scripts = 0;
  await page.route('**/_next/static/**', async (route) => {
    if (/\.js(?:\?|$)/.test(route.request().url())) {
      scripts++;
      await held;
    }
    await route.continue();
  });
  try {
    await page.goto('/contributors?sample=large', { waitUntil: 'commit' });
    await expect.poll(() => scripts).toBeGreaterThan(0);
    await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(50);
    const search = page.getByRole('textbox', { name: 'Search Contributors', exact: true });
    await expect(search).toBeDisabled();
    await expect(page.getByRole('combobox', { name: 'Reporting period preset' })).toBeDisabled();
    release();
    await expect(search).toBeEnabled();
    await search.fill('sample-heavy-agent');
    await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(1);
    await expect(search).toHaveValue('sample-heavy-agent');
  } finally {
    release();
    await page.unrouteAll({ behavior: 'wait' });
  }
});
test('explicit report links render rows without JavaScript or preference hydration', async ({
  page,
  browser,
}) => {
  await login(page);
  const context = await browser.newContext({
    javaScriptEnabled: false,
    storageState: await page.context().storageState(),
  });
  try {
    const plain = await context.newPage();
    for (const route of [
      '/contributors',
      '/companies',
      '/contributors/account-alice',
      '/companies/id/company-acme',
    ]) {
      await plain.goto(new URL(route + '?scope=1&period=this-year', page.url()).href);
      await expect(plain.getByRole('table').locator('tbody tr').first()).toBeVisible();
      await expect(plain.getByText('Restoring this report…')).toHaveCount(0);
    }
  } finally {
    await context.close();
  }
});
for (const saved of [false, true])
  test(
    'header entry makes one report request with ' + (saved ? 'saved' : 'default') + ' scope',
    async ({ page, baseURL }) => {
      await login(page);
      if (saved) {
        const settings = defaultContributionSettings(contributionSample());
        settings.period = { kind: 'preset', preset: 'last-month' };
        await seedContributionPreferences(page.context(), baseURL!, {
          'contributions.scope': JSON.parse(serializeContributionPreferences(settings)) as unknown,
        });
        await page.reload();
      }
      const requests: string[] = [];
      page.on('request', (request) => {
        if (new URL(request.url()).pathname === '/contributors' && request.headers().rsc === '1')
          requests.push(request.url());
      });
      const entry = page
        .getByRole('navigation', { name: 'Main navigation' })
        .getByRole('link', { name: 'Contributors', exact: true });
      if (saved) await expect(entry).toHaveAttribute('href', /period=last-month/);
      await entry.click();
      await expect(page.getByRole('table').locator('tbody tr').first()).toBeVisible();
      if (saved)
        await expect(page.getByRole('combobox', { name: 'Reporting period preset' })).toHaveValue(
          'last-month',
        );
      else await expect(page).toHaveURL(/\/contributors$/);
      expect(requests).toHaveLength(1);
      expect(new URL(requests[0]).searchParams.get('period')).toBe(saved ? 'last-month' : null);
    },
  );
test('changing a drilldown period preserves the saved repository population', async ({ page }) => {
  await login(page);
  await page.goto('/contributors?period=this-year');
  await page.getByRole('combobox', { name: 'Reporting period preset' }).selectOption('this-month');
  // The choice navigates in the client; let that navigation finish before leaving the page.
  await expect(page).toHaveURL(/[?&]period=this-month(&|$)/);
  await expect(page.getByRole('table').locator('tbody tr').first()).toBeVisible();
  await page.goto('/contributors/account-alice?period=this-year');
  await page
    .getByRole('table')
    .locator('tbody tr')
    .filter({ hasText: 'Prebid.js' })
    .getByRole('link', { name: /^PRs authored:/ })
    .click();
  await expect(page).toHaveURL(/metric=prsAuthored/);
  await page.getByRole('combobox', { name: 'Reporting period preset' }).selectOption('last-month');
  await expect(page.getByRole('combobox', { name: 'Reporting period preset' })).toHaveValue(
    'last-month',
  );
  await page
    .getByRole('navigation', { name: 'Main navigation' })
    .getByRole('link', { name: 'Contributors', exact: true })
    .click();
  await expect(page.getByRole('button', { name: /^Choose repositories 18 \/ 18/ })).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Reporting period preset' })).toHaveValue(
    'last-month',
  );
});
test('sorting and columns share a table scope across contributors and companies', async ({
  page,
}) => {
  await login(page);
  await page.goto('/contributors/account-alice?period=this-year');
  await page
    .getByRole('columnheader', { name: 'PRs authored', exact: true })
    .getByRole('button')
    .click();
  await page.getByRole('button', { name: /^Columns( · .+)?$/ }).click();
  await page.getByRole('menuitemcheckbox', { name: 'Issues authored', exact: true }).click();
  await page.keyboard.press('Escape');
  for (const route of [
    '/contributors/account-bob?period=this-year',
    '/companies/id/company-acme?period=this-year&view=repositories',
  ]) {
    await page.goto(route);
    await expect(page.getByRole('columnheader', { name: /PRs authored/ })).toHaveAttribute(
      'aria-sort',
      'ascending',
    );
    await expect(
      page.getByRole('columnheader', { name: 'Issues authored', exact: true }),
    ).toHaveCount(0);
  }
  // One sort and one column section serve the repository table on both pages.
  expect(Object.keys((await contributionPreferences(page.context())) ?? {}).sort()).toEqual([
    'contributions.repositories.columns',
    'contributions.repositories.sort',
  ]);
  await page.goto(
    '/contributors/account-alice?period=this-year&repositories.sort=name&repositories.dir=desc&repositories.columns=name',
  );
  await expect(page.getByRole('columnheader', { name: /Repository/ })).toHaveAttribute(
    'aria-sort',
    'descending',
  );
  await expect(page.getByRole('columnheader', { name: /PRs authored/ })).toHaveCount(0);
  await page.goto('/contributors/account-bob?period=this-year');
  await expect(page.getByRole('columnheader', { name: /PRs authored/ })).toHaveAttribute(
    'aria-sort',
    'ascending',
  );
});
test('100-account deep links stay bounded and preserve copied return context', async ({
  page,
  context,
}) => {
  await login(page);
  const source = contributionSample({ scenario: 'large' });
  const settings = defaultContributionSettings(source);
  settings.selection.population = {
    kind: 'selected',
    accountIds: source.accounts.slice(0, 100).map((account) => account.id),
    companyIds: [],
  };
  await page.goto('/contributors?sample=large&' + writeContributionSettings('', settings));
  await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(50);
  // The table's controls enable once the page is interactive; a click before then is not handled.
  await expect(page.getByRole('button', { name: /^Columns( · .+)?$/ })).toBeEnabled();
  await page
    .getByRole('table')
    .getByRole('link', { name: / — view contribution report$/ })
    .first()
    .click();
  await expect(page.getByRole('table', { name: 'By repository', exact: true })).toBeVisible();
  const parent = page.url();
  await page
    .getByRole('table')
    .getByRole('link', { name: /^PRs authored:/ })
    .first()
    .click();
  await expect(page.getByRole('region', { name: 'Supporting record totals' })).toBeVisible();
  expect(page.url().length).toBeLessThan(7500);
  const copied = await context.newPage();
  try {
    await copied.goto(page.url());
    await expect(copied.getByRole('table').locator('tbody tr').first()).toBeVisible();
    await copied.getByRole('link', { name: 'Back to report', exact: true }).click();
    await expect(copied.getByRole('table', { name: 'By repository', exact: true })).toBeVisible();
    expect(new URL(copied.url()).pathname).toBe(new URL(parent).pathname);
    expect(listParam(copied.url(), 'account').sort()).toEqual(
      [...settings.selection.population.accountIds].sort(),
    );
    await copied.reload();
    await copied.getByRole('link', { name: 'Back to Contributors', exact: true }).click();
    await expect(
      copied.getByRole('table', { name: 'Contributors', exact: true }).locator('tbody tr'),
    ).toHaveCount(50);
  } finally {
    await copied.close();
  }
  await page.getByRole('link', { name: 'Example Acme', exact: true }).click();
  await expect(
    page.getByRole('table', { name: 'Company contributors', exact: true }).locator('tbody tr'),
  ).toHaveCount(50);
  expect(page.url().length).toBeLessThan(7500);
  await page
    .getByRole('table')
    .getByRole('link', { name: /^PRs authored:/ })
    .first()
    .click();
  await expect(page.getByRole('region', { name: 'Supporting record totals' })).toBeVisible();
  expect(page.url().length).toBeLessThan(7500);
  expect(listParam(page.url(), 'account').sort()).toEqual(
    [...settings.selection.population.accountIds].sort(),
  );
});
test('Over time area tabs open the other area’s Over time, whose Report tab stays in that area', async ({
  page,
}) => {
  await login(page);
  await page.goto('/contributors?scope=1&period=this-year');
  await page
    .getByRole('navigation', { name: 'Report view', exact: true })
    .getByRole('link', { name: 'Over time', exact: true })
    .click();
  await expect(page).toHaveURL(
    (url) => url.pathname === '/contributors' && url.searchParams.has('timeline'),
  );
  await page
    .getByRole('navigation', { name: 'Contribution reports', exact: true })
    .getByRole('link', { name: 'Companies', exact: true })
    .click();
  await expect(page.getByRole('heading', { name: 'Companies', level: 1 })).toBeVisible();
  await expect(page).toHaveURL(
    (url) => url.pathname === '/companies' && url.searchParams.has('timeline'),
  );
  const views = page.getByRole('navigation', { name: 'Report view', exact: true });
  await expect(views.getByRole('link', { name: 'Over time', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await views.getByRole('link', { name: 'Report', exact: true }).click();
  await expect(page).toHaveURL(
    (url) => url.pathname === '/companies' && !url.searchParams.has('timeline'),
  );
  await expect(page.getByRole('table', { name: 'Companies', exact: true })).toBeVisible();
});
test('Back to Contributors on a contributor’s Over time returns to the list the report came from', async ({
  page,
}) => {
  await login(page);
  await page.goto('/contributors?sample=large&scope=1&period=this-year');
  await expect(page.getByRole('button', { name: /^Columns( · .+)?$/ })).toBeEnabled();
  await page
    .getByRole('textbox', { name: 'Search Contributors', exact: true })
    .fill('sample-heavy-agent');
  await page
    .getByRole('table')
    .getByRole('link', { name: /^Sample agent with hundreds.* — view contribution report$/ })
    .click();
  await expect(page.getByRole('region', { name: 'Report totals' })).toBeVisible();
  await page
    .getByRole('navigation', { name: 'Report view', exact: true })
    .getByRole('link', { name: 'Over time', exact: true })
    .click();
  await expect(page.getByRole('region', { name: 'Timeline scope', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Back to Contributors', exact: true }).click();
  await expect(page).toHaveURL((url) => url.pathname === '/contributors');
  await expect(page.getByRole('textbox', { name: 'Search Contributors', exact: true })).toHaveValue(
    'sample-heavy-agent',
  );
  await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(1);
});
test('old links and a differing bare entry are answered with one 307; exports never are', async ({
  page,
  baseURL,
}) => {
  await login(page);
  const answer = async (path: string) => {
    const response = await page.request.get(path, { maxRedirects: 0 });
    const location = response.headers()['location'];
    const target = location === undefined ? null : new URL(location, baseURL);
    return [response.status(), target && target.pathname + target.search];
  };
  for (const [legacy, canonical] of [
    [
      '/contributors?scope=1&period=this-year&report.sort=name&report.dir=asc',
      '/contributors?sort=name',
    ],
    [
      '/companies?scope=1&period=last-month&repo=repo-prebidjs',
      '/companies?repo=prebidjs&period=last-month',
    ],
    [
      '/contributors/account-alice?scope=1&period=this-year&repositories.page=2',
      '/contributors/account-alice?page=2',
    ],
    [
      '/companies/id/company-acme?view=repositories&scope=1&period=this-year',
      // The old explicit-state marker pins the defaults, so no saved view replaces them.
      '/companies/id/company-acme?view=repositories&v=1',
    ],
  ])
    expect(await answer(legacy), legacy).toEqual([307, canonical]);
  // The canonical form is served as it is.
  expect(await answer('/companies?repo=prebidjs&period=last-month')).toEqual([200, null]);
  expect(await answer('/contributors')).toEqual([200, null]);
  const lastMonth = defaultContributionSettings(contributionSample());
  lastMonth.period = { kind: 'preset', preset: 'last-month' };
  await seedContributionPreferences(page.context(), baseURL!, {
    'contributions.scope': JSON.parse(serializeContributionPreferences(lastMonth)) as unknown,
  });
  expect(await answer('/contributors')).toEqual([307, '/contributors?period=last-month']);
  // A subject page never takes the shared saved scope (decision C2).
  expect(await answer('/contributors/account-alice')).toEqual([200, null]);
  for (const query of [
    'scope=1&period=this-year&entity=overview&column=name&column=prsAuthored',
    'entity=overview&layout=summary&columns=name,prsAuthored',
  ])
    expect((await answer('/contributors/export?' + query))[0], query).toBe(200);
});
