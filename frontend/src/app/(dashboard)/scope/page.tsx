'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { apiClient as api } from '@/lib/api/client';
import {
  Target, CheckCircle, Clock, AlertCircle, ChevronDown, ChevronRight,
  Calendar, Badge, RefreshCw, Sparkles, X, ShieldAlert, HelpCircle,
  Star, AlertTriangle,
} from 'lucide-react';
import { RadialBarChart, RadialBar, Tooltip as RechartsTip, ResponsiveContainer } from 'recharts';
import { cn } from '@/lib/utils';

// ─── Scope Review Types ────────────────────────────────────────────────────────

type ExclusionRisk = { system: string; risk: string; recommendation: string };
type AuditFaq = { question: string; suggestedAnswer: string };
type TscAdvisory = { selectedTscs: string[]; missingRecommended: string[]; rationale: string };
type ScopeReviewResult = {
  overallRisk: 'low' | 'medium' | 'high';
  riskSummary: string;
  exclusionRisks: ExclusionRisk[];
  tscAdvisory: TscAdvisory;
  auditFAQ: AuditFaq[];
  scopeGaps: string[];
  strengths: string[];
};

const RISK_CFG = {
  low:    { cls: 'bg-green-100 text-green-700',  label: 'Low Risk' },
  medium: { cls: 'bg-amber-100 text-amber-700',  label: 'Medium Risk' },
  high:   { cls: 'bg-red-100 text-red-700',      label: 'High Risk' },
};

