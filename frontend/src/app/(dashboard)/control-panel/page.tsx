'use client';

import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient as api } from '@/lib/api/client';
import { formatMs, formatCurrency, formatRelative } from '@/lib/utils';
import {
  Zap, CheckCircle, XCircle, Clock, AlertCircle, ChevronRight,
  ArrowRight, RotateCcw, List, Copy, Check, ChevronDown, Filter,
  Sparkles, X, AlertTriangle, TrendingDown, DollarSign, Wrench,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTip, ResponsiveContainer, Cell,
} from 'recharts';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

type DiagnoseIssue = {
  agentName: string;
  issueType: string;
  severity: string;
  description: string;
  rootCause: string;
  fix: string;
};

type DiagnoseResult = {
  workflowId: string;
  workflowName: string;
  overallHealth: 'healthy' | 'degraded' | 'failed';
  summary: string;
  issues: DiagnoseIssue[];
  bottleneck: string | null;
  costOptimizations: string[];
  recommendations: string[];
  stats: { totalCostUsd: number; totalDurationMs: number; failedCount: number; totalAgents: number };
};

const HEALTH_CFG = {
  healthy:  { cls: 'bg-green-100 text-green-700',  label: 'Healthy' },
  degraded: { cls: 'bg-amber-100 text-amber-700',  label: 'Degraded' },
  failed:   { cls: 'bg-red-100 text-red-700',      label: 'Failed' },
};

const SEVERITY_CFG: Record<string, string> = {
  critical: 'bg-red-100 text-red-700',
  high:     'bg-orange-100 text-orange-700',
  medium:   'bg-amber-100 text-amber-700',
  low:      'bg-blue-100 text-blue-700',
};

