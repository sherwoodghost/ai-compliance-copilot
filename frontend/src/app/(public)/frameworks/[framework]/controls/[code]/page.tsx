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
    const [soc2, iso27001, gdpr, iso9001, hipaa, pciDss, fedramp, nistCsf, iso14001, iso45001] =
      await Promise.all([
        getFrameworkControls('soc2'),
        getFrameworkControls('iso27001'),
        getFrameworkControls('gdpr'),
        getFrameworkControls('iso9001'),
        getFrameworkControls('hipaa'),
        getFrameworkControls('pci-dss'),
        getFrameworkControls('fedramp'),
        getFrameworkControls('nist-csf'),
        getFrameworkControls('iso14001'),
        getFrameworkControls('iso45001'),
      ]);
    const params: { framework: string; code: string }[] = [];
    for (const c of soc2)     params.push({ framework: 'soc2',     code: encodeURIComponent(c.code) });
    for (const c of iso27001) params.push({ framework: 'iso27001', code: encodeURIComponent(c.code) });
    for (const c of gdpr)     params.push({ framework: 'gdpr',     code: encodeURIComponent(c.code) });
    for (const c of iso9001)  params.push({ framework: 'iso9001',  code: encodeURIComponent(c.code) });
    for (const c of hipaa)    params.push({ framework: 'hipaa',    code: encodeURIComponent(c.code) });
    for (const c of pciDss)   params.push({ framework: 'pci-dss',  code: encodeURIComponent(c.code) });
    for (const c of fedramp)  params.push({ framework: 'fedramp',  code: encodeURIComponent(c.code) });
    for (const c of nistCsf)  params.push({ framework: 'nist-csf', code: encodeURIComponent(c.code) });
    for (const c of iso14001) params.push({ framework: 'iso14001', code: encodeURIComponent(c.code) });
    for (const c of iso45001) params.push({ framework: 'iso45001', code: encodeURIComponent(c.code) });
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
  switch (fw) {
    case 'soc2':     return 'SOC 2';
    case 'iso27001': return 'ISO 27001';
    case 'gdpr':     return 'GDPR';
    case 'iso9001':  return 'ISO 9001';
    case 'hipaa':    return 'HIPAA';
    case 'pci-dss':  return 'PCI DSS';
    case 'fedramp':  return 'FedRAMP';
    case 'nist-csf': return 'NIST CSF';
    case 'iso14001': return 'ISO 14001';
    case 'iso45001': return 'ISO 45001';
    default:         return fw.toUpperCase();
  }
}

function frameworkColor(fw: string): { bg: string; text: string } {
  switch (fw) {
    case 'soc2':     return { bg: 'bg-emerald-100', text: 'text-emerald-700' };
    case 'iso27001': return { bg: 'bg-indigo-100',  text: 'text-indigo-700'  };
    case 'gdpr':     return { bg: 'bg-violet-100',  text: 'text-violet-700'  };
    case 'iso9001':  return { bg: 'bg-teal-100',    text: 'text-teal-700'    };
    case 'hipaa':    return { bg: 'bg-rose-100',    text: 'text-rose-700'    };
    case 'pci-dss':  return { bg: 'bg-orange-100',  text: 'text-orange-700'  };
    case 'fedramp':  return { bg: 'bg-blue-100',    text: 'text-blue-700'    };
    case 'nist-csf': return { bg: 'bg-sky-100',     text: 'text-sky-700'     };
    case 'iso14001': return { bg: 'bg-green-100',   text: 'text-green-700'   };
    case 'iso45001': return { bg: 'bg-amber-100',   text: 'text-amber-700'   };
    default:         return { bg: 'bg-gray-100',    text: 'text-gray-700'    };
  }
}