function ScopeReviewPanel({ result, onClose }: { result: ScopeReviewResult; onClose: () => void }) {
  const risk = RISK_CFG[result.overallRisk] ?? RISK_CFG.medium;
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  return (
    <div className="border border-purple-200 rounded-xl bg-purple-50 p-5 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-purple-600 shrink-0" />
          <span className="text-sm font-semibold text-purple-900">AI Scope Review</span>
          <span className={cn('text-xs font-medium px-2 py-0.5 rounded', risk.cls)}>{risk.label}</span>
        </div>
        <button onClick={onClose} className="text-purple-400 hover:text-purple-600">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Summary */}
      {result.riskSummary && (
        <p className="text-sm text-gray-800 bg-white rounded-lg px-3 py-2.5 border border-purple-100">{result.riskSummary}</p>
      )}

      {/* Two-column: exclusion risks + scope gaps */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {result.exclusionRisks.length > 0 && (
          <div className="bg-white rounded-lg border border-orange-200 p-3">
            <div className="flex items-center gap-1.5 mb-2">
              <ShieldAlert className="w-3.5 h-3.5 text-orange-500" />
              <p className="text-xs font-semibold text-orange-700 uppercase tracking-wide">Exclusion risks</p>
            </div>
            <div className="space-y-2.5">
              {result.exclusionRisks.map((er, i) => (
                <div key={i} className="border-l-2 border-orange-200 pl-2">
                  <p className="text-xs font-semibold text-gray-700">{er.system}</p>
                  <p className="text-xs text-orange-700 mt-0.5">{er.risk}</p>
                  {er.recommendation && (
                    <p className="text-xs text-green-700 mt-0.5">→ {er.recommendation}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-3">
          {result.scopeGaps.length > 0 && (
            <div className="bg-white rounded-lg border border-red-200 p-3">
              <div className="flex items-center gap-1.5 mb-2">
                <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
                <p className="text-xs font-semibold text-red-700 uppercase tracking-wide">Possible scope gaps</p>
              </div>
              <ul className="space-y-1">
                {result.scopeGaps.map((g, i) => (
                  <li key={i} className="text-xs text-gray-700 flex gap-1.5">
                    <span className="text-red-400">•</span> {g}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {result.strengths.length > 0 && (
            <div className="bg-white rounded-lg border border-green-200 p-3">
              <div className="flex items-center gap-1.5 mb-2">
                <Star className="w-3.5 h-3.5 text-green-500" />
                <p className="text-xs font-semibold text-green-700 uppercase tracking-wide">Scope strengths</p>
              </div>
              <ul className="space-y-1">
                {result.strengths.map((s, i) => (
                  <li key={i} className="text-xs text-gray-700 flex gap-1.5">
                    <CheckCircle className="w-3 h-3 text-green-400 shrink-0 mt-0.5" /> {s}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* TSC Advisory */}
      {result.tscAdvisory.missingRecommended.length > 0 && (
        <div className="bg-white rounded-lg border border-blue-200 p-3">
          <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-1.5">Trust Service Categories</p>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {result.tscAdvisory.selectedTscs.map((t) => (
              <span key={t} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-100">{t}</span>
            ))}
            {result.tscAdvisory.missingRecommended.map((t) => (
              <span key={t} className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded border border-amber-200">+ {t} (recommended)</span>
            ))}
          </div>
          {result.tscAdvisory.rationale && (
            <p className="text-xs text-gray-600">{result.tscAdvisory.rationale}</p>
          )}
        </div>
      )}

      {/* Audit FAQ accordion */}
      {result.auditFAQ.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5">
            <HelpCircle className="w-3.5 h-3.5 text-purple-500" />
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Auditor questions to prepare for</p>
          </div>
          {result.auditFAQ.map((faq, i) => (
            <div key={i} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <button
                className="w-full flex items-start justify-between gap-2 px-3 py-2 text-left hover:bg-gray-50"
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
              >
                <p className="text-xs font-medium text-gray-800">{faq.question}</p>
                <ChevronDown className={cn('w-3.5 h-3.5 text-gray-400 shrink-0 transition-transform', openFaq === i && 'rotate-180')} />
              </button>
              {openFaq === i && (
                <div className="px-3 py-2 bg-purple-50 border-t border-gray-100">
                  <p className="text-xs text-gray-700">{faq.suggestedAnswer}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Types ─────────────────────────────────────────────────────────────────────

type Soc2Scope = {
  id: string;
  status: string;
  auditType: string;
  trustServiceCategories: string[];
  systemsInScope: Array<{ name: string; description: string }>;
  systemsOutOfScope: Array<{ name: string; reason: string }>;
  dataInScope: Array<{ type: string; description: string }>;
  ambiguousItems: Array<{ item: string; question: string }>;
  version: number;
  createdAt: string;
  approvedAt?: string;
};

type SoaEntry = {
  id: string;
  applicable: boolean;
  applicabilityRationale: string;
  implementationStatus: string;
  control: { code: string; title: string; framework: { type: string } };
};

type SoaFilter = 'all' | 'applicable' | 'not_applicable' | 'needs_review';

// ─── TSC config ───────────────────────────────────────────────────────────────

const TSC_CONFIG: Record<string, { bg: string; text: string; dot: string }> = {
  security:             { bg: 'bg-blue-100',   text: 'text-blue-800',   dot: 'bg-blue-500' },
  availability:         { bg: 'bg-green-100',  text: 'text-green-800',  dot: 'bg-green-500' },
  confidentiality:      { bg: 'bg-purple-100', text: 'text-purple-800', dot: 'bg-purple-500' },
  processing_integrity: { bg: 'bg-orange-100', text: 'text-orange-800', dot: 'bg-orange-500' },
  privacy:              { bg: 'bg-pink-100',   text: 'text-pink-800',   dot: 'bg-pink-500' },
};

const IMPL_STATUS_COLORS: Record<string, string> = {
  implemented:     'bg-green-100 text-green-700',
  in_progress:     'bg-blue-100 text-blue-700',
  not_started:     'bg-gray-100 text-gray-600',
  not_applicable:  'bg-gray-50 text-gray-400',
};

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const cfg = {
    approved:   { cls: 'bg-green-100 text-green-800', Icon: CheckCircle },
    draft:      { cls: 'bg-yellow-100 text-yellow-800', Icon: Clock },
    superseded: { cls: 'bg-gray-100 text-gray-500', Icon: AlertCircle },
  }[status] ?? { cls: 'bg-gray-100 text-gray-500', Icon: AlertCircle };

  return (
    <span className={cn('inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full', cfg.cls)}>
      <cfg.Icon className="w-3 h-3" />
      {status}
    </span>
  );
}

// ─── Coverage metrics row (SOC2) ──────────────────────────────────────────────

function Soc2CoverageRow({ scope }: { scope: Soc2Scope }) {
  const ambiguous = scope.ambiguousItems?.length ?? 0;
  return (
    <div className="grid grid-cols-3 gap-3 mb-4">
      <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
        <p className="text-xs text-blue-500 mb-1">Trust Service Categories</p>
        <div className="flex flex-wrap gap-1.5 mt-1">
          {scope.trustServiceCategories?.map((tsc) => {
            const cfg = TSC_CONFIG[tsc] ?? { bg: 'bg-gray-100', text: 'text-gray-700', dot: 'bg-gray-400' };
            return (
              <span key={tsc} className={cn('inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full', cfg.bg, cfg.text)}>
                <span className={cn('w-1.5 h-1.5 rounded-full', cfg.dot)} />
                {tsc.replace(/_/g, ' ')}
              </span>
            );
          })}
        </div>
      </div>

      <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3">
        <p className="text-xs text-green-500 mb-0.5">In-Scope Systems</p>
        <p className="text-2xl font-bold text-green-800">{scope.systemsInScope?.length ?? 0}</p>
      </div>

      <div className={cn(
        'border rounded-xl px-4 py-3',
        ambiguous > 0 ? 'bg-yellow-50 border-yellow-200' : 'bg-gray-50 border-gray-200',
      )}>
        <p className={cn('text-xs mb-0.5', ambiguous > 0 ? 'text-yellow-600' : 'text-gray-400')}>
          Ambiguous Items
        </p>
        <p className={cn('text-2xl font-bold', ambiguous > 0 ? 'text-yellow-800' : 'text-gray-500')}>
          {ambiguous}
        </p>
        {ambiguous > 0 && <p className="text-xs text-yellow-600 mt-0.5">Need human review</p>}
      </div>
    </div>
  );
}

// ─── ISO SoA coverage radial ──────────────────────────────────────────────────

function SoaCoverageChart({ soa }: { soa: SoaEntry[] }) {
  if (soa.length === 0) return null;
  const applicable = soa.filter((e) => e.applicable).length;
  const pct = Math.round((applicable / soa.length) * 100);
  const data = [{ name: 'Applicable', value: pct, fill: '#6366f1' }];

  return (
    <div className="flex items-center gap-5 bg-white border border-gray-200 rounded-xl px-5 py-4 shadow-sm mb-4">
      {/* Radial chart */}
      <div className="w-16 h-16 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart innerRadius="60%" outerRadius="100%" data={data} startAngle={90} endAngle={-270}>
            <RadialBar dataKey="value" cornerRadius={4} background={{ fill: '#f3f4f6' }} />
          </RadialBarChart>
        </ResponsiveContainer>
      </div>

      {/* Stats */}
      <div className="flex-1 grid grid-cols-3 gap-4">
        <div>
          <p className="text-xs text-gray-400 mb-0.5">Applicable</p>
          <p className="text-xl font-bold text-brand-700">{applicable}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400 mb-0.5">Not Applicable</p>
          <p className="text-xl font-bold text-gray-600">{soa.length - applicable}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400 mb-0.5">Coverage</p>
          <p className="text-xl font-bold text-gray-800">{pct}%</p>
        </div>
      </div>
    </div>
  );
}

// ─── SoA Row ──────────────────────────────────────────────────────────────────

function SoaRow({ entry, expanded, onToggle }: {
  entry: SoaEntry;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button
        className="w-full flex items-center gap-3 px-4 py-2.5 bg-white hover:bg-gray-50 text-left transition-colors"
        onClick={onToggle}
      >
        {expanded
          ? <ChevronDown className="w-3.5 h-3.5 text-gray-400 shrink-0" />
          : <ChevronRight className="w-3.5 h-3.5 text-gray-400 shrink-0" />}
        <span className={cn('w-2 h-2 rounded-full shrink-0', entry.applicable ? 'bg-green-500' : 'bg-gray-300')} />
        <span className="font-mono text-xs font-bold text-gray-600 shrink-0 w-16">{entry.control.code}</span>
        <span className="text-sm text-gray-800 flex-1 truncate">{entry.control.title}</span>
        <span className={cn(
          'text-xs px-2 py-0.5 rounded-full shrink-0 font-medium',
          entry.applicable ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500',
        )}>
          {entry.applicable ? '✓ Applicable' : '✗ N/A'}
        </span>
        {entry.implementationStatus && (
          <span className={cn(
            'text-xs px-2 py-0.5 rounded shrink-0',
            IMPL_STATUS_COLORS[entry.implementationStatus] ?? 'bg-gray-100 text-gray-600',
          )}>
            {entry.implementationStatus.replace(/_/g, ' ')}
          </span>
        )}
      </button>

      {expanded && (
        <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 space-y-3">
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Rationale</p>
            <p className="text-sm text-gray-700">{entry.applicabilityRationale || 'No rationale provided.'}</p>
          </div>
          {entry.implementationStatus && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Implementation</p>
              <span className={cn(
                'text-xs px-2.5 py-1 rounded-full font-medium capitalize',
                IMPL_STATUS_COLORS[entry.implementationStatus] ?? 'bg-gray-100 text-gray-600',
              )}>
                {entry.implementationStatus.replace(/_/g, ' ')}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ScopePage() {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<'soc2' | 'iso'>('soc2');
  const [soaFilter, setSoaFilter] = useState<SoaFilter>('all');
  const [expandedSoa, setExpandedSoa] = useState<Set<string>>(new Set());
  const [scopeReview, setScopeReview] = useState<ScopeReviewResult | null>(null);

  const scopeReviewMutation = useMutation({
    mutationFn: () => api.post('/scoping/ai-scope-review', {}).then((r: any) => r.data ?? r),
    onSuccess: (res) => setScopeReview(res),
  });

  const { data: soc2Scope } = useQuery<Soc2Scope>({
    queryKey: ['soc2-scope'],
    queryFn: () => api.get('/scoping/soc2/current').then((r: any) => r.data),
  });

  const { data: soa } = useQuery<SoaEntry[]>({
    queryKey: ['iso-soa'],
    queryFn: () => api.get('/scoping/iso/soa').then((r: any) => r.data),
    enabled: activeTab === 'iso',
  });

  const approveSoc2 = useMutation({
    mutationFn: (id: string) => api.patch(`/scoping/soc2/${id}/approve`).then((r: any) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['soc2-scope'] }),
  });

  const generateSoa = useMutation({
    mutationFn: () => api.post('/scoping/iso/soa/generate').then((r: any) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['iso-soa'] }),
  });

  function toggleSoa(id: string) {
    setExpandedSoa((p) => {
      const n = new Set(p);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }

  const soaList = soa ?? [];
  const filteredSoa = soaList.filter((e) => {
    if (soaFilter === 'applicable') return e.applicable;
    if (soaFilter === 'not_applicable') return !e.applicable;
    if (soaFilter === 'needs_review') return !e.applicabilityRationale;
    return true;
  });

  const soaTabCounts = {
    all: soaList.length,
    applicable: soaList.filter((e) => e.applicable).length,
    not_applicable: soaList.filter((e) => !e.applicable).length,
    needs_review: soaList.filter((e) => !e.applicabilityRationale).length,
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Scope Definition</h1>
          <p className="text-sm text-gray-500 mt-1">
            SOC 2 system scope · ISO 27001 ISMS scope · Statement of Applicability
          </p>
        </div>
        {activeTab === 'soc2' && (
          <button
            onClick={() => scopeReviewMutation.mutate()}
            disabled={scopeReviewMutation.isPending}
            className="flex items-center gap-2 text-sm font-medium px-4 py-2 bg-purple-50 text-purple-700 border border-purple-200 rounded-lg hover:bg-purple-100 transition-colors disabled:opacity-60 shrink-0"
          >
            {scopeReviewMutation.isPending ? (
              <span className="w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            {scopeReviewMutation.isPending ? 'Reviewing…' : 'AI Scope Review'}
          </button>
        )}
      </div>

      {/* Tab selector */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        {(['soc2', 'iso'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              'px-4 py-1.5 text-sm font-medium rounded-md transition-colors',
              activeTab === tab ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700',
            )}
          >
            {tab === 'soc2' ? 'SOC 2 Scope' : 'ISO 27001 / SoA'}
          </button>
        ))}
      </div>

      {/* ── SOC 2 Tab ── */}
      {activeTab === 'soc2' && (
        soc2Scope ? (
          <div className="space-y-4">
            {/* AI Scope Review panel */}
            {scopeReview && (
              <ScopeReviewPanel result={scopeReview} onClose={() => setScopeReview(null)} />
            )}

            {/* Coverage metrics */}
            <Soc2CoverageRow scope={soc2Scope} />

            <div className="card p-5">
              {/* Card header */}
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                  <h2 className="font-semibold text-gray-900">SOC 2 Scope</h2>
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-mono">
                    v{soc2Scope.version}
                  </span>
                  <StatusBadge status={soc2Scope.status} />
                </div>
                <div className="flex items-center gap-3">
                  {soc2Scope.createdAt && (
                    <div className="flex items-center gap-1.5 text-xs text-gray-400">
                      <Calendar className="w-3 h-3" />
                      {new Date(soc2Scope.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </div>
                  )}
                  {soc2Scope.status === 'draft' && (
                    <button
                      className="btn-primary text-sm"
                      onClick={() => approveSoc2.mutate(soc2Scope.id)}
                      disabled={approveSoc2.isPending}
                    >
                      {approveSoc2.isPending ? 'Approving…' : 'Approve Scope'}
                    </button>
                  )}
                </div>
              </div>

              <div className="space-y-1 mb-4">
                <p className="text-xs text-gray-500">Audit type: <span className="font-medium text-gray-700 capitalize">{soc2Scope.auditType ?? 'not set'}</span></p>
              </div>

              {/* Systems in scope */}
              {soc2Scope.systemsInScope?.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    Systems In Scope ({soc2Scope.systemsInScope.length})
                  </p>
                  <div className="space-y-1.5">
                    {soc2Scope.systemsInScope.map((s, i) => (
                      <div key={i} className="flex items-start gap-2 text-sm bg-green-50 border border-green-100 rounded-lg px-3 py-2">
                        <CheckCircle className="w-3.5 h-3.5 text-green-500 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-medium text-gray-900">{s.name}</span>
                          {s.description && <span className="text-gray-500"> — {s.description}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Systems out of scope */}
              {soc2Scope.systemsOutOfScope?.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    Out of Scope ({soc2Scope.systemsOutOfScope.length})
                  </p>
                  <div className="space-y-1.5">
                    {soc2Scope.systemsOutOfScope.map((s, i) => (
                      <div key={i} className="flex items-start gap-2 text-sm bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">
                        <AlertCircle className="w-3.5 h-3.5 text-gray-400 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-medium text-gray-700">{s.name}</span>
                          {s.reason && <span className="text-gray-400"> — {s.reason}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Ambiguous items */}
              {soc2Scope.ambiguousItems?.length > 0 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                  <p className="text-xs font-semibold text-yellow-800 mb-2 flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5" />
                    {soc2Scope.ambiguousItems.length} Items Require Human Review
                  </p>
                  <div className="space-y-1">
                    {soc2Scope.ambiguousItems.map((item, i) => (
                      <div key={i} className="text-sm text-yellow-700">
                        <span className="font-medium">{item.item}</span>: {item.question}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="card p-10 text-center">
            <Target className="w-10 h-10 mx-auto text-gray-300 mb-3" />
            <p className="text-gray-600 font-medium mb-1">No SOC 2 scope defined yet</p>
            <p className="text-sm text-gray-400">Run a compliance assessment to automatically define your system scope</p>
          </div>
        )
      )}

      {/* ── ISO 27001 / SoA Tab ── */}
      {activeTab === 'iso' && (
        <div className="space-y-4">
          {/* Coverage radial */}
          {soaList.length > 0 && <SoaCoverageChart soa={soaList} />}

          {/* Filter tabs + regenerate */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg">
              {(['all', 'applicable', 'not_applicable', 'needs_review'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setSoaFilter(f)}
                  className={cn(
                    'px-3 py-1 text-xs font-medium rounded-md transition-colors capitalize',
                    soaFilter === f ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700',
                  )}
                >
                  {f === 'not_applicable' ? 'N/A' : f.replace(/_/g, ' ')}
                  {' '}({soaTabCounts[f]})
                </button>
              ))}
            </div>
            <button
              className="btn-secondary text-sm flex items-center gap-1.5"
              onClick={() => generateSoa.mutate()}
              disabled={generateSoa.isPending}
            >
              <RefreshCw className={cn('w-3.5 h-3.5', generateSoa.isPending && 'animate-spin')} />
              {generateSoa.isPending ? 'Generating…' : 'Regenerate SoA'}
            </button>
          </div>

          {/* SoA list */}
          {filteredSoa.length > 0 ? (
            <div className="space-y-1.5">
              {filteredSoa.map((entry) => (
                <SoaRow
                  key={entry.id}
                  entry={entry}
                  expanded={expandedSoa.has(entry.id)}
                  onToggle={() => toggleSoa(entry.id)}
                />
              ))}
            </div>
          ) : (
            <div className="card p-10 text-center">
              <Target className="w-10 h-10 mx-auto text-gray-300 mb-3" />
              <p className="text-gray-600 font-medium mb-1">No Statement of Applicability generated yet</p>
              <button className="btn-primary mt-2" onClick={() => generateSoa.mutate()} disabled={generateSoa.isPending}>
                Generate SoA
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
