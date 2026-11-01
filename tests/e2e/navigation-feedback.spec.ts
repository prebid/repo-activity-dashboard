import { test, expect } from './fixtures';
import type { Locator, Page } from '@playwright/test';
import { inventory, type InventoryId } from '../support/views';
import { pageTitles } from '../support/page-titles';

type Theme = 'light' | 'dark';

async function login(page: Page, theme: Theme) {
  await page.goto('/auth/login');
  await page.evaluate((value) => localStorage.setItem('dashboard-theme', value), theme);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/repos$/);
}
async function open(page: Page, id: InventoryId, theme: Theme) {
  await page.goto(inventory.find((view) => view.id === id)!.path);
  await expect(page.locator('html')).toHaveClass(new RegExp('\\b' + theme + '\\b'));
  // A click before hydration would be a document load, not a client navigation.
  await expect(page.getByRole('button', { name: 'Theme settings', exact: true })).toBeEnabled();
  await expect(page.locator('main table th button').first()).toBeEnabled();
}
/** Holds every non-prefetch RSC response until `release`, so the navigations awaiting them stay pending. */
async function holdNavigations(page: Page) {
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  let requests = 0;
  await page.route(
    (url) => url.searchParams.has('_rsc'),
    async (route) => {
      if (route.request().headers()['next-router-prefetch'] !== '1') {
        requests++;
        await held;
      }
      await route.continue();
    },
  );
  return {
    requests: () => requests,
    release: () => release(),
    async end() {
      release();
      await page.unrouteAll({ behavior: 'wait' });
    },
  };
}
/** Boxes of the elements beside `link`, which its pending bar must leave in place. */
function siblingBoxes(link: Locator) {
  return link.evaluate((element) =>
    [...(element.parentElement?.children ?? [])]
      .filter((sibling) => sibling !== element)
      .map((sibling) => {
        const { x, y, width, height } = sibling.getBoundingClientRect();
        return [x, y, width, height];
      }),
  );
}
/**
 * The pending bar's box, its link's box, and the bar's contrast with the surface it is drawn on:
 * the first opaque background from the link outward, with any translucent ones above it composited.
 */
