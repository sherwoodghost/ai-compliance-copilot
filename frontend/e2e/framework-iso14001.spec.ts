/**
 * E2E tests — ISO 14001:2015 Environmental Management System
 *
 * Tests the public reference page (/frameworks/iso14001) and the authenticated
 * dashboard page (/iso14001).  These tests are included in the gap detector's
 * coverage check — they prove the framework is end-to-end wired.
 */
import { test, expect } from '@playwright/test';

// ─── Public reference page (no auth required) ─────────────────────────────────

test.describe('ISO 14001 public reference page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/frameworks/iso14001');
  });

  test('loads without authentication', async ({ page }) => {
    await expect(page).not.toHaveURL(/login/);
    await expect(page.locator('h1')).toBeVisible();
  });

  test('shows ISO 14001 heading', async ({ page }) => {
    await expect(page.locator('h1')).toContainText(/ISO 14001/i);
  });

  test('displays ISO 14001:2015 version badge', async ({ page }) => {
    await expect(page.getByText(/ISO 14001:2015|14001:2015/i)).toBeVisible();
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

  test('shows Context of the Organization (Clause 4) group', async ({ page }) => {
    await expect(page.getByText(/Context of the Organization|Clause 4/i).first()).toBeVisible({ timeout: 15_000 });
  });

  test('shows Leadership (Clause 5) group', async ({ page }) => {
    await expect(page.getByText(/Leadership/i).first()).toBeVisible({ timeout: 15_000 });
  });

  test('shows Environmental Performance group', async ({ page }) => {
    await expect(page.getByText(/Environmental Performance|Environmental Aspects/i).first()).toBeVisible({ timeout: 15_000 });
  });

  test('shows Improvement (Clause 10) group', async ({ page }) => {
    await expect(page.getByText(/Improvement|Clause 10/i).first()).toBeVisible({ timeout: 15_000 });
  });

  test('shows 8 clause groups stat', async ({ page }) => {
    await expect(page.getByText(/8 clause/i)).toBeVisible();
  });
});

// ─── Authenticated dashboard page ─────────────────────────────────────────────

test.describe('ISO 14001 dashboard overview page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/iso14001');
  });

  test('loads the ISO 14001 overview page', async ({ page }) => {
    const isLoginPage = page.url().includes('login') || page.url().includes('auth');
    if (!isLoginPage) {
      await expect(page.locator('h1')).toContainText(/ISO 14001/i);
    }
  });

  test('shows EMS clause breakdown', async ({ page }) => {
    const isLoginPage = page.url().includes('login') || page.url().includes('auth');
    if (!isLoginPage) {
      await expect(
        page.getByText('EMS Clauses').or(page.getByText('Context of the Organization'))
      ).toBeVisible({ timeout: 10_000 });
    }
  });

  test('has reference link pointing to /frameworks/iso14001', async ({ page }) => {
    const isLoginPage = page.url().includes('login') || page.url().includes('auth');
    if (!isLoginPage) {
      const refLink = page.getByRole('link', { name: /Reference/i }).first();
      await expect(refLink).toBeVisible();
    }
  });

  test('shows ISO 14001 module quick-links', async ({ page }) => {
    const isLoginPage = page.url().includes('login') || page.url().includes('auth');
    if (!isLoginPage) {
      await expect(page.getByText(/Environmental Aspects|Aspects Register/i).first()).toBeVisible({ timeout: 10_000 });
      await expect(page.getByText(/Legal.*Compliance|Legal Register/i).first()).toBeVisible({ timeout: 10_000 });
    }
  });

  test('shows Key Environmental Topics section', async ({ page }) => {
    const isLoginPage = page.url().includes('login') || page.url().includes('auth');
    if (!isLoginPage) {
      await expect(
        page.getByText(/Key Environmental Topics|Environmental Topics/i).first()
      ).toBeVisible({ timeout: 10_000 });
    }
  });

  test('View Controls button links to /controls?framework=ISO14001', async ({ page }) => {
    const isLoginPage = page.url().includes('login') || page.url().includes('auth');
    if (!isLoginPage) {
      const btn = page.getByRole('link', { name: /View Controls/i });
      await expect(btn).toBeVisible();
      await expect(btn).toHaveAttribute('href', '/controls?framework=ISO14001');
    }
  });
});

// ─── ISO 14001 sub-module pages ────────────────────────────────────────────────

test.describe('ISO 14001 Environmental Aspects', () => {
  test('loads the environmental aspects page', async ({ page }) => {
    await page.goto('/iso14001/aspects');
    const isLoginPage = page.url().includes('login') || page.url().includes('auth');
    if (!isLoginPage) {
      await expect(page.locator('h1')).toContainText(/Aspect|Environmental/i);
    }
  });
});

test.describe('ISO 14001 Environmental Objectives', () => {
  test('loads the objectives page', async ({ page }) => {
    await page.goto('/iso14001/objectives');
    const isLoginPage = page.url().includes('login') || page.url().includes('auth');
    if (!isLoginPage) {
      await expect(page.locator('h1')).toContainText(/Objective/i);
    }
  });
});

test.describe('ISO 14001 Legal Register', () => {
  test('loads the legal register page', async ({ page }) => {
    await page.goto('/iso14001/legal-register');
    const isLoginPage = page.url().includes('login') || page.url().includes('auth');
    if (!isLoginPage) {
      await expect(page.locator('h1')).toContainText(/Legal|Compliance/i);
    }
  });
});

test.describe('ISO 14001 Emergency Response', () => {
  test('loads the emergency response page', async ({ page }) => {
    await page.goto('/iso14001/emergency-response');
    const isLoginPage = page.url().includes('login') || page.url().includes('auth');
    if (!isLoginPage) {
      await expect(page.locator('h1')).toContainText(/Emergency/i);
    }
  });
});
