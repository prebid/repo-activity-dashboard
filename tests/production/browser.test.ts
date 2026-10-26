// @vitest-environment node
import { it, expect, inject } from 'vitest';
import { chromium, webkit, type Page } from '@playwright/test';
import { UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { startProductionApp } from '../support/production-app';
async function signIn(page: Page, origin: string, email: string, password: string) {
  await page.goto(origin + '/auth/login');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
}
it.each(['chromium', 'webkit'] as const)(
  'production account lifecycle, protected navigation and credential recovery in %s',
  async (engine) => {
    const fixture = await startProductionApp(inject('accountEndpoint'), { browser: true });
    const browser = await (engine === 'chromium' ? chromium : webkit).launch();
    const errors: string[] = [],
      unexpectedOrigins: string[] = [];
    try {
      await fixture.seedUser({
        id: 'admin',
        email: 'admin@example.test',
        password: 'FixtureAdminPassword1!',
        role: 'admin',
      });
      const admin = await browser.newContext();
      const page = await admin.newPage();
      page.on('pageerror', (error) => errors.push(error.message));
      page.on('request', (request) => {
        const url = new URL(request.url());
        if (url.origin !== fixture.origin && url.protocol !== 'data:' && url.protocol !== 'blob:')
          unexpectedOrigins.push(url.origin);
      });
      await signIn(page, fixture.origin, 'admin@example.test', 'FixtureAdminPassword1!');
      await page.waitForURL('**/repos');
      await page.getByRole('heading', { name: 'All repositories', exact: true }).waitFor();
      let sessionRequests = 0;
      page.on('request', (request) => {
        if (new URL(request.url()).pathname === '/api/auth/session') sessionRequests++;
      });
      await page.reload();
      await page.getByRole('button', { name: 'Sign out', exact: true }).waitFor();
      expect(sessionRequests).toBe(0);
      await page.goto(fixture.origin + '/admin/users');
      await page.getByRole('heading', { name: 'Account administration' }).waitFor();
      const email = 'browser-' + engine + '@example.test';
      await page.getByLabel('Email', { exact: true }).fill(email);
      await page.getByRole('button', { name: 'Create account', exact: true }).click();
      const dialog = page.getByRole('dialog', { name: 'Temporary password' });
      await dialog.waitFor();
      const oldPassword = await dialog
        .getByRole('textbox', { name: 'Temporary password', exact: true })
        .inputValue();
      expect(oldPassword.length).toBeGreaterThan(0);
      await page.keyboard.press('Escape');
      await dialog.getByRole('button', { name: 'Keep password open' }).waitFor();
      await dialog.getByRole('button', { name: 'Keep password open' }).click();
      await dialog.getByRole('button', { name: 'I have saved the password' }).click();
      await dialog.waitFor({ state: 'hidden' });
      await page
        .getByRole('button', { name: 'Reissue password for ' + email, exact: true })
        .click();
      await dialog.waitFor();
      const password = await dialog
        .getByRole('textbox', { name: 'Temporary password', exact: true })
        .inputValue();
      expect(password).not.toBe(oldPassword);
      await dialog.getByRole('button', { name: 'I have saved the password' }).click();
      const person = await browser.newContext();
      const form = await person.newPage();
      form.on('pageerror', (error) => errors.push(error.message));
      await signIn(form, fixture.origin, email, oldPassword);
      await form.locator('form [role=alert]').waitFor();
      expect(await form.locator('form [role=alert]').textContent()).toContain('Unable to sign in');
      await form.getByLabel('Password', { exact: true }).fill(password);
      await form.getByRole('button', { name: 'Sign in', exact: true }).click();
      await form.waitForURL('**/auth/change-password');
      await form.getByRole('heading', { name: 'Set Your Password' }).waitFor();
      // Another tab changing identity must not preserve a password typed for the previous account.
      await form.getByLabel('Temporary Password', { exact: true }).fill(password);
      const peer = await person.newPage();
      peer.on('pageerror', (error) => errors.push(error.message));
      await signIn(peer, fixture.origin, 'admin@example.test', 'FixtureAdminPassword1!');
      await peer.waitForURL('**/repos');
      await form.bringToFront();
      await form.getByText('Account: admin@example.test', { exact: true }).waitFor();
      expect(await form.getByLabel('Current Password', { exact: true }).inputValue()).toBe('');
      await peer.close();
      await signIn(form, fixture.origin, email, password);
      await form.waitForURL('**/auth/change-password');
      await form.getByRole('heading', { name: 'Set Your Password' }).waitFor();
      // Human-paced input exercises navigation after the form has settled, not an immediate fill/submit shortcut.
      await form
        .getByLabel('Temporary Password', { exact: true })
        .pressSequentially(password, { delay: 40 });
      await form
        .getByLabel('New Password', { exact: true })
        .pressSequentially('ChangedBrowserPassword2!', { delay: 40 });
      await form
        .getByLabel('Confirm New Password', { exact: true })
        .pressSequentially('ChangedBrowserPassword2!', { delay: 40 });
      await form.getByRole('button', { name: 'Change Password', exact: true }).click();
      await form.waitForURL('**/repos');
      await form.getByRole('heading', { name: 'All repositories', exact: true }).waitFor();
      await form.getByRole('link', { name: 'Contributors', exact: true }).click();
      await form.getByRole('heading', { name: 'Contributors', exact: true, level: 1 }).waitFor();
      const missing = await person.request.get(fixture.origin + '/repos/not-in-catalog');
      expect(missing.status()).toBe(404);
      await fixture.client.send(
        new UpdateCommand({
          TableName: fixture.whitelist,
          Key: { email },
          UpdateExpression: 'SET isActive = :active',
          ExpressionAttributeValues: { ':active': false },
        }),
      );
      await form.getByRole('link', { name: 'Companies', exact: true }).focus();
      await form.keyboard.press('Enter');
      await form.waitForURL('**/auth/login?**');
      expect(await form.getByRole('heading', { name: 'Sign in', exact: true }).isVisible()).toBe(
        true,
      );
      const denied = await person.request.get(fixture.origin + '/contributors', {
        headers: { RSC: '1' },
      });
      expect(await denied.text()).not.toContain('Alice');
      await person.close();
      await admin.close();
      expect(errors).toEqual([]);
      expect(unexpectedOrigins).toEqual([]);
    } finally {
      await browser.close();
      await fixture.dispose();
    }
  },
  120000,
);
