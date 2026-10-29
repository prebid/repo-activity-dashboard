import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
async function login(page: Page) {
  await page.goto('/auth/login');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/repos$/);
}
async function csvDownload(page: Page, name: string) {
  if (name === 'Export CSV') {
    await page.getByRole('button', { name, exact: true }).click();
    name = 'Download CSV';
  }
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name, exact: true }).click();
  const stream = await (await pending).createReadStream();
  let text = '';
  for await (const chunk of stream) text += String(chunk);
  return text;
}
test('names open internal reports, handles open GitHub and company credits retain scope and parent search', async ({
  page,
}) => {
  await login(page);
  await page.goto('/contributors');
  const alice = page.getByRole('link', { name: 'Alice — view contribution report', exact: true });
  await expect(alice).toHaveText('Alice');
  await expect(page.getByRole('link', { name: /@sample-alice — GitHub profile/ })).toHaveAttribute(
    'href',
    'https://github.example/sample-alice',
  );
  await expect(page.getByText('View report', { exact: true })).toHaveCount(0);
  await expect(page.getByTitle('Human', { exact: true }).first().locator('svg')).toHaveCount(1);
  await expect(page.getByTitle('Prebid agent', { exact: true }).locator('svg')).toHaveCount(1);
  await expect(page.getByTitle('Bot', { exact: true }).locator('svg')).toHaveCount(1);
  await alice.click();
  await expect(page.getByRole('heading', { name: 'Alice', level: 1 })).toBeVisible();
  await page.goto('/companies?period=this-year&repo=repo-prebidjs&type=human');
  await page.getByRole('textbox', { name: 'Search Companies' }).fill('Acme');
  await page
    .getByRole('table')
    .getByRole('link', { name: 'Reviewer contributions: 4 — view supporting records', exact: true })
    .click();
  await expect(
    page.getByRole('region', { name: 'Supporting record totals' }).locator('dd'),
  ).toHaveText(['4', '4', '3']);
  expect(new URL(page.url()).searchParams.getAll('repo')).toEqual(['repo-prebidjs']);
  expect(new URL(page.url()).searchParams.getAll('type')).toEqual(['human']);
  expect(new URL(page.url()).searchParams.get('returnTo')).toContain('report.q=Acme');
  const table = page.getByRole('table');
  await expect(table.locator('tbody tr')).toHaveCount(4);
  await expect(table.getByRole('link', { name: /#102 / })).toHaveCount(2);
  await page.reload();
  await expect(table.locator('tbody tr')).toHaveCount(4);
  await page.getByRole('link', { name: 'Back to report', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Search Companies' })).toHaveValue('Acme');
  await page.goBack();
  await expect(page.getByRole('region', { name: 'Supporting record totals' })).toBeVisible();
});
test('agent PR/issue details keep historical records, 50-row pagination and full scoped exports', async ({
  page,
}) => {
  await login(page);
  const scope =
    'sample=large&period=this-month&repo=repo-prebidjs&type=agent&population=selected&account=account-heavy-agent';
  await page.goto('/contributors?' + scope);
  await page
    .getByRole('table')
    .getByRole('link', { name: 'PRs authored: 240 — view supporting records', exact: true })
    .click();
  await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(50);
  await expect(page.getByText('Page 1 of 5', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByText('Page 2 of 5', { exact: true })).toBeVisible();
  const csv = await csvDownload(page, 'Export CSV');
  expect(csv.split('\r\n')).toHaveLength(241);
  expect(csv).toContain('Closed');
  expect(csv).toContain('Draft');
  expect(csv).toContain('"Full report total"');
  await page.getByRole('textbox', { name: 'Search PRs authored' }).fill('closed without merging');
  await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(1);
  const filtered = await csvDownload(page, 'Export CSV');
  expect(filtered.split('\r\n')).toHaveLength(2);
  await page.goto('/contributors/account-heavy-agent?' + scope + '&metric=issuesAuthored');
  await expect(page.getByText('Page 1 of 7', { exact: true })).toBeVisible();
  await expect(
    page.getByRole('region', { name: 'Supporting record totals' }).locator('dd'),
  ).toHaveText(['350', '350', '350']);
  const issues = await csvDownload(page, 'Export CSV');
  expect(issues.split('\r\n')).toHaveLength(351);
});
test('optional comment and final merged volume drilldowns reconcile with their separate summary measures', async ({
  page,
}) => {
  await login(page);
  await page.goto('/contributors?period=this-year&type=human');
  await page.getByRole('button', { name: 'Columns', exact: true }).click();
  await page.getByRole('menuitemcheckbox', { name: 'Comment activity', exact: true }).click();
  await page
    .getByRole('menuitemcheckbox', { name: 'Reviewed merged PR volume', exact: true })
    .click();
  await page.keyboard.press('Escape');
  const alice = page
    .getByRole('table')
    .locator('tbody tr')
    .filter({
      has: page.getByRole('link', { name: 'Alice — view contribution report', exact: true }),
    });
  await alice
    .getByRole('link', {
      name: 'Reviewed merged PR volume — Files changed: 6 — view supporting records',
      exact: true,
    })
    .click();
  await expect(
    page.getByRole('region', { name: 'Supporting record totals' }).locator('dd'),
  ).toHaveText(['6', '1', '1']);
  await expect(page.getByRole('table').getByRole('button', { name: /Merged on/ })).toBeVisible();
  await expect(page.getByRole('table').locator('tbody tr')).toContainText('Sep 6, 2026');
  await page.getByRole('link', { name: 'Back to report', exact: true }).click();
  await alice
    .getByRole('link', {
      name: 'Comment activity — PR comments: 3 — view supporting records',
      exact: true,
    })
    .click();
  await expect(
    page.getByRole('region', { name: 'Supporting record totals' }).locator('dd'),
  ).toHaveText(['3', '3', '3']);
  await expect(
    page.getByRole('table').getByRole('button', { name: 'Last comment', exact: true }),
  ).toBeVisible();
});
test('selected-metric flat exports match filtered totals beyond the first page and retain exclusions', async ({
  page,
}) => {
  await login(page);
  await page.goto(
    '/companies/id/company-acme?sample=large&period=this-month&repo=repo-prebidjs&population=selected&company=company-acme&exclude=account-person-001',
  );
  await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(50);
  await expect(
    page.getByRole('region', { name: 'Report totals' }).locator('dd').first(),
  ).toHaveText('5');
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(49);
  await page.getByRole('button', { name: 'Export CSV', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: /CSV export$/ });
  await dialog.getByRole('radio', { name: 'By repository', exact: true }).check();
  await dialog.getByRole('button', { name: 'Clear selection', exact: true }).click();
  await dialog.getByRole('checkbox', { name: 'PRs authored', exact: true }).check();
  const csv = await csvDownload(page, 'Download CSV');
  const lines = csv.split('\r\n');
  expect(lines).toHaveLength(6);
  expect(csv).toContain('"repo-prebidjs"');
  expect(csv).not.toContain('"sample-person-001"');
  expect(csv).toContain('account-person-001');
  expect(csv).not.toContain('"Approval contributions"');
  // Flat CSV has nine identity columns before the selected numeric metric.
  expect(
    lines.slice(1).reduce((sum, line) => sum + Number(line.split(',')[9].replaceAll('"', '')), 0),
  ).toBe(5);
});
test('supporting lists and export controls remain accessible in both themes and on mobile', async ({
  page,
}, info) => {
  await login(page);
  await page.goto('/companies/id/company-acme?period=this-year&metric=approvalContributions');
  await expect(page.getByRole('table')).toBeVisible();
  expect((await new AxeBuilder({ page }).include('main').analyze()).violations).toEqual([]);
  await page.screenshot({ path: info.outputPath('company-credit-details.png'), fullPage: true });
  await page.setViewportSize({ width: 375, height: 900 });
  await page.getByRole('button', { name: 'Theme settings', exact: true }).click();
  await page.getByRole('menuitemradio', { name: 'Light', exact: true }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  expect((await new AxeBuilder({ page }).include('main').analyze()).violations).toEqual([]);
  await page.screenshot({
    path: info.outputPath('contribution-details-mobile.png'),
    fullPage: true,
  });
  await page.goto('/companies?sample=large');
  await page.getByRole('button', { name: 'Columns', exact: true }).click();
  await page
    .getByRole('menuitemcheckbox', { name: 'Authored merged PR volume', exact: true })
    .click();
  await page.keyboard.press('Escape');
  expect((await new AxeBuilder({ page }).include('main').analyze()).violations).toEqual([]);
  await page.goto('/contributors?period=this-year');
  await page.getByRole('button', { name: 'Export CSV', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: /CSV export$/ });
  await expect(dialog).toHaveCSS('opacity', '1');
  await expect(dialog.getByRole('button', { name: 'Download CSV' })).toBeInViewport();
  expect((await new AxeBuilder({ page }).include('[role="dialog"]').analyze()).violations).toEqual(
    [],
  );
  await page.screenshot({ path: info.outputPath('contribution-export-mobile.png') });
});

test('focused repository results and CSV column choices omit only confirmed-zero repositories', async ({
  page,
}, info) => {
  await login(page);
  await page.goto('/contributors/account-alice?period=this-year');
  const table = page.getByRole('table');
  await expect(table.locator('tbody tr')).toHaveCount(2);
  await expect(table).toContainText('Prebid.js');
  await expect(table).toContainText('Prebid Server (Go)');
  await expect(table).not.toContainText('OpenRTB');
  await expect(page.getByRole('button', { name: /Choose repositories 18 \/ 18/ })).toBeVisible();
  const visible = await csvDownload(page, 'Export CSV');
  expect(visible.split('\r\n')).toHaveLength(3);
  expect(visible).not.toContain('Comment activity — Inline comments');
  await page.getByRole('button', { name: 'Export CSV', exact: true }).click();
  await expect(page.getByRole('radio', { name: 'By repository', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'All columns', exact: true }).click();
  const all = await csvDownload(page, 'Download CSV');
  expect(all.split('\r\n')).toHaveLength(3);
  expect(all).toContain('Comment activity — Inline comments');
  await expect(
    page.getByRole('table').locator('th').filter({ hasText: 'Inline comments' }),
  ).toHaveCount(0);
  await page.screenshot({
    path: info.outputPath('contributor-concise-repositories.png'),
    fullPage: true,
  });
  await page.goto('/companies/id/company-acme?period=this-year&view=repositories');
  await expect(table.locator('tbody tr')).toHaveCount(2);
  await page.goto('/contributors/account-alice?period=custom&from=2026-10-01&through=2026-10-01');
  await expect(table.locator('tbody tr')).toHaveCount(1);
  await expect(table).toContainText('Prebid.js');
  await page.goto('/contributors/account-eve?period=this-year');
  await expect(
    page.getByRole('heading', { name: 'No counted contributions in this period' }),
  ).toBeVisible();
  await page.goto('/contributors/account-alice?sample=missing&period=this-year');
  await expect(table.locator('tbody tr')).toHaveCount(18);
  await expect(page.getByLabel('Data coverage')).toBeVisible();
});
