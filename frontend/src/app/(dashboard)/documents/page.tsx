'use client';

import { useState, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  BookOpen, Plus, Search, ChevronLeft, FileText, Clock, User,
  CheckCircle2, AlertTriangle, Lock, Archive, Sparkles, Upload,
  Download, Tag, Calendar, Shield, Loader2, X, MoreVertical,
  AlertCircle, RefreshCw, Clipboard, FileUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  documentsApi, Document, DocType, DocStatus, DocClassification,
} from '@/lib/api/documents';
import { PolicyEditor, markdownToSimpleHtml, htmlToMarkdown } from '@/components/editor/PolicyEditor';
import { useFlag } from '@/lib/hooks/useFeatureFlags';

// ── Type tab config ────────────────────────────────────────────────────────────

const TYPE_TABS: { value: DocType | 'all'; label: string }[] = [
  { value: 'all',          label: 'All' },
  { value: 'policy',       label: 'Policies' },
  { value: 'procedure',    label: 'Procedures' },
  { value: 'template',     label: 'Templates' },
  { value: 'evidence_note', label: 'Evidence Notes' },
  { value: 'report',       label: 'Reports' },
];

const STATUS_CONFIG: Record<DocStatus, { label: string; cls: string }> = {
  draft:    { label: 'Draft',    cls: 'bg-gray-100 text-gray-600' },
  review:   { label: 'In Review', cls: 'bg-amber-100 text-amber-700' },
  approved: { label: 'Approved', cls: 'bg-emerald-100 text-emerald-700' },
  archived: { label: 'Archived', cls: 'bg-slate-100 text-slate-500' },
};

const CLASS_CONFIG: Record<DocClassification, { label: string; cls: string }> = {
  public:       { label: 'PUBLIC',       cls: 'bg-green-100 text-green-700' },
  internal:     { label: 'INTERNAL',     cls: 'bg-blue-100 text-blue-700' },
  confidential: { label: 'CONFIDENTIAL', cls: 'bg-amber-100 text-amber-700' },
  restricted:   { label: 'RESTRICTED',   cls: 'bg-red-100 text-red-700' },
};

// ── Utility ────────────────────────────────────────────────────────────────────

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60)  return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)   return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30)  return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

// ── DOCX import helper ─────────────────────────────────────────────────────────

async function importDocx(file: File): Promise<string> {
  const mammoth = await import('mammoth');
  const buffer  = await file.arrayBuffer();
  const result  = await mammoth.convertToHtml({ arrayBuffer: buffer });
  return result.value;
}

// ── Main page component ────────────────────────────────────────────────────────

