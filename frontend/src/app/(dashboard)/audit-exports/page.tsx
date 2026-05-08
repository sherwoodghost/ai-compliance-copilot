'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { apiClient as api } from '@/lib/api/client';
import { pdf } from '@react-pdf/renderer';
import { Soc2ReadinessPdf, ControlMatrixPdf, IsoSoaPdf } from '@/components/pdf/ComplianceReportPdf';
import {
  Download, Shield, FileText, Table, Plus, CheckCircle, Clock,
  Calendar, Package, AlertTriangle, ChevronDown, ArrowUpDown, Filter,
  Sparkles, X, Copy, Check,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Types ─────────────────────────────────────────────────────────────────────

type AuditExport = {
  id: string;
  exportType: string;
  framework: string;
  status: string;
  disclaimerIncluded: boolean;
  createdAt: string;
  dataSnapshotAt: string;
};

type SortField = 'createdAt' | 'exportType' | 'framework';

// ─── Export type catalogue with richer metadata ─────────────────────────────

const EXPORT_TYPES = [
  {
    type: 'soc2-readiness' as const,
    title: 'SOC 2 Readiness Report',
    description: 'Comprehensive audit readiness assessment',
    includes: [
      'Full control implementation matrix',
      'Policy inventory with approval status',
      'Evidence index with freshness scores',
      'Open risk register summary',
    ],
    icon: Shield,
    accent: 'from-blue-500 to-blue-600',
    bg: 'bg-blue-50 border-blue-200',
    text: 'text-blue-700',
    endpoint: '/audit-exports/soc2-readiness',
  },
  {
    type: 'iso-soa' as const,
    title: 'ISO 27001 SoA',
    description: 'Statement of Applicability per Annex A',
    includes: [
      'All 93 Annex A controls with applicability',
      'Justification rationale per control',
      'Implementation status breakdown',
      'Exclusion register with rationale',
    ],
    icon: FileText,
    accent: 'from-purple-500 to-purple-600',
    bg: 'bg-purple-50 border-purple-200',
    text: 'text-purple-700',
    endpoint: '/audit-exports/iso-soa',
  },
  {
    type: 'control-matrix' as const,
    title: 'Control Matrix',
    description: 'Cross-framework control implementation',
    includes: [
      'SOC 2 + ISO 27001 control mapping',
      'Implementation status per control',
      'Evidence links per control',
      'Framework crosswalk table',
    ],
    icon: Table,
    accent: 'from-emerald-500 to-emerald-600',
    bg: 'bg-emerald-50 border-emerald-200',
    text: 'text-emerald-700',
    endpoint: '/audit-exports/control-matrix',
  },
];

const TYPE_LABELS: Record<string, string> = {
  soc2_readiness: 'SOC 2 Readiness',
  iso_soa: 'ISO 27001 SoA',
  control_matrix: 'Control Matrix',
  evidence_binder: 'Evidence Binder',
};

const TYPE_COLORS: Record<string, string> = {
  soc2_readiness: 'bg-blue-100 text-blue-700',
  iso_soa: 'bg-purple-100 text-purple-700',
  control_matrix: 'bg-emerald-100 text-emerald-700',
  evidence_binder: 'bg-orange-100 text-orange-700',
};

// ─── Export Health ────────────────────────────────────────────────────────────

function ExportHealthBar({ exports }: { exports: AuditExport[] }) {
  if (exports.length === 0) return null;
  const latest = exports.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
  const withDisclaimer = exports.filter((e) => e.disclaimerIncluded).length;
  const pct = exports.length > 0 ? Math.round((withDisclaimer / exports.length) * 100) : 0;

  return (
    <div className="grid grid-cols-3 gap-4 bg-white border border-gray-200 rounded-xl px-5 py-4 shadow-sm">
      <div>
        <p className="text-xs text-gray-400 mb-0.5">Total Exports</p>
        <p className="text-xl font-bold text-gray-900">{exports.length}</p>
      </div>
      <div>
        <p className="text-xs text-gray-400 mb-0.5">Last Generated</p>
        <p className="text-sm font-semibold text-gray-700">
          {new Date(latest.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
        </p>
      </div>
      <div>
        <p className="text-xs text-gray-400 mb-1">Disclaimer Compliance</p>
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={cn('h-full rounded-full', pct === 100 ? 'bg-green-500' : 'bg-yellow-400')}
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="text-xs font-semibold text-gray-700">{pct}%</span>
        </div>
      </div>
    </div>
  );
}

// ─── Export Type Card ─────────────────────────────────────────────────────────

function ExportTypeCard({
  et,
  isGenerating,
  onGenerate,
}: {
  et: typeof EXPORT_TYPES[number];
  isGenerating: boolean;
  onGenerate: () => void;
}) {
  return (
    <div className={cn('border-2 rounded-xl overflow-hidden', et.bg)}>
      {/* Gradient accent bar */}
      <div className={cn('h-1 bg-gradient-to-r', et.accent)} />

      <div className="p-4 space-y-3">
        {/* Title row */}
        <div className="flex items-start gap-3">
          <div className={cn('w-8 h-8 rounded-lg bg-white/70 flex items-center justify-center shrink-0', et.text)}>
            <et.icon className="w-4 h-4" />
          </div>
          <div>
            <p className={cn('text-sm font-semibold', et.text)}>{et.title}</p>
            <p className="text-xs text-gray-500 mt-0.5">{et.description}</p>
          </div>
        </div>

        {/* What's included */}
        <div className="space-y-1">
          {et.includes.map((item, i) => (
            <div key={i} className="flex items-start gap-1.5">
              <CheckCircle className="w-3 h-3 text-gray-400 mt-0.5 shrink-0" />
              <p className="text-xs text-gray-600">{item}</p>
            </div>
          ))}
        </div>

        {/* Button / progress */}
        {isGenerating ? (
          <div className="w-full">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-medium text-gray-600">Generating…</span>
              <span className="text-xs text-gray-400">please wait</span>
            </div>
            <div className="h-1.5 w-full bg-white/50 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-gray-400 to-gray-500 rounded-full animate-[progress_1.5s_ease-in-out_infinite]" style={{ width: '60%' }} />
            </div>
          </div>
        ) : (
          <button
            className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-white/60 hover:bg-white/90 text-xs font-semibold transition-colors"
            onClick={onGenerate}
          >
            <Plus className="w-3.5 h-3.5" />
            Generate
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Previous Exports Table ──────────────────────────────────────────────────

function ExportRow({ exp, onDownload }: { exp: AuditExport; onDownload: () => void }) {
  const typeColor = TYPE_COLORS[exp.exportType] ?? 'bg-gray-100 text-gray-600';
  const typeLabel = TYPE_LABELS[exp.exportType] ?? exp.exportType;

  return (
    <tr className="hover:bg-gray-50 transition-colors group">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          {exp.status === 'approved' ? (
            <CheckCircle className="w-3.5 h-3.5 text-green-500 shrink-0" />
          ) : (
            <Clock className="w-3.5 h-3.5 text-yellow-500 shrink-0" />
          )}
          <span className={cn('text-xs font-medium px-2 py-0.5 rounded-md', typeColor)}>{typeLabel}</span>
        </div>
      </td>
      <td className="px-4 py-3">
        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded font-mono">{exp.framework}</span>
      </td>
      <td className="px-4 py-3">
        <span className={cn(
          'text-xs px-2 py-0.5 rounded-full font-medium capitalize',
          exp.status === 'approved' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700',
        )}>
          {exp.status}
        </span>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <Calendar className="w-3 h-3" />
          {new Date(exp.createdAt).toLocaleString()}
        </div>
      </td>
      <td className="px-4 py-3">
        {exp.disclaimerIncluded
          ? <span className="text-xs bg-green-50 text-green-700 border border-green-200 px-1.5 py-0.5 rounded">✓ Included</span>
          : <span className="text-xs bg-red-50 text-red-700 border border-red-200 px-1.5 py-0.5 rounded flex items-center gap-1"><AlertTriangle className="w-3 h-3" />Missing</span>
        }
      </td>
      <td className="px-4 py-3 text-right">
        <button
          className="opacity-0 group-hover:opacity-100 inline-flex items-center gap-1.5 text-xs font-medium text-brand-600 hover:text-brand-700 transition-all"
          onClick={onDownload}
        >
          <Download className="w-3.5 h-3.5" />
          Download PDF
        </button>
      </td>
    </tr>
  );
}

// ─── AI Executive Summary Modal ───────────────────────────────────────────────

type ExecSummary = {
  headline: string;
  executiveSummary: string;
  auditReadinessStatement: string;
  keyStrengths: string[];
  keyRisks: string[];
  managementAttestation: string;
  nextSteps: string[];
  metadata: { score: number | string; implemented: number; total: number; openHighRisks: number; overdueTasks: number };
  generatedAt: string;
};

function ExecutiveSummaryModal({ data, onClose }: { data: ExecSummary; onClose: () => void }) {
  const [copied, setCopied] = useState(false);

  function copyText() {
    const text = [
      `EXECUTIVE SUMMARY`,
      ``,
      data.headline,
      ``,
      `AUDIT READINESS STATEMENT`,
      data.auditReadinessStatement,
      ``,
      `OVERVIEW`,
      data.executiveSummary,
      ``,
      `KEY STRENGTHS`,
      ...data.keyStrengths.map((s) => `• ${s}`),
      ``,
      `KEY RISKS`,
      ...data.keyRisks.map((r) => `• ${r}`),
      ``,
      `MANAGEMENT ATTESTATION`,
      data.managementAttestation,
      ``,
      `NEXT STEPS`,
      ...data.nextSteps.map((s, i) => `${i + 1}. ${s}`),
      ``,
      `Generated: ${new Date(data.generatedAt).toLocaleString()}`,
    ].join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
          <div>
            <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-600" />
              AI Executive Summary
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">Readiness: {data.metadata.score}% · {data.metadata.implemented}/{data.metadata.total} controls</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={copyText}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors"
            >
              {copied ? <><Check className="w-3.5 h-3.5 text-green-600" />Copied!</> : <><Copy className="w-3.5 h-3.5" />Copy All</>}
            </button>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
          {/* Headline */}
          <div className="rounded-xl bg-purple-50 border border-purple-200 px-4 py-3">
            <p className="text-sm font-semibold text-purple-900">{data.headline}</p>
          </div>

          {/* Readiness Statement */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Audit Readiness Statement</p>
            <p className="text-sm text-gray-700 italic border-l-4 border-purple-200 pl-3">{data.auditReadinessStatement}</p>
          </div>

          {/* Executive Summary */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Executive Overview</p>
            <div className="text-sm text-gray-700 leading-relaxed space-y-2">
              {data.executiveSummary.split('\n\n').map((para, i) => (
                <p key={i}>{para}</p>
              ))}
            </div>
          </div>

          {/* Strengths & Risks side by side */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide mb-2">Key Strengths</p>
              <ul className="space-y-1.5">
                {data.keyStrengths.map((s, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-gray-600">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                    {s}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold text-red-700 uppercase tracking-wide mb-2">Key Risks</p>
              <ul className="space-y-1.5">
                {data.keyRisks.map((r, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-gray-600">
                    <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
                    {r}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Management Attestation */}
          <div className="rounded-xl bg-gray-50 border border-gray-200 px-4 py-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Management Attestation</p>
            <p className="text-sm text-gray-700 italic">{data.managementAttestation}</p>
            <div className="mt-3 pt-3 border-t border-gray-200 flex justify-between text-xs text-gray-400">
              <span>Signature: ___________________</span>
              <span>Date: ___________________</span>
            </div>
          </div>

          {/* Next Steps */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Next Steps</p>
            <ol className="space-y-1.5">
              {data.nextSteps.map((step, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                  <span className="w-5 h-5 rounded-full bg-purple-100 text-purple-700 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                  {step}
                </li>
              ))}
            </ol>
          </div>
        </div>

        <div className="px-6 py-3 border-t shrink-0">
          <p className="text-xs text-gray-400 text-center">
            AI-generated draft · Review before sharing · Generated {new Date(data.generatedAt).toLocaleString()}
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AuditExportsPage() {
  const qc = useQueryClient();
  const [generatingType, setGeneratingType] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortAsc, setSortAsc] = useState(false);
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [execSummary, setExecSummary] = useState<ExecSummary | null>(null);

  const generateExecSummary = useMutation({
    mutationFn: () => api.post('/audit-exports/ai-executive-summary').then((r: any) => r.data),
    onSuccess: (data: any) => setExecSummary(data),
  });

  const { data: exports = [], isLoading } = useQuery<AuditExport[]>({
    queryKey: ['audit-exports'],
    queryFn: () => api.get('/audit-exports').then((r: any) => r.data),
  });

  const generate = useMutation({
    mutationFn: (endpoint: string) => api.post(endpoint).then((r: any) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['audit-exports'] });
      setGeneratingType(null);
    },
    onError: () => setGeneratingType(null),
  });

  function handleGenerate(et: typeof EXPORT_TYPES[number]) {
    setGeneratingType(et.type);
    generate.mutate(et.endpoint);
  }

  async function downloadExport(exp: AuditExport) {
    const r = await api.get(`/audit-exports/${exp.id}`);
    const content = (r.data as any).content;
    const dateStr = new Date(exp.createdAt).toISOString().split('T')[0];

    try {
      let pdfDoc;
      if (exp.exportType === 'soc2_readiness') {
        pdfDoc = <Soc2ReadinessPdf data={content} />;
      } else if (exp.exportType === 'control_matrix') {
        pdfDoc = <ControlMatrixPdf data={content} />;
      } else if (exp.exportType === 'iso_soa') {
        pdfDoc = <IsoSoaPdf data={content} />;
      } else {
        // Fallback to JSON
        const blob = new Blob([JSON.stringify(content, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${exp.exportType}-${dateStr}.json`;
        a.click();
        URL.revokeObjectURL(url);
        return;
      }

      const blob = await pdf(pdfDoc).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${exp.exportType}-${dateStr}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      // Fallback to JSON on PDF error
      const blob = new Blob([JSON.stringify(content, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${exp.exportType}-${dateStr}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
  }

  function toggleSort(field: SortField) {
    if (sortField === field) setSortAsc((p) => !p);
    else { setSortField(field); setSortAsc(false); }
  }

  const uniqueTypes = Array.from(new Set(exports.map((e) => e.exportType)));

  const filteredExports = exports
    .filter((e) => typeFilter === 'all' || e.exportType === typeFilter)
    .sort((a, b) => {
      let cmp = 0;
      if (sortField === 'createdAt') cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      else if (sortField === 'exportType') cmp = a.exportType.localeCompare(b.exportType);
      else if (sortField === 'framework') cmp = a.framework.localeCompare(b.framework);
      return sortAsc ? cmp : -cmp;
    });

  function SortTh({ field, children }: { field: SortField; children: React.ReactNode }) {
    return (
      <th
        className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 cursor-pointer hover:text-gray-700 select-none"
        onClick={() => toggleSort(field)}
      >
        <span className="inline-flex items-center gap-1">
          {children}
          <ArrowUpDown className={cn('w-3 h-3', sortField === field ? 'text-brand-500' : 'text-gray-300')} />
        </span>
      </th>
    );
  }

  return (
    <div className="p-8 max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Audit Exports</h1>
          <p className="text-sm text-gray-500 mt-1">
            Generate audit-ready packages — all include a mandatory disclaimer
          </p>
        </div>
        <button
          className="shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-50 border border-purple-200 text-purple-700 text-sm font-medium hover:bg-purple-100 transition-colors disabled:opacity-60"
          onClick={() => generateExecSummary.mutate()}
          disabled={generateExecSummary.isPending}
        >
          {generateExecSummary.isPending
            ? <><span className="w-3.5 h-3.5 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />Drafting…</>
            : <><Sparkles className="w-3.5 h-3.5" />AI Executive Summary</>
          }
        </button>
      </div>

      {/* AI Executive Summary Modal */}
      {execSummary && (
        <ExecutiveSummaryModal data={execSummary} onClose={() => setExecSummary(null)} />
      )}

      {/* Disclaimer */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
        <p className="text-xs text-amber-800 leading-relaxed">
          <span className="font-semibold">Disclaimer: </span>
          All exports reflect internal readiness assessment only. They do not constitute an official
          SOC 2 audit opinion or ISO 27001 certification. Certification requires engagement with an
          accredited third-party auditor.
        </p>
      </div>

      {/* Export Health */}
      {!isLoading && exports.length > 0 && <ExportHealthBar exports={exports} />}

      {/* Generate Cards */}
      <div>
        <h2 className="text-sm font-semibold text-gray-900 mb-3">Generate New Export</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {EXPORT_TYPES.map((et) => (
            <ExportTypeCard
              key={et.type}
              et={et}
              isGenerating={generatingType === et.type}
              onGenerate={() => handleGenerate(et)}
            />
          ))}
        </div>
      </div>

      {/* Previous Exports Table */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-900">
            Previous Exports <span className="text-gray-400 font-normal">({exports.length})</span>
          </h2>

          {/* Type filter */}
          {uniqueTypes.length > 0 && (
            <div className="flex items-center gap-2">
              <Filter className="w-3.5 h-3.5 text-gray-400" />
              <select
                className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-500"
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
              >
                <option value="all">All types</option>
                {uniqueTypes.map((t) => (
                  <option key={t} value={t}>{TYPE_LABELS[t] ?? t}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-12 bg-gray-100 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : filteredExports.length === 0 ? (
          <div className="card p-12 text-center">
            <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-3">
              <Package className="w-6 h-6 text-gray-300" />
            </div>
            <p className="text-sm font-semibold text-gray-700 mb-1">No exports yet</p>
            <p className="text-xs text-gray-400">Generate your first export using the cards above.</p>
          </div>
        ) : (
          <div className="card overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <SortTh field="exportType">Type</SortTh>
                  <SortTh field="framework">Framework</SortTh>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">Status</th>
                  <SortTh field="createdAt">Generated</SortTh>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">Disclaimer</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredExports.map((exp) => (
                  <ExportRow key={exp.id} exp={exp} onDownload={() => downloadExport(exp)} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
