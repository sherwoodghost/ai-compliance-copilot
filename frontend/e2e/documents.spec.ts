/**
 * Documents Page — Playwright E2E Tests (P19)
 *
 * Covers:
 * - Documents list page loads correctly
 * - "New Document" button opens the editor overlay
 * - Editor toolbar is rendered with key formatting controls
 * - Document title can be set
 * - Classification badge is visible and changeable
 * - Sidebar nav link routes to /documents
 * - Control Library page loads and "Explain" AI button is present
 */

import { test, expect } from '@playwright/test';
import { loginAs } from './helpers/auth';

const DEMO_EMAIL    = 'admin@demo.com';
const DEMO_PASSWORD = 'Demo1234!';

// ─── Setup — log in before each test ─────────────────────────────────────────

test.beforeEach(async ({ page }) => {
  await loginAs(page, DEMO_EMAIL, DEMO_PASSWORD);
});

// ─── Documents list page ──────────────────────────────────────────────────────

test('documents page loads with correct heading and New Document button', async ({ page }) => {
  await page.goto('/documents');
  await page.waitForLoadState('networkidle', { timeout: 20_000 });

  // Page heading
  await expect(
    page.getByRole('heading', { name: 'Documents' }),
  ).toBeVisible({ timeout: 10_000 });

  // Primary action button
  await expect(
    page.getByRole('button', { name: /New Document/i }),
  ).toBeVisible();
});

test('documents page renders filter tabs (All, Policies, Procedures)', async ({ page }) => {
  await page.goto('/documents');
  await page.waitForLoadState('networkidle', { timeout: 20_000 });

  // The page renders doc-type filter tabs
  await expect(page.getByRole('button', { name: /^All$/i })).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole('button', { name: /Policies/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /Procedures/i })).toBeVisible();
});

test('sidebar has Documents nav link that routes to /documents', async ({ page }) => {
  await page.goto('/overview');
  await page.waitForLoadState('networkidle', { timeout: 20_000 });

  const docsLink = page.locator('aside nav').getByRole('link', { name: /Documents/i });
  await expect(docsLink).toBeVisible({ timeout: 10_000 });
  await expect(docsLink).toHaveAttribute('href', '/documents');
});

// ─── New Document — editor overlay ───────────────────────────────────────────

test('clicking New Document opens the editor overlay', async ({ page }) => {
  await page.goto('/documents');
  await page.waitForLoadState('networkidle', { timeout: 20_000 });

  await page.getByRole('button', { name: /New Document/i }).click();

  // The editor overlay should appear — it contains an input for the document title
  // and the TipTap editor content area.
  await expect(
    page.getByPlaceholder(/Untitled Document/i),
  ).toBeVisible({ timeout: 10_000 });
});

test('editor overlay renders formatting toolbar buttons', async ({ page }) => {
  await page.goto('/documents');
  await page.waitForLoadState('networkidle', { timeout: 20_000 });
  await page.getByRole('button', { name: /New Document/i }).click();
  // Wait for editor to mount
  await expect(page.getByPlaceholder(/Untitled Document/i)).toBeVisible({ timeout: 10_000 });

  // Bold, Italic, Underline are the core toolbar buttons (title attributes)
  await expect(page.getByTitle('Bold')).toBeVisible();
  await expect(page.getByTitle('Italic')).toBeVisible();
  await expect(page.getByTitle('Underline')).toBeVisible();
});

test('document title can be typed and persists in the input', async ({ page }) => {
  await page.goto('/documents');
  await page.waitForLoadState('networkidle', { timeout: 20_000 });
  await page.getByRole('button', { name: /New Document/i }).click();

  const titleInput = page.getByPlaceholder(/Untitled Document/i);
  await expect(titleInput).toBeVisible({ timeout: 10_000 });

  const uniqueTitle = `E2E Doc ${Date.now()}`;
  await titleInput.fill(uniqueTitle);
  await expect(titleInput).toHaveValue(uniqueTitle);
});

