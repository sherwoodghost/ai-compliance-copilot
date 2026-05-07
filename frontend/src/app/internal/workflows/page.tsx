'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import {
  Play, Clock, CheckCircle2, XCircle, AlertTriangle,
  RefreshCw, ChevronDown, ChevronUp, Layers, Building2,
} from 'lucide-react';

// ─── Internal API ─────────────────────────────────────────────────────────────

function getInternalToken() {
  if (typeof document === 'undefined') return '';
  return document.cookie.split('; ').find((r) => r.startsWith('internal_token='))?.split('=')[1] ?? '';
}

const internalApi = axios.create({ baseURL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001' });
internalApi.interceptors.request.use((cfg) => {
  const t = getInternalToken();
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});

// ─── Types ────────────────────────────────────────────────────────────────────

interface AgentRun {
  id: string;
  agentName: string;
  orgName: string;
  status: string;
  durationMs: number | null;
  costUsd: number | null;
  createdAt: string;
}

// ─── Mock data ────────────────────────────────────────────────────────────────

const WORKFLOW_NAMES = [
  'SOC2 Full Assessment', 'Evidence Collection', 'Gap Analysis',
  'Policy Generation', 'Risk Assessment', 'Vendor Risk Scan',
  'Continuous Monitoring', 'Readiness Report',
];
const ORGS  = ['Acme Corp', 'Brightwave AI', 'FinStack Ltd', 'Launchpad SaaS', 'Dataforge Inc'];
const STATUSES = ['completed', 'completed', 'completed', 'running', 'failed', 'completed', 'completed', 'pending'];

function mockRun(i: number): AgentRun {
  return {
    id: `run_${i}`,
    agentName: WORKFLOW_NAMES[i % WORKFLOW_NAMES.length],
    orgName: ORGS[i % ORGS.length],
    status: STATUSES[i % STATUSES.length],
    durationMs: Math.random() > 0.2 ? 5000 + Math.floor(Math.random() * 55000) : null,
    costUsd: Math.random() > 0.2 ? parseFloat((0.01 + Math.random() * 0.18).toFixed(4)) : null,
    createdAt: new Date(Date.now() - i * 720_000).toISOString(),
  };
}

const MOCK_RUNS: AgentRun[] = Array.from({ length: 50 }, (_, i) => mockRun(i));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { icon: React.ReactNode; cls: string }> = {
    completed: { icon: <CheckCircle2 className="w-3.5 h-3.5" />, cls: 'bg-emerald-900/40 text-emerald-300 border-emerald-700/40' },
    running:   { icon: <RefreshCw className="w-3.5 h-3.5 animate-spin" />, cls: 'bg-blue-900/40 text-blue-300 border-blue-700/40' },
    failed:    { icon: <XCircle className="w-3.5 h-3.5" />,    cls: 'bg-red-900/40 text-red-300 border-red-700/40' },
    pending:   { icon: <Clock className="w-3.5 h-3.5" />,      cls: 'bg-yellow-900/40 text-yellow-300 border-yellow-700/40' },
  };
  const cfg = map[status] ?? map.pending;
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full border font-medium ${cfg.cls}`}>
      {cfg.icon}{status}
    </span>
  );
}

function formatDuration(ms: number | null) {
  if (!ms) return '—';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
}

function formatRelative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const d = Math.floor(diff / 86400_000);
  const h = Math.floor(diff / 3600_000);
  const m = Math.floor(diff / 60_000);
  if (m < 1)  return 'Just now';
  if (m < 60) return `${m}m ago`;
  if (h < 24) return `${h}h ago`;
  if (d < 7)  return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type StatusFilter = 'all' | 'running' | 'completed' | 'failed' | 'pending';

export default function WorkflowsPage() {
  const [statusFilter, setStatus] = useState<StatusFilter>('all');
  const [expanded, setExpanded]   = useState<string | null>(null);

  const { data: runs = [], isLoading, refetch } = useQuery<AgentRun[]>({
    queryKey: ['internal', 'runs'],
    queryFn: () =>
      internalApi.get('/internal/runs/recent').then((r) => r.data).catch(() => MOCK_RUNS),
    staleTime: 15_000,
    refetchInterval: 30_000,
  });

  const filtered = runs.filter((r) => statusFilter === 'all' || r.status === statusFilter);

  const counts = {
    running:   runs.filter((r) => r.status === 'running').length,
    completed: runs.filter((r) => r.status === 'completed').length,
    failed:    runs.filter((r) => r.status === 'failed').length,
    pending:   runs.filter((r) => r.status === 'pending').length,
  };

  const tabs: { key: StatusFilter; label: string }[] = [
    { key: 'all',       label: `All (${runs.length})` },
    { key: 'running',   label: `Running (${counts.running})` },
    { key: 'completed', label: `Completed (${counts.completed})` },
    { key: 'failed',    label: `Failed (${counts.failed})` },
    { key: 'pending',   label: `Pending (${counts.pending})` },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Workflows</h1>
          <p className="text-sm text-gray-400 mt-0.5">Live and historical compliance workflow runs across all orgs</p>
        </div>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-800 border border-gray-700 text-sm text-gray-300 hover:bg-gray-700 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </button>
      </div>

      {/* Stat strip */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total Runs',  value: runs.length,        icon: Layers,       color: 'text-indigo-400' },
          { label: 'Running',     value: counts.running,     icon: Play,         color: 'text-blue-400' },
          { label: 'Completed',   value: counts.completed,   icon: CheckCircle2, color: 'text-emerald-400' },
          { label: 'Failed',      value: counts.failed,      icon: AlertTriangle, color: 'text-red-400' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-gray-800/60 border border-gray-700/50 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-400">{label}</span>
              <Icon className={`w-4 h-4 ${color}`} />
            </div>
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 bg-gray-800/60 border border-gray-700/50 rounded-lg p-1 w-fit">
        {tabs.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setStatus(key)}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
              statusFilter === key
                ? 'bg-indigo-600 text-white'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Run table */}
      <div className="bg-gray-800/40 border border-gray-700/50 rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="p-10 text-center">
            <RefreshCw className="w-6 h-6 text-gray-500 animate-spin mx-auto mb-2" />
            <p className="text-sm text-gray-500">Loading runs…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center">
            <Layers className="w-8 h-8 text-gray-600 mx-auto mb-3" />
            <p className="text-sm text-gray-400">No runs found</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-700/60">
                {['Workflow', 'Organization', 'Status', 'Duration', 'Cost', 'Started', ''].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((run) => (
                <>
                  <tr
                    key={run.id}
                    className="border-b border-gray-800 hover:bg-gray-800/40 transition-colors cursor-pointer group"
                    onClick={() => setExpanded(expanded === run.id ? null : run.id)}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Layers className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
                        <span className="text-sm text-gray-200">{run.agentName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 text-sm text-gray-400">
                        <Building2 className="w-3.5 h-3.5" />{run.orgName}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={run.status} />
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-400">
                      {formatDuration(run.durationMs)}
                    </td>
                    <td className="px-4 py-3 text-sm text-indigo-300 font-medium">
                      {run.costUsd != null ? `$${run.costUsd.toFixed(4)}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {formatRelative(run.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {expanded === run.id
                        ? <ChevronUp className="w-3.5 h-3.5" />
                        : <ChevronDown className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />}
                    </td>
                  </tr>
                  {expanded === run.id && (
                    <tr key={`${run.id}-exp`} className="bg-gray-900/60 border-b border-gray-800">
                      <td colSpan={7} className="px-6 py-3">
                        <div className="grid grid-cols-4 gap-4 text-xs">
                          <div>
                            <p className="text-gray-500 mb-1">Run ID</p>
                            <p className="text-gray-300 font-mono">{run.id}</p>
                          </div>
                          <div>
                            <p className="text-gray-500 mb-1">Started at</p>
                            <p className="text-gray-300">{new Date(run.createdAt).toLocaleString()}</p>
                          </div>
                          <div>
                            <p className="text-gray-500 mb-1">Duration</p>
                            <p className="text-gray-300">{formatDuration(run.durationMs)}</p>
                          </div>
                          <div>
                            <p className="text-gray-500 mb-1">LLM Cost</p>
                            <p className="text-gray-300">{run.costUsd != null ? `$${run.costUsd.toFixed(5)}` : 'N/A'}</p>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
