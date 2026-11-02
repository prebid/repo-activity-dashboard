import { test, expect } from './fixtures';
import {
  preferenceCookieByteLimit,
  preferenceCookies,
} from '../../src/lib/presentation/preference-cookie';

// The local half of the header-size premise. Whether Amplify and CloudFront forward these cookies
// within their own header limits needs AWS access and is not checked here.
test('a signed-in request carrying both preference cookies at their size limit is served', async ({
  page,
  request,
}, testInfo) => {
  await page.goto('/auth/login');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/repos$/);
  const session = (await page.context().cookies()).map(({ name, value }) => name + '=' + value);
  expect(session.length).toBeGreaterThan(0);
  // The content does not matter to the header limit; the server ignores a malformed value.
  const full = Object.values(preferenceCookies).map(({ name, path }) => ({
    name,
    path,
    value: 'A'.repeat(preferenceCookieByteLimit - name.length - 1),
  }));
  for (const cookie of full)
    expect(new TextEncoder().encode(cookie.name + '=' + cookie.value).length).toBe(
      preferenceCookieByteLimit,
    );
  const header = [...session, ...full.map(({ name, value }) => name + '=' + value)].join('; ');
  for (const path of ['/repos', '/contributors']) {
    // Without a redirect, 200 also shows the session was accepted: signed out answers 307.
    const response = await request.get(path, { headers: { cookie: header }, maxRedirects: 0 });
    expect(response.status(), path).toBe(200);
  }
  // The browser sends both cookies with its own session cookie on a document request.
  const domain = new URL(testInfo.project.use.baseURL!).hostname;
  await page.context().addCookies(full.map((cookie) => ({ ...cookie, domain })));
  const sent = page.waitForRequest((request) => new URL(request.url()).pathname === '/repos');
  const response = await page.goto('/repos');
  expect(response?.status()).toBe(200);
  const cookie = (await (await sent).allHeaders()).cookie ?? '';
  for (const { name } of full) expect(cookie).toContain(name + '=');
  await expect(page.getByRole('heading', { name: 'All repositories', exact: true })).toBeVisible();
});
