'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { WidgetShell } from './WidgetShell';
import { TrendingUp, TrendingDown, Minus, Plus } from 'lucide-react';
import Link from 'next/link';

interface QualityObjective {
  id:              string;
  metric:          string;
  target:          number;
  currentValue:    number | null;
  unit:            string;
  targetDirection: 'above' | 'below' | 'equal';
}

interface QualityObjectivesData {
  objectives: QualityObjective[];
}

async function fetchObjectives(): Promise<QualityObjectivesData> {
  try {
    const { data } = await apiClient.get('/quality/objectives');
    const list = data?.data ?? data;
    return { objectives: Array.isArray(list) ? list : [] };
  } catch {
    return { objectives: [] };
  }
}

function ragClass(obj: QualityObjective): 'green' | 'amber' | 'red' | 'gray' {
  if (obj.currentValue === null) return 'gray';
  const cv = obj.currentValue;
  const t  = obj.target;
  if (obj.targetDirection === 'above') {
    if (cv >= t)           return 'green';
    if (cv >= t * 0.9)     return 'amber';
    return 'red';
  }
  if (obj.targetDirection === 'below') {
    if (cv <= t)           return 'green';
    if (cv <= t * 1.1)     return 'amber';
    return 'red';
  }
  return Math.abs(cv - t) / t <= 0.05 ? 'green' : 'amber';
}

const RAG_STYLES: Record<string, { bg: string; text: string; bar: string }> = {
  green: { bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-700', bar: 'bg-emerald-400' },
  amber: { bg: 'bg-amber-50 border-amber-200',     text: 'text-amber-700',   bar: 'bg-amber-400'   },
  red:   { bg: 'bg-red-50 border-red-200',         text: 'text-red-700',     bar: 'bg-red-400'     },
  gray:  { bg: 'bg-gray-50 border-gray-200',       text: 'text-gray-500',    bar: 'bg-gray-300'    },
};

export function QualityObjectivesWidget() {
  const { data, isLoading } = useQuery<QualityObjectivesData>({
    queryKey:  ['quality-objectives'],
    queryFn:   fetchObjectives,
    staleTime: 10 * 60 * 1000,
  });

  const objectives = data?.objectives ?? [];

  return (
    <WidgetShell
      title="Quality Objectives"
      color="teal"
      linkHref="/iso9001/objectives"
      linkLabel="Manage objectives"
      isLoading={isLoading}
    >
      {objectives.length === 0 ? (
        <div className="flex flex-col items-center py-4 text-center">
          <p className="text-sm font-medium text-gray-700">No quality objectives defined</p>
          <p className="text-xs text-gray-400 mt-1 max-w-xs">
            ISO 9001 Clause 6.2 requires measurable quality objectives. Add your first objective to start tracking.
          </p>
          <Link
            href="/iso9001/objectives"
            className="mt-3 inline-flex items-center gap-1.5 text-xs text-teal-600 font-medium hover:text-teal-800 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Add first objective
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {objectives.slice(0, 4).map(obj => {
            const rag = ragClass(obj);
            const s = RAG_STYLES[rag];
            const pct = obj.currentValue !== null && obj.target !== 0
              ? Math.min(100, Math.round((obj.currentValue / obj.target) * 100))
              : null;

            return (
              <div key={obj.id} className={`rounded-lg border px-3 py-2 ${s.bg}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-gray-700 truncate flex-1 mr-2">{obj.metric}</span>
                  <span className={`text-xs font-bold shrink-0 ${s.text}`}>
                    {obj.currentValue !== null ? `${obj.currentValue}${obj.unit}` : '—'}
                    <span className="text-gray-400 font-normal"> / {obj.target}{obj.unit}</span>
                  </span>
                </div>
                {pct !== null && (
                  <div className="h-1.5 bg-white rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${s.bar}`}
                      style={{ width: `${Math.min(pct, 100)}%` }}
                    />
                  </div>
                )}
              </div>
            );
          })}
          {objectives.length > 4 && (
            <p className="text-xs text-gray-400 text-center">+{objectives.length - 4} more objectives</p>
          )}
        </div>
      )}
    </WidgetShell>
  );
}
