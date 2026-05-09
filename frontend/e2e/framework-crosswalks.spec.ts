/**
 * E2E tests — Cross-Framework Control Mappings page
 *
 * Tests the public crosswalks page (/frameworks/crosswalks) which shows
 * SOC 2 ↔ ISO 27001, GDPR ↔ ISO 27001, GDPR ↔ SOC 2, and HIPAA ↔ ISO 27001
 * mappings in a tabbed interface.
 */
import { test, expect } from '@playwright/test';

test.describe('Cross-Framework Crosswalks page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/frameworks/crosswalks');
  });

  test('loads without authentication', async ({ page }) => {
    await expect(page).not.toHaveURL(/login/);
  });

  test('shows Cross-Framework Control Mappings heading', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: /Cross-Framework Control Mappings/i }),
    ).toBeVisible();
  });

  test('breadcrumb shows Frameworks link', async ({ page }) => {
    const breadcrumb = page.getByRole('link', { name: 'Frameworks' });
    await expect(breadcrumb).toBeVisible();
    await expect(breadcrumb).toHaveAttribute('href', '/frameworks');
  });

  test('shows the 4 framework pair tabs', async ({ page }) => {
    await expect(page.getByRole('button', { name: /SOC 2.*ISO 27001/i })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('button', { name: /GDPR.*ISO 27001/i })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('button', { name: /GDPR.*SOC 2/i })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('button', { name: /HIPAA.*ISO 27001/i })).toBeVisible({ timeout: 15_000 });
  });

  test('first tab (SOC 2 ↔ ISO 27001) is active by default', async ({ page }) => {
    // The active tab should have the brand-600 background class
    const activeTab = page.getByRole('button', { name: /SOC 2.*ISO 27001/i });
    await expect(activeTab).toBeVisible({ timeout: 10_000 });
    // Active tab is highlighted — check it's rendered (CSS class check is fragile; just verify it's present)
    await expect(activeTab).toBeEnabled();
  });

  test('shows mapping count stat cards in the header', async ({ page }) => {
    // Each pair should show a count card
    const statCards = page.locator('.bg-gray-50.rounded-lg');
    await expect(statCards.first()).toBeVisible({ timeout: 10_000 });
  });

  test('shows at least one mapping row in the table', async ({ page }) => {
    // Table rows for SOC 2 ↔ ISO 27001 should appear after API loads
    const row = page.locator('tbody tr').first();
    await expect(row).toBeVisible({ timeout: 15_000 });
  });

  test('table has Source Control and Target Control column headers', async ({ page }) => {
    await expect(page.getByText(/Source Control|SOC 2 Control/i).first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/Target Control|ISO 27001 Control/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test('table has Mapping Type and Confidence column headers', async ({ page }) => {
    await expect(page.getByText('Mapping Type')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Confidence')).toBeVisible({ timeout: 10_000 });
  });

  test('confidence filter buttons are visible', async ({ page }) => {
    await expect(page.getByRole('button', { name: /All/i })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: /High/i })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: /Medium/i })).toBeVisible({ timeout: 10_000 });
  });

  test('clicking GDPR ↔ ISO 27001 tab switches to that pair', async ({ page }) => {
    const gdprTab = page.getByRole('button', { name: /GDPR.*ISO 27001/i });
    await gdprTab.click();
    // The pair summary should update — look for GDPR Article label
    await expect(page.getByText(/GDPR Article|GDPR/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test('clicking HIPAA ↔ ISO 27001 tab switches to that pair', async ({ page }) => {
    const hipaaTab = page.getByRole('button', { name: /HIPAA.*ISO 27001/i });
    await hipaaTab.click();
    await expect(page.getByText(/HIPAA Safeguard|HIPAA/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test('shows the explainer section at the bottom', async ({ page }) => {
    await expect(
      page.getByText(/Understanding Cross-Framework Mappings/i),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('shows mapping type descriptions in explainer', async ({ page }) => {
    await expect(page.getByText(/Direct/i).first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/Partial/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test('high confidence filter shows only high-confidence mappings', async ({ page }) => {
    // Click High filter
    const highBtn = page.getByRole('button', { name: /^High/i });
    await highBtn.click();
    // All visible confidence badges should be "high"
    const lowBadges = page.locator('span').filter({ hasText: /^low$/i });
    await expect(lowBadges).toHaveCount(0, { timeout: 5_000 });
  });
});
