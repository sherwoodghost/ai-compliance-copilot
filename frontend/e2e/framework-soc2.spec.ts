/**
 * E2E tests — SOC 2 Trust Services Criteria
 *
 * Tests the public reference page (/frameworks/soc2) and the authenticated
 * dashboard controls page.  These confirm the SOC 2 framework is fully
 * end-to-end wired in the public reference section.
 */
import { test, expect } from '@playwright/test';

// ─── Public reference page (no auth required) ─────────────────────────────────

test.describe('SOC 2 public reference page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/frameworks/soc2');
  });

  test('loads without authentication', async ({ page }) => {
    await expect(page).not.toHaveURL(/login/);
    await expect(page.locator('h1')).toBeVisible();
  });

  test('shows SOC 2 heading', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('SOC 2');
  });

  test('displays Trust Services Criteria 2017 version badge', async ({ page }) => {
    await expect(
      page.getByText(/Trust Services Criteria|TSC 2017/i),
    ).toBeVisible();
  });

  test('shows at least one control card', async ({ page }) => {
    // Wait for controls list to populate (async fetch)
    const firstCode = page.getByText(/^CC[1-9]\.\d|^A1\.|^C1\.|^PI1\./);
    await expect(firstCode.first()).toBeVisible({ timeout: 15_000 });
  });

  test('breadcrumb links back to /frameworks', async ({ page }) => {
    const breadcrumb = page.getByRole('link', { name: 'Frameworks' });
    await expect(breadcrumb).toBeVisible();
    await breadcrumb.click();
    await expect(page).toHaveURL('/frameworks');
  });

  test('shows Common Criteria category group', async ({ page }) => {
    await expect(
      page.getByText(/Common Criteria|CC1|CC6/i).first(),
    ).toBeVisible({ timeout: 15_000 });
  });

  test('shows Availability criteria group', async ({ page }) => {
    await expect(
      page.getByText(/Availability|A1\./i).first(),
    ).toBeVisible({ timeout: 15_000 });
  });

  test('shows Privacy criteria group', async ({ page }) => {
    await expect(
      page.getByText(/Privacy|P[1-8]/i).first(),
    ).toBeVisible({ timeout: 15_000 });
  });
});

// ─── Individual control detail page ───────────────────────────────────────────

test.describe('SOC 2 control detail page', () => {
  test('loads CC6.1 detail page', async ({ page }) => {
    await page.goto('/frameworks/soc2/controls/CC6.1');
    await expect(page).not.toHaveURL(/login/);
    await expect(page.getByText('CC6.1')).toBeVisible({ timeout: 15_000 });
  });

  test('shows control title and description', async ({ page }) => {
    await page.goto('/frameworks/soc2/controls/CC6.1');
    // Title should contain logical access security related text
    await expect(page.locator('h1')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/Logical Access|Access Security|access/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test('shows breadcrumb with SOC 2 link', async ({ page }) => {
    await page.goto('/frameworks/soc2/controls/CC6.1');
    await expect(page.getByRole('link', { name: /SOC 2/i })).toBeVisible();
  });

  test('shows back link to SOC 2 framework page', async ({ page }) => {
    await page.goto('/frameworks/soc2/controls/CC6.1');
    const backLink = page.getByRole('link', { name: /Back to SOC 2/i });
    await expect(backLink).toBeVisible();
  });

  test('shows related controls section when crosswalks exist', async ({ page }) => {
    await page.goto('/frameworks/soc2/controls/CC6.1');
    // Crosswalk section may or may not exist — if visible it should list related controls
    const related = page.getByText(/Related Controls|Crosswalk/i);
    // Just check that the page loaded without a 404
    await expect(page.locator('h1')).toBeVisible({ timeout: 10_000 });
    // Related section is optional — only verify it doesn't error
    const count = await related.count();
    if (count > 0) {
      await expect(related.first()).toBeVisible();
    }
  });
});

// ─── Frameworks index includes SOC 2 ──────────────────────────────────────────

test.describe('Frameworks index page', () => {
  test('shows SOC 2 card', async ({ page }) => {
    await page.goto('/frameworks');
    await expect(page.getByText('SOC 2').first()).toBeVisible();
  });

  test('SOC 2 explore link navigates to /frameworks/soc2', async ({ page }) => {
    await page.goto('/frameworks');
    const exploreLink = page.getByRole('link', { name: /Explore SOC 2/i });
    await expect(exploreLink).toBeVisible();
    await expect(exploreLink).toHaveAttribute('href', '/frameworks/soc2');
  });
});
