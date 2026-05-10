'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { gapAnalysisApi, ControlGap, GapSummary, CoverageMatrix } from '@/lib/api/gap-analysis';
import {
  AlertTriangle, ShieldAlert, ShieldCheck, ShieldX, ChevronDown, ChevronRight,
  FileText, FolderOpen, CheckSquare, Clock, Link2, Zap,
  TrendingUp, BarChart3, Filter, Search,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Severity badge ──────────────────────────────────────────────────────

function SeverityBadge({ severity }: { severity: string }) {
  const config: Record<string, { bg: string; text: string; label: string }> = {
    critical: { bg: 'bg-red-100', text: 'text-red-800', label: 'Critical' },
    high: { bg: 'bg-orange-100', text: 'text-orange-800', label: 'High' },
    medium: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Medium' },
    low: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Low' },
  };
  const c = config[severity] ?? config.low;
  return <span className={cn('px-2 py-0.5 text-xs font-semibold rounded-full', c.bg, c.text)}>{c.label}</span>;
}

// ── Gap type labels ──────────────────────────────────────────────────────

const GAP_TYPE_LABELS: Record<string, { icon: React.ElementType; label: string; color: string }> = {
  no_evidence: { icon: FolderOpen, label: 'No evidence', color: 'text-red-600' },
  insufficient_evidence: { icon: FolderOpen, label: 'Insufficient evidence', color: 'text-orange-600' },
  stale_evidence: { icon: Clock, label: 'Stale evidence', color: 'text-yellow-600' },
  no_policy: { icon: FileText, label: 'No policy', color: 'text-red-600' },
  draft_policy_only: { icon: FileText, label: 'Draft policy only', color: 'text-yellow-600' },
  control_not_implemented: { icon: ShieldX, label: 'Not implemented', color: 'text-red-600' },
  overdue_tasks: { icon: Clock, label: 'Overdue tasks', color: 'text-orange-600' },
  no_document_coverage: { icon: Link2, label: 'No linked document', color: 'text-gray-500' },
};

// ── Summary cards ──────────────────────────────────────────────────────

function SummaryCards({ summary }: { summary: GapSummary }) {
  const cards = [
    {
      label: 'Coverage',
      value: `${summary.coveragePercentage}%`,
      sub: `${summary.totalApplicableControls - summary.totalGaps} / ${summary.totalApplicableControls} controls`,
      icon: ShieldCheck,
      color: summary.coveragePercentage >= 75 ? 'text-green-600' : summary.coveragePercentage >= 50 ? 'text-yellow-600' : 'text-red-600',
      bg: summary.coveragePercentage >= 75 ? 'bg-green-50 border-green-200' : summary.coveragePercentage >= 50 ? 'bg-yellow-50 border-yellow-200' : 'bg-red-50 border-red-200',
    },
    {
      label: 'Critical Gaps',
      value: summary.criticalGaps,
      sub: 'Require immediate action',
      icon: ShieldAlert,
      color: summary.criticalGaps > 0 ? 'text-red-600' : 'text-green-600',
      bg: summary.criticalGaps > 0 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200',
    },
    {
      label: 'High Priority',
      value: summary.highGaps,
      sub: 'Address before audit',
      icon: AlertTriangle,
      color: summary.highGaps > 0 ? 'text-orange-600' : 'text-green-600',
      bg: summary.highGaps > 0 ? 'bg-orange-50 border-orange-200' : 'bg-green-50 border-green-200',
    },
    {
      label: 'Total Gaps',
      value: summary.totalGaps,
      sub: `${summary.mediumGaps} medium, ${summary.lowGaps} low`,
      icon: BarChart3,
      color: 'text-gray-700',
      bg: 'bg-gray-50 border-gray-200',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((c) => (
        <div key={c.label} className={cn('rounded-xl border-2 p-5', c.bg)}>
          <div className="flex items-center gap-2 mb-2">
            <c.icon className={cn('w-5 h-5', c.color)} />
            <span className="text-sm font-medium text-gray-600">{c.label}</span>
          </div>
          <div className={cn('text-3xl font-bold', c.color)}>{c.value}</div>
          <div className="text-xs text-gray-500 mt-1">{c.sub}</div>
        </div>
      ))}
    </div>
  );
}

// ── Gap type breakdown chart ────────────────────────────────────────────

function GapTypeBreakdown({ gapsByType, totalGaps }: { gapsByType: Record<string, number>; totalGaps: number }) {
  const entries = Object.entries(gapsByType).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) return null;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">Gap Types</h3>
      <div className="space-y-3">
        {entries.map(([type, count]) => {
          const config = GAP_TYPE_LABELS[type];
          const pct = totalGaps > 0 ? Math.round((count / totalGaps) * 100) : 0;
          const Icon = config?.icon ?? AlertTriangle;
          return (
            <div key={type} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <Icon className={cn('w-3.5 h-3.5', config?.color ?? 'text-gray-500')} />
                  <span className="text-gray-700">{config?.label ?? type}</span>
                </div>
                <span className="font-medium text-gray-900">{count}</span>
              </div>
              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-brand-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Top remediations ────────────────────────────────────────────────────

function TopRemediations({ actions }: { actions: GapSummary['topRemediations'] }) {
  if (actions.length === 0) return null;

  const effortColor = { low: 'bg-green-100 text-green-700', medium: 'bg-yellow-100 text-yellow-700', high: 'bg-red-100 text-red-700' };
  const impactColor = { low: 'bg-gray-100 text-gray-700', medium: 'bg-blue-100 text-blue-700', high: 'bg-purple-100 text-purple-700' };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
        <Zap className="w-4 h-4 text-brand-600" />
        Top Remediation Actions
      </h3>
      <div className="space-y-3">
        {actions.map((a, i) => (
          <div key={i} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-xs font-bold">
              {i + 1}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-800">{a.label}</p>
              <div className="flex items-center gap-2 mt-1.5">
                <span className={cn('px-1.5 py-0.5 text-[10px] font-medium rounded', effortColor[a.effort])}>
                  Effort: {a.effort}
                </span>
                <span className={cn('px-1.5 py-0.5 text-[10px] font-medium rounded', impactColor[a.impact])}>
                  Impact: {a.impact}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Coverage matrix ─────────────────────────────────────────────────────

function CoverageMatrixView({ matrices }: { matrices: CoverageMatrix[] }) {
  if (matrices.length === 0) return null;

  return (
    <div className="space-y-6">
      {matrices.map((matrix) => (
        <div key={matrix.framework} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-3 bg-gray-50 border-b border-gray-200">
            <h3 className="text-sm font-semibold text-gray-700">{matrix.framework} Coverage</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-4 py-2.5 text-gray-500 font-medium">Category</th>
                  <th className="text-center px-3 py-2.5 text-gray-500 font-medium">Controls</th>
                  <th className="text-center px-3 py-2.5 text-gray-500 font-medium">Implemented</th>
                  <th className="text-center px-3 py-2.5 text-gray-500 font-medium">Evidence</th>
                  <th className="text-center px-3 py-2.5 text-gray-500 font-medium">Policy</th>
                  <th className="text-center px-3 py-2.5 text-gray-500 font-medium">Documents</th>
                  <th className="text-center px-3 py-2.5 text-gray-500 font-medium">Coverage</th>
                </tr>
              </thead>
              <tbody>
                {matrix.categories.map((cat) => {
                  const color = cat.coverageScore >= 75 ? 'text-green-700' : cat.coverageScore >= 50 ? 'text-yellow-700' : 'text-red-700';
                  const barColor = cat.coverageScore >= 75 ? 'bg-green-500' : cat.coverageScore >= 50 ? 'bg-yellow-500' : 'bg-red-500';
                  return (
                    <tr key={cat.category} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-4 py-2.5 font-medium text-gray-800 max-w-[200px] truncate">{cat.category}</td>
                      <td className="text-center px-3 py-2.5 text-gray-600">{cat.totalControls}</td>
                      <td className="text-center px-3 py-2.5">
                        <CellRatio n={cat.implemented} total={cat.totalControls} />
                      </td>
                      <td className="text-center px-3 py-2.5">
                        <CellRatio n={cat.withEvidence} total={cat.totalControls} />
                      </td>
                      <td className="text-center px-3 py-2.5">
                        <CellRatio n={cat.withPolicy} total={cat.totalControls} />
                      </td>
                      <td className="text-center px-3 py-2.5">
                        <CellRatio n={cat.withDocument} total={cat.totalControls} />
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div className={cn('h-full rounded-full', barColor)} style={{ width: `${cat.coverageScore}%` }} />
                          </div>
                          <span className={cn('text-xs font-bold w-8 text-right', color)}>{cat.coverageScore}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}

function CellRatio({ n, total }: { n: number; total: number }) {
  const pct = total > 0 ? Math.round((n / total) * 100) : 0;
  const color = pct >= 75 ? 'text-green-700' : pct >= 50 ? 'text-yellow-700' : pct > 0 ? 'text-orange-700' : 'text-red-600';
  return (
    <span className={cn('text-xs font-medium', color)}>
      {n}/{total}
    </span>
  );
}

// ── Individual gap row ──────────────────────────────────────────────────

function GapRow({ gap }: { gap: ControlGap }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border border-gray-100 rounded-lg bg-white overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
      >
        {expanded ? <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" /> : <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-brand-600 bg-brand-50 px-1.5 py-0.5 rounded">{gap.controlCode}</span>
            <span className="text-sm font-medium text-gray-800 truncate">{gap.controlTitle}</span>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-gray-400">{gap.frameworkName}</span>
            <span className="text-xs text-gray-300">|</span>
            <span className="text-xs text-gray-400">{gap.controlCategory}</span>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="flex gap-1.5">
            {gap.gapTypes.slice(0, 3).map((gt) => {
              const config = GAP_TYPE_LABELS[gt];
              if (!config) return null;
              const Icon = config.icon;
              return <Icon key={gt} className={cn('w-3.5 h-3.5', config.color)} title={config.label} />;
            })}
            {gap.gapTypes.length > 3 && (
              <span className="text-xs text-gray-400">+{gap.gapTypes.length - 3}</span>
            )}
          </div>
          <SeverityBadge severity={gap.severity} />
          <div className="w-16 text-right">
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full',
                  gap.coverageScore >= 60 ? 'bg-yellow-500' : gap.coverageScore >= 30 ? 'bg-orange-500' : 'bg-red-500',
                )}
                style={{ width: `${gap.coverageScore}%` }}
              />
            </div>
            <span className="text-[10px] text-gray-400">{gap.coverageScore}%</span>
          </div>
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t border-gray-100 bg-gray-50">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
            {/* Gap details */}
            <div>
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Gaps Found</h4>
              <div className="space-y-1.5">
                {gap.gapTypes.map((gt) => {
                  const config = GAP_TYPE_LABELS[gt];
                  if (!config) return null;
                  const Icon = config.icon;
                  return (
                    <div key={gt} className="flex items-center gap-2 text-sm">
                      <Icon className={cn('w-3.5 h-3.5', config.color)} />
                      <span className="text-gray-700">{config.label}</span>
                    </div>
                  );
                })}
              </div>

              <div className="grid grid-cols-2 gap-3 mt-4">
                <div className="bg-white rounded-lg p-2.5 border border-gray-200">
                  <div className="text-xs text-gray-500">Evidence</div>
                  <div className="text-lg font-bold text-gray-800">{gap.evidenceCount}<span className="text-sm text-gray-400 font-normal">/{gap.evidenceRequired}</span></div>
                  {gap.staleEvidenceCount > 0 && <div className="text-[10px] text-yellow-600">{gap.staleEvidenceCount} stale</div>}
                </div>
                <div className="bg-white rounded-lg p-2.5 border border-gray-200">
                  <div className="text-xs text-gray-500">Policies</div>
                  <div className="text-lg font-bold text-gray-800">{gap.policyCount}<span className="text-sm text-gray-400 font-normal">/{gap.policyRequired}</span></div>
                  <div className="text-[10px]">
                    {gap.hasApprovedPolicy ? <span className="text-green-600">Approved</span> : gap.policyCount > 0 ? <span className="text-yellow-600">Draft</span> : <span className="text-red-600">None</span>}
                  </div>
                </div>
              </div>
            </div>

            {/* Remediation actions */}
            <div>
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Recommended Actions</h4>
              <div className="space-y-2">
                {gap.remediationActions.map((action, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm bg-white rounded-lg p-2.5 border border-gray-200">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-[10px] font-bold mt-0.5">
                      {i + 1}
                    </span>
                    <div>
                      <p className="text-gray-700">{action.label}</p>
                      <div className="flex gap-1.5 mt-1">
                        <span className={cn('px-1 py-0.5 text-[9px] font-medium rounded',
                          action.effort === 'low' ? 'bg-green-100 text-green-700' : action.effort === 'medium' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
                        )}>Effort: {action.effort}</span>
                        <span className={cn('px-1 py-0.5 text-[9px] font-medium rounded',
                          action.impact === 'high' ? 'bg-purple-100 text-purple-700' : action.impact === 'medium' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'
                        )}>Impact: {action.impact}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main page ───────────────────────────────────────────────────────────

export default function GapsPage() {
  const [tab, setTab] = useState<'gaps' | 'coverage'>('gaps');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const { data: gapData, isLoading: gapsLoading } = useQuery({
    queryKey: ['gap-analysis'],
    queryFn: () => gapAnalysisApi.analyze(),
  });

  const { data: coverageData, isLoading: coverageLoading } = useQuery({
    queryKey: ['gap-coverage'],
    queryFn: () => gapAnalysisApi.getCoverageMatrix(),
    enabled: tab === 'coverage',
  });

  const filteredGaps = gapData?.gaps.filter((g) => {
    if (severityFilter !== 'all' && g.severity !== severityFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return g.controlCode.toLowerCase().includes(q) ||
        g.controlTitle.toLowerCase().includes(q) ||
        g.controlCategory.toLowerCase().includes(q);
    }
    return true;
  }) ?? [];

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <TrendingUp className="w-6 h-6 text-brand-600" />
          Compliance Gap Analysis
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Identify gaps in your compliance posture and get actionable remediation recommendations
        </p>
      </div>

      {/* Summary cards */}
      {gapData && <SummaryCards summary={gapData.summary} />}

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        <button
          onClick={() => setTab('gaps')}
          className={cn('px-4 py-2 text-sm font-medium rounded-md transition-colors',
            tab === 'gaps' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          )}
        >
          Gap Details
        </button>
        <button
          onClick={() => setTab('coverage')}
          className={cn('px-4 py-2 text-sm font-medium rounded-md transition-colors',
            tab === 'coverage' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          )}
        >
          Coverage Matrix
        </button>
      </div>

      {tab === 'gaps' && (
        <>
          {/* Filters + Top Remediations side by side */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-1">
              {gapData && <GapTypeBreakdown gapsByType={gapData.summary.gapsByType} totalGaps={gapData.summary.totalGaps} />}
            </div>
            <div className="lg:col-span-2">
              {gapData && <TopRemediations actions={gapData.summary.topRemediations} />}
            </div>
          </div>

          {/* Filter bar */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search controls..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <Filter className="w-4 h-4 text-gray-400" />
              {['all', 'critical', 'high', 'medium', 'low'].map((sev) => (
                <button
                  key={sev}
                  onClick={() => setSeverityFilter(sev)}
                  className={cn(
                    'px-3 py-1.5 text-xs font-medium rounded-full border transition-colors',
                    severityFilter === sev
                      ? 'bg-brand-50 border-brand-300 text-brand-700'
                      : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50',
                  )}
                >
                  {sev === 'all' ? 'All' : sev.charAt(0).toUpperCase() + sev.slice(1)}
                  {sev !== 'all' && gapData && (
                    <span className="ml-1 opacity-70">
                      ({gapData.gaps.filter((g) => g.severity === sev).length})
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Gap list */}
          {gapsLoading ? (
            <div className="text-center py-12 text-gray-400">Loading gap analysis...</div>
          ) : filteredGaps.length === 0 ? (
            <div className="text-center py-12">
              <ShieldCheck className="w-12 h-12 text-green-400 mx-auto mb-3" />
              <p className="text-lg font-medium text-gray-700">
                {gapData?.summary.totalGaps === 0 ? 'No gaps found!' : 'No gaps match your filters'}
              </p>
              <p className="text-sm text-gray-400">
                {gapData?.summary.totalGaps === 0 ? 'All applicable controls are fully covered.' : 'Try adjusting your search or severity filter.'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="text-xs text-gray-500 px-1">
                Showing {filteredGaps.length} of {gapData?.summary.totalGaps} gaps
              </div>
              {filteredGaps.map((gap) => (
                <GapRow key={gap.controlId} gap={gap} />
              ))}
            </div>
          )}
        </>
      )}

      {tab === 'coverage' && (
        coverageLoading ? (
          <div className="text-center py-12 text-gray-400">Loading coverage matrix...</div>
        ) : coverageData ? (
          <CoverageMatrixView matrices={coverageData} />
        ) : null
      )}
    </div>
  );
}
