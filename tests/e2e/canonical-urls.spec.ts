import type { APIRequestContext, Page } from '@playwright/test';
import { test, expect } from './fixtures';
import {
  encodePreferenceDocument,
  preferenceCookies,
} from '../../src/lib/presentation/preference-cookie';
import {
  defaultOverviewSettings,
  overviewCatalogDefinition,
  serializeOverviewPreferences,
} from '../../src/lib/presentation/overview-settings';
import {
  defaultContributionSettings,
  serializeContributionPreferences,
} from '../../src/lib/presentation/contribution-settings';
import { contributionSample } from '../../src/mocks/contributions';
import type { PreferenceCookieName, PreferenceSectionKey } from '../../src/models/preferences';
import { previewAlice, seedRepositoryPreferences } from '../support/browser-preferences';

// The P5c premises (design §12): literal `,` `:` `@` in addresses, a page-level 307 during an
// in-app navigation, one 307 per route group, the router cache on Back after a cookie change, and
// an old link kept through sign-in. Both engines run them.

const origin = 'http://127.0.0.1:3100';
async function login(page: Page) {
  await page.goto('/auth/login');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/repos$/);
}
const address = (page: Page) => page.evaluate(() => location.pathname + location.search);
const overview = (settings: Partial<ReturnType<typeof defaultOverviewSettings>>) =>
  JSON.parse(
    serializeOverviewPreferences({
      ...defaultOverviewSettings(overviewCatalogDefinition),
      ...settings,
    }),
  ) as unknown;
function cookie(
  name: PreferenceCookieName,
  sections: Partial<Record<PreferenceSectionKey, unknown>>,
) {
  let updated = 0;
  return (
    preferenceCookies[name].name +
    '=' +
    encodePreferenceDocument({
      cookie: name,
      binding: previewAlice,
      sections: Object.fromEntries(
        Object.entries(sections).map(([section, value]) => [
          section,
          { updated: updated++, value },
        ]),
      ),
    })
  );
}

test('literal comma, colon and at survive a link click and a server navigation', async ({
  page,
}) => {
  await login(page);
  await page.goto('/repos?repo=prebidjs,prebidserver');
  await expect(page).toHaveURL(origin + '/repos?repo=prebidjs,prebidserver');
  await page
    .getByRole('navigation', { name: 'Repository overview views' })
    .getByRole('link', { name: 'Timeline', exact: true })
    .click();
  // The bare flag stays bare, and the Summary it came from is the derived parent.
  await expect(page).toHaveURL(origin + '/repos?timeline&repo=prebidjs,prebidserver');
  await page.getByRole('link', { name: /^Prebid\.js, Oct 2026: \d+$/ }).click();
  await expect(page.getByRole('link', { name: 'Back to timeline', exact: true })).toBeVisible();
  const support = await address(page);
  expect(support).toContain('interval=month:2026-10-01');
  expect(support).toContain('@2026-10-24T12:00Z');
  expect(support).toContain('back=/repos~timeline~repo:prebidjs,prebidserver');
  expect(support).not.toMatch(/%2C|%3A|%40/i);
  // A record scope change is a server navigation (router.push) with a snapshot in its address.
  await page.goto('/repos/prebidjs');
  await page.getByRole('combobox', { name: 'Record scope', exact: true }).selectOption('created');
  await expect(page).toHaveURL(/at=2026-10-24T12:00Z/);
  expect(await address(page)).not.toMatch(/%2C|%3A|%40/i);
  expect(await page.locator('a[href*="%25"]').count()).toBe(0);
});

