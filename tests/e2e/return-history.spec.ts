import type { Locator, Page } from '@playwright/test';
import { test, expect } from './fixtures';

// The P5d premise: a back link whose target is the entry this page was pushed from goes back in
// history (no new entry, Forward returns), through a reload too; a page opened directly pushes its
// link; a modified click opens the link itself. Both engines run it.

const origin = 'http://127.0.0.1:3100';
async function login(page: Page) {
  await page.goto('/auth/login');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/repos$/);
}
const entries = (page: Page) => page.evaluate(() => history.length);
/** An href without `v=1`: a bare entry is pinned with it before the page navigates (C4). */
const unpinned = (href: string) =>
  href
    .replace(/([?&])v=1(&|$)/, (_, separator: string, rest: string) => (rest ? separator : ''))
    .replace(/\?$/, '');

/**
 * From `parent`, follow `open` in the app, then the crumb: Back without a new entry, Forward to
 * the child (pinned with `v=1` when it was a bare entry), and the same after a reload of it.
 */
async function goesBack(
  page: Page,
  parent: string,
  open: (page: Page) => Locator,
  crumb: (page: Page) => Locator,
  shown: (page: Page) => Locator,
) {
  await page.goto(parent);
  const parentAddress = await page.evaluate(() => location.pathname + location.search);
  await open(page).click();
  await expect(crumb(page)).toBeVisible();
  const child = page.url();
  const length = await entries(page);
  await crumb(page).click();
  await expect(shown(page)).toBeVisible();
  expect(new URL(page.url()).pathname + new URL(page.url()).search).toBe(parentAddress);
  expect(await entries(page)).toBe(length);
  await page.goForward();
  await expect(page).toHaveURL((url) => unpinned(url.href) === unpinned(child));
  // The record of where this entry came from survives a reload.
  await page.reload();
  await expect(crumb(page)).toBeVisible();
  await crumb(page).click();
  await expect(shown(page)).toBeVisible();
  expect(await entries(page)).toBe(length);
  return child;
}

test('the All repositories crumb goes back to the Summary it came from', async ({ page }) => {
  await login(page);
  const backlog = (page: Page) => page.getByRole('table', { name: 'Current backlog', exact: true });
  const child = await goesBack(
    page,
    '/repos?period=last-month',
    (page) => backlog(page).getByRole('link', { name: 'Prebid.js', exact: true }),
    (page) => page.getByRole('link', { name: 'All repositories', exact: true }),
    (page) => backlog(page),
  );
  // Opened directly, the crumb is an ordinary link: it adds an entry.
  await page.goto(child);
  const length = await entries(page);
  await page.getByRole('link', { name: 'All repositories', exact: true }).click();
  await expect(backlog(page)).toBeVisible();
  expect(await entries(page)).toBe(length + 1);
});

test('Back to report goes back to the contribution report it came from', async ({ page }) => {
  await login(page);
  await goesBack(
    page,
    '/contributors?q=Alice',
    (page) => page.getByRole('link', { name: 'Alice — view contribution report', exact: true }),
    (page) => page.getByRole('link', { name: 'Back to report', exact: true }),
    (page) => page.getByRole('textbox', { name: 'Search Contributors' }),
  );
  await expect(page.getByRole('textbox', { name: 'Search Contributors' })).toHaveValue('Alice');
});

test('Back to timeline goes back to the Timeline a cell was opened from', async ({ page }) => {
  await login(page);
  await goesBack(
    page,
    '/repos/prebidjs?timeline&period=last-full-year',
    (page) => page.getByRole('link', { name: /^Unique authors — PRs, Oct 2025: \d+$/ }),
    (page) => page.getByRole('link', { name: 'Back to timeline', exact: true }),
    (page) => page.getByRole('region', { name: 'Timeline scope' }),
  );
});

test('a modified click on a crumb opens its link and leaves the page as it is', async ({
  page,
  context,
}) => {
  await login(page);
  await page.goto('/contributors?q=Alice');
  await page.getByRole('link', { name: 'Alice — view contribution report', exact: true }).click();
  const crumb = page.getByRole('link', { name: 'Back to report', exact: true });
  await expect(crumb).toBeVisible();
  const child = page.url();
  const href = await crumb.getAttribute('href');
  const opened = context.waitForEvent('page');
  await crumb.click({ modifiers: [process.platform === 'darwin' ? 'Meta' : 'Control'] });
  const tab = await opened;
  // The new tab starts at about:blank; its load state can settle before the link's address commits.
  await expect(tab).toHaveURL((url) => url.pathname + url.search === href);
  await tab.close();
  expect(page.url()).toBe(child);
  expect(origin).toBe(new URL(child).origin);
});
