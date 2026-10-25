import { defineConfig } from 'vitest/config';
import base from './vitest.config.ts';
const config = defineConfig({
  ...base,
  test: {
    ...base.test,
    environment: 'node',
    include: ['tests/integration/**/*.test.ts'],
    globalSetup: ['./tests/integration/global-setup.ts'],
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 30000,
    outputFile: { json: 'test-results/accounts.json' },
    coverage: {
      provider: 'v8',
      enabled: true,
      include: [
        'src/lib/auth/users.ts',
        'src/lib/auth/whitelist.ts',
        'src/lib/auth/session-policy.ts',
        'scripts/auth-operator.ts',
      ],
      reportsDirectory: 'coverage/accounts',
      reporter: ['text', 'json-summary'],
      thresholds: {
        perFile: true,
        'src/lib/auth/users.ts': { lines: 85, branches: 70, functions: 100 },
      },
    },
  },
});
export default config;
declare module 'vitest' {
  export interface ProvidedContext {
    accountEndpoint: string;
  }
}
