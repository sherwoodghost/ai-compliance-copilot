'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Cookies from 'js-cookie';
import { Shield, Terminal } from 'lucide-react';

export default function InternalLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter();
  const pathname = usePathname();
  const isLoginPage = pathname === '/internal/login';

  const [checking, setChecking] = useState(true);
  const [authed, setAuthed]     = useState(false);

  useEffect(() => {
    // Don't redirect when we're already on the login page
    if (isLoginPage) {
      setChecking(false);
      return;
    }
    const token = Cookies.get('internal_token');
    if (!token) {
      router.replace('/internal/login');
    } else {
      setAuthed(true);
    }
    setChecking(false);
  }, [router, isLoginPage]);

  // Login page renders without the sidebar shell
  if (isLoginPage) return <>{children}</>;

  if (checking) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!authed) return null;

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex">
      {/* Sidebar */}
      <aside className="w-56 bg-gray-900 border-r border-gray-800 flex flex-col shrink-0">
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-4 py-5 border-b border-gray-800">
          <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center">
            <Shield className="w-3.5 h-3.5 text-white" />
          </div>
          <div>
            <p className="text-xs font-bold text-white">Command Center</p>
            <p className="text-[10px] text-gray-500">Internal Only</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 py-4 space-y-0.5">
          {[
            { href: '/internal', label: 'Dashboard' },
            { href: '/internal/agents', label: 'Agent Registry' },
            { href: '/internal/workflows', label: 'Workflows' },
            { href: '/internal/prompts', label: 'Prompt Lab' },
            { href: '/internal/observability', label: 'Observability' },
            { href: '/internal/customers', label: 'Customers' },
            { href: '/internal/costs', label: 'Cost Tracker' },
          ].map(({ href, label }) => (
            <a
              key={href}
              href={href}
              className="flex items-center gap-2 px-3 py-2 text-sm text-gray-400 hover:text-white
                         hover:bg-gray-800 rounded-lg transition-colors"
            >
              <Terminal className="w-3.5 h-3.5" />
              {label}
            </a>
          ))}
        </nav>

        <div className="border-t border-gray-800 px-4 py-3">
          <p className="text-[10px] text-gray-600 uppercase tracking-widest">Platform Admin</p>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
