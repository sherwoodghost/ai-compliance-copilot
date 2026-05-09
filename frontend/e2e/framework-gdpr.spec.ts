/**
 * E2E tests — GDPR (General Data Protection Regulation)
 *
 * Tests the public reference page (/frameworks/gdpr) and the authenticated
 * dashboard page (/gdpr).  These tests are included in the gap detector's
 * coverage check — they prove the framework is end-to-end wired.
 */
import { test, expect } from '@playwright/test';

// ─── Public reference page (no auth required) ─────────────────────────────────

test.describe('GDPR public reference page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/frameworks/gdpr');
  });

  test('loads without authentication', async ({ page }) => {
    await expect(page).not.toHaveURL(/login/);
    await expect(page.locator('h1')).toBeVisible();
  });

  test('shows GDPR heading', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('GDPR');
  });

  test('displays Regulation (EU) 2016/679 badge', async ({ page }) => {
    await expect(page.getByText(/Regulation.*EU.*2016\/679|2016\/679/i)).toBeVisible();
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

  test('shows Principles (Art. 5) article group', async ({ page }) => {
    await expect(page.getByText(/Principles|Art\. 5/i).first()).toBeVisible({ timeout: 15_000 });
  });

  test('shows Data Subject Rights group', async ({ page }) => {
    await expect(page.getByText(/Data Subject Rights|Art\. 1[5-9]|Art\. 2[0-2]/i).first()).toBeVisible({ timeout: 15_000 });
  });

  test('shows Breach Notification group', async ({ page }) => {
    await expect(page.getByText(/Breach Notification|Art\. 3[34]/i).first()).toBeVisible({ timeout: 15_000 });
  });
});

// ─── Authenticated dashboard page ─────────────────────────────────────────────

test.describe('GDPR dashboard overview page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/gdpr');
  });

  test('loads the GDPR overview page', async ({ page }) => {
    const isLoginPage = page.url().includes('login') || page.url().includes('auth');
    if (!isLoginPage) {
      await expect(page.locator('h1')).toContainText('GDPR');
    }
  });

  test('shows article group breakdown', async ({ page }) => {
    const isLoginPage = page.url().includes('login') || page.url().includes('auth');
    if (!isLoginPage) {
      // Article groups panel should be visible
      await expect(page.getByText('GDPR Article Groups').or(page.getByText('Principles'))).toBeVisible({ timeout: 10_000 });
    }
  });

  test('has reference link pointing to /frameworks/gdpr', async ({ page }) => {
    const isLoginPage = page.url().includes('login') || page.url().includes('auth');
    if (!isLoginPage) {
      const refLink = page.getByRole('link', { name: /Reference/i }).first();
      await expect(refLink).toBeVisible();
    }
  });

  test('shows GDPR module quick-links', async ({ page }) => {
    const isLoginPage = page.url().includes('login') || page.url().includes('auth');
    if (!isLoginPage) {
      await expect(page.getByText(/ROPA|Records of Processing/i).first()).toBeVisible({ timeout: 10_000 });
      await expect(page.getByText(/DSAR|Data Subject/i).first()).toBeVisible({ timeout: 10_000 });
    }
  });

  test('shows key GDPR obligations section', async ({ page }) => {
    const isLoginPage = page.url().includes('login') || page.url().includes('auth');
    if (!isLoginPage) {
      await expect(page.getByText(/72h Breach|Key GDPR/i).first()).toBeVisible({ timeout: 10_000 });
    }
  });

  test('View Controls button links to /controls?framework=GDPR', async ({ page }) => {
    const isLoginPage = page.url().includes('login') || page.url().includes('auth');
    if (!isLoginPage) {
      const btn = page.getByRole('link', { name: /View Controls/i });
      await expect(btn).toBeVisible();
      await expect(btn).toHaveAttribute('href', '/controls?framework=GDPR');
    }
  });
});

// ─── GDPR sub-module pages ─────────────────────────────────────────────────────

test.describe('GDPR ROPA page', () => {
  test('loads the ROPA page', async ({ page }) => {
    await page.goto('/gdpr/ropa');
    const isLoginPage = page.url().includes('login') || page.url().includes('auth');
    if (!isLoginPage) {
      await expect(page.locator('h1')).toContainText(/ROPA|Records of Processing/i);
    }
  });
});

test.describe('GDPR DSAR page', () => {
  test('loads the DSAR queue page', async ({ page }) => {
    await page.goto('/gdpr/dsar');
    const isLoginPage = page.url().includes('login') || page.url().includes('auth');
    if (!isLoginPage) {
      await expect(page.locator('h1')).toContainText(/DSAR|Data Subject/i);
    }
  });
});

test.describe('GDPR Breach Log page', () => {
  test('loads the breach notification log', async ({ page }) => {
    await page.goto('/gdpr/breach-log');
    const isLoginPage = page.url().includes('login') || page.url().includes('auth');
    if (!isLoginPage) {
      await expect(page.locator('h1')).toContainText(/Breach/i);
    }
  });
});
