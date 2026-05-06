'use client';

import { useQuery, useMutation } from '@tanstack/react-query';
import { useState, useMemo } from 'react';
import { apiClient as api } from '@/lib/api/client';
import {
  Cpu, AlertTriangle, CheckCircle, Hash, Clock, DollarSign,
  ChevronDown, ChevronRight, PlayCircle, FlaskConical, TrendingUp,
  Copy, Check,
} from 'lucide-react';
import {
  AreaChart, Area, Tooltip as RechartsTip, ResponsiveContainer, BarChart, Bar,
} from 'recharts';
import { cn } from '@/lib/utils';

// ─── Types ─────────────────────────────────────────────────────────────────────

type LlmCall = {
  id: string;
  taskType: string;
  promptTemplateId: string;
  promptTemplateVersion: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  latencyMs: number;
  schemaValid: boolean;
  controlIdsValid: boolean;
  hallucinationDetected: boolean;
  forbiddenLanguageDetected: boolean;
  retryCount: number;
  createdAt: string;
};

type PromptTemplate = {
  templateId: string;
  version: string;
  agentName: string;
  taskType: string;
  purpose: string;
  contentHash: string;
  inputVariables: string[];
  lastUsedAt?: string;
};

type Stats = {
  totalCalls: number;
  hallucinationsDetected: number;
  forbiddenLanguageBlocked: number;
  totalCostUsd: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  avgLatencyMs?: number;
  schemaValidPct?: number;
};

type EvalCase = {
  id: string;
  description: string;
  agentName: string;
  promptTemplateId: string;
  checks: Record<string, unknown>;
};

type EvalRunSummary = {
  runId: string;
  totalCases: number;
  passed: number;
  failed: number;
  skipped: number;
  passRate: number;
  results: Array<{
    caseId: string;
    agentName: string;
    description: string;
    passed: boolean;
    failures: string[];
    skipped: boolean;
  }>;
  runAt: string;
};

// ─── Sparkline helpers ────────────────────────────────────────────────────────

function buildDayBuckets(calls: LlmCall[], field: 'costUsd' | 'latencyMs' | 'count') {
  const now = Date.now();
  const buckets: Record<string, number> = {};
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now - i * 86_400_000);
    buckets[d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })] = 0;
  }
  calls.forEach((c) => {
    const d = new Date(c.createdAt);
    if (now - d.getTime() > 7 * 86_400_000) return;
    const key = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    if (key in buckets) {
      buckets[key] += field === 'count' ? 1 : field === 'costUsd' ? Number(c.costUsd) : c.latencyMs;
    }
  });
  return Object.entries(buckets).map(([day, val]) => ({ day, val }));
}

// ─── Stat card with sparkline ─────────────────────────────────────────────────

