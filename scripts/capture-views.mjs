import { existsSync, realpathSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { chromium } from '@playwright/test';
import { inventory, viewsFor } from '../tests/support/views.ts';

/** @typedef {import('../tests/support/views.ts').InventoryView} InventoryView */
/** @typedef {import('@playwright/test').Browser} Browser */
/** @typedef {import('@playwright/test').Page} Page */
/** @typedef {'light' | 'dark'} Theme */
/** @typedef {{ base: URL, out: string, measure: boolean, views: readonly InventoryView[], widths: readonly number[], themes: readonly Theme[] }} CaptureOptions */
/** @typedef {{ view: InventoryView, theme: Theme, width: number, height: number, file: string, fullPage: string }} CaptureCell */
/** @typedef {Awaited<ReturnType<typeof measureView>>} ViewMeasurement */
/** What a run was doing when it stopped. @typedef {{ stage: 'launch' | 'measure' } | { stage: 'setup', theme: Theme, access: 'signed-in' | 'signed-out' }} RunStep */
/** @typedef {(RunStep & { reason: string }) | { stage: 'cell', id: string, theme: Theme, width: number, reason: string }} CaptureFailure */

const repositoryRoot = fileURLToPath(new URL('..', import.meta.url));
const loopbackHosts = new Set(['127.0.0.1', 'localhost', '[::1]']);
/** @type {readonly Theme[]} */
export const captureThemes = ['light', 'dark'];
/** Viewport height for each supported width; 2560 is captured only on request. */
export const viewportHeights = new Map([
  [1440, 900],
  [1366, 768],
  [390, 844],
  [2560, 1300],
]);
export const defaultWidths = [1440, 1366, 390];
const measureViewport = { width: 1440, height: 900 };
const tabPressLimit = 600;
export const usage =
  'Usage: npm run capture:views -- --base <loopback origin> [--out <dir>] [--views <id,…>] [--widths 1440,1366,390,2560] [--themes light,dark] [--measure]';

/** @param {string} value @param {string} flag */
function list(value, flag) {
  const items = value.split(',').map((item) => item.trim());
  if (items.some((item) => !item) || new Set(items).size !== items.length)
    throw new Error(flag + ' takes a comma-separated list without blank or repeated items');
  return items;
}

/** @param {string} value */
function loopbackOrigin(value) {
  const url = URL.canParse(value) ? new URL(value) : null;
  if (
    !url ||
    (url.protocol !== 'http:' && url.protocol !== 'https:') ||
    !loopbackHosts.has(url.hostname) ||
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash
  )
    throw new Error('--base must be a loopback origin such as http://127.0.0.1:3200');
  return new URL(url.origin);
}

/**
 * Resolves links and on-disk letter case in the existing part of a path, so neither a link nor
 * another spelling can place output in the repository.
 * @param {string} path
 */
function physical(path) {
  /** @type {string[]} */
  const missing = [];
  let existing = path;
  while (!existsSync(existing) && dirname(existing) !== existing) {
    missing.unshift(basename(existing));
    existing = dirname(existing);
  }
  return join(realpathSync.native(existing), ...missing);
}

/** @param {string | undefined} value @param {string} root @param {string} cwd @param {Date} now */
function outputDirectory(value, root, cwd, now) {
  const repository = physical(resolve(root));
  const stamp = now
    .toISOString()
    .replace(/\.\d+Z$/, 'Z')
    .replaceAll(':', '-');
  const out =
    value === undefined
      ? join(repository, 'test-results', 'captures', stamp)
      : physical(resolve(cwd, value));
  // Compared without case on every platform: on a case-insensitive filesystem a segment that
  // does not exist yet, such as test-results/SHARDS, still names test-results/shards.
  const inside = relative(repository.toLowerCase(), out.toLowerCase());
  if (inside === '..' || inside.startsWith('..' + sep) || isAbsolute(inside)) return out;
  // Playwright clears browser-artifacts/ on every run and shard verification rejects foreign entries.
  const [first, second] = inside.split(sep);
  if (first === 'test-results' && second && second !== 'browser-artifacts' && second !== 'shards')
    return out;
  throw new Error(
    '--out must be outside the repository or in a test-results/ subdirectory other than browser-artifacts/ and shards/',
  );
}

/**
 * @param {readonly string[]} argv
 * @param {{ root?: string, cwd?: string, now?: Date }} [context]
 * @returns {CaptureOptions}
 */
export function parseCaptureArguments(
  argv,
  // npm runs scripts from the package root and records the invoking directory in INIT_CWD.
  { root = repositoryRoot, cwd = process.env.INIT_CWD ?? process.cwd(), now = new Date() } = {},
) {
  const { values } = parseArgs({
    args: [...argv],
    strict: true,
    allowPositionals: false,
    options: {
      base: { type: 'string' },
      out: { type: 'string' },
      measure: { type: 'boolean', default: false },
      views: { type: 'string' },
      widths: { type: 'string' },
      themes: { type: 'string' },
    },
  });
  if (values.base === undefined) throw new Error('--base <origin> is required');
  const base = loopbackOrigin(values.base);
  const out = outputDirectory(values.out, root, cwd, now);
  const ids = values.views === undefined ? null : list(values.views, '--views');
  const unknown = (ids ?? []).filter((id) => !inventory.some((view) => view.id === id));
  if (unknown.length) throw new Error('Unknown view id: ' + unknown.join(', '));
  const widths =
    values.widths === undefined
      ? defaultWidths
      : list(values.widths, '--widths').map((item) => {
          const width = Number(item);
          if (!/^\d+$/.test(item) || !viewportHeights.has(width))
            throw new Error('--widths accepts ' + [...viewportHeights.keys()].join(', '));
          return width;
        });
  const themes =
    values.themes === undefined
      ? captureThemes
      : list(values.themes, '--themes').map((item) => {
          const theme = captureThemes.find((choice) => choice === item);
          if (!theme) throw new Error('--themes accepts ' + captureThemes.join(', '));
          return theme;
        });
  return {
    base,
    out,
    measure: values.measure,
    views: ids ? inventory.filter((view) => ids.includes(view.id)) : inventory,
    widths,
    themes,
  };
}

/** @param {Pick<CaptureOptions, 'views' | 'widths' | 'themes'>} options @returns {CaptureCell[]} */
export function captureMatrix({ views, widths, themes }) {
  return themes.flatMap((theme) =>
    views.flatMap((view) =>
      widths.map((width) => {
        const height = viewportHeights.get(width);
        if (height === undefined) throw new Error('Unsupported width ' + width);
        const stem = view.id + '.' + theme + '.' + width;
        return { view, theme, width, height, file: stem + '.png', fullPage: stem + '.full.png' };
      }),
    ),
  );
}

/**
 * Why a loaded document is not its inventory view, or null when it is.
 * @param {{ status: number | null, redirected: boolean, expected: string, actual: string }} result
 */
export function cellFailure({ status, redirected, expected, actual }) {
  if (status === null) return 'no document response';
  if (status < 200 || status > 299) return 'status ' + status;
  if (redirected) return 'redirected to ' + actual;
  if (actual !== expected) return 'landed on ' + actual;
  return null;
}

/** @param {Page} page @param {URL} base */
async function openSignIn(page, base) {
  await page.goto(new URL('/auth/login', base).href);
  try {
    await page.getByText(/^Preview accounts:/).waitFor({ timeout: 15000 });
  } catch {
    throw new Error(
      base.origin + ' shows no preview accounts notice; captures need a preview build',
    );
  }
}

/** The preview build fills in its sample account; this never types credentials. @param {Page} page @param {URL} base */
async function signIn(page, base) {
  await openSignIn(page, base);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.waitForURL((url) => url.pathname === '/repos');
}

/** @param {Page} page @param {Theme} theme */
async function waitForTheme(page, theme) {
  await page.waitForFunction((value) => document.documentElement.classList.contains(value), theme);
}

/** @param {Page} page @param {Theme} theme */
async function chooseTheme(page, theme) {
  await page.getByRole('button', { name: 'Theme settings', exact: true }).first().click();
  await page
    .getByRole('menuitemradio', { name: theme === 'dark' ? 'Dark' : 'Light', exact: true })
    .click();
  await waitForTheme(page, theme);
}

/** @param {Page} page @param {Theme | null} theme */
async function settle(page, theme) {
  await page.locator('h1').first().waitFor();
  // Client restoration can keep requests open; the heading above is the readiness signal.
  await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => undefined);
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  if (theme) await waitForTheme(page, theme);
  await page.mouse.move(0, 0);
  await page.evaluate(() => window.scrollTo(0, 0));
}

