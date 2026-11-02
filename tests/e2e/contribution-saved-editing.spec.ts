import { test, expect } from './fixtures';
import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { contributionSample } from '../../src/mocks/contributions';
import {
  defaultContributionSettings,
  serializeContributionPreferences,
} from '../../src/lib/presentation/contribution-settings';
import type { ContributionSettings } from '../../src/models/contribution-settings';
import {
  contributionPreferences,
  seedContributionPreferences,
} from '../support/browser-preferences';
const defaults = defaultContributionSettings(contributionSample());
const stored = (value: ContributionSettings): unknown =>
  JSON.parse(serializeContributionPreferences(value));
async function login(page: Page) {
  await page.goto('/auth/login');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/repos$/);
}
async function saveScope(page: Page, baseURL: string, value: ContributionSettings) {
  await seedContributionPreferences(page.context(), baseURL, {
    'contributions.scope': stored(value),
  });
}
/**
 * Records, from the next document load on, every history entry the page adds and every address it
 * rewrites. The router's own bookkeeping write of the unchanged address is not a rewrite.
 */
async function recordHistoryWrites(page: Page) {
  await page.addInitScript(() => {
    const writes: string[] = [];
    (window as unknown as { historyWrites: string[] }).historyWrites = writes;
    for (const method of ['pushState', 'replaceState'] as const) {
      const native = history[method].bind(history);
      history[method] = (...args: Parameters<History['pushState']>) => {
        const before = location.href;
        native(...args);
        if (method === 'pushState' || location.href !== before)
          writes.push(method + ' ' + location.href);
      };
    }
  });
  return () =>
    page.evaluate(() => (window as unknown as { historyWrites: string[] }).historyWrites);
}
const entry = (page: Page) =>
  page
    .getByRole('navigation', { name: 'Main navigation' })
    .getByRole('link', { name: 'Contributions', exact: true });
const period = (page: Page) => page.getByRole('combobox', { name: 'Reporting period preset' });
const lastMonth = (): ContributionSettings => ({
  ...structuredClone(defaults),
  period: { kind: 'preset', preset: 'last-month' },
});

test('the first render shows the saved view, with no rewrite after load', async ({
  page,
  browser,
  baseURL,
}) => {
  await login(page);
  await seedContributionPreferences(page.context(), baseURL!, {
    'contributions.scope': stored(lastMonth()),
    'contributions.contributors.columns': {
      version: 1,
      columns: { issuesAuthored: false },
      hideZeroMembers: false,
    },
    'contributions.contributors.sort': { sort: 'name', descending: false },
  });
  // Without JavaScript the server's response already is the saved view: the entry is answered
  // with a redirect to its explicit-scope URL, rendered with the saved columns and sort.
  const plain = await browser.newContext({
    javaScriptEnabled: false,
    storageState: await page.context().storageState(),
  });
  try {
    const html = await plain.newPage();
    const response = await html.goto('/contributors');
    expect(new URL(response!.request().redirectedFrom()!.url()).pathname).toBe('/contributors');
    expect(new URL(response!.request().redirectedFrom()!.url()).search).toBe('');
    expect(new URL(html.url()).searchParams.get('period')).toBe('last-month');
    await expect(period(html)).toHaveValue('last-month');
    await expect(
      html.getByRole('columnheader', { name: 'Issues authored', exact: true }),
    ).toHaveCount(0);
    await expect(
      html
        .getByRole('table', { name: 'Contributors', exact: true })
        .getByRole('columnheader', { name: 'Contributor', exact: true }),
    ).toHaveAttribute('aria-sort', 'ascending');
  } finally {
    await plain.close();
  }
  // With JavaScript the hydrated page keeps that view and its address, and writes no history.
  const writes = await recordHistoryWrites(page);
  await page.goto('/contributors');
  const address = page.url();
  expect(new URL(address).searchParams.get('period')).toBe('last-month');
  await expect(page.getByRole('button', { name: 'Columns', exact: true })).toBeEnabled();
  await expect(period(page)).toHaveValue('last-month');
  await expect(
    page.getByRole('columnheader', { name: 'Issues authored', exact: true }),
  ).toHaveCount(0);
  await expect(
    page
      .getByRole('table', { name: 'Contributors', exact: true })
      .getByRole('columnheader', { name: 'Contributor', exact: true }),
  ).toHaveAttribute('aria-sort', 'ascending');
  expect(page.url()).toBe(address);
  expect(await writes()).toEqual([]);
});

