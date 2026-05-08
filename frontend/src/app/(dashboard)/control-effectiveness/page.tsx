'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { teamApi } from '@/lib/api/team';
import {
  Activity, CheckCircle2, XCircle, AlertCircle, RefreshCw,
  Loader2, ChevronDown, ChevronRight, Clock,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

type SampleResult = 'PASS' | 'FAIL' | 'PARTIAL';

const RESULT_CONFIG: Record<SampleResult, { label: string; cls: string; dot: string; icon: any }> = {
  PASS:    { label: 'Pass',    cls: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-400', icon: CheckCircle2 },
  FAIL:    { label: 'Fail',    cls: 'bg-red-100 text-red-700',         dot: 'bg-red-400',     icon: XCircle },
  PARTIAL: { label: 'Partial', cls: 'bg-amber-100 text-amber-700',     dot: 'bg-amber-400',   icon: AlertCircle },
};

// ─── Timeline dots ────────────────────────────────────────────────────────────

function TimelineDots({ samples }: { samples: any[] }) {
  const recent = [...samples].reverse().slice(-12); // last 12 samples, oldest first
  if (recent.length === 0) return <span className="text-xs text-gray-300 italic">No samples yet</span>;
  return (
    <div className="flex items-center gap-1">
      {recent.map((s: any, i) => {
        const cfg = RESULT_CONFIG[s.result as SampleResult] ?? RESULT_CONFIG.PARTIAL;
        return (
          <div
            key={s.id ?? i}
            title={`${s.result} — ${new Date(s.sampledAt).toLocaleDateString()}`}
            className={cn('w-2.5 h-2.5 rounded-full shrink-0', cfg.dot)}
          />
        );
      })}
    </div>
  );
}

// ─── Control Effectiveness Row ────────────────────────────────────────────────

function ControlRow({
  row,
  onSample,
  samplingId,
}: {
  row: any;
  onSample: (controlId: string) => void;
  samplingId: string | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const cfg = RESULT_CONFIG[row.latestResult as SampleResult] ?? RESULT_CONFIG.PARTIAL;
  const Icon = cfg.icon;
  const isSampling = samplingId === row.controlId;

  const passRate = row.passRate90d ?? null;
  const passRateColor =
    passRate === null ? 'text-gray-400' :
    passRate >= 80     ? 'text-emerald-600' :
    passRate >= 50     ? 'text-amber-600'   :
                         'text-red-600';

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <div
        className="flex items-center gap-4 p-4 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        <Icon className={cn('w-4 h-4 shrink-0', cfg.cls.split(' ')[1])} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-semibold text-brand-700 bg-brand-50 px-1.5 py-0.5 rounded">
              {row.control?.code ?? '—'}
            </span>
            <span className="text-sm font-medium text-gray-800 truncate">{row.control?.title ?? 'Unknown'}</span>
          </div>
          <div className="flex items-center gap-3 mt-1.5">
            <TimelineDots samples={row.history ?? []} />
            {row.latestSampledAt && (
              <span className="text-xs text-gray-400">
                Last: {new Date(row.latestSampledAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {passRate !== null && (
            <div className="text-right">
              <p className={cn('text-sm font-bold', passRateColor)}>{passRate}%</p>
              <p className="text-xs text-gray-400">90-day pass</p>
            </div>
          )}
          <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', cfg.cls)}>
            {cfg.label}
          </span>
          <button
            className="btn-secondary text-xs py-1.5 px-2.5 flex items-center gap-1.5"
            onClick={(e) => { e.stopPropagation(); onSample(row.controlId); }}
            disabled={isSampling}
          >
            {isSampling ? <Loader2 className="w-3 h-3 animate-spin" /> : <Activity className="w-3 h-3" />}
            Sample
          </button>
          {expanded ? <ChevronDown className="w-3.5 h-3.5 text-gray-400" /> : <ChevronRight className="w-3.5 h-3.5 text-gray-400" />}
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4 pt-0 border-t border-gray-100 bg-gray-50/50">
          <p className="text-xs font-semibold text-gray-600 mt-3 mb-2">Sample History</p>
          {(row.history ?? []).length === 0 ? (
            <p className="text-xs text-gray-400">No samples recorded yet.</p>
          ) : (
            <div className="space-y-1.5">
              {(row.history ?? []).slice(0, 10).map((s: any, i: number) => {
                const scfg = RESULT_CONFIG[s.result as SampleResult] ?? RESULT_CONFIG.PARTIAL;
                const SIcon = scfg.icon;
                return (
                  <div key={s.id ?? i} className="flex items-start gap-2.5 text-xs">
                    <SIcon className={cn('w-3.5 h-3.5 shrink-0 mt-0.5', scfg.cls.split(' ')[1])} />
                    <span className="text-gray-500 w-20 shrink-0">
                      {new Date(s.sampledAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}
                    </span>
                    <span className={cn('font-medium shrink-0', scfg.cls.split(' ')[1])}>{s.result}</span>
                    {s.notes && <span className="text-gray-400">{s.notes}</span>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ControlEffectivenessPage() {
  const qc = useQueryClient();
  const [samplingId, setSamplingId] = useState<string | null>(null);
  const [batchResult, setBatchResult] = useState<any>(null);

  const { data: summary, isLoading } = useQuery({
    queryKey: ['control-effectiveness-summary'],
    queryFn: teamApi.getControlEffectivenessSummary,
  });

  // Per-control sample history (lazy — loaded when we have the summary)
  const { data: allSamples = [] } = useQuery({
    queryKey: ['control-effectiveness-samples'],
    queryFn: () => teamApi.getControlEffectivenessSamples(),
    enabled: !!summary,
  });

  // Build history lookup
  const historyByControl = (allSamples as any[]).reduce((acc: Record<string, any[]>, s) => {
    if (!acc[s.controlId]) acc[s.controlId] = [];
    acc[s.controlId].push(s);
    return acc;
  }, {});

  const sampleOne = useMutation({
    mutationFn: ({ controlId }: { controlId: string }) =>
      teamApi.sampleControl(controlId),
    onMutate: ({ controlId }) => setSamplingId(controlId),
    onSettled: () => {
      setSamplingId(null);
      qc.invalidateQueries({ queryKey: ['control-effectiveness-summary'] });
      qc.invalidateQueries({ queryKey: ['control-effectiveness-samples'] });
    },
  });

  const batchSample = useMutation({
    mutationFn: teamApi.runBatchSample,
    onSuccess: (data) => {
      setBatchResult(data);
      qc.invalidateQueries({ queryKey: ['control-effectiveness-summary'] });
      qc.invalidateQueries({ queryKey: ['control-effectiveness-samples'] });
    },
  });

  const controls: any[] = (summary?.controls ?? []).map((row: any) => ({
    ...row,
    history: (historyByControl[row.controlId] ?? []).sort(
      (a: any, b: any) => new Date(b.sampledAt).getTime() - new Date(a.sampledAt).getTime()
    ),
  }));

  return (
    <div className="p-6 max-w-screen-xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Control Operating Effectiveness</h1>
          <p className="text-sm text-gray-500 mt-0.5">ISO A.5.35 · Independent assurance reviews · SOC 2 CC4.1</p>
        </div>
        <button
          className="btn-primary flex items-center gap-2 text-sm"
          onClick={() => batchSample.mutate()}
          disabled={batchSample.isPending}
        >
          {batchSample.isPending
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : <RefreshCw className="w-4 h-4" />}
          Run Batch Sample
        </button>
      </div>

      {/* Batch result banner */}
      {batchResult && (
        <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl px-4 py-3 mb-4">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          Sampled {batchResult.sampled} controls
          {batchResult.evidenceId && ' · Evidence generated (ISO A.5.35)'}
          <button
            onClick={() => setBatchResult(null)}
            className="ml-auto p-0.5 rounded hover:bg-emerald-100"
          >
            ✕
          </button>
        </div>
      )}

      {/* Stats */}
      {summary && (
        <div className="grid grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Controls Sampled', value: summary.total,   icon: Activity,      color: 'text-brand-600'   },
            { label: 'Passing',          value: summary.passing, icon: CheckCircle2,  color: 'text-emerald-600' },
            { label: 'Failing',          value: summary.failing, icon: XCircle,       color: 'text-red-600'     },
            { label: 'Partial',          value: summary.partial, icon: AlertCircle,   color: 'text-amber-600'   },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <Icon className={cn('w-4 h-4', color)} />
                <span className="text-xs text-gray-500">{label}</span>
              </div>
              <p className={cn('text-2xl font-bold', color)}>{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-4 mb-4 text-xs text-gray-500">
        <span className="font-medium">Timeline key:</span>
        {Object.entries(RESULT_CONFIG).map(([k, v]) => (
          <span key={k} className="flex items-center gap-1">
            <span className={cn('w-2.5 h-2.5 rounded-full', v.dot)} />
            {v.label}
          </span>
        ))}
        <span className="ml-auto flex items-center gap-1">
          <Clock className="w-3.5 h-3.5" /> Dots = last 12 samples (oldest→newest)
        </span>
      </div>

      {/* Controls list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-5 h-5 animate-spin text-brand-600" />
        </div>
      ) : controls.length === 0 ? (
        <div className="text-center py-16">
          <Activity className="w-10 h-10 mx-auto mb-3 text-gray-200" />
          <p className="text-sm font-medium text-gray-500">No effectiveness samples yet</p>
          <p className="text-xs text-gray-400 mt-1">
            Click "Run Batch Sample" to evaluate your controls against current evidence and tasks.
          </p>
          <button
            className="btn-primary text-xs mt-4 flex items-center gap-1.5 mx-auto"
            onClick={() => batchSample.mutate()}
            disabled={batchSample.isPending}
          >
            {batchSample.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            Run Batch Sample
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {controls.map((row) => (
            <ControlRow
              key={row.controlId}
              row={row}
              onSample={(controlId) => sampleOne.mutate({ controlId })}
              samplingId={samplingId}
            />
          ))}
        </div>
      )}
    </div>
  );
}
