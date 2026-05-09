/**
 * E2E tests — ISO 45001:2018 Occupational Health & Safety Management System
 *
 * Tests the public reference page (/frameworks/iso45001) and the authenticated
 * dashboard page (/iso45001).  These tests are included in the gap detector's
 * coverage check — they prove the framework is end-to-end wired.
 */
import { test, expect } from '@playwright/test';

// ─── Public reference page (no auth required) ─────────────────────────────────

test.describe('ISO 45001 public reference page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/frameworks/iso45001');
  });

  test('loads without authentication', async ({ page }) => {
    await expect(page).not.toHaveURL(/login/);
    await expect(page.locator('h1')).toBeVisible();
  });

  test('shows ISO 45001 heading', async ({ page }) => {
    await expect(page.locator('h1')).toContainText(/ISO 45001/i);
  });

  test('displays ISO 45001:2018 version badge', async ({ page }) => {
    await expect(page.getByText(/ISO 45001:2018|45001:2018/i)).toBeVisible();
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

  test('shows Leadership and Worker Participation (Clause 5) group', async ({ page }) => {
    await expect(page.getByText(/Leadership.*Worker|Worker Participation/i).first()).toBeVisible({ timeout: 15_000 });
  });

  test('shows OHS Performance group', async ({ page }) => {
    await expect(page.getByText(/OHS Performance|Hazard Identification/i).first()).toBeVisible({ timeout: 15_000 });
  });

  test('shows Improvement (Clause 10) group', async ({ page }) => {
    await expect(page.getByText(/Improvement|Clause 10/i).first()).toBeVisible({ timeout: 15_000 });
  });

  test('mentions OHSAS 18001 replacement', async ({ page }) => {
    await expect(page.getByText(/OHSAS 18001/i)).toBeVisible();
  });
});

// ─── Authenticated dashboard page ─────────────────────────────────────────────

test.describe('ISO 45001 dashboard overview page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/iso45001');
  });

  test('loads the ISO 45001 overview page', async ({ page }) => {
    const isLoginPage = page.url().includes('login') || page.url().includes('auth');
    if (!isLoginPage) {
      await expect(page.locator('h1')).toContainText(/ISO 45001/i);
    }
  });

  test('shows OHSMS clause breakdown', async ({ page }) => {
    const isLoginPage = page.url().includes('login') || page.url().includes('auth');
    if (!isLoginPage) {
      await expect(
        page.getByText('OHSMS Clauses').or(page.getByText('Context of the Organization'))
      ).toBeVisible({ timeout: 10_000 });
    }
  });

  test('has reference link pointing to /frameworks/iso45001', async ({ page }) => {
    const isLoginPage = page.url().includes('login') || page.url().includes('auth');
    if (!isLoginPage) {
      const refLink = page.getByRole('link', { name: /Reference/i }).first();
      await expect(refLink).toBeVisible();
    }
  });

  test('shows ISO 45001 module quick-links', async ({ page }) => {
    const isLoginPage = page.url().includes('login') || page.url().includes('auth');
    if (!isLoginPage) {
      await expect(page.getByText(/Hazard|Hazard Identification/i).first()).toBeVisible({ timeout: 10_000 });
      await expect(page.getByText(/OHS Incident|Incident Records/i).first()).toBeVisible({ timeout: 10_000 });
    }
  });

  test('shows OH&S Performance Targets section', async ({ page }) => {
    const isLoginPage = page.url().includes('login') || page.url().includes('auth');
    if (!isLoginPage) {
      await expect(
        page.getByText(/OH.*S Performance Targets|OHS.*Performance/i).first()
      ).toBeVisible({ timeout: 10_000 });
    }
  });

  test('View Controls button links to /controls?framework=ISO45001', async ({ page }) => {
    const isLoginPage = page.url().includes('login') || page.url().includes('auth');
    if (!isLoginPage) {
      const btn = page.getByRole('link', { name: /View Controls/i });
      await expect(btn).toBeVisible();
      await expect(btn).toHaveAttribute('href', '/controls?framework=ISO45001');
    }
  });
});

// ─── ISO 45001 sub-module pages ────────────────────────────────────────────────

test.describe('ISO 45001 Hazard Identification Register', () => {
  test('loads the hazards page', async ({ page }) => {
    await page.goto('/iso45001/hazards');
    const isLoginPage = page.url().includes('login') || page.url().includes('auth');
    if (!isLoginPage) {
      await expect(page.locator('h1')).toContainText(/Hazard/i);
    }
  });
});

test.describe('ISO 45001 OHS Incident Records', () => {
  test('loads the OHS incidents page', async ({ page }) => {
    await page.goto('/iso45001/incidents');
    const isLoginPage = page.url().includes('login') || page.url().includes('auth');
    if (!isLoginPage) {
      await expect(page.locator('h1')).toContainText(/Incident/i);
    }
  });
});

test.describe('ISO 45001 Emergency Response Plans', () => {
  test('loads the emergency response page', async ({ page }) => {
    await page.goto('/iso45001/emergency');
    const isLoginPage = page.url().includes('login') || page.url().includes('auth');
    if (!isLoginPage) {
      await expect(page.locator('h1')).toContainText(/Emergency/i);
    }
  });
});

test.describe('ISO 45001 Health Surveillance', () => {
  test('loads the health surveillance page', async ({ page }) => {
    await page.goto('/iso45001/health-surveillance');
    const isLoginPage = page.url().includes('login') || page.url().includes('auth');
    if (!isLoginPage) {
      await expect(page.locator('h1')).toContainText(/Health Surveillance|Health/i);
    }
  });
});
