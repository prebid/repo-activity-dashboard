import { test, expect } from './fixtures';
import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';

const range = 'from=2026-10-01T00%3A00%3A00.000Z&to=2026-10-24T12%3A00%3A00.000Z&inclusive=1';
const views = [
  [
    'comparison',
    '/repos?repo=repo-prebidjs&repo=repo-prebidserver&period=this-month&period2=last-month&age=30&age=60&age=90',
  ],
  ['prs', '/repos/prebidjs?scope=current&metric=humanApprovals0'],
  ['issues', '/repos/prebiddocs?scope=current&metric=openIssues'],
  ['authors', '/repos/prebidjs?scope=period&metric=prAuthors&' + range],
  [
    'author-prs',
    '/repos/prebidjs/authors/sample-author-2?scope=period&metric=prAuthors&from=2026-01-01T00:00:00.000Z&to=2026-10-24T12:00:00.000Z&inclusive=1',
  ],
  [
    'author-issues',
    '/repos/prebidjs/authors/sample-author-2?scope=period&metric=issueAuthors&from=2026-01-01T00:00:00.000Z&to=2026-10-24T12:00:00.000Z&inclusive=1',
  ],
  ['credits', '/repos/prebidjs?scope=period&metric=agentFeedbackCredits&' + range],
  ['duration', '/repos/prebidjs?scope=period&metric=medianMergeDays&branch=master&' + range],
] as const;
async function login(page: Page) {
  await page.goto('/auth/login');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/repos$/);
}
async function theme(page: Page, value: 'dark' | 'light') {
  await page.getByRole('button', { name: 'Theme settings', exact: true }).click();
  await page
    .getByRole('menuitemradio', { name: value === 'dark' ? 'Dark' : 'Light', exact: true })
    .click();
  await expect(page.locator('html')).toHaveClass(new RegExp(value));
}

for (const [name, path] of views) {
  test('review matrix at tablet and laptop widths: ' + name, async ({ page }, testInfo) => {
    await login(page);
    await page.goto(path);
    await expect(page.getByRole('table').first()).toBeVisible();
    // SSR markup can appear before a large record payload has hydrated. Exercise a
    // table-owned control before axe adds its own nodes to the document.
    const ready = page.getByRole('button', { name: 'Columns', exact: true }).first();
    await ready.click();
    await expect(page.getByRole('menu', { name: 'Columns', exact: true })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(ready).toBeFocused();
    for (const mode of ['dark', 'light'] as const) {
      await theme(page, mode);
      for (const width of [768, 1280]) {
        await page.setViewportSize({ width, height: 1000 });
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
          width,
        );
        expect((await new AxeBuilder({ page }).include('main').analyze()).violations).toEqual([]);
        await page.mouse.move(0, 0);
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.screenshot({
          path: testInfo.outputPath(name + '-' + mode + '-' + width + '.png'),
        });
        if (name === 'comparison')
          await page
            .getByRole('region', { name: 'Period activity', exact: true })
            .screenshot({ path: testInfo.outputPath('activity-' + mode + '-' + width + '.png') });
      }
    }
  });
}

test('large issue lists retain their server-rendered dashboard through hard navigation and reload', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const state = window as Window & { firstDashboardFrame?: HTMLElement };
    const observer = new MutationObserver(() => {
      const frame = document.querySelector('a[href="#dashboard-content"]')?.parentElement;
      if (frame) {
        state.firstDashboardFrame = frame;
        observer.disconnect();
      }
    });
    observer.observe(document, { childList: true, subtree: true });
  });
  await login(page);
  const path = '/repos/prebiddocs?scope=current&metric=openIssues';
  for (const phase of ['initial', 'saved-theme-reload', 'cross-route'] as const) {
    if (phase === 'saved-theme-reload') await theme(page, 'light');
    if (phase === 'cross-route') {
      await page.goto('/repos?repo=repo-prebiddocs&age=60');
      await expect(
        page.getByRole('heading', { name: 'All repositories', exact: true }),
      ).toBeVisible();
    }
    const response = phase === 'saved-theme-reload' ? await page.reload() : await page.goto(path);
    if (!response) throw new Error('Missing document response');
    // Check actual SSR table rows, not text that could exist only in a serialized payload.
    const html = await response.text();
    const tbody = html.match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/)?.[1];
    expect(tbody?.match(/<tr\b/g)).toHaveLength(50);
    await expect(page.getByText('12,345 matching records', { exact: true })).toBeVisible();
    const columns = page.getByRole('button', { name: 'Columns', exact: true });
    await columns.click();
    await expect(page.getByRole('menu', { name: 'Columns', exact: true })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(columns).toBeFocused();
    expect(
      await page.evaluate(() => {
        const first = (window as Window & { firstDashboardFrame?: HTMLElement })
          .firstDashboardFrame;
        return (
          !!first &&
          first.isConnected &&
          first === document.querySelector('a[href="#dashboard-content"]')?.parentElement
        );
      }),
    ).toBe(true);
  }
});

