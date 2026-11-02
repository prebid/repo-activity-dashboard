import { test, expect, expectTheme } from './fixtures';
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
  await expect(
    page.getByRole('heading', { name: 'Contributors', exact: true, level: 1 }),
  ).toBeVisible();
  await expect(page.getByRole('table').locator('tbody tr').first()).toBeVisible();
});
test('native select, dialog focus, menu keyboard actions and switch behavior', async ({ page }) => {
  await page.setViewportSize({ width: 700, height: 500 });
  await page.goto(
    'http://127.0.0.1:6007/iframe.html?id=foundation-interactive-primitives--keyboard&viewMode=story',
  );
  // The browser draws the open list of a native select, so only its value and focus are checked.
  const select = page.getByRole('combobox', { name: 'Repository selection' });
  await expect(select).toHaveValue('item-1');
  await expect(select.locator('option')).toHaveCount(50);
  await expect(select).toHaveCSS('appearance', 'none');
  await select.selectOption('item-50');
  await expect(select).toHaveValue('item-50');
  await select.selectOption({ label: 'Repository 1' });
  await expect(select).toHaveValue('item-1');
  await select.focus();
  await expect(select).toBeFocused();
  await page.setViewportSize({ width: 700, height: 500 });
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
  await expectTheme(page, 'dark');
  await page.getByRole('button', { name: 'Open dialog' }).click();
  const dialog = page.getByRole('dialog', { name: 'Sample dialog' });
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveCSS('opacity', '1');
  // Dialogs sit on the raised overlay surface, which differs from the page canvas in Dark.
  const [canvas, overlay] = await page.locator('body').evaluate((body) => {
    const probe = document.createElement('div');
    probe.style.backgroundColor = 'var(--prebid-overlay)';
    body.append(probe);
    const colors = [
      getComputedStyle(body).backgroundColor,
      getComputedStyle(probe).backgroundColor,
    ];
    probe.remove();
    return colors;
  });
  expect(overlay).not.toBe(canvas);
  expect(overlay).toBe(darkOverlay);
  await expect(dialog).toHaveCSS('background-color', overlay);
  expect((await new AxeBuilder({ page }).include('[role="dialog"]').analyze()).violations).toEqual(
    [],
  );
});
async function login(page: import('@playwright/test').Page) {
  await page.goto('/auth/login');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/repos$/);
}
// --prebid-overlay in Dark (#1c2a37); dialogs must not fall back to the card or the canvas.
const darkOverlay = 'rgb(28, 42, 55)';
test('report dialogs sit on the overlay surface in Dark', async ({ page }) => {
  await login(page);
  await expectTheme(page, 'dark');
  // A feature dialog with its own frame class.
  await page.goto('/repos/prebidjs');
  await page.getByRole('button', { name: /^Filters(?: \(|$)/ }).click();
  const filters = page.getByRole('dialog', { name: /^Filter pull requests$/ });
  await expect(filters).toHaveCSS('opacity', '1');
  await expect(filters).toHaveCSS('background-color', darkOverlay);
  await page.keyboard.press('Escape');
  // The shared scrollable dialog frame.
  await page.goto('/companies/id/company-acme');
  await page.getByRole('button', { name: 'Export CSV', exact: true }).click();
  const csv = page.getByRole('dialog', { name: /CSV export$/ });
  await expect(csv).toHaveCSS('opacity', '1');
  await expect(csv).toHaveCSS('background-color', darkOverlay);
});
test('login return preserves issue context, pagination and full-result search', async ({
  page,
}) => {
  await page.goto('/repos/prebidjs?view=issues&issues.page=2');
  await expect(page).toHaveURL(/auth\/login\?callbackUrl=/);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/view=issues.*issues.page=2/);
  await expect(page.getByText('834 issues', { exact: true })).toBeVisible();
  await expect(page.getByRole('table').getByRole('row')).toHaveCount(51);
  const pager = page.getByRole('navigation', { name: 'Open issues pages', exact: true });
  await expect(pager).toContainText('Page 2 of 17');
  await page.getByRole('textbox', { name: 'Search Open issues' }).fill('Oldest sample issue');
  await expect(page.getByText('1 matching issue', { exact: true })).toBeVisible();
  // One page of results hides the pager.
  await expect(pager).toHaveCount(0);
  await expect(
    page.getByRole('link', { name: 'Oldest sample issue: keyboard navigation' }),
  ).toHaveAttribute('href', /example-fixtures.*issues\/1$/);
});
test('catalog links retain current-list pagination and independent feedback/approval values', async ({
  page,
}, testInfo) => {
  await login(page);
  await expect(
    page.getByRole('table', { name: 'Current backlog' }).locator('tbody tr'),
  ).toHaveCount(18);
  await page.screenshot({ path: testInfo.outputPath('all-repos.png'), fullPage: true });
  const row = page
    .getByRole('table', { name: 'Current backlog' })
    .getByRole('row')
    .filter({ has: page.getByRole('link', { name: 'Prebid.js', exact: true }) });
  await expect(row.locator('[data-column="totalOpenPrs"]')).toHaveText('137');
  await row.getByRole('link', { name: 'Prebid.js', exact: true }).click();
  await expect(page.getByText('137 PRs', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(50);
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
  await expectTheme(page, 'dark');
  const specimen = page.getByTestId('style-specimen');
  await expect(specimen).toHaveCSS('padding-top', '16px');
  await expect(specimen).toHaveCSS('gap', '8px');
  await expect(page.getByTestId('text-specimen')).toHaveCSS('font-size', '14px');
  const before = await page.locator('body').evaluate((el) => getComputedStyle(el).backgroundColor);
  async function focusContrast() {
    return page.evaluate(() => {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 1;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Missing color conversion context');
      const luminance = (color: string) => {
        context.clearRect(0, 0, 1, 1);
        context.fillStyle = 'transparent';
        context.fillStyle = color;
        context.fillRect(0, 0, 1, 1);
        const pixel = context.getImageData(0, 0, 1, 1).data;
        if (pixel[3] !== 255) throw new Error('Expected a resolved opaque focus/background color');
        const values = [...pixel].slice(0, 3).map((n) => {
          const value = n / 255;
          return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
        });
        return values[0] * 0.2126 + values[1] * 0.7152 + values[2] * 0.0722;
      };
      const ring = luminance(getComputedStyle(document.documentElement).getPropertyValue('--ring'));
      const background = luminance(getComputedStyle(document.body).backgroundColor);
      return (Math.max(ring, background) + 0.05) / (Math.min(ring, background) + 0.05);
    });
  }
  expect(await focusContrast()).toBeGreaterThanOrEqual(3);
  await page.getByRole('button', { name: 'Theme settings', exact: true }).click();
  await page.getByRole('menuitemradio', { name: 'Light', exact: true }).click();
  await expect(page.getByRole('menu')).toHaveCount(0);
  await expect
    .poll(() => page.locator('body').evaluate((el) => getComputedStyle(el).backgroundColor))
    .not.toBe(before);
  expect(await page.evaluate(() => localStorage.getItem('dashboard-theme'))).toBe('light');
  await page.reload();
  await expectTheme(page, 'light');
  const button = page.getByRole('button', { name: 'Example action' });
  expect(await focusContrast()).toBeGreaterThanOrEqual(3);
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
  await expect(button).toHaveCSS('outline-style', 'solid');
  await expect(button).toHaveCSS('outline-width', '2px');
  if (testInfo.project.name === 'chromium') {
    await page.emulateMedia({ forcedColors: 'active' });
    expect(await page.evaluate(() => matchMedia('(forced-colors: active)').matches)).toBe(true);
    await expect(button).toHaveCSS('box-shadow', 'none');
    await expect(button).toHaveCSS('outline-style', 'solid');
    await expect(button).toHaveCSS('outline-width', '2px');
    await page.screenshot({ path: testInfo.outputPath('forced-colors-focus.png') });
    await page.emulateMedia({ forcedColors: 'none' });
  }
  const findings = await new AxeBuilder({ page }).analyze();
  expect(findings.violations).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath('foundation-theme.png'), fullPage: true });
  await page.setViewportSize({ width: 768, height: 900 });
  await expect(specimen).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('foundation-narrow.png'), fullPage: true });
});

