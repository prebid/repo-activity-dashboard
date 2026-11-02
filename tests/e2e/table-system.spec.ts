import { test, expect, expectTheme } from './fixtures';
import type { Locator, Page } from '@playwright/test';

// The shared table: one header implementation, its sticky header row inside a bounded scroll area,
// the pinned column and its edge shadows, sort glyph placement, number alignment and the one
// drillable-number style.

async function login(page: Page) {
  await page.goto('/auth/login');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/repos$/);
}
async function chooseTheme(page: Page, theme: 'light' | 'dark') {
  await page.getByRole('button', { name: 'Theme settings', exact: true }).click();
  await page
    .getByRole('menuitemradio', { name: theme === 'dark' ? 'Dark' : 'Light', exact: true })
    .click();
  await expectTheme(page, theme);
  await page.mouse.move(0, 0);
}
/** The table's own scroll area, which is the sticky reference for its header row. */
function scrollArea(page: Page) {
  return page.getByRole('region', { name: /table scroll area$/ });
}
/** The right edge of the first visible text node in an element that holds digits. */
function digitsRight(cell: Locator) {
  return cell.evaluate((element) => {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      // Screen-reader-only text is clipped to a 1px box.
      const shown = (node.parentElement?.getBoundingClientRect().width ?? 0) > 1;
      if (!/\d/.test(node.textContent ?? '') || !shown) continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      return range.getBoundingClientRect().right;
    }
    return null;
  });
}

for (const [theme, width] of [
  ['dark', 1440],
  ['light', 375],
] as const)
  test(`a 50-row table keeps its header row and pinned column in view (${theme}, ${width}px)`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await login(page);
    await chooseTheme(page, theme);
    await page.goto('/repos/prebidjs');
    const area = scrollArea(page);
    await expect(area).toHaveCount(1);
    const rows = area.locator('tbody tr');
    await expect(rows).toHaveCount(50);
    // The bounded area fits the viewport and scrolls its rows under the header row.
    await area.evaluate((element) => {
      element.scrollIntoView({ block: 'start' });
      element.scrollTop = 1000;
    });
    await expect.poll(() => area.evaluate((element) => element.scrollTop)).toBeGreaterThan(400);
    expect((await area.boundingBox())!.height).toBeLessThanOrEqual(900);
    const layout = await area.evaluate((element) => {
      const top = element.getBoundingClientRect().top;
      const headers = [...element.querySelectorAll('thead th')].map((th) => {
        const box = th.getBoundingClientRect();
        const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
        return { offset: box.top - top, covered: !th.contains(hit) };
      });
      const thead = element.querySelector('thead')!.getBoundingClientRect();
      const visible = [...element.querySelectorAll('tbody tr')]
        .map((row) => row.getBoundingClientRect())
        .find((box) => box.bottom > thead.bottom)!;
      return { headers, theadBottom: thead.bottom, firstRowBottom: visible.bottom, top };
    });
    for (const header of layout.headers) {
      expect(Math.abs(header.offset)).toBeLessThanOrEqual(1);
      expect(header.covered).toBe(false);
    }
    expect(layout.firstRowBottom).toBeGreaterThan(layout.theadBottom);
    // The pinned header and the pinned cells stay put at both horizontal ends.
    const pinnedHeader = area.locator('thead th').first();
    const pinnedCell = rows.nth(30).locator('td').first();
    const positions: { header: number; cell: number; headerTop: number }[] = [];
    for (const end of ['start', 'end'] as const) {
      await area.evaluate((element, side) => {
        element.scrollLeft = side === 'start' ? 0 : element.scrollWidth;
      }, end);
      const header = (await pinnedHeader.boundingBox())!;
      positions.push({
        header: header.x,
        cell: (await pinnedCell.boundingBox())!.x,
        headerTop: header.y - layout.top,
      });
    }
    expect(Math.abs(positions[0].header - positions[1].header)).toBeLessThanOrEqual(1);
    expect(Math.abs(positions[0].cell - positions[1].cell)).toBeLessThanOrEqual(1);
    for (const position of positions) expect(Math.abs(position.headerTop)).toBeLessThanOrEqual(1);
    // While columns remain to the right the trailing edge casts its shadow; at the end it does not.
    const trailing = () =>
      area.evaluate((element) => getComputedStyle(element.parentElement!, '::after').visibility);
    const overflows = await area.evaluate((element) => element.scrollWidth > element.clientWidth);
    await area.evaluate((element) => {
      element.scrollLeft = 0;
    });
    await expect.poll(trailing).toBe(overflows ? 'visible' : 'hidden');
    await area.evaluate((element) => {
      element.scrollLeft = element.scrollWidth;
    });
    await expect.poll(trailing).toBe('hidden');
  });

