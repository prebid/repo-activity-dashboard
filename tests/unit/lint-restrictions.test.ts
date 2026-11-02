// @vitest-environment node
import { ESLint } from 'eslint';
import { beforeAll, describe, expect, it } from 'vitest';

// Fixture text is linted with the real eslint.config.mjs under tracked paths, because the
// type-checked rules need a file the TypeScript project service knows. Each case asserts every
// message as [ruleId, line], so a parse error (ruleId null) or another rule's report fails it.
const eslint = new ESLint({ cwd: process.cwd() });
const paths = {
  feature: 'src/features/repositories/all-repositories-view.tsx',
  route: 'src/app/layout.tsx',
  component: 'src/components/tables/column-menu.tsx',
  test: 'tests/unit/architecture.test.ts',
  story: '.storybook/preview.tsx',
  script: 'scripts/check-design-tokens.mjs',
  iconMap: 'src/components/ui/icons.ts',
  primitive: 'src/components/ui/button.tsx',
  layout: 'src/components/layout/theme-menu.tsx',
  componentTest: 'tests/components/fields.test.tsx',
} as const;
const lines = (...source: string[]) => source.join('\n') + '\n';

async function reports(path: string, text: string) {
  const [result] = await eslint.lintText(text, { filePath: path });
  return result.messages.map((message) => [message.ruleId, message.line] as const);
}

// Each import form, one per line, with the imported names used so no other rule reports them.
const iconImports = {
  static: lines("import { ArrowLeft } from 'lucide-react';", 'export const Glyph = ArrowLeft;'),
  namespace: lines("import * as lucide from 'lucide-react';", 'export const Glyph = lucide.X;'),
  type: lines("import type { LucideIcon } from 'lucide-react';", 'export type Glyph = LucideIcon;'),
  reExport: lines("export { ArrowLeft } from 'lucide-react';"),
  exportAll: lines("export * from 'lucide-react';"),
  deep: lines(
    "import { DynamicIcon } from 'lucide-react/dynamic';",
    'export const Glyph = DynamicIcon;',
  ),
  dynamic: lines("export const load = () => import('lucide-react');"),
  dynamicDeep: lines("export const load = () => import('lucide-react/dynamic');"),
  dynamicTemplate: lines('export const load = () => import(`lucide-react`);'),
  typeQuery: lines("export type Glyph = typeof import('lucide-react').ArrowLeft;"),
};

describe('rule 4: icons come from the icon map', { timeout: 30_000 }, () => {
  beforeAll(async () => {
    // The first lint loads the config, plugins and the TypeScript project, which takes over
    // 30s on shared CI runners.
    await reports(paths.feature, lines('export const warm = 1;'));
  }, 90_000);

  it('rejects every static, type, re-export and deep import of lucide-react', async () => {
    expect(await reports(paths.feature, iconImports.static)).toEqual([
      ['no-restricted-imports', 1],
    ]);
    expect(await reports(paths.feature, iconImports.namespace)).toEqual([
      ['no-restricted-imports', 1],
    ]);
    expect(await reports(paths.feature, iconImports.type)).toEqual([['no-restricted-imports', 1]]);
    expect(await reports(paths.feature, iconImports.reExport)).toEqual([
      ['no-restricted-imports', 1],
    ]);
    expect(await reports(paths.feature, iconImports.exportAll)).toEqual([
      ['no-restricted-imports', 1],
    ]);
    expect(await reports(paths.feature, iconImports.deep)).toEqual([['no-restricted-imports', 1]]);
  });

  it('rejects dynamic imports and type queries of lucide-react', async () => {
    for (const text of [
      iconImports.dynamic,
      iconImports.dynamicDeep,
      iconImports.dynamicTemplate,
      iconImports.typeQuery,
    ])
      expect(await reports(paths.feature, text), text).toEqual([['no-restricted-syntax', 1]]);
  });

  it('applies in routes, shared components, tests, stories and scripts', async () => {
    const both = lines(
      "import { ArrowLeft } from 'lucide-react';",
      'export const Glyph = ArrowLeft;',
      "export const load = () => import('lucide-react');",
    );
    const expected = [
      ['no-restricted-imports', 1],
      ['no-restricted-syntax', 3],
    ];
    for (const path of [paths.route, paths.component, paths.test, paths.story])
      expect(await reports(path, both), path).toEqual(expected);
    expect(
      await reports(
        paths.script,
        lines("import { ArrowLeft } from 'lucide-react';", 'export const Glyph = ArrowLeft;'),
      ),
    ).toEqual([['no-restricted-imports', 1]]);
  });

  it('accepts every form inside the icon map', async () => {
    for (const text of Object.values(iconImports))
      expect(await reports(paths.iconMap, text), text).toEqual([]);
  });

  it('leaves forms the matchers do not model to other rules', async () => {
    // require() is reported by the TypeScript rule against require imports, not by rule 4.
    expect(
      await reports(
        paths.feature,
        lines("const lucide = require('lucide-react') as object;", 'export const Glyph = lucide;'),
      ),
    ).toEqual([['@typescript-eslint/no-require-imports', 1]]);
    // A module name held in a variable is not read.
    expect(
      await reports(
        paths.feature,
        lines("const name = 'lucide-react';", 'export const load = () => import(name);'),
      ),
    ).toEqual([]);
  });
});

