import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    includeSource: ['src/**/*.{js,ts}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        '*.config.*',
        '**/*.d.ts',
        '**/*.test.ts',
        '**/*.spec.ts',
        '**/types/**'
      ],
      lines: 80,
      functions: 80,
      branches: 80,
      statements: 80
    },
    testTimeout: 30000,
    hookTimeout: 30000,
    teardownTimeout: 10000,
    isolate: true,
    mockReset: true,
    restoreMocks: true,
    clearMocks: true,
    setupFiles: ['./tests/setup.ts'],
    reporters: ['verbose'],
    watch: false,
    alias: {
      '@': resolve(__dirname, './src'),
      '@types': resolve(__dirname, './src/types'),
      '@services': resolve(__dirname, './src/services'),
      '@utils': resolve(__dirname, './src/utils')
    }
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@types': resolve(__dirname, './src/types'),
      '@services': resolve(__dirname, './src/services'),
      '@utils': resolve(__dirname, './src/utils')
    }
  },
  esbuild: {
    target: 'node18'
  }
});