'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import {
  DollarSign, TrendingUp, TrendingDown, Zap, RefreshCw,
  ChevronDown, ChevronUp, BarChart3, AlertCircle,
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

interface LlmCall {
  id: string;
  agentName: string;
  orgName: string;
  taskType: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  latencyMs: number;
  status: string;
  createdAt: string;
}

// ─── Mock data ────────────────────────────────────────────────────────────────

const AGENTS = [
  'scoping', 'evidence', 'policy', 'risk', 'gap-analysis',
  'vendor-risk', 'readiness', 'monitoring',
];
const ORGS  = ['Acme Corp', 'Brightwave AI', 'FinStack Ltd', 'Launchpad SaaS', 'Dataforge Inc'];
const MODELS = ['claude-3-5-haiku-20241022', 'claude-3-5-sonnet-20241022', 'claude-3-opus-20240229'];

function randomCall(i: number): LlmCall {
  const agent = AGENTS[i % AGENTS.length];
  const model = MODELS[i % MODELS.length];
  const inputTokens  = 800  + Math.floor(Math.random() * 3200);
  const outputTokens = 200  + Math.floor(Math.random() * 1200);
  const costUsd = (inputTokens * 0.000_003 + outputTokens * 0.000_015) * (model.includes('opus') ? 5 : model.includes('sonnet') ? 2 : 1);
  return {
    id: `call_${i}`,
    agentName: agent,
    orgName: ORGS[i % ORGS.length],
    taskType: agent,
    model,
    inputTokens,
    outputTokens,
    costUsd: parseFloat(costUsd.toFixed(5)),
    latencyMs: 600 + Math.floor(Math.random() * 4000),
    status: Math.random() > 0.92 ? 'error' : 'success',
    createdAt: new Date(Date.now() - i * 240_000).toISOString(),
  };
}

const MOCK_CALLS: LlmCall[] = Array.from({ length: 80 }, (_, i) => randomCall(i));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt$(n: number) {
  if (n < 0.01) return `$${(n * 100).toFixed(3)}¢`;
  return `$${n.toFixed(4)}`;
}

function fmtBig$(n: number) {
  if (n >= 1) return `$${n.toFixed(2)}`;
  return `${(n * 100).toFixed(2)}¢`;
}

// ─── Breakdown card ───────────────────────────────────────────────────────────

