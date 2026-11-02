// @vitest-environment node
import { spawnSync } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  completedPhases,
  designTokenCandidates,
  inspectDesignTokens,
  unmodelledCeiling,
} from '../../scripts/check-design-tokens.mjs';

// Each phase lowers this as it converts its allowlisted sites.
const CEILING = 33;
// The unmodelled sites in the tree today; lowered as values become readable or are removed.
const UNMODELLED_CEILING = 68;

const directories: string[] = [];
const base = {
  'src/base.css': '.base { color: var(--prebid-ink); }',
  'src/base.tsx': 'export const Base = () => <div className="flex" />;',
  // The tokens the fixtures read.
  'src/styles/prebid.css': [
    ':root {',
    '  --prebid-ink: #1c3445;',
    '  --prebid-brand-blue: #3887c2;',
    '  --prebid-elevation-1: 0 1px 2px rgb(16 42 67 / 0.06);',
    '  --prebid-radius-panel: 12px;',
    '  --prebid-font-body: var(--font-inter), sans-serif;',
    '  --prebid-font-mono: ui-monospace, monospace;',
    '  --prebid-text-body: 13px;',
    '}',
    '.dark { --prebid-ink: #e6eef4; }',
  ].join('\n'),
};
// The project theme: tokens mapped for Tailwind, as in src/app/globals.css.
const theme = [
  '@theme inline {',
  '  --color-card: var(--card);',
  '  --color-primary-foreground: var(--ink);',
  '  --shadow: var(--e1);',
  '  --shadow-sm: var(--e1);',
  '  --radius-md: var(--r);',
  '  --font-mono: var(--m);',
  '  --text-small: var(--s);',
  '}',
].join('\n');

function fixture(files: Record<string, string>, { bare = false } = {}) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'design-tokens-')));
  directories.push(root);
  for (const [name, source] of Object.entries(bare ? files : { ...base, ...files })) {
    const path = join(root, name);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, source);
  }
  return root;
}
const lines = (...source: string[]) => source.join('\n');
const failures = (files: Record<string, string>) => inspectDesignTokens(fixture(files)).failures;

