import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';
import { viewsFor } from '../support/views';

type Mode = 'wide' | 'contained';

/** The frame's gutter contract: fixed on narrow screens, otherwise 2.5vw held to 32–64px and tripled when contained. */
function gutter(width: number, mode: Mode) {
  if (width <= 600) return 16;
  if (width <= 1000) return 24;
  const base = Math.min(64, Math.max(32, width * 0.025));
  return mode === 'contained' ? base * 3 : base;
}

// One entry per page type and tab reachable from the main navigation.
const views = viewsFor('layout-width').map((view) => view.path);

async function login(page: Page) {
  await page.goto('/auth/login');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/repos$/);
}
async function measure(page: Page) {
  return page.evaluate(async () => {
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const edges = (element: Element) => {
      const box = element.getBoundingClientRect();
      return { left: box.left, right: box.right, width: box.width };
    };
    const inner = (element: Element) => {
      const box = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return {
        left: box.left + parseFloat(style.paddingLeft),
        right: box.right - parseFloat(style.paddingRight),
      };
    };
    const main = document.querySelector('main')!;
    const signOut = [...document.querySelectorAll('header button')].find(
      (button) => button.textContent?.trim() === 'Sign out',
    )!;
    return {
      content: inner(main),
      source: inner(document.querySelector('aside[aria-label="Data source"]')!),
      brand: edges(document.querySelector('header a[aria-label="Repository activity"]')!),
      signOut: edges(signOut),
      sections: [...main.children]
        .filter((child) => child.getBoundingClientRect().width > 0)
        .map(edges),
      tables: [...main.querySelectorAll('[role="region"][aria-label$="table scroll area"]')].map(
        edges,
      ),
      scrollWidth: document.documentElement.scrollWidth,
    };
  });
}
async function serverWidth(page: Page) {
  const html = await (await page.request.get('/repos')).text();
  return /data-layout-width="(\w+)"/.exec(html)?.[1];
}

for (const mode of ['wide', 'contained'] as const) {
  test(`${mode} width keeps every report view on its gutter`, async ({ page }, testInfo) => {
    await login(page);
    await page
      .context()
      .addCookies([
        { name: 'dashboard-layout-width', value: mode, url: testInfo.project.use.baseURL! },
      ]);
    for (const view of views) {
      await page.setViewportSize({ width: 1280, height: 1000 });
      await page.goto(view);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await expect(page.getByRole('region', { name: /table scroll area$/ }).first()).toBeVisible();
      for (const width of [1280, 2560]) {
        await page.setViewportSize({ width, height: 1000 });
        const at = `${view} at ${width}px`;
        const side = gutter(width, mode);
        const m = await measure(page);
        expect(m.scrollWidth, at).toBeLessThanOrEqual(width);
        expect(m.content.left, at).toBeCloseTo(side, 0);
        expect(m.content.right, at).toBeCloseTo(width - side, 0);
        // The header and data-source line align with the content edges.
        expect(m.brand.left, at).toBeCloseTo(side, 0);
        expect(m.signOut.right, at).toBeCloseTo(width - side, 0);
        expect(m.source.right, at).toBeCloseTo(width - side, 0);
        // No section escapes the gutter, and no inner cap narrows the page.
        expect(m.sections.length, at).toBeGreaterThan(0);
        for (const section of m.sections) {
          expect(section.left, at).toBeGreaterThanOrEqual(side - 0.5);
          expect(section.right, at).toBeLessThanOrEqual(width - side + 0.5);
        }
        expect(Math.max(...m.sections.map((section) => section.width)), at).toBeCloseTo(
          width - 2 * side,
          0,
        );
        expect(m.tables.length, at).toBeGreaterThan(0);
        for (const table of m.tables) {
          expect(table.left, at).toBeGreaterThanOrEqual(side);
          expect(table.right, at).toBeLessThanOrEqual(width - side);
        }
        // The first table fills its panel, inside a 1px border.
        expect(m.tables[0].width, at).toBeGreaterThanOrEqual(width - 2 * side - 2);
      }
    }
  });
}

