'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { WidgetShell } from './WidgetShell';
import { AlertTriangle, CheckCircle2, Clock, ShieldOff } from 'lucide-react';

interface RiskStats {
  total:      number;
  treated:    number;   // mitigated + accepted
  open:       number;   // identified + assessing + mitigating (untreated)
  critical:   number;
  high:       number;
  accepted:   number;   // explicitly accepted
}

async function fetchRiskStats(): Promise<RiskStats> {
  try {
    const { data } = await apiClient.get('/risks/stats');
    const d = data?.data ?? data;
    return {
      total:    d?.total    ?? 0,
      treated:  d?.treated  ?? d?.mitigated ?? 0,
      open:     d?.open     ?? d?.highRisks ?? 0,
      critical: d?.critical ?? 0,
      high:     d?.high     ?? d?.highRisks ?? 0,
      accepted: d?.accepted ?? 0,
    };
  } catch {
    return { total: 0, treated: 0, open: 0, critical: 0, high: 0, accepted: 0 };
  }
}

export function RiskTreatmentWidget() {
  const { data, isLoading } = useQuery<RiskStats>({
    queryKey:  ['risk-treatment-widget'],
    queryFn:   fetchRiskStats,
    staleTime: 5 * 60 * 1000,
  });

  const treatedPct = data && data.total > 0
    ? Math.round((data.treated / data.total) * 100)
    : null;

  const barColor = treatedPct === null ? 'bg-gray-200'
    : treatedPct >= 80 ? 'bg-emerald-400'
    : treatedPct >= 50 ? 'bg-amber-400'
    : 'bg-red-400';

  return (
    <WidgetShell
      title="Risk Treatment"
      color="indigo"
      linkHref="/risks"
      linkLabel="Risk register"
      isLoading={isLoading}
    >
      {data && (
        <div className="space-y-3">
          {/* Treatment progress bar */}
          {data.total > 0 && (
            <div>
              <div className="flex justify-between text-xs text-gray-500 mb-1.5">
                <span>Treatment progress</span>
                <span className="font-medium text-gray-700">
                  {treatedPct ?? 0}%
                </span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${barColor}`}
                  style={{ width: `${treatedPct ?? 0}%` }}
                />
              </div>
            </div>
          )}

          {/* Risk counts */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-gray-50 rounded-lg px-3 py-2 flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <div>
                <p className="font-semibold text-gray-800">{data.treated}</p>
                <p className="text-gray-400">Treated</p>
              </div>
            </div>
            <div className={`rounded-lg px-3 py-2 flex items-center gap-2 ${data.open > 0 ? 'bg-amber-50' : 'bg-gray-50'}`}>
              <Clock className={`w-3.5 h-3.5 shrink-0 ${data.open > 0 ? 'text-amber-500' : 'text-gray-400'}`} />
              <div>
                <p className={`font-semibold ${data.open > 0 ? 'text-amber-700' : 'text-gray-800'}`}>{data.open}</p>
                <p className="text-gray-400">Open</p>
              </div>
            </div>
          </div>

          {/* Critical/High alerts */}
          {(data.critical > 0 || data.high > 0) && (
            <div className="space-y-1">
              {data.critical > 0 && (
                <div className="flex items-center gap-2 text-xs text-red-600">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>{data.critical} critical risk{data.critical > 1 ? 's' : ''} — immediate action needed</span>
                </div>
              )}
              {data.high > 0 && (
                <div className="flex items-center gap-2 text-xs text-amber-600">
                  <ShieldOff className="w-3.5 h-3.5 shrink-0" />
                  <span>{data.high} high risk{data.high > 1 ? 's' : ''} — treatment required</span>
                </div>
              )}
            </div>
          )}

          {data.total === 0 && (
            <p className="text-sm text-gray-400 text-center py-1">No risks identified yet</p>
          )}

          {data.total > 0 && data.critical === 0 && data.high === 0 && (
            <div className="flex items-center gap-2 text-xs text-emerald-600">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              <span>No critical or high risks open</span>
            </div>
          )}
        </div>
      )}
    </WidgetShell>
  );
}
