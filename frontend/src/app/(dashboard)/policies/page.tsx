'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { policiesApi, Policy, CoverageResult, PolicyGap } from '@/lib/api/policies';
import { auditApi } from '@/lib/api/audit';
import {
  FileText, Check, Archive, X, ChevronRight, Plus, Download,
  Clock, CheckCircle2, ArchiveIcon, AlertCircle, Search,
  RotateCcw, Shield, Edit3, Save, GitBranch, Sparkles, BookOpen,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { cn } from '@/lib/utils';
import { PolicyEditor, markdownToSimpleHtml } from '@/components/editor/PolicyEditor';

// ─── Types ────────────────────────────────────────────────────────────────────

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

          {policy.approvedAt && (
            <p className="text-xs text-emerald-600 mt-2">
              {typeof policy.approvedBy === 'object' && policy.approvedBy?.fullName
                ? `Approved by ${policy.approvedBy.fullName} on `
                : 'Approved on '}
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
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState('');

  const { data: fullPolicy } = useQuery({
    queryKey: ['policy', policy.id],
    queryFn: () => policiesApi.get(policy.id),
  });

  const displayPolicy = (fullPolicy ?? policy) as Policy;

  const approve = useMutation({
    mutationFn: () => policiesApi.approve(policy.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['policies'] });
      qc.invalidateQueries({ queryKey: ['policy', policy.id] });
    },
  });

  const archive = useMutation({
    mutationFn: () => policiesApi.archive(policy.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['policies'] });
      onClose();
    },
  });

  const saveEdit = useMutation({
    mutationFn: () => policiesApi.update(policy.id, { content: editContent }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['policies'] });
      qc.invalidateQueries({ queryKey: ['policy', policy.id] });
      setEditing(false);
    },
  });

  const createNewVersion = useMutation({
    mutationFn: () => policiesApi.newVersion(policy.id, { content: editContent }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['policies'] });
      setEditing(false);
    },
  });

  const aiDraft = useMutation({
    mutationFn: () => policiesApi.aiDraft(policy.id),
    onSuccess: (data) => {
      // Convert markdown to simple html for the editor
      setEditContent(markdownToSimpleHtml(data.content));
      setEditing(true);
    },
  });

  function startEditing() {
    const rawContent = displayPolicy.content ?? '';
    setEditContent(markdownToSimpleHtml(rawContent));
    setEditing(true);
  }

  async function downloadPdf() {
    // Dynamic import to avoid SSR issues
    const { pdf } = await import('@react-pdf/renderer');
    const React = await import('react');
    const { Soc2ReadinessPdf } = await import('@/components/pdf/ComplianceReportPdf');

    // For policies, create a simple text PDF
    const { Document, Page, Text, View, StyleSheet } = await import('@react-pdf/renderer');
    const styles = StyleSheet.create({
      page: { fontFamily: 'Helvetica', fontSize: 10, padding: 40 },
      title: { fontSize: 18, fontFamily: 'Helvetica-Bold', color: '#1e293b', marginBottom: 8 },
      meta: { fontSize: 9, color: '#64748b', marginBottom: 20 },
      content: { fontSize: 10, lineHeight: 1.6, color: '#374151' },
      disclaimer: { fontSize: 8, color: '#9ca3af', marginTop: 20, borderTopWidth: 1, borderTopColor: '#e2e8f0', paddingTop: 8 },
    });

    const doc = React.createElement(Document, { title: displayPolicy.title },
      React.createElement(Page, { size: 'A4', style: styles.page },
        React.createElement(Text, { style: styles.title }, displayPolicy.title),
        React.createElement(Text, { style: styles.meta },
          `Version ${displayPolicy.version} · ${displayPolicy.status} · Generated ${new Date().toLocaleDateString()}`
        ),
        React.createElement(Text, { style: styles.content },
          (displayPolicy.content ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
        ),
        React.createElement(Text, { style: styles.disclaimer },
          'Generated by AI Compliance Copilot · Internal use only · Not an official audit document'
        ),
      )
    );

    const blob = await pdf(doc).toBlob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${displayPolicy.title.toLowerCase().replace(/\s+/g, '-')}-v${displayPolicy.version}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={() => { if (!editing) onClose(); }} />

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
              {editing && (
                <span className="text-xs bg-amber-50 border border-amber-200 text-amber-700 px-2 py-0.5 rounded-full">Editing</span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {!editing ? (
              <>
                {displayPolicy.status !== 'archived' && (
                  <button
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-purple-200
                               bg-purple-50 text-purple-700 hover:bg-purple-100 transition-colors disabled:opacity-60"
                    onClick={() => aiDraft.mutate()}
                    disabled={aiDraft.isPending}
                    title="AI generates or improves this policy based on the control and your org context"
                  >
                    {aiDraft.isPending ? (
                      <div className="w-3.5 h-3.5 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Sparkles className="w-3.5 h-3.5" />
                    )}
                    {aiDraft.isPending ? 'Drafting…' : 'AI Draft'}
                  </button>
                )}
                {displayPolicy.status !== 'archived' && (
                  <button
                    className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5"
                    onClick={startEditing}
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    Edit
                  </button>
                )}
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
              </>
            ) : (
              <>
                <button
                  className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5"
                  onClick={() => createNewVersion.mutate()}
                  disabled={createNewVersion.isPending || saveEdit.isPending}
                  title="Creates a new version and keeps the old one"
                >
                  <GitBranch className="w-3.5 h-3.5" />
                  {createNewVersion.isPending ? 'Saving…' : 'New Version'}
                </button>
                <button
                  className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1.5"
                  onClick={() => saveEdit.mutate()}
                  disabled={saveEdit.isPending || createNewVersion.isPending}
                >
                  <Save className="w-3.5 h-3.5" />
                  {saveEdit.isPending ? 'Saving…' : 'Save'}
                </button>
                <button
                  onClick={() => setEditing(false)}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                  title="Discard changes"
                >
                  <X className="w-4 h-4" />
                </button>
              </>
            )}
            {!editing && (
              <button
                onClick={onClose}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400
                           hover:text-gray-600 hover:bg-gray-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {editing ? (
            <div className="p-4">
              <PolicyEditor
                content={editContent}
                onChange={setEditContent}
                placeholder="Write your policy content here…"
                minHeight={500}
              />
              <div className="mt-3 text-xs text-gray-400 flex items-center gap-1.5">
                <span className="inline-block w-2 h-2 bg-amber-400 rounded-full" />
                <span><strong>Save</strong> updates this version in place. <strong>New Version</strong> bumps the version number and creates a draft.</span>
              </div>
            </div>
          ) : (
            <div className="px-6 py-6">
              <div className="prose prose-sm max-w-none text-gray-800 prose-headings:text-gray-900
                              prose-headings:font-semibold prose-a:text-brand-600 prose-code:text-brand-700
                              prose-code:bg-brand-50 prose-code:rounded prose-code:px-1">
                <ReactMarkdown>{displayPolicy.content ?? '*No content available.*'}</ReactMarkdown>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between shrink-0">
          <button
            className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1.5 transition-colors"
            onClick={downloadPdf}
          >
            <Download className="w-3.5 h-3.5" />
            Download PDF
          </button>
          {displayPolicy.approvedAt && (displayPolicy.approvedBy as any)?.fullName && (
            <p className="text-xs text-gray-400">
              Approved by <span className="text-gray-600 font-medium">{(displayPolicy.approvedBy as any).fullName}</span>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Policy Coverage Panel ───────────────────────────────────────────────────

// PolicyGap and CoverageResult are imported from @/lib/api/policies

const GAP_PRIORITY_CFG: Record<string, { badge: string; dot: string }> = {
  critical: { badge: 'bg-red-100 text-red-700',    dot: 'bg-red-500' },
  high:     { badge: 'bg-orange-100 text-orange-700', dot: 'bg-orange-400' },
  medium:   { badge: 'bg-yellow-100 text-yellow-700', dot: 'bg-yellow-400' },
};

function CoveragePanel({ result, onClose }: { result: CoverageResult; onClose: () => void }) {
  const missingCount = result.gaps.filter((g) => !g.covered).length;
  const updateCount  = result.gaps.filter((g) => g.covered).length;
  const scoreColor   = result.coverageScore >= 80 ? 'text-emerald-600' : result.coverageScore >= 50 ? 'text-amber-600' : 'text-red-600';

  return (
    <div className="mb-6 bg-gray-50 border border-gray-200 rounded-2xl p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0">
            <BookOpen className="w-4 h-4 text-indigo-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">AI Policy Coverage Check</p>
            <p className="text-xs text-gray-500">
              {result.frameworks} · <span className={cn('font-semibold', scoreColor)}>{result.coverageScore}% coverage</span>
              {' · '}{missingCount} missing{updateCount > 0 ? ` · ${updateCount} need updating` : ''}
            </p>
          </div>
        </div>
        <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-200">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Score bar */}
      <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs text-gray-500">Policy coverage</span>
          <span className={cn('text-sm font-bold', scoreColor)}>{result.coverageScore}%</span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all', result.coverageScore >= 80 ? 'bg-emerald-500' : result.coverageScore >= 50 ? 'bg-amber-500' : 'bg-red-500')}
            style={{ width: `${result.coverageScore}%` }}
          />
        </div>
      </div>

      {result.gaps.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Policy Gaps</p>
          <div className="space-y-2">
            {result.gaps.map((gap, i) => {
              const cfg = GAP_PRIORITY_CFG[gap.priority] ?? GAP_PRIORITY_CFG.medium;
              return (
                <div key={i} className="bg-white rounded-xl border border-gray-200 p-3">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', cfg.dot)} />
                    <p className="text-sm font-medium text-gray-900">{gap.policyType}</p>
                    <span className={cn('text-xs px-1.5 py-0.5 rounded-full font-medium ml-auto', cfg.badge)}>
                      {gap.priority}
                    </span>
                    {gap.covered ? (
                      <span className="text-xs bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded-full">needs update</span>
                    ) : (
                      <span className="text-xs bg-red-50 text-red-700 px-1.5 py-0.5 rounded-full">missing</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 ml-3.5">{gap.requirement}</p>
                  <p className="text-xs text-gray-400 ml-3.5 mt-0.5">Framework: {gap.framework}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {result.recommendations.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Recommendations</p>
          <ol className="space-y-1">
            {result.recommendations.map((r, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-gray-700">
                <span className="w-4 h-4 rounded-full bg-indigo-100 text-indigo-700 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                {r}
              </li>
            ))}
          </ol>
        </div>
      )}
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
  const [coverageResult, setCoverageResult] = useState<CoverageResult | null>(null);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['policies'],
    queryFn: () => policiesApi.list(),
  });

  const generate = useMutation({
    mutationFn: () => auditApi.triggerAssessment('SOC2'),
    onSuccess: () => {
      setTimeout(() => qc.invalidateQueries({ queryKey: ['policies'] }), 5000);
    },
  });

  const coverageCheck = useMutation({
    mutationFn: () => policiesApi.aiCoverageCheck(),
    onSuccess: (result) => setCoverageResult(result),
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

        <div className="flex items-center gap-2">
          <button
            onClick={() => coverageCheck.mutate()}
            disabled={coverageCheck.isPending}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border
                       bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100 transition-colors"
          >
            {coverageCheck.isPending
              ? <><RotateCcw className="w-4 h-4 animate-spin" /> Checking…</>
              : <><Sparkles className="w-4 h-4" /> Coverage Check</>}
          </button>
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
      </div>

      {/* Coverage check panel */}
      {coverageResult && (
        <CoveragePanel result={coverageResult} onClose={() => setCoverageResult(null)} />
      )}

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