test('the width switch is saved for server rendering and hidden on narrow screens', async ({
  page,
}) => {
  await page.setViewportSize({ width: 2560, height: 1200 });
  await login(page);
  const toggle = page.getByRole('button', { name: 'Full-width layout', exact: true });
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  expect(await serverWidth(page)).toBe('wide');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  expect((await measure(page)).content.left).toBeCloseTo(gutter(2560, 'contained'), 0);
  // The server renders the saved width, so a reload never starts at full width.
  expect(await serverWidth(page)).toBe('contained');
  await page.reload();
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  expect((await measure(page)).content.left).toBeCloseTo(gutter(2560, 'contained'), 0);
  // Both widths share one gutter at 1000px and below, so the switch is not offered.
  for (const width of [1000, 600]) {
    await page.setViewportSize({ width, height: 1200 });
    await expect(toggle).toBeHidden();
    expect((await measure(page)).content.left).toBeCloseTo(gutter(width, 'contained'), 0);
  }
  await page.setViewportSize({ width: 1001, height: 1200 });
  await expect(toggle).toBeVisible();
  expect((await measure(page)).content.left).toBeCloseTo(gutter(1001, 'contained'), 0);
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  expect((await measure(page)).content.left).toBeCloseTo(gutter(1001, 'wide'), 0);
  expect(await serverWidth(page)).toBe('wide');
});

test('Accounts sits beside the width and theme buttons for administrators', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(
    'http://127.0.0.1:6007/iframe.html?id=repositories-all-repositories--administration&viewMode=story',
  );
  const header = page.getByRole('banner');
  const accounts = page
    .getByRole('navigation', { name: 'Administration', exact: true })
    .getByRole('link', { name: 'Accounts', exact: true });
  const width = page.getByRole('button', { name: 'Full-width layout', exact: true });
  const theme = page.getByRole('button', { name: 'Theme settings', exact: true });
  await expect(theme).toBeEnabled();
  await expect(
    page
      .getByRole('navigation', { name: 'Main navigation', exact: true })
      .getByRole('link', { name: 'Accounts' }),
  ).toHaveCount(0);
  const [h, a, w, t] = (
    await Promise.all([header, accounts, width, theme].map((item) => item.boundingBox()))
  ).map((box) => box!);
  // Left to right: Accounts, width switch, theme, each one account-group gap apart.
  expect(w.x - (a.x + a.width)).toBeCloseTo(12, 0);
  expect(t.x - (w.x + w.width)).toBeCloseTo(12, 0);
  expect(w.width).toBe(t.width);
  expect(w.height).toBe(t.height);
  // Accounts' current-page underline lands on the header's bottom border, like the main navigation.
  expect(a.y + a.height).toBeCloseTo(h.y + h.height - 1, 0);
  expect(w.y + w.height / 2).toBeCloseTo(a.y + a.height / 2, 0);
  expect(t.y + t.height / 2).toBeCloseTo(a.y + a.height / 2, 0);

  await page.setViewportSize({ width: 375, height: 800 });
  await expect(width).toBeHidden();
  await expect(accounts).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  const brand = (await page
    .getByRole('link', { name: 'Repository activity', exact: true })
    .boundingBox())!;
  const narrowTheme = (await theme.boundingBox())!;
  const navigation = (await page
    .getByRole('navigation', { name: 'Main navigation', exact: true })
    .boundingBox())!;
  // Brand, Accounts and theme share the first row, above the main navigation.
  expect(
    Math.abs(narrowTheme.y + narrowTheme.height / 2 - (brand.y + brand.height / 2)),
  ).toBeLessThanOrEqual(2);
  expect(narrowTheme.y + narrowTheme.height).toBeLessThanOrEqual(navigation.y);
});
