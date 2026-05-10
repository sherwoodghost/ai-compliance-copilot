'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { complianceApi } from '@/lib/api/compliance';
import { formatDate, formatRelative, cn } from '@/lib/utils';
import {
  FileCheck, AlertTriangle, Clock, Search, Plus, Upload, Link2,
  Trash2, X, ChevronDown, Filter, Shield,
} from 'lucide-react';

const TYPE_OPTIONS = [
  { value: 'document', label: 'Document' },
  { value: 'screenshot', label: 'Screenshot' },
  { value: 'log', label: 'Log' },
  { value: 'api_response', label: 'API Response' },
  { value: 'manual', label: 'Manual' },
];

const SOURCE_OPTIONS = [
  { value: 'manual_upload', label: 'Manual Upload' },
  { value: 'integration', label: 'Integration' },
  { value: 'agent_generated', label: 'Agent Generated' },
];

// ──────────────────────────────────────────────────────────────────────
// Upload Evidence Modal
// ───────────────────────────────���──────────────────────────────────────
function UploadEvidenceModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [title, setTitle] = useState('');
  const [controlId, setControlId] = useState('');
  const [type, setType] = useState('document');
  const [source, setSource] = useState('manual_upload');
  const [storageUrl, setStorageUrl] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [controlSearch, setControlSearch] = useState('');

  // Load controls for linking
  const { data: controls } = useQuery({
    queryKey: ['controls'],
    queryFn: () => complianceApi.getControls(),
  });

  const create = useMutation({
    mutationFn: () =>
      complianceApi.uploadEvidence({
        controlId,
        title,
        type,
        source,
        ...(storageUrl && { storageUrl }),
        ...(expiresAt && { expiresAt }),
      } as any),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['evidence'] });
      qc.invalidateQueries({ queryKey: ['evidence-expiry'] });
      onClose();
    },
  });

  const controlList: any[] = controls ?? [];
  const filteredControls = controlSearch
    ? controlList.filter(
        (c: any) =>
          c.control?.code?.toLowerCase().includes(controlSearch.toLowerCase()) ||
          c.control?.title?.toLowerCase().includes(controlSearch.toLowerCase()),
      )
    : controlList.slice(0, 20);

  const selectedControl = controlList.find((c: any) => c.controlId === controlId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto">
        <div className="px-6 py-5 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center">
              <Upload className="w-4 h-4 text-green-600" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900">Add Evidence</h2>
          </div>
          <button className="text-gray-400 hover:text-gray-600" onClick={onClose}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Title */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., MFA Configuration Screenshot"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          {/* Control selector */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Link to Control *</label>
            {selectedControl ? (
              <div className="flex items-center gap-2 p-2 bg-brand-50 border border-brand-200 rounded-lg">
                <span className="text-[10px] font-mono text-brand-600 bg-white px-1.5 py-0.5 rounded">
                  {selectedControl.control?.code}
                </span>
                <span className="text-sm text-gray-800 truncate flex-1">
                  {selectedControl.control?.title}
                </span>
                <button
                  onClick={() => setControlId('')}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div>
                <input
                  type="text"
                  value={controlSearch}
                  onChange={(e) => setControlSearch(e.target.value)}
                  placeholder="Search controls..."
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
                {controlSearch && filteredControls.length > 0 && (
                  <div className="mt-1 max-h-40 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
                    {filteredControls.map((c: any) => (
                      <button
                        key={c.controlId}
                        onClick={() => {
                          setControlId(c.controlId);
                          setControlSearch('');
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-gray-50 flex items-center gap-2"
                      >
                        <span className="text-[10px] font-mono text-brand-600 bg-brand-50 px-1 py-0.5 rounded">
                          {c.control?.code}
                        </span>
                        <span className="text-xs text-gray-700 truncate">{c.control?.title}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Type & Source */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Type *</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                {TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Source *</label>
              <select
                value={source}
                onChange={(e) => setSource(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                {SOURCE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* URL */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              URL / Storage Link <span className="text-gray-400">(optional)</span>
            </label>
            <input
              type="text"
              value={storageUrl}
              onChange={(e) => setStorageUrl(e.target.value)}
              placeholder="https://drive.google.com/... or S3 path"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          {/* Expiry */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Expires At <span className="text-gray-400">(optional)</span>
            </label>
            <input
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={() => create.mutate()}
            disabled={!title || !controlId || create.isPending}
            className="px-4 py-2 text-sm font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-700 disabled:opacity-50 flex items-center gap-2"
          >
            {create.isPending ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Plus className="w-4 h-4" />
            )}
            Add Evidence
          </button>
        </div>
      </div>
    </div>
  );
}

// ──���───────────────────────────────────────────────────────────────────
// Evidence Card
// ───────��───────────────────────────────────────────────────��──────────
function EvidenceCard({ item, onDelete }: { item: any; onDelete: () => void }) {
  const isExpired = item.expiresAt && new Date(item.expiresAt) < new Date();
  const expiringSoon =
    item.expiresAt &&
    !isExpired &&
    new Date(item.expiresAt) < new Date(Date.now() + 30 * 86400_000);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-start gap-3 hover:border-gray-300 transition-colors group">
      <div
        className={cn(
          'mt-0.5 w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
          isExpired ? 'bg-red-50' : expiringSoon ? 'bg-yellow-50' : 'bg-green-50',
        )}
      >
        {isExpired ? (
          <AlertTriangle className="w-4 h-4 text-red-600" />
        ) : expiringSoon ? (
          <Clock className="w-4 h-4 text-yellow-600" />
        ) : (
          <FileCheck className="w-4 h-4 text-green-600" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium text-gray-900 truncate">{item.title}</p>
          <div className="flex items-center gap-1.5 shrink-0">
            <span
              className={cn(
                'text-[10px] font-medium px-2 py-0.5 rounded-full',
                isExpired
                  ? 'bg-red-50 text-red-700'
                  : item.isValid
                  ? 'bg-green-50 text-green-700'
                  : 'bg-gray-100 text-gray-600',
              )}
            >
              {isExpired ? 'Expired' : item.isValid ? 'Valid' : 'Invalid'}
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-opacity"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
        {item.description && (
          <p className="text-xs text-gray-500 mt-0.5 truncate">{item.description}</p>
        )}
        <div className="flex items-center gap-3 mt-2 flex-wrap">
          {item.control?.code && (
            <span className="text-[10px] font-mono text-brand-600 bg-brand-50 px-1.5 py-0.5 rounded flex items-center gap-1">
              <Link2 className="w-2.5 h-2.5" />
              {item.control.code}
            </span>
          )}
          <span className="text-[10px] text-gray-400 capitalize">{item.evidenceType?.replace('_', ' ')}</span>
          {item.source && (
            <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded capitalize">
              {item.source.replace('_', ' ')}
            </span>
          )}
          <span className="text-[10px] text-gray-400 ml-auto">
            {formatRelative(item.collectedAt ?? item.createdAt)}
          </span>
        </div>
        {item.expiresAt && (
          <p
            className={cn(
              'text-[10px] mt-1.5',
              isExpired ? 'text-red-600' : expiringSoon ? 'text-yellow-600' : 'text-gray-400',
            )}
          >
            {isExpired ? 'Expired' : 'Expires'} {formatDate(item.expiresAt)}
          </p>
        )}
      </div>
    </div>
  );
}

// ───��──────────────────────────────────────────────────────────────────
// Main Page
// ──────────────────────────────────────────────────────────────────────
export default function EvidencePage() {
  const qc = useQueryClient();
  const [showUpload, setShowUpload] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  const { data, isLoading } = useQuery({
    queryKey: ['evidence'],
    queryFn: () => complianceApi.getEvidence(),
  });

  const { data: expiryReport } = useQuery({
    queryKey: ['evidence-expiry'],
    queryFn: complianceApi.getExpiryReport,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => complianceApi.deleteEvidence(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['evidence'] });
      qc.invalidateQueries({ queryKey: ['evidence-expiry'] });
    },
  });

  const evidence: any[] = data ?? [];
  const expiredCount = expiryReport?.expired?.length ?? 0;
  const expiringSoonCount = expiryReport?.expiringSoon?.length ?? 0;

  const filtered = evidence.filter((item) => {
    if (typeFilter !== 'all' && item.evidenceType !== typeFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        item.title?.toLowerCase().includes(q) ||
        item.control?.code?.toLowerCase().includes(q) ||
        item.description?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FileCheck className="w-6 h-6 text-green-600" />
            Evidence
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {evidence.length} items collected
            {expiredCount > 0 && <span className="text-red-500"> · {expiredCount} expired</span>}
            {expiringSoonCount > 0 && <span className="text-yellow-600"> · {expiringSoonCount} expiring soon</span>}
          </p>
        </div>
        <button
          onClick={() => setShowUpload(true)}
          className="px-4 py-2 text-sm font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-700 flex items-center gap-2 shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Add Evidence
        </button>
      </div>

      {/* Expiry alert */}
      {expiredCount > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-red-800">
              {expiredCount} evidence item{expiredCount > 1 ? 's' : ''} expired
            </p>
            <p className="text-xs text-red-600 mt-0.5">
              These need to be recollected to maintain compliance.
            </p>
          </div>
        </div>
      )}

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
          {['all', 'document', 'screenshot', 'log', 'api_response', 'manual'].map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={cn(
                'px-3 py-1.5 text-xs font-medium rounded-full border transition-colors capitalize',
                typeFilter === t
                  ? 'bg-brand-50 border-brand-300 text-brand-700'
                  : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50',
              )}
            >
              {t === 'all' ? 'All' : t.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Evidence grid */}
      {isLoading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-6 h-6 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : evidence.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <FileCheck className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-lg font-medium text-gray-700">No evidence collected yet</p>
          <p className="text-sm text-gray-400 mt-1">
            Add evidence manually or run an assessment to gather it from your integrations.
          </p>
          <button
            onClick={() => setShowUpload(true)}
            className="mt-4 px-4 py-2 text-sm font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-700 inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Your First Evidence
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-8 text-gray-400 text-sm">
          No evidence matches your filters.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filtered.map((item) => (
            <EvidenceCard
              key={item.id}
              item={item}
              onDelete={() => deleteMutation.mutate(item.id)}
            />
          ))}
        </div>
      )}

      {/* Upload Modal */}
      {showUpload && <UploadEvidenceModal onClose={() => setShowUpload(false)} />}
    </div>
  );
}