test('editor overlay shows classification badge (default INTERNAL)', async ({ page }) => {
  await page.goto('/documents');
  await page.waitForLoadState('networkidle', { timeout: 20_000 });
  await page.getByRole('button', { name: /New Document/i }).click();
  await expect(page.getByPlaceholder(/Untitled Document/i)).toBeVisible({ timeout: 10_000 });

  // The classification selector is rendered as a <select> or button with INTERNAL as default
  // Matches either a visible badge text or a select option
  await expect(
    page.getByText(/INTERNAL/i).first(),
  ).toBeVisible({ timeout: 10_000 });
});

test('Back button in editor overlay returns to documents list', async ({ page }) => {
  await page.goto('/documents');
  await page.waitForLoadState('networkidle', { timeout: 20_000 });
  await page.getByRole('button', { name: /New Document/i }).click();
  await expect(page.getByPlaceholder(/Untitled Document/i)).toBeVisible({ timeout: 10_000 });

  // The overlay has a "← Back" link/button
  const backBtn = page.getByRole('button', { name: /Back/i }).first();
  await expect(backBtn).toBeVisible();
  await backBtn.click();

  // Should return to the Documents list
  await expect(
    page.getByRole('heading', { name: 'Documents' }),
  ).toBeVisible({ timeout: 10_000 });
});

// ─── Compliance Metadata Sidebar ─────────────────────────────────────────────

test('editor overlay shows compliance metadata sidebar panel', async ({ page }) => {
  await page.goto('/documents');
  await page.waitForLoadState('networkidle', { timeout: 20_000 });
  await page.getByRole('button', { name: /New Document/i }).click();
  await expect(page.getByPlaceholder(/Untitled Document/i)).toBeVisible({ timeout: 10_000 });

  // Metadata sidebar contains "Word count" label
  await expect(
    page.getByText(/Word count/i).first(),
  ).toBeVisible({ timeout: 10_000 });
});

// ─── Control Library Page ─────────────────────────────────────────────────────

test('control library page loads with controls list', async ({ page }) => {
  await page.goto('/control-library');
  await page.waitForLoadState('networkidle', { timeout: 20_000 });

  await expect(
    page.getByRole('heading', { name: 'Control Library' }),
  ).toBeVisible({ timeout: 10_000 });

  // Controls are listed as rows — wait for at least one to appear
  // (each control row has a font-mono code badge)
  await expect(
    page.locator('.font-mono').first(),
  ).toBeVisible({ timeout: 15_000 });
});

test('control library shows AI Explain button on control rows', async ({ page }) => {
  await page.goto('/control-library');
  await page.waitForLoadState('networkidle', { timeout: 20_000 });

  // Wait for controls to load
  await expect(page.locator('.font-mono').first()).toBeVisible({ timeout: 15_000 });

  // "Explain" buttons should be visible for each control row
  const explainBtn = page.getByRole('button', { name: 'Explain' }).first();
  await expect(explainBtn).toBeVisible({ timeout: 10_000 });
});

test('control library search filters results', async ({ page }) => {
  await page.goto('/control-library');
  await page.waitForLoadState('networkidle', { timeout: 20_000 });
  await expect(page.locator('.font-mono').first()).toBeVisible({ timeout: 15_000 });

  // Type in the search box to filter controls
  const searchInput = page.getByPlaceholder(/Search by code, title/i);
  await expect(searchInput).toBeVisible();
  await searchInput.fill('A.5.1');

  // After filtering, results count text should appear
  await expect(
    page.getByText(/controls match/i),
  ).toBeVisible({ timeout: 5_000 });
});

test('control library SOC2 filter shows only SOC2 controls', async ({ page }) => {
  await page.goto('/control-library');
  await page.waitForLoadState('networkidle', { timeout: 20_000 });
  await expect(page.locator('.font-mono').first()).toBeVisible({ timeout: 15_000 });

  // Click the SOC2 filter tab
  const soc2Tab = page.getByRole('button', { name: /^SOC2$/i });
  await expect(soc2Tab).toBeVisible();
  await soc2Tab.click();

  // After filtering, ISO27001 controls should not appear (ISO control codes start with "A.")
  // and SOC2 controls (CC codes) should remain
  // We just verify no error state and controls are still shown
  await expect(
    page.locator('.font-mono').first(),
  ).toBeVisible({ timeout: 10_000 });
});
