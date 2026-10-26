import { test, expect } from './fixtures';
import { observeBrowserErrors } from '../support/browser-errors';
import AxeBuilder from '@axe-core/playwright';
test.beforeEach(async ({ context }) => {
  await context.route('**/*', (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.startsWith('/store/')) throw new Error('Unexpected retired reporting request');
    if (url.hostname === '127.0.0.1' || url.protocol === 'data:' || url.protocol === 'blob:')
      return route.continue();
    throw new Error('Unexpected external browser request: ' + url.origin);
  });
});

test('component catalog renders independently from authentication and reporting', async ({
  page,
}, testInfo) => {
  await page.goto(
    'http://127.0.0.1:6007/iframe.html?id=foundation-shared-components--normal&viewMode=story',
  );
  await expect(page.getByRole('heading', { name: 'Sample table' })).toBeVisible();
  await expect(page.getByText('Known zero', { exact: true })).toBeVisible();
  await expect(page.getByRole('figure', { name: 'Human review distribution' })).toBeVisible();
  expect((await new AxeBuilder({ page }).include('figure').analyze()).violations).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath('component-catalog.png'), fullPage: true });
});
test('repeated callback parameters retain a usable login destination', async ({ page }) => {
  await page.goto('/auth/login?callbackUrl=%2Fcontributors&callbackUrl=%2Fcompanies');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/contributors$/);
});
test('select bounds, dialog focus, menu keyboard actions and switch behavior', async ({ page }) => {
  await page.setViewportSize({ width: 700, height: 500 });
  await page.goto(
    'http://127.0.0.1:6007/iframe.html?id=foundation-interactive-primitives--keyboard&viewMode=story',
  );
  const select = page.getByRole('combobox', { name: 'Repository selection' });
  await select.focus();
  await page.keyboard.press('Enter');
  const list = page.getByRole('listbox');
  await expect(list).toBeVisible();
  const bounds = await list.evaluate((el) => ({
    maximum: getComputedStyle(el).maxHeight,
    available: getComputedStyle(el).getPropertyValue('--radix-select-content-available-height'),
  }));
  expect(Number.parseFloat(bounds.available)).toBeGreaterThan(0);
  expect(Number.parseFloat(bounds.maximum)).toBeCloseTo(Number.parseFloat(bounds.available));
  expect(Number.parseFloat(bounds.maximum)).toBeLessThanOrEqual(500);
  await expect(page.getByRole('option', { name: 'Repository 1', exact: true })).toBeFocused();
  await page.keyboard.press('End');
  await expect(page.getByRole('option', { name: 'Repository 50', exact: true })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(select).toHaveText('Repository 50');
  await expect(select).toBeFocused();
  const dialogTrigger = page.getByRole('button', { name: 'Open dialog' });
  await dialogTrigger.click();
  const dialog = page.getByRole('dialog', { name: 'Sample dialog' });
  await expect(dialog).toBeVisible();
  await expect(page.getByRole('button', { name: 'Close' })).toBeFocused();
  await expect(dialog).toHaveCSS('opacity', '1');
  expect((await new AxeBuilder({ page }).include('[role="dialog"]').analyze()).violations).toEqual(
    [],
  );
  await page.keyboard.press('Escape');
  await expect(dialogTrigger).toBeFocused();
  const menu = page.getByRole('button', { name: 'Open menu' });
  await menu.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('menuitem', { name: 'First action' })).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('menuitem', { name: 'Second action' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(menu).toBeFocused();
  const toggle = page.getByRole('switch', { name: 'Sample preference' });
  await toggle.focus();
  await page.keyboard.press('Space');
  await expect(toggle).toBeChecked();
});
test('component catalog themes also reach portaled dialogs', async ({ page }) => {
  await page.goto(
    'http://127.0.0.1:6007/iframe.html?id=foundation-interactive-primitives--keyboard&viewMode=story&globals=theme:dark',
  );
  await expect(page.locator('html')).toHaveClass(/dark/);
  await page.getByRole('button', { name: 'Open dialog' }).click();
  const dialog = page.getByRole('dialog', { name: 'Sample dialog' });
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveCSS('opacity', '1');
  const background = await page
    .locator('body')
    .evaluate((el) => getComputedStyle(el).backgroundColor);
  await expect(dialog).toHaveCSS('background-color', background);
  expect((await new AxeBuilder({ page }).include('[role="dialog"]').analyze()).violations).toEqual(
    [],
  );
});
async function login(page: import('@playwright/test').Page) {
  await page.goto('/auth/login');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/repos$/);
}
test('login return preserves issue context, pagination and full-result search', async ({
  page,
}) => {
  await page.goto('/repos/prebidjs?view=issues&issues.page=2');
  await expect(page).toHaveURL(/auth\/login\?callbackUrl=/);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/view=issues.*issues.page=2/);
  await expect(page.getByText('834 matching items')).toBeVisible();
  await expect(page.getByRole('table').getByRole('row')).toHaveCount(101);
  await page.getByRole('textbox', { name: 'Search Open issues' }).fill('Oldest sample issue');
  await expect(page.getByText('Page 1 of 1')).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Oldest sample issue: keyboard navigation' }),
  ).toHaveAttribute('href', /example-fixtures.*issues\/1$/);
});
test('catalog, summary drill-down and independent feedback/approval values', async ({
  page,
}, testInfo) => {
  await login(page);
  await expect(page.getByRole('table').getByRole('row')).toHaveCount(19);
  await page.screenshot({ path: testInfo.outputPath('all-repos.png'), fullPage: true });
  const row = page
    .getByRole('row')
    .filter({ has: page.getByRole('link', { name: 'Prebid.js', exact: true }) });
  await row.getByRole('link', { name: '137', exact: true }).click();
  await expect(page.getByText('137 matching items')).toBeVisible();
  const reviewed = page
    .getByRole('row')
    .filter({ has: page.getByRole('cell', { name: '1058', exact: true }) });
  await expect(reviewed.getByRole('cell').nth(3)).toHaveText('1');
  await expect(reviewed.getByRole('cell').nth(4)).toHaveText('0');
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByRole('table').getByRole('row')).toHaveCount(38);
});
test('style tokens, keyboard focus, themes and accessible foundation', async ({
  page,
}, testInfo) => {
  await login(page);
  await page.goto('/foundation');
  const specimen = page.getByTestId('style-specimen');
  await expect(specimen).toHaveCSS('padding-top', '16px');
  await expect(specimen).toHaveCSS('gap', '8px');
  await expect(page.getByTestId('text-specimen')).toHaveCSS('font-size', '14px');
  const before = await page.locator('body').evaluate((el) => getComputedStyle(el).backgroundColor);
  await page.getByRole('button', { name: 'Toggle theme' }).click();
  await expect
    .poll(() => page.locator('body').evaluate((el) => getComputedStyle(el).backgroundColor))
    .not.toBe(before);
  const button = page.getByRole('button', { name: 'Example action' });
  const unfocusedShadow = await button.evaluate((el) => getComputedStyle(el).boxShadow);
  // macOS WebKit uses Option+Tab to include buttons in keyboard traversal.
  // Begin at the input and verify the actual reverse order, not mouse focus.
  const previousKey =
    testInfo.project.name === 'webkit' && process.platform === 'darwin'
      ? 'Alt+Shift+Tab'
      : 'Shift+Tab';
  await page.getByRole('textbox', { name: 'Example input' }).focus();
  await page.keyboard.press(previousKey);
  await expect(page.getByRole('button', { name: 'Destructive action' })).toBeFocused();
  await page.keyboard.press(previousKey);
  await expect(button).toBeFocused();
  await expect(button).not.toHaveCSS('box-shadow', unfocusedShadow);
  const findings = await new AxeBuilder({ page }).analyze();
  expect(findings.violations).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath('foundation-theme.png'), fullPage: true });
  await page.setViewportSize({ width: 768, height: 900 });
  await expect(specimen).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('foundation-narrow.png'), fullPage: true });
});
test('CSV download and blocked account changes in preview', async ({ page }) => {
  await login(page);
  await page.goto('/contributors');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export CSV' }).click();
  const download = await downloadPromise;
  const stream = await download.createReadStream();
  let csv = '';
  if (stream)
    for await (const chunk of stream) {
      if (!Buffer.isBuffer(chunk)) throw new Error('Expected CSV bytes');
      csv += chunk.toString('utf8');
    }
  expect(csv.split('\r\n')).toHaveLength(4);
  expect(csv).toContain('"Alice"');
  expect(csv).toContain('"Approval contributions"');
  const response = await page.request.post('/api/auth/setup', {
    data: { email: 'unused@example.test', password: 'unused' },
  });
  expect(response.status()).toBe(403);
});