test('a cookie saved for another account is ignored', async ({ page, baseURL }) => {
  await login(page);
  await seedContributionPreferences(
    page.context(),
    baseURL!,
    { 'contributions.scope': stored(lastMonth()) },
    { accountId: 'preview-bob', authVersion: 0 },
  );
  await page.goto('/contributors');
  await expect(page.getByRole('button', { name: 'Columns', exact: true })).toBeEnabled();
  await expect(page).toHaveURL(/\/contributors$/);
  await expect(period(page)).toHaveValue('this-year');
  await expect(page.getByText(/^Saved filters/)).toHaveCount(0);
  // The hydrated masthead link ignores it too.
  await expect(entry(page)).toHaveAttribute('href', '/contributors');
});

for (const stale of ['repository', 'exclusion', 'custom dates'] as const)
  test('main navigation recovers a stale saved ' + stale, async ({ page, baseURL }) => {
    await login(page);
    const saved = structuredClone(defaults);
    if (stale === 'repository') saved.selection.repositoryIds = ['repo-prebidjs', 'retired'];
    else if (stale === 'exclusion') saved.selection.excludedAccountIds = ['removed'];
    else saved.period = { kind: 'custom', from: '2027-01-01', through: '2027-01-02' };
    await saveScope(page, baseURL!, saved);
    await page.goto('/repos');
    await expect(entry(page)).toHaveAttribute('href', '/contributors');
    await entry(page).click();
    await expect(
      page.getByRole('table', { name: 'Contributors', exact: true }).locator('tbody tr').first(),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/contributors$/);
    await expect(page.getByRole('status')).toContainText('Saved filters could not be restored');
    // After hydration the rejected section is deleted, so the next visit shows no notice.
    await expect
      .poll(async () => (await contributionPreferences(page.context())) ?? {})
      .toEqual({});
    await expect(entry(page)).toHaveAttribute('href', '/contributors');
    await page.reload();
    await expect(page.getByRole('table').locator('tbody tr').first()).toBeVisible();
    await expect(page.getByRole('status')).not.toContainText('Saved filters could not be restored');
  });
