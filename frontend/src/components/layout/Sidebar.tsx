'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/stores/auth.store';
import { authApi } from '@/lib/api/auth';
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
  Cpu,
  Upload,
  Files,
  TrendingUp,
  ClipboardCheck,
  GitMerge,
  Lightbulb,
  Clock,
} from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

const NAV = [
  { href: '/overview', label: 'Overview', icon: LayoutDashboard },
  { href: '/journey', label: 'Journey', icon: GitBranch },
  { href: '/controls', label: 'Controls', icon: CheckSquare },
  { href: '/control-library', label: 'Control Library', icon: Library },
  { href: '/evidence', label: 'Evidence', icon: FolderOpen },
  { href: '/policies', label: 'Policies', icon: FileText },
  { href: '/risks', label: 'Risks', icon: AlertTriangle },
  { href: '/tasks', label: 'Tasks', icon: ClipboardList },
  { href: '/scope', label: 'Scope', icon: Target },
  { href: '/readiness', label: 'Readiness', icon: BarChart3 },
  { href: '/gaps', label: 'Gap Analysis', icon: TrendingUp },
  { href: '/audit-checklist', label: 'Audit Checklist', icon: ClipboardCheck },
  { href: '/crosswalk', label: 'Crosswalk', icon: GitMerge },
  { href: '/action-plan', label: 'Action Plan', icon: Lightbulb },
  { href: '/timeline', label: 'Timeline', icon: Clock },
  { href: '/audit-exports', label: 'Audit Exports', icon: Download },
  { href: '/vendors', label: 'Vendors', icon: Building2 },
  { href: '/integrations', label: 'Integrations', icon: Plug },
  { href: '/import', label: 'Import', icon: Upload },
  { href: '/documents', label: 'Documents', icon: Files },
  { href: '/llm-gateway', label: 'LLM Gateway', icon: Cpu },
  { href: '/control-panel', label: 'Control Panel', icon: Zap },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, clearUser } = useAuthStore();
  const [signingOut, setSigningOut] = useState(false);

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
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 py-5 border-b border-gray-100">
        <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center shrink-0">
          <Shield className="w-4 h-4 text-white" />
        </div>
        <span className="text-sm font-bold text-gray-900 truncate">Compliance Copilot</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {NAV.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              'sidebar-link',
              pathname.startsWith(href) && 'active',
            )}
          >
            <Icon className="w-4 h-4 shrink-0" />
            {label}
          </Link>
        ))}
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
