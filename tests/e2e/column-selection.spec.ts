import { test, expect } from './fixtures';
import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
async function login(page: Page) {
  await page.goto('/auth/login');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/repos$/);
}
test('opening the Columns menu does not resize or move its trigger', async ({ page }) => {
  await login(page);
  await page.setViewportSize({ width: 640, height: 480 });
  await page.goto('/repos');
  const trigger = page.getByRole('button', { name: 'Columns', exact: true }).first();
  await trigger.scrollIntoViewIfNeeded();
  const closed = await trigger.boundingBox();
  await trigger.click();
  await expect(page.getByRole('menu', { name: 'Columns', exact: true })).toBeVisible();
  const open = await trigger.boundingBox();
  expect(open).toEqual(closed);
});

const metricGroups = [
  'Identity',
  'Pull requests',
  'Reviews, approvals and merges',
  'Issues',
  'Comment activity',
];
test('column and CSV sections share groups, partial states and file/line bulk selection', async ({
  page,
}, info) => {
  await login(page);
  await page.goto('/contributors');
  await page.getByRole('button', { name: 'Columns · Contributor', exact: true }).click();
  // The menu takes the trigger's name, which follows the set the visible columns show.
  const menu = page.getByRole('menu', { name: /^Columns · / });
  await expect(menu.getByRole('group').first()).toHaveAccessibleName('Column set');
  await expect(
    menu
      .getByRole('group', { name: 'Column set', exact: true })
      .getByRole('menuitemradio', { name: 'Contributor', exact: true }),
  ).toHaveAttribute('aria-checked', 'true');
  for (const name of metricGroups)
    await expect(menu.getByRole('group', { name, exact: true })).toBeVisible();
  await expect(menu).toHaveCSS('opacity', '1');
  await page.screenshot({ path: info.outputPath('column-menu-groups-initial.png') });
  const authored = menu.getByRole('group', { name: 'Authored merged PR volume', exact: true });
  await authored.getByRole('menuitemcheckbox', { name: 'Files', exact: true }).click();
  await expect(
    authored.getByRole('menuitemcheckbox', { name: 'Authored merged PR volume', exact: true }),
  ).toHaveAttribute('aria-checked', 'mixed');
  await expect(
    authored.getByRole('menuitemcheckbox', { name: 'Files changed', exact: true }),
  ).toHaveAttribute('aria-checked', 'true');
  await expect(
    authored.getByRole('menuitemcheckbox', { name: 'Lines added', exact: true }),
  ).toHaveAttribute('aria-checked', 'false');
  expect(
    await authored
      .getByRole('menuitemcheckbox', { name: 'Files changed', exact: true })
      .evaluate((element) => getComputedStyle(element).borderBottomWidth),
  ).toBe('1px');
  await expect(menu).toHaveCSS('opacity', '1');
  expect((await new AxeBuilder({ page }).include('[role="menu"]').analyze()).violations).toEqual(
    [],
  );
  await page.screenshot({ path: info.outputPath('column-menu-grouped-desktop.png') });
  await expect(
    menu.getByRole('menuitemradio', { name: 'Contributor', exact: true }),
  ).toHaveAttribute('aria-checked', 'false');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Columns · Custom', exact: true })).toBeFocused();
  const headers = await page.getByRole('table').locator('thead tr:last-child th').allTextContents();
  expect(headers.join(' ')).toContain('Files changed');
  expect(headers.join(' ')).not.toContain('Lines added');
  await page.getByRole('button', { name: 'Export CSV', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Contributors CSV export', exact: true });
  for (const name of ['Column set', ...metricGroups])
    await expect(dialog.getByRole('group', { name, exact: true })).toBeVisible();
  // The draft starts from the visible columns, which no set shows; the All columns set replaces
  // the bulk action of that name.
  const sets = dialog.getByRole('group', { name: 'Column set', exact: true });
  await expect(sets.getByRole('radio')).toHaveCount(4);
  await expect(sets.getByRole('radio', { checked: true })).toHaveCount(0);
  await expect(dialog.getByRole('button', { name: 'All columns', exact: true })).toHaveCount(0);
  await expect(dialog).toHaveCSS('opacity', '1');
  await page.screenshot({ path: info.outputPath('csv-groups-initial.png') });
  const group = dialog.getByRole('group', { name: 'Authored merged PR volume', exact: true });
  await expect(
    group.getByRole('checkbox', { name: 'Authored merged PR volume', exact: true }),
  ).toHaveJSProperty('indeterminate', true);
  await group.getByRole('checkbox', { name: 'Lines', exact: true }).check();
  await expect(
    group.getByRole('checkbox', { name: 'Authored merged PR volume', exact: true }),
  ).toBeChecked();
  await expect(group.getByRole('checkbox', { name: 'Lines added', exact: true })).toBeChecked();
  expect(
    await group
      .getByRole('checkbox', { name: 'Files changed', exact: true })
      .evaluate((element) => getComputedStyle(element.closest('label')!).borderBottomWidth),
  ).toBe('1px');
  await expect(dialog).toHaveCSS('opacity', '1');
  expect((await new AxeBuilder({ page }).include('[role="dialog"]').analyze()).violations).toEqual(
    [],
  );
  await page.screenshot({ path: info.outputPath('csv-sections-desktop.png') });
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('table').locator('thead tr:last-child th')).toHaveText(headers);
  await page.getByRole('button', { name: 'Columns · Custom', exact: true }).click();
  await expect(
    authored.getByRole('menuitemcheckbox', { name: 'Lines added', exact: true }),
  ).toHaveAttribute('aria-checked', 'false');
});
test('small selectors retain separators, accessible controls and visible export actions on mobile', async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 375, height: 900 });
  await login(page);
  await page.goto('/contributors/account-alice?period=this-year');
  await page.getByRole('button', { name: 'Theme settings', exact: true }).click();
  await page.getByRole('menuitemradio', { name: 'Light', exact: true }).click();
  await page.getByRole('button', { name: /^Columns · / }).click();
  const menu = page.getByRole('menu', { name: /^Columns · / });
  await expect(menu).toHaveCSS('opacity', '1');
  await expect(menu.getByRole('group', { name: 'Column set', exact: true })).toBeVisible();
  // Widths are measured with the web fonts, not their fallback.
  await page.evaluate(() => document.fonts.ready);
  const bounds = await menu.boundingBox();
  expect(bounds!.width).toBeLessThanOrEqual(343);
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  await expect(
    menu.getByRole('menuitemcheckbox', { name: 'Repository (required)', exact: true }),
  ).toBeDisabled();
  expect((await new AxeBuilder({ page }).include('[role="menu"]').analyze()).violations).toEqual(
    [],
  );
  await page.screenshot({ path: info.outputPath('column-menu-grouped-mobile.png') });
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Export CSV', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'By repository CSV export', exact: true });
  await expect(dialog).toHaveCSS('opacity', '1');
  await expect(dialog.getByRole('button', { name: 'Download CSV', exact: true })).toBeInViewport();
  expect((await new AxeBuilder({ page }).include('[role="dialog"]').analyze()).violations).toEqual(
    [],
  );
  await page.screenshot({ path: info.outputPath('csv-sections-mobile.png') });
});
test('repository summary and record selectors adopt the same grouping components', async ({
  page,
}) => {
  await login(page);
  await page.goto('/repos');
  await page
    .getByRole('region', { name: 'Current backlog', exact: true })
    .getByRole('button', { name: 'Columns', exact: true })
    .click();
  let menu = page.getByRole('menu', { name: 'Columns', exact: true });
  await expect(menu.getByRole('group', { name: 'Identity', exact: true })).toBeVisible();
  await expect(menu.getByRole('group', { name: 'Pull requests', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.goto('/repos/prebidjs');
  await page.getByRole('button', { name: 'Columns', exact: true }).click();
  menu = page.getByRole('menu', { name: 'Columns', exact: true });
  await expect(menu.getByRole('group', { name: 'Identity', exact: true })).toBeVisible();
  await expect(menu.getByRole('group', { name: 'Dates and age', exact: true })).toBeVisible();
  await expect(menu.getByRole('group', { name: 'Human review', exact: true })).toBeVisible();
});
