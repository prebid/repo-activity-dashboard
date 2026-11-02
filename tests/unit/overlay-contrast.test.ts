// @vitest-environment node
import { readFileSync } from 'node:fs';
import postcss from 'postcss';
import { describe, expect, it } from 'vitest';

type Theme = 'light' | 'dark';
type Rgba = readonly [number, number, number, number];

/** The declarations directly in each top-level rule of a stylesheet, by its selector list. */
function declarations(file: string) {
  const blocks = new Map<string, Record<string, string>>();
  postcss.parse(readFileSync(file, 'utf8')).each((node) => {
    if (node.type !== 'rule') return;
    const key = node.selectors.join(', ');
    const values = blocks.get(key) ?? {};
    node.each((child) => {
      if (child.type === 'decl') values[child.prop] = child.value;
    });
    blocks.set(key, values);
  });
  return blocks;
}
/** The primitives each theme defines; Dark inherits whatever it does not redefine. */
function primitives() {
  const blocks = declarations('src/styles/prebid.css');
  const light = blocks.get(':root')!;
  const dark = blocks.get('.dark');
  // Without its own block, Dark would silently re-test the Light values.
  expect(dark?.['--prebid-overlay']).toBeDefined();
  expect(dark?.['--prebid-overlay']).not.toBe(light['--prebid-overlay']);
  return { light, dark: { ...light, ...dark } };
}
/** Follows var() references through the globals.css semantic mapping down to a literal. */
function resolve(value: string, theme: Theme): string {
  const semantic = declarations('src/app/globals.css').get(':root, .dark')!;
  const names = primitives()[theme];
  let current = value.trim();
  for (let depth = 0; depth < 8; depth++) {
    const reference = /^var\((--[\w-]+)\)$/.exec(current);
    if (!reference) return current;
    const next = names[reference[1]] ?? semantic[reference[1]];
    expect(next, reference[1]).toBeDefined();
    current = next.trim();
  }
  throw new Error('unresolved ' + value);
}
function parse(colour: string): Rgba {
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(colour);
  if (hex) {
    const digits = hex[1].length === 3 ? [...hex[1]].map((d) => d + d).join('') : hex[1];
    const channel = (i: number) => parseInt(digits.slice(i, i + 2), 16);
    return [channel(0), channel(2), channel(4), 1];
  }
  const rgb = /^rgb\((\d+) (\d+) (\d+)(?: \/ ([\d.]+))?\)$/.exec(colour);
  expect(rgb, colour).not.toBeNull();
  return [Number(rgb![1]), Number(rgb![2]), Number(rgb![3]), Number(rgb![4] ?? 1)];
}
/** A translucent colour over an opaque one, mixed in sRGB as browsers paint it. */
function over(top: Rgba, bottom: Rgba): Rgba {
  expect(bottom[3]).toBe(1);
  const mix = (i: 0 | 1 | 2) => top[i] * top[3] + bottom[i] * (1 - top[3]);
  return [mix(0), mix(1), mix(2), 1];
}
function luminance([r, g, b, alpha]: Rgba) {
  expect(alpha).toBe(1);
  const [lr, lg, lb] = [r, g, b].map((channel) => {
    const c = channel / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
}
function contrast(a: Rgba, b: Rgba) {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (high + 0.05) / (low + 0.05);
}
const colour = (value: string, theme: Theme) => parse(resolve(value, theme));

describe('overlay contrast', () => {
  it('separates the Light dialog surface from the scrimmed canvas', () => {
    const scrimmed = over(
      colour('var(--prebid-scrim)', 'light'),
      colour('var(--background)', 'light'),
    );
    const surface = colour('var(--prebid-overlay)', 'light');
    expect(contrast(surface, scrimmed)).toBeGreaterThanOrEqual(1.3);
  });

  it.each(['light', 'dark'] as const)(
    'keeps highlighted menu item text at 4.5:1 on the accent in %s',
    (theme) => {
      // Items set bg-accent and text-accent-foreground while highlighted.
      expect(
        contrast(colour('var(--accent-foreground)', theme), colour('var(--accent)', theme)),
      ).toBeGreaterThanOrEqual(4.5);
      expect(resolve('var(--accent-foreground)', theme)).toBe(resolve('var(--prebid-ink)', theme));
    },
  );

  it.each(['light', 'dark'] as const)(
    'draws the menu checkbox edge, fill and glyph at 3:1 in %s',
    (theme) => {
      const rules = declarations('src/components/ui/dropdown-menu.module.css');
      const box = rules.get('.box')!;
      const checked = rules.get(
        "[data-state='checked'] > .box, [data-state='indeterminate'] > .box",
      )!;
      const edge = /^1px solid (var\(--[\w-]+\))$/.exec(box.border)![1];
      const surface = colour('var(--popover)', theme);
      const fill = colour(checked.background, theme);
      expect(contrast(colour(edge, theme), surface), 'edge').toBeGreaterThanOrEqual(3);
      expect(contrast(fill, surface), 'checked fill').toBeGreaterThanOrEqual(3);
      expect(contrast(colour(box.color, theme), fill), 'glyph').toBeGreaterThanOrEqual(3);
      expect(checked['border-color']).toBe(checked.background);
    },
  );
});
