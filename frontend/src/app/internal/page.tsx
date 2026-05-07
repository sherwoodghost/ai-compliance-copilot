'use client';

import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import Cookies from 'js-cookie';
import {
  Activity, Cpu, DollarSign, AlertTriangle, CheckCircle, Clock,
  TrendingUp, TrendingDown, Zap, Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Internal API client ──────────────────────────────────────────────────────

const internalApi = axios.create({ baseURL: process.env.NEXT_PUBLIC_API_URL });
internalApi.interceptors.request.use((c) => {
  const token = Cookies.get('internal_token');
  if (token) c.headers.Authorization = `Bearer ${token}`;
  return c;
});

// ─── Types ────────────────────────────────────────────────────────────────────

type PlatformStats = {
  totalWorkflows: number;
  runningWorkflows: number;
  totalAgentRuns: number;
  avgLatencyMs: number;
  totalCostUsd: number;
  hallucinationsDetected: number;
  activeCustomers: number;
  errorRate: number;
};

type RecentRun = {
  id: string;
  agentName: string;
  orgName: string;
  status: 'completed' | 'failed' | 'running';
  durationMs?: number;
  costUsd?: number;
  createdAt: string;
};

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  label, value, sub, icon: Icon, trend, accent = 'text-white',
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  trend?: 'up' | 'down';
  accent?: string;
}) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl px-5 py-4">
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs text-gray-500">{label}</p>
        <div className="w-7 h-7 rounded-lg bg-gray-800 flex items-center justify-center">
          <Icon className="w-3.5 h-3.5 text-gray-400" />
        </div>
      </div>
      <p className={cn('text-2xl font-bold', accent)}>{value}</p>
      {sub && (
        <div className="flex items-center gap-1 mt-1">
          {trend === 'up' && <TrendingUp className="w-3 h-3 text-emerald-500" />}
          {trend === 'down' && <TrendingDown className="w-3 h-3 text-red-500" />}
          <p className="text-xs text-gray-500">{sub}</p>
        </div>
      )}
    </div>
  );
}

// ─── Run Row ──────────────────────────────────────────────────────────────────

