import { test, expect } from './fixtures';
import AxeBuilder from '@axe-core/playwright';

test.describe('pinned row dividers', () => {
  test.use({ deviceScaleFactor: 1 });
  test('remain visibly painted after sorting and horizontal scrolling', async ({
    page,
  }, testInfo) => {
    await page.goto('/auth/login');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page).toHaveURL(/\/repos$/);
    const backlog = page.getByRole('region', { name: 'Current backlog', exact: true });
    await backlog.getByRole('button', { name: 'Total open PRs', exact: true }).click();
    await backlog.getByRole('button', { name: 'Total open PRs ↑', exact: true }).click();
    for (const theme of ['dark', 'light']) {
      await page.getByRole('button', { name: 'Theme settings', exact: true }).click();
      await page
        .getByRole('menuitemradio', { name: theme === 'dark' ? 'Dark' : 'Light', exact: true })
        .click();
      for (const width of [856, 320]) {
        await page.setViewportSize({ width, height: 1100 });
        for (const scrollLeft of [0, 180]) {
          for (const title of ['Current backlog', 'Period activity']) {
            await page
              .getByRole('region', { name: title + ' table scroll area', exact: true })
              .evaluate((element, left) => {
                element.scrollLeft = left;
              }, scrollLeft);
          }
          await page.mouse.move(0, 0);
          const samples = await page
            .locator('tbody tr:not(:last-child) [data-column="name"]')
            .evaluateAll((cells) =>
              cells.map((cell) => {
                const box = cell.getBoundingClientRect();
                const style = getComputedStyle(cell);
                return {
                  name: cell.textContent?.trim(),
                  x: box.left + window.scrollX + 6,
                  y: box.bottom + window.scrollY,
                  height: box.height,
                  background: style.backgroundColor,
                  divider: style.borderRightColor,
                };
              }),
            );
          expect(samples).toHaveLength(34);
          for (const sample of samples)
            expect(sample.height, sample.name).toBeCloseTo(Math.round(sample.height), 5);
          if (theme === 'dark' && width === 856 && scrollLeft === 0) {
            const sales = await backlog
              .getByRole('link', { name: 'SalesAgent', exact: true })
              .locator('..')
              .boundingBox();
            if (!sales) throw new Error('Missing SalesAgent cell');
            await page.screenshot({
              path: testInfo.outputPath('salesagent-dividers.png'),
              scale: 'css',
              clip: {
                x: sales.x,
                y: sales.y - sales.height,
                width: 520,
                height: sales.height * 3,
              },
            });
          }
          // Computed borders alone missed this bug: inspect the pixels that were actually painted.
          const png = await page.screenshot({ fullPage: true, scale: 'css' });
          const contrasts = await page.evaluate(
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
            { base64: png.toString('base64'), points: samples },
          );
          for (const result of contrasts)
            expect(result.contrast, theme + ' ' + width + 'px ' + result.name).toBeGreaterThan(0.4);
        }
        await page.screenshot({
          path: testInfo.outputPath('dividers-' + theme + '-' + width + '.png'),
          fullPage: true,
        });
      }
    }
  });
});

test('overview preview preserves readable tables, themes and pinned identities at every viewport', async ({
  page,
}, testInfo) => {
  await page.goto('/auth/login');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/repos$/);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'All repositories', exact: true })).toBeVisible();
  for (const theme of ['dark', 'light']) {
    await page.getByRole('button', { name: 'Theme settings', exact: true }).click();
    await page
      .getByRole('menuitemradio', { name: theme === 'dark' ? 'Dark' : 'Light', exact: true })
      .click();
    await expect(page.locator('html')).toHaveClass(new RegExp(theme));
    for (const width of [1440, 1280, 768, 320]) {
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
    }
  }
});

test('keyboard column groups and sorting stay scoped to their table', async ({ page }) => {
  await page.goto('/auth/login');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  const backlog = page.getByRole('region', { name: 'Current backlog', exact: true });
  const activity = page.getByRole('region', { name: 'Period activity', exact: true });
  const trigger = backlog.getByRole('button', { name: 'Columns', exact: true });
  await trigger.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('menu')).toBeVisible();
  await expect(
    page.getByRole('menuitemcheckbox', { name: 'Repository', exact: true }),
  ).toHaveAttribute('aria-disabled', 'true');
  const group = page.getByRole('menuitemcheckbox', { name: 'Human feedback', exact: true });
  await group.focus();
  await page.keyboard.press('Space');
  await expect(group).toHaveAttribute('aria-checked', 'true');
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();
  await expect(
    backlog.getByRole('columnheader', { name: 'Human feedback', exact: true }),
  ).toHaveAttribute('colspan', '4');
  await expect(
    activity.getByRole('columnheader', { name: 'Human feedback', exact: true }),
  ).toHaveCount(0);
  await backlog.getByRole('button', { name: 'Total open PRs', exact: true }).click();
  await expect(page).toHaveURL(/backlog.sort=totalOpenPrs/);
  await activity.getByRole('button', { name: 'PR authors', exact: true }).click();
  await expect(page).toHaveURL(/activity.sort=prAuthors/);
  await expect(
    backlog.getByRole('columnheader', { name: 'Total open PRs ↑', exact: true }),
  ).toHaveAttribute('aria-sort', 'ascending');
  await expect(
    activity.getByRole('columnheader', { name: 'PR authors ↑', exact: true }),
  ).toHaveAttribute('aria-sort', 'ascending');
});

test('repository story renders independently with comparison values and empty states', async ({
  page,
}) => {
  await page.goto(
    'http://127.0.0.1:6007/iframe.html?id=repositories-all-repositories--with-changes&viewMode=story',
  );
  await expect(page.getByRole('table', { name: 'Period activity', exact: true })).toBeVisible();
  const js = page
    .getByRole('table', { name: 'Period activity', exact: true })
    .getByRole('row')
    .filter({ has: page.getByRole('link', { name: 'Prebid.js', exact: true }) });
  await expect(js.locator('[data-column="prsOpened"]')).toContainText('+3');
  await page.goto(
    'http://127.0.0.1:6007/iframe.html?id=repositories-all-repositories--empty&viewMode=story',
  );
  await expect(
    page.getByRole('heading', { name: 'No repositories selected', exact: true }),
  ).toBeVisible();
});
