'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { apiClient as api } from '@/lib/api/client';
import {
  Download, Shield, FileText, Table, Plus, CheckCircle, Clock,
  Calendar, Package, AlertTriangle, ChevronDown, ArrowUpDown, Filter,
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
          Download JSON
        </button>
      </td>
    </tr>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AuditExportsPage() {
  const qc = useQueryClient();
  const [generatingType, setGeneratingType] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortAsc, setSortAsc] = useState(false);
  const [typeFilter, setTypeFilter] = useState<string>('all');

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

  function downloadExport(exp: AuditExport) {
    api.get(`/audit-exports/${exp.id}`).then((r) => {
      const blob = new Blob([JSON.stringify((r.data as any).content, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${exp.exportType}-${new Date(exp.createdAt).toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    });
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
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Audit Exports</h1>
        <p className="text-sm text-gray-500 mt-1">
          Generate audit-ready packages — all include a mandatory disclaimer
        </p>
      </div>

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
