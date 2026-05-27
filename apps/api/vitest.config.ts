import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/integration/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/domains/**', 'src/infrastructure/sap/**'],
      thresholds: { lines: 85, branches: 85 },
    },
  },
  resolve: {
    alias: {
      '@sap-triage/shared': path.resolve(__dirname, '../../packages/shared/src/index.ts'),
    },
  },
});