test('sort defaults are per account and explicit URLs take precedence', async ({ page }) => {
  await login(page);
  await page.getByRole('button', { name: 'Total open PRs', exact: true }).click();
  await page.getByRole('button', { name: 'Total open PRs ↑', exact: true }).click();
  await page.goto('/repos');
  await expect(page).toHaveURL(/\/repos$/); // Restored defaults stay in memory until an action writes the URL.
  await expect(page.getByRole('columnheader', { name: 'Total open PRs ↓' })).toHaveAttribute(
    'aria-sort',
    'descending',
  );
  await page.goto('/repos?repos.sort=name&repos.dir=asc');
  await expect(page.getByRole('columnheader', { name: 'Repository ↑' })).toHaveAttribute(
    'aria-sort',
    'ascending',
  );
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/auth\/login/);
  await page.getByLabel('Email', { exact: true }).fill('bob@example.test');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/repos$/);
  await expect(
    page.getByRole('columnheader', { name: 'Total open PRs', exact: true }),
  ).toHaveAttribute('aria-sort', 'none');
});

test('rapid search and same-route navigation keep the URL and rows synchronized', async ({
  page,
}) => {
  await login(page);
  const input = page.getByRole('textbox', { name: 'Search Current backlog' });
  await input.pressSequentially('z'.repeat(130), { delay: 5 });
  await expect(page).toHaveURL(/repos.q=z{130}/);
  await expect(input).toHaveValue('z'.repeat(130));
  await input.fill('server');
  await expect(page.getByRole('table').getByRole('row')).toHaveCount(3);
  await page.getByRole('link', { name: 'Repository activity', exact: true }).click();
  await expect(page).toHaveURL(/\/repos$/);
  await expect(input).toHaveValue('');
  await expect(page.getByRole('table').getByRole('row')).toHaveCount(19);
});
test('sort survives a real router refresh caused by another tab signing in', async ({
  page,
  context,
}) => {
  await login(page);
  await page.getByRole('button', { name: 'Total open PRs', exact: true }).click();
  await expect(page).toHaveURL(/repos.sort=openPrs/);
  const refreshed = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === '/repos' && response.request().headers()['rsc'] === '1',
  );
  const peer = await context.newPage(),
    observed = observeBrowserErrors(peer);
  try {
    await login(peer);
    await page.bringToFront();
    await refreshed;
    await expect(page).toHaveURL(/repos.sort=openPrs/);
    await expect(page.getByRole('columnheader', { name: 'Total open PRs ↑' })).toHaveAttribute(
      'aria-sort',
      'ascending',
    );
    observed.assertClean();
  } finally {
    observed.dispose();
    await peer.close();
  }
});
test('export captures a draft search before its debounce completes', async ({ page }) => {
  await login(page);
  await page.getByRole('link', { name: 'Contributors', exact: true }).click();
  await page.getByRole('textbox', { name: 'Search Contributors' }).fill('Alice');
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export CSV' }).click();
  const stream = await (await pending).createReadStream();
  if (!stream) throw new Error('Missing export bytes');
  let csv = '';
  for await (const chunk of stream) {
    if (!Buffer.isBuffer(chunk)) throw new Error('Expected bytes');
    csv += chunk.toString('utf8');
  }
  expect(csv.split('\r\n')).toHaveLength(2);
  expect(csv).toContain('"Alice"');
  expect(csv).not.toContain('"Bob"');
});
