import { readdirSync } from 'node:fs';
import { dirname, sep } from 'node:path';
import type { Page } from '@playwright/test';
import { test, expect } from './fixtures';
import { inventory, type InventoryView } from '../support/views';
import {
  stableJson,
  type GoldenLinkKind,
  type GoldenUrls,
  type GoldenView,
} from '../support/golden-urls';

// Regenerate after `npm run build:preview` with
// npx playwright test tests/e2e/golden-urls.spec.ts --project=chromium --update-snapshots
// The webkit project ignores this file, so the set is one record rather than one per engine.

const segmentRank = (part: string | undefined) =>
  part === undefined
    ? -1
    : part.startsWith('[[...')
      ? 3
      : part.startsWith('[...')
        ? 2
        : part.startsWith('[')
          ? 1
          : 0;
/** App Router patterns from the page and route files; static segments outrank dynamic ones. */
const routes = readdirSync(new URL('../../src/app/', import.meta.url), {
  recursive: true,
  encoding: 'utf8',
})
  .filter((file) => /(^|[\\/])(page|route)\.tsx?$/.test(file))
  .map((file) =>
    dirname(file)
      .split(sep)
      .filter((part) => part !== '.' && !/^\(.+\)$/.test(part)),
  )
  .filter((parts) => !parts.some((part) => part.startsWith('_')))
  .sort((a, b) => {
    for (let index = 0; index < Math.max(a.length, b.length); index++) {
      const order = segmentRank(a[index]) - segmentRank(b[index]);
      if (order) return order;
    }
    return a.join('/') < b.join('/') ? -1 : 1;
  });

function routePattern(pathname: string): string {
  const segments = pathname.split('/').filter(Boolean);
  const matches = (parts: readonly string[]) => {
    for (const [index, part] of parts.entries()) {
      if (part.startsWith('[[...')) return true;
      if (part.startsWith('[...')) return segments.length > index;
      if (index >= segments.length || (!part.startsWith('[') && part !== segments[index]))
        return false;
    }
    return parts.length === segments.length;
  };
  const route = routes.find(matches);
  // A path that no page or route file serves, such as a public asset, is its own kind.
  return route ? '/' + route.join('/') : pathname;
}

async function login(page: Page) {
  await page.goto('/auth/login');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/repos$/);
}

/** Opens a path as a first visit would: the session stays, saved preferences do not. */
async function openFresh(page: Page, path: string) {
  if (page.url().startsWith('http'))
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
  const response = await page.goto(path);
  expect(response?.status(), path).toBe(200);
  await page.locator('h1').first().waitFor();
  await page.waitForLoadState('networkidle');
}

function address(page: Page) {
  return page.evaluate(() => location.pathname + location.search);
}

async function recordView(page: Page, view: InventoryView): Promise<GoldenView> {
  await openFresh(page, view.path);
  // The same-origin, non-fragment anchors that capture-views counts as in-app links.
  const anchors = await page.evaluate(() =>
    [...document.querySelectorAll('a[href]')]
      .map((anchor) => anchor.getAttribute('href') ?? '')
      .filter((href) => !href.startsWith('#'))
      .map((href) => ({ href, url: new URL(href, location.href) }))
      .filter(({ url }) => url.origin === location.origin)
      .map(({ href, url }) => ({
        href,
        pathname: url.pathname,
        resolved: url.pathname + url.search + url.hash,
        keys: [...new Set(url.searchParams.keys())],
        fragment: url.hash !== '',
      })),
  );
  const links: Record<string, GoldenLinkKind> = {};
  for (const anchor of anchors) {
    const keys = anchor.keys.sort();
    const kind =
      routePattern(anchor.pathname) +
      (keys.length ? '?' + keys.join('&') : '') +
      (anchor.fragment ? '#' : '');
    // An attribute that is not a single-slash path is recorded resolved, without the test origin.
    const example = /^\/(?!\/)/.test(anchor.href) ? anchor.href : anchor.resolved;
    const current = links[kind];
    links[kind] = {
      count: (current?.count ?? 0) + 1,
      example: current?.example ?? example,
      longest: Math.max(current?.longest ?? 0, anchor.href.length),
    };
  }
  return {
    route: routePattern(new URL(page.url()).pathname),
    requested: view.path,
    address: await address(page),
    links,
  };
}

/** The change `npm run capture:views -- --measure` makes for the Baseline address-bar row. */
async function changeAllRepositoriesScope(page: Page): Promise<GoldenUrls['scopeChange']> {
  await openFresh(page, '/repos');
  const entries = await page.evaluate(() => history.length);
  await page.getByRole('button', { name: 'PR age', exact: true }).first().click();
  await page
    .getByRole('menu', { name: 'PR age', exact: true })
    .getByRole('menuitemcheckbox', { name: 'Over 30 days', exact: true })
    .click();
  await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate(() => history.length)).toBeGreaterThan(entries);
  const changed = await address(page);
  return {
    change: 'PR age: clear "Over 30 days" on a fresh /repos',
    address: changed,
    length: changed.length,
  };
}

test('records the address bars and in-app link kinds of every inventory view', async ({ page }) => {
  test.setTimeout(240_000);
  const views: Record<string, GoldenView> = {};
  for (const view of inventory.filter((item) => item.access === 'signed-out'))
    views[view.id] = await recordView(page, view);
  await login(page);
  for (const view of inventory.filter((item) => item.access !== 'signed-out'))
    views[view.id] = await recordView(page, view);
  const golden: GoldenUrls = {
    version: 1,
    scopeChange: await changeAllRepositoriesScope(page),
    views,
  };
  expect(stableJson(golden)).toMatchSnapshot('golden-urls.json');
});
