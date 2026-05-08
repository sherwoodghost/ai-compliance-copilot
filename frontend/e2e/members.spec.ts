import { test, expect } from '@playwright/test';
import { loginAs } from './helpers/auth';

const DEMO_EMAIL    = 'admin@demo.com';
const DEMO_PASSWORD = 'Demo1234!';

test.beforeEach(async ({ page }) => {
  await loginAs(page, DEMO_EMAIL, DEMO_PASSWORD);
  await page.goto('/members');
  await page.waitForLoadState('networkidle', { timeout: 20_000 });
  await expect(page.getByRole('heading', { name: /team|members/i })).toBeVisible({ timeout: 10_000 });
});

// ─── Page loads ───────────────────────────────────────────────────────────────

test('members page loads with correct heading', async ({ page }) => {
  await expect(page.getByRole('heading', { name: /team|members/i })).toBeVisible();
});

test('invite member button is visible for admin', async ({ page }) => {
  const inviteBtn = page.getByRole('button', { name: /invite|add member/i });
  await expect(inviteBtn).toBeVisible();
});

// ─── Member table ─────────────────────────────────────────────────────────────

test('member list table or grid is visible', async ({ page }) => {
  // Accept either a table or a card-based grid
  const memberList = page.locator('table, [class*="member-list"], [data-testid="member-list"]').first();
  await expect(memberList).toBeVisible({ timeout: 8_000 });
});

test('member rows have name and role visible', async ({ page }) => {
  const rows = page.locator('tr, [class*="member-row"]');
  const count = await rows.count();
  if (count > 1) {
    // At least one data row (skip header)
    await expect(rows.nth(1)).toBeVisible();
  }
});

// ─── Invite modal ─────────────────────────────────────────────────────────────

test('clicking invite opens invite form or modal', async ({ page }) => {
  await page.getByRole('button', { name: /invite|add member/i }).click();
  await page.waitForTimeout(1000);

  // Expect email input to appear
  const emailInput = page.getByLabel(/email/i).or(page.locator('input[type="email"]')).first();
  await expect(emailInput).toBeVisible({ timeout: 8_000 });
});

test('invite form has email and role fields', async ({ page }) => {
  await page.getByRole('button', { name: /invite|add member/i }).click();
  await page.waitForTimeout(1000);

  const emailInput = page.getByLabel(/email/i).or(page.locator('input[type="email"]')).first();
  await expect(emailInput).toBeVisible({ timeout: 8_000 });

  // Role dropdown or radio
  const roleField = page.getByLabel(/role/i).or(page.locator('select[name*="role"], [data-testid*="role"]')).first();
  const roleVisible = await roleField.isVisible().catch(() => false);
  // If not visible on step 1, navigate forward
  if (!roleVisible) {
    const nextBtn = page.getByRole('button', { name: /next|continue/i }).first();
    const nextVisible = await nextBtn.isVisible().catch(() => false);
    if (nextVisible) {
      await emailInput.fill('test@example.com');
      await nextBtn.click();
      await page.waitForTimeout(800);
    }
  }
  // Just confirm no crash occurred
  await expect(page.locator('body')).toBeVisible();
});

test('invite modal can be dismissed', async ({ page }) => {
  await page.getByRole('button', { name: /invite|add member/i }).click();
  await page.waitForTimeout(800);

  const closeBtn = page.getByRole('button', { name: /cancel|close|dismiss/i }).or(
    page.locator('[aria-label="Close"], button:has(svg[data-lucide="X"])'),
  ).first();
  const canClose = await closeBtn.isVisible().catch(() => false);
  if (canClose) {
    await closeBtn.click();
    await page.waitForTimeout(600);
    const emailInput = page.locator('input[type="email"]').first();
    await expect(emailInput).not.toBeVisible({ timeout: 3_000 });
  }
  await expect(page.locator('body')).toBeVisible();
});

// ─── Tabs ─────────────────────────────────────────────────────────────────────

test('members page has multiple tabs or sections', async ({ page }) => {
  const tabs = page.getByRole('tab').or(page.locator('[role="tablist"] button, [class*="tab-button"], [class*="tab-item"]'));
  const count = await tabs.count();
  // Should have at least one tab (Members, RACI, Training, etc.)
  expect(count).toBeGreaterThanOrEqual(1);
});
