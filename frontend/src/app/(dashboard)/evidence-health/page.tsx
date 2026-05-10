'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { gapAnalysisApi, EvidenceHealthItem } from '@/lib/api/gap-analysis';
import {
  HeartPulse, CheckCircle2, AlertTriangle, XCircle, Clock,
  Search, Filter, ArrowRight, Shield,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';

const STATUS_CONFIG = {
  fresh: { label: 'Fresh', color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200', icon: CheckCircle2 },
  expiring_soon: { label: 'Expiring Soon', color: 'text-yellow-600', bg: 'bg-yellow-50', border: 'border-yellow-200', icon: Clock },
  expired: { label: 'Expired', color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200', icon: XCircle },
  stale: { label: 'Stale', color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200', icon: AlertTriangle },
  invalid: { label: 'Invalid', color: 'text-gray-600', bg: 'bg-gray-50', border: 'border-gray-200', icon: XCircle },
};

function SummaryBar({ summary }: { summary: any }) {
  const total = summary.totalEvidence || 1;
  const segments = [
    { key: 'fresh', count: summary.fresh, color: 'bg-green-400' },
    { key: 'expiring_soon', count: summary.expiringSoon, color: 'bg-yellow-400' },
    { key: 'stale', count: summary.stale, color: 'bg-orange-400' },
    { key: 'expired', count: summary.expired, color: 'bg-red-400' },
    { key: 'invalid', count: summary.invalid, color: 'bg-gray-400' },
  ];

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-800">Evidence Status Distribution</h3>
        <span className="text-xs text-gray-500">{summary.totalEvidence} total items</span>
      </div>
      <div className="flex gap-0.5 h-4 rounded-full overflow-hidden bg-gray-100 mb-3">
        {segments.map((s) => {
          const pct = (s.count / total) * 100;
          return pct > 0 ? <div key={s.key} className={cn(s.color, 'rounded-sm')} style={{ width: `${pct}%` }} /> : null;
        })}
      </div>
      <div className="grid grid-cols-5 gap-2">
        {segments.map((s) => {
          const config = STATUS_CONFIG[s.key as keyof typeof STATUS_CONFIG];
          return (
            <div key={s.key} className="text-center">
              <p className={cn('text-lg font-bold', config.color)}>{s.count}</p>
              <p className="text-[10px] text-gray-500">{config.label}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MetricCards({ summary }: { summary: any }) {
  const coverageColor = summary.coverageRate >= 80 ? 'text-green-600' : summary.coverageRate >= 50 ? 'text-yellow-600' : 'text-red-600';

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <p className="text-xs text-gray-500">Evidence Coverage</p>
        <p className={cn('text-2xl font-bold', coverageColor)}>{summary.coverageRate}%</p>
        <p className="text-[10px] text-gray-400">of applicable controls</p>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <p className="text-xs text-gray-500">Controls Missing Evidence</p>
        <p className="text-2xl font-bold text-red-600">{summary.controlsWithoutEvidence}</p>
        <p className="text-[10px] text-gray-400">need attention</p>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <p className="text-xs text-gray-500">Avg Collection Age</p>
        <p className="text-2xl font-bold text-gray-900">{summary.avgDaysSinceCollection}d</p>
        <p className="text-[10px] text-gray-400">days since collected</p>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <p className="text-xs text-gray-500">At Risk</p>
        <p className="text-2xl font-bold text-orange-600">{summary.expiringSoon + summary.expired + summary.stale}</p>
        <p className="text-[10px] text-gray-400">expiring, expired, or stale</p>
      </div>
    </div>
  );
}

function FrameworkBreakdown({ byFramework }: { byFramework: any[] }) {
  if (byFramework.length === 0) return null;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
        <Shield className="w-4 h-4 text-brand-600" />
        By Framework
      </h3>
      <div className="space-y-2">
        {byFramework.map((fw) => {
          const healthPct = fw.total > 0 ? Math.round((fw.fresh / fw.total) * 100) : 0;
          return (
            <div key={fw.framework} className="flex items-center gap-3">
              <span className="text-xs text-gray-700 w-28 truncate">{fw.framework}</span>
              <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={cn('h-full rounded-full', healthPct >= 80 ? 'bg-green-400' : healthPct >= 50 ? 'bg-yellow-400' : 'bg-red-400')}
                  style={{ width: `${healthPct}%` }}
                />
              </div>
              <span className="text-xs text-gray-500 w-20 text-right">
                {fw.fresh}/{fw.total} fresh
              </span>
              {fw.atRisk > 0 && (
                <span className="text-[10px] text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded">
                  {fw.atRisk} at risk
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function EvidenceRow({ item }: { item: EvidenceHealthItem }) {
  const config = STATUS_CONFIG[item.status];
  const Icon = config.icon;

  return (
    <div className={cn('rounded-lg border p-3', config.bg, config.border)}>
      <div className="flex items-start gap-3">
        <Icon className={cn('w-4 h-4 mt-0.5 flex-shrink-0', config.color)} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-gray-800 truncate">{item.title}</p>
            <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-medium', config.bg, config.color)}>
              {config.label}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-[10px] font-mono text-brand-600 bg-brand-50 px-1 py-0.5 rounded">{item.controlCode}</span>
            <span className="text-[10px] text-gray-400">{item.framework}</span>
            <span className="text-[10px] text-gray-400 capitalize">{item.type} · {item.source}</span>
          </div>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-[10px] text-gray-400">
              Collected {item.daysSinceCollection}d ago
            </span>
            {item.daysUntilExpiry !== null && (
              <span className={cn('text-[10px]', item.daysUntilExpiry < 0 ? 'text-red-500' : item.daysUntilExpiry < 30 ? 'text-yellow-600' : 'text-gray-400')}>
                {item.daysUntilExpiry < 0
                  ? `Expired ${Math.abs(item.daysUntilExpiry)}d ago`
                  : `Expires in ${item.daysUntilExpiry}d`}
              </span>
            )}
          </div>
        </div>
        <Link href="/evidence" className="text-brand-600 hover:text-brand-700 flex-shrink-0">
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}

export default function EvidenceHealthPage() {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['evidence-health'],
    queryFn: () => gapAnalysisApi.getEvidenceHealth(),
  });

  const filtered = data?.items.filter((item) => {
    if (statusFilter !== 'all' && item.status !== statusFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return item.title.toLowerCase().includes(q) ||
        item.controlCode.toLowerCase().includes(q) ||
        item.controlTitle.toLowerCase().includes(q);
    }
    return true;
  }) ?? [];

  // Sort: expired first, then expiring soon, then stale, then fresh
  const statusOrder = { expired: 0, expiring_soon: 1, stale: 2, invalid: 3, fresh: 4 };
  filtered.sort((a, b) => statusOrder[a.status] - statusOrder[b.status]);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <HeartPulse className="w-6 h-6 text-brand-600" />
          Evidence Health
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Monitor evidence freshness, expiry dates, and coverage gaps
        </p>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-gray-400">Analyzing evidence health...</div>
      ) : !data || data.items.length === 0 ? (
        <div className="text-center py-12">
          <HeartPulse className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-lg font-medium text-gray-700">No evidence collected yet</p>
          <p className="text-sm text-gray-400">
            Start uploading evidence to see health metrics.
          </p>
          <Link href="/evidence" className="inline-flex items-center gap-1 mt-3 text-sm text-brand-600 hover:text-brand-700">
            Go to Evidence <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      ) : (
        <>
          <MetricCards summary={data.summary} />
          <SummaryBar summary={data.summary} />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <FrameworkBreakdown byFramework={data.summary.byFramework} />
            {/* Alerts */}
            <div className="space-y-3">
              {data.summary.expired > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
                  <XCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-red-800">
                      {data.summary.expired} evidence item{data.summary.expired > 1 ? 's' : ''} expired
                    </p>
                    <p className="text-xs text-red-600 mt-0.5">
                      Expired evidence will fail auditor review. Re-collect or refresh immediately.
                    </p>
                  </div>
                </div>
              )}
              {data.summary.expiringSoon > 0 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex items-start gap-3">
                  <Clock className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-yellow-800">
                      {data.summary.expiringSoon} item{data.summary.expiringSoon > 1 ? 's' : ''} expiring within 30 days
                    </p>
                    <p className="text-xs text-yellow-600 mt-0.5">
                      Schedule re-collection before expiry to maintain audit readiness.
                    </p>
                  </div>
                </div>
              )}
              {data.summary.controlsWithoutEvidence > 0 && (
                <div className="bg-brand-50 border border-brand-200 rounded-xl p-4 flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-brand-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-brand-800">
                      {data.summary.controlsWithoutEvidence} controls have no evidence
                    </p>
                    <p className="text-xs text-brand-600 mt-0.5">
                      Upload evidence for these controls to improve your coverage rate.
                    </p>
                    <Link href="/action-plan" className="text-xs text-brand-600 font-medium mt-1 inline-flex items-center gap-1">
                      View action plan <ArrowRight className="w-3 h-3" />
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Filter bar */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search evidence..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <Filter className="w-4 h-4 text-gray-400" />
              {['all', 'expired', 'expiring_soon', 'stale', 'fresh', 'invalid'].map((status) => {
                const config = status !== 'all' ? STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] : null;
                return (
                  <button
                    key={status}
                    onClick={() => setStatusFilter(status)}
                    className={cn(
                      'px-3 py-1.5 text-xs font-medium rounded-full border transition-colors',
                      statusFilter === status
                        ? 'bg-brand-50 border-brand-300 text-brand-700'
                        : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50',
                    )}
                  >
                    {config ? config.label : 'All'}
                    {status !== 'all' && data && (
                      <span className="ml-1 opacity-70">
                        ({data.items.filter((i) => i.status === status).length})
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Evidence list */}
          <div className="space-y-2">
            <p className="text-xs text-gray-500 px-1">{filtered.length} evidence items</p>
            {filtered.map((item) => (
              <EvidenceRow key={item.id} item={item} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
