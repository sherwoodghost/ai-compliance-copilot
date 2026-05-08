import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  // 60 s per test — Railway cold-starts and API round-trips can be slow.
  timeout: 60_000,
  retries: 1,
  workers: 1, // sequential — avoids JWT token race conditions
  reporter: 'list',

  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:3000',
    // Collect trace on first retry for easier debugging
    trace: 'on-first-retry',
    // Record video on first retry
    video: 'on-first-retry',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