test('sort glyphs keep the label in place, and the sorted header changes ink as well as rule', async ({
  page,
}) => {
  await login(page);
  await page.mouse.move(0, 0);
  const backlog = page.getByRole('table', { name: 'Current backlog', exact: true });
  for (const [name, idle] of [
    ['Total PRs', 'descending'],
    ['Repository', 'none'],
  ] as const) {
    const header = backlog.getByRole('columnheader', { name, exact: true });
    const label = header
      .getByRole('button', { name, exact: true })
      .getByText(name, { exact: true });
    await expect(header).toHaveAttribute('aria-sort', idle);
    const before = (await label.boundingBox())!;
    await header.getByRole('button', { name, exact: true }).click();
    await expect(header).toHaveAttribute('aria-sort', 'ascending');
    await page.mouse.move(0, 0);
    const after = (await label.boundingBox())!;
    expect(Math.abs(after.x - before.x)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(after.width - before.width)).toBeLessThanOrEqual(0.5);
  }
  const style = (header: Locator) =>
    header.evaluate((th) => ({
      shadow: getComputedStyle(th).boxShadow,
      ink: getComputedStyle(th.querySelector('button')!).color,
    }));
  const sorted = await style(
    backlog.getByRole('columnheader', { name: 'Repository', exact: true }),
  );
  const idle = await style(backlog.getByRole('columnheader', { name: 'Total PRs', exact: true }));
  // The orange rule is 1.59:1 on the Light band, so the sorted label's ink changes too.
  expect(sorted.shadow).toContain('rgb(255, 173, 50)');
  expect(idle.shadow).toBe('none');
  expect(sorted.ink).not.toBe(idle.ink);
});

test('a wrapped header keeps its sort glyph beside its words', async ({ page }) => {
  await login(page);
  const wrapped: { name: string; numeric: boolean; gap: number | null }[] = [];
  // Account type's fixed 110px column wraps at 1440; the 126px metric columns wrap at 390.
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/contributors');
    const buttons = page.getByRole('table').first().locator('thead th button');
    await expect(buttons.first()).toBeVisible();
    const headers = await buttons.evaluateAll((elements) =>
      elements.map((button) => {
        const glyph = button.querySelector('svg')!.getBoundingClientRect();
        const words: DOMRect[] = [];
        const walker = document.createTreeWalker(button, NodeFilter.SHOW_TEXT);
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
          const range = document.createRange();
          range.selectNodeContents(node);
          words.push(...[...range.getClientRects()].filter((rect) => rect.width > 0));
        }
        const tops = words.map((rect) => rect.top).sort((a, b) => a - b);
        const lines = tops.filter((top, index) => index === 0 || top - tops[index - 1] > 8).length;
        const numeric = getComputedStyle(button).textAlign === 'right';
        // The text on the glyph's own line, on the side the glyph faces.
        const beside = words.filter(
          (rect) =>
            rect.top < glyph.bottom &&
            rect.bottom > glyph.top &&
            (numeric ? rect.left >= glyph.left : rect.right <= glyph.right),
        );
        const gaps = beside.map((rect) =>
          numeric ? rect.left - glyph.right : glyph.left - rect.right,
        );
        return {
          name: button.textContent ?? '',
          numeric,
          lines,
          gap: gaps.length ? Math.min(...gaps) : null,
        };
      }),
    );
    wrapped.push(...headers.filter((header) => header.lines > 1));
  }
  expect(wrapped.some((header) => header.numeric)).toBe(true);
  expect(wrapped.some((header) => !header.numeric)).toBe(true);
  for (const header of wrapped) {
    expect(header.gap, header.name).not.toBeNull();
    expect(header.gap!, header.name).toBeGreaterThanOrEqual(0);
    expect(header.gap!, header.name).toBeLessThanOrEqual(8);
  }
});

test('one line at the pinned junction and right-aligned digits beside their header', async ({
  page,
}) => {
  await login(page);
  const backlog = page.getByRole('table', { name: 'Current backlog', exact: true });
  const pinned = backlog.getByRole('columnheader', { name: 'Repository', exact: true });
  await expect(pinned).toHaveCSS('border-right-width', '2px');
  // The first group heading and the first cell after the pinned column draw no second line.
  await expect(backlog.locator('thead th[scope="colgroup"]').first()).toHaveCSS(
    'border-left-width',
    '0px',
  );
  await expect(backlog.locator('tbody tr').first().locator('td').nth(1)).toHaveCSS(
    'border-left-width',
    '0px',
  );
  const cells = backlog.locator('tbody td[data-column="totalOpenPrs"]');
  const edges: number[] = [];
  for (let index = 0; index < (await cells.count()); index++) {
    const right = await digitsRight(cells.nth(index));
    if (right !== null) edges.push(right);
  }
  expect(edges.length).toBeGreaterThan(10);
  for (const edge of edges) expect(Math.abs(edge - edges[0])).toBeLessThanOrEqual(0.5);
  const header = backlog
    .getByRole('columnheader', { name: 'Total PRs', exact: true })
    .getByText('Total PRs', { exact: true });
  const label = (await header.boundingBox())!;
  expect(Math.abs(label.x + label.width - edges[0])).toBeLessThanOrEqual(1);
});

