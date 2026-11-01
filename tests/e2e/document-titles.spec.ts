import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';
import { inventory } from '../support/views';
import { pageTitles, type PageGroup } from '../support/page-titles';

async function login(page: Page) {
  await page.goto('/auth/login');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/repos$/);
}

for (const view of inventory) {
  test('titles ' + view.id, async ({ page }) => {
    if (view.access === 'signed-in') await login(page);
    const response = await page.goto(view.path);
    expect(response?.status()).toBe(200);
    expect(new URL(page.url()).pathname).toBe(new URL(view.path, page.url()).pathname);
    await expect(page).toHaveTitle(pageTitles[view.page as PageGroup]);
  });
}
