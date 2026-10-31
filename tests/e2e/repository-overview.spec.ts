import { test, expect } from './fixtures';
import AxeBuilder from '@axe-core/playwright';

import type { Page } from '@playwright/test';

type DividerSample = {
  index: number;
  name: string;
  x: number;
  y: number;
  height: number;
  background: string;
  divider: string;
};

async function paintedFrame(page: Page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
  });
}

async function dividerContrasts(page: Page, png: Buffer, points: DividerSample[]) {
  return page.evaluate(
    async ({ base64, points }) => {
      const image = new Image();
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error('Could not decode divider screenshot'));
        image.src = 'data:image/png;base64,' + base64;
      });
      const canvas = document.createElement('canvas');
      canvas.width = image.width;
      canvas.height = image.height;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Missing screenshot canvas');
      context.drawImage(image, 0, 0);
      const rgb = (color: string) => (color.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
      return points.map((point) => {
        const background = rgb(point.background),
          divider = rgb(point.divider);
        const direction = divider.map((value, index) => value - background[index]);
        const magnitude = direction.reduce((sum, value) => sum + value * value, 0);
        if (!magnitude) throw new Error('Divider and background are indistinguishable');
        let contrast = 0;
        // Permit pixel rounding at fractional row boundaries, but require an actual line.
        for (let y = Math.floor(point.y) - 3; y <= Math.ceil(point.y) + 1; y++) {
          const pixel = context.getImageData(Math.floor(point.x), y, 1, 1).data;
          contrast = Math.max(
            contrast,
            direction.reduce(
              (sum, value, index) => sum + (pixel[index] - background[index]) * value,
              0,
            ) / magnitude,
          );
        }
        return { name: point.name, contrast };
      });
    },
    { base64: png.toString('base64'), points },
  );
}

test.describe('pinned row dividers', () => {
  test.use({ deviceScaleFactor: 1 });
  for (const theme of ['dark', 'light']) {
    for (const width of [856, 320]) {
      test(`remain visibly painted after sorting and scrolling (${theme}, ${width}px)`, async ({
        page,
      }, testInfo) => {
        await page.goto('/auth/login');
        await page.getByRole('button', { name: 'Sign in', exact: true }).click();
        await expect(page).toHaveURL(/\/repos$/);
        const backlog = page.getByRole('region', { name: 'Current backlog', exact: true });
        await backlog.getByRole('button', { name: 'Total PRs ↓', exact: true }).click();
        await backlog.getByRole('button', { name: 'Total PRs ↑', exact: true }).click();
        await page.getByRole('button', { name: 'Theme settings', exact: true }).click();
        await page
          .getByRole('menuitemradio', { name: theme === 'dark' ? 'Dark' : 'Light', exact: true })
          .click();
        await expect(page.locator('html')).toHaveClass(new RegExp(theme));
        await page.setViewportSize({ width, height: 1100 });
        let controlChecked = false;
        for (const scrollLeft of [0, 180]) {
          for (const title of ['Current backlog', 'Period activity']) {
            const area = page.getByRole('region', {
              name: title + ' table scroll area',
              exact: true,
            });
            const cells = area.locator('tbody tr:not(:last-child) [data-column="name"]');
            await expect(cells).toHaveCount(17);
            const checked = new Set<number>();
            while (checked.size < 17) {
              const next = Array.from({ length: 17 }, (_, index) => index).find(
                (index) => !checked.has(index),
              )!;
              await cells
                .nth(next)
                .evaluate((cell) =>
                  cell.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' }),
                );
              await area.evaluate((element, left) => {
                element.scrollLeft = left;
              }, scrollLeft);
              await page.mouse.move(0, 0);
              await paintedFrame(page);
              const samples = await cells.evaluateAll((elements) => {
                const top = Math.max(
                  8,
                  document.querySelector('header')?.getBoundingClientRect().bottom ?? 0,
                );
                return elements
                  .map((cell, index) => {
                    const box = cell.getBoundingClientRect(),
                      style = getComputedStyle(cell);
                    return {
                      index,
                      name: cell.textContent?.trim() ?? '',
                      x: box.left + 6,
                      y: box.bottom,
                      top: box.top,
                      height: box.height,
                      background: style.backgroundColor,
                      divider: style.borderRightColor,
                    };
                  })
                  .filter((sample) => sample.top >= top && sample.y <= window.innerHeight - 8);
              });
              expect(samples.map((sample) => sample.index)).toContain(next);
              for (const sample of samples)
                expect(sample.height, sample.name).toBeCloseTo(Math.round(sample.height), 5);
              const name =
                (title === 'Current backlog' ? 'backlog' : 'activity') +
                '-' +
                scrollLeft +
                '-' +
                next;
              // Full-page capture can omit offscreen sticky layers. Check the pixels a user can see,
              // without resizing the viewport, and visit every row before completing the case.
              const png = await page.screenshot({
                path: testInfo.outputPath('dividers-' + name + '.png'),
                scale: 'css',
              });
              for (const result of await dividerContrasts(page, png, samples))
                expect(result.contrast, result.name).toBeGreaterThan(0.4);
              if (theme === 'dark' && width === 856 && !controlChecked) {
                const hidden = await page.addStyleTag({
                  content:
                    'tbody [data-column="name"] { border-bottom-color: transparent !important; }',
                });
                try {
                  await paintedFrame(page);
                  const absent = await page.screenshot({
                    path: testInfo.outputPath('negative-control-hidden-dividers.png'),
                    scale: 'css',
                  });
                  for (const result of await dividerContrasts(page, absent, samples))
                    expect(result.contrast, 'hidden ' + result.name).toBeLessThan(0.4);
                } finally {
                  await hidden.evaluate((element) => {
                    element.parentNode?.removeChild(element);
                  });
                }
                await paintedFrame(page);
                const restored = await page.screenshot({
                  path: testInfo.outputPath('negative-control-restored-dividers.png'),
                  scale: 'css',
                });
                for (const result of await dividerContrasts(page, restored, samples))
                  expect(result.contrast, 'restored ' + result.name).toBeGreaterThan(0.4);
                controlChecked = true;
              }
              for (const sample of samples) checked.add(sample.index);
            }
            expect(checked.size).toBe(17);
            expect(await area.evaluate((element) => element.scrollLeft)).toBe(scrollLeft);
          }
        }
      });
    }
  }
});

