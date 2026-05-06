'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { complianceApi } from '@/lib/api/compliance';
import { formatDate } from '@/lib/utils';
import { FileText, Check, Archive, ChevronRight } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

const STATUS_BADGE: Record<string, string> = {
  draft: 'badge-pending',
  approved: 'badge-passed',
  archived: 'bg-gray-100 text-gray-400 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
};

function PolicyRow({ policy, onSelect }: { policy: any; onSelect: () => void }) {
  return (
    <button
      className="w-full text-left card p-4 hover:border-brand-300 transition-colors flex items-start gap-3"
      onClick={onSelect}
    >
      <div className="w-8 h-8 rounded-lg bg-brand-50 flex items-center justify-center shrink-0 mt-0.5">
        <FileText className="w-4 h-4 text-brand-600" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-gray-900 truncate">{policy.title}</p>
          <span className={STATUS_BADGE[policy.status] ?? STATUS_BADGE.draft}>
            {policy.status}
          </span>
        </div>
        <p className="text-xs text-gray-400 mt-1">
          v{policy.version} · Updated {formatDate(policy.updatedAt)}
        </p>
      </div>
      <ChevronRight className="w-4 h-4 text-gray-300 mt-1 shrink-0" />
    </button>
  );
}

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

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative ml-auto w-full max-w-2xl bg-white h-full flex flex-col shadow-2xl">
        <div className="flex items-start justify-between px-6 py-5 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{policy.title}</h2>
            <p className="text-xs text-gray-400 mt-0.5">v{policy.version} · {policy.status}</p>
          </div>
          <div className="flex items-center gap-2">
            {policy.status === 'draft' && (
              <button
                className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1.5"
                onClick={() => approve.mutate()}
                disabled={approve.isPending}
              >
                <Check className="w-3 h-3" /> Approve
              </button>
            )}
            {policy.status !== 'archived' && (
              <button
                className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5"
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
        <div className="flex-1 overflow-y-auto px-6 py-6">
          <div className="prose prose-sm max-w-none text-gray-800">
            <ReactMarkdown>{policy.content ?? '_No content_'}</ReactMarkdown>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PoliciesPage() {
  const [selected, setSelected] = useState<any>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['policies'],
    queryFn: complianceApi.getPolicies,
  });

  const policies: any[] = data ?? [];

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-8">
        <h1>Policies</h1>
        <p className="text-sm text-gray-500 mt-1">
          {policies.filter((p) => p.status === 'approved').length} approved · {policies.filter((p) => p.status === 'draft').length} drafts
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-6 h-6 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : policies.length === 0 ? (
        <div className="card p-12 text-center">
          <FileText className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500">No policies generated yet.</p>
          <p className="text-xs text-gray-400 mt-1">Run an assessment — the Policy agent creates tailored policies for your stack.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {policies.map((p) => (
            <PolicyRow key={p.id} policy={p} onSelect={() => setSelected(p)} />
          ))}
        </div>
      )}

      {selected && <PolicyDetail policy={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
