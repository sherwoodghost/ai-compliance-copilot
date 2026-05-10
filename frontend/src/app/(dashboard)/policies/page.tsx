'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { complianceApi } from '@/lib/api/compliance';
import { formatDate, cn } from '@/lib/utils';
import {
  FileText, Check, Archive, ChevronRight, Sparkles, Shield,
  AlertTriangle, Search, Plus, Wand2, RefreshCw, Eye,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';

const STATUS_BADGE: Record<string, string> = {
  draft: 'bg-yellow-50 text-yellow-700 border border-yellow-200',
  approved: 'bg-green-50 text-green-700 border border-green-200',
  archived: 'bg-gray-100 text-gray-400 border border-gray-200',
};

// ──────────────────────────────────────────────────────────────────────
// Coverage Summary Bar
// ──────────────────────────────────────────────────────────────────────
function CoverageSummary({ onGenerateClick }: { onGenerateClick: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ['policy-coverage'],
    queryFn: complianceApi.getPolicyCoverage,
  });

  if (isLoading || !data) return null;

  const pct = data.coveragePercentage;
  const color = pct >= 80 ? 'text-green-600' : pct >= 50 ? 'text-yellow-600' : 'text-red-600';
  const barColor = pct >= 80 ? 'bg-green-400' : pct >= 50 ? 'bg-yellow-400' : 'bg-red-400';

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-brand-600" />
          <h3 className="text-sm font-semibold text-gray-800">Policy Coverage</h3>
        </div>
        <span className={cn('text-lg font-bold', color)}>{pct}%</span>
      </div>
      <div className="flex gap-0.5 h-2.5 rounded-full overflow-hidden bg-gray-100 mb-3">
        <div className={cn(barColor, 'rounded-full transition-all')} style={{ width: `${pct}%` }} />
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 text-xs text-gray-500">
          <span><strong className="text-gray-700">{data.totalCovered}</strong> covered</span>
          <span><strong className="text-red-600">{data.totalGaps}</strong> missing</span>
          <span>{data.totalControls} total controls</span>
        </div>
        {data.totalGaps > 0 && (
          <button
            onClick={onGenerateClick}
            className="text-xs text-brand-600 hover:text-brand-700 font-medium flex items-center gap-1"
          >
            <Sparkles className="w-3 h-3" />
            Generate missing
          </button>
        )}
      </div>
      {data.byFramework && data.byFramework.length > 1 && (
        <div className="mt-3 pt-3 border-t border-gray-100 grid grid-cols-2 md:grid-cols-4 gap-2">
          {data.byFramework.map((fw: any) => (
            <div key={fw.framework} className="text-center">
              <p className="text-xs text-gray-500 truncate">{fw.framework}</p>
              <p className="text-sm font-semibold text-gray-800">
                {fw.covered}/{fw.total}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Generate Policy Modal
// ──────────────────────────────────────────────────────────────────────
function GeneratePolicyModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');

  const { data: coverage } = useQuery({
    queryKey: ['policy-coverage'],
    queryFn: complianceApi.getPolicyCoverage,
  });

  const generate = useMutation({
    mutationFn: (controlId: string) => complianceApi.generatePolicy(controlId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['policies'] });
      qc.invalidateQueries({ queryKey: ['policy-coverage'] });
    },
  });

  const gaps = coverage?.gaps ?? [];
  const filtered = gaps.filter((g: any) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return g.controlCode.toLowerCase().includes(q) ||
      g.controlTitle.toLowerCase().includes(q) ||
      g.frameworkName.toLowerCase().includes(q);
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        <div className="px-6 py-5 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-brand-50 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-brand-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Generate AI Policy</h2>
                <p className="text-xs text-gray-500">{gaps.length} controls missing policies</p>
              </div>
            </div>
            <button className="text-gray-400 hover:text-gray-600" onClick={onClose}>✕</button>
          </div>
          <div className="relative mt-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search controls..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
          {filtered.length === 0 ? (
            <div className="text-center py-8">
              <Check className="w-8 h-8 text-green-400 mx-auto mb-2" />
              <p className="text-sm text-gray-500">All controls have policies!</p>
            </div>
          ) : (
            filtered.map((gap: any) => (
              <div
                key={gap.controlId}
                className="flex items-center justify-between p-3 rounded-lg border border-gray-200 hover:border-brand-200 hover:bg-brand-50/30 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono text-brand-600 bg-brand-50 px-1.5 py-0.5 rounded">
                      {gap.controlCode}
                    </span>
                    <span className="text-xs text-gray-400">{gap.frameworkName}</span>
                  </div>
                  <p className="text-sm text-gray-800 mt-1 truncate">{gap.controlTitle}</p>
                </div>
                <button
                  onClick={() => generate.mutate(gap.controlId)}
                  disabled={generate.isPending}
                  className="ml-3 px-3 py-1.5 text-xs font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-700 disabled:opacity-50 flex items-center gap-1.5 shrink-0"
                >
                  {generate.isPending && generate.variables === gap.controlId ? (
                    <>
                      <RefreshCw className="w-3 h-3 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Wand2 className="w-3 h-3" />
                      Generate
                    </>
                  )}
                </button>
              </div>
            ))
          )}
        </div>
        {generate.isSuccess && (
          <div className="px-6 py-3 border-t border-gray-100 bg-green-50">
            <p className="text-xs text-green-700 flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5" />
              Policy generated successfully! It&apos;s ready for your review.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Policy Row
// ──────────────────────────────────────────────────────────────────────
function PolicyRow({ policy, onSelect }: { policy: any; onSelect: () => void }) {
  return (
    <button
      className="w-full text-left bg-white rounded-xl border border-gray-200 p-4 hover:border-brand-300 transition-colors flex items-start gap-3"
      onClick={onSelect}
    >
      <div className="w-8 h-8 rounded-lg bg-brand-50 flex items-center justify-center shrink-0 mt-0.5">
        <FileText className="w-4 h-4 text-brand-600" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-gray-900 truncate">{policy.title}</p>
          <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium', STATUS_BADGE[policy.status] ?? STATUS_BADGE.draft)}>
            {policy.status}
          </span>
          {policy.generatedBy === 'agent' && (
            <span className="inline-flex items-center gap-0.5 text-[10px] text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded-full">
              <Sparkles className="w-2.5 h-2.5" /> AI
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 mt-1">
          {policy.control && (
            <span className="text-[10px] font-mono text-brand-600 bg-brand-50 px-1 py-0.5 rounded">
              {policy.control.code}
            </span>
          )}
          <span className="text-xs text-gray-400">v{policy.version}</span>
          <span className="text-xs text-gray-400">Updated {formatDate(policy.updatedAt)}</span>
        </div>
      </div>
      <ChevronRight className="w-4 h-4 text-gray-300 mt-1 shrink-0" />
    </button>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Policy Detail Panel
// ──────────────────────────────────────────────────────────────────────
function PolicyDetail({ policy, onClose }: { policy: any; onClose: () => void }) {
  const qc = useQueryClient();

  const approve = useMutation({
    mutationFn: () => complianceApi.approvePolicy(policy.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['policies'] }),
  });

  const archive = useMutation({
    mutationFn: () => complianceApi.archivePolicy(policy.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['policies'] }),
  });

  const improve = useMutation({
    mutationFn: () => complianceApi.aiImprovePolicy(policy.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['policies'] });
      qc.invalidateQueries({ queryKey: ['policy-coverage'] });
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative ml-auto w-full max-w-2xl bg-white h-full flex flex-col shadow-2xl">
        <div className="flex items-start justify-between px-6 py-5 border-b border-gray-200">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-gray-900">{policy.title}</h2>
              {policy.generatedBy === 'agent' && (
                <span className="inline-flex items-center gap-0.5 text-[10px] text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded-full">
                  <Sparkles className="w-2.5 h-2.5" /> AI Generated
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-1">
              {policy.control && (
                <span className="text-[10px] font-mono text-brand-600 bg-brand-50 px-1 py-0.5 rounded">
                  {policy.control.code}
                </span>
              )}
              <span className="text-xs text-gray-400">v{policy.version} · {policy.status}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {policy.status === 'draft' && (
              <>
                <button
                  className="px-3 py-1.5 text-xs font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-700 disabled:opacity-50 flex items-center gap-1.5"
                  onClick={() => approve.mutate()}
                  disabled={approve.isPending}
                >
                  <Check className="w-3 h-3" /> Approve
                </button>
                <button
                  className="px-3 py-1.5 text-xs font-medium text-purple-700 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100 disabled:opacity-50 flex items-center gap-1.5"
                  onClick={() => improve.mutate()}
                  disabled={improve.isPending}
                >
                  {improve.isPending ? (
                    <><RefreshCw className="w-3 h-3 animate-spin" /> Improving...</>
                  ) : (
                    <><Wand2 className="w-3 h-3" /> AI Improve</>
                  )}
                </button>
              </>
            )}
            {policy.status !== 'archived' && (
              <button
                className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 disabled:opacity-50 flex items-center gap-1.5"
                onClick={() => archive.mutate()}
                disabled={archive.isPending}
              >
                <Archive className="w-3 h-3" /> Archive
              </button>
            )}
            <button className="text-gray-400 hover:text-gray-600 ml-2" onClick={onClose}>
              ✕
            </button>
          </div>
        </div>
        {improve.isSuccess && (
          <div className="px-6 py-2 bg-green-50 border-b border-green-100">
            <p className="text-xs text-green-700 flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5" />
              Improved version created! Refresh to see the latest draft.
            </p>
          </div>
        )}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          <div className="prose prose-sm max-w-none text-gray-800">
            <ReactMarkdown>{policy.content ?? '_No content_'}</ReactMarkdown>
          </div>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Main Page
// ──────────────────────────────────────────────────────────────────────
export default function PoliciesPage() {
  const [selected, setSelected] = useState<any>(null);
  const [showGenerate, setShowGenerate] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['policies'],
    queryFn: complianceApi.getPolicies,
  });

  const policies: any[] = data ?? [];

  const filtered = policies.filter((p) => {
    if (statusFilter !== 'all' && p.status !== statusFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return p.title.toLowerCase().includes(q) ||
        p.control?.code?.toLowerCase().includes(q) ||
        p.control?.title?.toLowerCase().includes(q);
    }
    return true;
  });

  const drafts = policies.filter((p) => p.status === 'draft').length;
  const approved = policies.filter((p) => p.status === 'approved').length;
  const aiGenerated = policies.filter((p) => p.generatedBy === 'agent').length;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FileText className="w-6 h-6 text-brand-600" />
            Policies
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {approved} approved · {drafts} drafts · {aiGenerated} AI-generated
          </p>
        </div>
        <button
          onClick={() => setShowGenerate(true)}
          className="px-4 py-2 text-sm font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-700 flex items-center gap-2 shadow-sm"
        >
          <Sparkles className="w-4 h-4" />
          Generate Policy
        </button>
      </div>

      {/* Coverage Summary */}
      <CoverageSummary onGenerateClick={() => setShowGenerate(true)} />

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search policies..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
        <div className="flex items-center gap-1.5">
          {['all', 'draft', 'approved', 'archived'].map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={cn(
                'px-3 py-1.5 text-xs font-medium rounded-full border transition-colors capitalize',
                statusFilter === status
                  ? 'bg-brand-50 border-brand-300 text-brand-700'
                  : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50',
              )}
            >
              {status}
              {status !== 'all' && (
                <span className="ml-1 opacity-70">
                  ({policies.filter((p) => p.status === status).length})
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Policy List */}
      {isLoading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-6 h-6 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 && policies.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-lg font-medium text-gray-700">No policies yet</p>
          <p className="text-sm text-gray-400 mt-1">
            Generate policies with AI or run a full compliance assessment.
          </p>
          <button
            onClick={() => setShowGenerate(true)}
            className="mt-4 px-4 py-2 text-sm font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-700 inline-flex items-center gap-2"
          >
            <Sparkles className="w-4 h-4" />
            Generate Your First Policy
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-8 text-gray-400 text-sm">
          No policies match your filters.
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((p) => (
            <PolicyRow key={p.id} policy={p} onSelect={() => setSelected(p)} />
          ))}
        </div>
      )}

      {/* Panels */}
      {selected && <PolicyDetail policy={selected} onClose={() => setSelected(null)} />}
      {showGenerate && <GeneratePolicyModal onClose={() => setShowGenerate(false)} />}
    </div>
  );
}
