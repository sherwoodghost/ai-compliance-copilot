'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { complianceApi } from '@/lib/api/compliance';
import { apiClient as api } from '@/lib/api/client';
import {
  FileText, Check, Archive, X, ChevronRight, Plus, Download,
  Clock, CheckCircle2, ArchiveIcon, AlertCircle, Search,
  RotateCcw, Shield,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

type Policy = {
  id: string;
  title: string;
  status: 'draft' | 'approved' | 'archived' | 'out_of_date';
  version: number;
  content?: string;
  framework?: string;
  updatedAt: string;
  approvedAt?: string;
  approvedBy?: { fullName: string };
  controlCount?: number;
};

type StatusFilter = 'all' | 'draft' | 'approved' | 'archived';

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS = {
  draft:       { label: 'Draft',       cls: 'bg-amber-50 text-amber-700 border border-amber-200',    Icon: Clock },
  approved:    { label: 'Approved',    cls: 'bg-emerald-50 text-emerald-700 border border-emerald-200', Icon: CheckCircle2 },
  archived:    { label: 'Archived',    cls: 'bg-gray-100 text-gray-500',                               Icon: ArchiveIcon },
  out_of_date: { label: 'Out of Date', cls: 'bg-red-50 text-red-600 border border-red-200',           Icon: AlertCircle },
} as const;

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS[status as keyof typeof STATUS] ?? STATUS.draft;
  return (
    <span className={cn('inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full', cfg.cls)}>
      <cfg.Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  );
}

// ─── Policy Card ──────────────────────────────────────────────────────────────

