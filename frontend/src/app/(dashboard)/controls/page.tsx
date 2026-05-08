'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { controlsApi, ControlStatus } from '@/lib/api/controls';
import { HeatmapChart } from '@/components/charts/HeatmapChart';
import { ControlHealthMap } from '@/components/charts/ControlHealthMap';
import { CheckCircle, XCircle, AlertCircle, Clock, BarChart2, Plus, CheckSquare, RotateCcw, ArrowLeftRight, ChevronRight, Activity, Sparkles, X } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

const STATUS_CONFIG = {
  implemented:    { label: 'Implemented',  icon: CheckCircle,  cls: 'badge-passed' },
  in_progress:    { label: 'In Progress',  icon: Clock,        cls: 'badge-partial' },
  not_started:    { label: 'Not Started',  icon: XCircle,      cls: 'badge-failed' },
  failed:         { label: 'Failed',       icon: AlertCircle,  cls: 'badge-failed' },
  not_applicable: { label: 'N/A',          icon: Clock,        cls: 'badge-pending' },
} as const;

type Status = keyof typeof STATUS_CONFIG;

function ControlRow({ control }: { control: any }) {
  const status = (control.status ?? 'not_started') as Status;
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.not_started;
  const Icon = cfg.icon;

  // Detect crosswalk-credited controls from the notes field
  const isCrosswalkCredit = typeof control.notes === 'string' &&
    control.notes.toLowerCase().includes('crosswalk');
  const crosswalkType = isCrosswalkCredit
    ? (control.notes?.includes('equivalent') ? 'Equivalent' : 'Partial')
    : null;

  const controlId = control.controlId ?? control.control?.id;

  return (
    <tr className="border-b border-gray-100 hover:bg-gray-50 transition-colors group">
      <td className="px-4 py-3 text-xs font-mono text-gray-500 whitespace-nowrap">
        {control.control?.code}
      </td>
      <td className="px-4 py-3">
        {controlId ? (
          <Link href={`/controls/${controlId}`} className="group-hover:text-brand-600 transition-colors">
            <p className="text-sm font-medium text-gray-900 group-hover:text-brand-700 line-clamp-1">{control.control?.name ?? control.control?.title}</p>
            <p className="text-xs text-gray-400 line-clamp-1 mt-0.5">{control.control?.category}</p>
          </Link>
        ) : (
          <>
            <p className="text-sm font-medium text-gray-900 line-clamp-1">{control.control?.name ?? control.control?.title}</p>
            <p className="text-xs text-gray-400 line-clamp-1 mt-0.5">{control.control?.category}</p>
          </>
        )}
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-col gap-1">
          <span className={cfg.cls}>
            <Icon className="w-3 h-3 mr-1" />
            {cfg.label}
          </span>
          {isCrosswalkCredit && (
            <span
              title={control.notes}
              className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded bg-teal-50 text-teal-700 border border-teal-200 w-fit cursor-default"
            >
              <ArrowLeftRight className="w-2.5 h-2.5" />
              {crosswalkType} crosswalk
            </span>
          )}
        </div>
      </td>
      <td className="px-4 py-3 text-sm text-gray-700">
        {control.score != null ? `${control.score}%` : '—'}
      </td>
      <td className="px-4 py-3 text-xs text-gray-500">
        {control.assignee?.fullName ?? '—'}
      </td>
      <td className="px-4 py-3 text-right">
        {controlId && (
          <Link href={`/controls/${controlId}`} className="text-gray-300 hover:text-brand-600 transition-colors">
            <ChevronRight className="w-4 h-4" />
          </Link>
        )}
      </td>
    </tr>
  );
}

// ─── AI Test Analysis Modal ───────────────────────────────────────────────────

type TestAnalysis = {
  testId: string;
  name: string;
  controlCode: string;
  outcome: string;
  testedAt: string;
  rootCause: string;
  remediationSteps: string[];
  estimatedFixTime: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  quickFix: string;
};

const SEVERITY_CFG = {
  critical: 'bg-red-50 text-red-700 border-red-200',
  high:     'bg-orange-50 text-orange-700 border-orange-200',
  medium:   'bg-amber-50 text-amber-700 border-amber-200',
  low:      'bg-gray-50 text-gray-600 border-gray-200',
};

