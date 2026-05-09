'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  Upload, FileText, CheckCircle, AlertCircle, Clock, ChevronDown,
  ChevronRight, XCircle, RefreshCw, Filter, Check, X,
} from 'lucide-react';
import { ingestionApi, IngestionBatch, IngestionFile } from '@/lib/api/ingestion';

// ── Types ─────────────────────────────────────────────────────────────────────

type FileStatus = IngestionFile['status'];

const STATUS_LABELS: Record<FileStatus, string> = {
  queued: 'Queued',
  extracting: 'Extracting',
  classifying: 'Classifying',
  mapped: 'Auto-mapped',
  needs_review: 'Needs Review',
  error: 'Error',
  skipped: 'Skipped',
};

const STATUS_COLORS: Record<FileStatus, string> = {
  queued: 'text-gray-500',
  extracting: 'text-blue-500',
  classifying: 'text-blue-500',
  mapped: 'text-green-600',
  needs_review: 'text-amber-600',
  error: 'text-red-600',
  skipped: 'text-gray-400',
};

const STATUS_BG: Record<FileStatus, string> = {
  queued: 'bg-gray-100 text-gray-700',
  extracting: 'bg-blue-100 text-blue-700',
  classifying: 'bg-blue-100 text-blue-700',
  mapped: 'bg-green-100 text-green-700',
  needs_review: 'bg-amber-100 text-amber-700',
  error: 'bg-red-100 text-red-700',
  skipped: 'bg-gray-100 text-gray-500',
};

const FRAMEWORK_COLORS: Record<string, string> = {
  SOC2: 'bg-blue-100 text-blue-700',
  ISO27001: 'bg-red-100 text-red-700',
  GDPR: 'bg-violet-100 text-violet-700',
  ISO9001: 'bg-teal-100 text-teal-700',
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ── Upload Drop Zone ──────────────────────────────────────────────────────────

function DropZone({ onFilesSelected }: { onFilesSelected: (files: File[]) => void }) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const items = Array.from(e.dataTransfer.files);
    if (items.length > 0) onFilesSelected(items);
  }, [onFilesSelected]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      onFilesSelected(Array.from(e.target.files));
    }
  }, [onFilesSelected]);

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      className={`
        border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all
        ${isDragging
          ? 'border-violet-400 bg-violet-50'
          : 'border-gray-300 bg-gray-50 hover:border-gray-400 hover:bg-gray-100'
        }
      `}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleChange}
        accept=".pdf,.doc,.docx,.txt,.csv,.xlsx,.png,.jpg,.jpeg"
      />
      <Upload className={`mx-auto h-12 w-12 mb-4 ${isDragging ? 'text-violet-500' : 'text-gray-400'}`} />
      <p className="text-base font-semibold text-gray-700">
        {isDragging ? 'Drop your files here' : 'Drag & drop compliance documents'}
      </p>
      <p className="text-sm text-gray-500 mt-1">
        or click to browse — PDF, DOCX, TXT, CSV, XLSX, Images • Max 50MB/file • Up to 500 files
      </p>
      <p className="text-xs text-gray-400 mt-3">
        Files will be automatically classified and mapped to controls
      </p>
    </div>
  );
}

// ── File Status Row ───────────────────────────────────────────────────────────