function PolicyCard({ policy, onSelect }: { policy: Policy; onSelect: () => void }) {
  const frameworkColor = policy.framework === 'SOC2' ? 'bg-blue-50 text-blue-700' :
                         policy.framework === 'ISO27001' ? 'bg-purple-50 text-purple-700' :
                         'bg-gray-100 text-gray-600';

  return (
    <button
      onClick={onSelect}
      className="w-full text-left group relative bg-white border border-gray-200 rounded-xl p-5
                 hover:border-brand-300 hover:shadow-sm transition-all duration-150"
    >
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center shrink-0 mt-0.5
                        group-hover:bg-brand-100 transition-colors">
          <FileText className="w-5 h-5 text-brand-600" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3 mb-2">
            <p className="text-sm font-semibold text-gray-900 leading-tight">{policy.title}</p>
            <StatusBadge status={policy.status} />
          </div>

          <div className="flex items-center gap-3 text-xs text-gray-400">
            <span>v{policy.version}</span>
            <span>·</span>
            <span>Updated {new Date(policy.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
            {policy.framework && (
              <>
                <span>·</span>
                <span className={cn('px-1.5 py-0.5 rounded font-medium', frameworkColor)}>
                  {policy.framework}
                </span>
              </>
            )}
            {policy.controlCount !== undefined && policy.controlCount > 0 && (
              <>
                <span>·</span>
                <span className="flex items-center gap-1">
                  <Shield className="w-3 h-3" />
                  {policy.controlCount} controls
                </span>
              </>
            )}
          </div>

          {policy.approvedAt && policy.approvedBy && (
            <p className="text-xs text-emerald-600 mt-2">
              Approved by {policy.approvedBy.fullName} on{' '}
              {new Date(policy.approvedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </p>
          )}
        </div>

        <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-brand-500 transition-colors mt-1 shrink-0" />
      </div>
    </button>
  );
}

// ─── Policy Detail Panel ──────────────────────────────────────────────────────

function PolicyPanel({ policy, onClose }: { policy: Policy; onClose: () => void }) {
  const qc = useQueryClient();

  const { data: fullPolicy } = useQuery({
    queryKey: ['policy', policy.id],
    queryFn: () => complianceApi.getPolicy(policy.id),
  });

  const approve = useMutation({
    mutationFn: () => complianceApi.approvePolicy(policy.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['policies'] });
      qc.invalidateQueries({ queryKey: ['policy', policy.id] });
    },
  });

  const archive = useMutation({
    mutationFn: () => complianceApi.archivePolicy(policy.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['policies'] });
      onClose();
    },
  });

  const displayPolicy = fullPolicy ?? policy;

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative ml-auto w-full max-w-2xl bg-white h-full flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-start gap-4 px-6 py-5 border-b border-gray-200 shrink-0">
          <div className="w-9 h-9 rounded-xl bg-brand-50 flex items-center justify-center shrink-0">
            <FileText className="w-4 h-4 text-brand-600" />
          </div>

          <div className="flex-1 min-w-0">
            <h2 className="text-base font-semibold text-gray-900 leading-tight">{displayPolicy.title}</h2>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-gray-400">v{displayPolicy.version}</span>
              <StatusBadge status={displayPolicy.status} />
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {displayPolicy.status === 'draft' && (
              <button
                className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1.5"
                onClick={() => approve.mutate()}
                disabled={approve.isPending}
              >
                <Check className="w-3.5 h-3.5" />
                {approve.isPending ? 'Approving…' : 'Approve'}
              </button>
            )}
            {displayPolicy.status !== 'archived' && (
              <button
                className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5"
                onClick={() => archive.mutate()}
                disabled={archive.isPending}
              >
                <Archive className="w-3.5 h-3.5" />
                Archive
              </button>
            )}
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400
                         hover:text-gray-600 hover:bg-gray-100 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">
          <div className="px-6 py-6">
            <div className="prose prose-sm max-w-none text-gray-800 prose-headings:text-gray-900
                            prose-headings:font-semibold prose-a:text-brand-600 prose-code:text-brand-700
                            prose-code:bg-brand-50 prose-code:rounded prose-code:px-1">
              <ReactMarkdown>{displayPolicy.content ?? '*No content available.*'}</ReactMarkdown>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between shrink-0">
          <button
            className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1.5 transition-colors"
            onClick={() => {/* download handler */}}
          >
            <Download className="w-3.5 h-3.5" />
            Download PDF
          </button>
          {displayPolicy.approvedAt && displayPolicy.approvedBy && (
            <p className="text-xs text-gray-400">
              Approved by <span className="text-gray-600 font-medium">{displayPolicy.approvedBy.fullName}</span>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({ onGenerate, isPending }: { onGenerate: () => void; isPending: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
        <FileText className="w-7 h-7 text-gray-400" />
      </div>
      <h3 className="text-sm font-semibold text-gray-900 mb-1">No policies yet</h3>
      <p className="text-sm text-gray-500 max-w-xs mb-6">
        Generate a baseline policy set tailored to your organization's controls and frameworks.
      </p>
      <button
        className="btn-primary flex items-center gap-2"
        onClick={onGenerate}
        disabled={isPending}
      >
        <Plus className="w-4 h-4" />
        {isPending ? 'Generating policies…' : 'Generate baseline policies'}
      </button>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PoliciesPage() {
  const [selected, setSelected] = useState<Policy | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['policies'],
    queryFn: complianceApi.getPolicies,
  });

  const generate = useMutation({
    mutationFn: () => api.post('/orchestrator/assess', { frameworkType: 'SOC2' }).then((r) => r.data),
    onSuccess: () => {
      setTimeout(() => qc.invalidateQueries({ queryKey: ['policies'] }), 5000);
    },
  });

  const policies: Policy[] = (data as Policy[]) ?? [];

  const counts = {
    all: policies.length,
    draft: policies.filter((p) => p.status === 'draft').length,
    approved: policies.filter((p) => p.status === 'approved').length,
    archived: policies.filter((p) => p.status === 'archived').length,
  };

  const filtered = policies.filter((p) => {
    if (statusFilter !== 'all' && p.status !== statusFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return p.title.toLowerCase().includes(q);
    }
    return true;
  });

  const STATUS_TABS: { key: StatusFilter; label: string }[] = [
    { key: 'all',      label: `All (${counts.all})` },
    { key: 'draft',    label: `Draft (${counts.draft})` },
    { key: 'approved', label: `Approved (${counts.approved})` },
    { key: 'archived', label: `Archived (${counts.archived})` },
  ];

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Policies</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {counts.approved} approved · {counts.draft} awaiting review
          </p>
        </div>

        <button
          className="btn-primary flex items-center gap-2 text-sm"
          onClick={() => generate.mutate()}
          disabled={generate.isPending}
        >
          {generate.isPending ? (
            <>
              <RotateCcw className="w-4 h-4 animate-spin" />
              Generating…
            </>
          ) : (
            <>
              <Plus className="w-4 h-4" />
              Generate policies
            </>
          )}
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white border border-gray-200 rounded-xl p-5 animate-pulse">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-gray-100 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-100 rounded w-2/3" />
                  <div className="h-3 bg-gray-100 rounded w-1/3" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : policies.length === 0 ? (
        <EmptyState onGenerate={() => generate.mutate()} isPending={generate.isPending} />
      ) : (
        <>
          {/* Search + filters */}
          <div className="flex flex-col sm:flex-row gap-3 mb-5">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search policies…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg
                           focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
              />
            </div>

            <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg">
              {STATUS_TABS.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setStatusFilter(key)}
                  className={cn(
                    'px-3 py-1.5 text-xs font-medium rounded-md transition-all',
                    statusFilter === key
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Policy list */}
          <div className="space-y-2">
            {filtered.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <p className="text-sm">No policies match your filter.</p>
              </div>
            ) : (
              filtered.map((p) => (
                <PolicyCard key={p.id} policy={p} onSelect={() => setSelected(p)} />
              ))
            )}
          </div>
        </>
      )}

      {selected && (
        <PolicyPanel policy={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}
