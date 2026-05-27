import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/unit/**/*.test.ts'],
    env: {
      NODE_ENV: 'test',
      API_KEY: 'test-api-key-that-is-at-least-32-chars-long',
      ANTHROPIC_API_KEY: 'sk-ant-test-placeholder-for-vitest-do-not-use',
      N8N_WEBHOOK_SECRET: 'test-webhook-secret-16chars',
      SAP_MODE: 'sandbox',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/domains/**', 'src/infrastructure/sap/**', 'src/infrastructure/http/middleware/**'],
      thresholds: { lines: 85, branches: 85 },
    },
  },
  resolve: {
    alias: {
      '@sap-triage/shared': path.resolve(__dirname, '../../packages/shared/src/index.ts'),
    },
  },
});
