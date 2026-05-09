'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { WidgetShell } from './WidgetShell';
import { CheckCircle2, AlertTriangle, Clock } from 'lucide-react';

interface EvidenceStats {
  total:    number;
  fresh:    number;
  expiring: number;  // within 30 days
  expired:  number;
}

async function fetchEvidenceStats(): Promise<EvidenceStats> {
  try {
    const { data } = await apiClient.get('/evidence/stats');
    return data?.data ?? data;
  } catch {
    return { total: 0, fresh: 0, expiring: 0, expired: 0 };
  }
}

export function EvidenceFreshnessWidget() {
  const { data, isLoading } = useQuery<EvidenceStats>({
    queryKey:  ['evidence-freshness-widget'],
    queryFn:   fetchEvidenceStats,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 10 * 60 * 1000,
  });

  const freshPct = data && data.total > 0 ? Math.round((data.fresh / data.total) * 100) : null;

  return (
    <WidgetShell
      title="Evidence Freshness"
      color="emerald"
      linkHref="/evidence"
      linkLabel="View evidence"
      isLoading={isLoading}
    >
      {data && (
        <div className="space-y-3">
          {data.total === 0 ? (
            <p className="text-sm text-gray-500">No evidence collected yet</p>
          ) : (
            <>
              {/* Progress bar */}
              <div>
                <div className="flex justify-between text-xs text-gray-500 mb-1.5">
                  <span>Fresh evidence</span>
                  <span className="font-medium text-gray-700">{freshPct}%</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-400 rounded-full transition-all"
                    style={{ width: `${freshPct ?? 0}%` }}
                  />
                </div>
              </div>

              {/* Status items */}
              <div className="space-y-1">
                {data.expired > 0 && (
                  <div className="flex items-center gap-2 text-xs text-red-600">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>{data.expired} expired — needs renewal</span>
                  </div>
                )}
                {data.expiring > 0 && (
                  <div className="flex items-center gap-2 text-xs text-amber-600">
                    <Clock className="w-3.5 h-3.5 shrink-0" />
                    <span>{data.expiring} expiring within 30 days</span>
                  </div>
                )}
                {data.expired === 0 && data.expiring === 0 && (
                  <div className="flex items-center gap-2 text-xs text-emerald-600">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    <span>All evidence current</span>
                  </div>
                )}
              </div>

              <p className="text-xs text-gray-400">{data.total} total evidence items</p>
            </>
          )}
        </div>
      )}
    </WidgetShell>
  );
}
