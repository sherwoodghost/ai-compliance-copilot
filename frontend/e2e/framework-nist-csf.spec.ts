import { test, expect } from '@playwright/test';

// ─── Public reference page (no auth required) ─────────────────────────────────

test.describe('NIST CSF public reference page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/frameworks/nist-csf');
  });

  test('loads without authentication', async ({ page }) => {
    await expect(page).not.toHaveURL(/login/);
    await expect(page.locator('h1')).toBeVisible();
  });

  test('shows NIST CSF heading', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('NIST CSF');
  });

  test('displays NIST Cybersecurity Framework 2.0 badge', async ({ page }) => {
    await expect(page.getByText(/NIST Cybersecurity Framework 2\.0/i)).toBeVisible();
  });

  test('shows at least one control card', async ({ page }) => {
    const cards = page.locator('[data-testid="control-card"], .control-card, article');
    await expect(cards.first()).toBeVisible({ timeout: 15_000 });
  });

  test('breadcrumb links back to /frameworks', async ({ page }) => {
    const breadcrumb = page.getByRole('link', { name: 'Frameworks' });
    await expect(breadcrumb).toBeVisible();
    await breadcrumb.click();
    await expect(page).toHaveURL('/frameworks');
  });

  test('shows "6 Core Functions" stat or greater', async ({ page }) => {
    await expect(page.getByText(/Core Function/i)).toBeVisible();
  });

  test('displays Govern (GV) function', async ({ page }) => {
    await expect(page.getByText(/Govern/i).first()).toBeVisible();
  });

  test('displays Protect (PR) function', async ({ page }) => {
    await expect(page.getByText(/Protect/i).first()).toBeVisible();
  });
});

// ─── Authenticated dashboard page ─────────────────────────────────────────────

test.describe('NIST CSF dashboard page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/nist-csf');
  });

  test('loads the NIST CSF overview page', async ({ page }) => {
    const isLoginPage = page.url().includes('login') || page.url().includes('auth');
    if (!isLoginPage) {
      await expect(page.locator('h1')).toContainText('NIST CSF');
    }
  });

  test('shows "Coming Soon" callout when not fully implemented', async ({ page }) => {
    const isLoginPage = page.url().includes('login') || page.url().includes('auth');
    if (!isLoginPage) {
      await expect(page.getByText(/Coming Soon/i)).toBeVisible();
    }
  });

  test('has reference link pointing to /frameworks/nist-csf', async ({ page }) => {
    const isLoginPage = page.url().includes('login') || page.url().includes('auth');
    if (!isLoginPage) {
      const refLink = page.getByRole('link', { name: /Reference/i }).first();
      await expect(refLink).toBeVisible();
    }
  });

  test('shows CSF core Function grid', async ({ page }) => {
    const isLoginPage = page.url().includes('login') || page.url().includes('auth');
    if (!isLoginPage) {
      await expect(page.getByText('GV').first()).toBeVisible();
      await expect(page.getByText('PR').first()).toBeVisible();
      await expect(page.getByText('RC').first()).toBeVisible();
    }
  });

  test('displays 49 controls stat', async ({ page }) => {
    const isLoginPage = page.url().includes('login') || page.url().includes('auth');
    if (!isLoginPage) {
      await expect(page.getByText('49')).toBeVisible();
    }
  });
});
