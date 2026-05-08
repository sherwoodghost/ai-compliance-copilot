'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/stores/auth.store';
import { authApi } from '@/lib/api/auth';
import { useQuery } from '@tanstack/react-query';
import { complianceApi } from '@/lib/api/compliance';
import { apiClient as api } from '@/lib/api/client';
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
  Bell,
  Rocket,
  UserCircle2,
  Activity,
} from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { teamApi } from '@/lib/api/team';

const NAV = [
  { href: '/overview',         label: 'Overview',        icon: LayoutDashboard },
  { href: '/getting-started',  label: 'Getting Started', icon: Rocket,       badge: 'guided' },
  { href: '/journey',          label: 'Journey',         icon: GitBranch },
  { href: '/controls',         label: 'Controls',        icon: CheckSquare },
  { href: '/control-library',  label: 'Control Library', icon: Library },
  { href: '/evidence',         label: 'Evidence',        icon: FolderOpen },
  { href: '/policies',         label: 'Policies',        icon: FileText },
  { href: '/risks',            label: 'Risks',           icon: AlertTriangle },
  { href: '/tasks',            label: 'Tasks',           icon: ClipboardList },
  { href: '/members',          label: 'Team',            icon: UserCircle2 },
  { href: '/control-effectiveness', label: 'Effectiveness', icon: Activity },
  { href: '/scope',            label: 'Scope',           icon: Target },
  { href: '/readiness',        label: 'Readiness',       icon: BarChart3 },
  { href: '/audit-exports',    label: 'Audit Exports',   icon: Download },
  { href: '/vendors',          label: 'Vendors',         icon: Building2 },
  { href: '/integrations',     label: 'Integrations',    icon: Plug },
  { href: '/trust-center',     label: 'Trust Center',    icon: Globe },
  { href: '/control-panel',    label: 'Workflows',       icon: Zap },
  { href: '/controls/exceptions', label: 'Exceptions',   icon: ShieldAlert },
  { href: '/auditor-portal',   label: 'Auditor Portal',  icon: Users },
  { href: '/audit-history',    label: 'Audit Memory',    icon: BookOpen },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, clearUser } = useAuthStore();
  const [signingOut, setSigningOut] = useState(false);

  // Notification counts — polled every 5 minutes
  const { data: expiryReport } = useQuery({
    queryKey: ['sidebar-expiry'],
    queryFn: complianceApi.getExpiryReport,
    refetchInterval: 5 * 60 * 1000,
    staleTime: 2 * 60 * 1000,
  });
  const { data: taskStats } = useQuery({
    queryKey: ['sidebar-task-stats'],
    queryFn: complianceApi.getTaskStats,
    refetchInterval: 5 * 60 * 1000,
    staleTime: 2 * 60 * 1000,
  });
  const { data: guidedProgram } = useQuery({
    queryKey: ['guided-program', false],
    queryFn: () => teamApi.getGuidedProgram(false),
    refetchInterval: 5 * 60 * 1000,
    staleTime: 2 * 60 * 1000,
  });

  const expiredCount  = (expiryReport as any)?.expired?.length ?? 0;
  const expiringCount = (expiryReport as any)?.expiringSoon?.length ?? 0;
  const overdueCount  = (taskStats as any)?.overdue ?? 0;
  const totalAlerts   = expiredCount + expiringCount + overdueCount;
  const guidedPending = ((guidedProgram as any)?.thisWeek?.length ?? 0) + ((guidedProgram as any)?.stats?.inProgress ?? 0);

  async function handleSignOut() {
    setSigningOut(true);
    try { await authApi.logout(); } catch {}
    clearUser();
    router.push('/login');
  }

  return (
    <aside
      className="flex flex-col bg-white border-r border-gray-200 shrink-0"
      style={{ width: 'var(--sidebar-width)' }}
    >
      {/* Logo + notification bell */}
      <div className="flex items-center justify-between px-4 py-5 border-b border-gray-100">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center shrink-0">
            <Shield className="w-4 h-4 text-white" />
          </div>
          <span className="text-sm font-bold text-gray-900 truncate">Compliance Copilot</span>
        </div>
        {/* Alert bell */}
        {totalAlerts > 0 && (
          <Link
            href="/evidence"
            title={`${expiredCount > 0 ? `${expiredCount} expired evidence, ` : ''}${expiringCount > 0 ? `${expiringCount} expiring soon, ` : ''}${overdueCount > 0 ? `${overdueCount} overdue tasks` : ''}`.replace(/, $/, '')}
            className="relative shrink-0 w-7 h-7 rounded-lg hover:bg-red-50 flex items-center justify-center transition-colors"
          >
            <Bell className="w-4 h-4 text-red-500" />
            <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-3.5 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-0.5 leading-none">
              {totalAlerts > 9 ? '9+' : totalAlerts}
            </span>
          </Link>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {NAV.map(({ href, label, icon: Icon, badge }) => {
          const isActive =
            href === '/controls'
              ? pathname === '/controls' || /^\/controls\/[0-9a-f-]{36}/.test(pathname)
              : pathname.startsWith(href);
          const badgeCount = badge === 'guided' && guidedPending > 0 ? guidedPending : 0;
          return (
            <Link
              key={href}
              href={href}
              className={cn('sidebar-link', isActive && 'active')}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="flex-1 truncate">{label}</span>
              {badgeCount > 0 && (
                <span className="ml-auto min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 leading-none shrink-0">
                  {badgeCount > 99 ? '99+' : badgeCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* User footer */}
      <div className="border-t border-gray-100 px-3 py-3 space-y-0.5">
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
        <div className="flex items-center gap-2.5 px-3 py-2 mt-1">
          <div className="w-6 h-6 rounded-full bg-brand-100 flex items-center justify-center shrink-0">
            <span className="text-xs font-bold text-brand-700">
              {user?.fullName?.[0] ?? '?'}
            </span>
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-gray-900 truncate">{user?.fullName}</p>
            <p className="text-xs text-gray-400 truncate">{user?.email}</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
