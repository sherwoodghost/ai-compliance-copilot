'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { WidgetShell } from './WidgetShell';
import { Siren, CheckCircle2, Clock, AlertTriangle } from 'lucide-react';
import { formatDistanceToNow, differenceInHours } from 'date-fns';

interface ActiveBreach {
  id:          string;
  title:       string;
  detectedAt:  string;
  deadlineAt:  string;
  status:      string;
}

interface BreachMetrics {
  activeBreaches:   ActiveBreach[];
  totalThisYear:    number;
  notifiedOnTime:   number;
}

async function fetchBreachMetrics(): Promise<BreachMetrics> {
  try {
    const { data } = await apiClient.get('/gdpr/breach/metrics');
    return data?.data ?? data;
  } catch {
    return { activeBreaches: [], totalThisYear: 0, notifiedOnTime: 0 };
  }
}

function BreachCountdown({ deadlineAt }: { deadlineAt: string }) {
  const deadline = new Date(deadlineAt);
  const hoursLeft = differenceInHours(deadline, new Date());
  const isOverdue = hoursLeft < 0;
  const isCritical = hoursLeft >= 0 && hoursLeft < 24;

  const colorClass = isOverdue
    ? 'text-red-600 bg-red-50 border-red-200'
    : isCritical
    ? 'text-amber-600 bg-amber-50 border-amber-200'
    : 'text-gray-700 bg-gray-50 border-gray-200';

  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium ${colorClass}`}>
      <Clock className="w-3.5 h-3.5 shrink-0" />
      {isOverdue ? (
        <span>Notification overdue by {Math.abs(hoursLeft)}h</span>
      ) : (
        <span>{hoursLeft}h remaining to notify supervisory authority</span>
      )}
    </div>
  );
}

export function BreachClockWidget() {
  const { data, isLoading } = useQuery<BreachMetrics>({
    queryKey:  ['breach-metrics'],
    queryFn:   fetchBreachMetrics,
    staleTime: 60 * 1000,          // 1 min — critical data
    refetchInterval: 2 * 60 * 1000,
  });

  const hasActiveBreaches = (data?.activeBreaches?.length ?? 0) > 0;

  return (
    <WidgetShell
      title="Breach Notification Clock"
      color={hasActiveBreaches ? 'red' : 'violet'}
      linkHref="/gdpr/breach-log"
      linkLabel="View breach log"
      isLoading={isLoading}
    >
      {data && (
        <div className="space-y-4">
          {hasActiveBreaches ? (
            <>
              <div className="flex items-center gap-2 text-sm font-semibold text-red-600">
                <Siren className="w-4 h-4 animate-pulse" />
                {data.activeBreaches.length} active breach{data.activeBreaches.length !== 1 ? 'es' : ''} — 72h clock running
              </div>
              <div className="space-y-2">
                {data.activeBreaches.slice(0, 3).map(breach => (
                  <div key={breach.id} className="space-y-1.5">
                    <p className="text-xs font-medium text-gray-700 truncate">{breach.title}</p>
                    <BreachCountdown deadlineAt={breach.deadlineAt} />
                    <p className="text-xs text-gray-400">
                      Detected {formatDistanceToNow(new Date(breach.detectedAt), { addSuffix: true })}
                    </p>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center py-3 text-center">
              <CheckCircle2 className="w-8 h-8 text-emerald-300 mb-2" />
              <p className="text-sm font-medium text-gray-700">No active breaches</p>
              <p className="text-xs text-gray-400 mt-1">72h notification clock not running</p>
            </div>
          )}

          {/* Historical stats */}
          {data.totalThisYear > 0 && (
            <div className="pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
              <span>{data.totalThisYear} breaches this year</span>
              <span className="font-medium text-gray-700">
                {data.notifiedOnTime}/{data.totalThisYear} notified on time
              </span>
            </div>
          )}

          {/* GDPR Art reference */}
          <div className="flex items-start gap-2 text-xs text-gray-400 bg-gray-50 rounded-lg px-3 py-2">
            <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
            GDPR Art. 33 — notify supervisory authority within <strong className="text-gray-600 ml-1">72 hours</strong>
          </div>
        </div>
      )}
    </WidgetShell>
  );
}
