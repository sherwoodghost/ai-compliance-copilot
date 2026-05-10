'use client';

import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useDropzone } from 'react-dropzone';
import { ingestionApi, FileWithPath } from '@/lib/api/ingestion';
import {
  Upload, FileText, CheckCircle, AlertCircle, XCircle,
  Clock, ChevronRight, SkipForward, Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const DOC_TYPES = [
  { value: 'policy', label: 'Policy' },
  { value: 'procedure', label: 'Procedure' },
  { value: 'evidence', label: 'Evidence' },
  { value: 'report', label: 'Report' },
  { value: 'template', label: 'Template' },
  { value: 'other', label: 'Other' },
];

const STATUS_CONFIG: Record<string, { icon: typeof CheckCircle; color: string; label: string }> = {
  queued: { icon: Clock, color: 'text-gray-400', label: 'Queued' },
  processing: { icon: Loader2, color: 'text-blue-500', label: 'Processing' },
  classifying: { icon: Loader2, color: 'text-blue-500', label: 'Classifying' },
  mapped: { icon: CheckCircle, color: 'text-green-600', label: 'Auto-placed' },
  needs_review: { icon: AlertCircle, color: 'text-amber-500', label: 'Needs Review' },
  skipped: { icon: SkipForward, color: 'text-gray-400', label: 'Skipped' },
  error: { icon: XCircle, color: 'text-red-500', label: 'Error' },
  completed: { icon: CheckCircle, color: 'text-green-600', label: 'Completed' },
  review_pending: { icon: AlertCircle, color: 'text-amber-500', label: 'Review Pending' },
};

function StatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.queued;
  const Icon = config.icon;
  return (
    <span className={cn('inline-flex items-center gap-1 text-xs font-medium', config.color)}>
      <Icon className={cn('w-3.5 h-3.5', status === 'processing' || status === 'classifying' ? 'animate-spin' : '')} />
      {config.label}
    </span>
  );
}

function TierBadge({ tier }: { tier: number | null }) {
  if (!tier) return null;
  const colors = { 1: 'bg-green-50 text-green-700', 2: 'bg-blue-50 text-blue-700', 3: 'bg-purple-50 text-purple-700' };
  return (
    <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded', colors[tier as 1 | 2 | 3] ?? 'bg-gray-50 text-gray-600')}>
      Tier {tier}
    </span>
  );
}

function ConfidenceBadge({ confidence }: { confidence: number | null }) {
  if (confidence == null) return null;
  const color = confidence >= 80 ? 'text-green-600' : confidence >= 60 ? 'text-amber-600' : 'text-red-500';
  return <span className={cn('text-xs font-medium', color)}>{confidence}%</span>;
}

// ── Bulk Uploader ────────────────────────────────────────────────────────────

function BulkUploader() {
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const uploadMutation = useMutation({
    mutationFn: (files: FileWithPath[]) => ingestionApi.createBatch(files, (percent) => setUploadProgress(percent)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ingestion-batches'] });
      setUploading(false);
      setUploadProgress(0);
    },
    onError: () => {
      setUploading(false);
      setUploadProgress(0);
    },
  });

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;
    setUploading(true);
    setUploadProgress(0);

    // Extract folder paths from webkitRelativePath (available for directory uploads)
    const filesWithPaths: FileWithPath[] = acceptedFiles.map((file) => {
      const relativePath = (file as any).webkitRelativePath || (file as any).path || '';
      const folderPath = relativePath
        ? relativePath.substring(0, relativePath.lastIndexOf('/')) || undefined
        : undefined;
      return { file, folderPath };
    });

    uploadMutation.mutate(filesWithPaths);
  }, [uploadMutation]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'text/markdown': ['.md'],
      'text/csv': ['.csv'],
      'text/plain': ['.txt'],
      'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
    },
    maxFiles: 500,
    maxSize: 50 * 1024 * 1024, // 50MB per file
    disabled: uploading,
  });

  return (
    <div
      {...getRootProps()}
      className={cn(
        'border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all',
        isDragActive ? 'border-brand-500 bg-brand-50' : 'border-gray-300 hover:border-brand-400 hover:bg-gray-50',
        uploading && 'opacity-60 cursor-not-allowed',
      )}
    >
      <input {...getInputProps()} />
      <Upload className={cn('w-10 h-10 mx-auto mb-3', isDragActive ? 'text-brand-500' : 'text-gray-400')} />
      {uploading ? (
        <>
          <p className="text-sm font-medium text-gray-700">Uploading files...</p>
          <div className="mt-3 w-48 mx-auto h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-brand-500 rounded-full transition-all"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </>
      ) : (
        <>
          <p className="text-sm font-medium text-gray-700">
            {isDragActive ? 'Drop files here...' : 'Drag & drop files here, or click to browse'}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            PDF, DOCX, Markdown, CSV, TXT, images. Up to 500 files, 50MB each.
          </p>
        </>
      )}
      {uploadMutation.isError && (
        <p className="text-xs text-red-500 mt-2">Upload failed. Please try again.</p>
      )}
    </div>
  );
}

