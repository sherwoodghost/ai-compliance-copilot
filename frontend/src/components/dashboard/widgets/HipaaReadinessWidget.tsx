'use client';

import { useQuery } from '@tanstack/react-query';
import { ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { WidgetShell } from './WidgetShell';
import { apiClient } from '@/lib/api/client';

interface FrameworkReadiness {
  frameworkType: string;
  totalControls:     number;
  implementedControls: number;
  readinessScore:    number;
}

async function fetchHipaaReadiness(): Promise<FrameworkReadiness> {
  const res = await apiClient.get<FrameworkReadiness>('/controls/readiness?framework=HIPAA');
  return res.data;
}

export function HipaaReadinessWidget() {
  const { data, isLoading } = useQuery<FrameworkReadiness>({
    queryKey: ['hipaa-readiness-widget'],
    queryFn:  fetchHipaaReadiness,
    staleTime: 5 * 60 * 1000,
  });

  const score    = data?.readinessScore ?? 0;
  const total    = data?.totalControls ?? 45;
  const done     = data?.implementedControls ?? 0;

  const scoreColor =
    score >= 80 ? 'text-emerald-600' :
    score >= 50 ? 'text-amber-600'   :
    'text-rose-600';

  const barColor =
    score >= 80 ? 'bg-emerald-500' :
    score >= 50 ? 'bg-amber-500'   :
    'bg-rose-500';

  return (
    <WidgetShell
      title="HIPAA Readiness"
      color="red"
      isLoading={isLoading}
    >
      <div className="space-y-4">
        {/* Score */}
        <div className="flex items-end justify-between">
          <div>
            <p className={`text-3xl font-bold ${scoreColor}`}>{score}%</p>
            <p className="text-xs text-gray-500 mt-0.5">
              {done} / {total} safeguards addressed
            </p>
          </div>
          <Link
            href="/hipaa"
            className="text-xs text-rose-600 hover:text-rose-800 flex items-center gap-1 transition-colors"
          >
            View <ExternalLink className="h-3 w-3" />
          </Link>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-gray-100 rounded-full h-2">
          <div
            className={`${barColor} h-2 rounded-full transition-all duration-500`}
            style={{ width: `${score}%` }}
          />
        </div>

        {/* Category chips */}
        <div className="flex flex-wrap gap-1.5">
          {['Admin', 'Physical', 'Technical', 'Org'].map((cat) => (
            <span
              key={cat}
              className="text-xs bg-rose-50 text-rose-700 px-2 py-0.5 rounded-full"
            >
              {cat}
            </span>
          ))}
        </div>
      </div>
    </WidgetShell>
  );
}
