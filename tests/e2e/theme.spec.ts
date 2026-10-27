import { test, expect } from './fixtures';
import AxeBuilder from '@axe-core/playwright';
import { observeBrowserErrors } from '../support/browser-errors';

test('dark is the default and explicit system or light choices survive reloads', async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/auth/login');
  const root = page.locator('html');
  await expect(root).toHaveClass(/dark/);
  await expect(page.locator('main')).toHaveCSS('background-color', 'rgb(13, 22, 31)');
  const control = page.getByRole('button', { name: 'Theme settings', exact: true });
  await control.click();
  await expect(page.locator('main')).not.toHaveAttribute('aria-hidden', 'true');
  await expect(page.getByRole('menuitemradio', { name: 'Dark', exact: true })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.getByRole('menuitemradio', { name: 'System', exact: true }).click();
  await expect(root).toHaveClass(/light/);
  expect(await page.evaluate(() => localStorage.getItem('dashboard-theme'))).toBe('system');
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(root).toHaveClass(/dark/);
  await control.click();
  await page.getByRole('menuitemradio', { name: 'Light', exact: true }).click();
  await expect(page.getByRole('menu')).toHaveCount(0);
  await expect(root).toHaveClass(/light/);
  await page.reload();
  await expect(root).toHaveClass(/light/);
  await page.emulateMedia({ colorScheme: 'light' });
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(root).toHaveClass(/light/);
  await control.click();
  await expect(page.getByRole('menuitemradio', { name: 'Light', exact: true })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await page.getByRole('menuitemradio', { name: 'System', exact: true }).click();
  await expect(page.getByRole('menu')).toHaveCount(0);
  await expect(control).toBeFocused();
  await expect(root).toHaveClass(/dark/);
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(root).toHaveClass(/light/);
  await expect(page.locator('main')).toHaveCSS('background-color', 'rgb(246, 248, 250)');

  // The native menu supports keyboard selection and restores focus to the trigger.
  await control.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('menuitemradio', { name: 'System', exact: true })).toBeFocused();
  await page.keyboard.press('End');
  await expect(page.getByRole('menuitemradio', { name: 'Dark', exact: true })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(root).toHaveClass(/dark/);
  await expect(control).toBeFocused();
});

test('restores the existing dashboard-theme preference on the login page', async ({ page }) => {
  await page.goto('/auth/login');
  await page.evaluate(() => localStorage.setItem('dashboard-theme', 'light'));
  await page.reload();
  await expect(page.locator('html')).toHaveClass(/light/);
  await page.getByRole('button', { name: 'Theme settings', exact: true }).click();
  await expect(page.getByRole('menuitemradio', { name: 'Light', exact: true })).toHaveAttribute(
    'aria-checked',
    'true',
  );
});

test('one preference carries across login, dashboard, other tabs and sign-out', async ({
  page,
  context,
}) => {
  await page.goto('/auth/login');
  await page.getByRole('button', { name: 'Theme settings', exact: true }).click();
  await page.getByRole('menuitemradio', { name: 'Dark', exact: true }).click();
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/repos$/);
  await expect(page.locator('html')).toHaveClass(/dark/);
  await page.getByRole('button', { name: 'Theme settings', exact: true }).click();
  await expect(page.getByRole('menuitemradio', { name: 'Dark', exact: true })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await page.getByRole('menuitemradio', { name: 'Light', exact: true }).click();
  const peer = await context.newPage();
  const errors = observeBrowserErrors(peer);
  try {
    await peer.goto('/auth/login');
    await expect(peer.locator('html')).toHaveClass(/light/);
    await peer.getByRole('button', { name: 'Theme settings', exact: true }).click();
    await peer.getByRole('menuitemradio', { name: 'Dark', exact: true }).click();
    await expect(page.locator('html')).toHaveClass(/dark/);
    errors.assertClean();
  } finally {
    errors.dispose();
    await peer.close();
  }
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page).toHaveURL(/\/auth\/login$/);
  await expect(page.locator('html')).toHaveClass(/dark/);
});

test('the catalog allows explicit choices without resetting them to its initial theme', async ({
  page,
}) => {
  await page.goto(
    'http://127.0.0.1:6007/iframe.html?id=authentication-pages--sign-in&viewMode=story&globals=theme:dark',
  );
  await expect(page.locator('html')).toHaveClass(/dark/);
  const control = page.getByRole('button', { name: 'Theme settings', exact: true });
  await control.click();
  await page.getByRole('menuitemradio', { name: 'Light', exact: true }).click();
  await expect(page.getByRole('menu')).toHaveCount(0);
  await expect(page.locator('html')).toHaveClass(/light/);
  await control.click();
  await expect(page.getByRole('menuitemradio', { name: 'Light', exact: true })).toHaveAttribute(
    'aria-checked',
    'true',
  );
});

test('authentication feedback remains readable in both themes', async ({ page }) => {
  for (const theme of ['light', 'dark']) {
    await page.goto(
      `http://127.0.0.1:6007/iframe.html?id=authentication-pages--password-changed&viewMode=story&globals=theme:${theme}`,
    );
    await expect(page.locator('html')).toHaveClass(new RegExp(theme));
    await expect(page.getByRole('status')).toContainText('Password changed.');
    expect((await new AxeBuilder({ page }).include('main').analyze()).violations).toEqual([]);
    await page.goto(
      `http://127.0.0.1:6007/iframe.html?id=authentication-pages--temporary-password&viewMode=story&globals=theme:${theme}`,
    );
    await expect(page.locator('html')).toHaveClass(new RegExp(theme));
    await page.getByLabel('Temporary Password', { exact: true }).fill('temporary');
    await page.getByLabel('New Password', { exact: true }).fill('simple');
    await page.getByLabel('Confirm New Password', { exact: true }).fill('different');
    await page.getByRole('button', { name: 'Set password and continue' }).click();
    await expect(page.getByRole('alert')).toHaveText('New passwords do not match');
    expect((await new AxeBuilder({ page }).include('main').analyze()).violations).toEqual([]);
  }
});
