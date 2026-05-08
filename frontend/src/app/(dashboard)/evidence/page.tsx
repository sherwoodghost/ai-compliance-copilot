'use client';

import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { complianceApi } from '@/lib/api/compliance';
import { apiClient } from '@/lib/api/client';
import { formatDate, formatRelative } from '@/lib/utils';
import {
  FileCheck, AlertTriangle, Clock, Upload, Search, Trash2,
  Plus, X, ChevronDown, Filter, FolderOpen, Link as LinkIcon,
  CheckCircle, RefreshCw, Sparkles, Wand2, GitMerge, ArrowRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

type Evidence = {
  id: string;
  title: string;
  description?: string;
  type?: string;
  evidenceType?: string;
  source?: string;
  status?: string;
  isValid?: boolean;
  collectedAt?: string;
  createdAt: string;
  expiresAt?: string;
  fileUrl?: string;
  storageUrl?: string;
  controlId?: string;
  control?: { id: string; code: string; title: string };
  metadata?: {
    aiConfidence?: number;
    aiSummary?: string;
    aiFlags?: string[];
    isPendingSuggestion?: boolean;
    instructions?: string;
    fileName?: string;
    fileSize?: number;
  };
};

type StatusFilter = 'all' | 'valid' | 'expiring' | 'expired' | 'pending' | 'ai_issues';

// ─── Bulk Map Types ───────────────────────────────────────────────────────────

type BulkMapControl = { controlId: string; code: string; title: string };
type BulkMapSuggestion = {
  evidenceId: string;
  evidenceTitle: string;
  evidenceType?: string;
  storageUrl?: string;
  currentControlCode: string | null;
  additionalControls: BulkMapControl[];
};
type BulkMapResult = { processed: number; suggestions: BulkMapSuggestion[] };

// ─── Bulk Map Panel ───────────────────────────────────────────────────────────

function BulkMapPanel({
  result,
  onClose,
  onApply,
}: {
  result: BulkMapResult;
  onClose: () => void;
  onApply: (evidenceId: string, evidenceTitle: string, evidenceType: string | undefined, storageUrl: string | undefined, control: BulkMapControl) => void;
}) {
  const [applied, setApplied] = useState<Set<string>>(new Set());

  function handleApply(s: BulkMapSuggestion, ctrl: BulkMapControl) {
    const key = `${s.evidenceId}:${ctrl.controlId}`;
    onApply(s.evidenceId, s.evidenceTitle, s.evidenceType, s.storageUrl, ctrl);
    setApplied((prev) => new Set([...prev, key]));
  }

  const hasSuggestions = result.suggestions.length > 0;

  return (
    <div className="mb-6 bg-purple-50 border border-purple-200 rounded-2xl p-5">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center shrink-0">
            <GitMerge className="w-4 h-4 text-purple-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">AI Cross-Mapping Analysis</p>
            <p className="text-xs text-purple-700">
              Scanned {result.processed} evidence items ·{' '}
              {hasSuggestions
                ? `${result.suggestions.length} item${result.suggestions.length !== 1 ? 's' : ''} can satisfy additional controls`
                : 'No additional cross-mappings found'}
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-purple-100 shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {!hasSuggestions ? (
        <div className="text-center py-4">
          <CheckCircle className="w-8 h-8 text-purple-400 mx-auto mb-2" />
          <p className="text-sm text-purple-700 font-medium">Great coverage!</p>
          <p className="text-xs text-purple-600 mt-0.5">Your evidence is already well-mapped to controls.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {result.suggestions.map((s) => (
            <div key={s.evidenceId} className="bg-white rounded-xl border border-purple-100 p-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-medium text-gray-900 truncate flex-1">{s.evidenceTitle}</span>
                {s.currentControlCode && (
                  <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-mono shrink-0">
                    {s.currentControlCode}
                  </span>
                )}
              </div>
              <div className="space-y-1.5">
                {s.additionalControls.map((ctrl) => {
                  const key = `${s.evidenceId}:${ctrl.controlId}`;
                  const isApplied = applied.has(key);
                  return (
                    <div key={ctrl.controlId} className="flex items-center gap-2">
                      <ArrowRight className="w-3 h-3 text-purple-400 shrink-0" />
                      <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-mono shrink-0">
                        {ctrl.code}
                      </span>
                      <span className="text-xs text-gray-600 flex-1 truncate">{ctrl.title}</span>
                      <button
                        onClick={() => handleApply(s, ctrl)}
                        disabled={isApplied}
                        className={cn(
                          'text-xs px-2 py-0.5 rounded-md font-medium shrink-0 transition-colors',
                          isApplied
                            ? 'bg-emerald-100 text-emerald-700 cursor-default'
                            : 'bg-purple-600 text-white hover:bg-purple-700',
                        )}
                      >
                        {isApplied ? '✓ Linked' : 'Link'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          <p className="text-xs text-purple-600 mt-1">
            Linking creates a new evidence reference for the target control using the same evidence item.
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Evidence type config ─────────────────────────────────────────────────────

const TYPE_COLORS: Record<string, string> = {
  screenshot:    'bg-blue-50 text-blue-700',
  log:           'bg-purple-50 text-purple-700',
  report:        'bg-green-50 text-green-700',
  configuration: 'bg-orange-50 text-orange-700',
  policy:        'bg-indigo-50 text-indigo-700',
  certificate:   'bg-teal-50 text-teal-700',
};

// ─── Evidence Card ─────────────────────────────────────────────────────────────

interface MappingSuggestion { controlId: string; code: string; title: string }

function EvidenceCard({
  item,
  onDelete,
  onRevalidate,
  onUploadForControl,
}: {
  item: Evidence;
  onDelete: () => void;
  onRevalidate: () => void;
  onUploadForControl?: (controlId: string) => void;
}) {
  const [showMappings, setShowMappings] = useState(false);
  const [suggestions, setSuggestions] = useState<MappingSuggestion[] | null>(null);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [revalidating, setRevalidating] = useState(false);

  async function triggerRevalidate() {
    setRevalidating(true);
    try {
      await apiClient.post(`/evidence/${item.id}/revalidate`);
      // Poll for updated result after 4 seconds
      setTimeout(() => { onRevalidate(); setRevalidating(false); }, 4000);
    } catch {
      setRevalidating(false);
    }
  }

  const isPending = item.metadata?.isPendingSuggestion === true;

  async function fetchSuggestions() {
    if (suggestions !== null) { setShowMappings(!showMappings); return; }
    setLoadingSuggestions(true);
    setShowMappings(true);
    try {
      const res = await apiClient.get<{ suggestions: MappingSuggestion[] }>(
        `/evidence/${item.id}/suggest-mappings`,
      );
      setSuggestions((res as any).data?.suggestions ?? []);
    } catch {
      setSuggestions([]);
    } finally {
      setLoadingSuggestions(false);
    }
  }

  const isExpired = item.expiresAt && new Date(item.expiresAt) < new Date();
  const expiringSoon = item.expiresAt && !isExpired &&
    new Date(item.expiresAt) < new Date(Date.now() + 30 * 86400_000);

  const evidenceTypeLabel = item.type ?? item.evidenceType ?? '';
  const typeCls = TYPE_COLORS[evidenceTypeLabel.toLowerCase()] ?? 'bg-gray-100 text-gray-600';

  // ── Pending suggestion card ────────────────────────────────────────────────
  if (isPending) {
    return (
      <div className="group bg-amber-50 border border-amber-200 rounded-xl p-4 hover:shadow-sm transition-all">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center shrink-0 mt-0.5">
            <Upload className="w-4 h-4 text-amber-600" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-1">
              <p className="text-sm font-semibold text-gray-900 leading-tight">{item.title}</p>
              <button
                onClick={onDelete}
                className="opacity-0 group-hover:opacity-100 w-6 h-6 rounded flex items-center justify-center
                           text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all shrink-0"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>

            {item.control && (
              <span className="inline-flex items-center text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-mono mb-2">
                {item.control.code}
              </span>
            )}

            {item.metadata?.instructions && (
              <p className="text-xs text-amber-800 mb-2 leading-relaxed">{item.metadata.instructions}</p>
            )}

            <div className="flex items-center gap-2 mt-2">
              <span className="text-xs text-amber-600 font-medium flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                Needs evidence upload
              </span>
              {item.controlId && onUploadForControl && (
                <button
                  onClick={() => onUploadForControl(item.controlId!)}
                  className="text-xs bg-amber-600 text-white px-2 py-0.5 rounded-md hover:bg-amber-700 transition-colors flex items-center gap-1"
                >
                  <Upload className="w-3 h-3" />
                  Upload now
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Normal evidence card ───────────────────────────────────────────────────
  const statusIcon = isExpired ? AlertTriangle : expiringSoon ? Clock : CheckCircle;
  const StatusIcon = statusIcon;
  const statusCls = isExpired
    ? 'text-red-500 bg-red-50'
    : expiringSoon
    ? 'text-amber-500 bg-amber-50'
    : 'text-emerald-500 bg-emerald-50';

  return (
    <div className={cn(
      'group bg-white border rounded-xl p-4 hover:shadow-sm transition-all duration-150',
      isExpired ? 'border-red-200' : expiringSoon ? 'border-amber-200' : 'border-gray-200',
    )}>
      <div className="flex items-start gap-3">
        <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5', statusCls)}>
          <StatusIcon className="w-4 h-4" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <p className="text-sm font-semibold text-gray-900 leading-tight truncate">{item.title}</p>
            <button
              onClick={onDelete}
              className="opacity-0 group-hover:opacity-100 w-6 h-6 rounded flex items-center justify-center
                         text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all shrink-0"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>

          {item.description && (
            <p className="text-xs text-gray-500 mb-2 line-clamp-2">{item.description}</p>
          )}

          <div className="flex flex-wrap items-center gap-1.5">
            {item.control && (
              <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-mono">
                {item.control.code}
              </span>
            )}
            {evidenceTypeLabel && (
              <span className={cn('text-xs font-medium px-1.5 py-0.5 rounded capitalize', typeCls)}>
                {evidenceTypeLabel.replace(/_/g, ' ')}
              </span>
            )}
            {item.source && (
              <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded flex items-center gap-1">
                <LinkIcon className="w-2.5 h-2.5" />
                {item.source === 'agent_generated' ? 'auto-collected'
                  : item.source === 'manual_upload' ? 'manual upload'
                  : item.source.replace(/_/g, ' ')}
              </span>
            )}
            {item.metadata?.fileName && (
              <span className="text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded flex items-center gap-1">
                <FileCheck className="w-2.5 h-2.5" />
                {item.metadata.fileName}
              </span>
            )}
          </div>

          {/* AI Validation section */}
          {item.metadata?.aiConfidence != null ? (
            <div className="mt-2 space-y-1.5">
              {/* Confidence badge + summary */}
              <div className={cn(
                'flex items-center gap-1.5 text-xs px-2 py-1.5 rounded-lg',
                item.metadata.aiConfidence >= 80 ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                item.metadata.aiConfidence >= 50 ? 'bg-amber-50 text-amber-700 border border-amber-100' :
                'bg-red-50 text-red-700 border border-red-100',
              )}>
                <Sparkles className="w-3 h-3 shrink-0" />
                <span className="font-medium">
                  {item.metadata.aiConfidence >= 80 ? 'High' :
                   item.metadata.aiConfidence >= 50 ? 'Medium' : 'Low'} confidence
                </span>
                <span className="opacity-60">({item.metadata.aiConfidence}%)</span>
                {item.metadata.aiSummary && (
                  <span className="opacity-75 truncate hidden sm:inline">&nbsp;— {item.metadata.aiSummary}</span>
                )}
              </div>
              {/* Summary on its own line for mobile / long summaries */}
              {item.metadata.aiSummary && (
                <p className="text-xs text-gray-500 leading-relaxed sm:hidden px-0.5">{item.metadata.aiSummary}</p>
              )}
              {/* AI Flags — the key differentiator */}
              {(item.metadata.aiFlags?.length ?? 0) > 0 && (
                <div className="bg-red-50 border border-red-100 rounded-lg px-2.5 py-2">
                  <p className="text-xs font-semibold text-red-700 mb-1 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    Concerns found
                  </p>
                  <ul className="space-y-0.5">
                    {item.metadata.aiFlags!.map((flag, i) => (
                      <li key={i} className="text-xs text-red-600 flex items-start gap-1.5">
                        <span className="mt-0.5 shrink-0">•</span>
                        <span>{flag}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : item.source === 'manual_upload' || item.source === 'manual' ? (
            // Show "validating" state for recently uploaded evidence that hasn't been checked yet
            <div className="mt-2 flex items-center gap-1.5 text-xs text-gray-400 px-2 py-1 bg-gray-50 rounded-lg border border-gray-100">
              <RefreshCw className="w-3 h-3 animate-spin" />
              <span>AI validation in progress…</span>
            </div>
          ) : null}

          {/* Re-validate button — only for validated evidence */}
          {item.metadata?.aiConfidence != null && (
            <button
              onClick={triggerRevalidate}
              disabled={revalidating}
              className="mt-1.5 text-xs text-gray-400 hover:text-brand-600 flex items-center gap-1 transition-colors"
            >
              <RefreshCw className={cn('w-3 h-3', revalidating && 'animate-spin')} />
              {revalidating ? 'Re-validating…' : 'Re-validate'}
            </button>
          )}

          {/* Suggest additional mappings — only for valid evidence */}
          {item.isValid !== false && (
            <button
              onClick={fetchSuggestions}
              className="mt-2 text-xs text-brand-600 hover:text-brand-700 flex items-center gap-1"
            >
              <Wand2 className="w-3 h-3" />
              {loadingSuggestions ? 'Finding matches...' : 'AI: suggest other controls'}
            </button>
          )}

          {showMappings && (
            <div className="mt-2 p-2 bg-brand-50 rounded-lg border border-brand-100">
              {loadingSuggestions ? (
                <p className="text-xs text-brand-600 animate-pulse">Analyzing evidence...</p>
              ) : suggestions?.length === 0 ? (
                <p className="text-xs text-gray-500">No additional control matches found</p>
              ) : (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-brand-700 mb-1.5">Also satisfies:</p>
                  {suggestions?.map(s => (
                    <div key={s.controlId} className="flex items-center gap-2">
                      <span className="text-xs bg-brand-100 text-brand-700 px-1.5 py-0.5 rounded font-mono">{s.code}</span>
                      <span className="text-xs text-gray-700 truncate">{s.title}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-50">
            <span className="text-xs text-gray-400">
              {formatRelative(item.collectedAt ?? item.createdAt)}
            </span>
            {item.expiresAt && (
              <span className={cn(
                'text-xs font-medium',
                isExpired ? 'text-red-600' : expiringSoon ? 'text-amber-600' : 'text-gray-400',
              )}>
                {isExpired ? '⚠ Expired' : expiringSoon ? '⏱ Expires' : 'Expires'}{' '}
                {formatDate(item.expiresAt)}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Upload Modal ─────────────────────────────────────────────────────────────

const EVIDENCE_TYPES = [
  { value: 'document',     label: 'Document / Policy' },
  { value: 'screenshot',   label: 'Screenshot' },
  { value: 'log',          label: 'Log File' },
  { value: 'api_response', label: 'API Response / Config Export' },
  { value: 'manual',       label: 'Manual Record' },
] as const;

function UploadModal({
  onClose,
  preselectedControlId,
}: {
  onClose: () => void;
  preselectedControlId?: string;
}) {
  const qc = useQueryClient();
  const [title, setTitle] = useState('');
  const [type, setType] = useState<string>('document');
  const [controlId, setControlId] = useState(preselectedControlId ?? '');
  const [expiresAt, setExpiresAt] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Fetch org controls for the dropdown
  const { data: controls = [] } = useQuery({
    queryKey: ['controls-for-upload'],
    queryFn: () => complianceApi.getControls(),
  });

  const upload = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error('Please select a file');
      if (!controlId) throw new Error('Please select a control');
      const fd = new FormData();
      fd.append('file', file);
      fd.append('title', title);
      fd.append('type', type);
      fd.append('controlId', controlId);
      if (expiresAt) fd.append('expiresAt', new Date(expiresAt).toISOString());
      return complianceApi.uploadEvidence(fd);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['evidence'] });
      qc.invalidateQueries({ queryKey: ['evidence-expiry'] });
      onClose();
    },
  });

  const errorMsg = upload.isError
    ? ((upload.error as any)?.response?.data?.message ?? (upload.error as any)?.message ?? 'Upload failed')
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-gray-900">Upload Evidence</h2>
          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Control selector */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Control *</label>
            <select
              value={controlId}
              onChange={(e) => setControlId(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm text-gray-900
                         focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
            >
              <option value="">Select a control…</option>
              {(controls as any[]).map((c: any) => (
                <option key={c.controlId ?? c.id} value={c.controlId ?? c.id}>
                  {c.control?.code ?? c.code} — {c.control?.title ?? c.title}
                </option>
              ))}
            </select>
          </div>

          {/* Title */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Title *</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. MFA Policy Screenshot — May 2025"
              className="w-full border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm text-gray-900
                         focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
            />
          </div>

          {/* Evidence type */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Evidence Type *</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm text-gray-900
                         focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
            >
              {EVIDENCE_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          {/* Expiry date (optional) */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">
              Expiry Date <span className="text-gray-400 font-normal">(optional — evidence will be flagged when expired)</span>
            </label>
            <input
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              className="w-full border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm text-gray-900
                         focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
            />
          </div>

          {/* File drop zone */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">File *</label>
            <div
              onClick={() => fileRef.current?.click()}
              className={cn(
                'border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors',
                file ? 'border-brand-300 bg-brand-50' : 'border-gray-200 hover:border-brand-300 hover:bg-gray-50',
              )}
            >
              <input
                ref={fileRef}
                type="file"
                className="hidden"
                accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.txt,.csv,.json,.xlsx,.xls,.docx,.doc"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              {file ? (
                <div className="flex items-center justify-center gap-2">
                  <FileCheck className="w-5 h-5 text-brand-600" />
                  <span className="text-sm font-medium text-brand-700">{file.name}</span>
                  <span className="text-xs text-gray-400">({(file.size / 1024).toFixed(0)} KB)</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); setFile(null); }}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <>
                  <Upload className="w-6 h-6 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">Click to select or drag and drop</p>
                  <p className="text-xs text-gray-400 mt-1">PDF, PNG, JPG, CSV, DOCX, XLSX up to 25 MB</p>
                </>
              )}
            </div>
          </div>

          {errorMsg && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{errorMsg}</p>
          )}
        </div>

        <div className="flex items-center gap-3 mt-6">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button
            onClick={() => upload.mutate()}
            disabled={!title.trim() || !controlId || !file || upload.isPending}
            className="btn-primary flex-1 flex items-center justify-center gap-2"
          >
            {upload.isPending ? (
              <><RefreshCw className="w-4 h-4 animate-spin" /> Uploading…</>
            ) : (
              <><Upload className="w-4 h-4" /> Upload Evidence</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function EvidencePage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [showUpload, setShowUpload] = useState(false);
  const [uploadForControlId, setUploadForControlId] = useState<string | undefined>();
  const [bulkMapResult, setBulkMapResult] = useState<BulkMapResult | null>(null);

  function openUpload(controlId?: string) {
    setUploadForControlId(controlId);
    setShowUpload(true);
  }

  const bulkMap = useMutation({
    mutationFn: () => apiClient.post<BulkMapResult>('/evidence/ai-bulk-map'),
    onSuccess: (res) => setBulkMapResult((res as any).data ?? res),
  });

  async function applyMapping(
    _evidenceId: string,
    evidenceTitle: string,
    evidenceType: string | undefined,
    storageUrl: string | undefined,
    ctrl: BulkMapControl,
  ) {
    try {
      await apiClient.post('/evidence', {
        controlId: ctrl.controlId,
        title: `${evidenceTitle} (cross-mapped)`,
        type: evidenceType ?? 'document',
        source: 'manual',
        ...(storageUrl && { storageUrl }),
      });
      qc.invalidateQueries({ queryKey: ['evidence'] });
    } catch {
      // ignore — user sees "Linked" regardless since it's optimistic
    }
  }

  const { data, isLoading } = useQuery({
    queryKey: ['evidence'],
    queryFn: () => complianceApi.getEvidence(),
  });

  const { data: expiryReport } = useQuery({
    queryKey: ['evidence-expiry'],
    queryFn: complianceApi.getExpiryReport,
  });

  const deleteEvidence = useMutation({
    mutationFn: complianceApi.deleteEvidence,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['evidence'] });
      qc.invalidateQueries({ queryKey: ['evidence-expiry'] });
    },
  });

  const evidence: Evidence[] = data ?? [];
  const expiredCount      = expiryReport?.expired?.length ?? 0;
  const expiringSoonCount = expiryReport?.expiringSoon?.length ?? 0;
  const pendingCount      = evidence.filter((e) => e.metadata?.isPendingSuggestion).length;
  const aiIssuesCount     = evidence.filter((e) =>
    !e.metadata?.isPendingSuggestion &&
    (
      (e.metadata?.aiConfidence != null && e.metadata.aiConfidence < 50) ||
      (e.metadata?.aiFlags?.length ?? 0) > 0
    )
  ).length;

  const filtered = evidence.filter((item) => {
    const isPending    = item.metadata?.isPendingSuggestion === true;
    const isExpired    = !isPending && item.expiresAt && new Date(item.expiresAt) < new Date();
    const expiringSoon = !isPending && item.expiresAt && !isExpired &&
      new Date(item.expiresAt) < new Date(Date.now() + 30 * 86400_000);
    const hasAiIssues  = !isPending && (
      (item.metadata?.aiConfidence != null && item.metadata.aiConfidence < 50) ||
      (item.metadata?.aiFlags?.length ?? 0) > 0
    );

    if (statusFilter === 'expired'   && !isExpired)    return false;
    if (statusFilter === 'expiring'  && !expiringSoon)  return false;
    if (statusFilter === 'valid'     && (isExpired || expiringSoon || isPending)) return false;
    if (statusFilter === 'pending'   && !isPending)     return false;
    if (statusFilter === 'ai_issues' && !hasAiIssues)   return false;

    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        item.title.toLowerCase().includes(q) ||
        (item.description ?? '').toLowerCase().includes(q) ||
        (item.type ?? item.evidenceType ?? '').toLowerCase().includes(q) ||
        (item.control?.code ?? '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  const STATUS_TABS = [
    { key: 'all'       as StatusFilter, label: `All (${evidence.length})` },
    { key: 'valid'     as StatusFilter, label: 'Valid' },
    { key: 'pending'   as StatusFilter, label: `Needs Upload${pendingCount > 0 ? ` (${pendingCount})` : ''}` },
    { key: 'expiring'  as StatusFilter, label: `Expiring${expiringSoonCount > 0 ? ` (${expiringSoonCount})` : ''}` },
    { key: 'expired'   as StatusFilter, label: `Expired${expiredCount > 0 ? ` (${expiredCount})` : ''}` },
    { key: 'ai_issues' as StatusFilter, label: `AI Issues${aiIssuesCount > 0 ? ` (${aiIssuesCount})` : ''}` },
  ];

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Evidence</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {evidence.length} items collected
            {expiredCount > 0 && <span className="text-red-600"> · {expiredCount} expired</span>}
            {expiringSoonCount > 0 && <span className="text-amber-600"> · {expiringSoonCount} expiring soon</span>}
            {aiIssuesCount > 0 && <span className="text-red-600"> · {aiIssuesCount} AI flagged</span>}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {evidence.length > 0 && (
            <button
              onClick={() => bulkMap.mutate()}
              disabled={bulkMap.isPending}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border
                         bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100 transition-colors"
            >
              {bulkMap.isPending
                ? <><RefreshCw className="w-4 h-4 animate-spin" /> Analyzing…</>
                : <><Sparkles className="w-4 h-4" /> AI Coverage Map</>}
            </button>
          )}
          <button
            onClick={() => openUpload()}
            className="btn-primary flex items-center gap-2 text-sm"
          >
            <Plus className="w-4 h-4" />
            Upload evidence
          </button>
        </div>
      </div>

      {/* Alert banners */}
      {expiredCount > 0 && (
        <div className="mb-4 rounded-xl bg-red-50 border border-red-200 px-4 py-3 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-red-800">{expiredCount} evidence item{expiredCount !== 1 ? 's' : ''} expired</p>
            <p className="text-xs text-red-600 mt-0.5">These need to be recollected to maintain compliance.</p>
          </div>
        </div>
      )}

      {/* AI Coverage Map panel */}
      {bulkMapResult && (
        <BulkMapPanel
          result={bulkMapResult}
          onClose={() => setBulkMapResult(null)}
          onApply={applyMapping}
        />
      )}

      {/* Search + filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search evidence…"
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
                statusFilter === key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white border border-gray-200 rounded-xl p-4 animate-pulse">
              <div className="flex gap-3">
                <div className="w-8 h-8 bg-gray-100 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-100 rounded w-3/4" />
                  <div className="h-3 bg-gray-100 rounded w-1/2" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-16 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
            {search || statusFilter !== 'all'
              ? <Search className="w-7 h-7 text-gray-300" />
              : <FolderOpen className="w-7 h-7 text-gray-300" />}
          </div>
          <p className="text-sm font-semibold text-gray-700 mb-1">
            {search || statusFilter !== 'all' ? 'No evidence matches your filter' : 'No evidence collected yet'}
          </p>
          <p className="text-xs text-gray-400 max-w-xs mx-auto">
            {search || statusFilter !== 'all'
              ? 'Try adjusting your search or filter.'
              : 'Run a compliance assessment to automatically gather evidence from your integrations, or upload manually.'}
          </p>
          {!search && statusFilter === 'all' && (
            <button onClick={() => openUpload()} className="btn-primary mt-4 flex items-center gap-2 mx-auto">
              <Upload className="w-4 h-4" />
              Upload evidence
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {filtered.map((item) => (
            <EvidenceCard
              key={item.id}
              item={item}
              onDelete={() => deleteEvidence.mutate(item.id)}
              onRevalidate={() => qc.invalidateQueries({ queryKey: ['evidence'] })}
              onUploadForControl={(cId) => openUpload(cId)}
            />
          ))}
        </div>
      )}

      {showUpload && (
        <UploadModal
          onClose={() => { setShowUpload(false); setUploadForControlId(undefined); }}
          preselectedControlId={uploadForControlId}
        />
      )}
    </div>
  );
}
