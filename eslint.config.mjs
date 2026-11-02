import { FlatCompat } from '@eslint/eslintrc';
import tseslint from 'typescript-eslint';
const compat = new FlatCompat({ baseDirectory: import.meta.dirname });

const sourceExtensions = '{ts,tsx,mts,cts,js,jsx,mjs,cjs}';
const sourceFiles = [`**/*.${sourceExtensions}`];
const iconMap = 'src/components/ui/icons.ts';
const iconMessage = 'Import icons from @/components/ui/icons, which sets their size and stroke.';
const lucide = String.raw`/^lucide-react(\/|$)/`;
// Rule 3: feature, route and shared component code composes primitives without restyling them.
// The primitives themselves (ui/) are outside it.
const primitives = [
  'Button',
  'Input',
  'SearchField',
  'NativeSelect',
  'Checkbox',
  'Radio',
  'DropdownMenuContent',
  'DialogContent',
  'Card',
];
const primitiveMessage =
  'Primitives own their appearance: use a variant or size prop, or put layout on a wrapper element.';
const primitiveScope = ['src/features', 'src/app', 'src/components'].map(
  (directory) => `${directory}/**/*.${sourceExtensions}`,
);
// Rule 4: a page's h1 is PageHeader's title. These files render their own: the authentication
// views and routes, the edge pages (through EdgeFrame), the administrator Users page, which is
// outside the redesign, and the component foundation page, which has no reporting snapshot for
// PageHeader's "Data as of" chip.
const headingScope = [`src/**/*.${sourceExtensions}`];
const headingOwners = [
  'src/components/navigation/page-header.tsx',
  'src/components/layout/edge-frame.tsx',
  `src/features/authentication/**/*.${sourceExtensions}`,
  `src/app/auth/**/*.${sourceExtensions}`,
  'src/features/administration/users-view.tsx',
  'src/app/(dashboard)/foundation/page.tsx',
];
const headingMessage =
  'Render the page title through PageHeader, which owns the h1 on dashboard pages.';
// Rule 6: links and history writes go through the URL codec and its hook. The codec's own modules
// (with the frozen legacy readers) and the hook module are the owners. The selectors read direct
// forms only: an aliased router, a destructured push or a `url.search = ...` assignment is not read
// (`TableQuery.search` is assigned the same way).
const urlMessage =
  'Build links and history entries with the URL codec (src/lib/presentation/url) and useUrlState.';