test('the sticky-header story keeps both header rows in view and hangs partial marks past the digits', async ({
  page,
}) => {
  await page.goto(
    'http://127.0.0.1:6007/iframe.html?id=tables-sticky-header--grouped-headings&viewMode=story',
  );
  const table = page.getByRole('table', { name: 'Sample accounts', exact: true });
  await expect(table.locator('tbody tr')).toHaveCount(50);
  await expect(table.getByRole('columnheader', { name: 'Authoring', exact: true })).toHaveAttribute(
    'colspan',
    '2',
  );
  const area = scrollArea(page);
  await area.evaluate((element) => {
    element.scrollIntoView({ block: 'start' });
    element.scrollTop = 900;
  });
  await expect.poll(() => area.evaluate((element) => element.scrollTop)).toBeGreaterThan(400);
  const offsets = await area.evaluate((element) => {
    const top = element.getBoundingClientRect().top;
    const rows = element.querySelectorAll('thead tr');
    const group = rows[0].querySelector('[scope="colgroup"]')!.getBoundingClientRect();
    return {
      group: group.top - top,
      groupBottom: group.bottom - top,
      metric: rows[1].querySelector('th')!.getBoundingClientRect().top - top,
    };
  });
  expect(Math.abs(offsets.group)).toBeLessThanOrEqual(1);
  // The metric labels stick directly beneath the group heading row.
  expect(Math.abs(offsets.metric - offsets.groupBottom)).toBeLessThanOrEqual(1);
  const authored = table.locator('tbody td[data-column="authored"]');
  const rights: number[] = [];
  for (let index = 0; index < 12; index++) rights.push((await digitsRight(authored.nth(index)))!);
  for (const right of rights) expect(Math.abs(right - rights[0])).toBeLessThanOrEqual(0.5);
  const partial = authored.filter({ has: page.locator('sup') }).first();
  const mark = (await partial.locator('sup').boundingBox())!;
  expect(mark.x).toBeGreaterThanOrEqual((await digitsRight(partial))! - 0.5);
});

test('drillable numbers share one style on Summary, Timeline and Contributions', async ({
  page,
}) => {
  await login(page);
  const links: [string, string, (page: Page) => Locator][] = [
    [
      'Summary',
      '/repos',
      (page) =>
        page
          .getByRole('table', { name: 'Current backlog', exact: true })
          .locator('tbody td[data-column="totalOpenPrs"] a')
          .first(),
    ],
    [
      'Timeline',
      '/repos?timeline=1',
      (page) =>
        page
          .getByRole('table')
          .first()
          .locator('tbody td:not([data-column="repository"]) a')
          .first(),
    ],
    [
      'Contributions',
      '/contributors',
      (page) =>
        page.getByRole('table').first().locator('tbody td[data-column="prsAuthored"] a').first(),
    ],
  ];
  const styles: Record<string, string>[] = [];
  for (const [view, path, find] of links) {
    await page.goto(path);
    const link = find(page);
    await expect(link, view).toBeVisible();
    await page.mouse.move(0, 0);
    const rest = await link.evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        color: style.color,
        line: style.textDecorationLine,
        style: style.textDecorationStyle,
        decoration: style.textDecorationColor,
      };
    });
    await link.hover();
    const hover = await link.evaluate((element) => getComputedStyle(element).color);
    styles.push({ view, ...rest, hover });
  }
  for (const entry of styles.slice(1))
    expect({ ...entry, view: styles[0].view }, entry.view).toEqual(styles[0]);
  expect(styles[0].style).toBe('dotted');
  expect(styles[0].hover).not.toBe(styles[0].color);
});

test('a record row keeps its number level with the title and the author icon beside the name', async ({
  page,
}) => {
  await login(page);
  await page.goto('/repos/prebidjs');
  const row = scrollArea(page).locator('tbody tr').first();
  const tops = await row.evaluate((element) => {
    const first = (cell: Element | null) => {
      const range = document.createRange();
      range.selectNodeContents(cell!);
      return range.getClientRects()[0].top;
    };
    return {
      number: first(element.querySelector('[data-column="number"] a')),
      title: first(element.querySelector('[data-column="title"] a')),
    };
  });
  expect(Math.abs(tops.number - tops.title)).toBeLessThanOrEqual(2);
  const author = row.locator('[data-column="author"] a[target="_blank"]');
  const gap = await author.evaluate((link) => {
    const icon = link.querySelector('svg')!.getBoundingClientRect();
    const walker = document.createTreeWalker(link, NodeFilter.SHOW_TEXT);
    const range = document.createRange();
    range.selectNodeContents(walker.nextNode()!);
    const rects = range.getClientRects();
    const last = rects[rects.length - 1];
    return { left: icon.left - last.right };
  });
  expect(gap.left).toBeGreaterThanOrEqual(0);
  expect(gap.left).toBeLessThanOrEqual(8);
});