function pendingBar(link: Locator) {
  return link.evaluate((element) => {
    const bar = element.querySelector(':scope > [data-link-pending]');
    if (!bar) throw new Error('The link has no pending bar');
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('Missing color conversion context');
    /** Paints `color` over the pixel and returns the pixel. */
    const paint = (color: string) => {
      context.fillStyle = '#010203';
      context.fillStyle = color;
      if (context.fillStyle === '#010203') throw new Error('Unparsed color ' + color);
      context.fillRect(0, 0, 1, 1);
      return [...context.getImageData(0, 0, 1, 1).data];
    };
    const opaque = (color: string) => {
      context.clearRect(0, 0, 1, 1);
      return paint(color)[3] === 255;
    };
    const layers: string[] = [];
    for (let node: Element | null = element; node; node = node.parentElement) {
      const color = getComputedStyle(node).backgroundColor;
      layers.unshift(color);
      if (opaque(color)) break;
    }
    if (!opaque(layers[0])) throw new Error('No opaque surface behind the pending bar');
    context.clearRect(0, 0, 1, 1);
    let surface: number[] = [];
    for (const color of layers) surface = paint(color);
    const ink = paint(getComputedStyle(bar).backgroundColor);
    const luminance = (pixel: number[]) => {
      const [r, g, b] = pixel.slice(0, 3).map((channel) => {
        const value = channel / 255;
        return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const [lighter, darker] = [luminance(surface), luminance(ink)].sort((a, b) => b - a);
    const box = (rect: DOMRect) => ({
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      left: rect.left,
      height: rect.height,
    });
    return {
      link: box(element.getBoundingClientRect()),
      bar: box(bar.getBoundingClientRect()),
      contrast: (lighter + 0.05) / (darker + 0.05),
    };
  });
}
/**
 * Clicks `link` while the destination's RSC response is held: its indicator is pending until the
 * response is released and the destination's title shows. While held, the bar is a 2px line
 * inside the link with 3:1 contrast against the surface behind it, its neighbours keep their
 * place, and it sweeps unless reduced motion is requested. A link the destination keeps, such as
 * a tab, is idle again; a back link is gone with the page it sat on.
 */
async function followHeld(
  page: Page,
  link: Locator,
  title: string,
  { replaced = false, reducedMotion = false }: { replaced?: boolean; reducedMotion?: boolean } = {},
) {
  const hold = await holdNavigations(page);
  try {
    const indicator = link.locator('[data-link-pending]');
    await expect(indicator).toHaveAttribute('data-pending', 'false');
    await link.scrollIntoViewIfNeeded();
    const siblings = await siblingBoxes(link);
    await link.click();
    await expect.poll(hold.requests).toBeGreaterThan(0);
    await expect(indicator).toHaveAttribute('data-pending', 'true');
    await expect(link).toHaveCSS('cursor', 'progress');
    if (reducedMotion) await expect(indicator).toHaveCSS('animation-name', 'none');
    else await expect(indicator).not.toHaveCSS('animation-name', 'none');
    const geometry = await pendingBar(link);
    expect(geometry.bar.height).toBeCloseTo(2, 3);
    expect(geometry.bar.left).toBeGreaterThanOrEqual(geometry.link.left - 0.01);
    expect(geometry.bar.right).toBeLessThanOrEqual(geometry.link.right + 0.01);
    expect(geometry.bar.top).toBeGreaterThanOrEqual(geometry.link.top - 0.01);
    expect(geometry.bar.bottom).toBeLessThanOrEqual(geometry.link.bottom + 0.01);
    expect(geometry.contrast).toBeGreaterThanOrEqual(3);
    expect(await siblingBoxes(link)).toEqual(siblings);
    hold.release();
    await expect(page).toHaveTitle(title);
    await expect(page.locator('[data-link-pending][data-pending="true"]')).toHaveCount(0);
    if (replaced) await expect(link).toHaveCount(0);
    else await expect(indicator).toHaveAttribute('data-pending', 'false');
  } finally {
    await hold.end();
  }
}

for (const theme of ['light', 'dark'] as const)
  test.describe(theme === 'light' ? 'Light' : 'Dark', () => {
    test.beforeEach(async ({ page }) => {
      await login(page, theme);
    });
    test('Summary to Timeline marks the Timeline tab until the timeline arrives', async ({
      page,
    }) => {
      await open(page, 'repos-overview', theme);
      await followHeld(
        page,
        page
          .getByRole('navigation', { name: 'Repository overview views', exact: true })
          .getByRole('link', { name: 'Timeline', exact: true }),
        pageTitles['repos-timeline'],
      );
    });
    test('a main navigation item stays marked until its page arrives', async ({ page }) => {
      await open(page, 'repos-overview', theme);
      await followHeld(
        page,
        page
          .getByRole('navigation', { name: 'Main navigation', exact: true })
          .getByRole('link', { name: 'Contributions', exact: true }),
        pageTitles.contributors,
      );
    });
    test('a breadcrumb back link stays marked until the parent page replaces it', async ({
      page,
    }) => {
      await open(page, 'repo-detail', theme);
      await followHeld(
        page,
        page.getByRole('link', { name: 'All repositories', exact: true }),
        pageTitles['repos-summary'],
        { replaced: true },
      );
    });
    test('Report to Over time marks Over time, whose handler navigates', async ({ page }) => {
      await open(page, 'contributors', theme);
      await followHeld(
        page,
        page
          .getByRole('navigation', { name: 'Report view', exact: true })
          .getByRole('link', { name: 'Over time', exact: true }),
        pageTitles['contributors-timeline'],
      );
    });
    for (const [origin, id] of [
      ['a record list', 'repo-detail'],
      ['an insight view', 'repo-authors-metric'],
    ] as const)
      test('the repository Timeline tab is marked from ' + origin, async ({ page }) => {
        await open(page, id, theme);
        await followHeld(
          page,
          page
            .getByRole('navigation', { name: 'Repository lists', exact: true })
            .getByRole('link', { name: 'Timeline', exact: true }),
          pageTitles['repo-timeline'],
        );
      });
    test('Contributors to Companies marks the Companies tab', async ({ page }) => {
      await open(page, 'contributors', theme);
      await followHeld(
        page,
        page
          .getByRole('navigation', { name: 'Contribution reports', exact: true })
          .getByRole('link', { name: /^Companies/ }),
        pageTitles.companies,
      );
    });
    test('a company breakdown link stays marked until its view arrives', async ({ page }) => {
      await open(page, 'company-detail', theme);
      await followHeld(
        page,
        page
          .getByRole('navigation', { name: 'Company breakdown', exact: true })
          .getByRole('link', { name: 'By repository', exact: true }),
        pageTitles['company-repositories'],
      );
    });
  });

test('the pending bar holds still under reduced motion', async ({ page }) => {
  await login(page, 'dark');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page, 'repos-overview', 'dark');
  await followHeld(
    page,
    page
      .getByRole('navigation', { name: 'Repository overview views', exact: true })
      .getByRole('link', { name: 'Timeline', exact: true }),
    pageTitles['repos-timeline'],
    { reducedMotion: true },
  );
});
test('a link clicked during a handler navigation takes over the only pending bar', async ({
  page,
}) => {
  await login(page, 'dark');
  await open(page, 'contributors', 'dark');
  const tabs = page.getByRole('navigation', { name: 'Report view', exact: true });
  const overTime = tabs.getByRole('link', { name: 'Over time', exact: true });
  const report = tabs.getByRole('link', { name: 'Report', exact: true });
  const pending = page.locator('[data-link-pending][data-pending="true"]');
  const hold = await holdNavigations(page);
  try {
    await overTime.click();
    await expect(overTime.locator('[data-link-pending]')).toHaveAttribute('data-pending', 'true');
    // Report's own navigation is held too, so both navigations are in flight together.
    await report.click();
    await expect.poll(hold.requests).toBeGreaterThan(1);
    await expect(report.locator('[data-link-pending]')).toHaveAttribute('data-pending', 'true');
    await expect(pending).toHaveCount(1);
    await expect(overTime.locator('[data-link-pending]')).toHaveAttribute('data-pending', 'false');
    hold.release();
    await expect(pending).toHaveCount(0);
    await expect(page).toHaveURL((url) => !url.searchParams.has('timeline'));
    await expect(page).toHaveTitle(pageTitles.contributors);
  } finally {
    await hold.end();
  }
});
test('the click feedback stories show the bar on every link when pending and on none when idle', async ({
  page,
}) => {
  const count = async (story: 'idle' | 'pending', state: 'true' | 'false') => {
    await page.goto(
      `http://127.0.0.1:6007/iframe.html?id=navigation-click-feedback--${story}&viewMode=story`,
    );
    const section = page.getByRole('region', {
      name: story === 'pending' ? 'Pending links' : 'Idle links',
      exact: true,
    });
    await expect(section.locator('[data-link-pending]').first()).toBeAttached();
    return section.locator(`[data-link-pending][data-pending="${state}"]`).count();
  };
  const links = await count('pending', 'true');
  expect(links).toBeGreaterThan(0);
  expect(await count('pending', 'false')).toBe(0);
  expect(await count('idle', 'false')).toBe(links);
  expect(await count('idle', 'true')).toBe(0);
});