// One primitive per line from line 12, each with a className, inside one fragment.
const primitiveImports = [
  "import { Button } from '@/components/ui/button';",
  "import { Card } from '@/components/ui/card';",
  "import { Checkbox } from '@/components/ui/checkbox';",
  "import { DialogContent } from '@/components/ui/dialog';",
  "import { DropdownMenuContent } from '@/components/ui/dropdown-menu';",
  "import { Input } from '@/components/ui/input';",
  "import { NativeSelect } from '@/components/ui/native-select';",
  "import { Radio } from '@/components/ui/radio';",
  "import { SearchField } from '@/components/ui/search-field';",
];
const primitiveOverrides = lines(
  ...primitiveImports,
  'export const Overrides = () => (',
  '  <>',
  '    <Button className="mt-4" />',
  '    <Card className="min-w-0" />',
  '    <Checkbox className="size-5" />',
  '    <DialogContent className="max-w-xl" />',
  '    <DropdownMenuContent className="w-60" />',
  '    <Input className="h-9" />',
  '    <NativeSelect className="w-40" />',
  '    <Radio className="size-5" />',
  '    <SearchField className="w-60" />',
  '  </>',
  ');',
);

describe('rule 3: primitives own their appearance', { timeout: 30_000 }, () => {
  beforeAll(async () => {
    // Warm when rule 4 ran first in this worker; cold when this block runs alone.
    await reports(paths.feature, lines('export const warm = 1;'));
  }, 90_000);

  it('rejects a className on each primitive in features, routes and shared components', async () => {
    const expected = [12, 13, 14, 15, 16, 17, 18, 19, 20].map(
      (line) => ['no-restricted-syntax', line] as const,
    );
    for (const path of [paths.feature, paths.route, paths.component])
      expect(await reports(path, primitiveOverrides), path).toEqual(expected);
  });

  it('accepts variants, size props, layout wrappers and native elements', async () => {
    expect(
      await reports(
        paths.feature,
        lines(
          "import { Button } from '@/components/ui/button';",
          "import { DialogContent } from '@/components/ui/dialog';",
          'export const Composed = () => (',
          '  <div className="mt-4 w-48">',
          '    <Button variant="primary" size="lg" />',
          '    <DialogContent size="md" />',
          '    <button className="flex" type="button" />',
          '  </div>',
          ');',
        ),
      ),
    ).toEqual([]);
  });

  it('leaves the primitives themselves, the P4 shell, tests and stories alone', async () => {
    for (const path of [paths.primitive, paths.layout, paths.componentTest, paths.story])
      expect(await reports(path, primitiveOverrides), path).toEqual([]);
  });

  it('keeps the icon rule beside rule 3 inside its scope and alone outside it', async () => {
    const both = lines(
      "import { Button } from '@/components/ui/button';",
      "export const load = () => import('lucide-react');",
      'export const Override = () => <Button className="mt-4" />;',
    );
    expect(await reports(paths.feature, both)).toEqual([
      ['no-restricted-syntax', 2],
      ['no-restricted-syntax', 3],
    ]);
    for (const path of [paths.primitive, paths.layout])
      expect(await reports(path, both), path).toEqual([['no-restricted-syntax', 2]]);
  });

  it('does not read spread props, aliases or member names', async () => {
    expect(
      await reports(
        paths.feature,
        lines(
          "import { Button, Button as Alias } from '@/components/ui/button';",
          "import * as ui from '@/components/ui/button';",
          "const props = { className: 'mt-4' };",
          'export const Unmodelled = () => (',
          '  <>',
          '    <Button {...props} />',
          '    <Alias className="mt-4" />',
          '    <ui.Button className="mt-4" />',
          '  </>',
          ');',
        ),
      ),
    ).toEqual([]);
  });
});