test('a scope change made through a server navigation keeps the address fragment', async ({
  page,
}) => {
  await login(page);
  // A record scope change loads another cohort through router.push.
  await page.goto('/repos/prebidjs#period-activity');
  await page.getByRole('combobox', { name: 'Record scope', exact: true }).selectOption('created');
  await expect(page).toHaveURL(
    origin +
      '/repos/prebidjs?period=this-month&at=2026-10-24T12:00Z&metric=prsOpened#period-activity',
  );
  // So does a Timeline grouping change.
  await page.goto('/repos?timeline#period-activity');
  await expect(page.getByLabel('Group by', { exact: true })).toBeEnabled();
  await page.getByLabel('Group by', { exact: true }).selectOption('quarter');
  await expect(page).toHaveURL(origin + '/repos?timeline&group=quarter#period-activity');
  await expect(page.getByLabel('Group by', { exact: true })).toHaveValue('quarter');
});

test('a 307 during an in-app navigation replaces the entry it lands on', async ({ page }) => {
  await login(page);
  const before = await page.evaluate(() => history.length);
  await page.evaluate(() =>
    (window as unknown as { next: { router: { push(href: string): void } } }).next.router.push(
      '/repos?timeline=1',
    ),
  );
  await expect(page).toHaveURL(origin + '/repos?timeline');
  await expect(page.getByRole('heading', { name: 'All repositories', exact: true })).toBeVisible();
  expect(await page.evaluate(() => history.length)).toBe(before + 1);
  await page.goBack();
  await expect(page).toHaveURL(origin + '/repos');
  // A bare entry whose saved view needs the server (a custom range): the masthead link stays
  // bare and the click lands on the saved explicit form in one entry.
  await page.goto('/contributors');
  await seedRepositoryPreferences(page.context(), origin, {
    overview: overview({
      periods: [{ kind: 'custom', from: '2026-10-06', through: '2026-10-08' }],
    }),
  });
  await page.reload();
  const entries = await page.evaluate(() => history.length);
  const masthead = page
    .getByRole('navigation', { name: 'Main navigation' })
    .getByRole('link', { name: 'Overview', exact: true });
  await expect(masthead).toHaveAttribute('href', '/repos');
  await masthead.click();
  await expect(page).toHaveURL(origin + '/repos?period=2026-10-06..2026-10-08');
  expect(await page.evaluate(() => history.length)).toBe(entries + 1);
});

/** Requests without following redirects, as the signed-in session plus these cookies. */
async function answers(
  request: APIRequestContext,
  session: string[],
  cookies: string[],
  path: string,
) {
  const response = await request.get(path, {
    headers: { cookie: [...session, ...cookies].join('; ') },
    maxRedirects: 0,
  });
  const location = response.headers()['location'];
  return {
    status: response.status(),
    location: location
      ? new URL(location, origin).pathname + new URL(location, origin).search
      : null,
  };
}
test('old links and entries with a differing saved view answer 307 once; others render', async ({
  page,
  request,
}) => {
  await login(page);
  const session = (await page.context().cookies()).map(({ name, value }) => name + '=' + value);
  const legacy: [string, string][] = [
    ['/repos?repo=repo-prebidjs&repo=repo-prebidserver', '/repos?repo=prebidjs,prebidserver'],
    ['/repos?timeline=1&timeline.group=week', '/repos?timeline&group=week'],
    ['/repos/prebidjs?scope=current&metric=openIssues', '/repos/prebidjs?view=issues'],
    ['/repos/prebidjs?timeline=1&timeline.kind=issues', '/repos/prebidjs?timeline&view=issues'],
    [
      '/repos/prebidjs?timeline=1&timeline.detail=prsOpened&timeline.interval=month%3A2026-10-01T00%3A00%3A00.000Z&timeline.revision=repositories-reference-v1&timeline.clock=2026-10-24T12%3A00%3A00.000Z',
      '/repos/prebidjs?timeline&detail=prsOpened&interval=month:2026-10-01&snap=repositories-reference-v1@2026-10-24T12:00Z',
    ],
    [
      '/repos/prebidjs/authors/sample-author-2?scope=period&metric=prAuthors&from=2026-01-01T00:00:00.000Z&to=2026-10-24T12:00:00.000Z&inclusive=1',
      '/repos/prebidjs/authors/sample-author-2?period=this-year&at=2026-10-24T12:00Z&metric=prAuthors',
    ],
    ['/contributors?scope=1&period=last-month', '/contributors?period=last-month'],
    ['/reviewers?scope=1&period=last-month', '/reviewers?period=last-month'],
    ['/companies?scope=1&period=this-year', '/companies?v=1'],
    [
      '/contributors/account-alice?scope=1&period=last-month',
      '/contributors/account-alice?period=last-month',
    ],
    [
      '/companies/id/company-acme?view=repositories&scope=1&period=this-year',
      '/companies/id/company-acme?view=repositories&v=1',
    ],
    ['/contributors?timeline=1&timeline.group=week', '/contributors?timeline&group=week'],
  ];
  for (const [path, target] of legacy)
    expect(await answers(request, session, [], path), path).toEqual({
      status: 307,
      location: target,
    });
  const lastMonth = {
    ...defaultContributionSettings(contributionSample()),
    period: { kind: 'preset' as const, preset: 'last-month' as const },
  };
  const saved = [
    cookie('repositories', {
      overview: overview({ ageThresholds: [60] }),
      'timeline.matrix': { version: 1, query: 'timeline.group=week' },
    }),
    cookie('contributions', {
      'contributions.scope': JSON.parse(serializeContributionPreferences(lastMonth)) as unknown,
    }),
  ];
  for (const [path, target] of [
    ['/repos', '/repos?age=60'],
    ['/repos?timeline', '/repos?timeline&group=week'],
    ['/contributors', '/contributors?period=last-month'],
  ]) {
    expect(await answers(request, session, saved, path), path).toEqual({
      status: 307,
      location: target,
    });
    // Without a saved view the entry renders at its own address.
    expect(await answers(request, session, [], path), path).toEqual({
      status: 200,
      location: null,
    });
  }
  // A contributor page never takes the shared saved scope (decision C2).
  expect(await answers(request, session, saved, '/contributors/account-alice')).toEqual({
    status: 200,
    location: null,
  });
});

