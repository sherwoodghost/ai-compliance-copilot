import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for the AI Compliance Copilot frontend.
 *
 * Test files:  frontend/e2e/*.spec.ts
 * Base URL:    http://localhost:3000  (Next.js dev server)
 * API:         http://localhost:3001  (NestJS backend)
 *
 * Run locally:
 *   cd frontend && npx playwright test
 *   cd frontend && npx playwright test --ui          (interactive mode)
 *   cd frontend && npx playwright show-report        (view last report)
 *
 * Used by the Autonomous Agent Loop (/test-platform command) and GitHub
 * Actions (.github/workflows/autonomous-agent.yml).
 */
export default defineConfig({
  testDir: './e2e',

  /* Run each test file sequentially — prevents JWT token race conditions */
  fullyParallel: false,
  workers: 1,

  /* Fail the build on CI if any test.only is left in source */
  forbidOnly: !!process.env.CI,

  /* Retry once on CI, never locally */
  retries: process.env.CI ? 1 : 0,

  /* Reporter: GitHub annotations on CI, list + HTML locally */
  reporter: process.env.CI
    ? [['github'], ['html', { outputFolder: 'playwright-report', open: 'never' }]]
    : [['list'], ['html', { outputFolder: 'playwright-report', open: 'on-failure' }]],

  /* 60 s per test — Railway cold-starts and API round-trips can be slow */
  timeout: 60_000,

  /* Output folder for test artifacts (traces, videos, screenshots) */
  outputDir: 'playwright-results',

  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? process.env.BASE_URL ?? 'http://localhost:3000',

    /* Collect trace on first retry for easier debugging */
    trace: 'on-first-retry',

    /* Record video on first retry */
    video: 'on-first-retry',

    /* Screenshot on failure */
    screenshot: 'only-on-failure',

    /* Reasonable per-action timeout */
    actionTimeout: 10_000,

    /* Page navigation timeout */
    navigationTimeout: 30_000,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  /*
   * Auto-start the dev server when running locally.
   * Set SKIP_WEBSERVER=1 if the server is already running.
   */
  webServer: process.env.SKIP_WEBSERVER
    ? undefined
    : {
        command: 'npm run dev',
        url: 'http://localhost:3000',
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        stdout: 'pipe',
        stderr: 'pipe',
      },
});
