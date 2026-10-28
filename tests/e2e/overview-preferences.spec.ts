import { test, expect } from './fixtures';
import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';

async function login(page: Page, email?: string) {
  await page.goto('/auth/login');
  if (email) await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/repos$/);
  await expect(page.getByRole('heading', { name: 'All repositories', exact: true })).toBeVisible();
}
function row(page: Page, title: string, name = 'Prebid.js') {
  return page
    .getByRole('table', { name: title, exact: true })
    .getByRole('row')
    .filter({ has: page.getByRole('link', { name, exact: true }) });
}
async function selectRepositories(page: Page, names: string[]) {
  await page.getByRole('button', { name: /^Choose repositories/ }).click();
  const dialog = page.getByRole('dialog', { name: 'Choose repositories', exact: true });
  await dialog.getByRole('button', { name: 'Clear selection', exact: true }).click();
  for (const name of names) await dialog.getByRole('checkbox', { name, exact: true }).check();
  await dialog.getByRole('button', { name: 'Apply selection', exact: true }).click();
  await expect(dialog).toHaveCount(0);
}

async function chooseAges(page: Page, selected: number[]) {
  await page.getByRole('button', { name: 'PR age', exact: true }).click();
  const menu = page.getByRole('menu', { name: 'PR age', exact: true });
  for (const days of [30, 60, 90, 120, 180, 360]) {
    const option = menu.getByRole('menuitemcheckbox', {
      name: 'Over ' + days + ' days',
      exact: true,
    });
    if (((await option.getAttribute('aria-checked')) === 'true') !== selected.includes(days))
      await option.click();
  }
  await page.keyboard.press('Escape');
}
async function expectAges(page: Page, selected: number[]) {
  const backlog = page.getByRole('table', { name: 'Current backlog', exact: true });
  for (const days of [30, 60, 90, 120, 180, 360])
    await expect(
      backlog
        .locator('th')
        .filter({ has: page.getByRole('button', { name: new RegExp('^Over ' + days + ' days') }) }),
    ).toHaveCount(selected.includes(days) ? 1 : 0);
}

test('aging columns can be combined, sorted, saved, or all hidden', async ({ page }, testInfo) => {
  await login(page);
  await expect(page.getByRole('combobox', { name: 'PR aging threshold' })).toHaveCount(0);
  await chooseAges(page, [30, 90, 180]);
  await expectAges(page, [30, 90, 180]);
  const backlog = page.getByRole('region', { name: 'Current backlog', exact: true });
  await expect(backlog.getByRole('columnheader', { name: 'PR age', exact: true })).toHaveAttribute(
    'colspan',
    '3',
  );
  await expect(row(page, 'Current backlog').locator('[data-column="agedPrs30"]')).toHaveText('90');
  await expect(row(page, 'Current backlog').locator('[data-column="agedPrs90"]')).toHaveText('30');
  await expect(row(page, 'Current backlog').locator('[data-column="agedPrs180"]')).toHaveText('0');
  await backlog.getByRole('button', { name: 'Over 90 days', exact: true }).click();
  await expect(page).toHaveURL(/backlog.sort=agedPrs90/);
  await page.goto('/repos');
  await expectAges(page, [30, 90, 180]);
  await expect(
    backlog.getByRole('columnheader', { name: 'Over 90 days ↑', exact: true }),
  ).toHaveAttribute('aria-sort', 'ascending');
  await chooseAges(page, []);
  await expect(backlog.getByRole('columnheader', { name: 'PR age', exact: true })).toHaveCount(0);
  await page.goto('/repos');
  await expectAges(page, []);
  await expect(backlog.getByRole('columnheader', { name: 'PR age', exact: true })).toHaveCount(0);
  await backlog.getByRole('button', { name: 'Columns', exact: true }).click();
  await page.getByRole('menuitemcheckbox', { name: 'PR age', exact: true }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('menu', { name: 'Columns', exact: true })).toHaveCount(0);
  await expectAges(page, [30, 60, 90, 120, 180, 360]);
  await backlog.getByRole('button', { name: 'PR age', exact: true }).click();
  for (const days of [30, 60, 90, 120, 180, 360])
    await expect(
      page
        .getByRole('menu', { name: 'PR age', exact: true })
        .getByRole('menuitemcheckbox', { name: 'Over ' + days + ' days', exact: true }),
    ).toHaveAttribute('aria-checked', 'true');
  expect((await new AxeBuilder({ page }).include('[role="menu"]').analyze()).violations).toEqual(
    [],
  );
  await page.screenshot({ path: testInfo.outputPath('aging-columns-menu.png') });
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Reset view', exact: true }).click();
  await expectAges(page, [30]);
});

