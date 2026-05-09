import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronRight, GitMerge } from 'lucide-react';
import { getFrameworkControls, getControlCrosswalks } from '@/lib/api/frameworks';
import type { CrosswalkMapping, FrameworkSlug } from '@/lib/api/frameworks';
import CrosswalksTabs from './CrosswalksTabs';

export const metadata: Metadata = {
  title: 'Cross-Framework Control Mappings | ComplianceOS',
  description:
    'See how SOC 2, ISO 27001, GDPR, HIPAA, PCI-DSS, FedRAMP, and NIST CSF controls map to each other — with mapping types and confidence levels to help you satisfy multiple frameworks with a single set of controls.',
};

async function fetchCrosswalksForFramework(framework: FrameworkSlug): Promise<CrosswalkMapping[]> {
  try {
    const controls = await getFrameworkControls(framework);
    if (controls.length === 0) return [];

    const BATCH = 10;
    const allMappings: CrosswalkMapping[] = [];
    const seen = new Set<string>();

    for (let i = 0; i < controls.length; i += BATCH) {
      const batch   = controls.slice(i, i + BATCH);
      const results = await Promise.allSettled(
        batch.map((c) => getControlCrosswalks(c.code)),
      );
      for (const r of results) {
        if (r.status !== 'fulfilled') continue;
        for (const m of r.value) {
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
  // Fetch all framework data needed for 7 pairs in parallel
  const [soc2Mappings, gdprMappings, hipaaMappings, pciMappings, fedrampMappings] =
    await Promise.all([
      fetchCrosswalksForFramework('soc2' as FrameworkSlug),
      fetchCrosswalksForFramework('gdpr' as FrameworkSlug),
      fetchCrosswalksForFramework('hipaa' as FrameworkSlug),
      fetchCrosswalksForFramework('pci-dss' as FrameworkSlug),
      fetchCrosswalksForFramework('fedramp' as FrameworkSlug),
    ]);

  // ── Pair 1: SOC 2 ↔ ISO 27001 ───────────────────────────────────────────────
  const soc2IsoMappings = soc2Mappings.filter((m) =>
    (m.sourceCode.startsWith('CC') || m.sourceCode.startsWith('A1') ||
     m.sourceCode.startsWith('C1') || m.sourceCode.startsWith('PI') || m.sourceCode.startsWith('P')) &&
    m.targetCode.startsWith('A.')
    ||
    m.sourceCode.startsWith('A.') &&
    (m.targetCode.startsWith('CC') || m.targetCode.startsWith('A1') ||
     m.targetCode.startsWith('C1') || m.targetCode.startsWith('PI') || m.targetCode.startsWith('P'))
  );

  // ── Pair 2: GDPR ↔ ISO 27001 ────────────────────────────────────────────────
  const gdprIsoMappings = gdprMappings.filter((m) =>
    (m.sourceCode.startsWith('GDPR-') && m.targetCode.startsWith('A.')) ||
    (m.sourceCode.startsWith('A.') && m.targetCode.startsWith('GDPR-'))
  );

  // ── Pair 3: GDPR ↔ SOC 2 ────────────────────────────────────────────────────
  const gdprSoc2Mappings = gdprMappings.filter((m) =>
    (m.sourceCode.startsWith('GDPR-') &&
      (m.targetCode.startsWith('CC') || m.targetCode.startsWith('P') || m.targetCode.startsWith('A1'))) ||
    ((m.sourceCode.startsWith('CC') || m.sourceCode.startsWith('P') || m.sourceCode.startsWith('A1')) &&
      m.targetCode.startsWith('GDPR-'))
  );

  // ── Pair 4: HIPAA ↔ ISO 27001 ───────────────────────────────────────────────
  const hipaaIsoMappings = hipaaMappings.filter((m) =>
    (m.sourceCode.startsWith('HIPAA-') && m.targetCode.startsWith('A.')) ||
    (m.sourceCode.startsWith('A.') && m.targetCode.startsWith('HIPAA-'))
  );

  // ── Pair 5: HIPAA ↔ SOC 2 ───────────────────────────────────────────────────
  const hipaaSoc2Mappings = hipaaMappings.filter((m) =>
    (m.sourceCode.startsWith('HIPAA-') &&
      (m.targetCode.startsWith('CC') || m.targetCode.startsWith('A1') || m.targetCode.startsWith('P'))) ||
    ((m.sourceCode.startsWith('CC') || m.sourceCode.startsWith('A1') || m.sourceCode.startsWith('P')) &&
      m.targetCode.startsWith('HIPAA-'))
  );

  // ── Pair 6: PCI-DSS ↔ ISO 27001 ─────────────────────────────────────────────
  const pciIsoMappings = pciMappings.filter((m) =>
    (m.sourceCode.startsWith('PCI-') && m.targetCode.startsWith('A.')) ||
    (m.sourceCode.startsWith('A.') && m.targetCode.startsWith('PCI-'))
  );

  // ── Pair 7: FedRAMP ↔ NIST CSF ──────────────────────────────────────────────
  const fedrampNistMappings = fedrampMappings.filter((m) => {
    const fedSrc = /^(AC|AT|AU|CA|CM|CP|IA|IR|MA|MP|PE|PL|PM|PS|RA|SA|SC|SI|SR)-/.test(m.sourceCode);
    const nistTgt = /^(GV|ID|PR|DE|RS|RC)\./.test(m.targetCode);
    const nistSrc = /^(GV|ID|PR|DE|RS|RC)\./.test(m.sourceCode);
    const fedTgt  = /^(AC|AT|AU|CA|CM|CP|IA|IR|MA|MP|PE|PL|PM|PS|RA|SA|SC|SI|SR)-/.test(m.targetCode);
    return (fedSrc && nistTgt) || (nistSrc && fedTgt);
  });

  const allPairMappings = [
    ...soc2IsoMappings, ...gdprIsoMappings, ...gdprSoc2Mappings,
    ...hipaaIsoMappings, ...hipaaSoc2Mappings, ...pciIsoMappings, ...fedrampNistMappings,
  ];
  const totalMappings = allPairMappings.length;

  const pairs = [
    {
      id:          'soc2-iso27001',
      label:       'SOC 2 ↔ ISO 27001',
      sourceLabel: 'SOC 2 Control',
      targetLabel: 'ISO 27001 Control',
      mappings:    soc2IsoMappings.length > 0 ? soc2IsoMappings : soc2Mappings,
      sourceColor: 'bg-emerald-100 text-emerald-700',
      targetColor: 'bg-indigo-100 text-indigo-700',
    },
    {
      id:          'gdpr-iso27001',
      label:       'GDPR ↔ ISO 27001',
      sourceLabel: 'GDPR Article',
      targetLabel: 'ISO 27001 Control',
      mappings:    gdprIsoMappings,
      sourceColor: 'bg-violet-100 text-violet-700',
      targetColor: 'bg-indigo-100 text-indigo-700',
    },
    {
      id:          'gdpr-soc2',
      label:       'GDPR ↔ SOC 2',
      sourceLabel: 'GDPR Article',
      targetLabel: 'SOC 2 Control',
      mappings:    gdprSoc2Mappings,
      sourceColor: 'bg-violet-100 text-violet-700',
      targetColor: 'bg-emerald-100 text-emerald-700',
    },
    {
      id:          'hipaa-iso27001',
      label:       'HIPAA ↔ ISO 27001',
      sourceLabel: 'HIPAA Safeguard',
      targetLabel: 'ISO 27001 Control',
      mappings:    hipaaIsoMappings,
      sourceColor: 'bg-rose-100 text-rose-700',
      targetColor: 'bg-indigo-100 text-indigo-700',
    },
    {
      id:          'hipaa-soc2',
      label:       'HIPAA ↔ SOC 2',
      sourceLabel: 'HIPAA Safeguard',
      targetLabel: 'SOC 2 Control',
      mappings:    hipaaSoc2Mappings,
      sourceColor: 'bg-rose-100 text-rose-700',
      targetColor: 'bg-emerald-100 text-emerald-700',
    },
    {
      id:          'pci-iso27001',
      label:       'PCI-DSS ↔ ISO 27001',
      sourceLabel: 'PCI-DSS Requirement',
      targetLabel: 'ISO 27001 Control',
      mappings:    pciIsoMappings,
      sourceColor: 'bg-amber-100 text-amber-700',
      targetColor: 'bg-indigo-100 text-indigo-700',
    },
    {
      id:          'fedramp-nist-csf',
      label:       'FedRAMP ↔ NIST CSF',
      sourceLabel: 'FedRAMP Control',
      targetLabel: 'NIST CSF Subcategory',
      mappings:    fedrampNistMappings,
      sourceColor: 'bg-sky-100 text-sky-700',
      targetColor: 'bg-orange-100 text-orange-700',
    },
  ];

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
                Cross-Framework Control Mappings
              </h1>
              <p className="text-gray-500 max-w-2xl leading-relaxed">
                {totalMappings > 0 ? `${totalMappings}+` : '250+'} mapped controls across SOC 2,
                ISO 27001, GDPR, HIPAA, PCI-DSS, FedRAMP, and NIST CSF — identify overlapping
                requirements and satisfy multiple frameworks with a single set of controls.
              </p>
            </div>
          </div>

          {/* Stats */}
          <div className="mt-6 flex gap-3 flex-wrap">
            {pairs.map((pair) => (
              <div key={pair.id} className="bg-gray-50 rounded-lg px-4 py-2 border border-gray-200">
                <p className="text-base font-bold text-gray-900">{pair.mappings.length}</p>
                <p className="text-xs text-gray-500">{pair.label}</p>
              </div>
            ))}
            <div className="bg-emerald-50 rounded-lg px-4 py-2 border border-emerald-100">
              <p className="text-base font-bold text-emerald-700">
                {allPairMappings.filter((m) => m.confidence === 'high').length}
              </p>
              <p className="text-xs text-emerald-600">High confidence</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Tabs + Table ── */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <CrosswalksTabs pairs={pairs} />

        {/* Explainer */}
        <div className="mt-8 bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">
            Understanding Cross-Framework Mappings
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
                <li>Select a framework pair from the tabs above</li>
                <li>High-confidence mappings can share evidence across frameworks</li>
                <li>Partial mappings may need additional evidence for each framework</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
