'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { WidgetShell } from './WidgetShell';
import { CheckCircle2, AlertCircle } from 'lucide-react';

interface RopaMetrics {
  total:        number;
  complete:     number;
  missingDpa:   number;
  reviewDue:    number;
}

async function fetchRopaMetrics(): Promise<RopaMetrics> {
  try {
    const { data } = await apiClient.get('/gdpr/ropa/metrics');
    return data?.data ?? data;
  } catch {
    return { total: 0, complete: 0, missingDpa: 0, reviewDue: 0 };
  }
}

export function RopaCoverageWidget() {
  const { data, isLoading } = useQuery<RopaMetrics>({
    queryKey:  ['ropa-metrics'],
    queryFn:   fetchRopaMetrics,
    staleTime: 5 * 60 * 1000,
  });

  const pct = data && data.total > 0
    ? Math.round((data.complete / data.total) * 100)
    : null;

  return (
    <WidgetShell
      title="ROPA Coverage"
      color="violet"
      linkHref="/gdpr/ropa"
      linkLabel="View register"
      isLoading={isLoading}
    >
      {data && (
        <div className="space-y-3">
          {data.total === 0 ? (
            <div className="flex flex-col items-center py-4 text-center">
              <AlertCircle className="w-8 h-8 text-violet-200 mb-2" />
              <p className="text-sm font-medium text-gray-700">No processing activities recorded</p>
              <p className="text-xs text-gray-400 mt-1">
                GDPR Art. 30 requires a Record of Processing Activities
              </p>
            </div>
          ) : (
            <>
              {/* Coverage bar */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs text-gray-500">Complete records</span>
                  <span className="text-xs font-semibold text-gray-700">{pct}%</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-violet-500 rounded-full transition-all"
                    style={{ width: `${pct ?? 0}%` }}
                  />
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-violet-50 rounded-lg px-3 py-2 border border-violet-100">
                  <p className="text-lg font-bold text-gray-900">{data.total}</p>
                  <p className="text-gray-500">Processing activities</p>
                </div>
                <div className={`rounded-lg px-3 py-2 border ${data.missingDpa > 0 ? 'bg-amber-50 border-amber-200' : 'bg-gray-50 border-gray-100'}`}>
                  <p className={`text-lg font-bold ${data.missingDpa > 0 ? 'text-amber-600' : 'text-gray-900'}`}>{data.missingDpa}</p>
                  <p className="text-gray-500">Missing DPA</p>
                </div>
              </div>

              {pct === 100 && (
                <div className="flex items-center gap-2 text-xs text-emerald-600 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  All processing activities fully documented
                </div>
              )}
            </>
          )}
        </div>
      )}
    </WidgetShell>
  );
}