test('main entry validates and restores saved custom dates and exclusions without rewriting them', async ({
  page,
  baseURL,
}) => {
  await login(page);
  const saved = structuredClone(defaults);
  saved.selection.repositoryIds = ['repo-prebidjs'];
  saved.selection.excludedAccountIds = ['account-alice'];
  saved.period = { kind: 'custom', from: '2026-09-01', through: '2026-09-30' };
  await saveScope(page, baseURL!, saved);
  const before = await contributionPreferences(page.context());
  await page.goto('/repos');
  await expect(entry(page)).toHaveAttribute('href', '/contributors');
  await entry(page).click();
  await expect(page).toHaveURL(/exclude=account-alice/);
  expect(new URL(page.url()).search).toBe(
    '?repo=prebidjs&period=2026-09-01..2026-09-30&exclude=account-alice',
  );
  await expect(
    page
      .getByRole('table')
      .getByRole('link', { name: 'Alice — view contribution report', exact: true }),
  ).toHaveCount(0);
  expect(await contributionPreferences(page.context())).toEqual(before);
});
test('an explicitly empty saved population stays empty', async ({ page, baseURL }) => {
  await login(page);
  const saved = structuredClone(defaults);
  saved.selection.population = { kind: 'selected', accountIds: [], companyIds: [] };
  await saveScope(page, baseURL!, saved);
  await page.goto('/repos');
  await entry(page).click();
  await expect(
    page.getByRole('heading', { name: 'No accounts match this report', exact: true }),
  ).toBeVisible();
  // An empty `account` list is a selected population with nobody in it.
  expect(new URL(page.url()).search).toBe('?account=');
});
test('selected-only edits remain reversible without refetching on each toggle', async ({
  page,
}, info) => {
  await login(page);
  await page.goto(
    '/contributors?scope=1&period=this-year&population=selected&account=account-alice&account=account-bob',
  );
  await page.getByRole('button', { name: 'Selected accounts', exact: true }).click();
  const dialog = page.getByRole('dialog'),
    individuals = dialog.getByRole('group', { name: /^Individuals/ });
  await expect(
    individuals.getByRole('checkbox', { name: 'Alice (@sample-alice)', exact: true }),
  ).toBeVisible();
  let selectedRequests = 0;
  page.on('request', (request) => {
    if (!request.url().endsWith('/api/reporting/contribution-options')) return;
    const body = request.postDataJSON() as {
      action: string;
      query?: { kind: string; selectedIds: string[] | null };
    };
    if (
      body.action === 'choices' &&
      body.query?.kind === 'accounts' &&
      body.query.selectedIds !== null
    )
      selectedRequests++;
  });
  await individuals.getByRole('checkbox', { name: 'Show selected only', exact: true }).check();
  await expect.poll(() => selectedRequests).toBe(1);
  await expect(individuals.getByRole('status')).toHaveCount(0);
  const alice = individuals.getByRole('checkbox', { name: 'Alice (@sample-alice)', exact: true });
  await alice.uncheck();
  await expect(alice).not.toBeChecked();
  await expect(individuals.getByRole('status')).toHaveCount(0);
  await alice.check();
  await alice.uncheck();
  expect(selectedRequests).toBe(1);
  await page.screenshot({ path: info.outputPath('selected-only-keeps-draft.png') });
  await page.setViewportSize({ width: 375, height: 900 });
  await expect(
    dialog.getByRole('button', { name: 'Apply accounts', exact: true }),
  ).toBeInViewport();
  expect((await new AxeBuilder({ page }).include('[role="dialog"]').analyze()).violations).toEqual(
    [],
  );
  await page.screenshot({ path: info.outputPath('selected-only-mobile.png') });
  await dialog.getByRole('button', { name: 'Apply accounts', exact: true }).click();
  await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(1);
  expect(new URL(page.url()).searchParams.get('account')).toBe('account-bob');
});
test('an oversized Apply preserves its draft, current URL and preferences', async ({
  page,
}, info) => {
  await login(page);
  // The 307 drops an old link's return trail on a top-level report; `scope=1` becomes `v=1`.
  await page.goto('/contributors?scope=1&period=this-year&nav=' + 'a'.repeat(7200));
  await expect(page).toHaveURL(/\/contributors\?v=1$/);
  // A bounded incoming URL can leave too little room for a new scope.
  await page.goto('/contributors?back=~q:' + 'a'.repeat(7460));
  const before = page.url();
  await page.getByRole('button', { name: 'All accounts', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('radio', { name: 'Selected accounts', exact: true }).check();
  const individuals = dialog.getByRole('group', { name: /^Individuals/ });
  const alice = individuals.getByRole('checkbox', { name: 'Alice (@sample-alice)', exact: true });
  await alice.check();
  await dialog.getByRole('button', { name: 'Apply accounts', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText(
    'This change is too large for the report URL',
  );
  await expect(alice).toBeChecked();
  expect(page.url()).toBe(before);
  expect(await contributionPreferences(page.context())).toBeNull();
  expect((await new AxeBuilder({ page }).include('[role="dialog"]').analyze()).violations).toEqual(
    [],
  );
  await page.screenshot({ path: info.outputPath('rejected-apply-keeps-draft.png') });
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(7);
  await page.getByRole('button', { name: 'Account type: All', exact: true }).click();
  await page.getByRole('menuitemcheckbox', { name: 'Bot', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Apply account types', exact: true }).click();
  const typeMenu = page.getByRole('menu');
  const rejection =
    'This change is too large for the report URL. Reduce the selection and try again.';
  await expect(
    typeMenu.getByRole('menuitem', { name: 'Apply account types', exact: true }),
  ).toHaveAccessibleDescription(rejection);
  await expect(typeMenu.getByText(rejection, { exact: true })).toBeVisible();
  await expect(typeMenu.getByText(rejection, { exact: true })).toBeInViewport({ ratio: 1 });
  await expect(
    typeMenu.getByRole('menuitem', { name: 'Apply account types', exact: true }),
  ).toBeInViewport({ ratio: 1 });
  expect((await new AxeBuilder({ page }).include('[role="menu"]').analyze()).violations).toEqual(
    [],
  );
  await page.screenshot({ path: info.outputPath('account-type-error-feedback.png') });
  await page.setViewportSize({ width: 375, height: 900 });
  await expect(typeMenu.getByText(rejection, { exact: true })).toBeInViewport({ ratio: 1 });
  await expect(
    typeMenu.getByRole('menuitem', { name: 'Apply account types', exact: true }),
  ).toBeInViewport({ ratio: 1 });
  await page.screenshot({ path: info.outputPath('account-type-error-mobile.png') });
  await page.keyboard.press('Escape');
});
