import type { Page } from '@playwright/test';
import { test, expect, expectTheme } from './fixtures';
import { inventory, type InventoryId } from '../support/views';

const story = (id: string, theme: 'light' | 'dark' = 'dark') =>
  `http://127.0.0.1:6007/iframe.html?id=${id}&viewMode=story&globals=theme:${theme}`;

/** The WCAG contrast ratio of two computed rgb() colours. */
function contrast(first: string, second: string) {
  const luminance = (colour: string) => {
    const [r, g, b] = (colour.match(/[\d.]+/g) ?? []).slice(0, 3).map((value) => {
      const channel = Number(value) / 255;
      return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const [lighter, darker] = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

const sectionsNav = (page: Page) => page.getByRole('navigation', { name: 'On this page' });
const historyLength = (page: Page) => page.evaluate(() => history.length);
const hash = (page: Page) => page.evaluate(() => location.hash);

test('every button size has its height, and icon buttons are square', async ({ page }) => {
  await page.goto(story('primitives-button--sizes'));
  const sizes = {
    'Columns sm': [null, 28],
    'Columns md': [null, 34],
    'Columns lg': [null, 40],
    'Columns icon-sm': [28, 28],
    'Columns icon': [34, 34],
    'Columns icon-lg': [36, 36],
  } as const;
  for (const [name, [width, height]] of Object.entries(sizes)) {
    const box = (await page.getByRole('button', { name, exact: true }).boundingBox())!;
    expect(box.height, name).toBe(height);
    if (width !== null) expect(box.width, name).toBe(width);
  }
});

for (const theme of ['light', 'dark'] as const)
  test(`masthead buttons are 36px, keep their width when selected and mark it at 3:1 (${theme})`, async ({
    page,
  }) => {
    await page.goto(story('primitives-button--masthead', theme));
    await expectTheme(page, theme);
    const button = (name: string) => page.getByRole('button', { name, exact: true });
    await expect(button('Sign out')).toBeVisible();
    for (const name of [
      'Full-width layout',
      'Contained layout',
      'Theme settings',
      'Open theme settings',
    ]) {
      const box = (await button(name).boundingBox())!;
      expect([box.width, box.height], name).toEqual([36, 36]);
    }
    const [closed, open, signOut] = await Promise.all(
      ['Account, closed', 'Account, open', 'Sign out'].map((name) => button(name).boundingBox()),
    );
    expect(open!.width).toBe(closed!.width);
    expect([closed!.height, open!.height, signOut!.height]).toEqual([36, 36, 36]);
    // The pressed and open edges and the focus ring each reach 3:1 against the navy band.
    const colours = await page.evaluate(() => {
      const named = (name: string) =>
        [...document.querySelectorAll('button')].find(
          (element) => element.getAttribute('aria-label') === name,
        )!;
      const pressed = named('Contained layout');
      const probe = document.createElement('span');
      probe.style.color = 'var(--ring)';
      pressed.append(probe);
      const ring = getComputedStyle(probe).color;
      probe.remove();
      return {
        band: getComputedStyle(pressed.parentElement!).backgroundColor,
        pressed: getComputedStyle(pressed).borderTopColor,
        open: getComputedStyle(named('Open theme settings')).borderTopColor,
        ring,
      };
    });
    for (const edge of ['pressed', 'open', 'ring'] as const)
      expect(contrast(colours[edge], colours.band), edge).toBeGreaterThanOrEqual(3);
  });

test('the masthead and the 44px view bar stay stuck at the top to the end of the page', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  // A page story with the real DashboardFrame and DashboardHeader.
  await page.goto(story('repositories-all-repositories--overview'));
  await expect(sectionsNav(page)).toBeVisible();
  const banner = page.getByRole('banner');
  const bar = page.locator('[data-view-bar]');
  // The bar sits under the one-row masthead, and under both rows once the masthead takes two.
  for (const [width, shell] of [
    [1300, 64],
    [1280, 64],
    [1279, 100],
  ] as const) {
    await page.setViewportSize({ width, height: 800 });
    for (const share of [0.5, 1]) {
      const at = `at ${width}px and ${share}`;
      await page.evaluate(
        (share) => window.scrollTo(0, document.documentElement.scrollHeight * share),
        share,
      );
      await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(400);
      const [masthead, view] = await Promise.all([banner.boundingBox(), bar.boundingBox()]);
      expect([masthead!.y, masthead!.height], 'masthead ' + at).toEqual([0, shell]);
      expect([view!.y, view!.height], 'view bar ' + at).toEqual([shell, 44]);
    }
  }
});

for (const [id, label] of [
  ['navigation-view-bar--tabs', 'Repository lists'],
  ['navigation-view-bar--view-modes', 'Repository overview views'],
] as const)
  test(`the current tab is 700 and moving it moves no tab (${label})`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(story(id));
    const tabs = page.getByRole('navigation', { name: label, exact: true }).getByRole('link');
    await expect(tabs.first()).toHaveAttribute('aria-current', 'page');
    await page.evaluate(() => document.fonts.ready);
    const read = () =>
      tabs.evaluateAll((links) =>
        links.map((link) => ({
          left: link.getBoundingClientRect().left,
          weight: getComputedStyle(link).fontWeight,
        })),
      );
    const before = await read();
    expect(before.map((tab) => tab.weight)).toEqual(
      before.map((_, index) => (index ? '600' : '700')),
    );
    // Mark the second tab current, as following its link would.
    await tabs.evaluateAll(([first, second]) => {
      first.removeAttribute('aria-current');
      second.setAttribute('aria-current', 'page');
    });
    const after = await read();
    expect(after.map((tab) => tab.weight)).toEqual(
      after.map((_, index) => (index === 1 ? '700' : '600')),
    );
    for (const [index, tab] of after.entries())
      expect(Math.abs(tab.left - before[index].left), 'tab ' + index).toBeLessThanOrEqual(1);
  });

for (const theme of ['light', 'dark'] as const)
  test(`a section chip moves focus to its heading and replaces the fragment (${theme})`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(story('navigation-view-bar--sections', theme));
    await expectTheme(page, theme);
    const chip = sectionsNav(page).getByRole('link', { name: 'Period activity', exact: true });
    await expect(chip).toBeVisible();
    const entries = await historyLength(page);
    await chip.click();
    await expect(
      page.getByRole('heading', { level: 2, name: 'Period activity', exact: true }),
    ).toBeFocused();
    expect(await hash(page)).toBe('#period-activity');
    expect(await historyLength(page)).toBe(entries);
    await expect(chip).toHaveAttribute('aria-current', 'location');
    await expect(
      sectionsNav(page).getByRole('link', { name: 'Current backlog', exact: true }),
    ).not.toHaveAttribute('aria-current');
    // The section's top lands 12px under the view bar.
    const [bar, section] = await Promise.all([
      page.locator('[data-view-bar]').boundingBox(),
      page.getByRole('region', { name: 'Period activity', exact: true }).boundingBox(),
    ]);
    expect(Math.abs(section!.y - (bar!.y + bar!.height) - 12)).toBeLessThanOrEqual(1);
    // The current chip's edge reaches 3:1 against the bar.
    const [edge, surface] = await Promise.all([
      chip.evaluate((element) => getComputedStyle(element).borderTopColor),
      page
        .locator('[data-view-bar]')
        .evaluate((element) => getComputedStyle(element).backgroundColor),
    ]);
    expect(contrast(edge, surface)).toBeGreaterThanOrEqual(3);
    // Back at the top the first section is current again, and scrolling wrote no history.
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(
      sectionsNav(page).getByRole('link', { name: 'Current backlog', exact: true }),
    ).toHaveAttribute('aria-current', 'location');
    expect(await historyLength(page)).toBe(entries);
    expect(await hash(page)).toBe('#period-activity');
  });

test('at phone width a Sections menu replaces the chips and leaves focus on the chosen heading', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(story('navigation-view-bar--sections'));
  const nav = sectionsNav(page);
  const trigger = nav.getByRole('button', { name: 'Sections', exact: true });
  await expect(trigger).toBeEnabled();
  await expect(
    nav.getByRole('link', { name: 'Period activity', exact: true, includeHidden: true }),
  ).toBeHidden();
  // The bar holds the tabs and the menu in one row inside the viewport, and the page does not
  // scroll sideways.
  const bar = page.locator('[data-view-bar]');
  const box = (await bar.boundingBox())!;
  expect(box.height).toBe(44);
  expect(await bar.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  const viewport = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.innerWidth);
  expect(viewport.scrollWidth).toBeLessThanOrEqual(viewport.innerWidth);
  const entries = await historyLength(page);
  await trigger.focus();
  await page.keyboard.press('Enter');
  await page.getByRole('menuitem', { name: 'At a glance', exact: true }).click();
  await expect(
    page.getByRole('heading', { level: 2, name: 'At a glance', exact: true }),
  ).toBeFocused();
  await expect(page.getByRole('menu')).toHaveCount(0);
  expect(await hash(page)).toBe('#at-a-glance');
  expect(await historyLength(page)).toBe(entries);
});

