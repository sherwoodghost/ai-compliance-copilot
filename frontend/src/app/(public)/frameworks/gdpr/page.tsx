import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronRight, Shield } from 'lucide-react';
import { getFrameworkControls } from '@/lib/api/frameworks';
import type { Control } from '@/lib/api/frameworks';

export const metadata: Metadata = {
  title: 'GDPR Controls Reference | ComplianceOS',
  description:
    'Browse all GDPR (General Data Protection Regulation) controls organized by Article group — with evidence requirements, policy guidance, and cross-framework mappings.',
};

// GDPR category display order
const CATEGORY_ORDER = [
  'Principles',
  'Controller Obligations',
  'Data Subject Rights',
  'Processor Relations',
  'Security',
  'Breach Notification',
  'DPIA',
  'DPO',
  'International Transfers',
  'Enforcement',
];

function getCategoryColor(category: string): { bg: string; text: string; border: string } {
  switch (category) {
    case 'Principles':                return { bg: 'bg-violet-100', text: 'text-violet-800', border: 'border-violet-200' };
    case 'Controller Obligations':    return { bg: 'bg-purple-100', text: 'text-purple-800', border: 'border-purple-200' };
    case 'Data Subject Rights':       return { bg: 'bg-blue-100',   text: 'text-blue-800',   border: 'border-blue-200'   };
    case 'Processor Relations':       return { bg: 'bg-indigo-100', text: 'text-indigo-800', border: 'border-indigo-200' };
    case 'Security':                  return { bg: 'bg-red-100',    text: 'text-red-800',    border: 'border-red-200'    };
    case 'Breach Notification':       return { bg: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-200' };
    case 'DPIA':                      return { bg: 'bg-amber-100',  text: 'text-amber-800',  border: 'border-amber-200'  };
    case 'DPO':                       return { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-200' };
    case 'International Transfers':   return { bg: 'bg-cyan-100',   text: 'text-cyan-800',   border: 'border-cyan-200'   };
    case 'Enforcement':               return { bg: 'bg-rose-100',   text: 'text-rose-800',   border: 'border-rose-200'   };
    default:                          return { bg: 'bg-gray-100',   text: 'text-gray-800',   border: 'border-gray-200'   };
  }
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

export default async function GdprPage() {
  const controls = await getFrameworkControls('gdpr').catch(() => [] as Control[]);
  const groups = groupByCategory(controls);

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-gray-500 mb-6">
        <Link href="/frameworks" className="hover:text-gray-700 transition-colors">Frameworks</Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-gray-800 font-medium">GDPR</span>
      </nav>

      {/* Header */}
      <div className="flex items-start gap-5 mb-8">
        <div className="w-14 h-14 rounded-2xl bg-violet-100 flex items-center justify-center flex-shrink-0">
          <Shield className="h-7 w-7 text-violet-700" />
        </div>
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-3xl font-bold text-gray-900">GDPR</h1>
            <span className="text-sm px-2.5 py-0.5 rounded-full bg-violet-100 text-violet-700 font-medium">
              Regulation (EU) 2016/679
            </span>
          </div>
          <p className="text-gray-600 max-w-2xl">
            The General Data Protection Regulation — Europe&apos;s comprehensive data protection law governing how personal
            data of EU residents is collected, processed, and stored. Applies to any organisation handling EU personal data.
          </p>
          <div className="flex items-center gap-4 mt-3 text-sm text-gray-500">
            <span className="font-medium text-violet-700">{controls.length} controls</span>
            <span>•</span>
            <span>{groups.length} Article groups</span>
            <span>•</span>
            <span>Cross-mapped to ISO 27001 &amp; SOC 2</span>
          </div>
        </div>
      </div>

      {/* Controls by category */}
      <div className="space-y-6">
        {groups.map(({ category, controls: groupControls }) => {
          const colors = getCategoryColor(category);
          return (
            <section key={category} id={category.replace(/\s+/g, '-').toLowerCase()}>
              <div className={`flex items-center gap-2 px-4 py-2.5 rounded-lg ${colors.bg} mb-3`}>
                <span className={`text-sm font-semibold ${colors.text}`}>{category}</span>
                <span className={`text-xs px-1.5 py-0.5 rounded ${colors.text} opacity-70`}>
                  {groupControls.length} controls
                </span>
              </div>
              <div className="grid gap-2">
                {groupControls.map(control => (
                  <Link
                    key={control.code}
                    href={`/frameworks/gdpr/controls/${encodeURIComponent(control.code)}`}
                    className={`group flex items-start gap-4 p-4 rounded-xl border ${colors.border} bg-white hover:shadow-sm transition-all`}
                  >
                    <div className={`flex-shrink-0 mt-0.5 text-xs font-mono font-bold px-2 py-1 rounded ${colors.bg} ${colors.text}`}>
                      {control.code}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-gray-800 group-hover:text-violet-700 transition-colors">
                          {control.title}
                        </h3>
                      </div>
                      <p className="text-xs text-gray-500 mt-1 line-clamp-2">{control.description}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-violet-400 flex-shrink-0 mt-1 transition-colors" />
                  </Link>
                ))}
              </div>
            </section>
          );
        })}
      </div>

      {controls.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <p>No GDPR controls available. Check back after seeding the control library.</p>
        </div>
      )}
    </div>
  );
}
