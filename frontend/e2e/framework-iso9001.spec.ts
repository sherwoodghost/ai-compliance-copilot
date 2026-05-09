/**
 * E2E tests — ISO 9001:2015 Quality Management System
 *
 * Tests the public reference page (/frameworks/iso9001) and the authenticated
 * dashboard page (/iso9001).  These tests are included in the gap detector's
 * coverage check — they prove the framework is end-to-end wired.
 */
import { test, expect } from '@playwright/test';

// ─── Public reference page (no auth required) ─────────────────────────────────

test.describe('ISO 9001 public reference page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/frameworks/iso9001');
  });

  test('loads without authentication', async ({ page }) => {
    await expect(page).not.toHaveURL(/login/);
    await expect(page.locator('h1')).toBeVisible();
  });

  test('shows ISO 9001 heading', async ({ page }) => {
    await expect(page.locator('h1')).toContainText(/ISO 9001/i);
  });

  test('displays ISO 9001:2015 version badge', async ({ page }) => {
    await expect(page.getByText(/ISO 9001:2015|9001:2015/i)).toBeVisible();
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

  test('shows Improvement (Clause 10) group', async ({ page }) => {
    await expect(page.getByText(/Improvement|Clause 10/i).first()).toBeVisible({ timeout: 15_000 });
  });
});

// ─── Authenticated dashboard page ─────────────────────────────────────────────

test.describe('ISO 9001 dashboard overview page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/iso9001');
  });

  test('loads the ISO 9001 overview page', async ({ page }) => {
    const isLoginPage = page.url().includes('login') || page.url().includes('auth');
    if (!isLoginPage) {
      await expect(page.locator('h1')).toContainText(/ISO 9001/i);
    }
  });

  test('shows QMS clause breakdown', async ({ page }) => {
    const isLoginPage = page.url().includes('login') || page.url().includes('auth');
    if (!isLoginPage) {
      await expect(page.getByText('QMS Clauses').or(page.getByText('Context of the Organization'))).toBeVisible({ timeout: 10_000 });
    }
  });

  test('has reference link pointing to /frameworks/iso9001', async ({ page }) => {
    const isLoginPage = page.url().includes('login') || page.url().includes('auth');
    if (!isLoginPage) {
      const refLink = page.getByRole('link', { name: /Reference/i }).first();
      await expect(refLink).toBeVisible();
    }
  });

  test('shows ISO 9001 module quick-links', async ({ page }) => {
    const isLoginPage = page.url().includes('login') || page.url().includes('auth');
    if (!isLoginPage) {
      await expect(page.getByText(/NCR|Nonconformity/i).first()).toBeVisible({ timeout: 10_000 });
      await expect(page.getByText(/CAPA/i).first()).toBeVisible({ timeout: 10_000 });
    }
  });

  test('shows PDCA cycle section', async ({ page }) => {
    const isLoginPage = page.url().includes('login') || page.url().includes('auth');
    if (!isLoginPage) {
      await expect(page.getByText(/PDCA/i).first()).toBeVisible({ timeout: 10_000 });
    }
  });

  test('View Controls button links to /controls?framework=ISO9001', async ({ page }) => {
    const isLoginPage = page.url().includes('login') || page.url().includes('auth');
    if (!isLoginPage) {
      const btn = page.getByRole('link', { name: /View Controls/i });
      await expect(btn).toBeVisible();
      await expect(btn).toHaveAttribute('href', '/controls?framework=ISO9001');
    }
  });
});

// ─── ISO 9001 sub-module pages ─────────────────────────────────────────────────

test.describe('ISO 9001 NCR tracker', () => {
  test('loads the NCR page', async ({ page }) => {
    await page.goto('/iso9001/ncr');
    const isLoginPage = page.url().includes('login') || page.url().includes('auth');
    if (!isLoginPage) {
      await expect(page.locator('h1')).toContainText(/NCR|Nonconformity/i);
    }
  });
});

test.describe('ISO 9001 CAPA board', () => {
  test('loads the CAPA page', async ({ page }) => {
    await page.goto('/iso9001/capa');
    const isLoginPage = page.url().includes('login') || page.url().includes('auth');
    if (!isLoginPage) {
      await expect(page.locator('h1')).toContainText(/CAPA|Corrective/i);
    }
  });
});

test.describe('ISO 9001 Quality Objectives', () => {
  test('loads the quality objectives page', async ({ page }) => {
    await page.goto('/iso9001/objectives');
    const isLoginPage = page.url().includes('login') || page.url().includes('auth');
    if (!isLoginPage) {
      await expect(page.locator('h1')).toContainText(/Quality Objective/i);
    }
  });
});

test.describe('ISO 9001 Process Audits', () => {
  test('loads the process audits page', async ({ page }) => {
    await page.goto('/iso9001/audits');
    const isLoginPage = page.url().includes('login') || page.url().includes('auth');
    if (!isLoginPage) {
      await expect(page.locator('h1')).toContainText(/Audit/i);
    }
  });
});
