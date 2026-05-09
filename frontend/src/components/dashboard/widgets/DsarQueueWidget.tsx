'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { WidgetShell } from './WidgetShell';
import { Clock, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface DsarMetrics {
  open:     number;
  overdue:  number;
  dueThisWeek: number;
  avgResponseDays: number | null;
}

async function fetchDsarMetrics(): Promise<DsarMetrics> {
  try {
    const { data } = await apiClient.get('/gdpr/dsar/metrics');
    return data?.data ?? data;
  } catch {
    return { open: 0, overdue: 0, dueThisWeek: 0, avgResponseDays: null };
  }
}

export function DsarQueueWidget() {
  const { data, isLoading } = useQuery<DsarMetrics>({
    queryKey:  ['dsar-metrics'],
    queryFn:   fetchDsarMetrics,
    staleTime: 2 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });

  return (
    <WidgetShell
      title="DSAR Queue"
      color="violet"
      linkHref="/gdpr/dsar"
      linkLabel="Manage requests"
      isLoading={isLoading}
    >
      {data && (
        <div className="space-y-3">
          {/* Stat row */}
          <div className="grid grid-cols-3 gap-2">
            <div className="text-center p-2 rounded-lg bg-violet-50 border border-violet-100">
              <p className="text-xl font-bold text-gray-900">{data.open}</p>
              <p className="text-xs text-gray-500 mt-0.5">Open</p>
            </div>
            <div className={`text-center p-2 rounded-lg border ${data.overdue > 0 ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-100'}`}>
              <p className={`text-xl font-bold ${data.overdue > 0 ? 'text-red-600' : 'text-gray-900'}`}>{data.overdue}</p>
              <p className="text-xs text-gray-500 mt-0.5">Overdue</p>
            </div>
            <div className={`text-center p-2 rounded-lg border ${data.dueThisWeek > 0 ? 'bg-amber-50 border-amber-200' : 'bg-gray-50 border-gray-100'}`}>
              <p className={`text-xl font-bold ${data.dueThisWeek > 0 ? 'text-amber-600' : 'text-gray-900'}`}>{data.dueThisWeek}</p>
              <p className="text-xs text-gray-500 mt-0.5">Due this week</p>
            </div>
          </div>

          {/* SLA reminder */}
          <div className="flex items-start gap-2 text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
            <Clock className="w-3.5 h-3.5 mt-0.5 shrink-0 text-violet-400" />
            <span>GDPR Art. 12 — respond within <strong>30 days</strong> of receipt</span>
          </div>

          {/* Status indicator */}
          {data.overdue > 0 ? (
            <div className="flex items-center gap-2 text-xs text-red-600 font-medium">
              <AlertTriangle className="w-3.5 h-3.5" />
              {data.overdue} request{data.overdue !== 1 ? 's' : ''} past the 30-day deadline
            </div>
          ) : data.open === 0 ? (
            <div className="flex items-center gap-2 text-xs text-emerald-600 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5" />
              No open requests — queue is clear
            </div>
          ) : null}
        </div>
      )}
    </WidgetShell>
  );
}
