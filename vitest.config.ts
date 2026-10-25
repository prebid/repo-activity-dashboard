import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
export default defineConfig({
  oxc: { jsx: { runtime: 'automatic' } },
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: {
    environment: 'jsdom',
    include: ['tests/unit/**/*.test.ts', 'tests/components/**/*.test.tsx'],
    setupFiles: ['./tests/setup.ts'],
    restoreMocks: true,
    reporters: ['default', 'json'],
    outputFile: { json: 'test-results/vitest.json' },
    coverage: {
      provider: 'v8',
      include: [
        'src/lib/presentation/**/*.ts',
        'src/components/tables/**/*.tsx',
        'src/components/metrics/**/*.tsx',
      ],
      reporter: ['text', 'json-summary', 'html'],
    },
  },
});
