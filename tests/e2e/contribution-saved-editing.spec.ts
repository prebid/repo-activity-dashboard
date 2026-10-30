import { test, expect } from './fixtures';
import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { contributionSample } from '../../src/mocks/contributions';
import {
  contributionPreferenceKey,
  defaultContributionSettings,
  serializeContributionPreferences,
} from '../../src/lib/presentation/contribution-settings';
const key = contributionPreferenceKey('preview-alice', 'reference');
const defaults = defaultContributionSettings(contributionSample());
async function login(page: Page) {
  await page.goto('/auth/login');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/repos$/);
}
for (const stale of ['repository', 'exclusion', 'custom dates'] as const)
  test('main navigation recovers a stale saved ' + stale, async ({ page }) => {
    await login(page);
    const saved = structuredClone(defaults);
    if (stale === 'repository') saved.selection.repositoryIds = ['repo-prebidjs', 'retired'];
    else if (stale === 'exclusion') saved.selection.excludedAccountIds = ['removed'];
    else saved.period = { kind: 'custom', from: '2027-01-01', through: '2027-01-02' };
    await page.evaluate(
      ([key, raw]) => localStorage.setItem(key, raw),
      [key, serializeContributionPreferences(saved)],
    );
    await page.goto('/repos');
    const entry = page
      .getByRole('navigation', { name: 'Main navigation' })
      .getByRole('link', { name: 'Contributions', exact: true });
    await expect(entry).toHaveAttribute('href', '/contributors');
    await entry.click();
    await expect(
      page.getByRole('table', { name: 'Contributors', exact: true }).locator('tbody tr').first(),
    ).toBeVisible();
    await expect(page.getByRole('status')).toContainText('Saved filters could not be restored');
    await expect.poll(() => page.evaluate((key) => localStorage.getItem(key), key)).toBeNull();
    await expect(entry).toHaveAttribute('href', '/contributors');
    await page.reload();
    await expect(page.getByRole('table').locator('tbody tr').first()).toBeVisible();
    await expect(page.getByRole('status')).not.toContainText('Saved filters could not be restored');
  });
test('main entry validates and restores saved custom dates and exclusions without rewriting them', async ({
  page,
}) => {
  await login(page);
  const saved = structuredClone(defaults);
  saved.selection.repositoryIds = ['repo-prebidjs'];
  saved.selection.excludedAccountIds = ['account-alice'];
  saved.period = { kind: 'custom', from: '2026-09-01', through: '2026-09-30' };
  const raw = serializeContributionPreferences(saved);
  await page.evaluate(([key, raw]) => localStorage.setItem(key, raw), [key, raw]);
  await page.goto('/repos');
  const entry = page
    .getByRole('navigation', { name: 'Main navigation' })
    .getByRole('link', { name: 'Contributions', exact: true });
  await expect(entry).toHaveAttribute('href', '/contributors');
  await entry.click();
  await expect(page).toHaveURL(/exclude=account-alice/);
  expect(new URL(page.url()).searchParams.get('period')).toBe('custom');
  expect(new URL(page.url()).searchParams.get('from')).toBe('2026-09-01');
  expect(new URL(page.url()).searchParams.get('through')).toBe('2026-09-30');
  expect(new URL(page.url()).searchParams.getAll('repo')).toEqual(['repo-prebidjs']);
  await expect(
    page
      .getByRole('table')
      .getByRole('link', { name: 'Alice — view contribution report', exact: true }),
  ).toHaveCount(0);
  expect(await page.evaluate((key) => localStorage.getItem(key), key)).toBe(raw);
});
test('an explicitly empty saved population stays empty', async ({ page }) => {
  await login(page);
  const saved = structuredClone(defaults);
  saved.selection.population = { kind: 'selected', accountIds: [], companyIds: [] };
  await page.evaluate(
    ([key, raw]) => localStorage.setItem(key, raw),
    [key, serializeContributionPreferences(saved)],
  );
  await page.goto('/repos');
  await page
    .getByRole('navigation', { name: 'Main navigation' })
    .getByRole('link', { name: 'Contributions', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'No accounts match this report', exact: true }),
  ).toBeVisible();
  expect(new URL(page.url()).searchParams.get('population')).toBe('selected');
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
  expect(new URL(page.url()).searchParams.getAll('account')).toEqual(['account-bob']);
});
test('an oversized Apply preserves its draft, current URL and preferences', async ({
  page,
}, info) => {
  await login(page);
  // A bounded incoming URL can leave too little room for a new scope/presentation snapshot.
  await page.goto('/contributors?scope=1&period=this-year&nav=' + 'a'.repeat(7200));
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
  expect(await page.evaluate((key) => localStorage.getItem(key), key)).toBeNull();
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
