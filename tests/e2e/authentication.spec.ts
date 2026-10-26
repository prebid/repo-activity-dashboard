import { test, expect } from './fixtures';
import AxeBuilder from '@axe-core/playwright';

test('centered sign-in supports small screens, keyboard controls and onboarding help', async ({
  page,
}, testInfo) => {
  await page.goto(
    'http://127.0.0.1:6007/iframe.html?id=authentication-pages--sign-in&viewMode=story',
  );
  await expect(page.getByRole('heading', { name: 'Sign in', exact: true })).toBeVisible();
  for (const theme of ['light', 'dark']) {
    await page.goto(
      `http://127.0.0.1:6007/iframe.html?id=authentication-pages--sign-in&viewMode=story&globals=theme:${theme}`,
    );
    await expect(page.locator('html')).toHaveClass(new RegExp(theme));
    for (const width of [1280, 768, 320]) {
      await page.setViewportSize({ width, height: 900 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        width,
      );
      expect((await new AxeBuilder({ page }).include('main').analyze()).violations).toEqual([]);
      await page.screenshot({
        path: testInfo.outputPath(`sign-in-${theme}-${width}.png`),
        fullPage: true,
      });
    }
  }
  const password = page.getByLabel('Password', { exact: true });
  await password.fill('my workspace password');
  // Exercise keyboard activation independently of the browser's tab-navigation preferences.
  await page.getByRole('button', { name: 'Show password', exact: true }).focus();
  await expect(page.getByRole('button', { name: 'Show password', exact: true })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(password).toHaveAttribute('type', 'text');
  await page.getByRole('button', { name: 'Hide password', exact: true }).click();
  await expect(password).toHaveAttribute('type', 'password');
  await page.getByText('Signing in for the first time?', { exact: true }).click();
  await expect(page.getByText(/Use the email address and temporary password/)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
});

test('password setup is responsive with a simple length hint and distinct update controls', async ({
  page,
}, testInfo) => {
  await page.goto(
    'http://127.0.0.1:6007/iframe.html?id=authentication-pages--temporary-password&viewMode=story',
  );
  await expect(page.getByRole('heading', { name: 'Set Your Password' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Cancel', exact: true })).toHaveCount(0);
  for (const theme of ['light', 'dark']) {
    await page.goto(
      `http://127.0.0.1:6007/iframe.html?id=authentication-pages--temporary-password&viewMode=story&globals=theme:${theme}`,
    );
    await expect(page.locator('html')).toHaveClass(new RegExp(theme));
    for (const width of [1280, 768, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        width,
      );
      expect((await new AxeBuilder({ page }).include('main').analyze()).violations).toEqual([]);
      await page.screenshot({
        path: testInfo.outputPath(`set-password-${theme}-${width}.png`),
        fullPage: true,
      });
    }
  }
  const password = page.getByLabel('New Password', { exact: true });
  await password.fill('ExamplePassword1!');
  await expect(password).toHaveAttribute('aria-describedby', 'password-hint');
  await expect(page.locator('#password-hint')).toHaveText('Use at least 6 characters.');
  await page.goto(
    'http://127.0.0.1:6007/iframe.html?id=authentication-pages--change-password&viewMode=story',
  );
  await expect(page.getByRole('heading', { name: 'Change Password', exact: true })).toBeVisible();
  await expect(page.getByLabel('Current Password', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Cancel', exact: true })).toBeVisible();
});