function StatCardSparkline({
  label, value, icon: Icon, danger, sparkData, color,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  danger?: boolean;
  sparkData?: Array<{ day: string; val: number }>;
  color?: string;
}) {
  const isDanger = danger && typeof value === 'number' && value > 0;
  return (
    <div className={cn('card p-4 overflow-hidden', isDanger ? 'border-red-200 bg-red-50' : '')}>
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs text-gray-500">{label}</p>
        <Icon className={cn('w-4 h-4', isDanger ? 'text-red-500' : 'text-gray-400')} />
      </div>
      <p className={cn('text-xl font-bold mb-2', isDanger ? 'text-red-700' : 'text-gray-900')}>
        {value}
      </p>
      {sparkData && (
        <div className="h-10 -mx-4 -mb-4">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={sparkData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={`grad-${label}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={color ?? '#6366f1'} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={color ?? '#6366f1'} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area
                type="monotone" dataKey="val"
                stroke={color ?? '#6366f1'} strokeWidth={1.5}
                fill={`url(#grad-${label})`}
                dot={false}
              />
              <RechartsTip
                contentStyle={{ fontSize: 11, padding: '4px 8px', borderRadius: 6 }}
                formatter={(v: number) => [v.toLocaleString(), '']}
                labelFormatter={(l) => l}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

function StatCardPlain({ label, value, icon: Icon, danger }: {
  label: string; value: string | number; icon: React.ElementType; danger?: boolean;
}) {
  const isDanger = danger && typeof value === 'number' && value > 0;
  return (
    <div className={cn('card p-4', isDanger ? 'border-red-200 bg-red-50' : '')}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-gray-500">{label}</p>
        <Icon className={cn('w-4 h-4', isDanger ? 'text-red-500' : 'text-gray-400')} />
      </div>
      <p className={cn('text-xl font-bold', isDanger ? 'text-red-700' : 'text-gray-900')}>{value}</p>
    </div>
  );
}

// ─── Copy button ──────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }
  return (
    <button onClick={copy} className="text-gray-400 hover:text-gray-600 transition-colors">
      {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

// ─── Quality chips ────────────────────────────────────────────────────────────

function QualityChips({ call }: { call: LlmCall }) {
  const chips = [
    { label: 'Schema', ok: call.schemaValid },
    { label: 'Control IDs', ok: call.controlIdsValid },
    { label: 'No Halluc.', ok: !call.hallucinationDetected },
    { label: 'No Forbidden', ok: !call.forbiddenLanguageDetected },
  ];
  return (
    <div className="flex flex-wrap gap-1.5">
      {chips.map((c) => (
        <span
          key={c.label}
          className={cn(
            'text-xs px-2 py-0.5 rounded-full flex items-center gap-1',
            c.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700',
          )}
        >
          {c.ok ? <CheckCircle className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
          {c.label}
        </span>
      ))}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LlmGatewayPage() {
  const [activeTab, setActiveTab] = useState<'calls' | 'prompts' | 'evals'>('calls');
  const [expandedCall, setExpandedCall] = useState<string | null>(null);
  const [evalResult, setEvalResult] = useState<EvalRunSummary | null>(null);

  const { data: stats } = useQuery<Stats>({
    queryKey: ['llm-stats'],
    queryFn: () => api.get('/llm/stats').then((r: any) => r.data),
  });

  const { data: calls = [], isLoading: callsLoading } = useQuery<LlmCall[]>({
    queryKey: ['llm-calls'],
    queryFn: () => api.get('/llm/calls').then((r: any) => r.data),
    enabled: activeTab === 'calls',
  });

  const { data: prompts = [] } = useQuery<PromptTemplate[]>({
    queryKey: ['llm-prompts'],
    queryFn: () => api.get('/llm/prompts').then((r: any) => r.data),
    enabled: activeTab === 'prompts',
  });

  const { data: evalCases = [] } = useQuery<EvalCase[]>({
    queryKey: ['llm-eval-cases'],
    queryFn: () => api.get('/llm/evals').then((r: any) => r.data.cases),
    enabled: activeTab === 'evals',
  });

  const runEval = useMutation({
    mutationFn: () => api.post('/llm/evals/run', { mode: 'static' }).then((r: any) => r.data),
    onSuccess: (data) => setEvalResult(data),
  });

  // Build sparkline data from calls
  const callSparkData = useMemo(() => buildDayBuckets(calls, 'count'), [calls]);
  const costSparkData = useMemo(() => buildDayBuckets(calls, 'costUsd'), [calls]);
  const latSparkData  = useMemo(() => buildDayBuckets(calls, 'latencyMs'), [calls]);

  // Group prompts by agent
  const promptsByAgent = useMemo(() => {
    const groups: Record<string, PromptTemplate[]> = {};
    prompts.forEach((p) => {
      const key = p.agentName ?? 'unknown';
      (groups[key] ??= []).push(p);
    });
    return groups;
  }, [prompts]);

  const [collapsedAgents, setCollapsedAgents] = useState<Set<string>>(new Set());
  function toggleAgent(agent: string) {
    setCollapsedAgents((prev) => {
      const next = new Set(prev);
      next.has(agent) ? next.delete(agent) : next.add(agent);
      return next;
    });
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-brand-100 flex items-center justify-center">
          <Cpu className="w-5 h-5 text-brand-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">LLM Gateway</h1>
          <p className="text-sm text-gray-500">Every AI call is logged, validated, and auditable</p>
        </div>
      </div>

      {/* Stats — row 1: sparkline cards */}
      {stats && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <StatCardSparkline
              label="Total Calls (7d)" icon={Cpu}
              value={stats.totalCalls}
              sparkData={callSparkData} color="#6366f1"
            />
            <StatCardSparkline
              label="Total Cost (7d)" icon={DollarSign}
              value={`$${Number(stats.totalCostUsd || 0).toFixed(4)}`}
              sparkData={costSparkData} color="#10b981"
            />
            <StatCardSparkline
              label="Avg Latency" icon={TrendingUp}
              value={stats.avgLatencyMs ? `${stats.avgLatencyMs}ms` : '—'}
              sparkData={latSparkData} color="#f59e0b"
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <StatCardPlain label="Hallucinations" value={stats.hallucinationsDetected} icon={AlertTriangle} danger />
            <StatCardPlain label="Forbidden Lang" value={stats.forbiddenLanguageBlocked} icon={AlertTriangle} danger />
            <StatCardPlain
              label="Schema Valid %"
              value={stats.schemaValidPct != null ? `${Math.round(stats.schemaValidPct)}%` : '—'}
              icon={CheckCircle}
            />
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        {(['calls', 'prompts', 'evals'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              'px-4 py-1.5 text-sm font-medium rounded-md transition-colors',
              activeTab === tab ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700',
            )}
          >
            {tab === 'calls' ? 'Call Log' : tab === 'prompts' ? 'Prompt Registry' : 'Eval Harness'}
          </button>
        ))}
      </div>

      {/* ── Call Log ── */}
      {activeTab === 'calls' && (
        callsLoading ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => <div key={i} className="h-12 bg-gray-100 rounded-lg animate-pulse" />)}
          </div>
        ) : calls.length === 0 ? (
          <div className="card p-8 text-center">
            <Cpu className="w-8 h-8 mx-auto text-gray-300 mb-2" />
            <p className="text-gray-500 text-sm">No LLM calls logged yet</p>
          </div>
        ) : (
          <div className="card overflow-hidden">
            {/* Table header */}
            <div className="grid grid-cols-[auto_1fr_auto_auto_auto_auto] gap-2 items-center px-4 py-2 bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500">
              <span className="w-4" />
              <span>Task / Model</span>
              <span>Tokens</span>
              <span>Cost</span>
              <span>Latency</span>
              <span>Quality</span>
            </div>

            <div className="divide-y divide-gray-100">
              {calls.map((call) => {
                const hasIssue = call.hallucinationDetected || call.forbiddenLanguageDetected;
                return (
                  <div key={call.id}>
                    <button
                      className="w-full grid grid-cols-[auto_1fr_auto_auto_auto_auto] gap-2 items-center px-4 py-3 hover:bg-gray-50 text-left transition-colors"
                      onClick={() => setExpandedCall(expandedCall === call.id ? null : call.id)}
                    >
                      {expandedCall === call.id
                        ? <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
                        : <ChevronRight className="w-3.5 h-3.5 text-gray-400" />}

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded truncate max-w-[180px]">
                            {call.promptTemplateId}
                          </span>
                          <span className="text-xs text-gray-500 truncate">{call.model}</span>
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {new Date(call.createdAt).toLocaleString()} · {call.taskType}
                        </p>
                      </div>

                      <span className="text-xs text-gray-600 font-mono shrink-0">
                        {(call.inputTokens ?? 0).toLocaleString()} / {(call.outputTokens ?? 0).toLocaleString()}
                      </span>

                      <span className="text-xs font-medium text-gray-700 shrink-0">
                        ${Number(call.costUsd || 0).toFixed(5)}
                      </span>

                      <span className="text-xs text-gray-500 shrink-0 flex items-center gap-1">
                        <Clock className="w-3 h-3" />{call.latencyMs}ms
                      </span>

                      <div className="shrink-0">
                        {hasIssue
                          ? <AlertTriangle className="w-4 h-4 text-red-500" />
                          : <CheckCircle className="w-4 h-4 text-green-500" />}
                      </div>
                    </button>

                    {expandedCall === call.id && (
                      <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Quality Checks</span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono text-gray-400">
                              {call.promptTemplateId}:{call.promptTemplateVersion}
                            </span>
                            <CopyButton text={call.id} />
                          </div>
                        </div>
                        <QualityChips call={call} />
                        {call.retryCount > 0 && (
                          <p className="text-xs text-orange-600 font-medium">
                            ⚠ {call.retryCount} retr{call.retryCount === 1 ? 'y' : 'ies'} required
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )
      )}

      {/* ── Prompt Registry ── */}
      {activeTab === 'prompts' && (
        <div className="space-y-4">
          {Object.entries(promptsByAgent).map(([agent, agentPrompts]) => {
            const collapsed = collapsedAgents.has(agent);
            return (
              <div key={agent} className="card overflow-hidden">
                <button
                  className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200 hover:bg-gray-100 transition-colors"
                  onClick={() => toggleAgent(agent)}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-gray-800 capitalize">
                      {agent.replace(/-/g, ' ')}
                    </span>
                    <span className="text-xs bg-brand-100 text-brand-700 px-1.5 py-0.5 rounded-full">
                      {agentPrompts.length} template{agentPrompts.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  {collapsed
                    ? <ChevronRight className="w-4 h-4 text-gray-400" />
                    : <ChevronDown className="w-4 h-4 text-gray-400" />}
                </button>

                {!collapsed && (
                  <div className="divide-y divide-gray-100">
                    {agentPrompts.map((pt) => (
                      <div key={`${pt.templateId}:${pt.version}`} className="px-4 py-3 flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="font-mono text-sm font-bold text-gray-900">{pt.templateId}</span>
                            <span className="text-xs bg-brand-50 text-brand-700 px-1.5 py-0.5 rounded-full border border-brand-200">
                              {pt.version}
                            </span>
                            <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{pt.taskType}</span>
                          </div>
                          <p className="text-xs text-gray-500 mb-1.5">{pt.purpose}</p>
                          <div className="flex items-center gap-4 text-xs text-gray-400">
                            <span className="flex items-center gap-1">
                              <Hash className="w-3 h-3" />
                              <span className="font-mono">{pt.contentHash.slice(0, 14)}…</span>
                              <CopyButton text={pt.contentHash} />
                            </span>
                            {pt.inputVariables.length > 0 && (
                              <span>
                                Vars: {pt.inputVariables.slice(0, 4).join(', ')}{pt.inputVariables.length > 4 ? ` +${pt.inputVariables.length - 4}` : ''}
                              </span>
                            )}
                            {pt.lastUsedAt && (
                              <span>Last used: {new Date(pt.lastUsedAt).toLocaleDateString()}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          {prompts.length === 0 && (
            <div className="card p-8 text-center">
              <Hash className="w-8 h-8 mx-auto text-gray-300 mb-2" />
              <p className="text-gray-500 text-sm">No prompt templates loaded</p>
            </div>
          )}
        </div>
      )}

      {/* ── Eval Harness ── */}
      {activeTab === 'evals' && (
        <div className="space-y-4">
          {/* Header + run button */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600">
              {evalCases.length} golden test cases across{' '}
              {new Set(evalCases.map((c) => c.agentName)).size} agents
            </p>
            <button
              className="btn-primary text-sm flex items-center gap-2"
              onClick={() => runEval.mutate()}
              disabled={runEval.isPending}
            >
              <PlayCircle className="w-4 h-4" />
              {runEval.isPending ? 'Running…' : 'Run Static Eval'}
            </button>
          </div>

          {/* Eval result banner */}
          {evalResult && (
            <div className={cn(
              'border-2 rounded-xl overflow-hidden',
              evalResult.failed > 0 ? 'border-red-200' : 'border-green-200',
            )}>
              {/* Pass rate bar */}
              <div className={cn(
                'px-5 py-4',
                evalResult.failed > 0 ? 'bg-red-50' : 'bg-green-50',
              )}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <FlaskConical className={cn('w-5 h-5', evalResult.failed > 0 ? 'text-red-600' : 'text-green-600')} />
                    <span className="font-semibold text-gray-900">
                      {evalResult.passRate}% pass rate
                    </span>
                  </div>
                  <span className="text-xs text-gray-400">{new Date(evalResult.runAt).toLocaleString()}</span>
                </div>
                <div className="h-2 w-full bg-white/60 rounded-full overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all', evalResult.failed > 0 ? 'bg-red-400' : 'bg-green-500')}
                    style={{ width: `${evalResult.passRate}%` }}
                  />
                </div>
                <div className="flex gap-4 text-sm mt-2">
                  <span className="text-green-700 font-medium">✓ {evalResult.passed} passed</span>
                  {evalResult.failed > 0 && <span className="text-red-700 font-medium">✗ {evalResult.failed} failed</span>}
                  {evalResult.skipped > 0 && <span className="text-gray-500">⊘ {evalResult.skipped} skipped</span>}
                </div>
              </div>

              {/* Failure list */}
              {evalResult.failed > 0 && (
                <div className="px-5 py-3 bg-white border-t border-red-100 space-y-1">
                  {evalResult.results.filter((r) => !r.passed && !r.skipped).map((r) => (
                    <div key={r.caseId} className="text-xs text-red-700 bg-red-50 rounded px-3 py-1.5">
                      <span className="font-mono font-bold">{r.caseId}</span>: {r.failures.join(', ')}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Golden cases table */}
          {evalCases.length > 0 ? (
            <div className="card overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">ID</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">Agent</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">Description</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">Checks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {evalCases.map((ec) => (
                    <tr key={ec.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs font-bold text-gray-500">{ec.id}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded">{ec.agentName}</span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm text-gray-700">{ec.description}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-gray-400">{Object.keys(ec.checks).length} check{Object.keys(ec.checks).length !== 1 ? 's' : ''}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="card p-8 text-center">
              <FlaskConical className="w-8 h-8 mx-auto text-gray-300 mb-2" />
              <p className="text-gray-500 text-sm">No golden eval cases loaded</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
