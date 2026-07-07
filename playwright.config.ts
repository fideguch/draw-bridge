import { defineConfig, devices } from '@playwright/test';

/**
 * E2E config (specs land in Phase 11 — T092/T093).
 * Portrait mobile viewport matches the 390x844 design basis.
 */
export default defineConfig({
  testDir: './tests/e2e',
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
  },
  use: {
    baseURL: 'http://localhost:5173',
    ...devices['iPhone 14'],
  },
});
