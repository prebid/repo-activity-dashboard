import { test, expect, expectTheme } from './fixtures';
import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { inventory } from '../support/views';

type Theme = 'light' | 'dark';
const themes = [
  ['Light', 'light'],
  ['Dark', 'dark'],
] as const satisfies readonly (readonly [string, Theme])[];
const forbiddenFamily = /^(arial|helvetica)\b/i;

// Each case is its own group, so CI's shards divide the views instead of taking the whole file.
test.describe.configure({ mode: 'parallel' });

interface FontProblem {
  element: string;
  check: 'family' | 'unloaded' | 'platform';
  detail: string;
}
interface FontSample {
  element: string;
  monospace: boolean;
}
interface PageFonts {
  scanned: number;
  families: string[];
  samples: FontSample[];
  problems: FontProblem[];
}

async function login(page: Page) {
  await page.goto('/auth/login');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/repos$/);
}

/**
 * Checks the font every visible element with its own text renders in. next/font's fallback faces
 * are named '<family> Fallback' with src: local("Arial"), so a page whose web font failed keeps
 * token family names; the loaded-face check and, in Chromium, the platform fonts cover that case.
 */
async function inspectFonts(
  page: Page,
  browserName: string,
  extraSamples: readonly string[] = [],
): Promise<PageFonts> {
  const report = await page.evaluate((extra) => {
    const families = (value: string) =>
      value
        .split(',')
        .map((part) => part.trim().replace(/^["']|["']$/g, ''))
        .filter(Boolean);
    const root = getComputedStyle(document.documentElement);
    const inter = families(root.getPropertyValue('--font-inter'));
    const mona = families(root.getPropertyValue('--font-mona'));
    const mono = families(root.getPropertyValue('--prebid-font-mono'));
    if (!inter[0] || !mona[0] || !mono[0]) throw new Error('Missing font variables on <html>');
    const web = new Set([inter[0], mona[0]]);
    const accepted = [inter[0], mona[0], mono[0]];
    const forbidden = /^(arial|helvetica)\b/i;
    const ownText = (element: Element) =>
      [...element.childNodes]
        .filter((node) => node.nodeType === Node.TEXT_NODE)
        .map((node) => node.textContent ?? '')
        .join('')
        .trim();
    const describe = (element: Element) =>
      element.tagName.toLowerCase() +
      (element.id ? '#' + element.id : '') +
      ' "' +
      ownText(element).slice(0, 40) +
      '"';
    const skipped = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'TITLE', 'DESC']);
    const elements = [...document.body.querySelectorAll('*')].filter(
      (element) =>
        !skipped.has(element.tagName.toUpperCase()) &&
        // Form fields render their value or placeholder without a text node child.
        (ownText(element) !== '' ||
          (element.matches('input, textarea, select') &&
            ((element as HTMLInputElement).value !== '' || element.getAttribute('placeholder')))) &&
        element.checkVisibility({ visibilityProperty: true }),
    );
    const problems: FontProblem[] = [];
    const used = new Set<string>();
    for (const element of elements) {
      const list = families(getComputedStyle(element).fontFamily);
      const named = list.filter((family) => forbidden.test(family));
      if (named.length)
        problems.push({
          element: describe(element),
          check: 'family',
          detail: 'names ' + named.join(', ') + ' in ' + list.join(', '),
        });
      const first = list[0] ?? '';
      if (!accepted.includes(first))
        problems.push({
          element: describe(element),
          check: 'family',
          detail: 'first family ' + first + ' is none of ' + accepted.join(', '),
        });
      else if (web.has(first)) used.add(first);
    }
    const faces = [...document.fonts];
    for (const family of used) {
      const statuses = faces
        .filter((face) => families(face.family)[0] === family)
        .map((face) => face.status);
      // A face that was never needed stays unloaded; one that failed reports error.
      if (!statuses.includes('loaded') || statuses.includes('error'))
        problems.push({
          element: 'document.fonts',
          check: 'unloaded',
          detail: family + ' faces: ' + (statuses.join(', ') || 'none'),
        });
    }
    // The first text in the h1, a panel title, a table cell and header, a control, a link and a
    // chart, when the page has them. Platform fonts are reported for an element's own text only.
    const picked = ['h1', 'h2', 'td', 'th', 'button', 'a[href]', 'svg'].map((selector) =>
      elements.find((element) => element.closest(selector)),
    );
    const samples = [
      ...new Set([
        ...picked,
        ...extra.flatMap((selector) => elements.filter((element) => element.matches(selector))),
      ]),
    ].filter((element) => element !== undefined);
    (globalThis as { fontCheckSamples?: Element[] }).fontCheckSamples = samples;
    return {
      scanned: elements.length,
      families: [...used],
      problems,
      samples: samples.map((element) => ({
        element: describe(element),
        monospace: families(getComputedStyle(element).fontFamily)[0] === mono[0],
      })),
    };
  }, extraSamples);
  if (browserName !== 'chromium') return report;
  // Chromium reports the platform fonts that rendered each sampled element's own text.
  const cdp = await page.context().newCDPSession(page);
  try {
    await cdp.send('DOM.enable');
    await cdp.send('CSS.enable');
    await cdp.send('DOM.getDocument', { depth: 0 });
    for (const [index, sample] of report.samples.entries()) {
      const { result } = await cdp.send('Runtime.evaluate', {
        expression: `globalThis.fontCheckSamples[${index}]`,
      });
      if (!result.objectId) throw new Error('Missing font sample ' + sample.element);
      const { nodeId } = await cdp.send('DOM.requestNode', { objectId: result.objectId });
      const { fonts } = await cdp.send('CSS.getPlatformFontsForNode', { nodeId });
      const used = fonts.map(
        (font) =>
          `${font.familyName} (${font.isCustomFont ? 'web' : 'system'}, ${font.glyphCount})`,
      );
      if (fonts.some((font) => forbiddenFamily.test(font.familyName)))
        report.problems.push({
          element: sample.element,
          check: 'platform',
          detail: 'rendered with ' + used.join(', '),
        });
      if (!sample.monospace && !fonts.some((font) => font.isCustomFont))
        report.problems.push({
          element: sample.element,
          check: 'platform',
          detail: 'rendered without a web font: ' + (used.join(', ') || 'no fonts reported'),
        });
    }
  } finally {
    await cdp.detach();
  }
  return report;
}

/**
 * Every visible icon from the icon map renders at its width attribute, at a size the map allows,
 * with a 1.5px line (1px for a 10px badge glyph, 2px for a 12px sort glyph). absoluteStrokeWidth
 * derives the stroke from that attribute, so a stylesheet that resizes an icon shows here as a size
 * or line mismatch.
 */
async function inspectIcons(page: Page) {
  return page.evaluate(() => {
    const problems: string[] = [];
    let count = 0;
    for (const svg of document.querySelectorAll('svg.lucide')) {
      if (!svg.checkVisibility()) continue;
      count++;
      const name = [...svg.classList].find((entry) => entry.startsWith('lucide-')) ?? 'lucide';
      const declared = Number(svg.getAttribute('width'));
      // Only SortIcon's direction glyphs draw at 12px.
      const direction = [
        'lucide-chevrons-up-down',
        'lucide-arrow-up',
        'lucide-arrow-down',
      ].includes(name);
      const style = getComputedStyle(svg);
      const width = parseFloat(style.width);
      const height = parseFloat(style.height);
      const line = (Number(svg.getAttribute('stroke-width')) * width) / 24;
      if (!(direction ? [12] : [10, 14, 16]).includes(declared))
        problems.push(`${name}: declared ${declared}px`);
      if (Math.abs(width - declared) > 0.01 || Math.abs(height - declared) > 0.01)
        problems.push(`${name}: renders ${width}x${height}px, declared ${declared}px`);
      const expected = declared === 10 ? 1 : declared === 12 ? 2 : 1.5;
      if (Math.abs(line - expected) > 0.01) problems.push(`${name}: ${line.toFixed(2)}px line`);
    }
    return { count, problems };
  });
}

async function fontsReady(page: Page) {
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
}

for (const [title, theme] of themes)
  test.describe(title, () => {
    for (const view of inventory)
      test(view.id, async ({ page, browserName }) => {
        await page.addInitScript((value) => localStorage.setItem('dashboard-theme', value), theme);
        if (view.access === 'signed-in') await login(page);
        const response = await page.goto(view.path);
        expect(response?.status()).toBe(200);
        expect(new URL(page.url()).pathname).toBe(new URL(view.path, page.url()).pathname);
        await expectTheme(page, theme);
        await fontsReady(page);
        const { violations } = await new AxeBuilder({ page }).include('main').analyze();
        expect(
          violations.map((violation) => ({
            rule: violation.id,
            targets: violation.nodes.slice(0, 5).map((node) => node.target.join(' ')),
            summary: violation.nodes[0]?.failureSummary,
          })),
        ).toEqual([]);
        const fonts = await inspectFonts(page, browserName);
        expect(fonts.scanned).toBeGreaterThan(0);
        expect(fonts.samples.length).toBeGreaterThan(0);
        expect(fonts.problems.slice(0, 20), fonts.problems.length + ' font problems').toEqual([]);
        const icons = await inspectIcons(page);
        expect(icons.count).toBeGreaterThan(0);
        expect(icons.problems.slice(0, 20), icons.problems.length + ' icon problems').toEqual([]);
      });
  });

test('the font check reports an injected Arial element and a fallback-face element', async ({
  page,
  browserName,
}) => {
  await page.goto('/auth/login');
  await fontsReady(page);
  expect((await inspectFonts(page, browserName)).problems).toEqual([]);
  await page.evaluate(() => {
    const fallback = getComputedStyle(document.documentElement)
      .getPropertyValue('--font-inter')
      .split(',')[1]
      ?.trim();
    if (!fallback) throw new Error('Missing the generated fallback face');
    for (const [id, family] of [
      ['arial-control', 'Arial'],
      ['fallback-control', fallback],
    ]) {
      const element = document.createElement('p');
      element.id = id;
      element.textContent = 'Font control';
      element.style.fontFamily = family;
      document.body.append(element);
    }
  });
  await fontsReady(page);
  const { problems } = await inspectFonts(page, browserName, [
    '#arial-control',
    '#fallback-control',
  ]);
  const reported = (id: string, check: FontProblem['check']) =>
    problems.some((problem) => problem.element.startsWith('p#' + id) && problem.check === check);
  expect(reported('arial-control', 'family')).toBe(true);
  expect(reported('fallback-control', 'family')).toBe(true);
  expect(reported('arial-control', 'platform')).toBe(browserName === 'chromium');
  expect(reported('fallback-control', 'platform')).toBe(browserName === 'chromium');
  expect(
    problems.filter((problem) => !/^p#(arial|fallback)-control /.test(problem.element)),
  ).toEqual([]);
});

test('the font check reports text whose web font files failed to load', async ({
  page,
  browserName,
}) => {
  await page.route(/\.woff2(\?|$)/, (route) => route.abort());
  await page.goto('/auth/login');
  await fontsReady(page);
  const { problems } = await inspectFonts(page, browserName);
  // The computed family names still list the token faces, so only the other checks see it.
  expect(problems.filter((problem) => problem.check === 'family')).toEqual([]);
  expect(problems.some((problem) => problem.check === 'unloaded')).toBe(true);
  expect(problems.some((problem) => problem.check === 'platform')).toBe(browserName === 'chromium');
});
