import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
export default defineConfig({
  oxc: { jsx: { runtime: 'automatic' } },
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: {
    allowOnly: false,
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
        'src/components/ui/password-input.tsx': {
          perFile: true,
          lines: 100,
          statements: 100,
          functions: 100,
          branches: 100,
        },
        'src/components/layout/theme-menu.tsx': {
          perFile: true,
          lines: 100,
          statements: 100,
          functions: 100,
          branches: 100,
        },
        'src/features/authentication/{login-view,change-password-view}.tsx': {
          perFile: true,
          lines: 100,
          statements: 100,
          functions: 100,
          branches: 100,
        },
        'src/models/password-policy.ts': {
          perFile: true,
          lines: 100,
          statements: 100,
          functions: 100,
          branches: 100,
        },
        'src/lib/presentation/**': {
          perFile: true,
          lines: 90,
          branches: 90,
          statements: 80,
          functions: 100,
        },
        'src/lib/navigation/**': {
          perFile: true,
          lines: 95,
          branches: 85,
          statements: 95,
          functions: 100,
        },
        'src/models/temporary-credentials.ts': {
          perFile: true,
          lines: 100,
          branches: 100,
          statements: 100,
          functions: 100,
        },
        'src/lib/auth/{viewer,base-config,session-transport,http-auth,account-reader,bounded-request,session-policy,secret-policy,runtime-settings}.ts':
          { perFile: true, lines: 90, branches: 80, statements: 90, functions: 100 },
        'src/components/tables/**': {
          perFile: true,
          lines: 95,
          branches: 90,
          statements: 95,
          functions: 90,
        },
        'src/lib/auth/{access-policy,api-access,account-response,diagnostics,credential-policy,request-body,get-secret,auth}.ts':
          { perFile: true, lines: 100, branches: 100, statements: 100, functions: 100 },
        'src/app/api/admin/users/**': {
          perFile: true,
          lines: 100,
          branches: 100,
          statements: 100,
          functions: 100,
        },
        'src/app/api/auth/change-password/route.ts': {
          perFile: true,
          lines: 100,
          branches: 90,
          statements: 90,
          functions: 100,
        },
      },
    },
  },
});
