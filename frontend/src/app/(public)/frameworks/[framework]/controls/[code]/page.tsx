import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronRight, ArrowLeft, ShieldCheck, FileText, ExternalLink } from 'lucide-react';
import {
  getControlByCode,
  getFrameworkControls,
  type ControlDetail,
} from '@/lib/api/frameworks';

// ─── Static params ─────────────────────────────────────────────────────────────

export async function generateStaticParams(): Promise<
  { framework: string; code: string }[]
> {
  try {
    const [soc2, iso27001] = await Promise.all([
      getFrameworkControls('soc2'),
      getFrameworkControls('iso27001'),
    ]);
    const params: { framework: string; code: string }[] = [];
    for (const c of soc2)     params.push({ framework: 'soc2',     code: encodeURIComponent(c.code) });
    for (const c of iso27001) params.push({ framework: 'iso27001', code: encodeURIComponent(c.code) });
    return params;
  } catch {
    return [];
  }
}

// ─── Metadata ─────────────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: Promise<{ framework: string; code: string }>;
}): Promise<Metadata> {
  const { code: rawCode } = await params;
  const code    = decodeURIComponent(rawCode);
  const control = await getControlByCode(code);
  if (!control) {
    return { title: 'Control Not Found | ComplianceOS' };
  }
  return {
    title: `${control.code} – ${control.title} | ComplianceOS`,
    description: control.description.slice(0, 160),
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function frameworkLabel(fw: string): string {
  return fw === 'soc2' ? 'SOC 2' : 'ISO 27001';
}

function frameworkColor(fw: string): { bg: string; text: string } {
  return fw === 'soc2'
    ? { bg: 'bg-emerald-100', text: 'text-emerald-700' }
    : { bg: 'bg-indigo-100',  text: 'text-indigo-700'  };
}

function categoryColorClass(category: string): { bg: string; text: string } {
  if (category.startsWith('CC1') || category.startsWith('CC2'))
    return { bg: 'bg-blue-100',   text: 'text-blue-800'   };
  if (['CC3','CC4','CC5'].some((p) => category.startsWith(p)))
    return { bg: 'bg-purple-100', text: 'text-purple-800' };
  if (['CC6','CC7'].some((p) => category.startsWith(p)))
    return { bg: 'bg-green-100',  text: 'text-green-800'  };
  if (['CC8','CC9'].some((p) => category.startsWith(p)))
    return { bg: 'bg-amber-100',  text: 'text-amber-800'  };
  if (category.startsWith('A1'))
    return { bg: 'bg-cyan-100',   text: 'text-cyan-800'   };
  if (category.startsWith('C1'))
    return { bg: 'bg-rose-100',   text: 'text-rose-800'   };
  if (category.startsWith('PI1'))
    return { bg: 'bg-orange-100', text: 'text-orange-800' };
  if (category.startsWith('P'))
    return { bg: 'bg-pink-100',   text: 'text-pink-800'   };
  if (category.startsWith('A.5'))
    return { bg: 'bg-red-100',    text: 'text-red-800'    };
  if (category.startsWith('A.6'))
    return { bg: 'bg-orange-100', text: 'text-orange-800' };
  if (category.startsWith('A.7'))
    return { bg: 'bg-yellow-100', text: 'text-yellow-800' };
  if (category.startsWith('A.8'))
    return { bg: 'bg-indigo-100', text: 'text-indigo-800' };
  return { bg: 'bg-gray-100', text: 'text-gray-700' };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
      <h2 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
        {icon}
        {title}
      </h2>
      {children}
    </div>
  );
}

function CrosswalkChip({
  code,
  framework,
}: {
  code: string;
  framework?: string;
}) {
  // Derive target framework: prefer explicit prop, fall back to code-based detection
  const target = framework
    ? (framework.toLowerCase().includes('iso') ? 'iso27001' : 'soc2')
    : (code.startsWith('A.') ? 'iso27001' : 'soc2');
  const color  = categoryColorClass(code);
  return (
    <Link
      href={`/frameworks/${target}/controls/${encodeURIComponent(code)}`}
      className={`inline-flex items-center gap-1 font-mono text-xs px-2.5 py-1 rounded-full ${color.bg} ${color.text} hover:opacity-80 transition-opacity`}
    >
      {code}
      <ExternalLink className="w-2.5 h-2.5" />
    </Link>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function ControlDetailPage({
  params,
}: {
  params: Promise<{ framework: string; code: string }>;
}) {
  const { framework, code: rawCode } = await params;
  const code          = decodeURIComponent(rawCode);

  // Validate framework param
  if (!['soc2', 'iso27001'].includes(framework)) {
    notFound();
  }

  const control: ControlDetail | null = await getControlByCode(code);

  if (!control) {
    notFound();
  }

  const fwLabel  = frameworkLabel(framework);
  const fwColor  = frameworkColor(framework);
  const catColor = categoryColorClass(control.category);

  // Combine crosswalk sources + targets for display
  const allCrosswalks = [
    ...(control.crosswalkSources ?? []),
    ...(control.crosswalkTargets ?? []),
  ];

  return (
    <div className="bg-gray-50 min-h-screen">
      {/* ── Header bar ── */}
      <section className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-6 py-8">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-1 text-xs text-gray-400 mb-5 flex-wrap">
            <Link href="/frameworks" className="hover:text-gray-600 transition-colors">
              Frameworks
            </Link>
            <ChevronRight className="w-3 h-3" />
            <Link
              href={`/frameworks/${framework}`}
              className="hover:text-gray-600 transition-colors"
            >
              {fwLabel}
            </Link>
            <ChevronRight className="w-3 h-3" />
            <span className="text-gray-600 font-medium font-mono">{control.code}</span>
          </nav>

          {/* Back button */}
          <Link
            href={`/frameworks/${framework}`}
            className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 transition-colors mb-5"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to {fwLabel}
          </Link>

          {/* Badges */}
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span
              className={`text-xs font-semibold px-2.5 py-1 rounded-full ${fwColor.bg} ${fwColor.text}`}
            >
              {fwLabel}
            </span>
            <span
              className={`text-xs font-semibold px-2.5 py-1 rounded-full ${catColor.bg} ${catColor.text}`}
            >
              {control.category}
            </span>
            {control.weight != null && (
              <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-gray-100 text-gray-600">
                Weight: {control.weight}
              </span>
            )}
          </div>

          {/* Title */}
          <h1 className="text-3xl font-bold text-gray-900 flex items-start gap-3">
            <span
              className={`font-mono text-xl px-3 py-1 rounded-lg shrink-0 mt-0.5 ${catColor.bg} ${catColor.text}`}
            >
              {control.code}
            </span>
            {control.title}
          </h1>
        </div>
      </section>

      {/* ── Body ── */}
      <div className="max-w-5xl mx-auto px-6 py-8 space-y-5">
        {/* Description */}
        <Section title="Description">
          <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
            {control.description}
          </p>
        </Section>

        {/* Guidance */}
        {control.guidance && (
          <Section title="Implementation Guidance">
            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
              {control.guidance}
            </p>
          </Section>
        )}

        {/* Evidence Requirements */}
        {control.evidenceRequirements?.length > 0 && (
          <Section
            title="Evidence Requirements"
            icon={<ShieldCheck className="w-4 h-4 text-brand-600" />}
          >
            <div className="space-y-3">
              {control.evidenceRequirements.map((ev, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 p-3 rounded-lg border border-gray-100 bg-gray-50"
                >
                  <div className="shrink-0 mt-0.5">
                    {ev.isMandatory ? (
                      <span className="inline-block text-xs font-semibold bg-red-100 text-red-700 px-2 py-0.5 rounded">
                        Mandatory
                      </span>
                    ) : (
                      <span className="inline-block text-xs font-medium bg-gray-100 text-gray-500 px-2 py-0.5 rounded">
                        Optional
                      </span>
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-gray-700 mb-0.5">
                      {ev.evidenceType}
                    </p>
                    <p className="text-xs text-gray-500 leading-relaxed">
                      {ev.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Policy Requirements */}
        {control.policyRequirements?.length > 0 && (
          <Section
            title="Policy Requirements"
            icon={<FileText className="w-4 h-4 text-brand-600" />}
          >
            <div className="space-y-3">
              {control.policyRequirements.map((pol, i) => (
                <div
                  key={i}
                  className="p-3 rounded-lg border border-gray-100 bg-gray-50"
                >
                  <p className="text-xs font-semibold text-gray-800 mb-0.5">
                    {pol.policyName}
                  </p>
                  <p className="text-xs text-gray-500 leading-relaxed">
                    {pol.description}
                  </p>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Related Controls (Crosswalks) */}
        {allCrosswalks.length > 0 && (
          <Section title="Related Controls">
            <p className="text-xs text-gray-500 mb-4">
              This control maps to the following controls in the other framework.
            </p>
            <div className="space-y-3">
              {allCrosswalks.map((cw, i) => {
                const isSource = cw.sourceCode === control.code;
                const relCode  = isSource ? cw.targetCode  : cw.sourceCode;
                const relTitle = isSource ? cw.targetTitle : cw.sourceTitle;
                const relFw    = isSource ? cw.targetFramework : cw.sourceFramework;

                const confidenceColors: Record<string, string> = {
                  high:   'bg-emerald-100 text-emerald-700',
                  medium: 'bg-amber-100 text-amber-700',
                  low:    'bg-gray-100 text-gray-600',
                };
                const confClass = confidenceColors[cw.confidence] ?? confidenceColors.low;

                return (
                  <div
                    key={i}
                    className="flex items-start gap-3 p-3 rounded-lg border border-gray-100 bg-gray-50"
                  >
                    <div className="shrink-0 pt-0.5">
                      <CrosswalkChip code={relCode} framework={relFw} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-700 leading-snug">{relTitle}</p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="text-xs text-gray-400">
                          {cw.mappingType}
                        </span>
                        <span
                          className={`text-xs font-medium px-1.5 py-0.5 rounded ${confClass}`}
                        >
                          {cw.confidence} confidence
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Section>
        )}
      </div>
    </div>
  );
}
