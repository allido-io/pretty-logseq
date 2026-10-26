import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    // Let tests read SCSS sources via `?raw` (Vitest blanks stylesheets by default).
    css: { include: [/\.scss\?raw$/] },
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.d.ts', 'src/types/**'],
      thresholds: {
        lines: 95,
        functions: 90,
        branches: 85,
        statements: 90,
      },
    },
    include: ['src/**/*.{test,spec}.ts', 'test/**/*.{test,spec}.ts'],
    exclude: ['node_modules', 'dist'],
  },
  resolve: {
    alias: {
      '@': '/src',
    },
  },
});
