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

describe('chart colour', () => {
  // Marks sit on the card and canvas, on the sunken bar track and on the pressed selection tint.
  const surfaces = [
    '--prebid-card',
    '--prebid-background',
    '--prebid-sunken',
    '--prebid-selection',
  ];
  it.each(['light', 'dark'] as const)(
    'reaches 3:1 against every surface a mark sits on in %s',
    (theme) => {
      const values = themes()[theme];
      const mark = values['--prebid-chart-1'];
      expect(mark).toMatch(/^#[0-9a-f]{3,6}$/i);
      for (const surface of surfaces) {
        expect(contrast(mark, values[surface]), surface).toBeGreaterThanOrEqual(3);
      }
    },
  );
  it('defines one series colour until a chart draws two series', () => {
    const { light } = themes();
    expect(Object.keys(light).filter((name) => name.startsWith('--prebid-chart-'))).toEqual([
      '--prebid-chart-1',
    ]);
  });
});
