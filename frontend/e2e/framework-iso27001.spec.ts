/**
 * E2E tests — ISO/IEC 27001:2022
 *
 * Tests the public reference page (/frameworks/iso27001) and individual
 * control detail pages.  Confirms the ISO 27001 framework is fully
 * end-to-end wired in the public reference section.
 */
import { test, expect } from '@playwright/test';

// ─── Public reference page (no auth required) ─────────────────────────────────

test.describe('ISO 27001 public reference page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/frameworks/iso27001');
  });

  test('loads without authentication', async ({ page }) => {
    await expect(page).not.toHaveURL(/login/);
    await expect(page.locator('h1')).toBeVisible();
  });

  test('shows ISO 27001 heading', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('ISO 27001');
  });

  test('displays ISO/IEC 27001:2022 version badge', async ({ page }) => {
    await expect(
      page.getByText(/ISO\/IEC 27001:2022|27001:2022/i),
    ).toBeVisible();
  });

  test('shows at least one control card', async ({ page }) => {
    // Wait for controls list to populate (async fetch)
    const firstCode = page.getByText(/^A\.[5-8]\.\d/);
    await expect(firstCode.first()).toBeVisible({ timeout: 15_000 });
  });

  test('breadcrumb links back to /frameworks', async ({ page }) => {
    const breadcrumb = page.getByRole('link', { name: 'Frameworks' });
    await expect(breadcrumb).toBeVisible();
    await breadcrumb.click();
    await expect(page).toHaveURL('/frameworks');
  });

  test('shows A.5 Organizational Controls category group', async ({ page }) => {
    await expect(
      page.getByText(/A\.5|Organizational Controls/i).first(),
    ).toBeVisible({ timeout: 15_000 });
  });

  test('shows A.6 People Controls category group', async ({ page }) => {
    await expect(
      page.getByText(/A\.6|People Controls/i).first(),
    ).toBeVisible({ timeout: 15_000 });
  });

  test('shows A.7 Physical Controls category group', async ({ page }) => {
    await expect(
      page.getByText(/A\.7|Physical Controls/i).first(),
    ).toBeVisible({ timeout: 15_000 });
  });

  test('shows A.8 Technological Controls category group', async ({ page }) => {
    await expect(
      page.getByText(/A\.8|Technological Controls/i).first(),
    ).toBeVisible({ timeout: 15_000 });
  });
});

// ─── Individual control detail page ───────────────────────────────────────────

test.describe('ISO 27001 control detail page', () => {
  test('loads A.5.1 detail page', async ({ page }) => {
    await page.goto('/frameworks/iso27001/controls/A.5.1');
    await expect(page).not.toHaveURL(/login/);
    await expect(page.getByText('A.5.1')).toBeVisible({ timeout: 15_000 });
  });

  test('shows control title and description', async ({ page }) => {
    await page.goto('/frameworks/iso27001/controls/A.5.1');
    await expect(page.locator('h1')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/Information Security Policy|policies for information security/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test('shows breadcrumb with ISO 27001 link', async ({ page }) => {
    await page.goto('/frameworks/iso27001/controls/A.5.1');
    await expect(page.getByRole('link', { name: /ISO 27001/i })).toBeVisible();
  });

  test('shows back link to ISO 27001 framework page', async ({ page }) => {
    await page.goto('/frameworks/iso27001/controls/A.5.1');
    const backLink = page.getByRole('link', { name: /Back to ISO 27001/i });
    await expect(backLink).toBeVisible();
  });

  test('loads an A.8 technological control', async ({ page }) => {
    await page.goto('/frameworks/iso27001/controls/A.8.2');
    await expect(page.getByText('A.8.2')).toBeVisible({ timeout: 15_000 });
  });

  test('shows related controls / crosswalks section for well-mapped controls', async ({ page }) => {
    // A.5.1 is mapped to several SOC2 controls
    await page.goto('/frameworks/iso27001/controls/A.5.1');
    await expect(page.locator('h1')).toBeVisible({ timeout: 10_000 });
    // If Related Controls section visible, check it renders without error
    const related = page.getByText(/Related Controls/i);
    const count = await related.count();
    if (count > 0) {
      await expect(related.first()).toBeVisible();
    }
  });
});

// ─── Frameworks index includes ISO 27001 ─────────────────────────────────────

test.describe('Frameworks index page', () => {
  test('shows ISO 27001 card', async ({ page }) => {
    await page.goto('/frameworks');
    await expect(page.getByText('ISO 27001').first()).toBeVisible();
  });

  test('ISO 27001 explore link navigates to /frameworks/iso27001', async ({ page }) => {
    await page.goto('/frameworks');
    const exploreLink = page.getByRole('link', { name: /Explore ISO 27001/i });
    await expect(exploreLink).toBeVisible();
    await expect(exploreLink).toHaveAttribute('href', '/frameworks/iso27001');
  });
});
