import { test, expect } from './fixtures';

test.use({ javaScriptEnabled: false });

test('native sign-in never puts credentials in the URL when JavaScript is unavailable', async ({
  page,
}) => {
  await page.goto('/auth/login');
  await expect(
    page.getByText('Enable JavaScript to sign in or change your password.'),
  ).toBeVisible();
  await page.getByLabel('Email', { exact: true }).fill('native@example.test');
  await page.getByLabel('Password', { exact: true }).fill('url-leak-guard');
  const request = page.waitForRequest(
    (request) => request.isNavigationRequest() && new URL(request.url()).pathname === '/auth/login',
  );
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  const submitted = await request;
  expect(submitted.method()).toBe('POST');
  expect(new URL(submitted.url()).search).not.toContain('password');
  expect(submitted.url()).not.toContain('url-leak-guard');
  expect(submitted.postData()).toContain('url-leak-guard');
});