export default function DocumentsPage() {
  const qc = useQueryClient();
  const aiEnabled = useFlag('documents.aiFeatures');

  // List state
  const [typeFilter, setTypeFilter] = useState<DocType | 'all'>('all');
  const [search, setSearch]         = useState('');

  // Editor state
  const [editing, setEditing]   = useState<Document | null>(null);
  const [creating, setCreating] = useState(false);
  const [editorHtml, setEditorHtml] = useState('');
  const [editorTitle, setEditorTitle] = useState('');
  const [editorType, setEditorType]   = useState<DocType>('policy');
  const [editorClass, setEditorClass] = useState<DocClassification>('internal');
  const [savingDoc, setSavingDoc]     = useState(false);

  // AI panel state
  const [aiPanel, setAiPanel]   = useState<'improve' | 'gaps' | null>(null);
  const [gapResults, setGapResults] = useState<Array<{ section: string; framework: string; severity: string; detail: string }>>([]);
  const [aiLoading, setAiLoading]   = useState(false);
  const [aiError, setAiError]       = useState<string | null>(null);

  // Version history state
  const [showVersions, setShowVersions] = useState(false);

  const fileInputRef    = useRef<HTMLInputElement>(null);
  const mdFileInputRef  = useRef<HTMLInputElement>(null);
  const pdfFileInputRef = useRef<HTMLInputElement>(null);

  // ── Data fetching ──────────────────────────────────────────────────────────

  const { data: docsData, isLoading } = useQuery({
    queryKey: ['documents', typeFilter, search],
    queryFn: () => documentsApi.list({
      docType: typeFilter === 'all' ? undefined : typeFilter,
      search:  search || undefined,
    }),
    staleTime: 30_000,
  });
  // API returns { total, page, pageSize, items } — extract items array
  const docs: Document[] = Array.isArray(docsData) ? docsData : (docsData as any)?.items ?? [];

  const { data: versions = [] } = useQuery({
    queryKey: ['document-versions', editing?.id],
    queryFn:  () => documentsApi.getVersions(editing!.id),
    enabled:  !!editing?.id && showVersions,
  });

  // ── Mutations ──────────────────────────────────────────────────────────────

  const createMutation = useMutation({
    mutationFn: (dto: Parameters<typeof documentsApi.create>[0]) =>
      documentsApi.create(dto),
    onSuccess: (doc) => {
      qc.invalidateQueries({ queryKey: ['documents'] });
      setEditing(doc);
      setCreating(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: Parameters<typeof documentsApi.update>[1] }) =>
      documentsApi.update(id, dto),
    onSuccess: (doc) => {
      qc.invalidateQueries({ queryKey: ['documents'] });
      setEditing(doc);
    },
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => documentsApi.approve(id),
    onSuccess: (doc) => {
      qc.invalidateQueries({ queryKey: ['documents'] });
      setEditing(doc);
    },
  });

  const requestApprovalMutation = useMutation({
    mutationFn: (id: string) => documentsApi.requestApproval(id),
    onSuccess: (doc) => {
      qc.invalidateQueries({ queryKey: ['documents'] });
      setEditing(doc);
    },
  });

  const newVersionMutation = useMutation({
    mutationFn: (id: string) => documentsApi.newVersion(id),
    onSuccess: (doc) => {
      qc.invalidateQueries({ queryKey: ['documents'] });
      setEditing(doc);
    },
  });

  const archiveMutation = useMutation({
    mutationFn: (id: string) => documentsApi.archive(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['documents'] });
      closeEditor();
    },
  });

  // ── Editor helpers ─────────────────────────────────────────────────────────

  const openEditor = useCallback((doc: Document) => {
    setEditing(doc);
    setEditorHtml(doc.contentHtml);
    setEditorTitle(doc.title);
    setEditorType(doc.docType);
    setEditorClass(doc.classification);
    setAiPanel(null);
    setGapResults([]);
    setShowVersions(false);
  }, []);

  const openNew = useCallback(() => {
    setCreating(true);
    setEditing(null);
    setEditorHtml('');
    setEditorTitle('Untitled Document');
    setEditorType('policy');
    setEditorClass('internal');
    setAiPanel(null);
    setShowVersions(false);
  }, []);

  const closeEditor = useCallback(() => {
    setEditing(null);
    setCreating(false);
    setEditorHtml('');
  }, []);

  const saveDocument = useCallback(async () => {
    setSavingDoc(true);
    try {
      if (creating) {
        await createMutation.mutateAsync({
          title:       editorTitle,
          docType:     editorType,
          contentHtml: editorHtml,
          classification: editorClass,
        });
      } else if (editing) {
        await updateMutation.mutateAsync({
          id:  editing.id,
          dto: { title: editorTitle, contentHtml: editorHtml, classification: editorClass },
        });
      }
    } finally {
      setSavingDoc(false);
    }
  }, [creating, editing, editorTitle, editorType, editorHtml, editorClass, createMutation, updateMutation]);

  // ── Import handlers ────────────────────────────────────────────────────────

  const handleDocxImport = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const html = await importDocx(file);
      setEditorHtml(html);
      if (!editorTitle || editorTitle === 'Untitled Document') {
        setEditorTitle(file.name.replace(/\.[^.]+$/, ''));
      }
    } catch (err) {
      console.error('DOCX import failed:', err);
    }
    e.target.value = '';
  }, [editorTitle]);

  const handleMdImport = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const html = markdownToSimpleHtml(text);
    setEditorHtml(html);
    if (!editorTitle || editorTitle === 'Untitled Document') {
      setEditorTitle(file.name.replace(/\.[^.]+$/, ''));
    }
    e.target.value = '';
  }, [editorTitle]);

  const handlePdfImport = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const { content, title: pdfTitle } = await documentsApi.importPdf(file);
      const html = markdownToSimpleHtml(content);
      setEditorHtml(html);
      if (pdfTitle) setEditorTitle(pdfTitle);
    } catch (err) {
      console.error('PDF import failed:', err);
    }
    e.target.value = '';
  }, []);

  // ── Export helpers ─────────────────────────────────────────────────────────

  const exportMarkdown = useCallback(() => {
    const md   = htmlToMarkdown(editorHtml);
    const blob = new Blob([md], { type: 'text/markdown' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `${editorTitle || 'document'}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 100);
  }, [editorHtml, editorTitle]);

  const copyToClipboard = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(htmlToMarkdown(editorHtml));
    } catch { /* ignore */ }
  }, [editorHtml]);

  // ── AI helpers ─────────────────────────────────────────────────────────────

  const runGapAnalysis = useCallback(async () => {
    if (!editing) return;
    setAiLoading(true);
    setAiError(null);
    try {
      const { gaps } = await documentsApi.aiGaps(editing.id);
      setGapResults(gaps);
      setAiPanel('gaps');
    } catch (err: any) {
      setAiError(err?.response?.data?.message ?? 'Gap analysis failed');
    } finally {
      setAiLoading(false);
    }
  }, [editing]);

  // ── Derived state ──────────────────────────────────────────────────────────

  const isEditorOpen  = creating || !!editing;
  const isLocked      = !!editing?.lockedAt;
  const hasLegalHold  = !!editing?.legalHoldAt;
  const canEdit       = !isLocked && !hasLegalHold && editing?.status !== 'archived';
  const canApprove    = editing?.status === 'review';
  const canRequestApproval = editing?.status === 'draft';

  // ── Render: editor overlay ────────────────────────────────────────────────

  if (isEditorOpen) {
    const statusInfo = editing ? STATUS_CONFIG[editing.status] : STATUS_CONFIG.draft;
    const classInfo  = CLASS_CONFIG[editorClass];

    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-white">
        {/* Hidden file inputs */}
        <input ref={fileInputRef}    type="file" accept=".docx" className="hidden" onChange={handleDocxImport} />
        <input ref={mdFileInputRef}  type="file" accept=".md,.markdown" className="hidden" onChange={handleMdImport} />
        <input ref={pdfFileInputRef} type="file" accept=".pdf" className="hidden" onChange={handlePdfImport} />

        {/* Editor header */}
        <div className="flex items-center gap-3 border-b border-gray-200 bg-white px-4 py-2">
          <button
            onClick={closeEditor}
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </button>

          <span className="text-gray-300">|</span>

          {/* Editable title */}
          <input
            value={editorTitle}
            onChange={(e) => setEditorTitle(e.target.value)}
            className="flex-1 text-base font-semibold text-gray-900 bg-transparent border-none outline-none focus:ring-0 min-w-0"
            placeholder="Document title"
            disabled={!canEdit && !creating}
          />

          {/* Version badge */}
          {editing && (
            <span className="text-xs text-gray-500 whitespace-nowrap">v{editing.version}</span>
          )}

          {/* Status badge */}
          {editing && (
            <span className={cn('px-2 py-0.5 rounded text-xs font-medium', statusInfo.cls)}>
              {statusInfo.label}
            </span>
          )}

          {/* Lock indicator */}
          {isLocked && (
            <span className="flex items-center gap-1 text-xs text-amber-600">
              <Lock className="h-3.5 w-3.5" />
              Locked
            </span>
          )}

          {/* Classification badge */}
          <select
            value={editorClass}
            onChange={(e) => setEditorClass(e.target.value as DocClassification)}
            className={cn(
              'text-xs font-semibold px-2 py-1 rounded border-0 cursor-pointer',
              classInfo.cls,
            )}
            disabled={!canEdit && !creating}
          >
            {(Object.keys(CLASS_CONFIG) as DocClassification[]).map((k) => (
              <option key={k} value={k}>{CLASS_CONFIG[k].label}</option>
            ))}
          </select>

          {/* Save button */}
          {(creating || canEdit) && (
            <button
              onClick={saveDocument}
              disabled={savingDoc}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 disabled:opacity-50 transition-colors"
            >
              {savingDoc ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Save
            </button>
          )}

          {/* Actions menu */}
          {editing && (
            <div className="flex items-center gap-1">
              {canRequestApproval && (
                <button
                  onClick={() => requestApprovalMutation.mutate(editing.id)}
                  disabled={requestApprovalMutation.isPending}
                  className="px-2 py-1.5 text-xs text-amber-700 bg-amber-50 rounded-lg hover:bg-amber-100 transition-colors"
                >
                  Request Approval
                </button>
              )}
              {canApprove && (
                <button
                  onClick={() => approveMutation.mutate(editing.id)}
                  disabled={approveMutation.isPending}
                  className="px-2 py-1.5 text-xs text-emerald-700 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition-colors"
                >
                  Approve
                </button>
              )}
              {editing.status !== 'archived' && (
                <button
                  onClick={() => newVersionMutation.mutate(editing.id)}
                  disabled={newVersionMutation.isPending}
                  className="px-2 py-1.5 text-xs text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                >
                  New Version
                </button>
              )}
            </div>
          )}
        </div>

        {/* Editor body */}
        <div className="flex flex-1 min-h-0">
          {/* Main editor area */}
          <div className="flex-1 overflow-auto">
            <PolicyEditor
              content={editorHtml}
              onChange={setEditorHtml}
              readOnly={(!canEdit && !creating)}
              placeholder="Start writing your compliance document…"
              className="min-h-full"
              minHeight={600}
              showWordCount={true}
            />
          </div>

          {/* Right sidebar */}
          <div className="w-72 border-l border-gray-200 overflow-y-auto bg-gray-50 flex-shrink-0">
            <div className="p-4 space-y-6">

              {/* Compliance metadata */}
              {editing && (
                <div>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                    Compliance Metadata
                  </h3>
                  <div className="space-y-2 text-xs text-gray-600">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Version</span>
                      <span className="font-medium">v{editing.version}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Word count</span>
                      <span className="font-medium">{editing.wordCount.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Status</span>
                      <span className={cn('px-1.5 py-0.5 rounded text-xs', STATUS_CONFIG[editing.status].cls)}>
                        {STATUS_CONFIG[editing.status].label}
                      </span>
                    </div>
                    {editing.reviewDue && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Review due</span>
                        <span className="font-medium">{new Date(editing.reviewDue).toLocaleDateString()}</span>
                      </div>
                    )}
                    {editing.controlIds.length > 0 && (
                      <div>
                        <span className="text-gray-500">Controls</span>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {editing.controlIds.map((c) => (
                            <span key={c} className="px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded text-xs">{c}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    {editing.legalHoldAt && (
                      <div className="flex items-start gap-1.5 p-2 bg-red-50 rounded-lg border border-red-200">
                        <AlertTriangle className="h-3.5 w-3.5 text-red-600 flex-shrink-0 mt-0.5" />
                        <span className="text-red-700 text-xs">
                          <strong>Legal Hold</strong>: {editing.legalHoldReason}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* AI Assist */}
              {aiEnabled && editing && (
                <div>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                    AI Assist
                  </h3>
                  <div className="space-y-2">
                    <button
                      onClick={runGapAnalysis}
                      disabled={aiLoading}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
                    >
                      {aiLoading ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-brand-600" />
                      ) : (
                        <Search className="h-3.5 w-3.5 text-brand-600" />
                      )}
                      Detect missing sections
                    </button>
                    {aiError && (
                      <p className="text-xs text-red-600">{aiError}</p>
                    )}
                    {gapResults.length > 0 && (
                      <div className="space-y-1.5">
                        {gapResults.map((g, i) => (
                          <div key={i} className="p-2 bg-white border border-gray-200 rounded-lg text-xs">
                            <div className="flex items-center gap-1.5 mb-1">
                              <span className={cn(
                                'px-1.5 py-0.5 rounded text-xs font-medium',
                                g.severity === 'critical' ? 'bg-red-100 text-red-700' :
                                g.severity === 'major'    ? 'bg-orange-100 text-orange-700' :
                                                            'bg-amber-100 text-amber-700',
                              )}>
                                {g.severity}
                              </span>
                              <span className="font-medium text-gray-800">{g.section}</span>
                            </div>
                            <p className="text-gray-500 text-xs">{g.detail}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Import */}
              <div>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                  Import
                </h3>
                <div className="space-y-1.5">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <FileUp className="h-3.5 w-3.5 text-gray-500" />
                    Import Word (.docx)
                  </button>
                  <button
                    onClick={() => mdFileInputRef.current?.click()}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <FileText className="h-3.5 w-3.5 text-gray-500" />
                    Import Markdown (.md)
                  </button>
                  <button
                    onClick={() => pdfFileInputRef.current?.click()}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <Sparkles className="h-3.5 w-3.5 text-brand-600" />
                    Import PDF (AI)
                  </button>
                </div>
              </div>

              {/* Export */}
              <div>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                  Export
                </h3>
                <div className="space-y-1.5">
                  <button
                    onClick={exportMarkdown}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <Download className="h-3.5 w-3.5 text-gray-500" />
                    Download .md
                  </button>
                  <button
                    onClick={copyToClipboard}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <Clipboard className="h-3.5 w-3.5 text-gray-500" />
                    Copy as Markdown
                  </button>
                </div>
              </div>

              {/* Version history */}
              {editing && (
                <div>
                  <button
                    onClick={() => setShowVersions((v) => !v)}
                    className="w-full flex items-center justify-between text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1"
                  >
                    Version History
                    <RefreshCw className="h-3.5 w-3.5" />
                  </button>
                  {showVersions && (
                    <div className="space-y-1 mt-2">
                      {versions.map((v) => (
                        <div key={v.id} className="flex items-center justify-between p-2 bg-white border border-gray-200 rounded text-xs">
                          <div>
                            <span className="font-medium">v{v.version}</span>
                            {v.note && <span className="text-gray-500 ml-1">{v.note}</span>}
                            <div className="text-gray-400 text-xs">{timeAgo(v.createdAt)}</div>
                          </div>
                          <button
                            onClick={() => {
                              if (confirm(`Restore to v${v.version}?`)) {
                                documentsApi.restoreVersion(editing.id, v.version).then((doc) => {
                                  openEditor(doc);
                                  qc.invalidateQueries({ queryKey: ['documents'] });
                                });
                              }
                            }}
                            className="text-blue-600 hover:text-blue-800 text-xs"
                          >
                            Restore
                          </button>
                        </div>
                      ))}
                      {versions.length === 0 && (
                        <p className="text-xs text-gray-400">No prior versions</p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Render: list view ─────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full">
      {/* Page header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-white">
        <div className="flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-brand-600" />
          <h1 className="text-lg font-semibold text-gray-900">Documents</h1>
          <span className="text-sm text-gray-500">{docs.length} total</span>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-2 px-3 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          New Document
        </button>
      </div>

      {/* Type filter tabs */}
      <div className="flex items-center gap-1 px-6 py-2 border-b border-gray-200 bg-white overflow-x-auto">
        {TYPE_TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => setTypeFilter(t.value)}
            className={cn(
              'px-3 py-1.5 text-sm rounded-lg whitespace-nowrap transition-colors',
              typeFilter === t.value
                ? 'bg-brand-50 text-brand-700 font-medium'
                : 'text-gray-600 hover:bg-gray-100',
            )}
          >
            {t.label}
          </button>
        ))}

        {/* Search */}
        <div className="ml-auto flex items-center gap-2 bg-gray-100 rounded-lg px-3 py-1.5">
          <Search className="h-3.5 w-3.5 text-gray-500 flex-shrink-0" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search documents…"
            className="bg-transparent text-sm text-gray-800 outline-none placeholder-gray-400 w-44"
          />
          {search && (
            <button onClick={() => setSearch('')}>
              <X className="h-3.5 w-3.5 text-gray-500" />
            </button>
          )}
        </div>
      </div>

      {/* Document list */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : docs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <BookOpen className="h-10 w-10 text-gray-300 mb-3" />
            <p className="text-gray-500 font-medium">No documents yet</p>
            <p className="text-sm text-gray-400 mt-1">
              Create your first compliance document or import from DOCX / PDF.
            </p>
            <button
              onClick={openNew}
              className="mt-4 px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 transition-colors"
            >
              + New Document
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {docs.map((doc) => (
              <DocumentCard key={doc.id} doc={doc} onClick={() => openEditor(doc)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Document card ──────────────────────────────────────────────────────────────

function DocumentCard({ doc, onClick }: { doc: Document; onClick: () => void }) {
  const statusInfo = STATUS_CONFIG[doc.status];
  const classInfo  = CLASS_CONFIG[doc.classification];

  return (
    <button
      onClick={onClick}
      className="w-full text-left p-4 bg-white border border-gray-200 rounded-xl hover:border-brand-300 hover:shadow-sm transition-all group"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <div className="mt-0.5 p-1.5 bg-gray-100 rounded-lg group-hover:bg-brand-50 transition-colors flex-shrink-0">
            <FileText className="h-4 w-4 text-gray-500 group-hover:text-brand-600" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-gray-900 truncate">{doc.title}</span>
              <span className="text-xs text-gray-400">v{doc.version}</span>
            </div>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className={cn('px-1.5 py-0.5 rounded text-xs font-medium', statusInfo.cls)}>
                {statusInfo.label}
              </span>
              <span className={cn('px-1.5 py-0.5 rounded text-xs font-medium', classInfo.cls)}>
                {classInfo.label}
              </span>
              {doc.controlIds.length > 0 && (
                <span className="text-xs text-gray-400">
                  {doc.controlIds.length} control{doc.controlIds.length !== 1 ? 's' : ''}
                </span>
              )}
              {doc.lockedAt && (
                <span className="flex items-center gap-0.5 text-xs text-amber-600">
                  <Lock className="h-3 w-3" /> Locked
                </span>
              )}
              {doc.legalHoldAt && (
                <span className="flex items-center gap-0.5 text-xs text-red-600">
                  <Shield className="h-3 w-3" /> Legal Hold
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex-shrink-0 text-right">
          <div className="text-xs text-gray-400">{timeAgo(doc.updatedAt)}</div>
          {doc.wordCount > 0 && (
            <div className="text-xs text-gray-400 mt-0.5">{doc.wordCount.toLocaleString()} words</div>
          )}
        </div>
      </div>
    </button>
  );
}
