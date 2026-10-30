import { test, expect } from './fixtures';
import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { choicePageSchema } from '../../src/models/contribution-options';

async function login(page: Page) {
  await page.goto('/auth/login');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/repos$/);
}
async function csvDownload(page: Page) {
  await page.getByRole('button', { name: 'Export CSV', exact: true }).click();
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download CSV', exact: true }).click();
  const stream = await (await pending).createReadStream();
  let csv = '';
  for await (const chunk of stream) csv += String(chunk);
  await expect(page.getByRole('dialog')).toBeHidden();
  return csv;
}

test('global gaps keep overview pages, counts and CSV exports bounded by recorded contributors', async ({
  page,
}, info) => {
  await login(page);
  await page.goto('/contributors?sample=coverage-gap&scope=1&period=this-year');
  await expect(page.getByLabel('Data coverage')).toContainText('account-specific gaps');
  await expect(page.getByLabel('Contribution report scope')).toContainText(
    '3251 included accounts',
  );
  const tabs = page.getByRole('navigation', { name: 'Contribution reports' });
  await expect(tabs.getByRole('link', { name: 'Contributors 251', exact: true })).toBeVisible();
  await expect(tabs.getByRole('link', { name: 'Companies 4', exact: true })).toBeVisible();
  await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(50);
  await expect(page.getByText('Page 1 of 6', { exact: true })).toBeVisible();
  await page.screenshot({ path: info.outputPath('coverage-gap-contributors.png'), fullPage: true });
  for (let number = 2; number <= 6; number++) {
    await page.getByRole('button', { name: 'Next', exact: true }).click();
    await expect(page.getByText(`Page ${number} of 6`, { exact: true })).toBeVisible();
  }
  await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(1);
  const csv = await csvDownload(page);
  expect(csv.split('\r\n')).toHaveLength(252);
  expect(csv).not.toContain('account-inactive-');
  expect(csv).toContain('"partial"');
  await tabs.getByRole('link', { name: 'Companies 4', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Companies', level: 1 })).toBeVisible();
  await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(4);
  const companies = await csvDownload(page);
  expect(companies.split('\r\n')).toHaveLength(5);
  expect(companies).not.toContain('account-inactive-');
  const response = await page.request.get('/companies?sample=coverage-gap&scope=1', {
    headers: { RSC: '1' },
  });
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toContain('text/x-component');
  const payload = await response.text();
  expect(payload).not.toContain('Sample inactive account');
  expect(Buffer.byteLength(payload)).toBeLessThan(100000);
  expect((await new AxeBuilder({ page }).include('main').analyze()).violations).toEqual([]);
  await page.screenshot({ path: info.outputPath('coverage-gap-companies.png'), fullPage: true });
  await page.setViewportSize({ width: 375, height: 900 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  await page.screenshot({ path: info.outputPath('coverage-gap-mobile.png'), fullPage: true });
});

test('coverage-gap filters preserve the full directory and focused reports without inventing overview activity', async ({
  page,
}) => {
  await login(page);
  await page.goto(
    '/contributors?sample=coverage-gap&scope=1&period=this-year&repo=repo-prebidjs&type=agent',
  );
  await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(1);
  await page.getByRole('link', { name: /Sample agent.*— view contribution report/ }).click();
  await expect(page.getByRole('heading', { name: 'By repository', exact: true })).toBeVisible();
  await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(1);
  await page.getByRole('link', { name: 'Back to report', exact: true }).click();
  expect(new URL(page.url()).searchParams.getAll('repo')).toEqual(['repo-prebidjs']);
  expect(new URL(page.url()).searchParams.getAll('type')).toEqual(['agent']);
  await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(1);
  await page.goto(
    '/contributors?sample=coverage-gap&scope=1&period=this-year&population=selected&account=account-inactive-0001',
  );
  await expect(
    page.getByRole('heading', { name: 'No confirmed contributions to list' }),
  ).toBeVisible();
  await expect(page.getByLabel('Data coverage')).toBeVisible();
  await expect(page.getByRole('table')).toHaveCount(0);
  await page.goto(
    '/contributors/account-inactive-0001?sample=coverage-gap&scope=1&period=this-year',
  );
  await expect(
    page.getByRole('heading', { name: 'Sample inactive account 1', level: 1 }),
  ).toBeVisible();
  await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(18);
  await page.goto('/contributors?sample=coverage-gap&scope=1&period=this-year');
  const response = page.waitForResponse(
    (r) => new URL(r.url()).pathname === '/api/reporting/contribution-options',
  );
  await page.getByRole('button', { name: 'All accounts', exact: true }).click();
  const choices = choicePageSchema.parse(await (await response).json());
  expect(choices.total).toBe(3251);
  expect(choices.choices).toHaveLength(50);
});