function BreakdownCard({
  title, rows,
}: {
  title: string;
  rows: { label: string; cost: number; calls: number; pct: number }[];
}) {
  const maxPct = Math.max(...rows.map((r) => r.pct), 1);
  return (
    <div className="bg-gray-800/40 border border-gray-700/50 rounded-xl p-5">
      <h3 className="text-sm font-semibold text-white mb-4">{title}</h3>
      <div className="space-y-3">
        {rows.map((r) => (
          <div key={r.label}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-gray-300 truncate max-w-[140px]">{r.label}</span>
              <div className="flex items-center gap-3 text-xs">
                <span className="text-gray-500">{r.calls} calls</span>
                <span className="text-indigo-300 font-medium w-16 text-right">{fmtBig$(r.cost)}</span>
              </div>
            </div>
            <div className="h-1.5 rounded-full bg-gray-700 overflow-hidden">
              <div
                className="h-full rounded-full bg-indigo-500"
                style={{ width: `${(r.pct / maxPct) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CostsPage() {
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data: calls = [], isLoading, refetch } = useQuery<LlmCall[]>({
    queryKey: ['internal', 'llm-calls'],
    queryFn: () =>
      internalApi.get('/internal/llm/calls').then((r) => r.data).catch(() => MOCK_CALLS),
    staleTime: 30_000,
  });

  // Aggregate totals
  const totalCost    = calls.reduce((s, c) => s + c.costUsd, 0);
  const totalTokens  = calls.reduce((s, c) => s + c.inputTokens + c.outputTokens, 0);
  const totalCalls   = calls.length;
  const errorCount   = calls.filter((c) => c.status !== 'success').length;

  // By agent
  const byAgent = Object.entries(
    calls.reduce<Record<string, { cost: number; calls: number }>>((acc, c) => {
      if (!acc[c.agentName]) acc[c.agentName] = { cost: 0, calls: 0 };
      acc[c.agentName].cost  += c.costUsd;
      acc[c.agentName].calls += 1;
      return acc;
    }, {}),
  )
    .map(([label, { cost, calls: n }]) => ({ label, cost, calls: n, pct: cost / (totalCost || 1) * 100 }))
    .sort((a, b) => b.cost - a.cost)
    .slice(0, 8);

  // By org
  const byOrg = Object.entries(
    calls.reduce<Record<string, { cost: number; calls: number }>>((acc, c) => {
      if (!acc[c.orgName]) acc[c.orgName] = { cost: 0, calls: 0 };
      acc[c.orgName].cost  += c.costUsd;
      acc[c.orgName].calls += 1;
      return acc;
    }, {}),
  )
    .map(([label, { cost, calls: n }]) => ({ label, cost, calls: n, pct: cost / (totalCost || 1) * 100 }))
    .sort((a, b) => b.cost - a.cost)
    .slice(0, 8);

  // By model
  const byModel = Object.entries(
    calls.reduce<Record<string, { cost: number; calls: number }>>((acc, c) => {
      const key = c.model.replace('claude-', '').replace(/-\d{8}$/, '');
      if (!acc[key]) acc[key] = { cost: 0, calls: 0 };
      acc[key].cost  += c.costUsd;
      acc[key].calls += 1;
      return acc;
    }, {}),
  )
    .map(([label, { cost, calls: n }]) => ({ label, cost, calls: n, pct: cost / (totalCost || 1) * 100 }))
    .sort((a, b) => b.cost - a.cost);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Cost Tracker</h1>
          <p className="text-sm text-gray-400 mt-0.5">LLM spend breakdown by agent, org, and model</p>
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
          { label: 'Total Spend',   value: fmtBig$(totalCost),          icon: DollarSign, color: 'text-indigo-400' },
          { label: 'API Calls',     value: totalCalls.toLocaleString(),  icon: BarChart3,  color: 'text-blue-400' },
          { label: 'Total Tokens',  value: `${(totalTokens / 1000).toFixed(1)}K`, icon: Zap, color: 'text-purple-400' },
          { label: 'Error Calls',   value: errorCount,                   icon: AlertCircle, color: 'text-red-400' },
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

      {/* Breakdown charts */}
      <div className="grid grid-cols-3 gap-4">
        <BreakdownCard title="Cost by Workflow Step" rows={byAgent} />
        <BreakdownCard title="Cost by Customer"      rows={byOrg}   />
        <BreakdownCard title="Cost by Model"         rows={byModel} />
      </div>

      {/* Call log */}
      <div className="bg-gray-800/40 border border-gray-700/50 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-700/60">
          <h3 className="text-sm font-semibold text-white">Recent API Calls</h3>
        </div>
        {isLoading ? (
          <div className="p-8 text-center">
            <RefreshCw className="w-5 h-5 text-gray-500 animate-spin mx-auto mb-2" />
            <p className="text-sm text-gray-500">Loading…</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-700/40">
                {['Step', 'Org', 'Model', 'Tokens', 'Cost', 'Latency', 'Status', ''].map((h) => (
                  <th key={h} className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {calls.slice(0, 40).map((c) => (
                <>
                  <tr
                    key={c.id}
                    className="border-b border-gray-800 hover:bg-gray-800/40 transition-colors cursor-pointer"
                    onClick={() => setExpanded(expanded === c.id ? null : c.id)}
                  >
                    <td className="px-4 py-2.5 text-xs font-medium text-gray-200">{c.agentName}</td>
                    <td className="px-4 py-2.5 text-xs text-gray-400">{c.orgName}</td>
                    <td className="px-4 py-2.5 text-xs text-gray-400 font-mono">
                      {c.model.replace('claude-', '').replace(/-\d{8}$/, '')}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-gray-400">
                      {(c.inputTokens + c.outputTokens).toLocaleString()}
                    </td>
                    <td className="px-4 py-2.5 text-xs font-medium text-indigo-300">{fmt$(c.costUsd)}</td>
                    <td className="px-4 py-2.5 text-xs text-gray-400">{c.latencyMs}ms</td>
                    <td className="px-4 py-2.5">
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                        c.status === 'success'
                          ? 'bg-emerald-900/40 text-emerald-300'
                          : 'bg-red-900/40 text-red-300'
                      }`}>
                        {c.status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-gray-600">
                      {expanded === c.id
                        ? <ChevronUp className="w-3.5 h-3.5" />
                        : <ChevronDown className="w-3.5 h-3.5" />}
                    </td>
                  </tr>
                  {expanded === c.id && (
                    <tr key={`${c.id}-exp`} className="bg-gray-900/60 border-b border-gray-800">
                      <td colSpan={8} className="px-6 py-3">
                        <div className="grid grid-cols-4 gap-4 text-xs">
                          <div>
                            <p className="text-gray-500 mb-1">Input tokens</p>
                            <p className="text-gray-200 font-mono">{c.inputTokens.toLocaleString()}</p>
                          </div>
                          <div>
                            <p className="text-gray-500 mb-1">Output tokens</p>
                            <p className="text-gray-200 font-mono">{c.outputTokens.toLocaleString()}</p>
                          </div>
                          <div>
                            <p className="text-gray-500 mb-1">Full model ID</p>
                            <p className="text-gray-200 font-mono">{c.model}</p>
                          </div>
                          <div>
                            <p className="text-gray-500 mb-1">Call ID</p>
                            <p className="text-gray-200 font-mono">{c.id}</p>
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