test('Back serves each entry’s own view after a saved-view change', async ({ page }) => {
  await login(page);
  const backlog = page.getByRole('table', { name: 'Current backlog', exact: true });
  const over30 = backlog.getByRole('button', { name: /^Over 30 days/ });
  await expect(over30).toBeVisible();
  await page.getByRole('button', { name: 'PR age', exact: true }).first().click();
  await page
    .getByRole('menu', { name: 'PR age', exact: true })
    .getByRole('menuitemcheckbox', { name: 'Over 30 days', exact: true })
    .click();
  await page.keyboard.press('Escape');
  await expect(page).toHaveURL(origin + '/repos?age=');
  const navigation = page.getByRole('navigation', { name: 'Main navigation' });
  await navigation.getByRole('link', { name: 'Contributors', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Contributors', level: 1 })).toBeVisible();
  // The masthead opens the saved view the viewer just made, without a redirect.
  await expect(navigation.getByRole('link', { name: 'Overview', exact: true })).toHaveAttribute(
    'href',
    '/repos?age=',
  );
  await navigation.getByRole('link', { name: 'Overview', exact: true }).click();
  await expect(page).toHaveURL(origin + '/repos?age=');
  await page.goBack();
  await expect(page.getByRole('heading', { name: 'Contributors', level: 1 })).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(origin + '/repos?age=');
  await expect(over30).toHaveCount(0);
  // The first entry was pinned to the defaults it showed before the change, and the server
  // renders it at those defaults after a reload too.
  await page.goBack();
  await expect(page).toHaveURL(origin + '/repos?v=1');
  await expect(over30).toBeVisible();
  await page.reload();
  await expect(over30).toBeVisible();
});

test('an old link opened signed out survives sign-in as its canonical form', async ({ page }) => {
  await page.goto('/repos?timeline=1');
  await expect(page).toHaveURL(/\/auth\/login/);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(origin + '/repos?timeline');
  await expect(page.getByRole('heading', { name: 'All repositories', exact: true })).toBeVisible();
});
