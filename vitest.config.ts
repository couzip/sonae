import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@data': resolve(__dirname, 'data'),
    },
  },
  test: {
    environment: 'node',
    globals: false,
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    exclude: ['node_modules', '.next', 'cache'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/lib/core/**/*.ts', 'src/lib/sonae/client/**/*.ts'],
      exclude: [
        'src/lib/**/*.test.ts',
        // Server adapters with external IO are exercised via integration tests
        // (not unit tests) and their cost-of-test outweighs the coverage win.
        'src/lib/sonae/discoverer.ts',
      ],
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 70,
        statements: 70,
      },
    },
  },
});
