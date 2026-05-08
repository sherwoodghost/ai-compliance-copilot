import { test, expect } from '@playwright/test';
import { loginAs } from './helpers/auth';

const DEMO_EMAIL = 'admin@demo.com';
const DEMO_PASSWORD = 'Demo1234!';

// ─── Valid login ──────────────────────────────────────────────────────────────

test('login with valid credentials redirects to /overview or /onboarding', async ({ page }) => {
  await loginAs(page, DEMO_EMAIL, DEMO_PASSWORD);

  // URL must be one of the two post-login destinations.
  expect(page.url()).toMatch(/\/(overview|onboarding)/);
});

// ─── Invalid login ────────────────────────────────────────────────────────────

test('login with wrong password shows error message', async ({ page }) => {
  await page.goto('/login');

  await page.getByLabel('Email').fill(DEMO_EMAIL);
  await page.getByLabel('Password').fill('WrongPassword999!');
  await page.getByRole('button', { name: 'Sign in' }).click();

  // The error <div> appears inside the form; it contains the message from the
  // API or the fallback "Login failed" string from the catch block.
  // We wait for it so the test doesn't race the async submit handler.
  const errorDiv = page.locator('form').locator('div.rounded-lg.bg-danger-50');
  await expect(errorDiv).toBeVisible({ timeout: 10_000 });

  // Still on the login page.
  await expect(page).toHaveURL(/\/login/);
});

// ─── Already-authenticated redirect ──────────────────────────────────────────

test('already-logged-in user visiting /login is redirected away', async ({ page }) => {
  // First, establish a real session.
  await loginAs(page, DEMO_EMAIL, DEMO_PASSWORD);

  // Navigate back to /login — Next.js middleware (or client-side guard) should
  // redirect an authenticated user away from the login page.
  await page.goto('/login');

  // Allow a moment for the redirect to settle, then assert we are NOT on /login.
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 8_000 });
  expect(page.url()).not.toMatch(/\/login/);
});