/** @param {Page} page @param {InventoryView} view @param {URL} base */
async function visit(page, view, base) {
  const target = new URL(view.path, base);
  const response = await page.goto(target.href);
  const status = response?.status() ?? null;
  const failure = cellFailure({
    status,
    redirected: !!response?.request().redirectedFrom(),
    expected: target.pathname,
    actual: new URL(page.url()).pathname,
  });
  return { status, failure };
}

/**
 * @param {Page} page @param {CaptureCell} cell @param {CaptureOptions} options
 * @returns {Promise<string | Record<string, unknown>>} the manifest entry, or why the cell failed
 */
async function captureCell(page, cell, options) {
  await page.setViewportSize({ width: cell.width, height: cell.height });
  const { status, failure } = await visit(page, cell.view, options.base);
  if (failure) return failure;
  await settle(page, cell.theme);
  const expected = new URL(cell.view.path, options.base).pathname;
  const final = new URL(page.url());
  if (final.pathname !== expected) return 'moved to ' + final.pathname;
  await page.screenshot({ path: join(options.out, cell.file), animations: 'disabled' });
  await page.screenshot({
    path: join(options.out, cell.fullPage),
    animations: 'disabled',
    fullPage: true,
  });
  return {
    id: cell.view.id,
    path: cell.view.path,
    theme: cell.theme,
    width: cell.width,
    height: cell.height,
    status,
    finalPath: final.pathname + final.search,
    title: await page.title(),
    files: [cell.file, cell.fullPage],
  };
}

