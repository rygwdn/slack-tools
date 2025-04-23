import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    typecheck: {
      enabled: true,
      tsconfig: './tsconfig.test.json',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      exclude: ['**/node_modules/**', '**/dist/**', '**/test/**'],
    },
    include: ['**/*.test.ts'],
    exclude: ['node_modules', 'dist'],
    setupFiles: ['./test/setup.ts'],
  },
});
