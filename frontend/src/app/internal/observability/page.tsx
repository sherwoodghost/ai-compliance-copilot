'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import Cookies from 'js-cookie';
import {
  Activity, AlertTriangle, CheckCircle, Clock, DollarSign, Search,
  ChevronDown, ChevronRight, Hash, Cpu, Filter,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const internalApi = axios.create({ baseURL: process.env.NEXT_PUBLIC_API_URL });
internalApi.interceptors.request.use((c) => {
  const t = Cookies.get('internal_token');
  if (t) c.headers.Authorization = `Bearer ${t}`;
  return c;
});

// ─── Types ────────────────────────────────────────────────────────────────────

type LlmTrace = {
  id: string;
  agentName: string;
  orgName: string;
  taskType: string;
  model: string;
  promptVersion: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  latencyMs: number;
  status: 'success' | 'error' | 'hallucination' | 'forbidden';
  errorMessage?: string;
  retryCount: number;
  createdAt: string;
};

// ─── Mock data ────────────────────────────────────────────────────────────────

const AGENTS = ['GapAnalysisAgent', 'EvidenceAgent', 'PolicyAgent', 'ScopingAgent', 'RiskScoringAgent', 'ReadinessAgent'];
const ORGS   = ['Acme Corp', 'StartupXYZ', 'MegaCo', 'HealthTech', 'DataPipeline'];
const MODELS = ['claude-opus-4', 'claude-sonnet-4-5', 'claude-haiku-4-5'];
const STATUSES: LlmTrace['status'][] = ['success', 'success', 'success', 'success', 'error', 'hallucination'];

function randEl<T>(arr: T[]) { return arr[Math.floor(Math.random() * arr.length)]; }

const MOCK_TRACES: LlmTrace[] = Array.from({ length: 40 }, (_, i) => {
  const status = randEl(STATUSES);
  const inputTokens = Math.floor(Math.random() * 3000) + 500;
  const outputTokens = Math.floor(Math.random() * 1500) + 200;
  const model = randEl(MODELS);
  const costPer1k = model.includes('opus') ? 0.015 : model.includes('sonnet') ? 0.003 : 0.00025;
  return {
    id: `trace-${i}`,
    agentName: randEl(AGENTS),
    orgName: randEl(ORGS),
    taskType: 'analysis',
    model,
    promptVersion: `v${Math.floor(Math.random() * 3) + 1}.${Math.floor(Math.random() * 5)}`,
    inputTokens,
    outputTokens,
    costUsd: ((inputTokens + outputTokens) / 1000) * costPer1k,
    latencyMs: Math.floor(Math.random() * 12000) + 800,
    status,
    errorMessage: status === 'error' ? 'Schema validation failed: missing controlIds field' : undefined,
    retryCount: Math.random() > 0.85 ? Math.floor(Math.random() * 3) + 1 : 0,
    createdAt: new Date(Date.now() - i * 180000).toISOString(),
  };
});

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CFG: Record<LlmTrace['status'], { cls: string; icon: React.ElementType; label: string }> = {
  success:      { cls: 'text-emerald-400', icon: CheckCircle,   label: 'Success' },
  error:        { cls: 'text-red-400',     icon: AlertTriangle, label: 'Error' },
  hallucination:{ cls: 'text-orange-400',  icon: AlertTriangle, label: 'Hallucination' },
  forbidden:    { cls: 'text-red-500',     icon: AlertTriangle, label: 'Forbidden Lang' },
};

// ─── Trace row ────────────────────────────────────────────────────────────────

function TraceRow({ trace }: { trace: LlmTrace }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = STATUS_CFG[trace.status];
  const Icon = cfg.icon;

  function timeAgo(iso: string) {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60_000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    return `${Math.floor(mins / 60)}h ago`;
  }

  return (
    <div className="border-b border-gray-800 last:border-0">
      <button
        onClick={() => setExpanded((p) => !p)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-800/40 text-left transition-colors"
      >
        <ChevronRight className={cn('w-3.5 h-3.5 text-gray-600 shrink-0 transition-transform', expanded && 'rotate-90')} />
        <Icon className={cn('w-3.5 h-3.5 shrink-0', cfg.cls)} />

        <span className="text-xs text-gray-400 w-36 shrink-0 truncate">{trace.agentName}</span>
        <span className="text-xs text-gray-500 w-24 shrink-0 truncate">{trace.orgName}</span>
        <span className="text-xs text-gray-600 w-32 shrink-0 font-mono truncate">{trace.model.split('-').slice(-2).join('-')}</span>

        <div className="flex-1 flex items-center justify-end gap-5">
          <span className="text-xs text-gray-500 w-20 text-right">{trace.inputTokens + trace.outputTokens} tok</span>
          <span className="text-xs text-amber-500 w-16 text-right">${trace.costUsd.toFixed(5)}</span>
          <span className="text-xs text-gray-500 w-14 text-right">
            {trace.latencyMs < 1000 ? `${trace.latencyMs}ms` : `${(trace.latencyMs / 1000).toFixed(1)}s`}
          </span>
          {trace.retryCount > 0 && (
            <span className="text-xs text-orange-400 w-12 text-right">{trace.retryCount}x retry</span>
          )}
          <span className="text-xs text-gray-600 w-16 text-right">{timeAgo(trace.createdAt)}</span>
        </div>
      </button>

      {expanded && (
        <div className="px-10 pb-4 bg-gray-800/20 space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-gray-800 rounded-lg px-3 py-2">
              <p className="text-xs text-gray-500 mb-0.5">Input Tokens</p>
              <p className="text-sm font-mono text-gray-200">{trace.inputTokens.toLocaleString()}</p>
            </div>
            <div className="bg-gray-800 rounded-lg px-3 py-2">
              <p className="text-xs text-gray-500 mb-0.5">Output Tokens</p>
              <p className="text-sm font-mono text-gray-200">{trace.outputTokens.toLocaleString()}</p>
            </div>
            <div className="bg-gray-800 rounded-lg px-3 py-2">
              <p className="text-xs text-gray-500 mb-0.5">Prompt Version</p>
              <p className="text-sm font-mono text-gray-200">{trace.promptVersion}</p>
            </div>
            <div className="bg-gray-800 rounded-lg px-3 py-2">
              <p className="text-xs text-gray-500 mb-0.5">Status</p>
              <p className={cn('text-sm font-medium', cfg.cls)}>{cfg.label}</p>
            </div>
          </div>
          {trace.errorMessage && (
            <div className="bg-red-900/20 border border-red-900 rounded-lg px-3 py-2">
              <p className="text-xs text-gray-500 mb-0.5">Error</p>
              <p className="text-xs text-red-400 font-mono">{trace.errorMessage}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ObservabilityPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | LlmTrace['status']>('all');

  const { data: traces } = useQuery<LlmTrace[]>({
    queryKey: ['internal-traces'],
    queryFn: () => internalApi.get('/internal/llm/calls').then((r) => r.data).catch(() => MOCK_TRACES),
    initialData: MOCK_TRACES,
    refetchInterval: 30_000,
  });

  const all = traces ?? MOCK_TRACES;
  const totalCost = all.reduce((s, t) => s + t.costUsd, 0);
  const totalTokens = all.reduce((s, t) => s + t.inputTokens + t.outputTokens, 0);
  const errorCount = all.filter((t) => t.status !== 'success').length;
  const avgLatency = all.reduce((s, t) => s + t.latencyMs, 0) / all.length;

  const filtered = all.filter((t) => {
    if (statusFilter !== 'all' && t.status !== statusFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return t.agentName.toLowerCase().includes(q) || t.orgName.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-lg font-bold text-white">Observability</h1>
        <p className="text-xs text-gray-500 mt-0.5">All AI inference traces across every organization</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Traces', value: all.length.toLocaleString(), icon: Activity, accent: 'text-white' },
          { label: 'Total Cost', value: `$${totalCost.toFixed(4)}`, icon: DollarSign, accent: 'text-amber-400' },
          { label: 'Total Tokens', value: (totalTokens / 1000).toFixed(1) + 'K', icon: Hash, accent: 'text-gray-200' },
          { label: 'Errors/Blocks', value: errorCount, icon: AlertTriangle, accent: errorCount > 0 ? 'text-red-400' : 'text-emerald-400' },
        ].map(({ label, value, icon: Icon, accent }) => (
          <div key={label} className="bg-gray-900 border border-gray-800 rounded-xl px-5 py-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-gray-500">{label}</p>
              <Icon className="w-3.5 h-3.5 text-gray-600" />
            </div>
            <p className={cn('text-xl font-bold', accent)}>{value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-600" />
          <input
            type="text"
            placeholder="Search agent or org…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-gray-900 border border-gray-800 rounded-lg pl-9 pr-4 py-2
                       text-sm text-gray-200 placeholder-gray-600 focus:outline-none
                       focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>
        <div className="flex items-center gap-1 bg-gray-900 border border-gray-800 p-1 rounded-lg">
          {(['all', 'success', 'error', 'hallucination', 'forbidden'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={cn(
                'px-2.5 py-1 text-xs font-medium rounded-md transition-colors',
                statusFilter === s
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-500 hover:text-gray-300',
              )}
            >
              {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Trace table */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        {/* Column headers */}
        <div className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-800 bg-gray-800/40">
          <div className="w-3.5 shrink-0" />
          <div className="w-3.5 shrink-0" />
          <span className="text-xs text-gray-600 w-36 shrink-0">Agent</span>
          <span className="text-xs text-gray-600 w-24 shrink-0">Org</span>
          <span className="text-xs text-gray-600 w-32 shrink-0">Model</span>
          <div className="flex-1 flex items-center justify-end gap-5">
            <span className="text-xs text-gray-600 w-20 text-right">Tokens</span>
            <span className="text-xs text-gray-600 w-16 text-right">Cost</span>
            <span className="text-xs text-gray-600 w-14 text-right">Latency</span>
            <span className="text-xs text-gray-600 w-12 text-right">Retries</span>
            <span className="text-xs text-gray-600 w-16 text-right">Time</span>
          </div>
        </div>

        {filtered.slice(0, 30).map((t) => (
          <TraceRow key={t.id} trace={t} />
        ))}

        {filtered.length > 30 && (
          <div className="px-4 py-3 text-center border-t border-gray-800">
            <p className="text-xs text-gray-600">{filtered.length - 30} more traces — export to CSV for full history</p>
          </div>
        )}
      </div>
    </div>
  );
}
