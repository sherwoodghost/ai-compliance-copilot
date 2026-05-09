'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { WidgetShell } from './WidgetShell';
import { CheckCircle2 } from 'lucide-react';

interface NcrBucket {
  label:   string;  // '0–30 days', '31–60 days', '60+ days'
  count:   number;
  color:   string;  // tailwind bg class
}

interface NcrMetrics {
  open:      number;
  overdue:   number;  // open for >60 days
  buckets:   NcrBucket[];
  majorOpen: number;
}

async function fetchNcrMetrics(): Promise<NcrMetrics> {
  try {
    const { data } = await apiClient.get('/quality/ncr/metrics');
    return data?.data ?? data;
  } catch {
    return {
      open: 0, overdue: 0, majorOpen: 0,
      buckets: [
        { label: '0–30 days',  count: 0, color: 'bg-teal-400'   },
        { label: '31–60 days', count: 0, color: 'bg-amber-400'  },
        { label: '60+ days',   count: 0, color: 'bg-red-400'    },
      ],
    };
  }
}

export function NcrAgingWidget() {
  const { data, isLoading } = useQuery<NcrMetrics>({
    queryKey:  ['ncr-metrics'],
    queryFn:   fetchNcrMetrics,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 10 * 60 * 1000,
  });

  const maxCount = data ? Math.max(...data.buckets.map(b => b.count), 1) : 1;

  return (
    <WidgetShell
      title="NCR Aging"
      color="teal"
      linkHref="/iso9001/ncr"
      linkLabel="View NCRs"
      isLoading={isLoading}
    >
      {data && (
        <div className="space-y-3">
          {/* Summary */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-teal-50 border border-teal-100 rounded-lg p-2 text-center">
              <p className="text-xl font-bold text-gray-900">{data.open}</p>
              <p className="text-xs text-gray-500">Open NCRs</p>
            </div>
            <div className={`rounded-lg p-2 text-center border ${data.majorOpen > 0 ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-100'}`}>
              <p className={`text-xl font-bold ${data.majorOpen > 0 ? 'text-red-600' : 'text-gray-900'}`}>{data.majorOpen}</p>
              <p className="text-xs text-gray-500">Major NCRs</p>
            </div>
          </div>

          {/* Aging bars */}
          {data.open > 0 ? (
            <div className="space-y-2">
              <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Age distribution</p>
              {data.buckets.map(bucket => (
                <div key={bucket.label} className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 w-20 shrink-0">{bucket.label}</span>
                  <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${bucket.color}`}
                      style={{ width: `${Math.round((bucket.count / maxCount) * 100)}%` }}
                    />
                  </div>
                  <span className="text-xs font-medium text-gray-700 w-4 text-right">{bucket.count}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs text-emerald-600 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5" />
              No open nonconformities
            </div>
          )}
        </div>
      )}
    </WidgetShell>
  );
}