function DiagnosePanel({ result, onClose }: { result: DiagnoseResult; onClose: () => void }) {
  const health = HEALTH_CFG[result.overallHealth] ?? HEALTH_CFG.degraded;
  return (
    <div className="card border-purple-200 bg-purple-50 p-4 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-purple-600 shrink-0" />
          <span className="text-sm font-semibold text-purple-900">AI Workflow Diagnosis</span>
          <span className={cn('text-xs font-medium px-2 py-0.5 rounded', health.cls)}>{health.label}</span>
        </div>
        <button onClick={onClose} className="text-purple-400 hover:text-purple-600">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Summary */}
      {result.summary && (
        <p className="text-sm text-gray-800 bg-white rounded-lg px-3 py-2 border border-purple-100">{result.summary}</p>
      )}

      {/* Issues */}
      {result.issues.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Issues found</p>
          {result.issues.map((issue, i) => (
            <div key={i} className="bg-white rounded-lg border border-gray-200 p-3 space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-xs font-bold text-gray-700">{issue.agentName}</span>
                <span className={cn('text-xs px-1.5 py-0.5 rounded font-medium', SEVERITY_CFG[issue.severity] ?? SEVERITY_CFG.medium)}>
                  {issue.severity}
                </span>
                <span className="text-xs text-gray-400">{issue.issueType.replace(/_/g, ' ')}</span>
              </div>
              <p className="text-xs text-gray-700">{issue.description}</p>
              {issue.rootCause && (
                <p className="text-xs text-amber-700 flex gap-1"><AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" /><span><strong>Root cause:</strong> {issue.rootCause}</span></p>
              )}
              {issue.fix && (
                <p className="text-xs text-green-700 flex gap-1"><Wrench className="w-3 h-3 mt-0.5 shrink-0" /><span><strong>Fix:</strong> {issue.fix}</span></p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Two-column: cost optimizations + recommendations */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {result.costOptimizations.length > 0 && (
          <div className="bg-white rounded-lg border border-gray-200 p-3">
            <div className="flex items-center gap-1.5 mb-2">
              <DollarSign className="w-3.5 h-3.5 text-green-500" />
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Cost optimizations</p>
            </div>
            <ul className="space-y-1.5">
              {result.costOptimizations.map((tip, i) => (
                <li key={i} className="text-xs text-gray-700 flex gap-1.5">
                  <TrendingDown className="w-3 h-3 text-green-400 shrink-0 mt-0.5" /> {tip}
                </li>
              ))}
            </ul>
          </div>
        )}
        {result.recommendations.length > 0 && (
          <div className="bg-white rounded-lg border border-gray-200 p-3">
            <div className="flex items-center gap-1.5 mb-2">
              <CheckCircle className="w-3.5 h-3.5 text-blue-500" />
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Recommendations</p>
            </div>
            <ol className="space-y-1.5">
              {result.recommendations.map((r, i) => (
                <li key={i} className="text-xs text-gray-700 flex gap-1.5">
                  <span className="font-bold text-blue-500 shrink-0">{i + 1}.</span> {r}
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>

      {result.bottleneck && (
        <p className="text-xs text-gray-500 flex gap-1.5 items-center">
          <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
          <span>Bottleneck: <strong className="font-mono">{result.bottleneck}</strong></span>
        </p>
      )}
    </div>
  );
}

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_COLOR: Record<string, string> = {
  completed: 'text-success-600 bg-success-50 border-success-200',
  failed:    'text-danger-600 bg-danger-50 border-danger-200',
  running:   'text-brand-600 bg-brand-50 border-brand-200',
  pending:   'text-gray-500 bg-gray-50 border-gray-200',
  skipped:   'text-gray-400 bg-gray-50 border-gray-100',
};
const STATUS_ICON: Record<string, React.ElementType> = {
  completed: CheckCircle,
  failed: XCircle,
  running: Zap,
  pending: Clock,
  skipped: AlertCircle,
};

// ─── Event type config ────────────────────────────────────────────────────────

const EVENT_CONFIG: Record<string, { cls: string; dot: string }> = {
  job_enqueued:         { cls: 'text-gray-500',    dot: 'bg-gray-300' },
  job_started:          { cls: 'text-brand-600',   dot: 'bg-brand-400' },
  job_completed:        { cls: 'text-success-600', dot: 'bg-success-400' },
  job_failed:           { cls: 'text-danger-600',  dot: 'bg-danger-400' },
  job_retried:          { cls: 'text-warning-600', dot: 'bg-warning-400' },
  checkpoint_created:   { cls: 'text-warning-700', dot: 'bg-warning-500' },
  checkpoint_resolved:  { cls: 'text-success-700', dot: 'bg-success-500' },
  state_updated:        { cls: 'text-gray-500',    dot: 'bg-gray-300' },
  replay_triggered:     { cls: 'text-purple-600',  dot: 'bg-purple-400' },
};

// ─── SVG Pipeline Canvas ──────────────────────────────────────────────────────

const NODE_W = 130;
const NODE_H = 70;
const NODE_GAP = 48;
const ROW_H = 90;
const COLS = 4;

function PipelineCanvas({
  nodes,
  onReplay,
  replaying,
}: {
  nodes: any[];
  onReplay: (agentName: string) => void;
  replaying: boolean;
}) {
  if (!nodes?.length) return null;
  const rows = Math.ceil(nodes.length / COLS);
  const svgW = COLS * (NODE_W + NODE_GAP);
  const svgH = rows * (ROW_H + 20) + 20;

  return (
    <div className="overflow-x-auto">
      <svg
        width={svgW}
        height={svgH}
        className="overflow-visible"
        style={{ minWidth: svgW }}
      >
        {nodes.map((node, idx) => {
          const col = idx % COLS;
          const row = Math.floor(idx / COLS);
          const x = col * (NODE_W + NODE_GAP);
          const y = row * (ROW_H + 20) + 20;
          const cx = x + NODE_W / 2;
          const cy = y + NODE_H / 2;

          // Arrow to next node
          const isLastInRow = col === COLS - 1;
          const isLast = idx === nodes.length - 1;

          let arrowPath: string | null = null;
          if (!isLast) {
            if (!isLastInRow) {
              // Horizontal arrow
              const nx = x + NODE_W;
              const ny = y + NODE_H / 2;
              arrowPath = `M ${nx} ${ny} L ${nx + NODE_GAP - 4} ${ny}`;
            } else {
              // Wrap: down + left
              const x2 = x + NODE_W / 2;
              const y2 = y + NODE_H;
              const x3 = 0 + NODE_W / 2; // first col of next row
              const y3 = y + ROW_H + 20 + NODE_H / 2;
              arrowPath = `M ${x2} ${y2} L ${x2} ${y2 + 12} L ${x3} ${y2 + 12} L ${x3} ${y3}`;
            }
          }

          const statusCls = STATUS_COLOR[node.status] ?? STATUS_COLOR.pending;
          const Icon = STATUS_ICON[node.status] ?? Clock;
          const nodeColor =
            node.status === 'completed' ? '#22c55e'
            : node.status === 'failed'  ? '#ef4444'
            : node.status === 'running' ? '#6366f1'
            : '#d1d5db';

          return (
            <g key={node.id}>
              {/* Arrow */}
              {arrowPath && (
                <path
                  d={arrowPath}
                  fill="none"
                  stroke="#d1d5db"
                  strokeWidth={1.5}
                  markerEnd="url(#arrow)"
                  strokeDasharray={node.status === 'pending' ? '4 3' : undefined}
                />
              )}

              {/* Node box */}
              <foreignObject x={x} y={y} width={NODE_W} height={NODE_H}>
                <div
                  className="group relative h-full rounded-xl border-2 flex flex-col items-center justify-center text-center px-2 cursor-pointer hover:shadow-md transition-all"
                  style={{ borderColor: nodeColor, backgroundColor: nodeColor + '14' }}
                  title={node.agentName}
                  onClick={() => !replaying && onReplay(node.agentName)}
                >
                  {/* Status icon */}
                  <div
                    className="w-5 h-5 rounded-full flex items-center justify-center mb-1"
                    style={{ backgroundColor: nodeColor }}
                  >
                    <Icon className="w-2.5 h-2.5 text-white" />
                  </div>
                  <p className="text-[10px] font-bold text-gray-800 leading-tight truncate w-full px-1">
                    {node.agentName?.replace(/-agent$/, '') ?? ''}
                  </p>
                  {node.durationMs && (
                    <p className="text-[9px] text-gray-400 mt-0.5">{formatMs(node.durationMs)}</p>
                  )}
                  {node.llmCostUsd != null && Number(node.llmCostUsd) > 0 && (
                    <p className="text-[9px] text-gray-400">${Number(node.llmCostUsd).toFixed(4)}</p>
                  )}

                  {/* Replay hint on hover */}
                  <div className="absolute inset-0 rounded-xl bg-white/80 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                    <div className="flex items-center gap-1 text-[10px] font-semibold text-brand-600">
                      <RotateCcw className="w-3 h-3" /> Replay
                    </div>
                  </div>
                </div>
              </foreignObject>
            </g>
          );
        })}

        {/* Arrow marker */}
        <defs>
          <marker id="arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
            <path d="M 0 0 L 6 3 L 0 6 z" fill="#d1d5db" />
          </marker>
        </defs>
      </svg>
    </div>
  );
}

// ─── Cost Bar Chart ───────────────────────────────────────────────────────────

function CostChart({ nodes }: { nodes: any[] }) {
  const data = nodes
    .filter((n) => n.llmCostUsd != null && Number(n.llmCostUsd) > 0)
    .map((n) => ({
      name: (n.agentName as string)?.replace(/-agent$/, '') ?? n.agentName,
      cost: Number(n.llmCostUsd),
    }))
    .sort((a, b) => b.cost - a.cost);

  if (data.length === 0) return null;

  return (
    <div>
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Cost Breakdown</p>
      <div style={{ height: 90 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
            <XAxis dataKey="name" tick={{ fontSize: 9 }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 9 }} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v.toFixed(3)}`} />
            <RechartsTip
              contentStyle={{ fontSize: 11, borderRadius: 6 }}
              formatter={(v: number) => [`$${v.toFixed(5)}`, 'Cost']}
            />
            <Bar dataKey="cost" radius={[3, 3, 0, 0]}>
              {data.map((_, i) => (
                <Cell key={i} fill={i === 0 ? '#6366f1' : '#a5b4fc'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ─── Event Log ────────────────────────────────────────────────────────────────

function EventLog({ workflowId }: { workflowId: string }) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const { data } = useQuery({
    queryKey: ['events', workflowId],
    queryFn: () => api.get(`/control-panel/workflows/${workflowId}/events`).then((r: any) => r.data),
    refetchInterval: 3_000,
  });
  const events: any[] = data ?? [];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [events.length]);

  function copyAll() {
    navigator.clipboard.writeText(events.map((e) =>
      `[${new Date(e.createdAt).toLocaleTimeString()}] ${(e.agentName ?? '').replace(/-agent$/i, '')} ${e.eventType}`
    ).join('\n'));
  }

  if (events.length === 0) return <p className="text-xs text-gray-400">No events recorded yet.</p>;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{events.length} events</p>
        <button onClick={copyAll} className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1">
          <Copy className="w-3 h-3" /> Copy all
        </button>
      </div>
      <div className="space-y-1 max-h-52 overflow-y-auto font-mono text-xs pr-1">
        {events.map((e) => {
          const cfg = EVENT_CONFIG[e.eventType] ?? { cls: 'text-gray-500', dot: 'bg-gray-300' };
          return (
            <div key={e.id} className="flex items-start gap-2 hover:bg-gray-50 rounded px-1 py-0.5">
              <span className="text-gray-400 shrink-0 mt-0.5">{new Date(e.createdAt).toLocaleTimeString()}</span>
              <span className={cn('w-1.5 h-1.5 rounded-full shrink-0 mt-1.5', cfg.dot)} />
              <span className={cn('font-semibold shrink-0', cfg.cls)}>{(e.agentName ?? '').replace(/-agent$/i, '')}</span>
              <span className="text-gray-500">{e.eventType.replace(/_/g, ' ')}</span>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}

// ─── Workflow Canvas panel ────────────────────────────────────────────────────

function WorkflowCanvas({ workflowId }: { workflowId: string }) {
  const qc = useQueryClient();
  const [showEvents, setShowEvents] = useState(false);
  const [diagnoseResult, setDiagnoseResult] = useState<DiagnoseResult | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['canvas', workflowId],
    queryFn: () => api.get(`/control-panel/workflows/${workflowId}/canvas`).then((r: any) => r.data),
    refetchInterval: 5_000,
  });

  const replay = useMutation({
    mutationFn: (agentName: string) => api.post(`/orchestrator/workflows/${workflowId}/replay`, { agentName }).then((r: any) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['canvas', workflowId] }),
  });

  const diagnose = useMutation({
    mutationFn: () => api.post(`/control-panel/workflows/${workflowId}/ai-diagnose`, {}).then((r: any) => r.data ?? r),
    onSuccess: (res) => setDiagnoseResult(res),
  });

  if (isLoading) {
    return <div className="flex items-center justify-center h-48"><div className="w-6 h-6 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" /></div>;
  }

  const { workflow, nodes = [], edges, totalCostUsd, totalDurationMs } = data ?? {};

  return (
    <div className="space-y-4">
      {/* Stats row + AI Diagnose */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card p-3 text-center">
          <p className="text-xs text-gray-400">Total Cost</p>
          <p className="text-sm font-bold text-gray-900 mt-0.5">{formatCurrency(totalCostUsd ?? 0)}</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-xs text-gray-400">Duration</p>
          <p className="text-sm font-bold text-gray-900 mt-0.5">{formatMs(totalDurationMs ?? 0)}</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-xs text-gray-400">Steps</p>
          <p className="text-sm font-bold text-gray-900 mt-0.5">{nodes.length}</p>
        </div>
      </div>

      {/* AI Diagnose button */}
      <button
        onClick={() => diagnose.mutate()}
        disabled={diagnose.isPending}
        className="w-full flex items-center justify-center gap-2 py-2 px-4 text-sm font-medium bg-purple-50 text-purple-700 border border-purple-200 rounded-lg hover:bg-purple-100 transition-colors disabled:opacity-60"
      >
        {diagnose.isPending ? (
          <span className="w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
        ) : (
          <Sparkles className="w-4 h-4" />
        )}
        {diagnose.isPending ? 'Analysing workflow…' : 'AI Diagnose this run'}
      </button>

      {/* Diagnose panel */}
      {diagnoseResult && (
        <DiagnosePanel result={diagnoseResult} onClose={() => setDiagnoseResult(null)} />
      )}

      {/* SVG Pipeline canvas */}
      <div className="card p-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Pipeline</p>
        <PipelineCanvas nodes={nodes} onReplay={(n) => replay.mutate(n)} replaying={replay.isPending} />
        <p className="text-xs text-gray-400 mt-2">Click any node to replay from that step</p>
      </div>

      {/* Cost bar chart */}
      {nodes.length > 0 && (
        <div className="card p-4">
          <CostChart nodes={nodes} />
        </div>
      )}

      {/* Error cards */}
      {nodes.filter((n: any) => n.errorMessage).map((n: any) => (
        <div key={n.id} className="rounded-xl bg-danger-50 border border-danger-200 px-4 py-3 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-danger-800">{n.agentName?.replace(/-agent$/i, '')} step failed</p>
            <p className="text-xs text-danger-600 mt-0.5">{n.errorMessage}</p>
          </div>
          <button
            className="shrink-0 text-xs px-3 py-1.5 rounded-lg border border-danger-200 text-danger-700 hover:bg-danger-100 flex items-center gap-1"
            onClick={() => replay.mutate(n.agentName)}
          >
            <RotateCcw className="w-3 h-3" /> Retry
          </button>
        </div>
      ))}

      {/* Event log */}
      <div className="card overflow-hidden">
        <button
          className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          onClick={() => setShowEvents((v) => !v)}
        >
          <span className="flex items-center gap-2">
            <List className="w-4 h-4 text-gray-400" /> Event Log
          </span>
          <ChevronDown className={cn('w-4 h-4 text-gray-400 transition-transform', showEvents && 'rotate-180')} />
        </button>
        {showEvents && (
          <div className="px-4 pb-4 border-t border-gray-100 pt-3">
            <EventLog workflowId={workflowId} />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Workflow Row ─────────────────────────────────────────────────────────────

function WorkflowRow({ workflow, isSelected, onSelect }: { workflow: any; isSelected: boolean; onSelect: () => void }) {
  const Icon = STATUS_ICON[workflow.status] ?? Clock;
  const colorCls = STATUS_COLOR[workflow.status] ?? STATUS_COLOR.pending;
  return (
    <button
      className={cn(
        'w-full text-left px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors flex items-center gap-3',
        isSelected && 'bg-brand-50 border-l-2 border-l-brand-500',
      )}
      onClick={onSelect}
    >
      <div className={cn('w-7 h-7 rounded-full border flex items-center justify-center shrink-0', colorCls)}>
        <Icon className="w-3.5 h-3.5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{workflow.name}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-gray-400">{workflow.agentRunCount} steps</span>
          <span className="text-xs text-gray-400">{formatCurrency(Number(workflow.totalCostUsd ?? 0))}</span>
          {workflow.totalDurationMs && (
            <span className="text-xs text-gray-400">{formatMs(workflow.totalDurationMs)}</span>
          )}
          <span className="text-xs text-gray-400 ml-auto">{formatRelative(workflow.startedAt)}</span>
        </div>
      </div>
      <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
    </button>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ControlPanelPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const { data: workflows, isLoading } = useQuery({
    queryKey: ['workflows'],
    queryFn: () => api.get('/control-panel/workflows').then((r: any) => r.data),
    refetchInterval: 8_000,
  });

  const { data: systemStats } = useQuery({
    queryKey: ['system-stats'],
    queryFn: () => api.get('/control-panel/stats').then((r: any) => r.data),
  });

  const list: any[] = workflows ?? [];
  const filtered = list
    .filter((w) => statusFilter === 'all' || w.status === statusFilter)
    .sort((a, b) => new Date(b.startedAt ?? b.createdAt).getTime() - new Date(a.startedAt ?? a.createdAt).getTime());

  const statusCounts = {
    all: list.length,
    completed: list.filter((w) => w.status === 'completed').length,
    running: list.filter((w) => w.status === 'running').length,
    failed: list.filter((w) => w.status === 'failed').length,
  };

  return (
    <div className="p-8 max-w-6xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Workflows</h1>
        <p className="text-sm text-gray-500 mt-1">Compliance workflow runs, step history &amp; replay</p>
      </div>

      {/* System stats */}
      {systemStats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Total Runs',  value: systemStats.totalAgentRuns, color: 'text-gray-900' },
            { label: 'Total Steps', value: systemStats.totalSteps,     color: 'text-gray-900' },
            { label: 'Processing Cost', value: `$${systemStats.totalLlmCostUsd}`, color: 'text-gray-900' },
            { label: 'Open Risks',  value: systemStats.openRisks,      color: 'text-danger-600' },
          ].map((s) => (
            <div key={s.label} className="card p-4 text-center">
              <p className="text-xs text-gray-400">{s.label}</p>
              <p className={cn('text-lg font-bold mt-1', s.color)}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Workflow list */}
        <div className="lg:col-span-2 card overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 space-y-2">
            <p className="text-sm font-semibold text-gray-700">Workflows</p>
            {/* Status filter chips */}
            <div className="flex items-center gap-1 flex-wrap">
              {(['all', 'completed', 'running', 'failed'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={cn(
                    'text-xs px-2 py-0.5 rounded-full font-medium transition-all capitalize',
                    statusFilter === s
                      ? s === 'failed' ? 'bg-red-100 text-red-700'
                        : s === 'running' ? 'bg-brand-100 text-brand-700'
                        : s === 'completed' ? 'bg-green-100 text-green-700'
                        : 'bg-gray-200 text-gray-700'
                      : 'bg-gray-100 text-gray-500 hover:bg-gray-200',
                  )}
                >
                  {s} ({statusCounts[s as keyof typeof statusCounts] ?? 0})
                </button>
              ))}
            </div>
          </div>
          {isLoading ? (
            <div className="flex items-center justify-center h-40">
              <div className="w-6 h-6 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center">
              <Zap className="w-8 h-8 text-gray-200 mx-auto mb-2" />
              <p className="text-xs text-gray-400">No workflows match.</p>
            </div>
          ) : (
            filtered.map((w) => (
              <WorkflowRow
                key={w.id}
                workflow={w}
                isSelected={selectedId === w.id}
                onSelect={() => setSelectedId(w.id)}
              />
            ))
          )}
        </div>

        {/* Canvas */}
        <div className="lg:col-span-3">
          {selectedId ? (
            <WorkflowCanvas workflowId={selectedId} />
          ) : (
            <div className="card p-12 flex flex-col items-center justify-center text-center h-full min-h-[200px]">
              <Zap className="w-10 h-10 text-gray-200 mb-3" />
              <p className="text-sm text-gray-500">Select a workflow to view its pipeline canvas</p>
              <p className="text-xs text-gray-400 mt-1">SVG pipeline · cost breakdown · live event log</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
