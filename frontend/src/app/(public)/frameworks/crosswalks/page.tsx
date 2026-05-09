import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronRight, GitMerge } from 'lucide-react';
import { getFrameworkControls, getControlCrosswalks } from '@/lib/api/frameworks';
import type { CrosswalkMapping } from '@/lib/api/frameworks';
import CrosswalkTable from './CrosswalkTable';

export const metadata: Metadata = {
  title: 'SOC 2 ↔ ISO 27001 Crosswalks | ComplianceOS',
  description:
    'See how SOC 2 Trust Services Criteria map to ISO/IEC 27001:2022 Annex A controls — with mapping types and confidence levels for all 75 cross-framework mappings.',
};

async function fetchAllCrosswalks(): Promise<CrosswalkMapping[]> {
  try {
    const soc2Controls = await getFrameworkControls('soc2');
    if (soc2Controls.length === 0) return [];

    // Fetch crosswalks for each SOC2 control in parallel (batched)
    const BATCH = 10;
    const allMappings: CrosswalkMapping[] = [];
    const seen = new Set<string>();

    for (let i = 0; i < soc2Controls.length; i += BATCH) {
      const batch   = soc2Controls.slice(i, i + BATCH);
      const results = await Promise.allSettled(
        batch.map((c) => getControlCrosswalks(c.code)),
      );
      for (const r of results) {
        if (r.status !== 'fulfilled') continue;
        for (const m of r.value) {
          // Deduplicate by source+target pair
          const key = `${m.sourceCode}:${m.targetCode}`;
          if (!seen.has(key)) {
            seen.add(key);
            allMappings.push(m);
          }
        }
      }
    }

    return allMappings;
  } catch {
    return [];
  }
}

export default async function CrosswalksPage() {
  const mappings = await fetchAllCrosswalks();

  const highCount   = mappings.filter((m) => m.confidence === 'high').length;
  const mediumCount = mappings.filter((m) => m.confidence === 'medium').length;
  const lowCount    = mappings.filter((m) => m.confidence === 'low').length;

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
            <span className="text-gray-600 font-medium">Crosswalks</span>
          </nav>

          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-violet-100 flex items-center justify-center shrink-0">
              <GitMerge className="w-6 h-6 text-violet-600" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                SOC 2 ↔ ISO 27001 Cross-Framework Mappings
              </h1>
              <p className="text-gray-500 max-w-2xl leading-relaxed">
                {mappings.length > 0 ? mappings.length : 75} mapped controls showing how SOC 2 Trust
                Services Criteria map to ISO/IEC 27001:2022 Annex A — helping you satisfy both
                frameworks with a single set of controls.
              </p>
            </div>
          </div>

          {/* Stats */}
          {mappings.length > 0 && (
            <div className="mt-6 flex gap-4 flex-wrap">
              <div className="bg-gray-50 rounded-lg px-4 py-2 border border-gray-200">
                <p className="text-lg font-bold text-gray-900">{mappings.length}</p>
                <p className="text-xs text-gray-500">Total mappings</p>
              </div>
              <div className="bg-emerald-50 rounded-lg px-4 py-2 border border-emerald-100">
                <p className="text-lg font-bold text-emerald-700">{highCount}</p>
                <p className="text-xs text-emerald-600">High confidence</p>
              </div>
              <div className="bg-amber-50 rounded-lg px-4 py-2 border border-amber-100">
                <p className="text-lg font-bold text-amber-700">{mediumCount}</p>
                <p className="text-xs text-amber-600">Medium confidence</p>
              </div>
              <div className="bg-gray-50 rounded-lg px-4 py-2 border border-gray-200">
                <p className="text-lg font-bold text-gray-600">{lowCount}</p>
                <p className="text-xs text-gray-500">Low confidence</p>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ── Table ── */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {mappings.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-xl border border-gray-200 shadow-sm">
            <GitMerge className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">
              Unable to load crosswalk mappings. Please try again later.
            </p>
            <p className="text-gray-400 text-xs mt-2">
              Make sure the backend API is running at{' '}
              <code className="font-mono bg-gray-100 px-1 rounded">
                {process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001/api/v1'}
              </code>
            </p>
          </div>
        ) : (
          <CrosswalkTable mappings={mappings} />
        )}

        {/* Explainer */}
        <div className="mt-8 bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">
            Understanding the Mapping
          </h2>
          <div className="grid md:grid-cols-3 gap-4 text-xs text-gray-600">
            <div>
              <p className="font-semibold text-gray-700 mb-1">Mapping Types</p>
              <ul className="space-y-1">
                <li><span className="font-medium">Direct</span> — Controls address the same requirement verbatim</li>
                <li><span className="font-medium">Partial</span> — Controls overlap but have distinct scope</li>
                <li><span className="font-medium">Related</span> — Controls address complementary requirements</li>
              </ul>
            </div>
            <div>
              <p className="font-semibold text-gray-700 mb-1">Confidence Levels</p>
              <ul className="space-y-1">
                <li><span className="font-medium">High</span> — Strong alignment, widely agreed upon</li>
                <li><span className="font-medium">Medium</span> — Reasonable alignment, some interpretation needed</li>
                <li><span className="font-medium">Low</span> — Weak alignment, significant gaps exist</li>
              </ul>
            </div>
            <div>
              <p className="font-semibold text-gray-700 mb-1">How to Use This</p>
              <ul className="space-y-1">
                <li>Identify overlapping controls to reduce duplicate work</li>
                <li>Prioritize high-confidence mappings for quick wins</li>
                <li>Click any control code to see its full requirements</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
