import { test, expect, expectTheme } from './fixtures';
import type { Locator, Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { inventory, type InventoryId } from '../support/views';

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

async function signIn(page: Page, width: number) {
  await page.setViewportSize({ width, height: 900 });
  await page.goto('/auth/login');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/repos$/);
}
const viewPath = (id: InventoryId) => inventory.find((view) => view.id === id)!.path;

for (const width of [320, 375])
  test(`the table pager keeps its position text on one line inside the footer at ${width}px`, async ({
    page,
  }) => {
    await signIn(page, width);
    await page.goto(viewPath('repo-docs-open-issues'));
    const pager = page.getByRole('navigation', { name: / pages$/ });
    // Below 360px the buttons show their chevrons alone and keep their names.
    await expect(pager.getByRole('button', { name: 'Previous', exact: true })).toBeVisible();
    await expect(pager.getByRole('button', { name: 'Next', exact: true })).toBeVisible();
    const position = pager.getByText('Page 1 of 247', { exact: true });
    await expect(position).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    const lines = await position.evaluate((element) => {
      const range = document.createRange();
      range.selectNodeContents(element);
      return range.getClientRects().length;
    });
    expect(lines).toBe(1);
    // The pager sits in the table footer, inside its padding.
    const edges = await pager.evaluate((nav) => {
      const footer = nav.parentElement!;
      return {
        nav: nav.getBoundingClientRect().right,
        footer:
          footer.getBoundingClientRect().right - parseFloat(getComputedStyle(footer).paddingRight),
      };
    });
    expect(edges.nav).toBeLessThanOrEqual(edges.footer + 0.5);
  });

test('a wrapped table title keeps its help button after its last word at 320px', async ({
  page,
}) => {
  await signIn(page, 320);
  await page.goto(viewPath('repo-approvals-metric'));
  const name = 'PRs with 0 human approvals';
  const title = page.getByRole('heading', { name, level: 2, exact: true });
  const help = page.getByRole('button', { name: 'Column definitions for ' + name, exact: true });
  await expect(help).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  const lines = await title.evaluate((heading) =>
    [...heading.getClientRects()].map(({ left, right, top, bottom }) => ({
      left,
      right,
      top,
      bottom,
    })),
  );
  // The title wraps at this width, so the button follows its second line.
  expect(lines.length).toBeGreaterThan(1);
  const last = lines[lines.length - 1];
  const button = (await help.boundingBox())!;
  expect(button.x - last.right).toBeGreaterThanOrEqual(0);
  expect(button.x - last.right).toBeLessThanOrEqual(12);
  const centre = button.y + button.height / 2;
  expect(centre).toBeGreaterThanOrEqual(last.top);
  expect(centre).toBeLessThanOrEqual(last.bottom);
});

test('a wrapped table footer note does not end on a word alone at 320px', async ({ page }) => {
  await signIn(page, 320);
  await page.goto(viewPath('repo-docs-open-issues'));
  const note = page.getByText('Sorted by Created (descending); its column is hidden.', {
    exact: true,
  });
  await expect(note).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  const lines = await note.evaluate((paragraph) => {
    const text = paragraph.firstChild as Text;
    const range = document.createRange();
    const top = (at: number) => {
      range.setStart(text, at);
      range.setEnd(text, at + 1);
      return range.getBoundingClientRect().top;
    };
    const words = [...text.data.matchAll(/\S+/g)];
    const [previous, last] = words.slice(-2);
    return {
      first: top(0),
      previous: top(previous.index + previous[0].length - 1),
      last: top(last.index),
    };
  });
  // The note wraps at this width; its last line holds more than its last word.
  expect(lines.last).toBeGreaterThan(lines.first + 1);
  expect(Math.abs(lines.last - lines.previous)).toBeLessThan(1);
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
  // On phones a toolbar whose one group holds only its reset still opens with the status sentence
  // beside the reset, not with a row that holds the reset alone.
  for (const width of [390, 320]) {
    const at = `${width}px`;
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(authorRecords);
    await page.evaluate(() => document.fonts.ready);
    const toolbar = page.getByRole('region', { name: 'Selected repository scope', exact: true });
    const card = (await toolbar.boundingBox())!;
    const only = (await toolbar
      .getByRole('button', { name: 'Reset view', exact: true })
      .boundingBox())!;
    const sentence = toolbar.getByText('Preferences saved for your account on this browser.', {
      exact: true,
    });
    // The sentence wraps here, so the reset sits beside its lines rather than its first one.
    const text = (await sentence.boundingBox())!;
    const middle = only.y + only.height / 2;
    expect(middle, at).toBeGreaterThanOrEqual(text.y);
    expect(middle, at).toBeLessThanOrEqual(text.y + text.height);
    // The sentence ends before the reset, and both stay inside the card.
    expect(text.x + text.width, at).toBeLessThanOrEqual(only.x + 0.5);
    expect(only.x + only.width, at).toBeLessThanOrEqual(card.x + card.width + 0.5);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      at,
    ).toBe(true);
  }
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