// Isolate each viewport so its full assertions and axe scan share only that scenario's budget.
for (const theme of ['dark', 'light']) {
  for (const width of [1440, 1280, 768, 320]) {
    test(`overview preserves readable tables and pinned identities (${theme}, ${width}px)`, async ({
      page,
    }, testInfo) => {
      await page.goto('/auth/login');
      await page.getByRole('button', { name: 'Sign in', exact: true }).click();
      await expect(page).toHaveURL(/\/repos$/);
      await page.reload();
      await expect(
        page.getByRole('heading', { name: 'All repositories', exact: true }),
      ).toBeVisible();
      await page.getByRole('button', { name: 'Theme settings', exact: true }).click();
      await page
        .getByRole('menuitemradio', { name: theme === 'dark' ? 'Dark' : 'Light', exact: true })
        .click();
      await expect(page.locator('html')).toHaveClass(new RegExp(theme));
      await page.setViewportSize({ width, height: 960 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        width,
      );
      for (const title of ['Current backlog', 'Period activity']) {
        const table = page.getByRole('table', { name: title, exact: true });
        await expect(table.locator('tbody tr')).toHaveCount(18);
        const scroller = page.getByRole('region', {
          name: title + ' table scroll area',
          exact: true,
        });
        const pinned = table.locator('tbody [data-column="name"]').first();
        await scroller.evaluate((element) => {
          element.scrollLeft = 0;
        });
        const before = await pinned.boundingBox();
        await scroller.evaluate((element) => {
          element.scrollLeft = 200;
        });
        const after = await pinned.boundingBox();
        if (width <= 768)
          expect(await scroller.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
        expect(before).not.toBeNull();
        expect(after!.x).toBeCloseTo(before!.x, 0);
        await expect(pinned).toHaveCSS('position', 'sticky');
        await scroller.evaluate((element) => {
          element.scrollLeft = 0;
        });
      }
      expect((await new AxeBuilder({ page }).include('main').analyze()).violations).toEqual([]);
      await page.screenshot({
        path: testInfo.outputPath('overview-' + theme + '-' + width + '.png'),
        fullPage: true,
      });
    });
  }
}

test('keyboard column groups and sorting stay scoped to their table', async ({ page }) => {
  await page.goto('/auth/login');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  const backlog = page.getByRole('region', { name: 'Current backlog', exact: true });
  const activity = page.getByRole('region', { name: 'Period activity', exact: true });
  const trigger = backlog.getByRole('button', { name: 'Columns', exact: true });
  await expect(trigger).toBeEnabled();
  await trigger.focus();
  await expect(trigger).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('menu')).toBeVisible();
  await expect(
    page.getByRole('menuitemcheckbox', { name: 'Repository (required)', exact: true }),
  ).toHaveAttribute('aria-disabled', 'true');
  const group = page.getByRole('menuitemcheckbox', { name: 'Human reviewers', exact: true });
  await group.focus();
  await page.keyboard.press('Space');
  await expect(group).toHaveAttribute('aria-checked', 'true');
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();
  await expect(
    backlog.getByRole('columnheader', { name: 'Human reviewers', exact: true }),
  ).toHaveAttribute('colspan', '4');
  await expect(
    activity.getByRole('columnheader', { name: 'Human reviewers', exact: true }),
  ).toHaveCount(0);
  await backlog.getByRole('button', { name: 'Total PRs ↓', exact: true }).click();
  await expect(page).toHaveURL(/backlog.sort=totalOpenPrs/);
  await activity.getByRole('button', { name: 'PRs', exact: true }).click();
  await expect(page).toHaveURL(/activity.sort=prAuthors/);
  await expect(
    backlog.getByRole('columnheader', { name: 'Total PRs ↑', exact: true }),
  ).toHaveAttribute('aria-sort', 'ascending');
  await expect(activity.getByRole('columnheader', { name: 'PRs ↑', exact: true })).toHaveAttribute(
    'aria-sort',
    'ascending',
  );
});

test('repository story renders independently with two periods and empty states', async ({
  page,
}) => {
  await page.goto(
    'http://127.0.0.1:6007/iframe.html?id=repositories-all-repositories--two-periods&viewMode=story',
  );
  await expect(page.getByRole('table', { name: 'Period activity', exact: true })).toBeVisible();
  const js = page
    .getByRole('table', { name: 'Period activity', exact: true })
    .getByRole('row')
    .filter({ hasText: 'Prebid.js' });
  await expect(js).toHaveCount(3);
  await expect(js.nth(0).locator('[data-column="prsOpened"]')).toHaveText('78');
  await expect(js.nth(1).locator('[data-column="prsOpened"]')).toHaveText('92');
  await expect(js.nth(2).locator('[data-column="prsOpened"]')).toHaveText('-14');
  await page.goto(
    'http://127.0.0.1:6007/iframe.html?id=repositories-all-repositories--empty&viewMode=story',
  );
  await expect(
    page.getByRole('heading', { name: 'No repositories selected', exact: true }),
  ).toBeVisible();
});