// ── Batch Status Card ────────────────────────────────────────────────────────

function BatchStatusCard({ batch, onSelect }: { batch: any; onSelect: (id: string) => void }) {
  const total = batch.totalFiles ?? 0;
  const processed = (batch.autoPlaced ?? 0) + (batch.needsReview ?? 0) + (batch.failed ?? 0);
  const pct = total > 0 ? Math.round((processed / total) * 100) : 0;

  return (
    <button
      onClick={() => onSelect(batch.id)}
      className="card w-full text-left hover:shadow-md transition-shadow"
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-gray-400" />
          <span className="text-sm font-medium text-gray-900">{total} files</span>
        </div>
        <StatusBadge status={batch.status} />
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mb-2">
        <div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${pct}%` }} />
      </div>

      <div className="flex items-center gap-3 text-xs text-gray-500">
        {batch.autoPlaced > 0 && (
          <span className="flex items-center gap-1">
            <CheckCircle className="w-3 h-3 text-green-500" /> {batch.autoPlaced} auto-placed
          </span>
        )}
        {batch.needsReview > 0 && (
          <span className="flex items-center gap-1">
            <AlertCircle className="w-3 h-3 text-amber-500" /> {batch.needsReview} review
          </span>
        )}
        {batch.failed > 0 && (
          <span className="flex items-center gap-1">
            <XCircle className="w-3 h-3 text-red-500" /> {batch.failed} failed
          </span>
        )}
        {batch.createdAt && (
          <p className="text-xs text-gray-400">
            {new Date(batch.createdAt).toLocaleString()}
          </p>
        )}
        <ChevronRight className="w-3.5 h-3.5 ml-auto text-gray-300" />
      </div>
    </button>
  );
}

// ── Review Queue ─────────────────────────────────────────────────────────────

function ReviewQueue({ batchId }: { batchId: string }) {
  const queryClient = useQueryClient();
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [bulkType, setBulkType] = useState('');

  const { data: files = [], isLoading } = useQuery({
    queryKey: ['ingestion-files', batchId],
    queryFn: () => ingestionApi.getBatchFiles(batchId),
  });

  const reviewMutation = useMutation({
    mutationFn: ({ fileId, dto }: { fileId: string; dto: any }) =>
      ingestionApi.reviewFile(fileId, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ingestion-files', batchId] });
      queryClient.invalidateQueries({ queryKey: ['ingestion-batches'] });
    },
  });

  const bulkMutation = useMutation({
    mutationFn: (dto: { fileIds: string[]; documentType?: string }) =>
      ingestionApi.bulkReview(batchId, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ingestion-files', batchId] });
      queryClient.invalidateQueries({ queryKey: ['ingestion-batches'] });
      setSelectedFiles(new Set());
      setBulkType('');
    },
  });

  const needsReview = files.filter((f: any) => f.status === 'needs_review');
  const autoPlaced = files.filter((f: any) => f.status === 'mapped');
  const errored = files.filter((f: any) => f.status === 'error');

  const toggleFile = (id: string) => {
    setSelectedFiles((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleConfirmFile = (fileId: string, type: string) => {
    reviewMutation.mutate({ fileId, dto: { documentType: type } });
  };

  const handleSkipFile = (fileId: string) => {
    reviewMutation.mutate({ fileId, dto: { skipFile: true } });
  };

  const handleBulkConfirm = () => {
    if (selectedFiles.size === 0 || !bulkType) return;
    bulkMutation.mutate({ fileIds: Array.from(selectedFiles), documentType: bulkType });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-gray-400">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading files...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="flex items-center gap-4 text-sm">
        <span className="text-gray-500">{files.length} total files</span>
        <span className="text-green-600">{autoPlaced.length} auto-placed</span>
        <span className="text-amber-500">{needsReview.length} needs review</span>
        {errored.length > 0 && <span className="text-red-500">{errored.length} errors</span>}
      </div>

      {/* Bulk actions */}
      {selectedFiles.size > 0 && (
        <div className="flex items-center gap-3 p-3 bg-brand-50 border border-brand-200 rounded-lg">
          <span className="text-sm font-medium text-brand-700">{selectedFiles.size} selected</span>
          <select
            value={bulkType}
            onChange={(e) => setBulkType(e.target.value)}
            className="input text-sm py-1 w-40"
          >
            <option value="">Select type...</option>
            {DOC_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
          <button
            onClick={handleBulkConfirm}
            disabled={!bulkType || bulkMutation.isPending}
            className="btn-primary text-sm py-1 px-3"
          >
            Confirm All
          </button>
        </div>
      )}

      {/* Needs review files */}
      {needsReview.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Needs Review ({needsReview.length})</h3>
          <div className="space-y-1">
            {needsReview.map((file: any) => (
              <FileReviewRow
                key={file.id}
                file={file}
                selected={selectedFiles.has(file.id)}
                onToggle={() => toggleFile(file.id)}
                onConfirm={handleConfirmFile}
                onSkip={handleSkipFile}
              />
            ))}
          </div>
        </div>
      )}

      {/* Auto-placed files */}
      {autoPlaced.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Auto-placed ({autoPlaced.length})</h3>
          <div className="space-y-1">
            {autoPlaced.map((file: any) => (
              <div key={file.id} className="flex items-center gap-3 px-3 py-2 bg-green-50 rounded-lg text-sm">
                <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                <span className="truncate flex-1">{file.originalName}</span>
                <span className="text-green-700 font-medium capitalize">{file.detectedType}</span>
                <TierBadge tier={file.tier} />
                <ConfidenceBadge confidence={file.confidence} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Errors */}
      {errored.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Errors ({errored.length})</h3>
          <div className="space-y-1">
            {errored.map((file: any) => (
              <div key={file.id} className="flex items-center gap-3 px-3 py-2 bg-red-50 rounded-lg text-sm">
                <XCircle className="w-4 h-4 text-red-500 shrink-0" />
                <span className="truncate flex-1">{file.originalName}</span>
                <span className="text-red-600 text-xs">{file.errorMessage}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function FileReviewRow({
  file,
  selected,
  onToggle,
  onConfirm,
  onSkip,
}: {
  file: any;
  selected: boolean;
  onToggle: () => void;
  onConfirm: (fileId: string, type: string) => void;
  onSkip: (fileId: string) => void;
}) {
  const [selectedType, setSelectedType] = useState(file.detectedType ?? '');

  return (
    <div className={cn(
      'flex items-center gap-3 px-3 py-2 rounded-lg border transition-colors',
      selected ? 'bg-brand-50 border-brand-200' : 'bg-white border-gray-100 hover:bg-gray-50',
    )}>
      <input
        type="checkbox"
        checked={selected}
        onChange={onToggle}
        className="rounded border-gray-300"
      />
      <FileText className="w-4 h-4 text-gray-400 shrink-0" />
      <span className="text-sm truncate flex-1 min-w-0">{file.originalName}</span>

      <TierBadge tier={file.tier} />
      <ConfidenceBadge confidence={file.confidence} />

      <select
        value={selectedType}
        onChange={(e) => setSelectedType(e.target.value)}
        className="input text-xs py-1 w-28"
      >
        <option value="">Select...</option>
        {DOC_TYPES.map((t) => (
          <option key={t.value} value={t.value}>{t.label}</option>
        ))}
      </select>

      <button
        onClick={() => selectedType && onConfirm(file.id, selectedType)}
        disabled={!selectedType}
        className="btn-primary text-xs py-1 px-2.5"
      >
        Confirm
      </button>
      <button
        onClick={() => onSkip(file.id)}
        className="btn-secondary text-xs py-1 px-2.5"
      >
        Skip
      </button>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function ImportPage() {
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);

  const { data: batches = [], isLoading } = useQuery({
    queryKey: ['ingestion-batches'],
    queryFn: () => ingestionApi.listBatches(),
    refetchInterval: 5000, // Poll for progress updates
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">Import Documents</h1>
        <p className="text-sm text-gray-500 mt-1">
          Upload compliance documents for AI-powered classification and conversion
        </p>
      </div>

      {/* Uploader */}
      <BulkUploader />

      {/* Batch list or review queue */}
      {selectedBatchId ? (
        <div className="space-y-4">
          <button
            onClick={() => setSelectedBatchId(null)}
            className="text-sm text-brand-600 hover:text-brand-700 font-medium"
          >
            &larr; Back to batches
          </button>
          <ReviewQueue batchId={selectedBatchId} />
        </div>
      ) : (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-700">Recent Imports</h2>
          {isLoading ? (
            <div className="flex items-center justify-center py-8 text-gray-400">
              <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading...
            </div>
          ) : batches.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <Upload className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No imports yet. Upload files to get started.</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {batches.map((batch: any) => (
                <BatchStatusCard key={batch.id} batch={batch} onSelect={setSelectedBatchId} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