async function signIn(page: Page) {
  await page.goto('/auth/login');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL((url) => url.pathname === '/repos');
}
const pathOf = (id: InventoryId) => inventory.find((view) => view.id === id)!.path;

for (const id of ['repo-author-issues', 'repo-docs-open-issues'] satisfies InventoryId[])
  test(`where the chips do not fit, the Sections menu keeps the record tabs whole (${id})`, async ({
    page,
  }) => {
    await signIn(page);
    const tabs = page.getByRole('navigation', { name: 'Repository lists', exact: true });
    const trigger = sectionsNav(page).getByRole('button', { name: 'Sections', exact: true });
    // 601 to 700px: the narrow gap and the icon-only trigger; 768px: the full trigger.
    for (const width of [601, 640, 700, 768]) {
      const at = `at ${width}px`;
      await page.setViewportSize({ width, height: 900 });
      await page.goto(pathOf(id));
      await expect(trigger, at).toBeVisible();
      await expect(sectionsNav(page).getByRole('list'), at).toBeHidden();
      // The tab row does not scroll, and every tab lies whole inside it.
      expect(await tabs.evaluate((row) => row.scrollWidth <= row.clientWidth), at).toBe(true);
      const row = (await tabs.boundingBox())!;
      const links = tabs.getByRole('link');
      expect(await links.count(), at).toBe(3);
      for (const link of await links.all()) {
        const box = (await link.boundingBox())!;
        const name = at + ' ' + ((await link.textContent()) ?? '');
        expect(box.x, name).toBeGreaterThanOrEqual(row.x - 0.5);
        expect(box.x + box.width, name).toBeLessThanOrEqual(row.x + row.width + 0.5);
      }
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
        at,
      ).toBe(true);
    }
    // Widened until they fit, the chips return, and their list does not scroll.
    await page.setViewportSize({ width: 1121, height: 900 });
    const chips = sectionsNav(page).getByRole('list');
    await expect(chips).toBeVisible();
    await expect(trigger).toBeHidden();
    expect(await chips.evaluate((list) => list.scrollWidth <= list.clientWidth)).toBe(true);
    expect(await tabs.evaluate((row) => row.scrollWidth <= row.clientWidth)).toBe(true);
  });