function TestAnalysisModal({ data, onClose }: {
  data: { failingCount: number; analyses: TestAnalysis[]; generatedAt: string };
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
          <div>
            <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-600" />
              AI Test Failure Analysis
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">{data.failingCount} failing test{data.failingCount !== 1 ? 's' : ''} analysed</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-4">
          {data.analyses.map((a) => (
            <div key={a.testId} className="border border-gray-200 rounded-xl overflow-hidden">
              <div className={cn('flex items-center justify-between px-4 py-3 border-b', SEVERITY_CFG[a.severity] ?? SEVERITY_CFG.medium)}>
                <div>
                  <span className="text-xs font-mono font-semibold mr-2">{a.controlCode}</span>
                  <span className="text-sm font-semibold">{a.name}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={cn('text-xs px-2 py-0.5 rounded-full border font-medium capitalize', SEVERITY_CFG[a.severity])}>
                    {a.severity}
                  </span>
                  {a.estimatedFixTime && (
                    <span className="text-xs text-gray-500">{a.estimatedFixTime}</span>
                  )}
                </div>
              </div>
              <div className="px-4 py-3 space-y-3">
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Root Cause</p>
                  <p className="text-sm text-gray-700">{a.rootCause}</p>
                </div>
                {a.quickFix && (
                  <div className="flex items-start gap-2 bg-purple-50 border border-purple-100 rounded-lg px-3 py-2">
                    <Sparkles className="w-3.5 h-3.5 text-purple-600 shrink-0 mt-0.5" />
                    <p className="text-xs font-medium text-purple-800">{a.quickFix}</p>
                  </div>
                )}
                {a.remediationSteps.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Remediation Steps</p>
                    <ol className="space-y-1">
                      {a.remediationSteps.map((step, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                          <span className="w-4 h-4 rounded-full bg-gray-100 text-gray-600 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                          {step}
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
        <div className="px-6 py-3 border-t shrink-0">
          <p className="text-xs text-gray-400 text-center">Generated {new Date(data.generatedAt).toLocaleString()}</p>
        </div>
      </div>
    </div>
  );
}

export default function ControlsPage() {
  const qc = useQueryClient();
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [showHealthMap, setShowHealthMap] = useState(false);
  const [testAnalysis, setTestAnalysis] = useState<any | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['controls', status],
    queryFn: () => controlsApi.list(status ? { status: status as ControlStatus } : undefined),
  });

  const { data: stats } = useQuery({
    queryKey: ['control-stats'],
    queryFn: () => controlsApi.getStats(),
  });

  const initControls = useMutation({
    mutationFn: () => controlsApi.initialize('soc2'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['controls'] });
      qc.invalidateQueries({ queryKey: ['control-stats'] });
    },
  });

  // AI test failure analysis
  const analyzeTests = useMutation({
    mutationFn: () => controlsApi.aiAnalyze(),
    onSuccess: (data) => setTestAnalysis(data),
  });

  const controls: any[] = data ?? [];
  const crosswalkCredited = controls.filter(
    (c) => typeof c.notes === 'string' && c.notes.toLowerCase().includes('crosswalk'),
  ).length;

  const filtered = search
    ? controls.filter(
        (c) =>
          c.control?.name?.toLowerCase().includes(search.toLowerCase()) ||
          c.control?.code?.toLowerCase().includes(search.toLowerCase()),
      )
    : controls;

  return (
    <div className="p-8 max-w-6xl">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Controls</h1>
          <p className="text-sm text-gray-500 mt-1">
            {stats?.implemented ?? 0} implemented · {stats?.inProgress ?? 0} in progress · {stats?.notStarted ?? 0} gaps
            {crosswalkCredited > 0 && (
              <span className="ml-2 text-teal-600">· {crosswalkCredited} auto-credited via crosswalk</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {controls.length > 0 && (
            <button
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-purple-50 border border-purple-200 text-purple-700 text-sm font-medium hover:bg-purple-100 transition-colors disabled:opacity-60"
              onClick={() => analyzeTests.mutate()}
              disabled={analyzeTests.isPending}
            >
              {analyzeTests.isPending
                ? <><span className="w-3.5 h-3.5 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />Analysing…</>
                : <><Sparkles className="w-3.5 h-3.5" />AI Analyze Tests</>
              }
            </button>
          )}
          <button
            className="btn-secondary flex items-center gap-2"
            onClick={() => setShowHealthMap((v) => !v)}
          >
            <Activity className="w-4 h-4" />
            {showHealthMap ? 'Hide' : 'Live'} health map
          </button>
          {controls.length === 0 && (
            <button
              className="btn-primary flex items-center gap-2"
              onClick={() => initControls.mutate()}
              disabled={initControls.isPending}
            >
              {initControls.isPending
                ? <><RotateCcw className="w-4 h-4 animate-spin" /> Initializing…</>
                : <><Plus className="w-4 h-4" /> Initialize SOC 2 Controls</>}
            </button>
          )}
        </div>
      </div>

      {showHealthMap && (
        <div className="card p-5 mb-6">
          <ControlHealthMap />
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3 mb-6">
        <input
          type="search"
          className="input max-w-xs"
          placeholder="Search controls…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="input w-44"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">All statuses</option>
          {Object.entries(STATUS_CONFIG).map(([val, { label }]) => (
            <option key={val} value={val}>{label}</option>
          ))}
        </select>
      </div>

      {/* Crosswalk info banner */}
      {crosswalkCredited > 0 && (
        <div className="flex items-start gap-2 mb-4 rounded-xl bg-teal-50 border border-teal-200 px-4 py-3">
          <ArrowLeftRight className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-teal-800">Multi-Framework Crosswalk Active</p>
            <p className="text-xs text-teal-700 mt-0.5">
              {crosswalkCredited} control{crosswalkCredited !== 1 ? 's were' : ' was'} automatically credited in another framework
              because an equivalent control is already implemented. No duplicate work needed.
            </p>
          </div>
        </div>
      )}

      {/* AI Test Analysis Modal */}
      {testAnalysis && (
        <TestAnalysisModal data={testAnalysis} onClose={() => setTestAnalysis(null)} />
      )}

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Code</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Control</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Score</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Owner</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-sm text-gray-400">
                    Loading controls…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center">
                      <CheckSquare className="w-10 h-10 text-gray-200 mb-3" />
                      <p className="text-sm font-medium text-gray-500 mb-1">
                        {search || status ? 'No controls match your filter' : 'No controls initialized yet'}
                      </p>
                      {!search && !status && (
                        <>
                          <p className="text-xs text-gray-400 mb-4">Initialize your SOC 2 control set to get started</p>
                          <button
                            className="btn-primary flex items-center gap-2 text-sm"
                            onClick={() => initControls.mutate()}
                            disabled={initControls.isPending}
                          >
                            {initControls.isPending
                              ? <><RotateCcw className="w-4 h-4 animate-spin" /> Initializing…</>
                              : <><Plus className="w-4 h-4" /> Initialize SOC 2 Controls</>}
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((c) => <ControlRow key={c.id} control={c} />)
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
