'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { WidgetShell } from './WidgetShell';
import { ShieldCheck } from 'lucide-react';

interface ReadinessData {
  score:  number;
  label:  string;
  trend?: number;
}

async function fetchReadiness(): Promise<ReadinessData> {
  try {
    const { data } = await apiClient.get('/readiness/score');
    const d = data?.data ?? data;
    const score = d?.overallScore ?? d?.score ?? 0;
    const label = score >= 85 ? 'Audit Ready' : score >= 70 ? 'Near Ready' : score >= 40 ? 'In Progress' : 'Early Stage';
    return { score, label };
  } catch {
    return { score: 0, label: 'Early Stage' };
  }
}

export function Soc2ReadinessWidget() {
  const { data, isLoading } = useQuery<ReadinessData>({
    queryKey:  ['soc2-readiness-widget'],
    queryFn:   fetchReadiness,
    staleTime: 5 * 60 * 1000,
  });

  const score = data?.score ?? 0;
  const circumference = 2 * Math.PI * 36;
  const offset = circumference - (score / 100) * circumference;
  const colorClass = score >= 85 ? 'text-emerald-500' : score >= 70 ? 'text-amber-500' : 'text-red-500';
  const strokeColor = score >= 85 ? '#10b981' : score >= 70 ? '#f59e0b' : '#ef4444';

  return (
    <WidgetShell
      title="SOC 2 Readiness"
      color="emerald"
      linkHref="/readiness"
      linkLabel="Full report"
      isLoading={isLoading}
    >
      {data && (
        <div className="flex items-center gap-4">
          {/* Gauge */}
          <div className="relative w-20 h-20 shrink-0">
            <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
              <circle cx="40" cy="40" r="36" fill="none" stroke="#f3f4f6" strokeWidth="7" />
              <circle
                cx="40" cy="40" r="36"
                fill="none"
                stroke={strokeColor}
                strokeWidth="7"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                className="transition-all duration-700"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={`text-xl font-bold ${colorClass}`}>{score}</span>
              <span className="text-xs text-gray-400">/ 100</span>
            </div>
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-800">{data.label}</p>
            <p className="text-xs text-gray-500 mt-1">Overall readiness score</p>
            <div className="flex items-center gap-1.5 mt-2">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
              <span className="text-xs text-gray-500">SOC 2 Type II</span>
            </div>
          </div>
        </div>
      )}
    </WidgetShell>
  );
}