/** Page-absolute geometry, rendered type and in-app links of the loaded view. @param {Page} page */
function measureView(page) {
  return page.evaluate(() => {
    const visible = (/** @type {Element} */ element) => element.getBoundingClientRect().width > 0;
    const top = (/** @type {Element | null | undefined} */ element) =>
      element ? Math.round(element.getBoundingClientRect().top + window.scrollY) : null;
    const header = document.querySelector('header');
    const headerBottom = header
      ? Math.round(header.getBoundingClientRect().bottom + window.scrollY)
      : null;
    const firstControl = top(
      [
        ...document.querySelectorAll(
          'main button, main select, main input, main [role="combobox"]',
        ),
      ].find(visible),
    );
    /** @type {Set<string>} */
    const pairs = new Set();
    /** @type {Set<string>} */
    const styles = new Set();
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const parent = node.parentElement;
      if (!node.textContent?.trim() || !parent || parent.closest('[hidden]') || !visible(parent))
        continue;
      const style = getComputedStyle(parent);
      const pair = style.fontSize + ' / ' + style.fontWeight;
      pairs.add(pair);
      styles.add(
        pair + (style.textTransform === 'uppercase' ? ' UPPER ' + style.letterSpacing : ''),
      );
    }
    const hrefs = [...document.querySelectorAll('a[href]')]
      .map((anchor) => anchor.getAttribute('href') ?? '')
      .filter((href) => !href.startsWith('#'))
      .filter((href) => new URL(href, location.href).origin === location.origin);
    return {
      headerToFirstControl:
        headerBottom !== null && firstControl !== null ? firstControl - headerBottom : null,
      firstTableTop: top(document.querySelector('main table')),
      periodActivityTop: top(document.querySelector('main [aria-label="Period activity"]')),
      fontPairs: [...pairs].sort(),
      fontStyles: [...styles].sort(),
      inAppLinks: hrefs.length,
      longestInAppHref: Math.max(0, ...hrefs.map((href) => href.length)),
      linksOver300: hrefs.filter((href) => href.length > 300).length,
      linksOver500: hrefs.filter((href) => href.length > 500).length,
      linksWithPercent25: hrefs.filter((href) => href.includes('%25')).length,
    };
  });
}

/** Tab presses from a freshly loaded document until focus enters Period activity. @param {Page} page */
async function tabsToPeriodActivity(page) {
  for (let presses = 1; presses <= tabPressLimit; presses++) {
    await page.keyboard.press('Tab');
    if (
      await page.evaluate(
        () => !!document.activeElement?.closest('main [aria-label="Period activity"]'),
      )
    )
      return presses;
  }
  return null;
}