test('scope controls, separate table choices and account defaults survive a direct return', async ({
  page,
}) => {
  await login(page);
  await selectRepositories(page, ['Prebid.js', 'SalesAgent']);
  for (const title of ['Current backlog', 'Period activity'])
    await expect(page.getByRole('table', { name: title }).locator('tbody tr')).toHaveCount(2);
  await chooseAges(page, [90]);
  await page.getByRole('combobox', { name: 'Activity timeframe' }).selectOption('this-week');
  await page.getByRole('checkbox', { name: 'Show change' }).check();
  await expect(row(page, 'Current backlog').locator('[data-column="agedPrs90"]')).toHaveText('30');
  await expect(row(page, 'Current backlog').locator('[data-column="totalOpenPrs"]')).toHaveText(
    '137',
  );
  await expect(row(page, 'Period activity').locator('[data-column="prsOpened"]')).toContainText(
    '12',
  );
  await expect(row(page, 'Period activity').locator('[data-column="prsOpened"]')).toContainText(
    '+2',
  );
  const backlog = page.getByRole('region', { name: 'Current backlog', exact: true });
  await backlog.getByRole('button', { name: 'Columns', exact: true }).click();
  await page.getByRole('menuitemcheckbox', { name: 'Human feedback', exact: true }).click();
  await page.keyboard.press('Escape');
  await backlog.getByRole('button', { name: 'Total open PRs', exact: true }).click();
  await backlog.getByRole('button', { name: 'Total open PRs ↑', exact: true }).click();
  await page.goto('/repos');
  await expectAges(page, [90]);
  await expect(page.getByRole('combobox', { name: 'Activity timeframe' })).toHaveValue('this-week');
  await expect(page.getByRole('checkbox', { name: 'Show change' })).toBeChecked();
  await expect(
    backlog.getByRole('columnheader', { name: 'Human feedback', exact: true }),
  ).toBeVisible();
  await expect(
    backlog.getByRole('columnheader', { name: 'Total open PRs ↓', exact: true }),
  ).toHaveAttribute('aria-sort', 'descending');
  await expect(
    page.getByRole('table', { name: 'Period activity' }).locator('tbody tr'),
  ).toHaveCount(2);
  expect(new URL(page.url()).search).toBe('');

  await page.getByRole('button', { name: 'Theme settings', exact: true }).click();
  await page.getByRole('menuitemradio', { name: 'Light', exact: true }).click();
  await page.getByRole('button', { name: 'Reset view', exact: true }).click();
  await expectAges(page, [30]);
  await expect(page.getByRole('combobox', { name: 'Activity timeframe' })).toHaveValue(
    'this-month',
  );
  await expect(
    backlog.getByRole('columnheader', { name: 'Human feedback', exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('table', { name: 'Current backlog' }).locator('tbody tr'),
  ).toHaveCount(18);
  await expect(page.locator('html')).toHaveClass(/light/);
  await page.goBack();
  await expectAges(page, [90]);
  await expect(
    backlog.getByRole('columnheader', { name: 'Total open PRs ↓', exact: true }),
  ).toHaveAttribute('aria-sort', 'descending');
  await expect(
    page.getByRole('table', { name: 'Current backlog' }).locator('tbody tr'),
  ).toHaveCount(2);
  await page.goto('/repos');
  await expectAges(page, [30]);
  await expect(
    page.getByRole('table', { name: 'Current backlog' }).locator('tbody tr'),
  ).toHaveCount(18);
});

test('browser history, explicit URLs and empty selections keep their meaning without table search', async ({
  page,
}) => {
  await login(page);
  await page.getByRole('combobox', { name: 'Activity timeframe' }).selectOption('this-week');
  await chooseAges(page, [30, 60]);
  await page.goBack();
  await expectAges(page, [30]);
  await expect(page.getByRole('combobox', { name: 'Activity timeframe' })).toHaveValue('this-week');
  await page.goBack();
  await expect(page.getByRole('combobox', { name: 'Activity timeframe' })).toHaveValue(
    'this-month',
  );
  await page.goForward();
  await expect(page.getByRole('combobox', { name: 'Activity timeframe' })).toHaveValue('this-week');
  await page.goto('/repos?backlog.q=missing&activity.q=missing');
  await expect(page.getByPlaceholder('Find in table…')).toHaveCount(0);
  for (const title of ['Current backlog', 'Period activity'])
    await expect(page.getByRole('table', { name: title }).locator('tbody tr')).toHaveCount(18);
  await chooseAges(page, [120]);
  expect(new URL(page.url()).searchParams.has('backlog.q')).toBe(false);
  expect(new URL(page.url()).searchParams.has('activity.q')).toBe(false);
  await page.goto(
    '/repos?repo=repo-prebidjs&repo=repo-prebidjs&period=last-month&age=180&change=0',
  );
  await expect(page.getByRole('combobox', { name: 'Activity timeframe' })).toHaveValue(
    'last-month',
  );
  await expectAges(page, [180]);
  await expect(
    page.getByRole('table', { name: 'Period activity' }).locator('tbody tr'),
  ).toHaveCount(1);
  await selectRepositories(page, []);
  await expect(
    page.getByRole('heading', { name: 'No repositories selected', exact: true }),
  ).toBeVisible();
  await page.goto('/repos');
  await expect(
    page.getByRole('heading', { name: 'No repositories selected', exact: true }),
  ).toBeVisible();
  await page.goto('/repos?repo=unknown&period=bad&age=31');
  await expect(
    page.getByText('The timeframe in this link is invalid. Showing This month.'),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'No repositories selected', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Reset view', exact: true }).click();
  await expect(
    page.getByRole('table', { name: 'Current backlog' }).locator('tbody tr'),
  ).toHaveCount(18);
});

test('saved page preferences remain separate for Alice and Bob', async ({ page }) => {
  await login(page);
  await selectRepositories(page, ['SalesAgent']);
  await chooseAges(page, [360]);
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page).toHaveURL(/\/auth\/login/);
  await login(page, 'bob@example.test');
  await expect(
    page.getByRole('table', { name: 'Current backlog' }).locator('tbody tr'),
  ).toHaveCount(18);
  await expectAges(page, [30]);
  await selectRepositories(page, ['Prebid.js']);
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page).toHaveURL(/\/auth\/login/);
  await login(page, 'alice@example.test');
  await expectAges(page, [360]);
  await expect(
    page.getByRole('table', { name: 'Current backlog' }).locator('tbody tr'),
  ).toHaveCount(1);
  await expect(row(page, 'Current backlog', 'SalesAgent')).toBeVisible();
});

test('custom dates validate and show prepared or missing values without changing backlog', async ({
  page,
}) => {
  await login(page);
  await page.getByRole('combobox', { name: 'Activity timeframe' }).selectOption('custom');
  const dialog = page.getByRole('dialog', { name: 'Custom date range', exact: true });
  await dialog.getByLabel('Start date', { exact: true }).fill('2026-10-09');
  await dialog.getByLabel('End date', { exact: true }).fill('2026-10-06');
  await dialog.getByRole('button', { name: 'Apply dates', exact: true }).click();
  await expect(dialog.getByRole('alert')).toBeVisible();
  await dialog.getByLabel('Start date', { exact: true }).fill('2026-10-06');
  await dialog.getByLabel('End date', { exact: true }).fill('2026-10-08');
  await dialog.getByRole('button', { name: 'Apply dates', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(row(page, 'Period activity').locator('[data-column="prsOpened"]')).toHaveText('7');
  await expect(row(page, 'Current backlog').locator('[data-column="totalOpenPrs"]')).toHaveText(
    '137',
  );
  await page.goto('/repos');
  await expect(page.getByRole('combobox', { name: 'Activity timeframe' })).toHaveValue('custom');
  await page.getByRole('button', { name: 'Edit dates', exact: true }).click();
  await expect(dialog.getByLabel('Start date', { exact: true })).toHaveValue('2026-10-06');
  await dialog.getByLabel('Start date', { exact: true }).fill('2026-10-01');
  await dialog.getByLabel('End date', { exact: true }).fill('2026-10-02');
  await dialog.getByRole('button', { name: 'Apply dates', exact: true }).click();
  await expect(page.getByText(/No prepared sample data for this date range/)).toBeVisible();
  await expect(row(page, 'Period activity').locator('[data-column="prsOpened"]')).toContainText(
    '—',
  );
  await expect(row(page, 'Current backlog').locator('[data-column="totalOpenPrs"]')).toHaveText(
    '137',
  );
});

test('selectors remain usable without browser storage', async ({ context, page }) => {
  await context.addInitScript(() => {
    for (const method of ['getItem', 'setItem', 'removeItem'] as const)
      Storage.prototype[method] = () => {
        throw new DOMException('Storage disabled', 'SecurityError');
      };
  });
  await login(page);
  await expect(page.getByText('Settings apply for this visit only.')).toBeVisible();
  await chooseAges(page, [60]);
  await expect(row(page, 'Current backlog').locator('[data-column="agedPrs60"]')).toHaveText('60');
  await selectRepositories(page, []);
  await expect(
    page.getByRole('heading', { name: 'No repositories selected', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Reset view', exact: true }).click();
  await expect(
    page.getByRole('table', { name: 'Current backlog' }).locator('tbody tr'),
  ).toHaveCount(18);
});

test('repository and date dialogs preserve the design, keyboard focus and accessible narrow layouts', async ({
  page,
}, testInfo) => {
  await login(page);
  for (const theme of ['dark', 'light']) {
    await page.getByRole('button', { name: 'Theme settings', exact: true }).click();
    await page
      .getByRole('menuitemradio', { name: theme === 'dark' ? 'Dark' : 'Light', exact: true })
      .click();
    for (const width of [1280, 320]) {
      await page.setViewportSize({ width, height: 900 });
      const trigger = page.getByRole('button', { name: /^Choose repositories/ });
      await trigger.focus();
      await page.keyboard.press('Enter');
      const dialog = page.getByRole('dialog', { name: 'Choose repositories', exact: true });
      await expect(dialog.getByRole('textbox', { name: 'Search repositories' })).toBeFocused();
      await expect(dialog).toHaveCSS('opacity', '1');
      const box = await dialog.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(width);
      expect(
        (await new AxeBuilder({ page }).include('[role="dialog"]').analyze()).violations,
      ).toEqual([]);
      await page.screenshot({
        path: testInfo.outputPath('repositories-' + theme + '-' + width + '.png'),
      });
      await page.keyboard.press('Escape');
      await expect(dialog).toHaveCount(0);
      await expect(trigger).toBeFocused();
      const timeframe = page.getByRole('combobox', { name: 'Activity timeframe' });
      await timeframe.selectOption('custom');
      const dates = page.getByRole('dialog', { name: 'Custom date range', exact: true });
      await expect(dates.getByLabel('Start date', { exact: true })).toBeFocused();
      await expect(dates).toHaveCSS('opacity', '1');
      expect(
        (await new AxeBuilder({ page }).include('[role="dialog"]').analyze()).violations,
      ).toEqual([]);
      await page.screenshot({ path: testInfo.outputPath('dates-' + theme + '-' + width + '.png') });
      await page.keyboard.press('Escape');
      await expect(dates).toHaveCount(0);
      await expect(timeframe).toBeFocused();
    }
  }
});
