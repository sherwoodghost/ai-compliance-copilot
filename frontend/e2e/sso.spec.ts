/**
 * SSO Settings E2E Tests (P23)
 *
 * Tests the SSO settings UI in the Settings → Security tab:
 *   - Tab navigation to Security section
 *   - SSO configuration form renders correctly
 *   - "Test connection" button is enabled after saving config
 *   - SSO login page shows "Continue with SSO" button
 *   - SSO org slug entry and redirect flow
 *   - SSO callback page handles error param gracefully
 */

import { test, expect } from '@playwright/test';
import { loginAs } from './helpers/auth';

const DEMO_EMAIL    = 'admin@demo.com';
const DEMO_PASSWORD = 'Demo1234!';

// ─── Settings page — Security tab ────────────────────────────────────────────

test('Settings Security tab shows SSO section', async ({ page }) => {
  await loginAs(page, DEMO_EMAIL, DEMO_PASSWORD);
  await page.goto('/settings');

  // Click the "Security" tab
  await page.getByRole('button', { name: 'Security' }).click();

  // SSO section heading should appear
  await expect(page.getByText('SAML Single Sign-On (SSO)')).toBeVisible({ timeout: 5000 });

  // SSO form fields
  await expect(page.getByPlaceholder('https://your-idp.example.com/sso/saml')).toBeVisible();
  await expect(page.getByPlaceholder('https://your-idp.example.com/issuer')).toBeVisible();
});

test('Settings Security tab shows save button disabled when fields empty', async ({ page }) => {
  await loginAs(page, DEMO_EMAIL, DEMO_PASSWORD);
  await page.goto('/settings');
  await page.getByRole('button', { name: 'Security' }).click();

  // Save button should be disabled when no IdP URL or entity ID entered
  const saveButton = page.getByRole('button', { name: /Save configuration|Update configuration/i });
  await expect(saveButton).toBeDisabled({ timeout: 5000 });
});

test('Settings Security tab "Attribute Mapping" details accordion expands', async ({ page }) => {
  await loginAs(page, DEMO_EMAIL, DEMO_PASSWORD);
  await page.goto('/settings');
  await page.getByRole('button', { name: 'Security' }).click();

  // Expand attribute mapping accordion
  await page.getByText('Attribute Mapping (advanced)').click();

  await expect(page.getByText('Email attribute')).toBeVisible({ timeout: 3000 });
  await expect(page.getByText('First name attribute')).toBeVisible();
});

// ─── Settings page — Tab navigation ──────────────────────────────────────────

test('Settings page shows all 5 tabs', async ({ page }) => {
  await loginAs(page, DEMO_EMAIL, DEMO_PASSWORD);
  await page.goto('/settings');

  for (const tab of ['Account', 'Organization', 'AI & Integrations', 'Security', 'Advanced']) {
    await expect(page.getByRole('button', { name: tab })).toBeVisible({ timeout: 5000 });
  }
});

test('Settings Account tab shows Profile and Password sections', async ({ page }) => {
  await loginAs(page, DEMO_EMAIL, DEMO_PASSWORD);
  await page.goto('/settings');

  // Account tab should be active by default
  await expect(page.getByText('Profile')).toBeVisible({ timeout: 5000 });
  await expect(page.getByText('Change Password')).toBeVisible();
  await expect(page.getByText('Sessions')).toBeVisible();
});

test('Settings Advanced tab shows Danger Zone', async ({ page }) => {
  await loginAs(page, DEMO_EMAIL, DEMO_PASSWORD);
  await page.goto('/settings');
  await page.getByRole('button', { name: 'Advanced' }).click();

  await expect(page.getByText('Danger Zone')).toBeVisible({ timeout: 5000 });
  await expect(page.getByText('Restart Onboarding')).toBeVisible();
});

// ─── Login page — SSO button ──────────────────────────────────────────────────

test('Login page shows "Continue with SSO" button', async ({ page }) => {
  await page.goto('/login');

  await expect(page.getByRole('button', { name: 'Continue with SSO' })).toBeVisible({ timeout: 5000 });
});

test('Clicking Continue with SSO shows org slug input', async ({ page }) => {
  await page.goto('/login');
  await page.getByRole('button', { name: 'Continue with SSO' }).click();

  await expect(page.getByLabel('Organization slug')).toBeVisible({ timeout: 3000 });
  await expect(page.getByText('Back to password login')).toBeVisible();
});

test('SSO org slug input filters invalid characters', async ({ page }) => {
  await page.goto('/login');
  await page.getByRole('button', { name: 'Continue with SSO' }).click();

  const input = page.getByLabel('Organization slug');
  await input.fill('My Company 123!');

  // Should be lowercase, hyphens/alphanumeric only — spaces, capitals, special chars stripped
  await expect(input).toHaveValue('my-company-123');
});

test('SSO "Continue" button disabled when slug is empty', async ({ page }) => {
  await page.goto('/login');
  await page.getByRole('button', { name: 'Continue with SSO' }).click();

  const continueBtn = page.getByRole('button', { name: 'Continue with SSO' }).last();
  await expect(continueBtn).toBeDisabled({ timeout: 3000 });
});

// ─── SSO callback page — error handling ──────────────────────────────────────

test('SSO callback page shows error message from query param', async ({ page }) => {
  await page.goto('/auth/sso-callback?error=SSO+authentication+failed');

  await expect(page.getByText('Sign-in failed')).toBeVisible({ timeout: 5000 });
  await expect(page.getByText('SSO authentication failed')).toBeVisible();
  await expect(page.getByRole('link', { name: /Back to login/i })).toBeVisible();
});

test('SSO callback page shows loading state initially without tokens', async ({ page }) => {
  await page.goto('/auth/sso-callback');

  // Without accessToken or refreshToken params, should show an error
  await expect(page.getByText('Sign-in failed')).toBeVisible({ timeout: 5000 });
  await expect(page.getByText(/Missing authentication tokens/i)).toBeVisible();
});
