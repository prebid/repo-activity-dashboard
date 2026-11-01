// @vitest-environment node
import { readFileSync } from 'node:fs';
import postcss, { type Rule } from 'postcss';
import { describe, expect, it } from 'vitest';

// WCAG 1.4.11 non-text contrast (3:1) for state glyphs and 1.4.3 text contrast (4.5:1), read from
// the colours the component stylesheets actually set, resolved against each theme's tokens.

type Theme = Record<string, string>;
/** The primitives each theme defines; Dark inherits whatever it does not redefine. */
function themes(): Record<'light' | 'dark', Theme> {
  const blocks = new Map<string, Theme>();
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

/** Declarations per selector in a stylesheet; a selector list contributes to each selector. */
function declarations(file: string) {
  const rules = new Map<string, Record<string, string>>();
  postcss.parse(readFileSync(file, 'utf8')).walkRules((rule: Rule) => {
    // Rules inside @media apply only sometimes; the colours under test are unconditional.
    if (rule.parent?.type !== 'root') return;
    for (const selector of rule.selectors) {
      const values = rules.get(selector) ?? {};
      rule.walkDecls((decl) => {
        values[decl.prop] = decl.value;
      });
      rules.set(selector, values);
    }
  });
  return rules;
}
/** A token value, following var() and its fallback until a hex colour. */
function resolve(value: string | undefined, theme: Theme) {
  let current = value?.trim();
  for (let depth = 0; current && depth < 5; depth++) {
    const match = /^var\((--[\w-]+)(?:\s*,\s*(.+))?\)$/.exec(current);
    if (!match) break;
    current = (theme[match[1]] ?? match[2])?.trim();
  }
  expect(current, String(value)).toMatch(/^#[0-9a-f]{3,6}$/i);
  return current!;
}
/** The values each `[data-<attribute>='…']` rule on `block` sets, keyed by attribute value. */
function variants(rules: Map<string, Record<string, string>>, block: string, attribute: string) {
  const pattern = new RegExp(`^\\.${block}\\[data-${attribute}='([a-z-]+)'\\]$`);
  const found: Record<string, Record<string, string>> = {};
  for (const [selector, values] of rules) {
    const match = pattern.exec(selector);
    if (match) found[match[1]] = { ...found[match[1]], ...values };
  }
  return found;
}

const all = themes();
const callout = declarations('src/components/feedback/callout.module.css');
const emptyState = declarations('src/components/feedback/empty-state.module.css');
const recordStatus = declarations('src/components/github/record-status.module.css');
const avatar = declarations('src/components/github/avatar.module.css');
const contributions = declarations('src/features/contributions/contributions.module.css');

describe.each(['light', 'dark'] as const)('state colours in %s', (name) => {
  const theme = all[name];

  it('give each Callout tone a 3:1 icon and 4.5:1 lead and body on its fill', () => {
    const tones = variants(callout, 'callout', 'tone');
    expect(Object.keys(tones).sort()).toEqual(['error', 'info', 'warning']);
    const body = callout.get('.callout')?.color;
    expect(body).toBeDefined();
    for (const [tone, values] of Object.entries(tones)) {
      const fill = resolve(values['--callout-fill'], theme);
      const icon = resolve(values['--callout-icon'], theme);
      const lead = resolve(values['--callout-lead'], theme);
      expect(contrast(icon, fill), tone + ' icon').toBeGreaterThanOrEqual(3);
      expect(contrast(lead, fill), tone + ' lead').toBeGreaterThanOrEqual(4.5);
      expect(contrast(resolve(body, theme), fill), tone + ' body').toBeGreaterThanOrEqual(4.5);
    }
    // The box and icon read the tone values, not fixed colours.
    expect(callout.get('.callout')?.background).toBe('var(--callout-fill)');
    expect(callout.get('.icon')?.color).toBe('var(--callout-icon)');
    expect(callout.get('.lead')?.color).toBe('var(--callout-lead)');
  });

  it('give each EmptyState tile icon 3:1 on its tile', () => {
    const kinds = variants(emptyState, 'state', 'kind');
    expect(Object.keys(kinds).sort()).toEqual(['empty', 'error', 'loading', 'missing', 'no-match']);
    for (const [kind, values] of Object.entries(kinds)) {
      const tile = resolve(values['--state-tile'], theme);
      const icon = resolve(values['--state-icon'], theme);
      expect(contrast(icon, tile), kind).toBeGreaterThanOrEqual(3);
    }
    expect(emptyState.get('.tile')?.background).toBe('var(--state-tile)');
    expect(emptyState.get('.tile')?.color).toBe('var(--state-icon)');
  });

  it('give each RecordStatus glyph 3:1 on the card and on a hovered row', () => {
    const tones = variants(recordStatus, 'status', 'tone');
    expect(Object.keys(tones).sort()).toEqual(['error', 'link', 'muted', 'success']);
    const surfaces = ['--prebid-card', '--prebid-row-hover'].map((token) => theme[token]);
    for (const [tone, values] of Object.entries(tones)) {
      const glyph = resolve(values['--status-glyph'], theme);
      for (const surface of surfaces)
        expect(contrast(glyph, resolve(surface, theme)), tone).toBeGreaterThanOrEqual(3);
    }
    expect(recordStatus.get('.status > svg')?.color).toBe('var(--status-glyph)');
  });

  it('give avatar initials 4.5:1 and the badge glyph 3:1 on the card, a hovered row and the canvas', () => {
    const base = avatar.get('.avatar')!;
    expect(
      contrast(resolve(base.color, theme), resolve(base.background, theme)),
    ).toBeGreaterThanOrEqual(4.5);
    const badge = avatar.get('.badge')!;
    const glyph = resolve(badge.color, theme);
    // The disc takes the surface the avatar sits on: the card, or --identity-surface on a row.
    expect(contrast(glyph, resolve(badge.background, theme))).toBeGreaterThanOrEqual(3);
    expect(contrast(glyph, resolve('var(--prebid-row-hover)', theme))).toBeGreaterThanOrEqual(3);
    // The report heading's avatar sits on the canvas, and its header passes that surface on.
    const heading = contributions.get('.header')?.['--identity-surface'];
    expect(resolve(heading, theme)).toBe(resolve('var(--prebid-background)', theme));
    expect(contrast(glyph, resolve(heading, theme))).toBeGreaterThanOrEqual(3);
    const unmapped = avatar.get(".avatar[data-kind='unmapped-company']")!;
    expect(
      contrast(resolve(unmapped.color, theme), resolve('var(--prebid-card)', theme)),
    ).toBeGreaterThanOrEqual(3);
  });
});