function categoryColorClass(category: string): { bg: string; text: string } {
  // SOC 2 categories
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
  // ISO 27001 categories
  if (category.startsWith('A.5'))
    return { bg: 'bg-red-100',    text: 'text-red-800'    };
  if (category.startsWith('A.6'))
    return { bg: 'bg-orange-100', text: 'text-orange-800' };
  if (category.startsWith('A.7'))
    return { bg: 'bg-yellow-100', text: 'text-yellow-800' };
  if (category.startsWith('A.8'))
    return { bg: 'bg-indigo-100', text: 'text-indigo-800' };
  // GDPR categories
  if (category === 'Principles')
    return { bg: 'bg-violet-100', text: 'text-violet-800' };
  if (category === 'Controller Obligations')
    return { bg: 'bg-purple-100', text: 'text-purple-800' };
  if (category === 'Data Subject Rights')
    return { bg: 'bg-blue-100',   text: 'text-blue-800'   };
  if (category === 'Processor Relations')
    return { bg: 'bg-indigo-100', text: 'text-indigo-800' };
  if (category === 'Security')
    return { bg: 'bg-red-100',    text: 'text-red-800'    };
  if (category === 'Breach Notification')
    return { bg: 'bg-orange-100', text: 'text-orange-800' };
  if (category === 'DPIA')
    return { bg: 'bg-amber-100',  text: 'text-amber-800'  };
  if (category === 'DPO')
    return { bg: 'bg-yellow-100', text: 'text-yellow-800' };
  if (category === 'International Transfers')
    return { bg: 'bg-cyan-100',   text: 'text-cyan-800'   };
  if (category === 'Enforcement')
    return { bg: 'bg-rose-100',   text: 'text-rose-800'   };
  // ISO 9001 categories
  if (category === 'Context')
    return { bg: 'bg-teal-100',   text: 'text-teal-800'   };
  if (category === 'Leadership')
    return { bg: 'bg-emerald-100',text: 'text-emerald-800'};
  if (category === 'Planning')
    return { bg: 'bg-cyan-100',   text: 'text-cyan-800'   };
  if (category === 'Support')
    return { bg: 'bg-sky-100',    text: 'text-sky-800'    };
  if (category === 'Operation')
    return { bg: 'bg-blue-100',   text: 'text-blue-800'   };
  if (category === 'Performance Evaluation')
    return { bg: 'bg-indigo-100', text: 'text-indigo-800' };
  if (category === 'Improvement')
    return { bg: 'bg-violet-100', text: 'text-violet-800' };
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

function inferFrameworkFromCode(code: string): string {
  if (code.startsWith('CC') || code.startsWith('A1') || code.startsWith('C1') ||
      code.startsWith('PI') || /^P\d/.test(code)) return 'soc2';
  if (code.startsWith('A.'))        return 'iso27001';
  if (code.startsWith('GDPR-'))     return 'gdpr';
  if (code.startsWith('ISO9001-'))  return 'iso9001';
  if (code.startsWith('HIPAA-'))    return 'hipaa';
  if (code.startsWith('PCI-'))      return 'pci-dss';
  if (code.startsWith('FED-') || code.startsWith('FEDRAMP-')) return 'fedramp';
  if (code.startsWith('NIST-') || code.startsWith('CSF-'))    return 'nist-csf';
  if (code.startsWith('ISO14001-')) return 'iso14001';
  if (code.startsWith('ISO45001-')) return 'iso45001';
  return 'soc2';
}

function CrosswalkChip({
  code,
  framework,
}: {
  code: string;
  framework?: string;
}) {
  // Derive target framework: prefer explicit prop, fall back to code-based detection
  let target: string;
  if (framework) {
    const fw = framework.toLowerCase();
    if (fw.includes('gdpr'))          target = 'gdpr';
    else if (fw.includes('9001'))     target = 'iso9001';
    else if (fw.includes('iso') || fw.includes('27001')) target = 'iso27001';
    else                              target = 'soc2';
  } else {
    target = inferFrameworkFromCode(code);
  }
  const color = categoryColorClass(code);
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
  const VALID_FRAMEWORKS = [
    'soc2', 'iso27001', 'gdpr', 'iso9001',
    'hipaa', 'pci-dss', 'fedramp', 'nist-csf', 'iso14001', 'iso45001',
  ];
  if (!VALID_FRAMEWORKS.includes(framework)) {
    notFound();
  }

  const control: ControlDetail | null = await getControlByCode(code);

  if (!control) {
    notFound();
  }

  const fwLabel  = frameworkLabel(framework);
  const fwColor  = frameworkColor(framework);
  const catColor = categoryColorClass(control.category);

  // Normalise crosswalk items into a consistent flat shape.
  // The API may return either the transformed flat CrosswalkMapping shape
  // (sourceCode/targetCode as strings) OR the raw Prisma shape
  // (sourceControl / targetControl as nested objects).  Handle both.
  interface NormCrosswalk {
    relCode:     string;
    relTitle:    string;
    relFw:       string;
    mappingType: string;
    confidence:  string;
  }

  function normalizeCrosswalks(
    items: any[],
    kind: 'source' | 'target',
    currentCode: string,
  ): NormCrosswalk[] {
    return (items ?? []).flatMap((cw: any): NormCrosswalk[] => {
      // ── Flat shape (transformed by backend controller) ───────────────
      if (typeof cw.sourceCode === 'string' || typeof cw.targetCode === 'string') {
        const isSource = cw.sourceCode === currentCode;
        const relCode  = (isSource ? cw.targetCode  : cw.sourceCode)  ?? '';
        const relTitle = (isSource ? cw.targetTitle : cw.sourceTitle) ?? '';
        const relFw    = (isSource ? cw.targetFramework : cw.sourceFramework) ?? '';
        if (!relCode) return [];
        return [{ relCode, relTitle, relFw, mappingType: cw.mappingType, confidence: cw.confidence }];
      }

      // ── Raw Prisma shape ─────────────────────────────────────────────
      // crosswalkSources items: current control is the source → targetControl is the related one
      // crosswalkTargets items: current control is the target → sourceControl is the related one
      const related = kind === 'source' ? cw.targetControl : cw.sourceControl;
      if (!related?.code) return [];
      return [{
        relCode:     related.code  ?? '',
        relTitle:    related.title ?? '',
        relFw:       related.framework?.name ?? '',
        mappingType: cw.mappingType  ?? '',
        confidence:  cw.confidence   ?? 'low',
      }];
    });
  }

  const allCrosswalks: NormCrosswalk[] = [
    ...normalizeCrosswalks(control.crosswalkSources ?? [], 'source', control.code),
    ...normalizeCrosswalks(control.crosswalkTargets ?? [], 'target', control.code),
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
                      <CrosswalkChip code={cw.relCode} framework={cw.relFw} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-700 leading-snug">{cw.relTitle}</p>
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
