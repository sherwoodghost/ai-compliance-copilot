'use client';

import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { complianceApi } from '@/lib/api/compliance';
import { apiClient } from '@/lib/api/client';
import { formatDate, formatRelative } from '@/lib/utils';
import {
  FileCheck, AlertTriangle, Clock, Upload, Search, Trash2,
  Plus, X, ChevronDown, Filter, FolderOpen, Link as LinkIcon,
  CheckCircle, RefreshCw, Sparkles, Wand2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

type Evidence = {
  id: string;
  title: string;
  description?: string;
  evidenceType?: string;
  source?: string;
  status?: string;
  collectedAt?: string;
  createdAt: string;
  expiresAt?: string;
  fileUrl?: string;
  controlId?: string;
  metadata?: { aiConfidence?: number; aiSummary?: string; aiFlags?: string[] };
};

type StatusFilter = 'all' | 'valid' | 'expiring' | 'expired';

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

function EvidenceCard({ item, onDelete }: { item: Evidence; onDelete: () => void }) {
  const [showMappings, setShowMappings] = useState(false);
  const [suggestions, setSuggestions] = useState<MappingSuggestion[] | null>(null);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  async function fetchSuggestions() {
    if (suggestions !== null) { setShowMappings(!showMappings); return; }
    setLoadingSuggestions(true);
    setShowMappings(true);
    try {
      const res = await apiClient.get<{ suggestions: MappingSuggestion[] }>(
        `/evidence/${item.id}/suggest-mappings`,
      );
      setSuggestions(res.suggestions ?? []);
    } catch {
      setSuggestions([]);
    } finally {
      setLoadingSuggestions(false);
    }
  }

  const isExpired = item.expiresAt && new Date(item.expiresAt) < new Date();
  const expiringSoon = item.expiresAt && !isExpired &&
    new Date(item.expiresAt) < new Date(Date.now() + 30 * 86400_000);

  const statusIcon = isExpired ? AlertTriangle : expiringSoon ? Clock : CheckCircle;
  const StatusIcon = statusIcon;
  const statusCls = isExpired
    ? 'text-red-500 bg-red-50'
    : expiringSoon
    ? 'text-amber-500 bg-amber-50'
    : 'text-emerald-500 bg-emerald-50';

  const typeCls = TYPE_COLORS[item.evidenceType?.toLowerCase() ?? ''] ?? 'bg-gray-100 text-gray-600';

  return (
    <div className={cn(
      'group bg-white border rounded-xl p-4 hover:shadow-sm transition-all duration-150',
      isExpired ? 'border-red-200' : expiringSoon ? 'border-amber-200' : 'border-gray-200',
    )}>
      <div className="flex items-start gap-3">
        {/* Status icon */}
        <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5', statusCls)}>
          <StatusIcon className="w-4 h-4" />
        </div>

        {/* Content */}
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
            {item.evidenceType && (
              <span className={cn('text-xs font-medium px-1.5 py-0.5 rounded capitalize', typeCls)}>
                {item.evidenceType}
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
          </div>

          {/* AI Validation badge */}
          {item.metadata?.aiConfidence != null && (
            <div className={cn(
              'flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg mt-2',
              item.metadata.aiConfidence >= 80 ? 'bg-emerald-50 text-emerald-700' :
              item.metadata.aiConfidence >= 50 ? 'bg-amber-50 text-amber-700' :
              'bg-red-50 text-red-700',
            )}>
              <Sparkles className="w-3 h-3 shrink-0" />
              <span>AI confidence: {item.metadata.aiConfidence}%</span>
              {item.metadata.aiSummary && (
                <span className="text-xs opacity-75 truncate">&nbsp;— {item.metadata.aiSummary}</span>
              )}
            </div>
          )}

          {/* Suggest additional mappings */}
          <button
            onClick={fetchSuggestions}
            className="mt-2 text-xs text-brand-600 hover:text-brand-700 flex items-center gap-1"
          >
            <Wand2 className="w-3 h-3" />
            {loadingSuggestions ? 'Finding matches...' : 'AI: suggest other controls'}
          </button>

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
                {isExpired ? '⚠ Expired' : expiringSoon ? '⏱ Expires'  : 'Expires'}{' '}
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

function UploadModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState('screenshot');
  const [file, setFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const upload = useMutation({
    mutationFn: async () => {
      const fd = new FormData();
      fd.append('title', title);
      fd.append('description', description);
      fd.append('evidenceType', type);
      if (file) fd.append('file', file);
      return complianceApi.uploadEvidence(fd);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['evidence'] });
      qc.invalidateQueries({ queryKey: ['evidence-expiry'] });
      onClose();
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-gray-900">Upload Evidence</h2>
          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Title *</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. MFA Policy Screenshot"
              className="w-full border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm text-gray-900
                         focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="What does this evidence demonstrate?"
              className="w-full border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm text-gray-900
                         focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Evidence Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm text-gray-900
                         focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
            >
              {['screenshot', 'log', 'report', 'configuration', 'policy', 'certificate', 'other'].map((t) => (
                <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
              ))}
            </select>
          </div>

          {/* File drop zone */}
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
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            {file ? (
              <div className="flex items-center justify-center gap-2">
                <FileCheck className="w-5 h-5 text-brand-600" />
                <span className="text-sm font-medium text-brand-700">{file.name}</span>
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
                <p className="text-sm text-gray-500">Click to upload or drag and drop</p>
                <p className="text-xs text-gray-400 mt-1">PDF, PNG, JPG, CSV up to 50MB</p>
              </>
            )}
          </div>

          {upload.isError && (
            <p className="text-xs text-red-600">Failed to upload. Please try again.</p>
          )}
        </div>

        <div className="flex items-center gap-3 mt-6">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button
            onClick={() => upload.mutate()}
            disabled={!title.trim() || upload.isPending}
            className="btn-primary flex-1 flex items-center justify-center gap-2"
          >
            {upload.isPending ? (
              <><RefreshCw className="w-4 h-4 animate-spin" /> Uploading…</>
            ) : (
              <><Upload className="w-4 h-4" /> Upload</>
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
  const expiredCount    = expiryReport?.expired?.length ?? 0;
  const expiringSoonCount = expiryReport?.expiringSoon?.length ?? 0;

  const filtered = evidence.filter((item) => {
    const isExpired = item.expiresAt && new Date(item.expiresAt) < new Date();
    const expiringSoon = item.expiresAt && !isExpired &&
      new Date(item.expiresAt) < new Date(Date.now() + 30 * 86400_000);

    if (statusFilter === 'expired' && !isExpired) return false;
    if (statusFilter === 'expiring' && !expiringSoon) return false;
    if (statusFilter === 'valid' && (isExpired || expiringSoon)) return false;

    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        item.title.toLowerCase().includes(q) ||
        (item.description ?? '').toLowerCase().includes(q) ||
        (item.evidenceType ?? '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  const STATUS_TABS = [
    { key: 'all' as StatusFilter,      label: `All (${evidence.length})` },
    { key: 'valid' as StatusFilter,    label: `Valid` },
    { key: 'expiring' as StatusFilter, label: `Expiring${expiringSoonCount > 0 ? ` (${expiringSoonCount})` : ''}` },
    { key: 'expired' as StatusFilter,  label: `Expired${expiredCount > 0 ? ` (${expiredCount})` : ''}` },
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
          </p>
        </div>
        <button
          onClick={() => setShowUpload(true)}
          className="btn-primary flex items-center gap-2 text-sm shrink-0"
        >
          <Plus className="w-4 h-4" />
          Upload evidence
        </button>
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
            <button onClick={() => setShowUpload(true)} className="btn-primary mt-4 flex items-center gap-2 mx-auto">
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
            />
          ))}
        </div>
      )}

      {showUpload && <UploadModal onClose={() => setShowUpload(false)} />}
    </div>
  );
}
