import { test, expect } from './fixtures';
import type { Locator, Page } from '@playwright/test';
import { viewsFor } from '../support/views';

type Mode = 'wide' | 'contained';

/**
 * The frame's gutter contract: fixed on narrow screens, otherwise 2.5vw held to 32–64px; contained
 * mode triples it and caps the content at 1760px.
 */
function gutter(width: number, mode: Mode) {
  if (width <= 600) return 16;
  if (width <= 1000) return 24;
  const base = Math.min(64, Math.max(32, width * 0.025));
  return mode === 'contained' ? Math.max(base * 3, (width - 1760) / 2) : base;
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
/** Overview, Repositories, Contributors and Reviewers, in masthead order. */
function mainDestinations(page: Page) {
  const main = page.getByRole('navigation', { name: 'Main navigation', exact: true });
  return [
    main.getByRole('link', { name: 'Overview', exact: true }),
    main.getByRole('button', { name: 'Repositories', exact: true }),
    main.getByRole('link', { name: 'Contributors', exact: true }),
    main.getByRole('link', { name: 'Reviewers', exact: true }),
  ];
}
async function serverWidth(page: Page) {
  const html = await (await page.request.get('/repos')).text();
  return /data-layout-width="(\w+)"/.exec(html)?.[1];
}

for (const mode of ['wide', 'contained'] as const) {
  test(`${mode} width keeps every report view on its gutter`, async ({ page }, testInfo) => {
    // Every layout-width view at two widths: about 30s in WebKit on a slow CI runner.
    test.slow();
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
  const account = page.getByRole('button', { name: /^Account: / });
  const signOut = page.getByRole('button', { name: 'Sign out', exact: true });
  await expect(theme).toBeEnabled();
  await expect(
    page
      .getByRole('navigation', { name: 'Main navigation', exact: true })
      .getByRole('link', { name: 'Accounts' }),
  ).toHaveCount(0);
  const [h, a, w, t, m, s] = (
    await Promise.all(
      [header, accounts, width, theme, account, signOut].map((item) => item.boundingBox()),
    )
  ).map((box) => box!);
  // One 64px masthead row.
  expect(h.y).toBe(0);
  expect(h.height).toBe(64);
  // Left to right: Accounts, width switch, theme, account, Sign out, each one group gap apart.
  expect(w.x - (a.x + a.width)).toBeCloseTo(12, 0);
  expect(t.x - (w.x + w.width)).toBeCloseTo(12, 0);
  expect(m.x - (t.x + t.width)).toBeCloseTo(12, 0);
  expect(s.x - (m.x + m.width)).toBeCloseTo(12, 0);
  // The 36px header buttons, and Sign out ending on the content gutter.
  for (const button of [w, t, m, s]) expect(button.height).toBe(36);
  expect(w.width).toBe(36);
  expect(t.width).toBe(36);
  expect(s.x + s.width).toBeCloseTo(1440 - gutter(1440, 'wide'), 0);
  // Accounts' current-page underline lands on the masthead's bottom edge, like the main navigation.
  expect(a.y + a.height).toBeCloseTo(h.y + h.height, 0);
  for (const button of [w, t, m, s])
    expect(button.y + button.height / 2).toBeCloseTo(a.y + a.height / 2, 0);

  // At 390px the four main navigation destinations share one row without scrolling it.
  await page.setViewportSize({ width: 390, height: 844 });
  const main = page.getByRole('navigation', { name: 'Main navigation', exact: true });
  const destinations = await Promise.all(
    mainDestinations(page).map(async (item) => (await item.boundingBox())!),
  );
  for (const box of destinations) {
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(390);
    expect(box.y + box.height / 2).toBeCloseTo(destinations[0].y + destinations[0].height / 2, 0);
  }
  expect(await main.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);

  await page.setViewportSize({ width: 375, height: 800 });
  await expect(width).toBeHidden();
  await expect(accounts).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  const brand = (await page
    .getByRole('link', { name: 'Repository activity', exact: true })
    .boundingBox())!;
  const navigation = (await page
    .getByRole('navigation', { name: 'Main navigation', exact: true })
    .boundingBox())!;
  // A 56px row over the 44px navigation row.
  expect((await header.boundingBox())!.height).toBe(100);
  // Brand, Accounts, theme, account and Sign out share the first row, above the main navigation.
  for (const control of [accounts, theme, account, signOut]) {
    const box = (await control.boundingBox())!;
    expect(Math.abs(box.y + box.height / 2 - (brand.y + brand.height / 2))).toBeLessThanOrEqual(2);
    expect(box.y + box.height).toBeLessThanOrEqual(navigation.y);
    expect(box.x + box.width).toBeLessThanOrEqual(375 - gutter(375, 'wide') + 0.5);
  }
});

test("an administrator's masthead keeps one row down to 1121px and takes two rows from 1120px", async ({
  page,
}) => {
  await page.goto(
    'http://127.0.0.1:6007/iframe.html?id=repositories-all-repositories--administration&viewMode=story',
  );
  const header = page.getByRole('banner');
  const brand = page.getByRole('link', { name: 'Repository activity', exact: true });
  const destinations = mainDestinations(page);
  const width = page.getByRole('button', { name: 'Full-width layout', exact: true });
  const accountGroup = [
    page
      .getByRole('navigation', { name: 'Administration', exact: true })
      .getByRole('link', { name: 'Accounts', exact: true }),
    width,
    page.getByRole('button', { name: 'Theme settings', exact: true }),
    page.getByRole('button', { name: /^Account: / }),
    page.getByRole('button', { name: 'Sign out', exact: true }),
  ];
  await expect(accountGroup[2]).toBeEnabled();
  const boxes = (controls: Locator[]) =>
    Promise.all(controls.map(async (control) => (await control.boundingBox())!));

  // One 64px row: the brand, the four destinations and the account group, left to right inside
  // the gutters, each clear of the one before it.
  await page.setViewportSize({ width: 1121, height: 800 });
  expect((await header.boundingBox())!.height).toBe(64);
  const row = await boxes([brand, ...destinations, ...accountGroup]);
  expect(row[0].x).toBeGreaterThanOrEqual(gutter(1121, 'wide') - 0.5);
  for (let index = 1; index < row.length; index++)
    expect(row[index].x, 'control ' + index).toBeGreaterThanOrEqual(
      row[index - 1].x + row[index - 1].width - 0.5,
    );
  for (const [index, box] of row.entries()) {
    expect(box.y, 'control ' + index).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height, 'control ' + index).toBeLessThanOrEqual(64);
  }
  const last = row[row.length - 1];
  expect(last.x + last.width).toBeLessThanOrEqual(1121 - gutter(1121, 'wide') + 0.5);
  expect(await header.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);

  // Two rows: the brand and the account group, with the width switch still offered, over the
  // four destinations.
  await page.setViewportSize({ width: 1120, height: 800 });
  expect((await header.boundingBox())!.height).toBe(100);
  await expect(width).toBeVisible();
  const navigation = (await page
    .getByRole('navigation', { name: 'Main navigation', exact: true })
    .boundingBox())!;
  for (const box of await boxes([brand, ...accountGroup]))
    expect(box.y + box.height).toBeLessThanOrEqual(navigation.y);
  const second = await boxes(destinations);
  for (const [index, box] of second.entries()) {
    expect(box.y, 'destination ' + index).toBeGreaterThanOrEqual(navigation.y);
    expect(box.y + box.height, 'destination ' + index).toBeLessThanOrEqual(100);
    if (index > 0)
      expect(box.x, 'destination ' + index).toBeGreaterThanOrEqual(
        second[index - 1].x + second[index - 1].width - 0.5,
      );
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1120);
});

test("an administrator's first masthead row fits from 320px without overlapping or cutting off the avatar", async ({
  page,
}) => {
  await page.goto(
    'http://127.0.0.1:6007/iframe.html?id=repositories-all-repositories--administration&viewMode=story',
  );
  const account = page.getByRole('button', { name: /^Account: / });
  const row = [
    page.getByRole('link', { name: 'Repository activity', exact: true }),
    page
      .getByRole('navigation', { name: 'Administration', exact: true })
      .getByRole('link', { name: 'Accounts', exact: true }),
    page.getByRole('button', { name: 'Theme settings', exact: true }),
    account,
    page.getByRole('button', { name: 'Sign out', exact: true }),
  ];
  await expect(row[2]).toBeEnabled();
  for (const width of [320, 340, 360, 375]) {
    await page.setViewportSize({ width, height: 800 });
    const at = `at ${width}px`;
    const boxes = await Promise.all(row.map(async (control) => (await control.boundingBox())!));
    // Left to right inside the gutters, each control clear of the one before it.
    expect(boxes[0].x, at).toBeGreaterThanOrEqual(gutter(width, 'wide') - 0.5);
    for (let index = 1; index < boxes.length; index++)
      expect(boxes[index].x, at + ' control ' + index).toBeGreaterThanOrEqual(
        boxes[index - 1].x + boxes[index - 1].width - 0.5,
      );
    const last = boxes[boxes.length - 1];
    expect(last.x + last.width, at).toBeLessThanOrEqual(width - gutter(width, 'wide') + 0.5);
    for (const box of boxes.slice(2)) expect([box.width, box.height], at).toEqual([36, 36]);
    // The avatar sits whole inside its trigger.
    const trigger = boxes[3];
    const avatar = (await account.getByTitle('Human', { exact: true }).boundingBox())!;
    expect(avatar.x, at).toBeGreaterThanOrEqual(trigger.x);
    expect(avatar.y, at).toBeGreaterThanOrEqual(trigger.y);
    expect(avatar.x + avatar.width, at).toBeLessThanOrEqual(trigger.x + trigger.width);
    expect(avatar.y + avatar.height, at).toBeLessThanOrEqual(trigger.y + trigger.height);
    expect(await page.evaluate(() => document.documentElement.scrollWidth), at).toBeLessThanOrEqual(
      width,
    );
  }
});
