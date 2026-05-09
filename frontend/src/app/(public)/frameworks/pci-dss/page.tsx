import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { getFrameworkControls } from '@/lib/api/frameworks';
import type { Control } from '@/lib/api/frameworks';
import ControlSearch from '../soc2/ControlSearch';
import { getCategoryColor } from '../soc2/colors';

export const metadata: Metadata = {
  title: 'PCI DSS v4.0 Controls | ComplianceOS',
  description:
    'Browse all PCI DSS v4.0 controls organized by the 12 Requirements — from network security and cardholder data protection to penetration testing and incident response.',
};

// Display order for PCI DSS requirement groups
const CATEGORY_ORDER = [
  'Network Security Controls',
  'Secure Configurations',
  'Protect Stored Account Data',
  'Cardholder Data in Transit',
  'Malware Protection',
  'Secure Development',
  'Access Control',
  'Authentication',
  'Physical Access',
  'Logging and Monitoring',
  'Security Testing',
  'Information Security Policy',
];

function sortCategories(categories: string[]): string[] {
  return [...categories].sort((a, b) => {
    const ai = CATEGORY_ORDER.indexOf(a);
    const bi = CATEGORY_ORDER.indexOf(b);
    if (ai === -1 && bi === -1) return a.localeCompare(b);
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });
}

function groupByCategory(controls: Control[]): { category: string; controls: Control[] }[] {
  const map = new Map<string, Control[]>();
  for (const c of controls) {
    if (!map.has(c.category)) map.set(c.category, []);
    map.get(c.category)!.push(c);
  }
  for (const [, list] of map) {
    list.sort((a, b) => a.code.localeCompare(b.code));
  }
  const sortedKeys = sortCategories(Array.from(map.keys()));
  return sortedKeys.map((cat) => ({ category: cat, controls: map.get(cat)! }));
}

export default async function PciDssPage() {
  const controls = await getFrameworkControls('pci-dss').catch(() => [] as Control[]);
  const grouped  = groupByCategory(controls);

  return (
    <div className="bg-gray-50 min-h-screen">
      {/* ── Header ── */}
      <section className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-10">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-1 text-xs text-gray-400 mb-4">
            <Link href="/frameworks" className="hover:text-gray-600 transition-colors">
              Frameworks
            </Link>
            <ChevronRight className="w-3 h-3" />
            <span className="text-gray-600 font-medium">PCI DSS</span>
          </nav>

          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div>
              <span className="inline-block text-xs font-semibold bg-amber-100 text-amber-700 px-2.5 py-1 rounded-full mb-3">
                PCI DSS v4.0 — March 2022
              </span>
              <h1 className="text-3xl font-bold text-gray-900">PCI DSS v4.0</h1>
              <p className="text-gray-500 mt-2 max-w-2xl leading-relaxed">
                The Payment Card Industry Data Security Standard defines {controls.length || 50} controls
                across {grouped.length} requirement groups for any organization that stores, processes,
                or transmits payment card data — from network security to incident response.
              </p>
            </div>
            <div className="flex gap-4 text-center shrink-0">
              <div className="bg-gray-50 rounded-lg px-4 py-2 border border-gray-200">
                <p className="text-2xl font-bold text-gray-900">{controls.length || 50}</p>
                <p className="text-xs text-gray-500">Controls</p>
              </div>
              <div className="bg-gray-50 rounded-lg px-4 py-2 border border-gray-200">
                <p className="text-2xl font-bold text-gray-900">12</p>
                <p className="text-xs text-gray-500">Requirements</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-6 py-8 flex gap-8">
        {/* ── Sticky sidebar TOC ── */}
        <aside className="hidden lg:block w-56 shrink-0">
          <div className="sticky top-20">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
              Requirement Groups
            </p>
            <nav className="space-y-0.5">
              {grouped.map(({ category, controls: cats }) => {
                const color = getCategoryColor(category);
                return (
                  <a
                    key={category}
                    href={`#cat-${category.replace(/\s+/g, '-')}`}
                    className="flex items-center gap-2 text-xs text-gray-600 hover:text-gray-900 py-1 px-2 rounded hover:bg-gray-100 transition-colors group"
                  >
                    <div className={`w-1.5 h-1.5 rounded-full ${color.dot} shrink-0`} />
                    <span className="truncate flex-1">{category}</span>
                    <span className="text-gray-400 text-xs font-medium shrink-0">
                      {cats.length}
                    </span>
                  </a>
                );
              })}
            </nav>
          </div>
        </aside>

        {/* ── Main content ── */}
        <div className="flex-1 min-w-0">
          {controls.length === 0 ? (
            <div className="text-center py-20 text-gray-400">
              <p className="text-sm">Unable to load controls. Please try again later.</p>
            </div>
          ) : (
            <ControlSearch controls={controls} groupedCategories={grouped} />
          )}
        </div>
      </div>
    </div>
  );
}
