import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronRight, Award } from 'lucide-react';
import { getFrameworkControls } from '@/lib/api/frameworks';
import type { Control } from '@/lib/api/frameworks';

export const metadata: Metadata = {
  title: 'ISO 9001:2015 Quality Management Controls | ComplianceOS',
  description:
    'Browse all ISO 9001:2015 Quality Management System requirements organized by clause — with evidence requirements, policy guidance, and cross-framework mappings.',
};

const CATEGORY_ORDER = [
  'Context',
  'Leadership',
  'Planning',
  'Support',
  'Operation',
  'Performance Evaluation',
  'Improvement',
];

function getCategoryColor(category: string): { bg: string; text: string; border: string } {
  switch (category) {
    case 'Context':               return { bg: 'bg-teal-100',   text: 'text-teal-800',   border: 'border-teal-200'   };
    case 'Leadership':            return { bg: 'bg-emerald-100', text: 'text-emerald-800', border: 'border-emerald-200' };
    case 'Planning':              return { bg: 'bg-cyan-100',   text: 'text-cyan-800',   border: 'border-cyan-200'   };
    case 'Support':               return { bg: 'bg-sky-100',    text: 'text-sky-800',    border: 'border-sky-200'    };
    case 'Operation':             return { bg: 'bg-blue-100',   text: 'text-blue-800',   border: 'border-blue-200'   };
    case 'Performance Evaluation': return { bg: 'bg-indigo-100', text: 'text-indigo-800', border: 'border-indigo-200' };
    case 'Improvement':           return { bg: 'bg-violet-100', text: 'text-violet-800', border: 'border-violet-200' };
    default:                      return { bg: 'bg-gray-100',   text: 'text-gray-800',   border: 'border-gray-200'   };
  }
}

function getClauseNumber(category: string): string {
  switch (category) {
    case 'Context':               return 'Clause 4';
    case 'Leadership':            return 'Clause 5';
    case 'Planning':              return 'Clause 6';
    case 'Support':               return 'Clause 7';
    case 'Operation':             return 'Clause 8';
    case 'Performance Evaluation': return 'Clause 9';
    case 'Improvement':           return 'Clause 10';
    default:                      return '';
  }
}

function groupByCategory(controls: Control[]): { category: string; controls: Control[] }[] {
  const map = new Map<string, Control[]>();
  for (const c of controls) {
    if (!map.has(c.category)) map.set(c.category, []);
    map.get(c.category)!.push(c);
  }
  for (const [, list] of map) {
    list.sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
  }
  const sortedKeys = [...map.keys()].sort((a, b) => {
    const ai = CATEGORY_ORDER.indexOf(a);
    const bi = CATEGORY_ORDER.indexOf(b);
    if (ai === -1 && bi === -1) return a.localeCompare(b);
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });
  return sortedKeys.map(cat => ({ category: cat, controls: map.get(cat)! }));
}

export default async function ISO9001Page() {
  const controls = await getFrameworkControls('iso9001').catch(() => [] as Control[]);
  const groups = groupByCategory(controls);

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-gray-500 mb-6">
        <Link href="/frameworks" className="hover:text-gray-700 transition-colors">Frameworks</Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-gray-800 font-medium">ISO 9001</span>
      </nav>

      {/* Header */}
      <div className="flex items-start gap-5 mb-8">
        <div className="w-14 h-14 rounded-2xl bg-teal-100 flex items-center justify-center flex-shrink-0">
          <Award className="h-7 w-7 text-teal-700" />
        </div>
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-3xl font-bold text-gray-900">ISO 9001</h1>
            <span className="text-sm px-2.5 py-0.5 rounded-full bg-teal-100 text-teal-700 font-medium">
              ISO 9001:2015
            </span>
          </div>
          <p className="text-gray-600 max-w-2xl">
            The international standard for Quality Management Systems (QMS) — specifying requirements for organisations
            to demonstrate their ability to consistently provide products and services that meet customer and regulatory requirements.
          </p>
          <div className="flex items-center gap-4 mt-3 text-sm text-gray-500">
            <span className="font-medium text-teal-700">{controls.length} controls</span>
            <span>•</span>
            <span>{groups.length} clauses</span>
            <span>•</span>
            <span>Cross-mapped to ISO 27001 &amp; SOC 2</span>
          </div>
        </div>
      </div>

      {/* Controls by clause */}
      <div className="space-y-6">
        {groups.map(({ category, controls: groupControls }) => {
          const colors = getCategoryColor(category);
          const clause = getClauseNumber(category);
          return (
            <section key={category} id={category.replace(/\s+/g, '-').toLowerCase()}>
              <div className={`flex items-center gap-2 px-4 py-2.5 rounded-lg ${colors.bg} mb-3`}>
                {clause && (
                  <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${colors.text} opacity-70`}>
                    {clause}
                  </span>
                )}
                <span className={`text-sm font-semibold ${colors.text}`}>{category}</span>
                <span className={`text-xs ${colors.text} opacity-70`}>
                  {groupControls.length} requirements
                </span>
              </div>
              <div className="grid gap-2">
                {groupControls.map(control => (
                  <Link
                    key={control.code}
                    href={`/frameworks/iso9001/controls/${encodeURIComponent(control.code)}`}
                    className={`group flex items-start gap-4 p-4 rounded-xl border ${colors.border} bg-white hover:shadow-sm transition-all`}
                  >
                    <div className={`flex-shrink-0 mt-0.5 text-xs font-mono font-bold px-2 py-1 rounded ${colors.bg} ${colors.text}`}>
                      {control.code}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-gray-800 group-hover:text-teal-700 transition-colors">
                        {control.title}
                      </h3>
                      <p className="text-xs text-gray-500 mt-1 line-clamp-2">{control.description}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-teal-400 flex-shrink-0 mt-1 transition-colors" />
                  </Link>
                ))}
              </div>
            </section>
          );
        })}
      </div>

      {controls.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <p>No ISO 9001 controls available. Check back after seeding the control library.</p>
        </div>
      )}
    </div>
  );
}
