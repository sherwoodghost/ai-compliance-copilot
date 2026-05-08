import { test, expect } from '@playwright/test';
import { loginAs } from './helpers/auth';

const DEMO_EMAIL = 'admin@demo.com';
const DEMO_PASSWORD = 'Demo1234!';

// ─── Setup — log in before each test ─────────────────────────────────────────

test.beforeEach(async ({ page }) => {
  await loginAs(page, DEMO_EMAIL, DEMO_PASSWORD);
  // Navigate to the incidents page and wait for it to be fully interactive.
  await page.goto('/incidents');
  // Wait for load + network idle so React Query fetches complete before tests interact.
  // This prevents the hydration-remount race where an in-flight API response resets state.
  await page.waitForLoadState('networkidle', { timeout: 20_000 });
  // Wait for the page heading to confirm the React app has fully rendered.
  await expect(page.getByRole('heading', { name: 'Incident Management' })).toBeVisible({
    timeout: 10_000,
  });
});

// ─── Page loads ───────────────────────────────────────────────────────────────

test('incidents page loads with the correct heading', async ({ page }) => {
  // The h1 in IncidentsPage reads "Incident Management".
  await expect(page.getByRole('heading', { name: 'Incident Management' })).toBeVisible();

  // The "Report Incident" primary action button should also be present.
  await expect(
    page.getByRole('button', { name: 'Report Incident' }),
  ).toBeVisible();
});

// ─── Create incident ──────────────────────────────────────────────────────────

test('create incident — fills form, submits, and new incident appears in list', async ({
  page,
}) => {
  const uniqueTitle = `E2E Test Incident ${Date.now()}`;

  // Open the create modal.
  await page.getByRole('button', { name: 'Report Incident' }).click();

  // The modal heading is "Report Security Incident".
  // Give the React re-render up to 12 s to mount the modal.
  await expect(
    page.getByRole('heading', { name: 'Report Security Incident' }),
  ).toBeVisible({ timeout: 12_000 });

  // Fill Title — id="inc-title" is associated with label "Title *"
  await page.getByLabel('Title *').fill(uniqueTitle);

  // Severity — id="inc-severity" associated with label "Severity *"
  await page.getByLabel('Severity *').selectOption('HIGH');

  // Category — id="inc-category" associated with label "Category *"
  await page.getByLabel('Category *').selectOption('phishing');

  // Description — id="inc-description" associated with label "Description *"
  await page.getByLabel('Description *').fill(
    'E2E automated test incident — please ignore. Created by Playwright.',
  );

  // Submit — the submit button inside the modal is also labelled "Report Incident".
  // Scope it to the modal overlay to avoid ambiguity with the page-level button.
  const modal = page.locator('.fixed.inset-0').first();
  await modal.getByRole('button', { name: 'Report Incident' }).click();

  // Modal should close after successful submission.
  await expect(
    page.getByRole('heading', { name: 'Report Security Incident' }),
  ).not.toBeVisible({ timeout: 10_000 });

  // The new incident title should now appear somewhere in the incidents list.
  await expect(page.getByText(uniqueTitle)).toBeVisible({ timeout: 10_000 });
});

// ─── Advance incident status ──────────────────────────────────────────────────

test('advance an open incident from Detected to Triaging', async ({ page }) => {
  // We need an incident in the "detected" state. Create one first.
  const title = `E2E Status Advance ${Date.now()}`;

  await page.getByRole('button', { name: 'Report Incident' }).click();
  // Wait for the modal to mount before filling fields (React state update may be async).
  await expect(
    page.getByRole('heading', { name: 'Report Security Incident' }),
  ).toBeVisible({ timeout: 12_000 });
  await page.getByLabel('Title *').fill(title);
  await page.getByLabel('Severity *').selectOption('MEDIUM');
  await page.getByLabel('Category *').selectOption('other');
  await page.getByLabel('Description *').fill('Created for status advancement E2E test.');

  const modal = page.locator('.fixed.inset-0').first();
  await modal.getByRole('button', { name: 'Report Incident' }).click();
  await expect(
    page.getByRole('heading', { name: 'Report Security Incident' }),
  ).not.toBeVisible({ timeout: 10_000 });

  // Click the newly created incident row to open the detail panel.
  await page.getByText(title).click();

  // The detail panel slides in from the right.  The "Advance to Triaging"
  // button is rendered in the panel footer when the incident is in "detected"
  // status (NEXT_STATUSES maps detected → triaging).
  const advanceButton = page.getByRole('button', { name: 'Advance to Triaging' });
  await expect(advanceButton).toBeVisible({ timeout: 8_000 });
  await advanceButton.click();

  // After advancing, the status badge in the detail panel header should update
  // to "Triaging".  The detail panel re-renders in place (no navigation).
  await expect(page.getByText('Triaging').first()).toBeVisible({ timeout: 8_000 });
});
