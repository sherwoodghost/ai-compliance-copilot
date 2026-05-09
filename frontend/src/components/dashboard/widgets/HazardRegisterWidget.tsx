'use client';

import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, ExternalLink, CheckCircle2, Clock } from 'lucide-react';
import Link from 'next/link';
import { WidgetShell } from './WidgetShell';
import { apiClient } from '@/lib/api/client';
import { cn } from '@/lib/utils';

interface HazardSummary {
  total: number;
  high: number;
  medium: number;
  low: number;
  controlled: number;
  uncontrolled: number;
  overdue: number;
  recentHazards: { id: string; title: string; riskLevel: 'high' | 'medium' | 'low'; status: string }[];
}

async function fetchHazards(): Promise<HazardSummary> {
  try {
    const res = await apiClient.get<HazardSummary>('/iso45001/hazards/summary');
    return res.data;
  } catch {
    return {
      total: 0, high: 0, medium: 0, low: 0,
      controlled: 0, uncontrolled: 0, overdue: 0,
      recentHazards: [],
    };
  }
}

const RISK_COLORS: Record<string, string> = {
  high:   'bg-red-100 text-red-700',
  medium: 'bg-amber-100 text-amber-700',
  low:    'bg-green-100 text-green-700',
};

export function HazardRegisterWidget() {
  const { data, isLoading } = useQuery<HazardSummary>({
    queryKey: ['hazard-register-summary'],
    queryFn:  fetchHazards,
    staleTime: 5 * 60 * 1000,
  });

  const controlledPct = data && data.total > 0
    ? Math.round((data.controlled / data.total) * 100)
    : 0;

  return (
    <WidgetShell title="Hazard Register" color="yellow" isLoading={isLoading}>
      <div className="space-y-4">
        {/* Summary */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: 'Total', value: data?.total ?? 0, cls: 'bg-gray-50 text-gray-700' },
            { label: 'High', value: data?.high ?? 0, cls: 'bg-red-50 text-red-700' },
            { label: 'Medium', value: data?.medium ?? 0, cls: 'bg-amber-50 text-amber-700' },
            { label: 'Low', value: data?.low ?? 0, cls: 'bg-green-50 text-green-700' },
          ].map(({ label, value, cls }) => (
            <div key={label} className={cn('rounded-lg p-2 text-center', cls)}>
              <p className="text-lg font-bold">{value}</p>
              <p className="text-xs">{label}</p>
            </div>
          ))}
        </div>

        {/* Control progress */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-gray-500">Hazards controlled</span>
            <span className="text-xs font-semibold text-green-600">{controlledPct}%</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 rounded-full transition-all duration-500"
              style={{ width: `${controlledPct}%` }}
            />
          </div>
        </div>

        {/* Status row */}
        <div className="flex items-center gap-4 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />{data?.controlled ?? 0} controlled
          </span>
          <span className="flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5 text-red-500" />{data?.uncontrolled ?? 0} uncontrolled
          </span>
          <span className="flex items-center gap-1 ml-auto">
            <Clock className="w-3.5 h-3.5 text-amber-500" />{data?.overdue ?? 0} overdue
          </span>
          <Link href="/iso45001/hazards" className="flex items-center gap-1 text-amber-600 hover:text-amber-800">
            Manage <ExternalLink className="h-3 w-3" />
          </Link>
        </div>
      </div>
    </WidgetShell>
  );
}