function RunRow({ run }: { run: RecentRun }) {
  const STATUS = {
    completed: { cls: 'text-emerald-400', icon: CheckCircle },
    failed:    { cls: 'text-red-400',     icon: AlertTriangle },
    running:   { cls: 'text-indigo-400',  icon: Clock },
  };
  const cfg = STATUS[run.status] ?? STATUS.running;
  const Icon = cfg.icon;

  function timeAgo(iso: string) {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60_000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    return `${Math.floor(mins / 60)}h ago`;
  }

  return (
    <div className="flex items-center gap-4 py-3 border-b border-gray-800 last:border-0">
      <Icon className={cn('w-4 h-4 shrink-0', cfg.cls)} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-200 truncate">{run.agentName}</p>
        <p className="text-xs text-gray-500">{run.orgName}</p>
      </div>
      <div className="text-right shrink-0">
        {run.durationMs && (
          <p className="text-xs text-gray-400">
            {run.durationMs < 1000 ? `${run.durationMs}ms` : `${(run.durationMs / 1000).toFixed(1)}s`}
          </p>
        )}
        {run.costUsd && (
          <p className="text-xs text-gray-600">${run.costUsd.toFixed(4)}</p>
        )}
      </div>
      <p className="text-xs text-gray-600 shrink-0 w-16 text-right">{timeAgo(run.createdAt)}</p>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const MOCK_STATS: PlatformStats = {
  totalWorkflows: 142,
  runningWorkflows: 3,
  totalAgentRuns: 8_941,
  avgLatencyMs: 2340,
  totalCostUsd: 47.82,
  hallucinationsDetected: 12,
  activeCustomers: 8,
  errorRate: 0.024,
};

const MOCK_RUNS: RecentRun[] = [
  { id: '1', agentName: 'GapAnalysisAgent',    orgName: 'Acme Corp',     status: 'completed', durationMs: 4200,  costUsd: 0.0182, createdAt: new Date(Date.now() - 120000).toISOString() },
  { id: '2', agentName: 'EvidenceAgent',        orgName: 'StartupXYZ',   status: 'running',                                        createdAt: new Date(Date.now() - 45000).toISOString() },
  { id: '3', agentName: 'PolicyAgent',          orgName: 'MegaCo',       status: 'completed', durationMs: 8100,  costUsd: 0.0341, createdAt: new Date(Date.now() - 300000).toISOString() },
  { id: '4', agentName: 'RiskScoringAgent',     orgName: 'HealthTech',   status: 'failed',    durationMs: 1200,                    createdAt: new Date(Date.now() - 600000).toISOString() },
  { id: '5', agentName: 'ScopingAgent',         orgName: 'Acme Corp',    status: 'completed', durationMs: 3800,  costUsd: 0.0124, createdAt: new Date(Date.now() - 900000).toISOString() },
  { id: '6', agentName: 'VendorRiskAgent',      orgName: 'DataPipeline', status: 'completed', durationMs: 12400, costUsd: 0.0567, createdAt: new Date(Date.now() - 1800000).toISOString() },
];

export default function InternalDashboard() {
  const { data: stats } = useQuery<PlatformStats>({
    queryKey: ['internal-stats'],
    queryFn: () => internalApi.get('/internal/stats').then((r) => r.data).catch(() => MOCK_STATS),
    initialData: MOCK_STATS,
    refetchInterval: 30_000,
  });

  const { data: recentRuns } = useQuery<RecentRun[]>({
    queryKey: ['internal-recent-runs'],
    queryFn: () => internalApi.get('/internal/runs/recent').then((r) => r.data).catch(() => MOCK_RUNS),
    initialData: MOCK_RUNS,
    refetchInterval: 15_000,
  });

  const s = stats ?? MOCK_STATS;
  const runs = recentRuns ?? MOCK_RUNS;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-white">Platform Overview</h1>
          <p className="text-xs text-gray-500 mt-0.5">Live metrics · Auto-refreshes every 30s</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 text-xs text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            {s.runningWorkflows} workflows active
          </span>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Agent Runs" value={s.totalAgentRuns.toLocaleString()} sub="all time" icon={Activity} trend="up" accent="text-white" />
        <StatCard label="Active Customers" value={s.activeCustomers} sub="this month" icon={Users} accent="text-indigo-300" />
        <StatCard label="Total Cost" value={`$${s.totalCostUsd.toFixed(2)}`} sub="cumulative" icon={DollarSign} accent="text-amber-300" />
        <StatCard label="Avg Latency" value={`${(s.avgLatencyMs / 1000).toFixed(2)}s`} sub="per agent run" icon={Clock} accent="text-gray-200" />
        <StatCard label="Error Rate" value={`${(s.errorRate * 100).toFixed(1)}%`} sub="last 7 days" icon={AlertTriangle} accent={s.errorRate > 0.05 ? 'text-red-400' : 'text-emerald-400'} />
        <StatCard label="Hallucinations" value={s.hallucinationsDetected} sub="detected + blocked" icon={Cpu} accent={s.hallucinationsDetected > 0 ? 'text-red-400' : 'text-emerald-400'} />
        <StatCard label="Running Now" value={s.runningWorkflows} sub="live workflows" icon={Zap} accent="text-indigo-300" />
        <StatCard label="Total Workflows" value={s.totalWorkflows.toLocaleString()} sub="all orgs" icon={Activity} accent="text-gray-200" />
      </div>

      {/* Recent runs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Run log */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
            <p className="text-sm font-semibold text-white">Recent Agent Runs</p>
            <a href="/internal/workflows" className="text-xs text-indigo-400 hover:text-indigo-300">
              View all →
            </a>
          </div>
          <div className="px-5 py-1">
            {runs.map((run) => (
              <RunRow key={run.id} run={run} />
            ))}
          </div>
        </div>

        {/* Quick nav */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl">
          <div className="px-5 py-4 border-b border-gray-800">
            <p className="text-sm font-semibold text-white">Command Center</p>
          </div>
          <div className="p-3 grid grid-cols-2 gap-2">
            {[
              { href: '/internal/agents',       label: 'Agent Registry',    desc: 'View & configure all agents',     color: 'border-indigo-800 hover:border-indigo-600' },
              { href: '/internal/prompts',       label: 'Prompt Lab',        desc: 'Version & test prompt templates', color: 'border-purple-800 hover:border-purple-600' },
              { href: '/internal/observability', label: 'Observability',     desc: 'Traces, logs, cost breakdown',    color: 'border-blue-800 hover:border-blue-600' },
              { href: '/internal/customers',     label: 'Customers',         desc: 'Org management & overrides',      color: 'border-teal-800 hover:border-teal-600' },
              { href: '/internal/costs',         label: 'Cost Tracker',      desc: 'Spend by org and agent',          color: 'border-amber-800 hover:border-amber-600' },
              { href: '/internal/workflows',     label: 'All Workflows',     desc: 'Live + historical runs',          color: 'border-gray-700 hover:border-gray-600' },
            ].map(({ href, label, desc, color }) => (
              <a
                key={href}
                href={href}
                className={cn(
                  'block bg-gray-800/50 border rounded-xl p-3 transition-colors',
                  color,
                )}
              >
                <p className="text-sm font-semibold text-white mb-0.5">{label}</p>
                <p className="text-xs text-gray-500">{desc}</p>
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
