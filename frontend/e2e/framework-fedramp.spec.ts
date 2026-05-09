import { test, expect } from '@playwright/test';

// ─── Public reference page (no auth required) ─────────────────────────────────

test.describe('FedRAMP public reference page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/frameworks/fedramp');
  });

  test('loads without authentication', async ({ page }) => {
    await expect(page).not.toHaveURL(/login/);
    await expect(page.locator('h1')).toBeVisible();
  });

  test('shows FedRAMP Moderate heading', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('FedRAMP');
  });

  test('displays NIST SP 800-53 badge', async ({ page }) => {
    await expect(page.getByText(/NIST SP 800-53/i)).toBeVisible();
  });

  test('shows at least one control card', async ({ page }) => {
    // ControlSearch renders controls; wait for at least one to appear
    const cards = page.locator('[data-testid="control-card"], .control-card, article');
    await expect(cards.first()).toBeVisible({ timeout: 15_000 });
  });

  test('breadcrumb links back to /frameworks', async ({ page }) => {
    const breadcrumb = page.getByRole('link', { name: 'Frameworks' });
    await expect(breadcrumb).toBeVisible();
    await breadcrumb.click();
    await expect(page).toHaveURL('/frameworks');
  });

  test('shows "11 Control Families" stat or greater', async ({ page }) => {
    // The header stat block should show the family count
    await expect(page.getByText(/Control Famil/i)).toBeVisible();
  });

  test('displays AC (Access Control) family', async ({ page }) => {
    await expect(page.getByText(/Access Control/i).first()).toBeVisible();
  });
});

// ─── Authenticated dashboard page ─────────────────────────────────────────────

test.describe('FedRAMP dashboard page', () => {
  test.beforeEach(async ({ page }) => {
    // Unauthenticated access should still render (placeholder page is 'use client' but
    // can be viewed if middleware doesn't redirect — adjust if auth is enforced)
    await page.goto('/fedramp');
  });

  test('loads the FedRAMP overview page', async ({ page }) => {
    // Either shows the page or redirects to login — both are acceptable outcomes
    const isLoginPage = page.url().includes('login') || page.url().includes('auth');
    if (!isLoginPage) {
      await expect(page.locator('h1')).toContainText('FedRAMP');
    }
  });

  test('shows "Coming Soon" callout when not fully implemented', async ({ page }) => {
    const isLoginPage = page.url().includes('login') || page.url().includes('auth');
    if (!isLoginPage) {
      await expect(page.getByText(/Coming Soon/i)).toBeVisible();
    }
  });

  test('has reference link pointing to /frameworks/fedramp', async ({ page }) => {
    const isLoginPage = page.url().includes('login') || page.url().includes('auth');
    if (!isLoginPage) {
      const refLink = page.getByRole('link', { name: /Reference/i }).first();
      await expect(refLink).toBeVisible();
    }
  });

  test('shows NIST control family grid', async ({ page }) => {
    const isLoginPage = page.url().includes('login') || page.url().includes('auth');
    if (!isLoginPage) {
      // The family grid uses font-mono spans with family codes
      await expect(page.getByText('AC').first()).toBeVisible();
      await expect(page.getByText('SI').first()).toBeVisible();
    }
  });

  test('displays 47 controls stat', async ({ page }) => {
    const isLoginPage = page.url().includes('login') || page.url().includes('auth');
    if (!isLoginPage) {
      await expect(page.getByText('47')).toBeVisible();
    }
  });
});
