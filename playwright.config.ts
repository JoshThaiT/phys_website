import { defineConfig } from '@playwright/test';

/** One critical path only. Broad E2E suites go flaky and stop being trusted. */
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  retries: process.env['CI'] ? 2 : 0,
  use: { baseURL: process.env['PREVIEW_URL'] ?? 'http://localhost:5173', trace: 'on-first-retry' },
});