for (const [id, width] of [
  ['repos-overview', 768],
  ['repos-comparison', 700],
  ['repo-docs-open-issues', 1000],
  ['repo-author-issues', 1440],
] satisfies [InventoryId, number][])
  test(`where the chips fit, they show from the first paint and the menu never does (${id}, ${width}px)`, async ({
    page,
    browser,
  }) => {
    await signIn(page);
    await page.setViewportSize({ width, height: 900 });
    // Records whether the Sections trigger was ever laid out, from before the first paint to the
    // end of the load.
    await page.addInitScript(() => {
      const seen = { menu: false, done: false };
      Object.assign(window, { sectionsMenuSeen: seen });
      const check = () => {
        const trigger = [
          ...document.querySelectorAll('nav[aria-label="On this page"] button'),
        ].find((button) => button.textContent?.includes('Sections'));
        if (trigger && trigger.getClientRects().length > 0) seen.menu = true;
      };
      new MutationObserver(check).observe(document, {
        subtree: true,
        childList: true,
        attributes: true,
      });
      const frame = () => {
        check();
        if (!seen.done) requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
      addEventListener('load', () => setTimeout(() => (seen.done = true), 1000));
    });
    await page.goto(pathOf(id));
    const chips = sectionsNav(page).getByRole('list');
    await expect(chips).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            (window as unknown as { sectionsMenuSeen: { done: boolean } }).sectionsMenuSeen.done,
        ),
      )
      .toBe(true);
    expect(
      await page.evaluate(
        () => (window as unknown as { sectionsMenuSeen: { menu: boolean } }).sectionsMenuSeen.menu,
      ),
    ).toBe(false);
    expect(await chips.evaluate((list) => list.scrollWidth <= list.clientWidth)).toBe(true);
    await expect(
      sectionsNav(page).getByRole('button', { name: 'Sections', exact: true }),
    ).toBeHidden();
    // The server renders the chips: without JavaScript the same page shows them.
    const context = await browser.newContext({
      javaScriptEnabled: false,
      viewport: { width, height: 900 },
      storageState: await page.context().storageState(),
    });
    try {
      const plain = await context.newPage();
      await plain.goto(new URL(pathOf(id), page.url()).href);
      await expect(sectionsNav(plain).getByRole('list')).toBeVisible();
      await expect(
        sectionsNav(plain).getByRole('button', { name: 'Sections', exact: true }),
      ).toBeHidden();
    } finally {
      await context.close();
    }
  });
