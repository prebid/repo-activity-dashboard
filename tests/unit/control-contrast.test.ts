// @vitest-environment node
import { readFileSync } from 'node:fs';
import postcss from 'postcss';
import { describe, expect, it } from 'vitest';

/** The primitives each theme defines; Dark inherits whatever it does not redefine. */
function themes() {
  const blocks = new Map<string, Record<string, string>>();
  postcss.parse(readFileSync('src/styles/prebid.css', 'utf8')).walkRules((rule) => {
    const values = blocks.get(rule.selector) ?? {};
    rule.walkDecls(/^--prebid-/, (decl) => {
      values[decl.prop] = decl.value;
    });
    blocks.set(rule.selector, values);
  });
  const light = blocks.get(':root')!;
  const dark = blocks.get('.dark');
  // Without its own block, Dark would silently re-test the Light values.
  expect(dark?.['--prebid-card']).toBeDefined();
  expect(dark?.['--prebid-card']).not.toBe(light['--prebid-card']);
  return { light, dark: { ...light, ...dark } };
}
function luminance(hex: string) {
  expect(hex).toMatch(/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i);
  const digits = hex.replace('#', '');
  const full = digits.length === 3 ? [...digits].map((d) => d + d).join('') : digits;
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(full.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a: string, b: string) {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (high + 0.05) / (low + 0.05);
}

// [foreground, the surfaces it sits on, the minimum ratio]. Edges, the selected indicator and the
// focus ring are non-text contrast (WCAG 1.4.11, 3:1); placeholder and button labels are text (4.5:1).
const pairs: [string, string[], number][] = [
  [
    '--prebid-input-border',
    [
      '--prebid-card',
      '--prebid-background',
      '--prebid-sunken',
      '--prebid-overlay',
      '--prebid-header-band',
    ],
    3,
  ],
  ['--prebid-selection-edge', ['--prebid-selection', '--prebid-card'], 3],
  ['--prebid-ring', ['--prebid-card', '--prebid-background'], 3],
  // The check and dot drawn on a checked Checkbox or Radio.
  ['--prebid-card', ['--prebid-selection-edge'], 3],
  ['--prebid-placeholder', ['--prebid-input', '--prebid-sunken'], 4.5],
  [
    '--prebid-accent-ink',
    ['--prebid-accent', '--prebid-accent-hover', '--prebid-accent-pressed'],
    4.5,
  ],
];

describe('control contrast', () => {
  it.each(['light', 'dark'] as const)(
    'meets the non-text and text minimums for control edges, focus and labels in %s',
    (theme) => {
      const values = themes()[theme];
      for (const [foreground, surfaces, minimum] of pairs)
        for (const surface of surfaces)
          expect(
            contrast(values[foreground], values[surface]),
            `${foreground} on ${surface}`,
          ).toBeGreaterThanOrEqual(minimum);
    },
  );
});

// Table marks that carry meaning without text (WCAG 1.4.11, 3:1): the idle and sorted sort glyphs
// on the header band and its hover, the group spanner rule, the row-hover bar and the dotted
// underline of a drillable number on the surfaces a table cell takes. The orange sorted-header
// underline is below 3:1 on the Light band, so the sorted label also changes ink (browser check).
const tablePairs: [string, string[]][] = [
  ['--prebid-sort-idle', ['--prebid-header-band', '--prebid-header-band-hover']],
  ['--prebid-link', ['--prebid-header-band', '--prebid-header-band-hover']],
  [
    '--prebid-brand-blue',
    ['--prebid-header-band', '--prebid-row-hover', '--prebid-card', '--prebid-sunken'],
  ],
];

describe('table contrast', () => {
  it.each(['light', 'dark'] as const)(
    'meets the non-text minimum for sort glyphs, spanners, row bars and drill underlines in %s',
    (theme) => {
      const values = themes()[theme];
      for (const [mark, surfaces] of tablePairs)
        for (const surface of surfaces)
          expect(
            contrast(values[mark], values[surface]),
            `${mark} on ${surface}`,
          ).toBeGreaterThanOrEqual(3);
    },
  );
});