/** The All repositories rows that need interaction, from a fresh account state. @param {Browser} browser @param {URL} base */
async function measureAllRepositories(browser, base) {
  const context = await browser.newContext({ viewport: measureViewport, deviceScaleFactor: 1 });
  try {
    const page = await context.newPage();
    await signIn(page, base);
    const url = new URL('/repos', base).href;
    await page.goto(url);
    await settle(page, null);
    const tabPresses = await tabsToPeriodActivity(page);
    const timelineHref = await page
      .getByRole('link', { name: 'Timeline', exact: true })
      .first()
      .getAttribute('href');
    const html = await context.request.get(url);
    const flight = await context.request.get(url, { headers: { RSC: '1' } });
    if (!html.ok() || !flight.ok()) throw new Error('All repositories document request failed');
    // The scope change saves a viewer preference, so it is the last step in this context.
    const entries = await page.evaluate(() => history.length);
    await page.getByRole('button', { name: 'PR age', exact: true }).first().click();
    await page
      .getByRole('menu', { name: 'PR age', exact: true })
      .getByRole('menuitemcheckbox', { name: 'Over 30 days', exact: true })
      .click();
    await page.keyboard.press('Escape');
    await page.waitForFunction((count) => history.length > count, entries);
    const address = await page.evaluate(() => location.pathname + location.search);
    return {
      tabPresses,
      timelineHrefLength: timelineHref?.length ?? null,
      htmlBytes: (await html.body()).byteLength,
      flightBytes: (await flight.body()).byteLength,
      addressAfterScopeChange: address.length,
    };
  } finally {
    await context.close();
  }
}

/** The Baseline table names fixed views, so this measures the whole inventory whatever --views selects. @param {Browser} browser @param {URL} base */
async function measure(browser, base) {
  const repos = await measureAllRepositories(browser, base);
  const context = await browser.newContext({ viewport: measureViewport, deviceScaleFactor: 1 });
  /** @type {Record<string, ViewMeasurement>} */
  const views = {};
  /** @type {{ id: string, reason: string }[]} */
  const failures = [];
  try {
    const page = await context.newPage();
    /** @param {InventoryView} view */
    const record = async (view) => {
      try {
        const { failure } = await visit(page, view, base);
        if (failure) throw new Error(failure);
        await settle(page, null);
        views[view.id] = await measureView(page);
      } catch (error) {
        failures.push({ id: view.id, reason: message(error) });
      }
    };
    await openSignIn(page, base);
    for (const view of inventory.filter((item) => item.access === 'signed-out')) await record(view);
    await signIn(page, base);
    for (const view of inventory.filter((item) => item.access !== 'signed-out')) await record(view);
  } finally {
    await context.close();
  }
  /** @param {readonly string[]} ids @param {'fontPairs' | 'fontStyles'} key */
  const union = (ids, key) =>
    [...new Set(ids.flatMap((id) => views[id]?.[key] ?? []))].sort((a, b) => a.localeCompare(b));
  const typeSample = viewsFor('type-sample')
    .map((view) => view.id)
    .filter((id) => id in views);
  const summary = views['repos-overview'];
  return {
    version: 1,
    base: base.origin,
    viewport: measureViewport,
    definitions: {
      headerToFirstControl:
        'top of the first visible main button, select, input or combobox minus the bottom of the first header, in page pixels',
      firstTableTop: 'page top of the first main table',
      periodActivityTop: 'page top of main [aria-label="Period activity"]',
      tabPressesToPeriodActivity:
        'Tab presses from a freshly loaded /repos until focus is inside Period activity; null after ' +
        tabPressLimit,
      fontPairs:
        'distinct computed font-size / font-weight of visible text nodes over typeSampleIds; the uppercase variant also keys uppercase text by letter-spacing',
      inAppLinks: 'same-origin a[href] values that are not fragment-only',
      summaryTimelineHrefLength: 'href length of the first Timeline link on a fresh /repos',
      addressAfterScopeChange:
        'path and query length after clearing PR age "Over 30 days" on a fresh /repos',
      bytes: 'uncompressed /repos document and RSC: 1 response bodies',
    },
    baseline: {
      allRepositoriesHeaderToFirstControl: summary?.headerToFirstControl ?? null,
      allRepositoriesFirstTableTop: summary?.firstTableTop ?? null,
      allRepositoriesPeriodActivityTop: summary?.periodActivityTop ?? null,
      repositoryFirstTableTop: views['repo-detail']?.firstTableTop ?? null,
      contributorsFirstTableTop: views.contributors?.firstTableTop ?? null,
      tabPressesToPeriodActivity: repos.tabPresses,
      fontPairs: union(typeSample, 'fontPairs').length,
      fontPairsWithUppercaseTracking: union(typeSample, 'fontStyles').length,
      summaryTimelineHrefLength: repos.timelineHrefLength,
      allRepositoriesInAppLinks: summary?.inAppLinks ?? null,
      allRepositoriesLinksOver500: summary?.linksOver500 ?? null,
      addressAfterScopeChange: repos.addressAfterScopeChange,
      allRepositoriesHtmlBytes: repos.htmlBytes,
      allRepositoriesFlightBytes: repos.flightBytes,
    },
    typography: {
      typeSampleIds: typeSample,
      fontPairs: union(typeSample, 'fontPairs'),
      allViewsFontPairs: union(Object.keys(views), 'fontPairs'),
    },
    views,
    failures,
  };
}

