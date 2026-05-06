'use client';

import { useQuery } from '@tanstack/react-query';
import { complianceApi } from '@/lib/api/compliance';
import { formatDate, formatRelative } from '@/lib/utils';
import { FileCheck, AlertTriangle, Clock } from 'lucide-react';

function EvidenceCard({ item }: { item: any }) {
  const isExpired = item.expiresAt && new Date(item.expiresAt) < new Date();
  const expiringSoon = item.expiresAt && !isExpired &&
    new Date(item.expiresAt) < new Date(Date.now() + 30 * 86400_000);

  return (
    <div className="card p-4 flex items-start gap-3">
      <div className={`mt-0.5 w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
        isExpired ? 'bg-danger-50' : expiringSoon ? 'bg-warning-50' : 'bg-success-50'
      }`}>
        {isExpired ? (
          <AlertTriangle className="w-4 h-4 text-danger-600" />
        ) : expiringSoon ? (
          <Clock className="w-4 h-4 text-warning-600" />
        ) : (
          <FileCheck className="w-4 h-4 text-success-600" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium text-gray-900 truncate">{item.title}</p>
          <span className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${
            isExpired
              ? 'bg-danger-50 text-danger-700'
              : item.status === 'valid'
              ? 'bg-success-50 text-success-700'
              : 'bg-gray-100 text-gray-600'
          }`}>
            {isExpired ? 'Expired' : item.status}
          </span>
        </div>
        <p className="text-xs text-gray-500 mt-0.5 truncate">{item.description}</p>
        <div className="flex items-center gap-3 mt-2">
          <span className="text-xs text-gray-400">{item.evidenceType}</span>
          {item.source && (
            <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
              {item.source}
            </span>
          )}
          <span className="text-xs text-gray-400 ml-auto">
            {formatRelative(item.collectedAt ?? item.createdAt)}
          </span>
        </div>
        {item.expiresAt && (
          <p className={`text-xs mt-1 ${isExpired ? 'text-danger-600' : expiringSoon ? 'text-warning-600' : 'text-gray-400'}`}>
            {isExpired ? 'Expired' : 'Expires'} {formatDate(item.expiresAt)}
          </p>
        )}
      </div>
    </div>
  );
}

export default function EvidencePage() {
  const { data, isLoading } = useQuery({
    queryKey: ['evidence'],
    queryFn: () => complianceApi.getEvidence(),
  });

  const { data: expiryReport } = useQuery({
    queryKey: ['evidence-expiry'],
    queryFn: complianceApi.getExpiryReport,
  });

  const evidence: any[] = data ?? [];
  const expiredCount = expiryReport?.expired?.length ?? 0;
  const expiringSoonCount = expiryReport?.expiringSoon?.length ?? 0;

  return (
    <div className="p-8 max-w-6xl">
      <div className="mb-8">
        <h1>Evidence</h1>
        <p className="text-sm text-gray-500 mt-1">
          {evidence.length} items collected
          {expiredCount > 0 && ` · ${expiredCount} expired`}
          {expiringSoonCount > 0 && ` · ${expiringSoonCount} expiring soon`}
        </p>
      </div>

      {/* Expiry alerts */}
      {expiredCount > 0 && (
        <div className="mb-6 rounded-lg bg-danger-50 border border-danger-200 px-4 py-3 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-danger-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-danger-800">{expiredCount} evidence items expired</p>
            <p className="text-xs text-danger-600 mt-0.5">These need to be recollected to maintain compliance.</p>
          </div>
        </div>
      )}

      {/* Evidence grid */}
      {isLoading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-6 h-6 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : evidence.length === 0 ? (
        <div className="card p-12 text-center">
          <FileCheck className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500">No evidence collected yet.</p>
          <p className="text-xs text-gray-400 mt-1">Run an assessment to automatically gather evidence from your integrations.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {evidence.map((item) => (
            <EvidenceCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
