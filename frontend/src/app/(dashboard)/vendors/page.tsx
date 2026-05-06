'use client';

import { useQuery } from '@tanstack/react-query';
import { useState, useMemo } from 'react';
import { apiClient } from '@/lib/api/client';
import { formatDate } from '@/lib/utils';
import {
  Building2, AlertTriangle, CheckCircle, Search, ChevronDown, ChevronUp,
  Calendar, ShieldAlert, ShieldCheck, Package, ExternalLink,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

type Vendor = {
  id: string;
  vendorName: string;
  category?: string;
  riskLevel: 'critical' | 'high' | 'medium' | 'low';
  status?: 'approved' | 'flagged' | 'pending';
  findings?: string[];
  mitigations?: string[];
  lastReviewedAt?: string;
  nextReviewDate?: string;
  contactEmail?: string;
  website?: string;
  notes?: string;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const RISK_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

const RISK_CONFIG: Record<string, {
  badge: string; dot: string; border: string; accent: string;
}> = {
  critical: {
    badge:  'bg-red-100 text-red-800 border border-red-200',
    dot:    'bg-red-500',
    border: 'border-l-4 border-red-400',
    accent: 'bg-gradient-to-br from-red-50 to-white',
  },
  high: {
    badge:  'bg-orange-100 text-orange-800 border border-orange-200',
    dot:    'bg-orange-400',
    border: 'border-l-4 border-orange-400',
    accent: 'bg-gradient-to-br from-orange-50 to-white',
  },
  medium: {
    badge:  'bg-yellow-100 text-yellow-800 border border-yellow-200',
    dot:    'bg-yellow-400',
    border: 'border-l-4 border-yellow-300',
    accent: 'bg-gradient-to-br from-yellow-50 to-white',
  },
  low: {
    badge:  'bg-green-100 text-green-800 border border-green-200',
    dot:    'bg-green-400',
    border: 'border-l-4 border-green-300',
    accent: 'bg-gradient-to-br from-green-50 to-white',
  },
};

const STATUS_CONFIG: Record<string, string> = {
  approved: 'bg-green-50 text-green-700 border border-green-200',
  flagged:  'bg-red-50 text-red-700 border border-red-200',
  pending:  'bg-gray-100 text-gray-500',
};

const FILTER_TABS = ['all', 'critical', 'high', 'medium', 'low'] as const;
type FilterTab = typeof FILTER_TABS[number];

// ─── Progress Bar ─────────────────────────────────────────────────────────────

function MitigationBar({ done, total }: { done: number; total: number }) {
  if (total === 0) return null;
  const pct = Math.round((done / total) * 100);
  return (
    <div className="mt-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-gray-500">Mitigations</span>
        <span className="text-xs font-medium text-gray-700">{done}/{total}</span>
      </div>
      <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-500',
            pct === 100 ? 'bg-green-500' : pct >= 50 ? 'bg-blue-500' : 'bg-orange-400',
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ─── Expandable Detail Panel ──────────────────────────────────────────────────

function VendorDetailPanel({ vendor }: { vendor: Vendor }) {
  return (
    <div className="border-t border-gray-100 mt-4 pt-4 space-y-4 animate-in slide-in-from-top-1 duration-150">
      {/* Findings */}
      {vendor.findings && vendor.findings.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Findings</p>
          <div className="space-y-1.5">
            {vendor.findings.map((f, i) => (
              <div key={i} className="flex items-start gap-2 bg-orange-50 rounded-lg px-3 py-2">
                <AlertTriangle className="w-3.5 h-3.5 text-orange-500 mt-0.5 shrink-0" />
                <p className="text-xs text-gray-700">{f}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Mitigations */}
      {vendor.mitigations && vendor.mitigations.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Mitigations Applied</p>
          <div className="space-y-1.5">
            {vendor.mitigations.map((m, i) => (
              <div key={i} className="flex items-start gap-2 bg-green-50 rounded-lg px-3 py-2">
                <CheckCircle className="w-3.5 h-3.5 text-green-500 mt-0.5 shrink-0" />
                <p className="text-xs text-gray-700">{m}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Meta row */}
      <div className="grid grid-cols-2 gap-3">
        {vendor.nextReviewDate && (
          <div className="bg-gray-50 rounded-lg px-3 py-2">
            <p className="text-xs text-gray-400 mb-0.5">Next review</p>
            <p className="text-xs font-medium text-gray-700">{formatDate(vendor.nextReviewDate)}</p>
          </div>
        )}
        {vendor.contactEmail && (
          <div className="bg-gray-50 rounded-lg px-3 py-2">
            <p className="text-xs text-gray-400 mb-0.5">Contact</p>
            <p className="text-xs font-medium text-gray-700 truncate">{vendor.contactEmail}</p>
          </div>
        )}
      </div>

      {/* Notes */}
      {vendor.notes && (
        <div className="bg-gray-50 rounded-lg px-3 py-2">
          <p className="text-xs text-gray-400 mb-0.5">Notes</p>
          <p className="text-xs text-gray-600">{vendor.notes}</p>
        </div>
      )}

      {/* Website link */}
      {vendor.website && (
        <a
          href={vendor.website}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs text-brand-600 hover:text-brand-700 font-medium"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          Visit website
        </a>
      )}
    </div>
  );
}

// ─── Vendor Card ──────────────────────────────────────────────────────────────

function VendorCard({ vendor }: { vendor: Vendor }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = RISK_CONFIG[vendor.riskLevel] ?? RISK_CONFIG.low;
  const findingCount = vendor.findings?.length ?? 0;
  const mitigationCount = vendor.mitigations?.length ?? 0;

  return (
    <div className={cn('card overflow-hidden transition-shadow hover:shadow-md', cfg.border)}>
      {/* Clickable header */}
      <button
        onClick={() => setExpanded((p) => !p)}
        className="w-full text-left p-5"
      >
        {/* Top row */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-3">
            <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center', cfg.accent)}>
              <Building2 className="w-4 h-4 text-gray-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">{vendor.vendorName}</p>
              {vendor.category && (
                <p className="text-xs text-gray-400 capitalize">{vendor.category}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={cn('text-xs font-semibold px-2.5 py-1 rounded-full capitalize', cfg.badge)}>
              {vendor.riskLevel}
            </span>
            {expanded
              ? <ChevronUp className="w-4 h-4 text-gray-400 shrink-0" />
              : <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />}
          </div>
        </div>

        {/* Chips row */}
        <div className="flex items-center gap-2 mb-3">
          {findingCount > 0 && (
            <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-md bg-orange-50 text-orange-700 border border-orange-200">
              <ShieldAlert className="w-3 h-3" />
              {findingCount} finding{findingCount !== 1 ? 's' : ''}
            </span>
          )}
          {mitigationCount > 0 && (
            <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-md bg-green-50 text-green-700 border border-green-200">
              <ShieldCheck className="w-3 h-3" />
              {mitigationCount} mitigated
            </span>
          )}
          {vendor.status && (
            <span className={cn('text-xs px-2 py-0.5 rounded-full capitalize', STATUS_CONFIG[vendor.status] ?? STATUS_CONFIG.pending)}>
              {vendor.status}
            </span>
          )}
        </div>

        {/* Mitigation progress bar */}
        <MitigationBar done={mitigationCount} total={findingCount} />

        {/* Footer */}
        {vendor.lastReviewedAt && (
          <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-gray-100">
            <Calendar className="w-3 h-3 text-gray-400" />
            <p className="text-xs text-gray-400">Last reviewed {formatDate(vendor.lastReviewedAt)}</p>
          </div>
        )}
      </button>

      {/* Expandable panel */}
      {expanded && (
        <div className="px-5 pb-5">
          <VendorDetailPanel vendor={vendor} />
        </div>
      )}
    </div>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({ hasSearch }: { hasSearch: boolean }) {
  return (
    <div className="card p-16 text-center col-span-full">
      <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
        {hasSearch
          ? <Search className="w-7 h-7 text-gray-300" />
          : <Package className="w-7 h-7 text-gray-300" />}
      </div>
      <p className="text-sm font-semibold text-gray-700 mb-1">
        {hasSearch ? 'No vendors match your filter' : 'No vendor assessments yet'}
      </p>
      <p className="text-xs text-gray-400 max-w-xs mx-auto">
        {hasSearch
          ? 'Try a different risk level or clear the search.'
          : 'Run a compliance assessment — the Vendor Risk agent evaluates your tech-stack vendors automatically.'}
      </p>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function VendorsPage() {
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<FilterTab>('all');

  const { data, isLoading } = useQuery({
    queryKey: ['vendors'],
    queryFn: () => apiClient.get('/vendor-risk').then((r) => r.data),
  });

  const vendors: Vendor[] = data ?? [];

  // Summary counts
  const summary = useMemo(() => ({
    total:    vendors.length,
    critical: vendors.filter((v) => v.riskLevel === 'critical').length,
    high:     vendors.filter((v) => v.riskLevel === 'high').length,
    medium:   vendors.filter((v) => v.riskLevel === 'medium').length,
    low:      vendors.filter((v) => v.riskLevel === 'low').length,
  }), [vendors]);

  // Filtered + sorted list
  const filtered = useMemo(() => {
    let list = [...vendors].sort(
      (a, b) => (RISK_ORDER[a.riskLevel] ?? 4) - (RISK_ORDER[b.riskLevel] ?? 4),
    );
    if (activeTab !== 'all') list = list.filter((v) => v.riskLevel === activeTab);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (v) =>
          v.vendorName.toLowerCase().includes(q) ||
          (v.category ?? '').toLowerCase().includes(q),
      );
    }
    return list;
  }, [vendors, activeTab, search]);

  return (
    <div className="p-8 max-w-6xl">
      {/* ── Header ── */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Vendor Risk</h1>
        <p className="text-sm text-gray-500 mt-1">
          Third-party vendor assessments and risk posture
        </p>
      </div>

      {/* ── Risk Summary Strip ── */}
      {!isLoading && vendors.length > 0 && (
        <div className="flex items-center gap-6 bg-white border border-gray-200 rounded-xl px-5 py-3 mb-6 shadow-sm">
          <span className="text-sm font-medium text-gray-700">
            {summary.total} vendor{summary.total !== 1 ? 's' : ''}
          </span>
          <div className="h-4 w-px bg-gray-200" />
          {(['critical', 'high', 'medium', 'low'] as const).map((level) => (
            <div key={level} className="flex items-center gap-1.5">
              <span className={cn('w-2 h-2 rounded-full', RISK_CONFIG[level].dot)} />
              <span className="text-sm text-gray-600">
                <span className="font-semibold">{summary[level]}</span>{' '}
                <span className="text-gray-400 capitalize">{level}</span>
              </span>
            </div>
          ))}
        </div>
      )}

      {/* ── Search + Filter ── */}
      {!isLoading && vendors.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          {/* Search */}
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search vendors…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg bg-white
                         text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2
                         focus:ring-brand-500 focus:border-transparent"
            />
          </div>

          {/* Filter tabs */}
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            {FILTER_TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  'text-xs font-medium px-3 py-1.5 rounded-md capitalize transition-all',
                  activeTab === tab
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700',
                )}
              >
                {tab === 'all' ? `All (${summary.total})` : (
                  <span className="flex items-center gap-1.5">
                    <span className={cn('w-1.5 h-1.5 rounded-full', RISK_CONFIG[tab].dot)} />
                    {tab} {summary[tab] > 0 && `(${summary[tab]})`}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Content ── */}
      {isLoading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-6 h-6 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.length === 0
            ? <EmptyState hasSearch={search.trim().length > 0 || activeTab !== 'all'} />
            : filtered.map((v) => <VendorCard key={v.id} vendor={v} />)}
        </div>
      )}
    </div>
  );
}
