'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/stores/auth.store';
import { authApi } from '@/lib/api/auth';
import { useQuery } from '@tanstack/react-query';
import {
  Shield,
  LayoutDashboard,
  CheckSquare,
  FileText,
  FolderOpen,
  ClipboardList,
  Settings,
  LogOut,
  Zap,
  AlertTriangle,
  Plug,
  Building2,
  GitBranch,
  Library,
  Target,
  BarChart3,
  Download,
  Globe,
  ShieldAlert,
  Users,
  BookOpen,
  Rocket,
  UserCircle2,
  Activity,
  Siren,
  ChevronDown,
  ClipboardCheck,
  ScrollText,
  Cpu,
  Menu,
  X,
  Map,
} from 'lucide-react';
import { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { teamApi } from '@/lib/api/team';
import { NotificationBell } from './NotificationBell';
import { useActiveFrameworks } from '@/lib/hooks/useActiveFrameworks';
import { getActiveNavGroups, type NavGroupSpec } from '@/lib/dashboard/framework-registry';

type NavItem = { href: string; label: string; icon: React.ElementType; badge?: string };
type NavGroup = { label: string; items: NavItem[] };

/** Resolve icon name string (from framework registry) → Lucide component */
const ICON_MAP: Record<string, React.ElementType> = {
  FileText, Users, ShieldAlert, Siren, AlertTriangle,
  ClipboardCheck, Target, ScrollText, Shield, BarChart3,
  Activity, BookOpen, Download, Globe, CheckSquare, Library,
  FolderOpen, ClipboardList, Building2, Plug, Zap, GitBranch,
  LayoutDashboard, Rocket, UserCircle2, Map,
};

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Home',
    items: [
      { href: '/overview',        label: 'Overview',        icon: LayoutDashboard },
      { href: '/getting-started', label: 'Getting Started', icon: Rocket,       badge: 'guided' },
      { href: '/journey',         label: 'Journey',         icon: GitBranch },
    ],
  },
  {
    label: 'Compliance',
    items: [
      { href: '/controls',        label: 'Controls',        icon: CheckSquare },
      { href: '/control-library', label: 'Control Library', icon: Library },
      { href: '/evidence',        label: 'Evidence',        icon: FolderOpen },
      { href: '/risks',           label: 'Risks',           icon: AlertTriangle },
      { href: '/incidents',       label: 'Incidents',       icon: Siren,  badge: 'incidents' },
      { href: '/frameworks',      label: 'Frameworks',      icon: Map },
    ],
  },
  {
    label: 'Documents',
    items: [
      { href: '/policies',        label: 'Policies',        icon: FileText },
      { href: '/documents',       label: 'Documents',       icon: BookOpen },
      { href: '/ingestion',       label: 'Import Docs',     icon: Download },
    ],
  },
  {
    label: 'Work',
    items: [
      { href: '/tasks',           label: 'Tasks',           icon: ClipboardList },
      { href: '/members',         label: 'Team',            icon: UserCircle2 },
    ],
  },
  {
    label: 'Reports',
    items: [
      { href: '/control-effectiveness', label: 'Effectiveness', icon: Activity },
      { href: '/readiness',       label: 'Readiness',       icon: BarChart3 },
      { href: '/audit-exports',   label: 'Audit Exports',   icon: Download },
      { href: '/internal-audit',  label: 'Internal Audit',  icon: ClipboardCheck },
      { href: '/audit-history',   label: 'Audit Memory',    icon: ScrollText },
    ],
  },
  {
    label: 'Integrations',
    items: [
      { href: '/vendors',         label: 'Vendors',         icon: Building2 },
      { href: '/integrations',    label: 'Integrations',    icon: Plug },
      { href: '/trust-center',    label: 'Trust Center',    icon: Globe },
    ],
  },
  {
    label: 'Advanced',
    items: [
      { href: '/scope',           label: 'Scope',           icon: Target },
      { href: '/control-panel',   label: 'Workflows',       icon: Cpu },
      { href: '/controls/exceptions', label: 'Exceptions',  icon: ShieldAlert },
      { href: '/auditor-portal',  label: 'Auditor Portal',  icon: Users },
    ],
  },
];