afterEach(() => {
  for (const root of directories.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe('scan population', () => {
  it('lists every scanned file and passes token-only sources', () => {
    const root = fixture({
      'src/app/globals.css': theme,
      'src/features/view.module.css': '.view { border-radius: var(--prebid-radius-panel); }',
      'src/features/view.tsx':
        "export const View = () => <p className='bg-card shadow-sm' style={{ color: 'var(--x)' }} />;",
      'src/lib/palette.ts': "export const tone = 'var(--chart-1)';",
      '.storybook/preview.tsx': 'export const Preview = () => <div className="text-small" />;',
      '.storybook/main.ts': "export const background = '#fff';",
      'other/outside.css': '.outside { color: #fff; }',
      'scripts/outside.tsx': 'export const Outside = () => <p className="bg-white" />;',
    });
    expect(inspectDesignTokens(root)).toEqual({
      root,
      cssFiles: [
        'src/app/globals.css',
        'src/base.css',
        'src/features/view.module.css',
        'src/styles/prebid.css',
      ],
      tsxFiles: ['src/base.tsx', 'src/features/view.tsx', '.storybook/preview.tsx'],
      tsFiles: ['src/lib/palette.ts'],
      allowlisted: 0,
      failures: [],
      unmodelled: [],
    });
  });

  it('never treats an empty population as a pass', () => {
    const root = fixture({}, { bare: true });
    expect(inspectDesignTokens(root)).toEqual({
      root,
      cssFiles: [],
      tsxFiles: [],
      tsFiles: [],
      allowlisted: 0,
      failures: ['No CSS files selected', 'No TSX files selected'],
      unmodelled: [],
    });
    expect(
      inspectDesignTokens(fixture({ 'src/a.css': '.a { color: var(--x); }' }, { bare: true }))
        .failures,
    ).toEqual(['No TSX files selected']);
    expect(
      inspectDesignTokens(
        fixture({ 'src/a.tsx': 'export const A = 1;', 'src/b.ts': '' }, { bare: true }),
      ).failures,
    ).toEqual(['No CSS files selected']);
  });

  it('scans .storybook TSX files but not other .storybook sources', () => {
    expect(
      failures({
        '.storybook/preview.tsx': 'export const Preview = () => <div className="text-sm" />;',
        '.storybook/main.ts': "export const background = '#fff';",
      }),
    ).toEqual([
      '.storybook/preview.tsx:1: text size utility: [Preview > <div className>] text-sm: text-sm',
    ]);
  });
});

describe('CSS declarations', () => {
  it('rejects colour literals in any declaration, custom properties included', () => {
    expect(
      failures({
        'src/colours.css': lines(
          '.a { color: #fff; }',
          '.b { color: #FFFF; }',
          '.c { background: #A1b2C3; }',
          '.d { border-color: #a1b2c3d4; }',
          '.e { color: rgb(0 0 0); }',
          '.f { background: RGBA(0, 0, 0, 0.5); }',
          '.g { color: hsl(0 0% 0%); }',
          '.h { color: hsla(0, 0%, 0%, 0.5); }',
          '.i { color: oklch(0.5 0.1 200); }',
          '.j { color: color-mix(in oklab, var(--a), var(--b)); }',
          '.k { color: lab(50% 40 59); }',
          '.l { outline: 1px solid white; }',
          '.m { --brand: #3887c2; }',
          '.n { mask-image: linear-gradient(#000, transparent); }',
          '.o { --brand: var(--prebid-brand-blue); color: var(--brand); }',
          '.p { --label: white; grid-area: red; transition: color 0.2s; }',
          '.q { color: transparent; background: currentColor; fill: none; }',
          '.r { color: inherit; border-color: initial; outline-color: unset; }',
          '.s { background-image: linear-gradient(var(--a), transparent); }',
        ),
      }),
    ).toEqual([
      'src/colours.css:1: colour literal: .a color: #fff',
      'src/colours.css:2: colour literal: .b color: #FFFF',
      'src/colours.css:3: colour literal: .c background: #A1b2C3',
      'src/colours.css:4: colour literal: .d border-color: #a1b2c3d4',
      'src/colours.css:5: colour literal: .e color: rgb(0 0 0)',
      'src/colours.css:6: colour literal: .f background: RGBA(0, 0, 0, 0.5)',
      'src/colours.css:7: colour literal: .g color: hsl(0 0% 0%)',
      'src/colours.css:8: colour literal: .h color: hsla(0, 0%, 0%, 0.5)',
      'src/colours.css:9: colour literal: .i color: oklch(0.5 0.1 200)',
      'src/colours.css:10: colour literal: .j color: color-mix(in oklab, var(--a), var(--b))',
      'src/colours.css:11: colour literal: .k color: lab(50% 40 59)',
      'src/colours.css:12: colour literal: .l outline: 1px solid white',
      'src/colours.css:13: colour literal: .m --brand: #3887c2',
      'src/colours.css:14: colour literal: .n mask-image: linear-gradient(#000, transparent)',
    ]);
  });

  it('rejects literal font sizes and accepts var() and math over var()', () => {
    expect(
      failures({
        'src/sizes.css': lines(
          '.a { font-size: 12px; }',
          '.b { font-size: clamp(25px, 3vw, 32px); }',
          '.c { font-size: calc(var(--a) * 1.1); }',
          '.d { font-size: var(--a, 12px); }',
          '.e { font-size: small; }',
          '.f { font-size: var(--prebid-text-body); }',
          '.g { font-size: calc(var(--a) + var(--b)); }',
          '.h { font-size: inherit; }',
          '.i { font-size: var(--a, var(--b)); }',
        ),
      }),
    ).toEqual([
      'src/sizes.css:1: font-size literal: .a font-size: 12px',
      'src/sizes.css:2: font-size literal: .b font-size: clamp(25px, 3vw, 32px)',
      'src/sizes.css:3: font-size literal: .c font-size: calc(var(--a) * 1.1)',
      'src/sizes.css:4: font-size literal: .d font-size: var(--a, 12px)',
      'src/sizes.css:5: font-size literal: .e font-size: small',
    ]);
  });

  it('rejects font shorthands carrying a size or family and literal font families', () => {
    expect(
      failures({
        'src/fonts.css': lines(
          '.a { font: 600 12px/1.4 Arial, Helvetica, sans-serif; }',
          '.b { font: 13px var(--family); }',
          '.c { font: 600 var(--size)/1.4 var(--family); }',
          '.d { font: inherit; }',
          '.e { font-family: Arial; }',
          '.f { font-family: "Helvetica Neue", var(--family); }',
          '.g { font-family: monospace; }',
          '.h { font-family: var(--prebid-font-mono); }',
          '.i { font-family: inherit; }',
        ),
      }),
    ).toEqual([
      'src/fonts.css:1: font shorthand literal: .a font: 600 12px/1.4 Arial, Helvetica, sans-serif',
      'src/fonts.css:2: font shorthand literal: .b font: 13px var(--family)',
      'src/fonts.css:5: font-family literal: .e font-family: Arial',
      'src/fonts.css:6: font-family literal: .f font-family: "Helvetica Neue", var(--family)',
      'src/fonts.css:7: font-family literal: .g font-family: monospace',
    ]);
  });

  it('accepts only none and bare var() shadows', () => {
    expect(
      failures({
        'src/shadows.css': lines(
          '.a { box-shadow: 0 1px 2px #000; }',
          '.b { box-shadow: 0 1px 2px var(--shadow-colour); }',
          '.c { box-shadow: inset 0 0 0 1px var(--ring); }',
          '.d { -webkit-box-shadow: 0 1px red; }',
          '.e { box-shadow: none; }',
          '.f { box-shadow: var(--prebid-elevation-1); }',
          '.g { box-shadow: var(--a), var(--b); }',
          '.h { box-shadow: var(--a, 0 1px #000); }',
        ),
      }),
    ).toEqual([
      'src/shadows.css:1: colour literal, box-shadow literal: .a box-shadow: 0 1px 2px #000',
      'src/shadows.css:2: box-shadow literal: .b box-shadow: 0 1px 2px var(--shadow-colour)',
      'src/shadows.css:3: box-shadow literal: .c box-shadow: inset 0 0 0 1px var(--ring)',
      'src/shadows.css:4: colour literal, box-shadow literal: .d -webkit-box-shadow: 0 1px red',
      'src/shadows.css:8: colour literal, box-shadow literal: .h box-shadow: var(--a, 0 1px #000)',
    ]);
  });

  it('rejects literal radii except 0 and 50%', () => {
    expect(
      failures({
        'src/radii.css': lines(
          '.a { border-radius: 5px; }',
          '.b { border-top-left-radius: 4px; }',
          '.c { border-radius: 8px / 4px; }',
          '.d { border-radius: 9999px; }',
          '.e { border-radius: 0; }',
          '.f { border-radius: 50%; }',
          '.g { border-radius: var(--prebid-radius-panel); }',
          '.h { border-radius: 0 0 var(--r) var(--r); }',
          '.i { border-radius: inherit; }',
        ),
      }),
    ).toEqual([
      'src/radii.css:1: border-radius literal: .a border-radius: 5px',
      'src/radii.css:2: border-radius literal: .b border-top-left-radius: 4px',
      'src/radii.css:3: border-radius literal: .c border-radius: 8px / 4px',
      'src/radii.css:4: border-radius literal: .d border-radius: 9999px',
    ]);
  });

  it('exempts only custom properties directly in the prebid.css :root and .dark rules, and lets globals.css hold only var() mappings and generic families', () => {
    expect(
      failures({
        'src/styles/prebid.css': lines(
          ':root { --prebid-ink: #1c3445; --prebid-elevation-1: 0 1px 2px rgb(16 42 67 / 0.06); --prebid-font-body: Arial, sans-serif; }',
          '.dark { --prebid-ink: #e6eef4; --prebid-text-body: 13px; }',
          '.legacy { font: 12px Arial; border-radius: 3px; color: white; }',
          ':root { color: #000; }',
          '.dark .panel, :root.x { --prebid-ink: #fff; }',
          '@media (prefers-color-scheme: dark) { :root { --prebid-ink: #000; } }',
          ':root { .nested { --prebid-ink: #111; } }',
          '.dark { @apply text-sm; }',
        ),
        'src/app/globals.css': lines(
          '@theme inline {',
          '  --font-sans: var(--font-inter), ui-sans-serif, system-ui, sans-serif;',
          '  --font-mono: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;',
          '  --font-serif: Georgia, serif;',
          '  --text-tiny: 9px;',
          '  --text-tiny--line-height: 12px;',
          '  --radius-sm: calc(var(--r) - 2px);',
          '  --shadow-md: 0 1px 2px var(--c);',
          '  --color-brand: #3887c2;',
          '  --color-card: var(--card);',
          '  --font-weight-bold: 700;',
          '}',
          ':root { --background: oklch(1 0 0); }',
          'body { font-family: var(--prebid-font-body), sans-serif; }',
          'code { font-family: Arial; }',
        ),
        'src/elsewhere.css': '.a { font-family: var(--x), sans-serif; }',
      }),
    ).toEqual([
      'src/app/globals.css:4: font-family literal: [@theme inline] --font-serif: Georgia, serif',
      'src/app/globals.css:5: font-size literal: [@theme inline] --text-tiny: 9px',
      'src/app/globals.css:7: border-radius literal: [@theme inline] --radius-sm: calc(var(--r) - 2px)',
      'src/app/globals.css:8: box-shadow literal: [@theme inline] --shadow-md: 0 1px 2px var(--c)',
      'src/app/globals.css:9: colour literal: [@theme inline] --color-brand: #3887c2',
      'src/app/globals.css:13: colour literal: :root --background: oklch(1 0 0)',
      'src/app/globals.css:15: font-family literal: code font-family: Arial',
      'src/elsewhere.css:1: font-family literal: .a font-family: var(--x), sans-serif',
      'src/styles/prebid.css:3: font shorthand literal: .legacy font: 12px Arial',
      'src/styles/prebid.css:3: border-radius literal: .legacy border-radius: 3px',
      'src/styles/prebid.css:3: colour literal: .legacy color: white',
      'src/styles/prebid.css:4: colour literal: :root color: #000',
      'src/styles/prebid.css:5: colour literal: .dark .panel, :root.x --prebid-ink: #fff',
      'src/styles/prebid.css:6: colour literal: [@media (prefers-color-scheme: dark)] :root --prebid-ink: #000',
      'src/styles/prebid.css:7: colour literal: :root { .nested --prebid-ink: #111',
      'src/styles/prebid.css:8: text size utility: .dark text-sm: text-sm',
    ]);
  });

  it('ignores comments, strings and url() fragments', () => {
    expect(
      failures({
        'src/quiet.css': lines(
          '.a { /* color: #fff; */ color: var(--ink); }',
          '.b { content: "#fff"; }',
          ".c { content: 'rgb(0 0 0)'; }",
          '.d { mask: url(#mask); clip-path: url("#a1b2c3"); }',
          '/* .e { font-size: 12px; } */',
        ),
      }),
    ).toEqual([]);
  });

  it('keys declarations by their at-rule context and normalised selector', () => {
    expect(
      failures({
        'src/context.css': lines(
          '.nav { font-size: 12px; }',
          '@media (max-width: 600px) {',
          '  :global(.dark)   .nav,',
          '  .nav:hover { font-size: 11px; }',
          '  @supports (display: grid) { .nav { border-radius: 4px; } }',
          '}',
          '@keyframes pulse { 50% { box-shadow: 0 0 0 4px var(--ring); } }',
          '.card { &:hover { color: #fff; } }',
        ),
      }),
    ).toEqual([
      'src/context.css:1: font-size literal: .nav font-size: 12px',
      'src/context.css:4: font-size literal: [@media (max-width: 600px)] :global(.dark) .nav, .nav:hover font-size: 11px',
      'src/context.css:5: border-radius literal: [@media (max-width: 600px) > @supports (display: grid)] .nav border-radius: 4px',
      'src/context.css:7: box-shadow literal: [@keyframes pulse] 50% box-shadow: 0 0 0 4px var(--ring)',
      'src/context.css:8: colour literal: .card { &:hover color: #fff',
    ]);
  });

  it('checks @apply utilities like class strings', () => {
    expect(failures({ 'src/apply.css': '.a { @apply flex bg-white hover:text-sm; }' })).toEqual([
      'src/apply.css:1: palette colour utility: .a bg-white: bg-white',
      'src/apply.css:1: text size utility: .a hover:text-sm: text-sm',
    ]);
  });

  it('reports a CSS syntax error instead of skipping the file', () => {
    expect(failures({ 'src/broken.css': '.a { color: red' })).toEqual([
      'src/broken.css:1: CSS parse error: Unclosed block',
    ]);
  });
});

describe('control overrides in feature CSS', () => {
  it('rejects a control reached through a descendant or child selector that sets its size, fill, edge, shadow or text size', () => {
    expect(
      failures({
        'src/features/view.module.css': lines(
          '.bar button { height: 30px; }',
          '.bar > input { background: var(--x); }',
          '.bar select { border: 1px solid var(--x); }',
          '.bar summary { border-color: var(--x); }',
          '.bar textarea { box-shadow: none; }',
          '.bar button:hover:enabled { background-color: var(--x); }',
          '.bar input::placeholder { font-size: var(--prebid-text-body); }',
          ".bar input[type='checkbox'] { min-height: 16px; }",
          '.a, .bar Button { height: 1px; }',
          ':global(.dark) .bar>button { height: 1px; }',
          '@media (max-width: 600px) { .bar button { height: 40px; } }',
          '.bar { button { height: 1px; } }',
          '.bar { & > select { height: 1px; } }',
          '.bar button { font-size: 12px; }',
        ),
      }),
    ).toEqual([
      'src/features/view.module.css:1: descendant control override: .bar button height: 30px',
      'src/features/view.module.css:2: descendant control override: .bar > input background: var(--x)',
      'src/features/view.module.css:3: descendant control override: .bar select border: 1px solid var(--x)',
      'src/features/view.module.css:4: descendant control override: .bar summary border-color: var(--x)',
      'src/features/view.module.css:5: descendant control override: .bar textarea box-shadow: none',
      'src/features/view.module.css:6: descendant control override: .bar button:hover:enabled background-color: var(--x)',
      'src/features/view.module.css:7: descendant control override: .bar input::placeholder font-size: var(--prebid-text-body)',
      "src/features/view.module.css:8: descendant control override: .bar input[type='checkbox'] min-height: 16px",
      'src/features/view.module.css:9: descendant control override: .a, .bar Button height: 1px',
      'src/features/view.module.css:10: descendant control override: :global(.dark) .bar>button height: 1px',
      'src/features/view.module.css:11: descendant control override: [@media (max-width: 600px)] .bar button height: 40px',
      'src/features/view.module.css:12: descendant control override: .bar { button height: 1px',
      'src/features/view.module.css:13: descendant control override: .bar { & > select height: 1px',
      'src/features/view.module.css:14: font-size literal, descendant control override: .bar button font-size: 12px',
    ]);
  });

  it('rejects longhand and shorthand forms of the same size, fill, edge and text properties', () => {
    expect(
      failures({
        'src/features/view.module.css': lines(
          '.bar button { border-width: 0; }',
          '.bar button { border-top: 0; }',
          '.bar button { border-style: dashed; }',
          '.bar button { border-bottom-color: var(--x); }',
          '.bar button { border-inline: 0; }',
          '.bar button { font: inherit; }',
          '.bar button { background-image: none; }',
          '.bar button { block-size: 30px; }',
          '.bar button { max-height: 30px; }',
          '.bar button { min-block-size: 30px; }',
          '.bar button { border-top-left-radius: 0; border-start-start-radius: 0; }',
        ),
      }),
    ).toEqual([
      'src/features/view.module.css:1: descendant control override: .bar button border-width: 0',
      'src/features/view.module.css:2: descendant control override: .bar button border-top: 0',
      'src/features/view.module.css:3: descendant control override: .bar button border-style: dashed',
      'src/features/view.module.css:4: descendant control override: .bar button border-bottom-color: var(--x)',
      'src/features/view.module.css:5: descendant control override: .bar button border-inline: 0',
      'src/features/view.module.css:6: descendant control override: .bar button font: inherit',
      'src/features/view.module.css:7: descendant control override: .bar button background-image: none',
      'src/features/view.module.css:8: descendant control override: .bar button block-size: 30px',
      'src/features/view.module.css:9: descendant control override: .bar button max-height: 30px',
      'src/features/view.module.css:10: descendant control override: .bar button min-block-size: 30px',
    ]);
  });

  it('accepts other properties, controls matched by their own class, sibling combinators and other elements', () => {
    expect(
      failures({
        'src/features/view.module.css': lines(
          '.bar button { padding: 4px; color: var(--x); width: 100%; flex-shrink: 0; outline: 2px solid var(--x); border-radius: 0; }',
          '.button { height: 34px; background: var(--x); }',
          '.bar .control { height: 34px; border: 0; }',
          '.bar + button { height: 1px; }',
          '.bar ~ input { height: 1px; }',
          'button { height: 1px; }',
          '.bar button span { height: 1px; }',
          '.bar buttons, .bar input-group { height: 1px; }',
          '.bar :global(button), .bar :is(input) { height: 1px; }',
          ".bar [data-slot='button'] { height: 1px; }",
          '.bar:has(button) { height: 1px; }',
          '.bar:not(button) { height: 1px; }',
        ),
      }),
    ).toEqual([]);
  });

  it('applies only to CSS modules outside src/components/ui and src/styles', () => {
    const rule = '.bar button { height: 30px; }';
    expect(
      failures({
        'src/components/ui/menu.module.css': rule,
        'src/styles/controls.module.css': rule,
        'src/features/plain.css': rule,
        'src/app/globals.css': rule,
        'src/components/charts/bars.module.css': rule,
        'src/app/(dashboard)/route.module.css': rule,
      }),
    ).toEqual([
      'src/app/(dashboard)/route.module.css:1: descendant control override: .bar button height: 30px',
      'src/components/charts/bars.module.css:1: descendant control override: .bar button height: 30px',
    ]);
  });

  it('suppresses an allowlisted override by its selector, property and value', () => {
    const root = fixture({ 'src/features/view.module.css': '.bar button { height: 30px; }' });
    const result = inspectDesignTokens(root, {
      allowlist: {
        version: 1,
        entries: [
          {
            file: 'src/features/view.module.css',
            context: '',
            selector: '.bar button',
            property: 'height',
            value: '30px',
            phase: 'P4',
            reason: 'The shell rebuild replaces this control.',
          },
        ],
      },
    });
    expect(result.allowlisted).toBe(1);
    expect(result.failures).toEqual([]);
  });
});

describe('TSX class strings', () => {
  it('rejects arbitrary values carrying a visual literal and passes layout and var() values', () => {
    expect(
      failures({
        'src/app/globals.css': theme,
        'src/arbitrary.tsx': lines(
          'export const Arbitrary = () => (',
          '  <>',
          '    <p className="text-[13px] bg-[#fff]/50 shadow-[0_0_0_1px_#000] rounded-[5px] [color:#fff] font-[Inter] text-[length:12px]" />',
          '    <p className="bg-[var(--x)] w-[43px] translate-x-[3px] grid-cols-[1fr_auto] text-[length:var(--x)] bg-(--x) shadow-[var(--e)] font-[550] text-(length:--x)" />',
          '  </>',
          ');',
        ),
      }),
    ).toEqual([
      'src/arbitrary.tsx:3: arbitrary font-size literal: [Arbitrary > <p className>] text-[13px]: 13px',
      'src/arbitrary.tsx:3: arbitrary colour literal: [Arbitrary > <p className>] bg-[#fff]/50: #fff',
      'src/arbitrary.tsx:3: arbitrary colour literal, arbitrary box-shadow literal: [Arbitrary > <p className>] shadow-[0_0_0_1px_#000]: 0_0_0_1px_#000',
      'src/arbitrary.tsx:3: arbitrary border-radius literal: [Arbitrary > <p className>] rounded-[5px]: 5px',
      'src/arbitrary.tsx:3: arbitrary colour literal: [Arbitrary > <p className>] [color:#fff]: #fff',
      'src/arbitrary.tsx:3: arbitrary font-family literal: [Arbitrary > <p className>] font-[Inter]: Inter',
      'src/arbitrary.tsx:3: arbitrary font-size literal: [Arbitrary > <p className>] text-[length:12px]: length:12px',
    ]);
  });

  it('rejects default palette, shadow, text-size, radius and family utilities that the theme does not map', () => {
    expect(
      failures({
        'src/app/globals.css': theme,
        'src/defaults.tsx': lines(
          'export const Defaults = () => (',
          '  <>',
          '    <p className="bg-white bg-black/80 text-red-500 border-t-slate-200 ring-offset-black" />',
          '    <p className="shadow-xl shadow-inner drop-shadow-md text-shadow-sm" />',
          '    <p className="text-xs text-sm/6 text-base text-2xl rounded rounded-2xl rounded-t-lg font-serif" />',
          '    <p className="bg-card text-primary-foreground bg-transparent text-current border-inherit shadow shadow-sm shadow-none text-small text-left text-wrap rounded-md rounded-full rounded-none font-mono font-bold border-2 ring-2 outline-hidden" />',
          '  </>',
          ');',
        ),
      }),
    ).toEqual([
      'src/defaults.tsx:3: palette colour utility: [Defaults > <p className>] bg-white: bg-white',
      'src/defaults.tsx:3: palette colour utility: [Defaults > <p className>] bg-black/80: bg-black',
      'src/defaults.tsx:3: palette colour utility: [Defaults > <p className>] text-red-500: text-red-500',
      'src/defaults.tsx:3: palette colour utility: [Defaults > <p className>] border-t-slate-200: border-t-slate-200',
      'src/defaults.tsx:3: palette colour utility: [Defaults > <p className>] ring-offset-black: ring-offset-black',
      'src/defaults.tsx:4: shadow utility: [Defaults > <p className>] shadow-xl: shadow-xl',
      'src/defaults.tsx:4: shadow utility: [Defaults > <p className>] shadow-inner: shadow-inner',
      'src/defaults.tsx:4: shadow utility: [Defaults > <p className>] drop-shadow-md: drop-shadow-md',
      'src/defaults.tsx:4: shadow utility: [Defaults > <p className>] text-shadow-sm: text-shadow-sm',
      'src/defaults.tsx:5: text size utility: [Defaults > <p className>] text-xs: text-xs',
      'src/defaults.tsx:5: text size utility: [Defaults > <p className>] text-sm/6: text-sm',
      'src/defaults.tsx:5: text size utility: [Defaults > <p className>] text-base: text-base',
      'src/defaults.tsx:5: text size utility: [Defaults > <p className>] text-2xl: text-2xl',
      'src/defaults.tsx:5: radius utility: [Defaults > <p className>] rounded: rounded',
      'src/defaults.tsx:5: radius utility: [Defaults > <p className>] rounded-2xl: rounded-2xl',
      'src/defaults.tsx:5: radius utility: [Defaults > <p className>] rounded-t-lg: rounded-t-lg',
      'src/defaults.tsx:5: font-family utility: [Defaults > <p className>] font-serif: font-serif',
    ]);
  });

  it('reads the utility behind variant and important prefixes', () => {
    expect(
      failures({
        'src/app/globals.css': theme,
        'src/prefixed.tsx': lines(
          'export const Prefixed = () => (',
          '  <p className="hover:bg-white dark:md:text-red-500 md:text-sm !text-lg text-xs! [&_svg]:text-base data-[state=open]:bg-black/50 hover:[color:#fff] -translate-x-1 group-hover/item:shadow-xl" />',
          ');',
        ),
      }),
    ).toEqual([
      'src/prefixed.tsx:2: palette colour utility: [Prefixed > <p className>] hover:bg-white: bg-white',
      'src/prefixed.tsx:2: palette colour utility: [Prefixed > <p className>] dark:md:text-red-500: text-red-500',
      'src/prefixed.tsx:2: text size utility: [Prefixed > <p className>] md:text-sm: text-sm',
      'src/prefixed.tsx:2: text size utility: [Prefixed > <p className>] !text-lg: text-lg',
      'src/prefixed.tsx:2: text size utility: [Prefixed > <p className>] text-xs!: text-xs',
      'src/prefixed.tsx:2: text size utility: [Prefixed > <p className>] [&_svg]:text-base: text-base',
      'src/prefixed.tsx:2: palette colour utility: [Prefixed > <p className>] data-[state=open]:bg-black/50: bg-black',
      'src/prefixed.tsx:2: arbitrary colour literal: [Prefixed > <p className>] hover:[color:#fff]: #fff',
      'src/prefixed.tsx:2: shadow utility: [Prefixed > <p className>] group-hover/item:shadow-xl: shadow-xl',
    ]);
  });

  it('reads cn, clsx, twMerge and every cva base, variant and compound class, past the first child', () => {
    expect(
      failures({
        'src/app/globals.css': theme,
        'src/helpers.tsx': lines(
          "import { cva } from 'class-variance-authority';",
          "import { cn } from '@/lib/utils';",
          "const buttonVariants = cva('inline-flex text-sm', {",
          '  variants: {',
          '    variant: {',
          "      default: 'bg-card',",
          "      outline: 'bg-white',",
          "      ghost: ['hover:bg-card', 'text-red-500'],",
          '    },',
          '    size: {',
          "      sm: { nested: 'text-xs' },",
          "      lg: 'text-lg',",
          '    },',
          '  },',
          "  compoundVariants: [{ variant: 'outline', size: 'sm', class: 'shadow-xl' }],",
          "  defaultVariants: { variant: 'default', size: 'sm' },",
          '});',
          'export function Merge({ on }: { on: boolean }) {',
          '  return (',
          '    <p',
          "      className={cn('flex', clsx('bg-white'), twMerge('text-sm'), on && 'text-lg', { 'bg-black': on, 'text-xs': !on })}",
          '    />',
          '  );',
          '}',
        ),
      }),
    ).toEqual([
      'src/helpers.tsx:3: text size utility: [cva buttonVariants] text-sm: text-sm',
      'src/helpers.tsx:7: palette colour utility: [cva buttonVariants > variants > variant > outline] bg-white: bg-white',
      'src/helpers.tsx:8: palette colour utility: [cva buttonVariants > variants > variant > ghost] text-red-500: text-red-500',
      'src/helpers.tsx:11: text size utility: [cva buttonVariants > variants > size > sm > nested] text-xs: text-xs',
      'src/helpers.tsx:12: text size utility: [cva buttonVariants > variants > size > lg] text-lg: text-lg',
      'src/helpers.tsx:15: shadow utility: [cva buttonVariants > compoundVariants > class] shadow-xl: shadow-xl',
      'src/helpers.tsx:21: text size utility: [Merge > <p className> > cn] text-lg: text-lg',
      'src/helpers.tsx:21: palette colour utility: [Merge > <p className> > cn] bg-black: bg-black',
      'src/helpers.tsx:21: text size utility: [Merge > <p className> > cn] text-xs: text-xs',
      'src/helpers.tsx:21: palette colour utility: [Merge > <p className> > cn > clsx] bg-white: bg-white',
      'src/helpers.tsx:21: text size utility: [Merge > <p className> > cn > twMerge] text-sm: text-sm',
    ]);
  });

  it('visits every sibling statement and JSX child, not only the first', () => {
    expect(
      failures({
        'src/siblings.tsx': lines(
          'export const A = () => <p className="flex" />;',
          'export const B = () => <p className="bg-white" />;',
          'export const C = () => (',
          '  <div>',
          '    <span className="flex" />',
          '    <span className="grid" />',
          '    <span className="text-sm" />',
          '  </div>',
          ');',
        ),
      }),
    ).toEqual([
      'src/siblings.tsx:2: palette colour utility: [B > <p className>] bg-white: bg-white',
      'src/siblings.tsx:7: text size utility: [C > <span className>] text-sm: text-sm',
    ]);
  });

  it('reads both conditional branches, template parts, arrays and class callbacks', () => {
    const root = fixture({
      'src/app/globals.css': theme,
      'src/conditional.tsx': lines(
        'export function Conditional({ on, tone }: { on: boolean; tone: string }) {',
        '  return (',
        '    <>',
        "      <p className={on ? 'bg-card' : 'bg-white'} />",
        "      <p className={`flex ${on ? 'text-sm' : ''} text-lg`} />",
        "      <p className={['flex', on && 'text-xs', tone || 'text-base']} />",
        '      <p className={`bg-${tone}`} />',
        "      <Table rowClassName={(row) => (row.on ? 'bg-black' : undefined)} />",
        "      <p className={tone === 'bg-white' ? 'flex' : 'grid'} />",
        '    </>',
        '  );',
        '}',
        "const config = { itemClassName: 'text-lg' };",
      ),
    });
    const result = inspectDesignTokens(root);
    expect(result.failures).toEqual([
      'src/conditional.tsx:4: palette colour utility: [Conditional > <p className>] bg-white: bg-white',
      'src/conditional.tsx:5: text size utility: [Conditional > <p className>] text-sm: text-sm',
      'src/conditional.tsx:5: text size utility: [Conditional > <p className>] text-lg: text-lg',
      'src/conditional.tsx:6: text size utility: [Conditional > <p className>] text-xs: text-xs',
      'src/conditional.tsx:6: text size utility: [Conditional > <p className>] text-base: text-base',
      'src/conditional.tsx:8: palette colour utility: [Conditional > <Table rowClassName>] bg-black: bg-black',
      'src/conditional.tsx:13: text size utility: [config > itemClassName] text-lg: text-lg',
    ]);
    expect(result.unmodelled).toEqual([
      'src/conditional.tsx:6: [Conditional > <p className>] class value is not a literal: tone',
      'src/conditional.tsx:7: [Conditional > <p className>] class name built by interpolation: `bg-${tone}`',
    ]);
  });

  it('reports class values that are identifiers or calls, but not CSS module members', () => {
    const result = inspectDesignTokens(
      fixture({
        'src/opaque-classes.tsx': lines(
          "import { cva } from 'class-variance-authority';",
          "import styles from './view.module.css';",
          'export function Opaque({ className, tone }: Props) {',
          '  return (',
          '    <>',
          '      <p className={className} />',
          "      <p className={cn('flex', className, variants({ tone }), clsx('grid'), styles.root)} />",
          '      <p className={`flex ${className}`} />',
          '      <p className={`bg-${tone}`} />',
          '      <p className={styles.root} />',
          '      <p className={undefined} itemClassName={pick(tone)} />',
          "      <p className={'flex ' + className} />",
          "      <p className={'bg-' + tone} />",
          '    </>',
          '  );',
          '}',
          "const variants = cva(shared, { variants: { tone: { quiet: quietClasses, loud: 'flex' } } });",
        ),
      }),
    );
    expect(result.failures).toEqual([]);
    expect(result.unmodelled).toEqual([
      'src/opaque-classes.tsx:6: [Opaque > <p className>] class value is not a literal: className',
      'src/opaque-classes.tsx:7: [Opaque > <p className> > cn] class value is not a literal: className',
      'src/opaque-classes.tsx:7: [Opaque > <p className> > cn] class value is not a literal: variants({ tone })',
      'src/opaque-classes.tsx:8: [Opaque > <p className>] class value is not a literal: className',
      'src/opaque-classes.tsx:9: [Opaque > <p className>] class name built by interpolation: `bg-${tone}`',
      'src/opaque-classes.tsx:11: [Opaque > <p itemClassName>] class value is not a literal: pick(tone)',
      'src/opaque-classes.tsx:12: [Opaque > <p className>] class value is not a literal: className',
      "src/opaque-classes.tsx:13: [Opaque > <p className>] class name built by concatenation: 'bg-' + tone",
      'src/opaque-classes.tsx:17: [cva variants] class value is not a literal: shared',
      'src/opaque-classes.tsx:17: [cva variants > variants > tone > quiet] class value is not a literal: quietClasses',
    ]);
  });

  it('ignores class names in comments', () => {
    expect(
      failures({
        'src/commented.tsx': lines(
          '// <p className="bg-white" />',
          '/* const colour = "#fff"; */',
          'export const Commented = () => (',
          '  <div>',
          '    {/* <p className="text-sm" style={{ color: "#fff" }} /> */}',
          '  </div>',
          ');',
        ),
      }),
    ).toEqual([]);
  });
});

describe('TSX style objects and attributes', () => {
  it('checks style objects like declarations and reports what it cannot read', () => {
    const result = inspectDesignTokens(
      fixture({
        'src/styled.tsx': lines(
          'export function Styled({ on, tone, base }: Props) {',
          '  return (',
          '    <>',
          "      <p style={{ color: '#fff', boxShadow: '0 1px 2px var(--c)', fontSize: 12, fontFamily: 'Arial', borderRadius: 4, width: 12 }} />",
          "      <p style={on ? { background: 'red' } : { backgroundColor: 'rgb(0 0 0)' }} />",
          "      <p style={{ borderColor: on ? 'var(--x)' : '#000', fill: '#111', stroke: 'hsl(0 0% 0%)', borderRadius: 0, fontSize: 'var(--prebid-text-body)', '--bar': '#222' }} />",
          '      <p style={base} />',
          '      <p style={{ ...base, color: tone }} />',
          "      <Tooltip contentStyle={{ background: '#fff' }} />",
          '      <p style={on ? undefined : { width: 1 }} />',
          '    </>',
          '  );',
          '}',
        ),
      }),
    );
    expect(result.failures).toEqual([
      'src/styled.tsx:4: colour literal: [Styled > <p style>] color: #fff',
      'src/styled.tsx:4: box-shadow literal: [Styled > <p style>] boxShadow: 0 1px 2px var(--c)',
      'src/styled.tsx:4: font-size literal: [Styled > <p style>] fontSize: 12',
      'src/styled.tsx:4: font-family literal: [Styled > <p style>] fontFamily: Arial',
      'src/styled.tsx:4: border-radius literal: [Styled > <p style>] borderRadius: 4',
      'src/styled.tsx:5: colour literal: [Styled > <p style>] background: red',
      'src/styled.tsx:5: colour literal: [Styled > <p style>] backgroundColor: rgb(0 0 0)',
      'src/styled.tsx:6: colour literal: [Styled > <p style>] borderColor: #000',
      'src/styled.tsx:6: colour literal: [Styled > <p style>] fill: #111',
      'src/styled.tsx:6: colour literal: [Styled > <p style>] stroke: hsl(0 0% 0%)',
      'src/styled.tsx:6: colour literal: [Styled > <p style>] --bar: #222',
      'src/styled.tsx:9: colour literal: [Styled > <Tooltip contentStyle>] background: #fff',
    ]);
    expect(result.unmodelled).toEqual([
      'src/styled.tsx:7: [Styled > <p style>] style={base} is not an object literal',
      'src/styled.tsx:8: [Styled > <p style>] ...base is not an object literal',
      'src/styled.tsx:8: [Styled > <p style>] color value is not a literal: tone',
    ]);
  });

  it('checks colour attributes and object-literal attribute values', () => {
    const result = inspectDesignTokens(
      fixture({
        'src/marks.tsx': lines(
          'export function Marks({ tone, rest }: Props) {',
          '  return (',
          '    <svg>',
          '      <path fill="#fff" stroke="rgb(0 0 0)" color="white" />',
          '      <stop stopColor="#123456" />',
          '      <path fill="var(--chart-1)" stroke="none" color="currentColor" />',
          '      <path fill={tone} />',
          "      <XAxis tick={{ fontSize: 11, fill: '#666', fontFamily: 'Inter' }} />",
          "      <YAxis tick={{ fontSize: 'var(--x)', fill: 'var(--y)' }} margin={{ top: 4 }} label={{ ...rest }} />",
          '    </svg>',
          '  );',
          '}',
        ),
      }),
    );
    expect(result.failures).toEqual([
      'src/marks.tsx:4: colour literal: [Marks > <path fill>] fill: #fff',
      'src/marks.tsx:4: colour literal: [Marks > <path stroke>] stroke: rgb(0 0 0)',
      'src/marks.tsx:4: colour literal: [Marks > <path color>] color: white',
      'src/marks.tsx:5: colour literal: [Marks > <stop stopColor>] stopColor: #123456',
      'src/marks.tsx:8: font-size literal: [Marks > <XAxis tick>] fontSize: 11',
      'src/marks.tsx:8: colour literal: [Marks > <XAxis tick>] fill: #666',
      'src/marks.tsx:8: font-family literal: [Marks > <XAxis tick>] fontFamily: Inter',
    ]);
    expect(result.unmodelled).toEqual([
      'src/marks.tsx:7: [Marks > <path fill>] fill value is not a literal: tone',
    ]);
  });

  it('checks fontSize, fontFamily, rx, ry and radius attributes like style values', () => {
    const result = inspectDesignTokens(
      fixture({
        'src/chart.tsx': lines(
          'export function Chart({ size, family }: Props) {',
          '  return (',
          '    <svg>',
          '      <text fontSize={11} fontFamily="Inter" />',
          '      <text fontSize="var(--prebid-text-body)" fontFamily="var(--prebid-font-body)" />',
          '      <rect rx={4} ry="2px" />',
          '      <rect rx={0} ry="50%" />',
          '      <Bar radius={[4, 4, 0, 0]} />',
          '      <Bar radius={6} />',
          '      <text fontSize={size} fontFamily={family} />',
          '    </svg>',
          '  );',
          '}',
        ),
      }),
    );
    expect(result.failures).toEqual([
      'src/chart.tsx:4: font-size literal: [Chart > <text fontSize>] fontSize: 11',
      'src/chart.tsx:4: font-family literal: [Chart > <text fontFamily>] fontFamily: Inter',
      'src/chart.tsx:6: border-radius literal: [Chart > <rect rx>] rx: 4',
      'src/chart.tsx:6: border-radius literal: [Chart > <rect ry>] ry: 2px',
      'src/chart.tsx:8: border-radius literal: [Chart > <Bar radius>] radius: 4',
      'src/chart.tsx:8: border-radius literal: [Chart > <Bar radius> #2] radius: 4',
      'src/chart.tsx:9: border-radius literal: [Chart > <Bar radius>] radius: 6',
    ]);
    expect(result.unmodelled).toEqual([
      'src/chart.tsx:10: [Chart > <text fontSize>] fontSize value is not a literal: size',
      'src/chart.tsx:10: [Chart > <text fontFamily>] fontFamily value is not a literal: family',
    ]);
  });
});

describe('unmodelled sites', () => {
  const opaque = (count: number) =>
    lines(
      ...Array.from(
        { length: count },
        (_, index) => `export const Opaque${index} = ({ s }: Props) => <p style={s} />;`,
      ),
    );

  it('lists unmodelled sites up to the ceiling and fails one past it', () => {
    const at = inspectDesignTokens(fixture({ 'src/opaque.tsx': opaque(unmodelledCeiling) }));
    expect(at.unmodelled).toHaveLength(unmodelledCeiling);
    expect(at.unmodelled[0]).toBe(
      'src/opaque.tsx:1: [Opaque0 > <p style>] style={s} is not an object literal',
    );
    expect(at.failures).toEqual([]);

    const over = inspectDesignTokens(fixture({ 'src/opaque.tsx': opaque(unmodelledCeiling + 1) }));
    expect(over.unmodelled).toHaveLength(unmodelledCeiling + 1);
    expect(over.failures).toEqual([
      `${unmodelledCeiling + 1} unmodelled sites exceed the ceiling of ${unmodelledCeiling}`,
    ]);
  });

  it('pins the unmodelled ceiling to the count in the tree', () => {
    expect(unmodelledCeiling).toBeLessThanOrEqual(UNMODELLED_CEILING);
  });
});

describe('token references', () => {
  it('rejects literal references to --prebid- names that the prebid.css :root and .dark rules do not define', () => {
    expect(
      failures({
        'src/styles/prebid.css': lines(
          ':root { --prebid-ink: #1c3445; --prebid-alias: var(--prebid-primitive); }',
          '.dark { --prebid-ink: #e6eef4; }',
          '@media print { :root { --prebid-print: var(--prebid-ink); } }',
        ),
        'src/refs.css': lines(
          '.a { color: var(--prebid-ink); background: var(--prebid-nope); }',
          '.b { border: 1px solid var(--prebid-line-missing, var(--prebid-ink)); }',
          '.c { content: "var(--prebid-quoted)"; color: var(--other-thing); }',
          '.d { @apply bg-(--prebid-gone) text-[var(--prebid-absent)] bg-(--prebid-ink); }',
          '.e { color: var(--prebid-print); }',
        ),
        'src/refs.tsx': lines(
          'export function Refs({ level, token }: Props) {',
          '  return (',
          '    <>',
          "      <p style={{ color: 'var(--prebid-missing)', boxShadow: `var(--prebid-elevation-${level})`, background: `var(${token})` }} />",
          '      <p className="text-(--prebid-unknown) bg-[var(--prebid-ink)] font-stretch-(length:--prebid-stretch) bg-(--prebid-ink)" />',
          '      <path fill="var(--prebid-chart-9)" stroke={`var(--prebid-edge) ${token}`} />',
          '    </>',
          '  );',
          '}',
        ),
        'src/lib/refs.ts': "export const ring = 'var(--prebid-ring-x, var(--prebid-ink))';",
      }),
    ).toEqual([
      'src/refs.css:1: undefined token --prebid-nope: .a background: var(--prebid-nope)',
      'src/refs.css:2: undefined token --prebid-line-missing: .b border: 1px solid var(--prebid-line-missing, var(--prebid-ink))',
      'src/refs.css:4: undefined token --prebid-gone: .d @apply: bg-(--prebid-gone)',
      'src/refs.css:4: undefined token --prebid-absent: .d @apply: text-[var(--prebid-absent)]',
      'src/refs.css:5: undefined token --prebid-print: .e color: var(--prebid-print)',
      'src/styles/prebid.css:1: undefined token --prebid-primitive: :root --prebid-alias: var(--prebid-primitive)',
      'src/refs.tsx:4: undefined token --prebid-missing: [Refs > <p style> > color] string: var(--prebid-missing)',
      'src/refs.tsx:5: undefined token --prebid-unknown: [Refs > <p className>] class: text-(--prebid-unknown)',
      'src/refs.tsx:5: undefined token --prebid-stretch: [Refs > <p className>] class: font-stretch-(length:--prebid-stretch)',
      'src/refs.tsx:6: undefined token --prebid-chart-9: [Refs > <path fill>] string: var(--prebid-chart-9)',
      'src/refs.tsx:6: undefined token --prebid-edge: [Refs > <path stroke>] string: var(--prebid-edge)',
      'src/lib/refs.ts:1: undefined token --prebid-ring-x: [ring] string: var(--prebid-ring-x, var(--prebid-ink))',
    ]);
  });
});

describe('colour literals in other strings', () => {
  it('rejects colour literals in .ts and other .tsx strings', () => {
    expect(
      failures({
        'src/lib/palette.ts': lines(
          "export const palette = ['#3887c2', 'var(--chart-1)'];",
          'export const shadow = `0 1px ${2}px rgb(0 0 0 / 0.1)`;',
          "export const notes = ['Fix #12', '#main', '&#123;', 'a#fff', 'pick a color (light)'];",
        ),
        'src/brand.tsx': "export const brand = { fill: 'hsl(0 0% 100%)' };",
      }),
    ).toEqual([
      'src/brand.tsx:1: colour literal: [brand > fill] string: hsl(0 0% 100%)',
      'src/lib/palette.ts:1: colour literal: [palette] string: #3887c2',
      'src/lib/palette.ts:2: colour literal: [shadow] string: px rgb(0 0 0 / 0.1)',
    ]);
  });
});

describe('text arrows', () => {
  it('rejects U+2190 to U+21FF in src strings and JSX text, spelled or escaped', () => {
    expect(
      failures({
        'src/arrows.tsx': lines(
          'export const Back = () => <a aria-label="← All">← Back</a>;',
          "export const escaped = '\\u2192 Next';",
          "export const pair = ['⇐', 'x', '↿'];",
          'export const hint = `more ${1} ⇿`;',
          'export const Entities = () => (',
          '  <p title="&larr; Back">',
          '    <a>Next&nbsp;&rarr;</a>',
          '    <a>&#8594;</a>',
          '    <a>&#x21D2;</a>',
          '  </p>',
          ');',
        ),
      }),
    ).toEqual([
      'src/arrows.tsx:1: text arrow: [Back > <a aria-label>] text: ← All',
      'src/arrows.tsx:1: text arrow: [Back] text: ← Back',
      'src/arrows.tsx:2: text arrow: [escaped] text: → Next',
      'src/arrows.tsx:3: text arrow: [pair] text: ⇐',
      'src/arrows.tsx:3: text arrow: [pair] text: ↿',
      'src/arrows.tsx:4: text arrow: [hint] text: `more ${1} ⇿`',
      'src/arrows.tsx:6: text arrow: [Entities > <p title>] text: &larr; Back',
      'src/arrows.tsx:7: text arrow: [Entities] text: Next&nbsp;&rarr;',
      'src/arrows.tsx:8: text arrow: [Entities] text: &#8594;',
      'src/arrows.tsx:9: text arrow: [Entities] text: &#x21D2;',
    ]);
  });

  it('reports an arrow chosen by a conditional once, with its expression', () => {
    expect(
      failures({
        'src/sort.tsx': lines(
          'export const Sort = ({ down, on }: { down: boolean; on: boolean }) => (',
          "  <b>{on ? (down ? ' ↓' : ' ↑') : ''}</b>",
          ');',
          "export const label = (name: string) => name + ' →';",
        ),
      }),
    ).toEqual([
      "src/sort.tsx:2: text arrow: [Sort] text: on ? (down ? ' ↓' : ' ↑') : ''",
      "src/sort.tsx:4: text arrow: [label] text: name + ' →'",
    ]);
  });

  it('ignores comments, other characters, other entities and files outside src', () => {
    expect(
      failures({
        'src/plain.tsx': lines(
          '// ← Back, in a comment',
          "export const dots = '· — … ⟶ ⬅';",
          'export const Plain = () => <a title="&amp;">&#8230; &nbsp; &copy;</a>;',
          '/* → */ export const n = 1;',
        ),
        '.storybook/arrows.tsx': 'export const Story = () => <a>← Back</a>;',
      }),
    ).toEqual([]);
  });

  it('suppresses an allowlisted arrow site by its expression', () => {
    const root = fixture({
      'src/sort.tsx': "export const Sort = (down: boolean) => <b>{down ? ' ↓' : ' ↑'}</b>;",
    });
    const result = inspectDesignTokens(root, {
      allowlist: {
        version: 1,
        entries: [
          {
            file: 'src/sort.tsx',
            context: 'Sort',
            selector: '',
            property: 'text',
            value: "down ? ' ↓' : ' ↑'",
            phase: 'P4',
            reason: 'Direction glyph that a later phase replaces.',
          },
        ],
      },
    });
    expect(result.allowlisted).toBe(1);
    expect(result.failures).toEqual([]);
  });
});

describe('allowlist', () => {
  const css = lines(
    '.nav { font-size: 12px; }',
    '@media (max-width: 600px) { .nav { font-size: 12px; } }',
    '.twice { color: #fff; color: #fff; }',
  );
  const entry = {
    file: 'src/allow.css',
    context: '',
    selector: '.nav',
    property: 'font-size',
    value: '12px',
    phase: 'P4',
    reason: 'Shell sizes move with the shell rebuild.',
  };
  const unsuppressed = [
    'src/allow.css:2: font-size literal: [@media (max-width: 600px)] .nav font-size: 12px',
    'src/allow.css:3: colour literal: .twice color: #fff',
    'src/allow.css:3: colour literal: [#2] .twice color: #fff',
  ];
  const inspect = (allowlist: unknown) =>
    inspectDesignTokens(fixture({ 'src/allow.css': css }), { allowlist });

  it('suppresses exactly the site an entry names, by context and value', () => {
    const result = inspect({ version: 1, entries: [entry] });
    expect(result.allowlisted).toBe(1);
    expect(result.failures).toEqual(unsuppressed);
  });

  it('tells identical sites in one context apart, one entry each', () => {
    const twice = { ...entry, selector: '.twice', property: 'color', value: '#fff' };
    expect(inspect({ version: 1, entries: [twice] }).failures).toEqual([
      'src/allow.css:1: font-size literal: .nav font-size: 12px',
      'src/allow.css:2: font-size literal: [@media (max-width: 600px)] .nav font-size: 12px',
      'src/allow.css:3: colour literal: [#2] .twice color: #fff',
    ]);
    const both = inspect({ version: 1, entries: [twice, { ...twice, context: '#2' }] });
    expect(both.allowlisted).toBe(2);
    expect(both.failures).toEqual([
      'src/allow.css:1: font-size literal: .nav font-size: 12px',
      'src/allow.css:2: font-size literal: [@media (max-width: 600px)] .nav font-size: 12px',
    ]);
  });

  it('treats a changed value as a new site and the old entry as unused', () => {
    const result = inspect({ version: 1, entries: [{ ...entry, value: '13px' }] });
    expect(result.allowlisted).toBe(0);
    expect(result.failures).toEqual([
      'src/allow.css:1: font-size literal: .nav font-size: 12px',
      ...unsuppressed,
      'Unused allowlist entry: src/allow.css .nav font-size: 13px',
    ]);
  });

  it('rejects duplicate entries, empty reasons and phases other than P2, P3 and P4', () => {
    const result = inspect({
      version: 1,
      entries: [
        entry,
        entry,
        { ...entry, context: '@media (max-width: 600px)', reason: '  ' },
        { ...entry, selector: '.twice', property: 'color', value: '#fff', phase: 'P1' },
        {
          ...entry,
          selector: '.twice',
          property: 'color',
          value: '#fff',
          context: '#2',
          phase: 'P5',
        },
      ],
    });
    expect(result.allowlisted).toBe(4);
    expect(result.failures).toEqual([
      'Duplicate allowlist entry: src/allow.css .nav font-size: 12px',
      'Allowlist entry has no reason: src/allow.css [@media (max-width: 600px)] .nav font-size: 12px',
      // P1 is finished, so its entry fails as completed rather than unknown.
      'Allowlist entry is owned by completed phase P1: src/allow.css .twice color: #fff',
      'Allowlist entry phase "P5" is not P2, P3 or P4: src/allow.css [#2] .twice color: #fff',
    ]);
  });

  it('rejects entries owned by a completed phase, naming the phase', () => {
    const result = inspectDesignTokens(fixture({ 'src/allow.css': css }), {
      allowlist: {
        version: 1,
        entries: [
          { ...entry, phase: 'P3' },
          { ...entry, context: '@media (max-width: 600px)', phase: 'P2' },
        ],
      },
      completedPhases: ['P3'],
    });
    expect(result.allowlisted).toBe(2);
    expect(result.failures).toEqual([
      'src/allow.css:3: colour literal: .twice color: #fff',
      'src/allow.css:3: colour literal: [#2] .twice color: #fff',
      'Allowlist entry is owned by completed phase P3: src/allow.css .nav font-size: 12px',
    ]);
  });

  it('rejects an allowlist of the wrong shape', () => {
    const { reason: _reason, ...incomplete } = entry;
    const result = inspect({ version: 1, entries: [incomplete] });
    expect(result.failures).toEqual([
      'src/allow.css:1: font-size literal: .nav font-size: 12px',
      ...unsuppressed,
      expect.stringMatching(/^Invalid allowlist: entries\.0\.reason: /),
    ]);
    expect(inspect({ version: 2, entries: [] }).failures.at(-1)).toMatch(
      /^Invalid allowlist: version: /,
    );
  });

  it('reads the default allowlist file and an explicit path', () => {
    const root = fixture({
      'src/allow.css': css,
      'scripts/design-token-allowlist.json': JSON.stringify({ version: 1, entries: [entry] }),
      'custom.json': JSON.stringify({ version: 1, entries: [] }),
    });
    expect(inspectDesignTokens(root).allowlisted).toBe(1);
    expect(inspectDesignTokens(root, { allowlist: 'custom.json' }).allowlisted).toBe(0);
    expect(inspectDesignTokens(root, { allowlist: 'missing.json' }).failures.at(-1)).toBe(
      'Allowlist not found: missing.json',
    );
  });

  it('keys TSX sites by symbol path and utility', () => {
    const root = fixture({
      'src/button.tsx': lines(
        "const buttonVariants = cva('flex', {",
        "  variants: { variant: { outline: 'bg-white', ghost: 'bg-white' } },",
        '});',
      ),
    });
    const result = inspectDesignTokens(root, {
      allowlist: {
        version: 1,
        entries: [
          {
            file: 'src/button.tsx',
            context: 'cva buttonVariants > variants > variant > outline',
            selector: '',
            property: 'bg-white',
            value: 'bg-white',
            phase: 'P4',
            reason: 'The outline button is restyled with the P4 shell.',
          },
        ],
      },
    });
    expect(result.allowlisted).toBe(1);
    expect(result.failures).toEqual([
      'src/button.tsx:2: palette colour utility: [cva buttonVariants > variants > variant > ghost] bg-white: bg-white',
    ]);
  });

  it('offers a ready-to-edit entry for each current failure', () => {
    const root = fixture({ 'src/allow.css': css });
    expect(designTokenCandidates(root, { allowlist: { version: 1, entries: [entry] } })).toEqual({
      failures: 3,
      candidates: {
        version: 1,
        entries: [
          { ...entry, context: '@media (max-width: 600px)', phase: '', reason: '' },
          { ...entry, selector: '.twice', property: 'color', value: '#fff', phase: '', reason: '' },
          {
            ...entry,
            context: '#2',
            selector: '.twice',
            property: 'color',
            value: '#fff',
            phase: '',
            reason: '',
          },
        ],
      },
    });
  });

  it('keeps the committed allowlist within its ceiling and owned by a later phase', () => {
    const decoded = JSON.parse(
      readFileSync(resolve('scripts/design-token-allowlist.json'), 'utf8'),
    ) as { version: number; entries: { phase: string }[] };
    expect(decoded.version).toBe(1);
    expect(decoded.entries.length).toBeLessThanOrEqual(CEILING);
    for (const { phase } of decoded.entries) {
      expect(['P2', 'P3', 'P4']).toContain(phase);
      expect(completedPhases).not.toContain(phase);
    }
  });
});

describe('command line', () => {
  it.each(['direct', 'symlinked'] as const)(
    'prints the JSON result and sets the exit code through a %s path',
    (kind) => {
      const link = realpathSync(mkdtempSync(join(tmpdir(), 'token-link-')));
      directories.push(link);
      symlinkSync(resolve('scripts'), join(link, 'scripts'), 'dir');
      const script =
        kind === 'direct'
          ? resolve('scripts/check-design-tokens.mjs')
          : join(link, 'scripts/check-design-tokens.mjs');
      const run = (cwd: string, ...args: string[]) =>
        spawnSync(process.execPath, [script, ...args], { cwd, encoding: 'utf8' });

      const failing = fixture({ 'src/a.css': '.a { color: #fff; }' });
      const failed = run(failing);
      expect(failed.status).toBe(1);
      expect(JSON.parse(failed.stdout)).toEqual(inspectDesignTokens(failing));
      expect(JSON.parse(failed.stdout)).toMatchObject({
        cssFiles: ['src/a.css', 'src/base.css', 'src/styles/prebid.css'],
        tsxFiles: ['src/base.tsx'],
        failures: ['src/a.css:1: colour literal: .a color: #fff'],
      });

      const candidates = run(failing, '--candidates');
      expect(candidates.status).toBe(1);
      expect(JSON.parse(candidates.stdout)).toEqual({
        version: 1,
        entries: [
          {
            file: 'src/a.css',
            context: '',
            selector: '.a',
            property: 'color',
            value: '#fff',
            phase: '',
            reason: '',
          },
        ],
      });

      const passing = run(fixture({}));
      expect(passing.status).toBe(0);
      expect(JSON.parse(passing.stdout)).toMatchObject({ failures: [] });

      const empty = run(fixture({}, { bare: true }));
      expect(empty.status).toBe(1);
      expect(JSON.parse(empty.stdout)).toMatchObject({
        failures: ['No CSS files selected', 'No TSX files selected'],
      });

      const unknown = run(failing, '--candidate');
      expect(unknown.status).toBe(1);
      expect(unknown.stderr).toContain('Expected [--candidates]');
      expect(unknown.stdout).toBe('');
    },
  );
});
