'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import {
  Building2, Users, ShieldCheck, Clock, ChevronRight,
  Search, TrendingUp, AlertTriangle, CheckCircle2, XCircle,
  RefreshCw, ExternalLink,
} from 'lucide-react';

// ─── Internal API client ──────────────────────────────────────────────────────

function getInternalToken() {
  if (typeof document === 'undefined') return '';
  return document.cookie
    .split('; ')
    .find((r) => r.startsWith('internal_token='))
    ?.split('=')[1] ?? '';
}

const internalApi = axios.create({ baseURL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001' });
internalApi.interceptors.request.use((cfg) => {
  const t = getInternalToken();
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});

// ─── Types ────────────────────────────────────────────────────────────────────

interface Customer {
  id: string;
  name: string;
  slug: string;
  plan: 'trial' | 'starter' | 'growth' | 'enterprise';
  status: 'active' | 'trial' | 'inactive' | 'churned';
  frameworks: string[];
  userCount: number;
  controlCount: number;
  readinessScore: number;
  lastAssessment: string | null;
  createdAt: string;
}

// ─── Mock data ────────────────────────────────────────────────────────────────

const MOCK_CUSTOMERS: Customer[] = [
  {
    id: 'org_1', name: 'Acme Corp', slug: 'acme-corp', plan: 'enterprise', status: 'active',
    frameworks: ['SOC 2', 'ISO 27001'], userCount: 14, controlCount: 87,
    readinessScore: 92, lastAssessment: new Date(Date.now() - 2 * 86400_000).toISOString(),
    createdAt: new Date(Date.now() - 180 * 86400_000).toISOString(),
  },
  {
    id: 'org_2', name: 'Brightwave AI', slug: 'brightwave', plan: 'growth', status: 'active',
    frameworks: ['SOC 2'], userCount: 6, controlCount: 64,
    readinessScore: 78, lastAssessment: new Date(Date.now() - 5 * 86400_000).toISOString(),
    createdAt: new Date(Date.now() - 90 * 86400_000).toISOString(),
  },
  {
    id: 'org_3', name: 'FinStack Ltd', slug: 'finstack', plan: 'enterprise', status: 'active',
    frameworks: ['SOC 2', 'PCI DSS', 'ISO 27001'], userCount: 22, controlCount: 134,
    readinessScore: 85, lastAssessment: new Date(Date.now() - 1 * 86400_000).toISOString(),
    createdAt: new Date(Date.now() - 240 * 86400_000).toISOString(),
  },
  {
    id: 'org_4', name: 'Launchpad SaaS', slug: 'launchpad', plan: 'starter', status: 'trial',
    frameworks: ['SOC 2'], userCount: 2, controlCount: 18,
    readinessScore: 34, lastAssessment: null,
    createdAt: new Date(Date.now() - 7 * 86400_000).toISOString(),
  },
  {
    id: 'org_5', name: 'Dataforge Inc', slug: 'dataforge', plan: 'growth', status: 'inactive',
    frameworks: ['SOC 2', 'HIPAA'], userCount: 9, controlCount: 72,
    readinessScore: 61, lastAssessment: new Date(Date.now() - 30 * 86400_000).toISOString(),
    createdAt: new Date(Date.now() - 120 * 86400_000).toISOString(),
  },
  {
    id: 'org_6', name: 'CloudPulse', slug: 'cloudpulse', plan: 'trial', status: 'trial',
    frameworks: ['SOC 2'], userCount: 3, controlCount: 0,
    readinessScore: 0, lastAssessment: null,
    createdAt: new Date(Date.now() - 2 * 86400_000).toISOString(),
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function planBadge(plan: Customer['plan']) {
  const map: Record<Customer['plan'], string> = {
    trial: 'bg-yellow-900/40 text-yellow-300 border border-yellow-700/40',
    starter: 'bg-blue-900/40 text-blue-300 border border-blue-700/40',
    growth: 'bg-purple-900/40 text-purple-300 border border-purple-700/40',
    enterprise: 'bg-indigo-900/40 text-indigo-300 border border-indigo-700/40',
  };
  return map[plan];
}

function statusIcon(status: Customer['status']) {
  if (status === 'active') return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
  if (status === 'trial')  return <Clock className="w-4 h-4 text-yellow-400" />;
  if (status === 'inactive') return <AlertTriangle className="w-4 h-4 text-amber-400" />;
  return <XCircle className="w-4 h-4 text-red-400" />;
}

function readinessColor(score: number) {
  if (score >= 80) return 'text-emerald-400';
  if (score >= 60) return 'text-yellow-400';
  if (score >= 40) return 'text-amber-400';
  return 'text-red-400';
}

function readinessBar(score: number) {
  if (score >= 80) return 'bg-emerald-500';
  if (score >= 60) return 'bg-yellow-500';
  if (score >= 40) return 'bg-amber-500';
  return 'bg-red-500';
}

function formatRelative(iso: string | null) {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const d = Math.floor(diff / 86400_000);
  if (d === 0) return 'Today';
  if (d === 1) return 'Yesterday';
  if (d < 7)  return `${d}d ago`;
  if (d < 30) return `${Math.floor(d / 7)}w ago`;
  return `${Math.floor(d / 30)}mo ago`;
}

// ─── CustomerRow ──────────────────────────────────────────────────────────────

function CustomerRow({ c }: { c: Customer }) {
  return (
    <tr className="border-b border-gray-800 hover:bg-gray-800/40 transition-colors group">
      {/* Org */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-600/20 border border-indigo-600/30 flex items-center justify-center flex-shrink-0">
            <Building2 className="w-4 h-4 text-indigo-400" />
          </div>
          <div>
            <p className="text-sm font-medium text-white">{c.name}</p>
            <p className="text-xs text-gray-500">{c.slug}</p>
          </div>
        </div>
      </td>

      {/* Status */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-1.5">
          {statusIcon(c.status)}
          <span className="text-xs capitalize text-gray-300">{c.status}</span>
        </div>
      </td>

      {/* Plan */}
      <td className="px-4 py-3">
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${planBadge(c.plan)}`}>
          {c.plan}
        </span>
      </td>

      {/* Frameworks */}
      <td className="px-4 py-3">
        <div className="flex flex-wrap gap-1">
          {c.frameworks.length ? c.frameworks.map((f) => (
            <span key={f} className="text-xs px-1.5 py-0.5 rounded bg-gray-700/60 text-gray-300 border border-gray-700">
              {f}
            </span>
          )) : <span className="text-xs text-gray-600">—</span>}
        </div>
      </td>

      {/* Users / Controls */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-3 text-xs text-gray-400">
          <span className="flex items-center gap-1">
            <Users className="w-3.5 h-3.5" />{c.userCount}
          </span>
          <span className="flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5" />{c.controlCount}
          </span>
        </div>
      </td>

      {/* Readiness */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="w-20 h-1.5 rounded-full bg-gray-700 overflow-hidden">
            <div
              className={`h-full rounded-full ${readinessBar(c.readinessScore)}`}
              style={{ width: `${c.readinessScore}%` }}
            />
          </div>
          <span className={`text-xs font-semibold ${readinessColor(c.readinessScore)}`}>
            {c.readinessScore}%
          </span>
        </div>
      </td>

      {/* Last assessment */}
      <td className="px-4 py-3">
        <span className="text-xs text-gray-400">{formatRelative(c.lastAssessment)}</span>
      </td>

      {/* Actions */}
      <td className="px-4 py-3 text-right">
        <a
          href={`/internal/customers/${c.id}`}
          className="opacity-0 group-hover:opacity-100 transition-opacity inline-flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300"
        >
          View <ChevronRight className="w-3.5 h-3.5" />
        </a>
      </td>
    </tr>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type StatusFilter = 'all' | 'active' | 'trial' | 'inactive';

export default function CustomersPage() {
  const [search, setSearch]       = useState('');
  const [statusFilter, setStatus] = useState<StatusFilter>('all');

  const { data: customers = [], isLoading, refetch } = useQuery<Customer[]>({
    queryKey: ['internal', 'customers'],
    queryFn: () =>
      internalApi.get('/internal/customers').then((r) => r.data).catch(() => MOCK_CUSTOMERS),
    staleTime: 30_000,
  });

  // Totals for stat strip
  const active   = customers.filter((c) => c.status === 'active').length;
  const trials   = customers.filter((c) => c.status === 'trial').length;
  const avgScore = customers.length
    ? Math.round(customers.reduce((s, c) => s + c.readinessScore, 0) / customers.length)
    : 0;

  // Filtered list
  const filtered = customers.filter((c) => {
    const matchSearch = !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.slug.includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || c.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const statusTabs: { key: StatusFilter; label: string }[] = [
    { key: 'all',      label: `All (${customers.length})` },
    { key: 'active',   label: `Active (${active})` },
    { key: 'trial',    label: `Trials (${trials})` },
    { key: 'inactive', label: `Inactive (${customers.filter((c) => c.status === 'inactive').length})` },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Customers</h1>
          <p className="text-sm text-gray-400 mt-0.5">Organization management and compliance health</p>
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
          { label: 'Total Orgs',        value: customers.length, icon: Building2,    color: 'text-indigo-400' },
          { label: 'Active',            value: active,           icon: CheckCircle2, color: 'text-emerald-400' },
          { label: 'Trials',            value: trials,           icon: Clock,        color: 'text-yellow-400' },
          { label: 'Avg Readiness',     value: `${avgScore}%`,   icon: TrendingUp,   color: 'text-purple-400' },
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

      {/* Filter bar */}
      <div className="flex items-center justify-between gap-4">
        {/* Status tabs */}
        <div className="flex gap-1 bg-gray-800/60 border border-gray-700/50 rounded-lg p-1">
          {statusTabs.map(({ key, label }) => (
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

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or slug…"
            className="pl-8 pr-3 py-1.5 rounded-lg bg-gray-800 border border-gray-700 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-indigo-500 w-60"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-gray-800/40 border border-gray-700/50 rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center">
            <RefreshCw className="w-6 h-6 text-gray-500 animate-spin mx-auto mb-2" />
            <p className="text-sm text-gray-500">Loading customers…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <Building2 className="w-8 h-8 text-gray-600 mx-auto mb-3" />
            <p className="text-sm text-gray-400">No customers match your filter</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-700/60">
                {['Organization', 'Status', 'Plan', 'Frameworks', 'Users / Controls', 'Readiness', 'Last Assessment', ''].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => <CustomerRow key={c.id} c={c} />)}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
