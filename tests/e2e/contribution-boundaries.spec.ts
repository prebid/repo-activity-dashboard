import { test, expect } from './fixtures';
import { choicePageSchema } from '../../src/models/contribution-options';
import type { Page } from '@playwright/test';
const optionsPath = '/api/reporting/contribution-options';
async function login(page: Page) {
  await page.goto('/auth/login');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/repos$/);
}
test('company and repository views transmit no hidden contributor collection', async ({
  page,
}, info) => {
  await login(page);
  const measurements = [];
  for (const path of [
    '/companies?sample=large&scope=1',
    '/companies/id/company-acme?sample=large&scope=1&view=repositories',
  ]) {
    const response = await page.request.get(path, { headers: { RSC: '1' } });
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('text/x-component');
    const text = await response.text();
    expect(text).not.toContain('Sample contributor 250');
    expect(text).not.toContain('Sample contributor 100');
    expect(text).not.toContain('includedAccountIds');
    expect(Buffer.byteLength(text)).toBeLessThan(100000);
    measurements.push({ path, bytes: Buffer.byteLength(text) });
  }
  await info.attach('report-payload-sizes', {
    body: JSON.stringify(measurements, null, 2),
    contentType: 'application/json',
  });
});
test('loads choices only when needed and preserves exclusions across server pages', async ({
  page,
}) => {
  await login(page);
  let requests = 0;
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === optionsPath) requests++;
  });
  await page.goto('/contributors?sample=large&scope=1');
  await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(50);
  expect(requests).toBe(0);
  const response = page.waitForResponse((r) => new URL(r.url()).pathname === optionsPath);
  await page.getByRole('button', { name: 'All accounts', exact: true }).click();
  const first = choicePageSchema.parse(await (await response).json());
  expect(first.total).toBe(251);
  expect(first.choices).toHaveLength(50);
  const dialog = page.getByRole('dialog', { name: 'Include and exclude accounts' });
  const exclusions = dialog.getByRole('group', { name: /^Exclusions/ });
  await exclusions.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(exclusions.getByText('Page 2 of 6', { exact: true })).toBeVisible();
  await exclusions.getByRole('checkbox', { name: /Sample contributor 51 / }).check();
  await exclusions.getByRole('button', { name: 'Previous', exact: true }).click();
  await exclusions.getByRole('checkbox', { name: 'Show selected only', exact: true }).check();
  await expect(exclusions.getByRole('checkbox', { name: /Sample contributor 51 / })).toBeChecked();
  await dialog.getByRole('button', { name: 'Apply accounts', exact: true }).click();
  await expect(page).toHaveURL(/exclude=account-person-051/);
  await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(50);
});
test('picker request errors are recoverable without discarding the report', async ({ page }) => {
  await login(page);
  await page.goto('/contributors?sample=large&scope=1');
  let attempts = 0;
  await page.route('**' + optionsPath, async (route) => {
    if (!attempts++)
      await route.fulfill({ status: 503, contentType: 'application/json', body: '{}' });
    else await route.continue();
  });
  await page.getByRole('button', { name: 'All accounts', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText(/Choices could not load/);
  await page.getByRole('button', { name: 'Retry exclusions', exact: true }).click();
  await expect(page.getByRole('checkbox', { name: /Sample contributor 1 / })).toBeVisible();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(50);
});
