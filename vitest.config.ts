import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
export default defineConfig({
  oxc: { jsx: { runtime: 'automatic' } },
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: {
    environment: 'jsdom',
    server: { deps: { inline: ['next-auth'] } },
    include: ['tests/unit/**/*.test.ts', 'tests/components/**/*.test.tsx'],
    setupFiles: ['./tests/setup.ts'],
    restoreMocks: true,
    unstubGlobals: true,
    reporters: ['default', 'json'],
    outputFile: { json: 'test-results/vitest.json' },
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.d.ts'],
      reporter: ['text', 'json-summary', 'html'],
      thresholds: {
        perFile: true,
        'src/lib/presentation/**': { lines: 90, branches: 90, statements: 80, functions: 100 },
        'src/components/tables/**': { lines: 95, branches: 90, statements: 95, functions: 90 },
        'src/lib/auth/{access-policy,api-access,credential-policy,request-body,get-secret,auth}.ts':
          { lines: 100, branches: 100, statements: 100, functions: 100 },
        'src/app/api/admin/users/**': {
          lines: 100,
          branches: 100,
          statements: 100,
          functions: 100,
        },
        'src/app/api/auth/change-password/route.ts': {
          lines: 100,
          branches: 90,
          statements: 90,
          functions: 100,
        },
      },
    },
  },
});
