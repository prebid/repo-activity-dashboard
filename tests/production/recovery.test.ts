// @vitest-environment node
import { it, expect, inject } from 'vitest';
import { chromium, webkit, type Page } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { startProductionApp } from '../support/production-app';
import { observeBrowserErrors } from '../support/browser-errors';

async function login(page: Page, origin: string, email: string, password: string) {
  await page.goto(origin + '/auth/login');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
}

it.each(['chromium', 'webkit'] as const)(
  'recovers truthful account outcomes and fresh server errors in %s',
  async (engine) => {
    const fixture = await startProductionApp(inject('accountEndpoint'), { browser: true });
    const browser = await (engine === 'chromium' ? chromium : webkit).launch();
    try {
      await fixture.seedUser({
        email: 'admin@example.test',
        password: 'AdminPassword1!',
        role: 'admin',
      });
      await fixture.seedUser({
        email: 'expired@example.test',
        password: 'ExpiredPassword1!',
        mustChangePassword: true,
        temporaryPasswordExpiresAt: '2020-01-01T00:00:00.000Z',
      });
      const page = await browser.newPage();
      const unexpectedOrigins: string[] = [];
      page.on('request', (request) => {
        const url = new URL(request.url());
        if (url.origin !== fixture.origin && !['data:', 'blob:'].includes(url.protocol))
          unexpectedOrigins.push(url.origin);
      });
      let errors = observeBrowserErrors(page);
      await login(page, fixture.origin, 'expired@example.test', 'WrongPassword1!');
      await page.getByRole('alert').filter({ hasText: 'Check your details' }).waitFor();
      await page.getByLabel('Password', { exact: true }).fill('ExpiredPassword1!');
      await page.getByRole('button', { name: 'Sign in', exact: true }).click();
      await page.getByRole('alert').filter({ hasText: 'Temporary password expired' }).waitFor();
      await login(page, fixture.origin, 'admin@example.test', 'AdminPassword1!');
      await page.waitForURL('**/repos');
      const signout = (url: URL) => url.pathname === '/api/auth/signout';
      let intercepted = 0;
      await page.route(signout, async (route) => {
        intercepted++;
        const body = new URLSearchParams(route.request().postData() ?? '');
        body.set('csrfToken', 'controlled-invalid-token');
        await route.continue({ postData: body.toString() });
      });
      await page.getByRole('button', { name: 'Sign out', exact: true }).click();
      await page
        .getByRole('alert')
        .filter({ hasText: 'Sign-out could not be confirmed' })
        .waitFor();
      expect(intercepted).toBe(1);
      expect(new URL(page.url()).pathname).toBe('/repos');
      expect(
        await (await page.request.get(fixture.origin + '/api/auth/session')).json(),
      ).toMatchObject({ user: { email: 'admin@example.test' } });
      await page.unroute(signout);
      await page.getByRole('button', { name: 'Sign out', exact: true }).click();
      await page.waitForURL('**/auth/login');
      expect(
        await (await page.request.get(fixture.origin + '/api/auth/session')).json(),
      ).toBeNull();
      await login(page, fixture.origin, 'admin@example.test', 'AdminPassword1!');
      await page.waitForURL('**/repos');
      await page.goto(fixture.origin + '/admin/users');
      await page.getByLabel('Email', { exact: true }).fill('uncertain@example.test');

      // Forward exactly one real write, then lose only its response to the browser.
      const create = (url: URL) => url.pathname === '/api/admin/users';
      let committed = 0;
      await page.route(create, async (route) => {
        if (route.request().method() !== 'POST') return route.continue();
        const response = await route.fetch();
        expect(response.status()).toBe(200);
        committed++;
        await route.abort('failed');
      });
      await page.getByRole('button', { name: 'Create account', exact: true }).click();
      await page.getByRole('alert').filter({ hasText: 'It may have succeeded' }).waitFor();
      expect(committed).toBe(1);
      await page.unroute(create);
      await page.getByRole('button', { name: 'Refresh accounts', exact: true }).click();
      const reissue = page.getByRole('button', {
        name: 'Reissue password for uncertain@example.test',
        exact: true,
      });
      await reissue.waitFor();
      const reset = (url: URL) => url.pathname === '/api/admin/users/reset-password';
      await page.route(reset, async (route) => {
        const response = await route.fetch();
        expect(response.status()).toBe(200);
        committed++;
        await route.abort('failed');
      });
      await reissue.click();
      await page
        .getByRole('alert')
        .filter({ hasText: 'A new password may have been issued' })
        .waitFor();
      expect(committed).toBe(2);
      await page.unroute(reset);
      await reissue.click();
      const dialog = page.getByRole('dialog', { name: 'Temporary password' });
      await dialog.waitFor();
      await dialog.getByRole('button', { name: 'I have saved the password' }).click();

      // Hold application scripts so this also exercises the server-rendered form before hydration.
      const applicationScript = /\/_next\/static\/.*\.js(?:\?|$)/;
      let releaseScripts: () => void = () => undefined;
      const scripts = new Promise<void>((resolve) => {
        releaseScripts = resolve;
      });
      await page.route(applicationScript, async (route) => {
        await scripts;
        await route.continue();
      });
      try {
        await page.goto(fixture.origin + '/auth/change-password', { waitUntil: 'commit' });
        await page.getByLabel('Current Password', { exact: true }).waitFor();
        for (const name of ['Current Password', 'New Password', 'Confirm New Password'])
          expect(await page.getByLabel(name, { exact: true }).isDisabled()).toBe(true);
        expect(
          await page.getByRole('button', { name: 'Change Password', exact: true }).isDisabled(),
        ).toBe(true);
        expect(await page.getByRole('button', { name: 'Cancel', exact: true }).isDisabled()).toBe(
          true,
        );
      } finally {
        releaseScripts();
        await page.unrouteAll({ behavior: 'wait' });
      }
      await page.getByLabel('Current Password', { exact: true }).fill('AdminPassword1!');
      await page.getByLabel('New Password', { exact: true }).fill('ChangedAdminPassword2!');
      await page.getByLabel('Confirm New Password', { exact: true }).fill('ChangedAdminPassword2!');
      const change = (url: URL) => url.pathname === '/api/auth/change-password';
      await page.route(change, async (route) => {
        const response = await route.fetch();
        expect(response.status()).toBe(200);
        committed++;
        await route.abort('failed');
      });
      await page.getByRole('button', { name: 'Change Password', exact: true }).click();
      await page
        .getByText('The password change could not be confirmed.', { exact: false })
        .waitFor();
      expect(committed).toBe(3);
      await page.unroute(change);
      await login(page, fixture.origin, 'admin@example.test', 'ChangedAdminPassword2!');
      await page.waitForURL('**/repos');
      errors.assertClean();
      errors.dispose();

      // A server-render exception is intentional only while the controlled dependency is failing.
      fixture.setAccountUnavailable(true);
      await page.goto(fixture.origin + '/contributors');
      await page.getByRole('heading', { name: 'This page could not load' }).waitFor();
      fixture.setAccountUnavailable(false);
      const refreshed = page.waitForRequest((request) => request.headers()['rsc'] === '1');
      await page.getByRole('button', { name: 'Try again', exact: true }).click();
      await refreshed;
      await page.getByRole('heading', { name: 'Contributors', exact: true, level: 1 }).waitFor();
      errors = observeBrowserErrors(page);
      expect((await page.goto(fixture.origin + '/no-such-page'))?.status()).toBe(404);
      await page.getByRole('heading', { name: 'Page not found', exact: true }).waitFor();
      expect((await page.goto(fixture.origin + '/repos/no-such-repository'))?.status()).toBe(404);
      await page.getByRole('heading', { name: 'Repository not found', exact: true }).waitFor();
      errors.assertClean();
      errors.dispose();
      expect(unexpectedOrigins).toEqual([]);
    } finally {
      await browser.close();
      await fixture.dispose();
    }
  },
  120000,
);

it('serves a normal error page when the first authentication request has invalid configuration', async () => {
  const fixture = await startProductionApp(inject('accountEndpoint'));
  try {
    await writeFile(join(fixture.root, '.next/server/dashboard-runtime.json'), '{"invalid":true}');
    const providers = await fetch(fixture.origin + '/api/auth/providers');
    expect(providers.status).toBe(500);
    expect(await providers.json()).toEqual({
      error: 'Authentication requires operator attention.',
    });
    const response = await fetch(fixture.origin + '/api/auth/error', { redirect: 'manual' });
    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe('/auth/error?error=Configuration');
    const page = await fetch(new URL(response.headers.get('location')!, fixture.origin));
    expect(page.status).toBe(200);
    expect(page.headers.get('content-type')).toContain('text/html');
    expect(await page.text()).toContain('Unable to sign in');
  } finally {
    await fixture.dispose();
  }
});
