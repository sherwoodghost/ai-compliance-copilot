'use client';

import { useQuery } from '@tanstack/react-query';
import { TrendingUp, TrendingDown, Minus, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { WidgetShell } from './WidgetShell';
import { apiClient } from '@/lib/api/client';
import { cn } from '@/lib/utils';

interface EnvObjective {
  id: string;
  metric: string;
  target: string;
  unit: string;
  currentValue: number | null;
  targetValue: number;
  trend: 'improving' | 'stable' | 'worsening';
  onTrack: boolean;
}

async function fetchObjectives(): Promise<EnvObjective[]> {
  try {
    const res = await apiClient.get<EnvObjective[]>('/iso14001/objectives');
    return res.data ?? [];
  } catch {
    return [];
  }
}

const SAMPLE_OBJECTIVES: EnvObjective[] = [
  { id: '1', metric: 'GHG Emissions', target: '-20% by 2026', unit: 'tCO₂e', currentValue: null, targetValue: 20, trend: 'stable', onTrack: true },
  { id: '2', metric: 'Energy Intensity', target: '-15% by 2026', unit: 'kWh/employee', currentValue: null, targetValue: 15, trend: 'improving', onTrack: true },
  { id: '3', metric: 'Waste Diversion', target: '>80%', unit: '%', currentValue: null, targetValue: 80, trend: 'improving', onTrack: false },
  { id: '4', metric: 'Water Consumption', target: '-10% by 2026', unit: 'm³', currentValue: null, targetValue: 10, trend: 'stable', onTrack: true },
];

export function EnvObjectivesWidget() {
  const { data, isLoading } = useQuery<EnvObjective[]>({
    queryKey: ['env-objectives'],
    queryFn:  fetchObjectives,
    staleTime: 5 * 60 * 1000,
  });

  const objectives = (data && data.length > 0) ? data : SAMPLE_OBJECTIVES;
  const onTrack = objectives.filter(o => o.onTrack).length;

  return (
    <WidgetShell title="Environmental Objectives" color="green" isLoading={isLoading}>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            <span className="text-green-600 font-semibold">{onTrack}</span> of {objectives.length} objectives on track
          </p>
          <Link href="/iso14001/objectives" className="text-xs text-green-600 hover:text-green-800 flex items-center gap-1">
            View all <ExternalLink className="h-3 w-3" />
          </Link>
        </div>
        <div className="divide-y divide-gray-50">
          {objectives.map((obj) => {
            const TrendIcon = obj.trend === 'improving' ? TrendingUp : obj.trend === 'worsening' ? TrendingDown : Minus;
            const trendColor = obj.trend === 'improving' ? 'text-green-500' : obj.trend === 'worsening' ? 'text-red-500' : 'text-gray-400';
            return (
              <div key={obj.id} className="flex items-center gap-3 py-2.5">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{obj.metric}</p>
                  <p className="text-xs text-gray-400">{obj.target}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <TrendIcon className={cn('w-3.5 h-3.5', trendColor)} />
                  <span className={cn('text-xs font-medium px-1.5 py-0.5 rounded-full', obj.onTrack ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700')}>
                    {obj.onTrack ? 'On Track' : 'At Risk'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </WidgetShell>
  );
}
