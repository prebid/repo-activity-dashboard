import { test, expect } from './fixtures';
import AxeBuilder from '@axe-core/playwright';

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
  await expect(page.getByText('No items', { exact: true })).toHaveCount(2);
});
