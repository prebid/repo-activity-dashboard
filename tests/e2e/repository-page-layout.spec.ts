import { test, expect, expectTheme } from './fixtures';
import type { Locator } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

for (const [kind, theme, width] of [
  ['prs', 'dark', 1440],
  ['issues', 'light', 1440],
  ['prs', 'light', 375],
  ['issues', 'dark', 375],
] as const) {
  test(`repository layout ${kind}, ${theme}, ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/auth/login');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page).toHaveURL(/\/repos$/);
    await page.getByRole('button', { name: 'Theme settings', exact: true }).click();
    await page
      .getByRole('menuitemradio', { name: theme === 'dark' ? 'Dark' : 'Light', exact: true })
      .click();
    await page.goto('/repos/prebidjs?view=' + kind);
    await expect(page.getByRole('heading', { name: 'Prebid.js', exact: true })).toBeVisible();
    await expect(
      page
        .getByRole('navigation', { name: 'Repository lists' })
        .getByRole('link', { name: kind === 'prs' ? /^Pull requests/ : /^Issues/ }),
    ).toHaveAttribute('aria-current', 'page');
    // The record tabs keep one 44px row at every width, scrolling sideways instead of wrapping.
    const tabRow = await page
      .getByRole('navigation', { name: 'Repository lists' })
      .evaluate((nav) => ({
        nav: nav.getBoundingClientRect().toJSON() as DOMRect,
        tabs: [...nav.querySelectorAll('a, [role="link"]')].map(
          (tab) => tab.getBoundingClientRect().toJSON() as DOMRect,
        ),
      }));
    expect(tabRow.nav.height).toBeCloseTo(44, 0);
    expect(tabRow.tabs).toHaveLength(3);
    for (const tab of tabRow.tabs) {
      expect(tab.top).toBeCloseTo(tabRow.nav.top, 0);
      expect(tab.bottom).toBeCloseTo(tabRow.nav.bottom, 0);
    }
    await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(50);
    await expect(page.getByRole('button', { name: 'Show charts', exact: true })).toBeVisible();
    await expect(page.getByRole('figure')).toHaveCount(0);
    // Widths are measured with the web fonts, not their fallback.
    await page.evaluate(() => document.fonts.ready);
    const scope = page.getByRole('combobox', { name: 'Record scope', exact: true });
    const selectBox = (await scope.boundingBox())!;
    const arrowBox = (await scope.locator('..').locator('svg').boundingBox())!;
    expect(arrowBox.x).toBeGreaterThan(selectBox.x);
    expect(arrowBox.x + arrowBox.width).toBeLessThan(selectBox.x + selectBox.width - 4);
    expect(
      Math.abs(arrowBox.y + arrowBox.height / 2 - selectBox.y - selectBox.height / 2),
    ).toBeLessThan(1);
    const numberCell = page.locator('tbody [data-column="number"]').first();
    expect((await numberCell.boundingBox())!.width).toBeLessThan(150);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      width,
    );
    await expect(page.getByRole('link', { name: /View repository on GitHub/ })).toHaveAttribute(
      'href',
      'https://github.com/prebid/Prebid.js',
    );
    const columns = page.getByRole('button', { name: 'Columns', exact: true });
    await columns.click();
    await expect(page.getByRole('menu')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(columns).toBeFocused();
    expect((await new AxeBuilder({ page }).include('main').analyze()).violations).toEqual([]);
    await page.screenshot({
      path: testInfo.outputPath('repository-' + kind + '-' + theme + '-' + width + '.png'),
    });
  });
}

test('direct lists share the drilldown layout and retain pagination through tab navigation', async ({
  page,
}) => {
  await page.goto('/auth/login');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/repos$/);
  await page.goto('/repos/prebidjs');
  await expect(page.getByText('137 matching records', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(50);
  await page
    .getByRole('navigation', { name: 'Repository lists' })
    .getByRole('link', { name: /^Issues/ })
    .click();
  await expect(page.getByText('834 matching records', { exact: true })).toBeVisible();
  await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(50);
  await page.goBack();
  await expect(page.getByText('Page 2 of 3', { exact: true })).toBeVisible();
  await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(50);
  // An old link's return context is answered with a 307 to a back frame.
  await page.goto(
    '/repos/prebidjs?scope=current&metric=humanApprovals0&returnTo=%2Frepos%3Fage%3D60',
  );
  await expect(page).toHaveURL(/\/repos\/prebidjs\?metric=humanApprovals0&back=~age:60$/);
  await expect(page.getByText('60 matching records', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'All repositories', exact: true })).toHaveAttribute(
    'href',
    '/repos?age=60',
  );
  await expect(page.getByRole('heading', { name: 'Prebid.js', exact: true })).toBeVisible();
});

const authorRecords =
  '/repos/prebidjs/authors/sample-author-2?period=this-year&at=2026-10-24T12:00Z&metric=prAuthors';

test('a reset-only group puts Reset view on its overline or status line, not a row of its own', async ({
  page,
}) => {
  await page.goto('/auth/login');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/repos$/);
  for (const width of [1440, 768]) {
    const at = `${width}px`;
    await page.setViewportSize({ width, height: 1000 });
    // Two groups: the reset sits on the "Columns, sorting and charts" overline's line.
    await page.goto('/repos/prebiddocs?view=issues');
    await page.evaluate(() => document.fonts.ready);
    const group = page.getByRole('group', { name: 'Columns, sorting and charts', exact: true });
    const legend = (await group.locator('legend').boundingBox())!;
    const reset = (await group
      .getByRole('button', { name: 'Reset view', exact: true })
      .boundingBox())!;
    const centre = reset.y + reset.height / 2;
    expect(centre, at).toBeGreaterThanOrEqual(legend.y);
    expect(centre, at).toBeLessThanOrEqual(legend.y + legend.height);
    // The group ends with that one row: no empty control row under the overline.
    const bottom = (await group.boundingBox())!;
    expect(bottom.y + bottom.height, at).toBeLessThanOrEqual(
      Math.max(legend.y + legend.height, reset.y + reset.height) + 1,
    );
    // One group: the reset sits beside the status sentence's first line.
    await page.goto(authorRecords);
    await page.evaluate(() => document.fonts.ready);
    const toolbar = page.getByRole('region', { name: 'Selected repository scope', exact: true });
    const only = (await toolbar
      .getByRole('button', { name: 'Reset view', exact: true })
      .boundingBox())!;
    const line = await toolbar
      .getByText('Preferences saved for your account on this browser.', { exact: true })
      .evaluate((sentence) => {
        const range = document.createRange();
        range.selectNodeContents(sentence);
        const first = range.getClientRects()[0];
        return { top: first.top, bottom: first.bottom };
      });
    const middle = only.y + only.height / 2;
    expect(middle, at).toBeGreaterThanOrEqual(line.top);
    expect(middle, at).toBeLessThanOrEqual(line.bottom);
  }
  // Where the overline leaves no room beside it, the reset drops below it inside the card.
  await page.setViewportSize({ width: 320, height: 1000 });
  await page.goto('/repos/prebiddocs?view=issues');
  await page.evaluate(() => document.fonts.ready);
  const group = page.getByRole('group', { name: 'Columns, sorting and charts', exact: true });
  const [legend, reset, box] = [
    (await group.locator('legend').boundingBox())!,
    (await group.getByRole('button', { name: 'Reset view', exact: true }).boundingBox())!,
    (await group.boundingBox())!,
  ];
  expect(reset.y).toBeGreaterThanOrEqual(legend.y + legend.height - 0.5);
  expect(reset.x).toBeGreaterThanOrEqual(box.x - 0.5);
  expect(reset.x + reset.width).toBeLessThanOrEqual(box.x + box.width + 0.5);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
});

test('the scope link takes the breadcrumb link colour in both themes', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/auth/login');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/repos$/);
  for (const theme of ['Light', 'Dark'] as const) {
    await page.getByRole('button', { name: 'Theme settings', exact: true }).click();
    await page.getByRole('menuitemradio', { name: theme, exact: true }).click();
    await page.goto('/repos/prebidjs?metric=humanApprovals0');
    await expectTheme(page, theme.toLowerCase());
    const scope = page
      .getByRole('region', { name: 'Selected repository scope', exact: true })
      .getByRole('link', { name: 'All open PRs', exact: true });
    const crumb = page.getByRole('link', { name: 'All repositories', exact: true });
    const colour = (link: Locator) => link.evaluate((element) => getComputedStyle(element).color);
    expect(await colour(scope), theme).toBe(await colour(crumb));
  }
});

test('the toolbar summary sets its hyphens at prose width, not tabular width', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/auth/login');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/repos$/);
  await page.goto(authorRecords);
  await page.evaluate(() => document.fonts.ready);
  // Tabular figures set the hyphen at a figure's width; prose sets it narrower than the "2".
  const glyphs = await page
    .getByRole('region', { name: 'Selected repository scope', exact: true })
    .getByText('PRs by sample-author-2', { exact: true })
    .evaluate((lead) => {
      const text = lead.firstChild as Text;
      const range = document.createRange();
      const width = (at: number) => {
        range.setStart(text, at);
        range.setEnd(text, at + 1);
        return range.getBoundingClientRect().width;
      };
      return { hyphen: width(text.data.indexOf('-')), figure: width(text.data.length - 1) };
    });
  expect(glyphs.hyphen).toBeGreaterThan(0);
  expect(glyphs.hyphen).toBeLessThan(0.9 * glyphs.figure);
});