test('repository and column menus close and restore keyboard focus appropriately', async ({
  page,
}) => {
  await login(page);
  const input = page.getByRole('button', { name: 'PR age', exact: true });
  await input.focus();
  const original = page.url();
  const columns = page
    .getByRole('region', { name: 'Current backlog', exact: true })
    .getByRole('button', { name: 'Columns', exact: true });
  await columns.click();
  expect(page.url()).toBe(original);
  const draft = page.getByRole('menuitemcheckbox', { name: 'Drafts', exact: true });
  await draft.click();
  await expect(draft).toHaveAttribute('aria-checked', 'false');
  await expect(page.getByRole('menu')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(columns).toBeFocused();
  await expect(page.getByRole('columnheader', { name: 'Drafts', exact: true })).toHaveCount(0);
  const repos = page.getByRole('button', { name: 'Repositories', exact: true });
  await repos.click();
  await page.getByRole('menuitem', { name: 'Prebid.js', exact: true }).click();
  await expect(page).toHaveURL(/\/repos\/prebidjs$/);
  await expect(page.getByRole('menu')).toHaveCount(0);
  await repos.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('menu')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(repos).toBeFocused();
  const outside = await page.getByRole('heading', { name: 'Prebid.js', exact: true }).boundingBox();
  if (!outside) throw new Error('Missing outside-click target');
  await repos.click();
  await expect(page.getByRole('menu')).toHaveCSS('opacity', '1');
  await page.mouse.click(outside.x + 8, outside.y + outside.height / 2);
  await expect(page.getByRole('menu')).toHaveCount(0);
});
test('CSV download and blocked account changes in preview', async ({ page }) => {
  await login(page);
  await page.goto('/contributors');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export CSV' }).click();
  await page.getByRole('button', { name: 'Download CSV', exact: true }).click();
  const download = await downloadPromise;
  const stream = await download.createReadStream();
  let csv = '';
  if (stream)
    for await (const chunk of stream) {
      if (!Buffer.isBuffer(chunk)) throw new Error('Expected CSV bytes');
      csv += chunk.toString('utf8');
    }
  expect(csv.split('\r\n')).toHaveLength(8);
  expect(csv).toContain('"Alice"');
  expect(csv).toContain('"Approval contributions"');
  expect(csv).toContain('"Reviewer contributions"');
  const response = await page.request.post('/api/auth/setup', {
    data: { email: 'unused@example.test', password: 'unused' },
  });
  expect(response.status()).toBe(403);
});

test('sort defaults are per account and explicit URLs take precedence', async ({ page }) => {
  await login(page);
  const total = page.getByRole('columnheader', { name: 'Total PRs', exact: true });
  await expect(total).toHaveAttribute('aria-sort', 'descending');
  await page.getByRole('button', { name: 'Total PRs', exact: true }).click();
  await expect(total).toHaveAttribute('aria-sort', 'ascending');
  await page.goto('/repos');
  await expect(page).toHaveURL(/\/repos$/); // Restored defaults stay in memory until an action writes the URL.
  await expect(total).toHaveAttribute('aria-sort', 'ascending');
  await page.goto('/repos?backlog.sort=name&backlog.dir=asc');
  await expect(
    page
      .getByRole('table', { name: 'Current backlog', exact: true })
      .getByRole('columnheader', { name: 'Repository', exact: true }),
  ).toHaveAttribute('aria-sort', 'ascending');
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/auth\/login/);
  await page.getByLabel('Email', { exact: true }).fill('bob@example.test');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/repos$/);
  await expect(page.getByRole('columnheader', { name: 'Total PRs', exact: true })).toHaveAttribute(
    'aria-sort',
    'descending',
  );
});

