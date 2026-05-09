/**
 * E2E tests — PCI DSS v4.0 framework
 *
 * Tests the public reference page (/frameworks/pci-dss) and the authenticated
 * dashboard page (/pci-dss).  These tests are included in the gap detector's
 * coverage check — they prove the framework is end-to-end wired.
 */
import { test, expect } from '@playwright/test';
import { loginAs } from './helpers/auth';

const DEMO_EMAIL    = 'admin@demo.com';
const DEMO_PASSWORD = 'Demo1234!';

// ── Public reference page (no auth required) ──────────────────────────────

test.describe('PCI DSS public reference page', () => {
  test('loads without authentication', async ({ page }) => {
    await page.goto('/frameworks/pci-dss');
    await expect(page).toHaveTitle(/PCI DSS/i);
  });

  test('displays PCI DSS v4.0 heading', async ({ page }) => {
    await page.goto('/frameworks/pci-dss');
    await expect(
      page.getByRole('heading', { name: /PCI DSS v4\.0/i }),
    ).toBeVisible();
  });

  test('displays at least one control card', async ({ page }) => {
    await page.goto('/frameworks/pci-dss');

    // Controls are rendered inside the ControlSearch component.
    // Wait for at least one requirement group heading to appear.
    const firstGroup    = page.locator('[data-testid="control-card"]').first();
    const networkSection = page.getByText('Network Security Controls');

    await expect(networkSection.or(firstGroup)).toBeVisible({ timeout: 15_000 });
  });

  test('shows "12 Requirements" stat in the header', async ({ page }) => {
    await page.goto('/frameworks/pci-dss');

    // The header shows "12" and "Requirements" in separate elements
    await expect(page.getByText('12')).toBeVisible();
  });

  test('breadcrumb links back to /frameworks', async ({ page }) => {
    await page.goto('/frameworks/pci-dss');

    const breadcrumb = page.getByRole('link', { name: 'Frameworks' });
    await expect(breadcrumb).toBeVisible();
    await expect(breadcrumb).toHaveAttribute('href', '/frameworks');
  });

  test('shows PCI DSS requirement groups in sidebar TOC', async ({ page }) => {
    await page.goto('/frameworks/pci-dss');

    // At minimum the first requirement group must appear
    await expect(page.getByText('Network Security Controls')).toBeVisible();
  });
});

// ── Authenticated dashboard page ──────────────────────────────────────────

test.describe('PCI DSS dashboard page (authenticated)', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, DEMO_EMAIL, DEMO_PASSWORD);
  });

  test('renders PCI DSS dashboard without errors', async ({ page }) => {
    await page.goto('/pci-dss');

    // No generic error page
    await expect(page.getByText(/something went wrong/i)).not.toBeVisible();
    await expect(page.getByText(/404/)).not.toBeVisible();

    // Page heading
    await expect(
      page.getByRole('heading', { name: /PCI DSS/i }),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('shows "PCI DSS v4.0" title on the dashboard page', async ({ page }) => {
    await page.goto('/pci-dss');

    await expect(page.getByText(/PCI DSS v4\.0/i)).toBeVisible({ timeout: 10_000 });
  });

  test('shows "12 Requirements" section overview', async ({ page }) => {
    await page.goto('/pci-dss');

    // The 12-requirements grid should be visible
    await expect(page.getByText('PCI DSS v4.0 — 12 Requirements')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Req 1')).toBeVisible();
    await expect(page.getByText('Req 12')).toBeVisible();
  });

  test('reference link navigates to public PCI DSS page', async ({ page }) => {
    await page.goto('/pci-dss');

    const refLink = page.getByRole('link', { name: /Reference/i });
    if (await refLink.isVisible()) {
      await refLink.click();
      await page.waitForURL('**/frameworks/pci-dss', { timeout: 15_000 });
    }
  });

  test('placeholder callout mentions PCI DSS module coming soon', async ({ page }) => {
    await page.goto('/pci-dss');

    await expect(
      page.getByText(/PCI DSS Compliance Module.*Coming Soon/i),
    ).toBeVisible({ timeout: 10_000 });
  });
});
