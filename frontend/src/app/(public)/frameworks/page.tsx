import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, BookOpen, ShieldCheck, GitMerge } from 'lucide-react';
import { getFrameworks } from '@/lib/api/frameworks';

export const metadata: Metadata = {
  title: 'Compliance Framework Reference | ComplianceOS',
  description:
    'Browse SOC 2 Trust Services Criteria and ISO/IEC 27001:2022 controls with evidence requirements, policy guidance, and cross-framework mappings.',
};

// Static category lists for display (augmented with actual API counts)
const SOC2_CATEGORIES = [
  'CC1 – Control Environment',
  'CC2 – Communication & Information',
  'CC3 – Risk Assessment',
  'CC4 – Monitoring Activities',
  'CC5 – Control Activities',
  'CC6 – Logical & Physical Access',
  'CC7 – System Operations',
  'CC8 – Change Management',
  'CC9 – Risk Mitigation',
  'A1 – Availability',
  'C1 – Confidentiality',
  'PI1 – Processing Integrity',
  'P1–P8 – Privacy',
];

const ISO_CATEGORIES = [
  'A.5 – Organizational Controls (38)',
  'A.6 – People Controls (8)',
  'A.7 – Physical Controls (14)',
  'A.8 – Technological Controls (34)',
];

export default async function FrameworksPage() {
  const frameworks = await getFrameworks().catch(() => null);

  const soc2Count      = frameworks?.soc2.controlCount      ?? 68;
  const iso27001Count  = frameworks?.iso27001.controlCount  ?? 97;

  return (
    <div className="bg-gray-50 min-h-screen">
      {/* ── Hero ── */}
      <section className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-16 text-center">
          <div className="inline-flex items-center gap-2 bg-brand-50 text-brand-600 text-xs font-semibold px-3 py-1 rounded-full mb-5">
            <BookOpen className="w-3.5 h-3.5" />
            Framework Reference
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Compliance Framework Reference
          </h1>
          <p className="text-lg text-gray-500 max-w-2xl mx-auto leading-relaxed">
            Explore {soc2Count + iso27001Count} controls across SOC 2 and ISO/IEC 27001:2022 — with evidence
            requirements, policy guidance, and cross-framework mappings.
          </p>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-6 py-12 space-y-12">
        {/* ── Framework cards ── */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* ISO 27001 */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow flex flex-col">
            <div className="p-6 flex-1">
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div>
                  <span className="inline-block text-xs font-semibold bg-indigo-100 text-indigo-700 px-2.5 py-1 rounded-full mb-2">
                    ISO/IEC 27001:2022
                  </span>
                  <h2 className="text-xl font-bold text-gray-900">ISO 27001</h2>
                  <p className="text-sm text-gray-500">Information Security Management</p>
                </div>
                <div className="text-right">
                  <span className="text-3xl font-bold text-gray-900">{iso27001Count}</span>
                  <p className="text-xs text-gray-400">controls</p>
                </div>
              </div>

              {/* Description */}
              <p className="text-sm text-gray-600 leading-relaxed mb-5">
                ISO/IEC 27001:2022 is an international standard for managing information security.
                Annex A defines {iso27001Count} controls organized across four domains, covering
                organizational, people, physical, and technological security measures.
              </p>

              {/* Categories */}
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                  Control Domains
                </p>
                {ISO_CATEGORIES.map((cat) => (
                  <div
                    key={cat}
                    className="flex items-center gap-2 text-xs text-gray-600"
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0" />
                    {cat}
                  </div>
                ))}
              </div>
            </div>

            <div className="px-6 pb-6">
              <Link
                href="/frameworks/iso27001"
                className="inline-flex w-full items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 transition-colors"
              >
                Explore ISO 27001
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>

          {/* SOC 2 */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow flex flex-col">
            <div className="p-6 flex-1">
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div>
                  <span className="inline-block text-xs font-semibold bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-full mb-2">
                    SOC 2 TSC 2017
                  </span>
                  <h2 className="text-xl font-bold text-gray-900">SOC 2</h2>
                  <p className="text-sm text-gray-500">Trust Services Criteria</p>
                </div>
                <div className="text-right">
                  <span className="text-3xl font-bold text-gray-900">{soc2Count}</span>
                  <p className="text-xs text-gray-400">controls</p>
                </div>
              </div>

              {/* Description */}
              <p className="text-sm text-gray-600 leading-relaxed mb-5">
                SOC 2 Trust Services Criteria (2017) defines {soc2Count} controls for service
                organizations. It evaluates security, availability, processing integrity,
                confidentiality, and privacy across Common Criteria (CC) and additional categories.
              </p>

              {/* Categories (scrollable) */}
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                  Categories
                </p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                  {SOC2_CATEGORIES.map((cat) => (
                    <div
                      key={cat}
                      className="flex items-center gap-2 text-xs text-gray-600"
                    >
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                      {cat}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="px-6 pb-6">
              <Link
                href="/frameworks/soc2"
                className="inline-flex w-full items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 transition-colors"
              >
                Explore SOC 2
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>

        {/* ── Cross-framework mapping CTA ── */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8">
          <div className="flex flex-col md:flex-row items-center gap-6">
            <div className="flex-shrink-0 w-14 h-14 rounded-xl bg-violet-100 flex items-center justify-center">
              <GitMerge className="w-7 h-7 text-violet-600" />
            </div>
            <div className="flex-1 text-center md:text-left">
              <h2 className="text-xl font-bold text-gray-900 mb-1">
                Cross-Framework Mapping
              </h2>
              <p className="text-gray-500 text-sm leading-relaxed">
                75 mapped controls between ISO 27001 and SOC 2 — see exactly how each
                SOC 2 criterion aligns to ISO/IEC 27001:2022 Annex A controls, with
                confidence ratings and mapping types.
              </p>
            </div>
            <div className="flex-shrink-0">
              <Link
                href="/frameworks/crosswalks"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-brand-600 text-brand-600 text-sm font-medium hover:bg-brand-50 transition-colors"
              >
                View Crosswalks
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>

          {/* Stats row */}
          <div className="mt-6 pt-6 border-t border-gray-100 grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-gray-900">75</p>
              <p className="text-xs text-gray-500 mt-0.5">Mapped controls</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">2</p>
              <p className="text-xs text-gray-500 mt-0.5">Frameworks</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{soc2Count + iso27001Count}</p>
              <p className="text-xs text-gray-500 mt-0.5">Total controls</p>
            </div>
          </div>
        </div>

        {/* ── About section ── */}
        <div className="grid md:grid-cols-3 gap-6">
          {[
            {
              icon: <BookOpen className="w-5 h-5 text-brand-600" />,
              title: 'Evidence Requirements',
              desc: 'Each control lists the specific evidence types and artifacts required to demonstrate compliance.',
            },
            {
              icon: <ShieldCheck className="w-5 h-5 text-brand-600" />,
              title: 'Policy Guidance',
              desc: 'Policy requirements mapped to each control help you build a complete compliance program.',
            },
            {
              icon: <GitMerge className="w-5 h-5 text-brand-600" />,
              title: 'Cross-Mappings',
              desc: 'Eliminate duplicate work by seeing which controls satisfy multiple frameworks simultaneously.',
            },
          ].map(({ icon, title, desc }) => (
            <div key={title} className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
              <div className="w-9 h-9 rounded-lg bg-brand-50 flex items-center justify-center mb-3">
                {icon}
              </div>
              <h3 className="font-semibold text-gray-900 mb-1">{title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
