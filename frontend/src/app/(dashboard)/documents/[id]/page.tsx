'use client';

import { useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { documentsApi } from '@/lib/api/documents';
import { DocumentEditor } from '@/components/editor/DocumentEditor';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import {
  ArrowLeft, Save, Download, Clock, FileText,
  Loader2, History, ChevronDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const DOC_TYPE_OPTIONS = [
  { value: 'policy', label: 'Policy' },
  { value: 'procedure', label: 'Procedure' },
  { value: 'evidence', label: 'Evidence' },
  { value: 'report', label: 'Report' },
  { value: 'template', label: 'Template' },
  { value: 'other', label: 'Other' },
];

export default function DocumentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [editMode, setEditMode] = useState(false);
  const [pendingContent, setPendingContent] = useState<{ json: object; html: string } | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDocType, setEditDocType] = useState('');
  const [showVersions, setShowVersions] = useState(false);

  const { data: doc, isLoading } = useQuery({
    queryKey: ['document', id],
    queryFn: () => documentsApi.get(id),
    enabled: !!id,
  });

  const { data: versions = [] } = useQuery({
    queryKey: ['document-versions', id],
    queryFn: () => documentsApi.getVersions(id),
    enabled: !!id && showVersions,
  });

  const saveMutation = useMutation({
    mutationFn: (data: { title?: string; docType?: string; content?: object; contentHtml?: string }) =>
      documentsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['document', id] });
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      setEditMode(false);
      setPendingContent(null);
    },
  });

  const snapshotMutation = useMutation({
    mutationFn: (changeNote?: string) => documentsApi.createVersion(id, changeNote),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['document-versions', id] });
    },
  });

  const handleEditorChange = useCallback((json: object, html: string) => {
    setPendingContent({ json, html });
  }, []);

  const handleStartEdit = () => {
    if (doc) {
      setEditTitle(doc.title);
      setEditDocType(doc.docType);
      setEditMode(true);
    }
  };

  const handleSave = () => {
    const updates: any = {};
    if (editTitle && editTitle !== doc?.title) updates.title = editTitle;
    if (editDocType && editDocType !== doc?.docType) updates.docType = editDocType;
    if (pendingContent) {
      updates.content = pendingContent.json;
      updates.contentHtml = pendingContent.html;
    }
    if (Object.keys(updates).length > 0) {
      saveMutation.mutate(updates);
    } else {
      setEditMode(false);
    }
  };

  const handleCancel = () => {
    setEditMode(false);
    setPendingContent(null);
  };

  const handleDownload = async () => {
    try {
      const result = await documentsApi.getDownloadUrl(id);
      if (result.url) window.open(result.url, '_blank');
    } catch { /* noop */ }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-gray-400">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading document...
      </div>
    );
  }

  if (!doc) {
    return (
      <div className="text-center py-24 text-gray-400">
        <FileText className="w-10 h-10 mx-auto mb-3 opacity-40" />
        <p className="text-sm font-medium">Document not found</p>
        <button onClick={() => router.push('/documents')} className="text-brand-600 text-sm mt-2 hover:underline">
          Back to documents
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Top bar */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.push('/documents')} className="p-1.5 rounded hover:bg-gray-100">
          <ArrowLeft className="w-4 h-4 text-gray-500" />
        </button>

        {editMode ? (
          <input
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            className="input text-lg font-bold flex-1"
            autoFocus
          />
        ) : (
          <h1 className="text-lg font-bold text-gray-900 flex-1 truncate">{doc.title}</h1>
        )}

        <div className="flex items-center gap-2">
          {editMode ? (
            <>
              <select
                value={editDocType}
                onChange={(e) => setEditDocType(e.target.value)}
                className="input text-sm py-1.5 w-32"
              >
                {DOC_TYPE_OPTIONS.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
              <button onClick={handleCancel} className="btn-secondary text-sm py-1.5 px-3">
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saveMutation.isPending}
                className="btn-primary text-sm py-1.5 px-3 flex items-center gap-1.5"
              >
                {saveMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                Save
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setShowVersions(!showVersions)}
                className="btn-secondary text-sm py-1.5 px-3 flex items-center gap-1.5"
              >
                <History className="w-3.5 h-3.5" />
                v{doc.version}
                <ChevronDown className={cn('w-3 h-3 transition-transform', showVersions && 'rotate-180')} />
              </button>
              {doc.sourceStorageKey && (
                <button onClick={handleDownload} className="btn-secondary text-sm py-1.5 px-3 flex items-center gap-1.5">
                  <Download className="w-3.5 h-3.5" /> Original
                </button>
              )}
              <button onClick={handleStartEdit} className="btn-primary text-sm py-1.5 px-3">
                Edit
              </button>
            </>
          )}
        </div>
      </div>

      {/* Metadata bar */}
      <div className="flex items-center gap-3 text-xs text-gray-500">
        <span className={cn(
          'px-2 py-0.5 rounded-full font-medium',
          doc.docType === 'policy' ? 'bg-blue-50 text-blue-700' :
          doc.docType === 'procedure' ? 'bg-purple-50 text-purple-700' :
          doc.docType === 'evidence' ? 'bg-green-50 text-green-700' :
          doc.docType === 'report' ? 'bg-amber-50 text-amber-700' :
          'bg-gray-100 text-gray-600'
        )}>
          {doc.docType}
        </span>
        {doc.detectedFrameworks?.map((fw: string) => (
          <span key={fw} className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-[10px] font-medium">
            {fw}
          </span>
        ))}
        {doc.controlIds?.length > 0 && (
          <span>{doc.controlIds.length} mapped control{doc.controlIds.length !== 1 ? 's' : ''}</span>
        )}
        <span className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {new Date(doc.updatedAt).toLocaleDateString()}
        </span>
      </div>

      {/* Version history panel */}
      {showVersions && (
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-700">Version History</h3>
            <button
              onClick={() => snapshotMutation.mutate('Manual snapshot')}
              disabled={snapshotMutation.isPending}
              className="btn-secondary text-xs py-1 px-2"
            >
              Create Snapshot
            </button>
          </div>
          {versions.length === 0 ? (
            <p className="text-xs text-gray-400">No previous versions</p>
          ) : (
            <div className="space-y-1.5">
              {versions.map((v: any) => (
                <div key={v.id} className="flex items-center gap-3 text-xs px-3 py-2 bg-gray-50 rounded">
                  <span className="font-medium text-gray-700">v{v.version}</span>
                  <span className="text-gray-400 flex-1">{v.changeNote ?? 'No note'}</span>
                  <span className="text-gray-400">{new Date(v.createdAt).toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Editor */}
      <ErrorBoundary
        fallback={
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-center">
            <h3 className="text-lg font-semibold text-amber-800">Editor failed to load</h3>
            <p className="mt-2 text-sm text-amber-600">
              The document content may be corrupted. Try refreshing the page.
            </p>
          </div>
        }
      >
        <DocumentEditor
          content={doc.content}
          readOnly={!editMode}
          onChange={handleEditorChange}
          placeholder="Document content will appear here..."
        />
      </ErrorBoundary>
    </div>
  );
}
