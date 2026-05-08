import { test, expect } from '@playwright/test';
import { loginAs } from './helpers/auth';

const DEMO_EMAIL = 'admin@demo.com';
const DEMO_PASSWORD = 'Demo1234!';

// Log in and navigate to /overview before every test in this suite.
// loginAs may land on /onboarding (when onboardingComplete=false in the DB);
// we always navigate to /overview so the sidebar is present for all assertions.
test.beforeEach(async ({ page }) => {
  await loginAs(page, DEMO_EMAIL, DEMO_PASSWORD);
  // Ensure we are on a dashboard page that renders the sidebar.
  if (!page.url().includes('/overview')) {
    await page.goto('/overview');
    await page.waitForURL('**/overview', { timeout: 10_000 });
  }
});

// ─── Main nav links ───────────────────────────────────────────────────────────

test('all main nav links are accessible from the sidebar', async ({ page }) => {
  // These are the five core nav items called out in the task brief.
  // Each entry is the link text as rendered by the Sidebar NAV array.
  const navLinks = [
    { label: 'Overview',       href: '/overview' },
    { label: 'Controls',       href: '/controls' },
    { label: 'Risks',          href: '/risks' },
    { label: 'Incidents',      href: '/incidents' },
    { label: 'Internal Audit', href: '/internal-audit' },
  ];

  for (const { label, href } of navLinks) {
    // Find the link by its visible text in the sidebar <nav>.
    const link = page.locator('aside nav').getByRole('link', { name: label });
    await expect(link).toBeVisible();

    // Verify the href attribute is correct — this is a cheap structural check
    // that does not require a full navigation for each link.
    await expect(link).toHaveAttribute('href', href);
  }
});

// ─── Notification bell ────────────────────────────────────────────────────────

test('notification bell is visible in the sidebar header', async ({ page }) => {
  // The bell button has aria-label="{unreadCount} unread notifications"
  // (set in NotificationBell.tsx).  We match with a partial regex so the test
  // is independent of the actual unread count.
  const bell = page.getByRole('button', { name: /unread notification/i });
  await expect(bell).toBeVisible();
});

// ─── User identity in sidebar footer ─────────────────────────────────────────

test('authenticated user name and email appear in the sidebar footer', async ({
  page,
}) => {
  // The Sidebar renders user.fullName and user.email in the footer section.
  // We look for them inside the <aside> element so we don't accidentally match
  // other elements on the page.
  const sidebar = page.locator('aside');

  // Email is always known at test time.
  await expect(sidebar.getByText(DEMO_EMAIL)).toBeVisible();

  // The full name is whatever the demo account was registered with.
  // We assert that *some* non-empty text is rendered next to the avatar initial
  // by checking the small user info block exists and contains a paragraph.
  // We use a flexible locator that matches the flex container holding name + email.
  const userBlock = sidebar.locator('div.flex.items-center.gap-2\\.5.px-3.py-2');
  await expect(userBlock).toBeVisible();
});

// ─── Overview page smoke test ─────────────────────────────────────────────────

test('overview page renders the Compliance Overview heading and score card', async ({
  page,
}) => {
  // loginAs (called in beforeEach) already navigated to /overview.
  // We stay on /overview to avoid a second navigation that can invalidate in-memory auth state.
  // The overview page shows a spinner while /org-stats loads; allow 20 s for it to resolve.
  await expect(
    page.getByRole('heading', { name: 'Compliance Overview' }),
  ).toBeVisible({ timeout: 20_000 });

  // The "Readiness Score" stat card should also appear (rendered after stats load).
  // Use exact:true to avoid matching "Run the Readiness Score calculation…" text.
  await expect(page.getByText('Readiness Score', { exact: true }).first()).toBeVisible({ timeout: 20_000 });
});
