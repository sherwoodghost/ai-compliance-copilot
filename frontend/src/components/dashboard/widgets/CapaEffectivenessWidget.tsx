'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { WidgetShell } from './WidgetShell';
import { TrendingDown, TrendingUp, Minus } from 'lucide-react';

interface CapaMetrics {
  openCapas:          number;
  closedLast90Days:   number;
  recurrenceRate:     number | null;  // 0–100%, null if no data
  avgClosureDays:     number | null;
  overdueCapas:       number;
}

async function fetchCapaMetrics(): Promise<CapaMetrics> {
  try {
    const { data } = await apiClient.get('/quality/capa/metrics');
    return data?.data ?? data;
  } catch {
    return { openCapas: 0, closedLast90Days: 0, recurrenceRate: null, avgClosureDays: null, overdueCapas: 0 };
  }
}

export function CapaEffectivenessWidget() {
  const { data, isLoading } = useQuery<CapaMetrics>({
    queryKey:  ['capa-metrics'],
    queryFn:   fetchCapaMetrics,
    staleTime: 5 * 60 * 1000,
  });

  const rr = data?.recurrenceRate ?? null;
  const rrGood = rr !== null && rr !== undefined && rr <= 10;
  const rrBad  = rr !== null && rr !== undefined && rr > 25;

  return (
    <WidgetShell
      title="CAPA Effectiveness"
      color="teal"
      linkHref="/iso9001/capa"
      linkLabel="View CAPAs"
      isLoading={isLoading}
    >
      {data && (
        <div className="space-y-3">
          {/* Recurrence rate — the key ISO 9001 metric */}
          <div className={`rounded-xl p-3 border ${rrGood ? 'bg-emerald-50 border-emerald-200' : rrBad ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 mb-0.5">Recurrence rate</p>
                <p className={`text-2xl font-bold ${rrGood ? 'text-emerald-700' : rrBad ? 'text-red-700' : 'text-gray-700'}`}>
                  {rr !== null ? `${rr}%` : '—'}
                </p>
              </div>
              <div className={`p-2 rounded-lg ${rrGood ? 'bg-emerald-100' : rrBad ? 'bg-red-100' : 'bg-gray-100'}`}>
                {rrGood ? (
                  <TrendingDown className="w-5 h-5 text-emerald-600" />
                ) : rrBad ? (
                  <TrendingUp className="w-5 h-5 text-red-600" />
                ) : (
                  <Minus className="w-5 h-5 text-gray-400" />
                )}
              </div>
            </div>
            {rr !== null && (
              <p className="text-xs mt-1 text-gray-500">
                {rrGood ? 'Excellent — same root cause rarely recurs' : rrBad ? 'High — root causes are recurring; review CAPA quality' : 'Moderate'}
              </p>
            )}
          </div>

          {/* Secondary metrics */}
          <div className="grid grid-cols-3 gap-2 text-xs text-center">
            <div className="bg-teal-50 border border-teal-100 rounded-lg p-2">
              <p className="text-lg font-bold text-gray-900">{data.openCapas}</p>
              <p className="text-gray-500">Open</p>
            </div>
            <div className="bg-gray-50 border border-gray-100 rounded-lg p-2">
              <p className="text-lg font-bold text-gray-900">{data.closedLast90Days}</p>
              <p className="text-gray-500">Closed (90d)</p>
            </div>
            <div className={`rounded-lg border p-2 ${data.overdueCapas > 0 ? 'bg-amber-50 border-amber-200' : 'bg-gray-50 border-gray-100'}`}>
              <p className={`text-lg font-bold ${data.overdueCapas > 0 ? 'text-amber-600' : 'text-gray-900'}`}>{data.overdueCapas}</p>
              <p className="text-gray-500">Overdue</p>
            </div>
          </div>

          {data.avgClosureDays !== null && (
            <p className="text-xs text-gray-400 text-center">
              Avg. closure time: <span className="font-medium text-gray-600">{data.avgClosureDays} days</span>
            </p>
          )}
        </div>
      )}
    </WidgetShell>
  );
}