test('repository issue search and same-route navigation keep the URL and rows synchronized', async ({
  page,
}) => {
  await login(page);
  await page.goto('/repos/prebidjs?view=issues');
  const input = page.getByRole('textbox', { name: 'Search Open issues' });
  await expect(input).toBeEnabled();
  await input.focus();
  await expect(input).toBeFocused();
  await input.pressSequentially('z'.repeat(130), { delay: 5 });
  await expect(page).toHaveURL(/issues.q=z{130}/);
  await expect(input).toHaveValue('z'.repeat(130));
  await input.fill('Oldest sample issue');
  await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(1);
  await page
    .getByRole('navigation', { name: 'Repository lists' })
    .getByRole('link', { name: /^Issues/ })
    .click();
  await expect(input).toHaveValue('');
  await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(50);
  await expect(page.getByText('834 issues', { exact: true })).toBeVisible();
});
test('sort survives a real router refresh caused by another tab signing in', async ({
  page,
  context,
}) => {
  await login(page);
  const total = page.getByRole('columnheader', { name: 'Total PRs', exact: true });
  await expect(total).toHaveAttribute('aria-sort', 'descending');
  await page.getByRole('button', { name: 'Total PRs', exact: true }).click();
  await expect(page).toHaveURL(/backlog.sort=totalOpenPrs/);
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
    await expect(page).toHaveURL(/backlog.sort=totalOpenPrs/);
    await expect(total).toHaveAttribute('aria-sort', 'ascending');
    observed.assertClean();
  } finally {
    observed.dispose();
    await peer.close();
  }
});
test('export captures a draft search before its debounce completes', async ({ page }) => {
  await login(page);
  await page
    .getByRole('navigation', { name: 'Main navigation' })
    .getByRole('link', { name: 'Contributions', exact: true })
    .click();
  await page.getByRole('textbox', { name: 'Search Contributors' }).fill('Alice');
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export CSV' }).click();
  await page.getByRole('button', { name: 'Download CSV', exact: true }).click();
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
  expect(csv).toContain('"Table search"');
  expect(csv.trimEnd().endsWith('"Alice","authoredPrsMerged","desc"')).toBe(true);
});