test('review states distinguish empty, missing, partial, invalid, loading and retryable error', async ({
  page,
}, testInfo) => {
  await login(page);
  const states = [
    ['empty', '/repos?repo=', 'No repositories selected'],
    [
      'no-merges',
      '/repos/prebid-mobile-ios-sdk?scope=period&metric=medianMergeDays&branch=main&' + range,
      'No merged PRs in this period',
    ],
    [
      'missing',
      '/repos/prebidjs?scope=period&metric=prAuthors&from=2023-10-01T00:00:00.000Z&to=2023-10-02T00:00:00.000Z&inclusive=0',
      'Sample records unavailable',
    ],
    [
      'partial',
      '/repos/prebid-cache-java?scope=current&metric=agentFeedbackPrs',
      'PRs with Prebid agent reviewers',
    ],
    ['invalid', '/repos/prebidjs?scope=current&metric=agedPrs&age=31', 'Invalid repository filter'],
  ] as const;
  for (const [name, path, heading] of states) {
    await page.goto(path);
    await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
    for (const [mode, width] of [
      ['dark', 320],
      ['light', 1280],
    ] as const) {
      await theme(page, mode);
      await page.setViewportSize({ width, height: 900 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        width,
      );
      expect((await new AxeBuilder({ page }).include('main').analyze()).violations).toEqual([]);
      await page.screenshot({
        path: testInfo.outputPath(name + '-' + mode + '-' + width + '.png'),
      });
    }
  }
  for (const [state, heading] of [
    ['loading', 'Loading records…'],
    ['error', 'Could not load records'],
  ] as const) {
    await page.goto(
      'http://127.0.0.1:6007/iframe.html?id=foundation-shared-components--' +
        state +
        '&viewMode=story&globals=theme:dark',
    );
    await page.setViewportSize({ width: 320, height: 700 });
    await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
    if (state === 'error') {
      const retry = page.getByRole('button', { name: 'Try again', exact: true });
      await retry.focus();
      await page.keyboard.press('Enter');
      await expect(retry).toBeFocused();
    }
    expect(
      (await new AxeBuilder({ page }).include('#storybook-root').analyze()).violations,
    ).toEqual([]);
    await page.screenshot({ path: testInfo.outputPath(state + '-dark-320.png') });
  }
});

test.describe('200 percent equivalent reflow', () => {
  // A 1280×960 physical canvas at 200% page zoom has 640×480 CSS pixels and DPR 2.
  // This checks that layout/raster configuration; it does not claim to drive native browser zoom UI.
  test.use({ viewport: { width: 640, height: 480 }, deviceScaleFactor: 2 });
  test('keeps keyboard controls and horizontal table access usable with enlarged content', async ({
    page,
  }, testInfo) => {
    await login(page);
    expect(await page.evaluate(() => ({ width: innerWidth, ratio: devicePixelRatio }))).toEqual({
      width: 640,
      ratio: 2,
    });
    for (const [name, path] of views.filter(([name]) =>
      ['comparison', 'authors', 'duration'].includes(name),
    )) {
      await page.goto(path);
      await expect(page.getByRole('table').first()).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        640,
      );
      const columns = page.getByRole('button', { name: 'Columns', exact: true }).first();
      await expect(columns).toBeEnabled();
      await columns.focus();
      await expect(columns).toBeFocused();
      await page.keyboard.press('Enter');
      const menu = page.getByRole('menu', { name: 'Columns', exact: true });
      await expect(menu).toBeVisible();
      // Wait for the actual opening animation and entry focus, not an arbitrary delay.
      await menu.evaluate(async (node) => {
        await Promise.all(
          node.getAnimations({ subtree: true }).map((animation) => animation.finished),
        );
      });
      await expect
        .poll(() => menu.evaluate((node) => node.contains(document.activeElement)))
        .toBe(true);
      await page.keyboard.press('End');
      const last = menu.locator('[role="menuitemcheckbox"]:not([aria-disabled="true"])').last();
      await expect(last).toBeFocused();
      // Measure the intended final item after roving focus has completed.
      await expect
        .poll(async () => {
          const box = await last.boundingBox();
          return !!box && box.y >= 0 && box.y + box.height <= 480;
        })
        .toBe(true);
      const focused = await last.boundingBox();
      expect(focused).not.toBeNull();
      expect(focused!.y).toBeGreaterThanOrEqual(0);
      expect(focused!.y + focused!.height).toBeLessThanOrEqual(480);
      await page.keyboard.press('Escape');
      await expect(columns).toBeFocused();
      const scroller = page.getByRole('region', { name: /table scroll area$/ }).first();
      await scroller.focus();
      await page.keyboard.down('ArrowRight');
      try {
        await expect.poll(() => scroller.evaluate((node) => node.scrollLeft)).toBeGreaterThan(0);
      } finally {
        await page.keyboard.up('ArrowRight');
      }
      expect((await new AxeBuilder({ page }).include('main').analyze()).violations).toEqual([]);
      await page.screenshot({ path: testInfo.outputPath(name + '-200-percent-equivalent.png') });
    }
  });
});
