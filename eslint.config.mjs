import { FlatCompat } from '@eslint/eslintrc';
import tseslint from 'typescript-eslint';
const compat = new FlatCompat({ baseDirectory: import.meta.dirname });
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
    files: ['src/components/**/*.{ts,tsx}', 'src/features/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '@/server/**',
                '@/lib/auth/**',
                '@/lib/aws/**',
                '@/services/**',
                '@/mocks/**',
              ],
              message: 'Pass typed presentation data from the route boundary.',
            },
          ],
        },
      ],
    },
  },
];

export default config;
