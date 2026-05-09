import Link from 'next/link';
import { Shield } from 'lucide-react';

export default function FrameworksLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* ── Header ── */}
      <header className="border-b border-gray-200 bg-white sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          {/* Logo */}
          <Link href="/frameworks" className="flex items-center gap-2 group">
            <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center">
              <Shield className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold text-gray-900 group-hover:text-brand-600 transition-colors">
              ComplianceOS
            </span>
          </Link>

          {/* Nav */}
          <nav className="flex items-center gap-1">
            <Link
              href="/frameworks"
              className="px-3 py-1.5 rounded-md text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
            >
              Frameworks
            </Link>
            <Link
              href="/frameworks/iso27001"
              className="px-3 py-1.5 rounded-md text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
            >
              ISO 27001
            </Link>
            <Link
              href="/frameworks/soc2"
              className="px-3 py-1.5 rounded-md text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
            >
              SOC 2
            </Link>
            <Link
              href="/frameworks/crosswalks"
              className="px-3 py-1.5 rounded-md text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
            >
              Crosswalks
            </Link>
          </nav>
        </div>
      </header>

      {/* ── Page content ── */}
      <main className="flex-1">{children}</main>

      {/* ── Footer ── */}
      <footer className="border-t border-gray-200 bg-gray-50 mt-16">
        <div className="max-w-7xl mx-auto px-6 py-8 flex flex-col md:flex-row items-center justify-between gap-3 text-sm text-gray-500">
          <p>
            &copy; {new Date().getFullYear()} ComplianceOS — Compliance Framework Reference
          </p>
          <p className="text-xs text-gray-400">
            Control data sourced from official AICPA and ISO publications. For informational use only.
          </p>
        </div>
      </footer>
    </div>
  );
}
