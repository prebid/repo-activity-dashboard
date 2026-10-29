import { test, expect } from './fixtures';
import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
async function login(page: Page) {
  await page.goto('/auth/login');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/repos$/);
}
async function types(page: Page, labels: string[]) {
  await page.getByRole('button', { name: /^Account type:/ }).click();
  await page.getByRole('menuitem', { name: 'Clear selection', exact: true }).click();
  for (const name of labels)
    await page.getByRole('menuitemcheckbox', { name, exact: true }).click();
  await page.getByRole('menuitem', { name: 'Apply account types', exact: true }).click();
  await expect(page.getByRole('button', { name: /^Account type:/ })).toBeEnabled();
}
test('profile links and report links have distinct destinations, while account type replaces badges', async ({
  page,
}) => {
  await login(page);
  await page.goto('/contributors');
  const table = page.getByRole('table');
  await expect(
    table.getByRole('columnheader', { name: 'Account type', exact: true }),
  ).toBeVisible();
  await expect(table.locator('[data-actor]')).toHaveCount(0);
  const profile = table.getByRole('link', {
    name: /GitHub profile for sample-alice \(sample placeholder\)/,
  });
  await expect(profile).toHaveAttribute('href', 'https://github.example/sample-alice');
  await expect(profile).toHaveAttribute('target', '_blank');
  await expect(profile).toHaveAttribute('rel', 'noopener noreferrer');
  await table.getByRole('link', { name: 'Alice — view contribution report', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Alice', level: 1 })).toBeVisible();
  await expect(
    page.getByRole('link', {
      name: /GitHub profile for sample-alice \(sample placeholder\)/,
      exact: true,
    }),
  ).toBeVisible();
});
test('mixed account types filter both overviews, focused reports, paging and browser history', async ({
  page,
}) => {
  await login(page);
  await page.goto('/contributors?sample=large');
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByText('Page 2 of 6', { exact: true })).toBeVisible();
  await types(page, ['Prebid agent']);
  await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(1);
  expect(new URL(page.url()).searchParams.getAll('type')).toEqual(['agent']);
  expect(new URL(page.url()).searchParams.has('report.page')).toBe(false);
  await page
    .getByRole('table')
    .getByRole('link', { name: / — view contribution report$/ })
    .click();
  expect(new URL(page.url()).searchParams.getAll('type')).toEqual(['agent']);
  await expect(page.getByRole('region', { name: 'Report totals' })).toContainText('350');
  await page.getByRole('link', { name: 'Back to report', exact: true }).click();
  await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(1);
  await page.goto('/contributors');
  await types(page, ['Human', 'Bot']);
  await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(6);
  expect(new URL(page.url()).searchParams.getAll('type')).toEqual(['human', 'bot']);
  await page
    .getByRole('navigation', { name: 'Contribution reports' })
    .getByRole('link', { name: /^Companies/ })
    .click();
  expect(new URL(page.url()).searchParams.getAll('type')).toEqual(['human', 'bot']);
  await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(3);
  await page.reload();
  await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(3);
  await types(page, []);
  await expect(page.getByRole('heading', { name: 'No account types selected' })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(3);
  await page.goto('/contributors/account-alice?type=bot');
  await expect(page.getByRole('heading', { name: 'No accounts match this report' })).toBeVisible();
});
test('column help is the same on summary, repository and contribution tables and works by keyboard/tap', async ({
  page,
}, testInfo) => {
  await login(page);
  for (const [path, title] of [
    ['/repos', 'Current backlog'],
    ['/repos/prebidjs', 'Open pull requests'],
    ['/contributors', 'Contributors'],
  ] as const) {
    await page.goto(path);
    const button = page.getByRole('button', {
      name: 'Column definitions for ' + title,
      exact: true,
    });
    await button.focus();
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog', { name: title + ' column definitions', exact: true });
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveCSS('opacity', '1');
    await expect(dialog.getByRole('region', { name: 'Column definitions' })).toBeVisible();
    expect(
      (await new AxeBuilder({ page }).include('[role="dialog"]').analyze()).violations,
    ).toEqual([]);
    await page.keyboard.press('Escape');
    await expect(button).toBeFocused();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  }
  await page.setViewportSize({ width: 375, height: 900 });
  await page
    .getByRole('button', { name: 'Column definitions for Contributors', exact: true })
    .click();
  const mobileHelp = page.getByRole('dialog', {
    name: 'Contributors column definitions',
    exact: true,
  });
  await expect(mobileHelp).toBeVisible();
  await expect(mobileHelp).toHaveCSS('opacity', '1');
  expect((await new AxeBuilder({ page }).include('[role="dialog"]').analyze()).violations).toEqual(
    [],
  );
  await page.screenshot({ path: testInfo.outputPath('column-help-mobile.png') });
  await page.getByRole('button', { name: 'Close', exact: true }).click();
});
test('optional comments and every file/line status render and export with role and scope metadata', async ({
  page,
}, testInfo) => {
  await login(page);
  await page.goto('/contributors');
  const table = page.getByRole('table');
  await expect(table.locator('[data-column="authored.filesChanged"]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Columns', exact: true }).click();
  for (const name of [
    'Comment activity',
    'Authored merged PR volume',
    'Reviewed merged PR volume',
    'Approved merged PR volume',
  ])
    await page.getByRole('menuitemcheckbox', { name, exact: true }).click();
  await page.keyboard.press('Escape');
  for (const role of ['authored', 'reviewed', 'approved'])
    for (const stat of [
      'filesChanged',
      'filesAdded',
      'filesRemoved',
      'filesModified',
      'filesRenamed',
      'filesCopied',
      'filesTypeChanged',
      'linesChanged',
      'linesAdded',
      'linesRemoved',
    ])
      await expect(
        table.locator('tbody tr').first().locator(`[data-column="${role}.${stat}"]`),
      ).toBeAttached();
  await page.getByRole('textbox', { name: 'Search Contributors', exact: true }).fill('sample-bob');
  await expect(table.locator('tbody tr')).toHaveCount(1);
  await expect(table.locator('[data-column="reviewed.filesChanged"]')).toHaveText('16');
  await expect(table.locator('[data-column="reviewed.linesChanged"]')).toHaveText('280');
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export CSV', exact: true }).click();
  await page.getByRole('button', { name: 'Download CSV', exact: true }).click();
  const stream = await (await pending).createReadStream();
  if (!stream) throw Error('Missing CSV');
  let csv = '';
  for await (const chunk of stream) {
    if (!Buffer.isBuffer(chunk)) throw Error('Expected bytes');
    csv += chunk.toString('utf8');
  }
  expect(csv).toContain('Authored merged PR volume — Files modified');
  expect(csv).toContain('Reviewed merged PR volume — File type changes');
  expect(csv).toContain('Approved merged PR volume — Lines removed');
  expect(csv).toContain('Comment activity — PR comments');
  expect(csv).toContain('"Table search"');
  expect(csv).toContain('"sample-bob"');
  expect(csv.split('\r\n')).toHaveLength(2);
  await page.screenshot({
    path: testInfo.outputPath('optional-contribution-columns.png'),
    fullPage: true,
  });
});
