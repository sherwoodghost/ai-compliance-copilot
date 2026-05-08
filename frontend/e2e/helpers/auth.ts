import { Page } from '@playwright/test';

/**
 * Navigate to /login, fill credentials, submit, and wait for the post-login redirect.
 *
 * After a successful login the app redirects to /onboarding (when onboardingComplete=false)
 * or /overview.  This helper only waits for that redirect — callers are responsible for
 * navigating to whichever page their test actually needs.
 */
export async function loginAs(
  page: Page,
  email: string,
  password: string,
): Promise<void> {
  await page.goto('/login');

  // htmlFor/id associations are required for getByLabel to work (added in login/page.tsx).
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);

  await page.getByRole('button', { name: 'Sign in' }).click();

  // After login the app routes to /onboarding (first run) or /overview.
  await page.waitForURL(/\/(overview|onboarding)/, { timeout: 15_000 });

  // Wait for the landing page to finish loading so callers can immediately
  // navigate away without leaving a pending request in-flight.
  await page.waitForLoadState('load');
}
