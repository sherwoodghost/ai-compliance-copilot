'use client';

import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, ExternalLink, TrendingDown, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import { WidgetShell } from './WidgetShell';
import { apiClient } from '@/lib/api/client';
import { cn } from '@/lib/utils';

interface OhsStats {
  totalIncidents: number;
  lostTimeIncidents: number;
  nearMisses: number;
  trir: number | null;
  ltir: number | null;
  trirTrend: 'improving' | 'stable' | 'worsening';
}

async function fetchOhsStats(): Promise<OhsStats> {
  try {
    const res = await apiClient.get<OhsStats>('/iso45001/incidents/stats');
    return res.data;
  } catch {
    return { totalIncidents: 0, lostTimeIncidents: 0, nearMisses: 0, trir: null, ltir: null, trirTrend: 'stable' };
  }
}

export function OhsIncidentWidget() {
  const { data, isLoading } = useQuery<OhsStats>({
    queryKey: ['ohs-incident-stats'],
    queryFn:  fetchOhsStats,
    staleTime: 5 * 60 * 1000,
  });

  const trir       = data?.trir ?? 0;
  const ltir       = data?.ltir ?? 0;
  const nearMisses = data?.nearMisses ?? 0;
  const total      = data?.totalIncidents ?? 0;
  const trend      = data?.trirTrend ?? 'stable';
  const TrendIcon  = trend === 'improving' ? TrendingDown : trend === 'worsening' ? TrendingUp : AlertTriangle;
  const trendColor = trend === 'improving' ? 'text-green-600' : trend === 'worsening' ? 'text-red-600' : 'text-gray-400';
  const trendLabel = trend === 'improving' ? 'Improving' : trend === 'worsening' ? 'Worsening' : 'Stable';

  return (
    <WidgetShell title="OH&S Incident Tracker" color="yellow" isLoading={isLoading}>
      <div className="space-y-3">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-3xl font-bold text-amber-600">{trir.toFixed(1)}</p>
            <p className="text-xs text-gray-500 mt-0.5">TRIR (Total Recordable Incident Rate)</p>
          </div>
          <Link href="/iso45001/incidents" className="text-xs text-amber-600 hover:text-amber-800 flex items-center gap-1">
            View <ExternalLink className="h-3 w-3" />
          </Link>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Total Incidents', value: total, color: 'bg-gray-50 text-gray-700' },
            { label: 'Lost Time', value: data?.lostTimeIncidents ?? 0, color: 'bg-red-50 text-red-700' },
            { label: 'Near Misses', value: nearMisses, color: 'bg-amber-50 text-amber-700' },
          ].map(({ label, value, color }) => (
            <div key={label} className={cn('rounded-lg p-2 text-center', color)}>
              <p className="text-base font-bold">{value}</p>
              <p className="text-xs leading-tight mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2 text-xs text-gray-500">
          <TrendIcon className={cn('w-3.5 h-3.5', trendColor)} />
          <span>TRIR trend: <span className={cn('font-medium', trendColor)}>{trendLabel}</span></span>
          <span className="ml-auto">LTIR: {ltir.toFixed(2)}</span>
        </div>
      </div>
    </WidgetShell>
  );
}
