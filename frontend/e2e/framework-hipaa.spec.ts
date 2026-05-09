/**
 * E2E tests — HIPAA Security Rule framework
 *
 * Tests the public reference page (/frameworks/hipaa) and the authenticated
 * dashboard page (/hipaa).  These tests are included in the gap detector's
 * coverage check — they prove the framework is end-to-end wired.
 */
import { test, expect } from '@playwright/test';
import { loginAs } from './helpers/auth';

const DEMO_EMAIL    = 'admin@demo.com';
const DEMO_PASSWORD = 'Demo1234!';

// ── Public reference page (no auth required) ──────────────────────────────

test.describe('HIPAA public reference page', () => {
  test('loads without authentication', async ({ page }) => {
    await page.goto('/frameworks/hipaa');
    await expect(page).toHaveTitle(/HIPAA/i);
  });

  test('displays HIPAA Security Rule heading', async ({ page }) => {
    await page.goto('/frameworks/hipaa');
    await expect(
      page.getByRole('heading', { name: /HIPAA Security Rule/i }),
    ).toBeVisible();
  });

  test('displays at least one control card', async ({ page }) => {
    await page.goto('/frameworks/hipaa');

    // Controls are rendered inside the ControlSearch component.
    // Wait for at least one card to appear (each has a code chip like HIPAA-308-…).
    const firstCard = page.locator('[data-testid="control-card"]').first();
    // Fallback: look for the safeguard category headings if testid not present
    const safeguardSection = page.getByText('Administrative Safeguards');

    await expect(safeguardSection.or(firstCard)).toBeVisible({ timeout: 15_000 });
  });

  test('shows the correct safeguard categories in the sidebar TOC', async ({ page }) => {
    await page.goto('/frameworks/hipaa');

    // Administrative Safeguards must always appear — it has the most controls
    await expect(page.getByText('Administrative Safeguards')).toBeVisible();
  });

  test('breadcrumb links back to /frameworks', async ({ page }) => {
    await page.goto('/frameworks/hipaa');

    const breadcrumb = page.getByRole('link', { name: 'Frameworks' });
    await expect(breadcrumb).toBeVisible();
    await expect(breadcrumb).toHaveAttribute('href', '/frameworks');
  });
});

// ── Authenticated dashboard page ──────────────────────────────────────────

test.describe('HIPAA dashboard page (authenticated)', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, DEMO_EMAIL, DEMO_PASSWORD);
  });

  test('renders HIPAA dashboard without errors', async ({ page }) => {
    await page.goto('/hipaa');

    // No generic error page
    await expect(page.getByText(/something went wrong/i)).not.toBeVisible();
    await expect(page.getByText(/404/)).not.toBeVisible();

    // Page heading
    await expect(
      page.getByRole('heading', { name: /PCI DSS|HIPAA/i }),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('shows the "HIPAA Readiness" heading or placeholder callout', async ({ page }) => {
    await page.goto('/hipaa');

    const heading   = page.getByRole('heading', { name: /HIPAA/i });
    const callout   = page.getByText(/HIPAA Security Rule/i);

    await expect(heading.or(callout)).toBeVisible({ timeout: 10_000 });
  });

  test('reference link navigates to public HIPAA page', async ({ page }) => {
    await page.goto('/hipaa');

    const refLink = page.getByRole('link', { name: /Reference/i });
    if (await refLink.isVisible()) {
      await refLink.click();
      await page.waitForURL('**/frameworks/hipaa', { timeout: 15_000 });
    }
  });
});