/** Mobile-accessible hamburger trigger — rendered in the main content area on small screens */
export function MobileMenuButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="md:hidden fixed top-3 left-3 z-50 w-9 h-9 rounded-lg bg-white border border-gray-200 shadow-sm flex items-center justify-center text-gray-600 hover:bg-gray-50"
      aria-label="Open navigation"
    >
      <Menu className="w-4 h-4" />
    </button>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, clearUser } = useAuthStore();
  const [signingOut, setSigningOut] = useState(false);
  // Mobile open state
  const [mobileOpen, setMobileOpen] = useState(false);
  // Collapsed groups — start with "Advanced" collapsed; framework groups start collapsed too
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set(['Advanced', 'GDPR', 'ISO 9001', 'ISO 14001', 'ISO 45001', 'HIPAA', 'PCI DSS', 'FedRAMP', 'NIST CSF']));

  // Dynamic framework nav groups — only shown when the framework is active for this org
  const { data: frameworks = [] } = useActiveFrameworks();
  const dynamicGroups = useMemo((): NavGroup[] => {
    const rawGroups = getActiveNavGroups(frameworks);
    return rawGroups.map((g: NavGroupSpec) => ({
      label: g.label,
      items: g.items.map(item => ({
        href:  item.href,
        label: item.label,
        icon:  ICON_MAP[item.icon] ?? FileText,
      })),
    }));
  }, [frameworks]);

  // Close mobile nav on route change
  if (typeof window !== 'undefined') {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    // NOTE: pathname change will cause re-render; closing here is fine
  }

  // Guided program badge count
  const { data: guidedProgram } = useQuery({
    queryKey: ['guided-program', false],
    queryFn: () => teamApi.getGuidedProgram(false),
    refetchInterval: 5 * 60 * 1000,
    staleTime: 2 * 60 * 1000,
  });

  const guidedPending = ((guidedProgram as any)?.thisWeek?.length ?? 0) + ((guidedProgram as any)?.stats?.inProgress ?? 0);

  // Incident badge — critical/high open incidents
  const { data: incidentMetrics } = useQuery({
    queryKey: ['incident-metrics'],
    queryFn:  () => teamApi.getIncidentMetrics(),
    refetchInterval: 2 * 60 * 1000,
    staleTime: 60 * 1000,
  });

  const criticalIncidents: number = (incidentMetrics as any)?.bySeverity
    ?.filter((s: any) => (s.severity === 'CRITICAL' || s.severity === 'HIGH') && s.open > 0)
    ?.reduce((acc: number, s: any) => acc + s.open, 0) ?? 0;

  async function handleSignOut() {
    setSigningOut(true);
    try { await authApi.logout(); } catch {}
    clearUser();
    router.push('/login');
  }

  function toggleGroup(label: string) {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  }

  function isGroupActive(items: NavItem[]) {
    return items.some(({ href }) =>
      href === '/controls'
        ? pathname === '/controls' || /^\/controls\/[0-9a-f-]{36}/.test(pathname)
        : pathname.startsWith(href)
    );
  }

  return (
    <>
      {/* Mobile hamburger button (shown outside sidebar) */}
      <button
        onClick={() => setMobileOpen(true)}
        className="md:hidden fixed top-3 left-3 z-50 w-9 h-9 rounded-lg bg-white border border-gray-200 shadow-sm flex items-center justify-center text-gray-600 hover:bg-gray-50"
        aria-label="Open navigation"
      >
        <Menu className="w-4 h-4" />
      </button>

      {/* Mobile overlay backdrop */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        />
      )}

    <aside
      className={cn(
        'flex flex-col bg-white border-r border-gray-200 shrink-0 transition-transform duration-300',
        // Desktop: always visible
        'md:relative md:translate-x-0 md:z-auto',
        // Mobile: fixed overlay, slide in/out
        'fixed inset-y-0 left-0 z-50',
        mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
      )}
      style={{ width: 'var(--sidebar-width)' }}
    >
      {/* Logo + notification bell */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center shrink-0 shadow-sm">
            <Shield className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0">
            <span className="text-sm font-bold text-gray-900 truncate block">Compliance Copilot</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <NotificationBell />
          {/* Close button — only shown on mobile */}
          <button
            onClick={() => setMobileOpen(false)}
            className="md:hidden w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            aria-label="Close navigation"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Nav groups */}
      <nav className="flex-1 px-2 py-3 overflow-y-auto scrollbar-thin">
        {[...NAV_GROUPS, ...dynamicGroups].map(({ label, items }) => {
          const isCollapsed = collapsed.has(label);
          const hasActive = isGroupActive(items);
          // Auto-expand group if a child is active
          const effectivelyCollapsed = isCollapsed && !hasActive;

          return (
            <div key={label} className="mb-1">
              <button
                onClick={() => toggleGroup(label)}
                className={cn(
                  'w-full flex items-center justify-between px-3 py-1.5 rounded-md text-xs font-semibold uppercase tracking-wider transition-colors',
                  hasActive
                    ? 'text-brand-600'
                    : 'text-gray-400 hover:text-gray-600'
                )}
              >
                {label}
                <ChevronDown
                  className={cn('w-3 h-3 transition-transform duration-150', effectivelyCollapsed && '-rotate-90')}
                />
              </button>

              {!effectivelyCollapsed && (
                <div className="space-y-0.5 mt-0.5">
                  {items.map(({ href, label: itemLabel, icon: Icon, badge }) => {
                    const isActive =
                      href === '/controls'
                        ? pathname === '/controls' || /^\/controls\/[0-9a-f-]{36}/.test(pathname)
                        : pathname.startsWith(href);
                    const badgeCount =
                      badge === 'guided'    && guidedPending     > 0 ? guidedPending :
                      badge === 'incidents' && criticalIncidents > 0 ? criticalIncidents :
                      0;
                    return (
                      <Link
                        key={href}
                        href={href}
                        className={cn('sidebar-link', isActive && 'active')}
                      >
                        <Icon className="w-4 h-4 shrink-0" />
                        <span className="flex-1 truncate">{itemLabel}</span>
                        {badgeCount > 0 && (
                          <span className="ml-auto min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 leading-none shrink-0">
                            {badgeCount > 99 ? '99+' : badgeCount}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* User footer */}
      <div className="border-t border-gray-100 px-2 py-2">
        <Link href="/settings" className="sidebar-link">
          <Settings className="w-4 h-4 shrink-0" />
          Settings
        </Link>
        <button
          className="sidebar-link w-full text-left"
          onClick={handleSignOut}
          disabled={signingOut}
        >
          <LogOut className="w-4 h-4 shrink-0" />
          Sign out
        </button>
        <div className="flex items-center gap-2.5 px-3 py-2 mt-1 rounded-lg">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center shrink-0 shadow-sm">
            <span className="text-xs font-bold text-white">
              {user?.fullName?.[0] ?? '?'}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-gray-900 truncate">{user?.fullName}</p>
            <p className="text-xs text-gray-400 truncate">{user?.email}</p>
          </div>
        </div>
      </div>
    </aside>
    </>
  );
}
