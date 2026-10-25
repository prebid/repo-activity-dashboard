import { defineConfig } from 'vitest/config';
import accounts from './vitest.accounts.config.ts';
export default defineConfig({
  ...accounts,
  test: {
    ...accounts.test,
    include: ['tests/production/**/*.test.ts'],
    testTimeout: 60000,
    hookTimeout: 60000,
    outputFile: { json: 'test-results/production.json' },
    coverage: { enabled: false },
  },
});