function FileRow({ file, onReview }: {
  file: IngestionFile;
  onReview: (fileId: string, status: 'mapped' | 'skipped') => void;
}) {
  const ext = file.originalName.split('.').pop()?.toUpperCase() ?? 'FILE';

  return (
    <div className="flex items-center gap-3 py-2.5 px-3 rounded-lg hover:bg-gray-50 group">
      <div className="flex-shrink-0 w-8 h-8 rounded bg-gray-100 flex items-center justify-center">
        <span className="text-xs font-bold text-gray-500">{ext.slice(0, 4)}</span>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-800 truncate max-w-xs">
            {file.originalName}
          </span>
          <span className="text-xs text-gray-400 flex-shrink-0">{formatBytes(file.sizeBytes)}</span>
        </div>
        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
          {file.detectedType && (
            <span className="text-xs text-gray-500">{file.detectedType}</span>
          )}
          {file.detectedFrameworks?.map(fw => (
            <span key={fw} className={`text-xs px-1.5 py-0.5 rounded font-medium ${FRAMEWORK_COLORS[fw] ?? 'bg-gray-100 text-gray-600'}`}>
              {fw}
            </span>
          ))}
          {file.confidence != null && (
            <span className="text-xs text-gray-400">{file.confidence}% confidence</span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_BG[file.status]}`}>
          {STATUS_LABELS[file.status]}
        </span>

        {file.status === 'needs_review' && (
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => onReview(file.id, 'mapped')}
              className="p-1 rounded hover:bg-green-100 text-green-600 transition-colors"
              title="Accept mapping"
            >
              <Check className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => onReview(file.id, 'skipped')}
              className="p-1 rounded hover:bg-red-100 text-red-500 transition-colors"
              title="Skip file"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Batch Card ────────────────────────────────────────────────────────────────

function BatchCard({ batch }: { batch: IngestionBatch }) {
  const [expanded, setExpanded] = useState(false);
  const [files, setFiles] = useState<IngestionFile[]>([]);
  const [filterStatus, setFilterStatus] = useState<FileStatus | 'all'>('all');
  const [loading, setLoading] = useState(false);

  const progressPct = batch.totalFiles > 0
    ? Math.round((batch.processedFiles / batch.totalFiles) * 100)
    : 0;

  const loadFiles = async () => {
    if (!expanded) return;
    setLoading(true);
    try {
      const data = await ingestionApi.getBatchFiles(batch.id);
      setFiles(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (expanded) loadFiles();
  }, [expanded]);

  const handleReview = async (fileId: string, status: 'mapped' | 'skipped') => {
    await ingestionApi.reviewFile(fileId, { status });
    setFiles(prev => prev.map(f => f.id === fileId ? { ...f, status } : f));
  };

  const handleBulkReview = async (status: 'mapped' | 'skipped') => {
    const reviewIds = files.filter(f => f.status === 'needs_review').map(f => f.id);
    if (reviewIds.length === 0) return;
    await ingestionApi.bulkReview(batch.id, reviewIds, status);
    setFiles(prev => prev.map(f => reviewIds.includes(f.id) ? { ...f, status } : f));
  };

  const filteredFiles = filterStatus === 'all'
    ? files
    : files.filter(f => f.status === filterStatus);

  const statusCounts = files.reduce((acc, f) => {
    acc[f.status] = (acc[f.status] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const batchDate = new Date(batch.createdAt).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full text-left px-5 py-4 flex items-center gap-3 hover:bg-gray-50 transition-colors"
      >
        {expanded ? <ChevronDown className="h-4 w-4 text-gray-400" /> : <ChevronRight className="h-4 w-4 text-gray-400" />}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-semibold text-gray-800">
              Batch from {batchDate}
            </span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              batch.status === 'completed' ? 'bg-green-100 text-green-700' :
              batch.status === 'review_pending' ? 'bg-amber-100 text-amber-700' :
              batch.status === 'processing' ? 'bg-blue-100 text-blue-700' :
              batch.status === 'failed' ? 'bg-red-100 text-red-700' :
              'bg-gray-100 text-gray-600'
            }`}>
              {batch.status.replace('_', ' ')}
            </span>
          </div>
          <div className="flex items-center gap-4 text-xs text-gray-500">
            <span>{batch.totalFiles} files</span>
            <span className="text-green-600">✓ {batch.autoPlaced} auto-mapped</span>
            {batch.needsReview > 0 && <span className="text-amber-600">⚠ {batch.needsReview} need review</span>}
            {batch.failed > 0 && <span className="text-red-600">✕ {batch.failed} failed</span>}
          </div>
        </div>

        {/* Progress bar */}
        {batch.status === 'processing' && (
          <div className="w-24 flex-shrink-0">
            <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-violet-500 rounded-full transition-all"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <p className="text-xs text-gray-400 text-right mt-0.5">{progressPct}%</p>
          </div>
        )}
      </button>

      {expanded && (
        <div className="border-t border-gray-100">
          {/* Toolbar */}
          <div className="px-5 py-3 flex items-center gap-2 border-b border-gray-100 bg-gray-50">
            <Filter className="h-3.5 w-3.5 text-gray-400" />
            <div className="flex gap-1">
              {(['all', 'mapped', 'needs_review', 'error', 'skipped'] as const).map(s => (
                <button
                  key={s}
                  onClick={() => setFilterStatus(s)}
                  className={`text-xs px-2.5 py-1 rounded-full transition-colors ${
                    filterStatus === s
                      ? 'bg-violet-100 text-violet-700 font-medium'
                      : 'text-gray-500 hover:bg-gray-200'
                  }`}
                >
                  {s === 'all' ? `All (${files.length})` : `${STATUS_LABELS[s as FileStatus]} (${statusCounts[s] ?? 0})`}
                </button>
              ))}
            </div>

            {(statusCounts['needs_review'] ?? 0) > 0 && (
              <div className="ml-auto flex gap-2">
                <button
                  onClick={() => handleBulkReview('mapped')}
                  className="text-xs px-3 py-1 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
                >
                  Accept all ({statusCounts['needs_review']})
                </button>
                <button
                  onClick={() => handleBulkReview('skipped')}
                  className="text-xs px-3 py-1 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
                >
                  Skip all
                </button>
              </div>
            )}
          </div>

          {/* File list */}
          <div className="px-3 py-2 max-h-96 overflow-y-auto">
            {loading ? (
              <div className="py-8 text-center text-sm text-gray-400">Loading files…</div>
            ) : filteredFiles.length === 0 ? (
              <div className="py-8 text-center text-sm text-gray-400">No files match this filter</div>
            ) : (
              filteredFiles.map(file => (
                <FileRow key={file.id} file={file} onReview={handleReview} />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function IngestionPage() {
  const [batches, setBatches] = useState<IngestionBatch[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ name: string; status: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  const loadBatches = useCallback(async () => {
    try {
      const data = await ingestionApi.listBatches();
      setBatches(data);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    loadBatches();
  }, [loadBatches]);

  const handleFilesSelected = async (files: File[]) => {
    if (files.length === 0) return;
    if (files.length > 500) {
      setError('Maximum 500 files per batch. Please split into smaller batches.');
      return;
    }
    const oversized = files.filter(f => f.size > 50 * 1024 * 1024);
    if (oversized.length > 0) {
      setError(`${oversized.length} file(s) exceed 50MB limit: ${oversized.slice(0, 3).map(f => f.name).join(', ')}`);
      return;
    }

    setError(null);
    setUploading(true);
    setUploadProgress(files.map(f => ({ name: f.name, status: 'uploading' })));

    try {
      const result = await ingestionApi.createBatch(files);

      // Refresh batches and start polling
      await loadBatches();

      // Poll for completion
      const pollBatch = async () => {
        const batch = await ingestionApi.getBatch(result.batchId);
        setBatches(prev => prev.map(b => b.id === batch.id ? batch : b));
        if (batch.status === 'processing' || batch.status === 'queued') {
          pollingRef.current = setTimeout(pollBatch, 2000);
        }
      };
      pollingRef.current = setTimeout(pollBatch, 1500);

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Upload failed';
      setError(msg);
    } finally {
      setUploading(false);
      setUploadProgress([]);
    }
  };

  useEffect(() => {
    return () => {
      if (pollingRef.current) clearTimeout(pollingRef.current);
    };
  }, []);

  const totalNeedingReview = batches.reduce((sum, b) => sum + (b.needsReview ?? 0), 0);
  const totalMapped = batches.reduce((sum, b) => sum + (b.autoPlaced ?? 0), 0);
  const totalFiles = batches.reduce((sum, b) => sum + b.totalFiles, 0);

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bulk Document Ingestion</h1>
          <p className="text-gray-500 mt-1 text-sm">
            Import existing compliance documents from Vanta, Drata, SharePoint, or any file system.
            Files are automatically classified and mapped to controls.
          </p>
        </div>
        <button
          onClick={loadBatches}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {/* Stats */}
      {batches.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="text-2xl font-bold text-gray-900">{totalFiles}</div>
            <div className="text-sm text-gray-500 mt-0.5">Total files uploaded</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="text-2xl font-bold text-green-600">{totalMapped}</div>
            <div className="text-sm text-gray-500 mt-0.5">Auto-mapped to controls</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="text-2xl font-bold text-amber-600">{totalNeedingReview}</div>
            <div className="text-sm text-gray-500 mt-0.5">Pending your review</div>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700">
          <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium">Upload error</p>
            <p className="text-sm">{error}</p>
          </div>
          <button onClick={() => setError(null)} className="ml-auto flex-shrink-0">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Drop zone */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-base font-semibold text-gray-800 mb-4">Upload new batch</h2>
        {uploading ? (
          <div className="p-8 text-center">
            <div className="inline-flex items-center gap-3 text-violet-700">
              <div className="h-5 w-5 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm font-medium">
                Uploading {uploadProgress.length} file{uploadProgress.length !== 1 ? 's' : ''}…
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-2">Files will be processed automatically in the background</p>
          </div>
        ) : (
          <DropZone onFilesSelected={handleFilesSelected} />
        )}

        {/* Classification tiers info */}
        <div className="mt-4 grid grid-cols-3 gap-3">
          {[
            { tier: '1', label: 'Deterministic', desc: 'Filename + folder patterns', color: 'green' },
            { tier: '2', label: 'AI — Haiku', desc: 'Content analysis (cheap)', color: 'blue' },
            { tier: '3', label: 'AI — Sonnet', desc: 'Complex documents', color: 'violet' },
          ].map(t => (
            <div key={t.tier} className="p-3 rounded-lg bg-gray-50 border border-gray-100">
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-xs font-bold px-1.5 py-0.5 rounded bg-${t.color}-100 text-${t.color}-700`}>
                  Tier {t.tier}
                </span>
                <span className="text-xs font-semibold text-gray-700">{t.label}</span>
              </div>
              <p className="text-xs text-gray-500">{t.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Batch history */}
      {batches.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-base font-semibold text-gray-800">
            Ingestion batches ({batches.length})
          </h2>
          {batches.map(batch => (
            <BatchCard key={batch.id} batch={batch} />
          ))}
        </div>
      )}

      {batches.length === 0 && !uploading && (
        <div className="text-center py-12 text-gray-400">
          <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No ingestion batches yet. Upload your first batch above.</p>
        </div>
      )}
    </div>
  );
}
