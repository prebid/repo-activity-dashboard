import { test, expect } from './fixtures';
import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
async function login(page: Page) {
  await page.goto('/auth/login');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/repos$/);
}
test('column and CSV sections share groups, partial states and file/line bulk selection', async ({
  page,
}, info) => {
  await login(page);
  await page.goto('/contributors');
  await page.getByRole('button', { name: 'Columns', exact: true }).click();
  const menu = page.getByRole('menu', { name: 'Columns', exact: true });
  for (const name of [
    'Identity',
    'Pull requests',
    'Reviews and approvals',
    'Issues',
    'Comment activity',
  ])
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
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Columns', exact: true })).toBeFocused();
  const headers = await page.getByRole('table').locator('thead tr:last-child th').allTextContents();
  expect(headers.join(' ')).toContain('Files changed');
  expect(headers.join(' ')).not.toContain('Lines added');
  await page.getByRole('button', { name: 'Export CSV', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Contributors CSV export', exact: true });
  for (const name of [
    'Identity',
    'Pull requests',
    'Reviews and approvals',
    'Issues',
    'Comment activity',
  ])
    await expect(dialog.getByRole('group', { name, exact: true })).toBeVisible();
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
      .evaluate((element) => getComputedStyle(element.parentElement!).borderBottomWidth),
  ).toBe('1px');
  await expect(dialog).toHaveCSS('opacity', '1');
  expect((await new AxeBuilder({ page }).include('[role="dialog"]').analyze()).violations).toEqual(
    [],
  );
  await page.screenshot({ path: info.outputPath('csv-sections-desktop.png') });
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('table').locator('thead tr:last-child th')).toHaveText(headers);
  await page.getByRole('button', { name: 'Columns', exact: true }).click();
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
  await page.getByRole('button', { name: 'Columns', exact: true }).click();
  const menu = page.getByRole('menu', { name: 'Columns', exact: true });
  await expect(menu).toHaveCSS('opacity', '1');
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
