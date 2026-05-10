'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { documentsApi } from '@/lib/api/documents';
import {
  FileText, Search, Filter, Trash2, Download,
  ChevronRight, Loader2, Plus,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const DOC_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  policy:    { label: 'Policy',    color: 'bg-blue-50 text-blue-700' },
  procedure: { label: 'Procedure', color: 'bg-purple-50 text-purple-700' },
  evidence:  { label: 'Evidence',  color: 'bg-green-50 text-green-700' },
  report:    { label: 'Report',    color: 'bg-amber-50 text-amber-700' },
  template:  { label: 'Template',  color: 'bg-gray-100 text-gray-700' },
  other:     { label: 'Other',     color: 'bg-gray-50 text-gray-500' },
};

const FRAMEWORK_LABELS: Record<string, string> = {
  SOC2: 'SOC 2',
  ISO27001: 'ISO 27001',
  GDPR: 'GDPR',
  ISO9001: 'ISO 9001',
  HIPAA: 'HIPAA',
  PCI_DSS: 'PCI DSS',
  NIST_CSF: 'NIST CSF',
  FedRAMP: 'FedRAMP',
};

function DocTypeBadge({ type }: { type: string }) {
  const config = DOC_TYPE_LABELS[type] ?? DOC_TYPE_LABELS.other;
  return (
    <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', config.color)}>
      {config.label}
    </span>
  );
}

function FrameworkBadges({ frameworks }: { frameworks: string[] }) {
  if (!frameworks?.length) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {frameworks.map((fw) => (
        <span key={fw} className="text-[10px] font-medium px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded">
          {FRAMEWORK_LABELS[fw] ?? fw}
        </span>
      ))}
    </div>
  );
}

export default function DocumentsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [frameworkFilter, setFrameworkFilter] = useState('');
  const [page, setPage] = useState(1);

  const isSearchMode = search.trim().length >= 2;

  const { data, isLoading } = useQuery({
    queryKey: ['documents', search, typeFilter, frameworkFilter, page],
    queryFn: () =>
      isSearchMode
        ? documentsApi.search(search, {
            docType: typeFilter || undefined,
            framework: frameworkFilter || undefined,
            limit: 25,
          })
        : documentsApi.list({
            search: search || undefined,
            docType: typeFilter || undefined,
            framework: frameworkFilter || undefined,
            page,
            limit: 25,
          }),
  });

  const documents = isSearchMode
    ? (data?.results ?? [])
    : (data?.documents ?? data ?? []);
  const totalCount = data?.total ?? documents.length;

  const deleteMutation = useMutation({
    mutationFn: (id: string) => documentsApi.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['documents'] }),
  });

  const handleDownload = async (id: string) => {
    try {
      const result = await documentsApi.getDownloadUrl(id);
      if (result.url) window.open(result.url, '_blank');
    } catch { /* noop */ }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Documents</h1>
          <p className="text-sm text-gray-500 mt-1">
            {totalCount} document{totalCount !== 1 ? 's' : ''} in your library
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search documents..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="input pl-9 w-full"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
          className="input w-36"
        >
          <option value="">All types</option>
          {Object.entries(DOC_TYPE_LABELS).map(([val, { label }]) => (
            <option key={val} value={val}>{label}</option>
          ))}
        </select>
        <select
          value={frameworkFilter}
          onChange={(e) => { setFrameworkFilter(e.target.value); setPage(1); }}
          className="input w-36"
        >
          <option value="">All frameworks</option>
          {Object.entries(FRAMEWORK_LABELS).map(([val, label]) => (
            <option key={val} value={val}>{label}</option>
          ))}
        </select>
      </div>

      {/* Document list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-gray-400">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading documents...
        </div>
      ) : documents.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <FileText className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm font-medium">No documents found</p>
          <p className="text-xs mt-1">Import documents or adjust your filters</p>
        </div>
      ) : (
        <div className="space-y-1">
          {documents.map((doc: any) => (
            <div
              key={doc.id}
              className="flex items-center gap-4 px-4 py-3 bg-white border border-gray-100 rounded-lg hover:shadow-sm transition-shadow group"
            >
              <FileText className="w-5 h-5 text-gray-400 shrink-0" />

              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-medium text-gray-900 truncate">{doc.title}</h3>
                {doc.snippet && (
                  <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{doc.snippet}</p>
                )}
                <div className="flex items-center gap-2 mt-0.5">
                  <FrameworkBadges frameworks={doc.detectedFrameworks} />
                  {doc.controlIds?.length > 0 && (
                    <span className="text-[10px] text-gray-400">
                      {doc.controlIds.length} control{doc.controlIds.length !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              </div>

              <DocTypeBadge type={doc.docType} />

              <span className="text-xs text-gray-400">
                v{doc.version}
              </span>

              <span className="text-xs text-gray-400">
                {new Date(doc.createdAt).toLocaleDateString()}
              </span>

              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {doc.sourceStorageKey && (
                  <button
                    onClick={() => handleDownload(doc.id)}
                    className="p-1.5 rounded hover:bg-gray-100"
                    title="Download original"
                  >
                    <Download className="w-3.5 h-3.5 text-gray-500" />
                  </button>
                )}
                <button
                  onClick={() => {
                    if (window.confirm('Are you sure you want to delete this document?')) {
                      deleteMutation.mutate(doc.id);
                    }
                  }}
                  className="p-1.5 rounded hover:bg-red-50"
                  title="Delete"
                >
                  <Trash2 className="w-3.5 h-3.5 text-gray-400 hover:text-red-500" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalCount > 25 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="btn-secondary text-sm py-1 px-3"
          >
            Previous
          </button>
          <span className="text-sm text-gray-500">Page {page}</span>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={documents.length < 25}
            className="btn-secondary text-sm py-1 px-3"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
