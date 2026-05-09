import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { getFrameworkControls } from '@/lib/api/frameworks';
import type { Control } from '@/lib/api/frameworks';
import ControlSearch, { getCategoryColor } from './ControlSearch';

export const metadata: Metadata = {
  title: 'SOC 2 Trust Services Criteria | ComplianceOS',
  description:
    'Browse all 68 SOC 2 Trust Services Criteria controls organized by category — with evidence requirements, policy guidance, and ISO 27001 crosswalks.',
};

// Desired display order for categories
const CATEGORY_ORDER = [
  'CC1', 'CC2', 'CC3', 'CC4', 'CC5', 'CC6', 'CC7', 'CC8', 'CC9',
  'A1', 'C1', 'PI1',
  'P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8',
];

function sortCategories(categories: string[]): string[] {
  return [...categories].sort((a, b) => {
    const aPrefix = a.split(' ')[0] ?? a;
    const bPrefix = b.split(' ')[0] ?? b;
    const ai = CATEGORY_ORDER.findIndex((p) => aPrefix.startsWith(p));
    const bi = CATEGORY_ORDER.findIndex((p) => bPrefix.startsWith(p));
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
  // Sort controls within each category by code
  for (const [, list] of map) {
    list.sort((a, b) => a.code.localeCompare(b.code));
  }
  const sortedKeys = sortCategories(Array.from(map.keys()));
  return sortedKeys.map((cat) => ({ category: cat, controls: map.get(cat)! }));
}

export default async function SOC2Page() {
  const controls = await getFrameworkControls('soc2').catch(() => [] as Control[]);
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
            <span className="text-gray-600 font-medium">SOC 2</span>
          </nav>

          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div>
              <span className="inline-block text-xs font-semibold bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-full mb-3">
                Trust Services Criteria 2017
              </span>
              <h1 className="text-3xl font-bold text-gray-900">SOC 2 Trust Services Criteria</h1>
              <p className="text-gray-500 mt-2 max-w-2xl leading-relaxed">
                The AICPA&apos;s Trust Services Criteria defines {controls.length || 68} controls for
                service organizations across {grouped.length} categories — covering security,
                availability, processing integrity, confidentiality, and privacy.
              </p>
            </div>
            <div className="flex gap-4 text-center shrink-0">
              <div className="bg-gray-50 rounded-lg px-4 py-2 border border-gray-200">
                <p className="text-2xl font-bold text-gray-900">{controls.length || 68}</p>
                <p className="text-xs text-gray-500">Controls</p>
              </div>
              <div className="bg-gray-50 rounded-lg px-4 py-2 border border-gray-200">
                <p className="text-2xl font-bold text-gray-900">{grouped.length || 9}</p>
                <p className="text-xs text-gray-500">Categories</p>
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
              Categories
            </p>
            <nav className="space-y-0.5">
              {grouped.map(({ category, controls: cats }) => {
                const color = getCategoryColor(category);
                const prefix = category.split(' ')[0] ?? category;
                return (
                  <a
                    key={category}
                    href={`#cat-${category.replace(/\s+/g, '-')}`}
                    className="flex items-center gap-2 text-xs text-gray-600 hover:text-gray-900 py-1 px-2 rounded hover:bg-gray-100 transition-colors group"
                  >
                    <div className={`w-1.5 h-1.5 rounded-full ${color.dot} shrink-0`} />
                    <span className="truncate flex-1">{prefix}</span>
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
