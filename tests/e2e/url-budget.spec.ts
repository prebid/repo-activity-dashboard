import type { Page } from '@playwright/test';
import { test, expect } from './fixtures';
import { inventory } from '../support/views';

// The P5e gate over the view inventory: short, single-encoded in-app links, the Baseline URL rows,
// and no history write after load before any interaction.

/** Records every history write the page makes, from the first script on. */
async function recordHistoryWrites(page: Page) {
  await page.addInitScript(() => {
    const writes: { method: string; from: string; to: string }[] = [];
    (window as unknown as { historyWrites: typeof writes }).historyWrites = writes;
    for (const method of ['pushState', 'replaceState'] as const) {
      const original = history[method].bind(history);
      history[method] = (state: unknown, unused: string, url?: string | URL | null) => {
        const from = location.href;
        original(state, unused, url);
        writes.push({ method, from, to: location.href });
      };
    }
  });
}
/** Address writes: a new entry, or a replacement that changes the address. */
function addressWrites(page: Page) {
  return page.evaluate(() =>
    (
      window as unknown as { historyWrites: { method: string; from: string; to: string }[] }
    ).historyWrites.filter((write) => write.method === 'pushState' || write.from !== write.to),
  );
}
async function login(page: Page) {
  await page.goto('/auth/login');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/repos$/);
}
/** The same-origin, non-fragment in-app link hrefs on the page, as written. */
function inAppHrefs(page: Page) {
  return page.evaluate(() =>
    [...document.querySelectorAll('a[href]')]
      .map((anchor) => anchor.getAttribute('href') ?? '')
      .filter((href) => !href.startsWith('#'))
      .filter((href) => new URL(href, location.href).origin === location.origin),
  );
}

test('no in-app link of any inventory view exceeds 300 characters or holds %25', async ({
  page,
}) => {
  test.setTimeout(240_000);
  const views = inventory.filter((view) => view.access !== 'signed-out');
  expect(views.length).toBeGreaterThan(20);
  await login(page);
  let longest = { view: '', href: '' };
  let counted = 0;
  for (const view of views) {
    await page.goto(view.path);
    await page.locator('h1').first().waitFor();
    await page.waitForLoadState('networkidle');
    const hrefs = await inAppHrefs(page);
    counted += hrefs.length;
    for (const href of hrefs)
      if (href.length > longest.href.length) longest = { view: view.id, href };
    expect(
      hrefs.filter((href) => href.length > 300),
      view.id,
    ).toEqual([]);
    expect(
      hrefs.filter((href) => href.includes('%25')),
      view.id,
    ).toEqual([]);
  }
  // Zero links would be no evidence; the inventory renders hundreds.
  expect(counted).toBeGreaterThan(500);
  test.info().annotations.push({
    type: 'longest in-app href',
    description: longest.view + ' ' + longest.href.length + ' ' + longest.href,
  });
});

test('the Summary’s Timeline link is under 25 characters and one scope change under 60', async ({
  page,
}) => {
  await login(page);
  const timeline = await page
    .getByRole('navigation', { name: 'Repository overview views' })
    .getByRole('link', { name: 'Timeline', exact: true })
    .getAttribute('href');
  expect(timeline).toBe('/repos?timeline');
  expect(timeline!.length).toBeLessThan(25);
  // The Baseline row's change: PR age, clear "Over 30 days".
  const entries = await page.evaluate(() => history.length);
  await page.getByRole('button', { name: 'PR age', exact: true }).first().click();
  await page
    .getByRole('menu', { name: 'PR age', exact: true })
    .getByRole('menuitemcheckbox', { name: 'Over 30 days', exact: true })
    .click();
  await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate(() => history.length)).toBeGreaterThan(entries);
  const address = await page.evaluate(() => location.pathname + location.search);
  expect(address).toBe('/repos?age=');
  expect(address.length).toBeLessThan(60);
});

test('no inventory view writes history after load before any interaction', async ({ page }) => {
  test.setTimeout(240_000);
  await login(page);
  await recordHistoryWrites(page);
  for (const view of inventory.filter((item) => item.access !== 'signed-out')) {
    await page.goto(view.path);
    await page.locator('h1').first().waitFor();
    await page.waitForLoadState('networkidle');
    expect(await addressWrites(page), view.id).toEqual([]);
  }
});