/** @param {string} path @param {unknown} value */
function writeJson(path, value) {
  return writeFile(path, JSON.stringify(value, null, 2) + '\n');
}

/** @param {unknown} error */
function message(error) {
  return error instanceof Error ? error.message : String(error);
}

/** @param {CaptureFailure} failure */
function failureLine(failure) {
  switch (failure.stage) {
    case 'cell':
      return `${failure.id} ${failure.theme} ${failure.width}: ${failure.reason}`;
    case 'setup':
      return `setup ${failure.theme} ${failure.access}: ${failure.reason}`;
    default:
      return `${failure.stage}: ${failure.reason}`;
  }
}

/**
 * Captures the matrix and, with --measure, the baseline. manifest.json is written however the run
 * ends, so a setup or measurement failure keeps the record of the cells captured before it.
 * @param {CaptureOptions} options
 * @param {() => Promise<Browser>} [launch]
 * @returns {Promise<boolean>} whether every cell and measurement succeeded
 */
export async function capture(options, launch = () => chromium.launch()) {
  await mkdir(options.out, { recursive: true });
  /** @type {unknown[]} */
  const entries = [];
  /** @type {CaptureFailure[]} */
  const failures = [];
  /** @type {Awaited<ReturnType<typeof measure>> | null} */
  let measurements = null;
  /** @type {RunStep} */
  let step = { stage: 'launch' };
  try {
    const browser = await launch();
    try {
      for (const theme of options.themes) {
        const cells = captureMatrix({ ...options, themes: [theme] });
        // Signed-out views render without a session, as an anonymous visitor sees them.
        for (const signedIn of [false, true]) {
          const group = cells.filter((cell) =>
            signedIn ? cell.view.access !== 'signed-out' : cell.view.access === 'signed-out',
          );
          if (!group.length) continue;
          step = { stage: 'setup', theme, access: signedIn ? 'signed-in' : 'signed-out' };
          const context = await browser.newContext({ deviceScaleFactor: 1 });
          try {
            const page = await context.newPage();
            if (signedIn) await signIn(page, options.base);
            else await openSignIn(page, options.base);
            await chooseTheme(page, theme);
            for (const cell of group) {
              const result = await captureCell(page, cell, options).catch(message);
              if (typeof result === 'string')
                failures.push({
                  stage: 'cell',
                  id: cell.view.id,
                  theme,
                  width: cell.width,
                  reason: result,
                });
              else entries.push(result);
            }
          } finally {
            await context.close();
          }
        }
      }
      if (options.measure) {
        step = { stage: 'measure' };
        measurements = await measure(browser, options.base);
      }
    } finally {
      await browser.close();
    }
  } catch (error) {
    failures.push({ ...step, reason: message(error) });
  } finally {
    await writeJson(join(options.out, 'manifest.json'), {
      version: 1,
      base: options.base.origin,
      widths: options.widths,
      themes: options.themes,
      views: options.views.map((view) => view.id),
      entries,
      failures,
    });
    if (measurements) await writeJson(join(options.out, 'measurements.json'), measurements);
  }
  console.log(`Captured ${entries.length} cells into ${options.out}; ${failures.length} failed`);
  for (const failure of failures) console.error(failureLine(failure));
  for (const failure of measurements?.failures ?? [])
    console.error(`measure ${failure.id}: ${failure.reason}`);
  return !failures.length && !measurements?.failures.length;
}

// import.meta.main also holds when the script is reached through a symlinked path.
if (import.meta.main) {
  /** @type {CaptureOptions | null} */
  let options = null;
  try {
    options = parseCaptureArguments(process.argv.slice(2));
  } catch (error) {
    console.error(message(error) + '\n' + usage);
    process.exitCode = 1;
  }
  if (options && !(await capture(options))) process.exitCode = 1;
}