const urlCodecOwners = ['src/lib/presentation/url/**', 'src/lib/navigation/use-url-state.ts'];
// Named exceptions: authentication navigation stays as it is while authentication code is frozen
// (decision 18); they are removed once that code can change.
const urlCodecExceptions = {
  views: ['src/components/layout/toolbar.tsx'],
  authViews: [
    'src/features/authentication/login-view.tsx',
    'src/features/authentication/change-password-view.tsx',
  ],
};
const urlExempt = [...urlCodecOwners, ...urlCodecExceptions.views, ...urlCodecExceptions.authViews];
// Selectors for no-restricted-syntax, by architecture rule. A config object that sets a rule
// replaces the options of earlier objects for the same file, so each file scope below lists every
// selector that applies to it.
const restrictedSyntax = {
  // Rule 4: icons come from the icon map; no-restricted-imports does not see import() or a
  // `typeof import()` type query.
  iconImports: [
    { selector: `ImportExpression[source.value=${lucide}]`, message: iconMessage },
    {
      selector: `ImportExpression > TemplateLiteral.source[quasis.0.value.cooked=${lucide}]`,
      message: iconMessage,
    },
    { selector: `TSImportType[source.value=${lucide}]`, message: iconMessage },
  ],
  // Rule 3: a className on a primitive, named directly. A spread or an alias is not read.
  primitiveClassNames: [
    {
      selector: `JSXOpeningElement[name.name=/^(${primitives.join('|')})$/] > JSXAttribute[name.name="className"]`,
      message: primitiveMessage,
    },
  ],
  // Rule 4: an h1 element, named directly. createElement('h1') and a computed tag are not read.
  headings: [{ selector: 'JSXOpeningElement[name.name="h1"]', message: headingMessage }],
  // Rule 6: URLSearchParams construction, history writes, router push/replace and C8's
  // searchParams mutation, each named directly.
  urlCodec: [
    { selector: "NewExpression[callee.name='URLSearchParams']", message: urlMessage },
    {
      selector:
        "CallExpression[callee.type='MemberExpression'][callee.property.name=/^(pushState|replaceState)$/]",
      message: urlMessage,
    },
    {
      selector:
        "CallExpression[callee.object.name='router'][callee.property.name=/^(push|replace)$/]",
      message: urlMessage,
    },
    {
      selector:
        "CallExpression[callee.object.callee.name='useRouter'][callee.property.name=/^(push|replace)$/]",
      message: urlMessage,
    },
    {
      selector:
        "CallExpression[callee.object.property.name='searchParams'][callee.property.name=/^(append|delete|set|sort)$/]",
      message: urlMessage,
    },
  ],
};
// Later scopes override earlier ones for the files they match, from the widest to the narrowest.
const restrictedSyntaxScopes = [
  { files: sourceFiles, ignores: [iconMap], selectors: restrictedSyntax.iconImports },
  {
    files: headingScope,
    ignores: [iconMap, ...headingOwners, ...urlExempt],
    selectors: [
      ...restrictedSyntax.iconImports,
      ...restrictedSyntax.headings,
      ...restrictedSyntax.urlCodec,
    ],
  },
  {
    files: primitiveScope,
    ignores: ['src/components/ui/**', ...headingOwners, ...urlExempt],
    selectors: [
      ...restrictedSyntax.iconImports,
      ...restrictedSyntax.primitiveClassNames,
      ...restrictedSyntax.headings,
      ...restrictedSyntax.urlCodec,
    ],
  },
  {
    files: headingOwners,
    ignores: urlExempt,
    selectors: [
      ...restrictedSyntax.iconImports,
      ...restrictedSyntax.primitiveClassNames,
      ...restrictedSyntax.urlCodec,
    ],
  },
  // The rule-6 exempt files keep every other selector of their scope.
  {
    files: urlCodecOwners,
    ignores: [iconMap],
    selectors: [...restrictedSyntax.iconImports, ...restrictedSyntax.headings],
  },
  {
    files: urlCodecExceptions.views,
    ignores: [],
    selectors: [
      ...restrictedSyntax.iconImports,
      ...restrictedSyntax.primitiveClassNames,
      ...restrictedSyntax.headings,
    ],
  },
  {
    files: urlCodecExceptions.authViews,
    ignores: [],
    selectors: [...restrictedSyntax.iconImports, ...restrictedSyntax.primitiveClassNames],
  },
];

const config = [
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'storybook-static/**',
      'coverage/**',
      'test-results/**',
      'playwright-report/**',
      'next-env.d.ts',
    ],
  },
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  ...tseslint.configs.recommendedTypeChecked.map((config) => ({
    ...config,
    files: [
      'src/**/*.{ts,tsx}',
      'tests/**/*.{ts,tsx}',
      '.storybook/**/*.{ts,tsx}',
      'scripts/**/*.mjs',
      'scripts/**/*.ts',
      '*.ts',
      '*.mjs',
      '*.cjs',
    ],
  })),
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
  },
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    files: sourceFiles,
    ignores: [iconMap],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [{ name: 'lucide-react', message: iconMessage }],
          patterns: [{ group: ['lucide-react/*'], message: iconMessage }],
        },
      ],
    },
  },
  ...restrictedSyntaxScopes.map(({ files, ignores, selectors }) => ({
    files,
    ignores,
    rules: { 'no-restricted-syntax': ['error', ...selectors] },
  })),
];

export default config;
