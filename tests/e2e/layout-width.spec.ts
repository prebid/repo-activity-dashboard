import { test, expect } from './fixtures';
import type { Locator, Page } from '@playwright/test';
import { inventory, viewsFor, type InventoryId } from '../support/views';

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
/** Overview, Repositories, Contributors, Reviewers and Companies, in masthead order. */
function mainDestinations(page: Page) {
  const main = page.getByRole('navigation', { name: 'Main navigation', exact: true });
  return [
    main.getByRole('link', { name: 'Overview', exact: true }),
    main.getByRole('button', { name: 'Repositories', exact: true }),
    main.getByRole('link', { name: 'Contributors', exact: true }),
    main.getByRole('link', { name: 'Reviewers', exact: true }),
    main.getByRole('link', { name: 'Companies', exact: true }),
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

  // At 390px the five main navigation destinations keep their order on one row, which scrolls
  // sideways because they do not fit it; each can be scrolled into view, and the page itself does
  // not scroll sideways.
  await page.setViewportSize({ width: 390, height: 844 });
  const main = page.getByRole('navigation', { name: 'Main navigation', exact: true });
  const destinations = await Promise.all(
    mainDestinations(page).map(async (item) => (await item.boundingBox())!),
  );
  for (const [index, box] of destinations.entries()) {
    expect(box.y + box.height / 2).toBeCloseTo(destinations[0].y + destinations[0].height / 2, 0);
    if (index > 0)
      expect(box.x, 'destination ' + index).toBeGreaterThanOrEqual(
        destinations[index - 1].x + destinations[index - 1].width - 0.5,
      );
  }
  expect(await main.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);
  for (const [index, item] of mainDestinations(page).entries()) {
    await item.scrollIntoViewIfNeeded();
    expect(await inside(item, main), 'destination ' + index).toBe(true);
    expect(await inside(item, { x: 0, width: 390 }), 'destination ' + index).toBe(true);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);

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

test("an administrator's masthead keeps one row down to 1281px and takes two rows from 1280px", async ({
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

  // One 64px row: the brand, the five destinations and the account group, left to right inside
  // the gutters, each clear of the one before it.
  await page.setViewportSize({ width: 1281, height: 800 });
  expect((await header.boundingBox())!.height).toBe(64);
  const row = await boxes([brand, ...destinations, ...accountGroup]);
  expect(row[0].x).toBeGreaterThanOrEqual(gutter(1281, 'wide') - 0.5);
  for (let index = 1; index < row.length; index++)
    expect(row[index].x, 'control ' + index).toBeGreaterThanOrEqual(
      row[index - 1].x + row[index - 1].width - 0.5,
    );
  for (const [index, box] of row.entries()) {
    expect(box.y, 'control ' + index).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height, 'control ' + index).toBeLessThanOrEqual(64);
  }
  const last = row[row.length - 1];
  expect(last.x + last.width).toBeLessThanOrEqual(1281 - gutter(1281, 'wide') + 0.5);
  expect(await header.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  // The account name takes the shortage as an ellipsis and still shows six characters.
  const shown = await accountGroup[3].evaluate((button) => {
    const name = button.lastElementChild as HTMLElement;
    const text = name.textContent ?? '';
    const style = getComputedStyle(name);
    const probe = document.createElement('span');
    probe.style.cssText = `position:absolute;visibility:hidden;white-space:nowrap;font:${style.font};font-stretch:${style.fontStretch}`;
    document.body.append(probe);
    const fits = (value: string) => {
      probe.textContent = value;
      return probe.getBoundingClientRect().width <= name.clientWidth + 0.5;
    };
    let count = text.length;
    if (!fits(text)) while (count > 0 && !fits(text.slice(0, count) + '…')) count--;
    probe.remove();
    return count;
  });
  expect(shown).toBeGreaterThanOrEqual(6);

  // Two rows: the brand and the account group, with the width switch still offered, over the
  // five destinations.
  await page.setViewportSize({ width: 1280, height: 800 });
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
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1280);
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

const pathOf = (id: InventoryId) => inventory.find((view) => view.id === id)!.path;
/** Whether a box lies whole between another's left and right edges, to half a pixel. */
async function inside(inner: Locator, outer: Locator | { x: number; width: number }) {
  const box = (await inner.boundingBox())!;
  const frame = 'x' in outer ? outer : (await outer.boundingBox())!;
  return box.x >= frame.x - 0.5 && box.x + box.width <= frame.x + frame.width + 0.5;
}

for (const [id, modes, subjects] of [
  ['contributors-timeline', 'Report view', 'Contribution reports'],
  ['companies-timeline', 'Report view', 'Contribution reports'],
  ['repos-overview', 'Repository overview views', null],
] satisfies [InventoryId, string, string | null][])
  test(`on phones the view bar keeps both view modes and the current subject whole (${id})`, async ({
    page,
  }) => {
    await login(page);
    for (const width of [320, 375, 390]) {
      await page.setViewportSize({ width, height: 800 });
      await page.goto(pathOf(id));
      const at = `at ${width}px`;
      const group = page.getByRole('navigation', { name: modes, exact: true });
      const options = await group.getByRole('link').all();
      expect(options.length, at).toBe(2);
      for (const option of options) {
        const name = at + ' ' + (await option.textContent());
        expect(await inside(option, group), name).toBe(true);
        expect(await inside(option, { x: 0, width }), name).toBe(true);
      }
      if (subjects) {
        // The bar scrolls its current subject tab into view once the page is interactive.
        const row = page.getByRole('navigation', { name: subjects, exact: true });
        await expect.poll(() => inside(row.locator('[aria-current="page"]'), row), at).toBe(true);
      } else {
        const trigger = page.getByRole('button', { name: 'Sections', exact: true });
        await expect(trigger).toBeEnabled();
        expect(await inside(trigger, { x: 0, width }), at).toBe(true);
      }
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
        at,
      ).toBe(true);
    }
  });

for (const width of [320, 390])
  test(`at ${width}px the masthead scrolls its current destination into view`, async ({ page }) => {
    await login(page);
    await page.setViewportSize({ width, height: 800 });
    const main = page.getByRole('navigation', { name: 'Main navigation', exact: true });
    const [, , contributors, reviewers, companies] = mainDestinations(page);
    for (const [id, current] of [
      ['companies-all', companies],
      ['companies-timeline-all', companies],
      ['company-detail-all', companies],
      ['contributor-detail-all', companies],
      ['reviewers', reviewers],
      ['companies-reviewers', reviewers],
      ['contributor-detail-reviewers', reviewers],
      ['contributors', contributors],
      ['companies', contributors],
    ] satisfies [InventoryId, Locator][]) {
      await page.goto(pathOf(id));
      // The five destinations do not fit this width, so the row scrolls sideways.
      expect(await main.evaluate((nav) => nav.scrollWidth > nav.clientWidth), id).toBe(true);
      await expect.poll(() => inside(current, main), id).toBe(true);
      expect(await inside(current, { x: 0, width }), id).toBe(true);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
        id,
      ).toBeLessThanOrEqual(width);
    }
  });

test('at phone widths the current crumb ends inside the breadcrumb row', async ({ page }) => {
  await login(page);
  const crumbs = page
    .getByRole('navigation', { name: 'Breadcrumb', exact: true })
    .getByRole('list');
  const current = crumbs.locator('[aria-current="page"]');
  for (const width of [320, 375, 390]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto(pathOf('repo-author-issues'));
    const at = `at ${width}px`;
    // Shortened on screen only: the crumb keeps its whole name.
    await expect(current, at).toHaveText('Issues by sample-author-2');
    expect(await crumbs.evaluate((list) => list.scrollWidth <= list.clientWidth), at).toBe(true);
    expect(await inside(current, crumbs), at).toBe(true);
  }
});

test('at 320px the metric column beside a pinned column shows its values on the first screen', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await login(page);
  for (const path of [
    '/companies',
    '/contributors?timeline',
    '/repos?timeline&sample=mixed&group=quarter',
  ]) {
    await page.goto(path);
    const area = page.getByRole('region', { name: /table scroll area$/ }).first();
    await expect(area.locator('tbody tr').first()).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    const layout = await area.evaluate((element) => {
      const box = element.getBoundingClientRect();
      const [pinned, cell] = element.querySelector('tbody tr')!.querySelectorAll('td');
      const text: { left: number; right: number }[] = [];
      const walker = document.createTreeWalker(cell, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        // Screen-reader-only text is clipped to a 1px box.
        if ((node.parentElement?.getBoundingClientRect().width ?? 0) <= 1) continue;
        const range = document.createRange();
        range.selectNodeContents(node);
        for (const rect of range.getClientRects())
          if (rect.width > 0) text.push({ left: rect.left, right: rect.right });
      }
      return {
        numeric: getComputedStyle(cell).textAlign === 'right',
        pinnedRight: pinned.getBoundingClientRect().right,
        visibleRight: box.left + element.clientWidth,
        text,
      };
    });
    expect(layout.numeric, path).toBe(true);
    expect(layout.text.length, path).toBeGreaterThan(0);
    // Clear of the pinned column and inside the area's visible width.
    for (const rect of layout.text) {
      expect(rect.left, path).toBeGreaterThanOrEqual(layout.pinnedRight);
      expect(rect.right, path).toBeLessThanOrEqual(layout.visibleRight);
    }
  }
});

test('below 375px a name column beside a text column keeps its width, so no name gains a line', async ({
  page,
}) => {
  await login(page);
  /** Text lines in the pinned cell of each of the first six rows, and the next cell's alignment. */
  const read = () =>
    page
      .getByRole('region', { name: /table scroll area$/ })
      .first()
      .evaluate((area) =>
        [...area.querySelectorAll('tbody tr')].slice(0, 6).map((row) => {
          const [pinned, next] = row.querySelectorAll('td');
          const tops: number[] = [];
          const walker = document.createTreeWalker(pinned, NodeFilter.SHOW_TEXT);
          for (let node = walker.nextNode(); node; node = walker.nextNode()) {
            // Screen-reader-only text is clipped to a 1px box.
            if ((node.parentElement?.getBoundingClientRect().width ?? 0) <= 1) continue;
            const range = document.createRange();
            range.selectNodeContents(node);
            for (const rect of range.getClientRects()) if (rect.width > 0) tops.push(rect.top);
          }
          tops.sort((a, b) => a - b);
          return {
            lines: tops.filter((top, index) => !index || top - tops[index - 1] > 4).length,
            numericNext: getComputedStyle(next).textAlign === 'right',
          };
        }),
      );
  for (const id of [
    'contributors',
    'reviewers',
    'company-detail',
    'repo-credits-metric',
  ] satisfies InventoryId[]) {
    const counts: { lines: number; numericNext: boolean }[][] = [];
    for (const width of [375, 320]) {
      await page.setViewportSize({ width, height: 800 });
      await page.goto(pathOf(id));
      await expect(
        page
          .getByRole('region', { name: /table scroll area$/ })
          .first()
          .locator('tbody tr')
          .first(),
      ).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      counts.push(await read());
    }
    const [wide, narrow] = counts;
    expect(narrow.length, id).toBeGreaterThan(0);
    // The column beside the names holds text, such as Account type.
    expect(
      narrow.every((row) => !row.numericNext),
      id,
    ).toBe(true);
    expect(
      narrow.map((row) => row.lines),
      id,
    ).toEqual(wide.map((row) => row.lines));
  }
});

test('a toolbar reset stays level with its last row of fields, and starts the row on phones', async ({
  page,
}) => {
  await login(page);
  for (const [path, region] of [
    ['/repos?timeline', 'Timeline scope'],
    ['/contributors?v=1', 'Contribution report scope'],
  ] as const) {
    for (const width of [768, 390]) {
      const at = `${path} at ${width}px`;
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(path);
      await page.evaluate(() => document.fonts.ready);
      const groups = await page
        .getByRole('region', { name: region, exact: true })
        .locator('fieldset')
        .evaluateAll((sets) =>
          sets.flatMap((set) => {
            const controls = [...set.querySelectorAll('button, select')].filter(
              (control) => control.getClientRects().length > 0,
            );
            const reset = controls.find((control) =>
              /^Reset (view|filters)$/.test(control.textContent?.trim() ?? ''),
            );
            const fields = controls.filter((control) => control !== reset);
            if (!reset || !fields.length) return [];
            return [
              {
                group: set.getBoundingClientRect().left,
                reset: reset.getBoundingClientRect().toJSON() as DOMRect,
                lastRow: Math.max(...fields.map((field) => field.getBoundingClientRect().bottom)),
              },
            ];
          }),
        );
      expect(groups.length, at).toBeGreaterThan(0);
      for (const { group, reset, lastRow } of groups) {
        if (width === 768) expect(Math.abs(reset.bottom - lastRow), at).toBeLessThanOrEqual(2);
        else expect(Math.abs(reset.left - group), at).toBeLessThanOrEqual(1);
      }
    }
  }
});

test('toolbar summaries wrap whole facts and never start a line with a separator', async ({
  page,
}) => {
  await login(page);
  for (const path of [
    '/contributors?timeline&sample=empty',
    '/repos/prebidjs?period=this-month&at=2026-10-24T12:00Z&metric=medianMergeDays',
  ]) {
    for (const width of [320, 390]) {
      const at = `${path} at ${width}px`;
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(path);
      await page.evaluate(() => document.fonts.ready);
      const summaries = await page
        .getByRole('region', { name: /^(Timeline scope|Selected repository scope)$/ })
        .evaluateAll((regions) =>
          regions.flatMap((region) => {
            const summary = region.lastElementChild!;
            const separators = [...summary.querySelectorAll('[aria-hidden="true"]')];
            if (summary.tagName !== 'P' || !separators.length) return [];
            const style = getComputedStyle(summary);
            const box = summary.getBoundingClientRect();
            const left = box.left + parseFloat(style.paddingLeft);
            const right = box.right - parseFloat(style.paddingRight);
            const range = document.createRange();
            return [
              {
                left,
                right,
                // Where each separator's dot is drawn.
                dots: separators.map((separator) => {
                  const text = separator.firstChild as Text;
                  const at = text.data.indexOf('·');
                  range.setStart(text, at);
                  range.setEnd(text, at + 1);
                  return range.getBoundingClientRect().left;
                }),
                // Each fact's line boxes, and where its box starts and ends.
                items: [...summary.children].map((item) => {
                  range.selectNodeContents(item);
                  const tops = [...range.getClientRects()]
                    .filter((rect) => rect.width > 0)
                    .map((rect) => rect.top)
                    .sort((a, b) => a - b);
                  const box = item.getBoundingClientRect();
                  return {
                    text: item.textContent ?? '',
                    lines: tops.filter((top, index) => !index || top - tops[index - 1] > 4).length,
                    left: box.left,
                    right: box.right,
                  };
                }),
              },
            ];
          }),
        );
      expect(summaries.length, at).toBeGreaterThan(0);
      for (const summary of summaries) {
        for (const dot of summary.dots) expect(dot, at).toBeGreaterThan(summary.left + 1);
        // A fact takes more than one line only when it is longer than the whole line.
        for (const item of summary.items)
          if (item.lines > 1) {
            expect(item.left, `${at}: ${item.text}`).toBeCloseTo(summary.left, 0);
            expect(item.right, `${at}: ${item.text}`).toBeCloseTo(summary.right, 0);
          }
      }
    }
  }
});

test('the Current backlog description keeps its separator on the Open now line', async ({
  page,
}) => {
  await login(page);
  for (const id of ['repos-overview', 'repos-comparison'] satisfies InventoryId[]) {
    for (const width of [320, 390]) {
      const at = `${id} at ${width}px`;
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(pathOf(id));
      await page.evaluate(() => document.fonts.ready);
      const label = page.getByText('Open now', { exact: true });
      // Its one separator stays on the label's line, including at 320px, where the line wraps.
      const lines = await label.evaluate((element) => {
        const range = document.createRange();
        const top = (node: Text, offset: number) => {
          range.setStart(node, offset);
          range.setEnd(node, offset + 1);
          return range.getBoundingClientRect().top;
        };
        const description = element.parentElement!.parentElement!;
        const walker = document.createTreeWalker(description, NodeFilter.SHOW_TEXT);
        const texts: Text[] = [];
        for (let node = walker.nextNode(); node; node = walker.nextNode()) texts.push(node as Text);
        const dots = texts.filter((text) => text.data.includes('·'));
        const last = texts[texts.length - 1];
        return {
          dots: dots.map((text) => top(text, text.data.indexOf('·'))),
          label: top(element.firstChild as Text, 0),
          end: top(last, last.data.length - 1),
        };
      });
      if (width === 320) expect(lines.end, at).toBeGreaterThan(lines.label + 1);
      expect(lines.dots.length, at).toBe(1);
      expect(Math.abs(lines.dots[0] - lines.label), at).toBeLessThanOrEqual(1);
    }
  }
});

test('the setup card clears the theme button on phones', async ({ page }) => {
  await page.goto('/auth/setup');
  const card = page
    .getByRole('heading', { name: 'Accounts are managed by your administrator', exact: true })
    .locator('..');
  const theme = page.getByRole('button', { name: 'Theme settings', exact: true });
  for (const width of [320, 375, 390]) {
    await page.setViewportSize({ width, height: 800 });
    const [a, b] = [(await theme.boundingBox())!, (await card.boundingBox())!];
    const overlaps =
      a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
    expect(overlaps, `${width}px`).toBe(false);
  }
});
