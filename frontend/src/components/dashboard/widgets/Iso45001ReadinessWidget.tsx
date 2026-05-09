'use client';

import { useQuery } from '@tanstack/react-query';
import { ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { WidgetShell } from './WidgetShell';
import { apiClient } from '@/lib/api/client';

interface FrameworkReadiness {
  frameworkType: string;
  totalControls: number;
  implementedControls: number;
  readinessScore: number;
}

async function fetchIso45001Readiness(): Promise<FrameworkReadiness> {
  const res = await apiClient.get<FrameworkReadiness>('/controls/readiness?framework=ISO45001');
  return res.data;
}

export function Iso45001ReadinessWidget() {
  const { data, isLoading } = useQuery<FrameworkReadiness>({
    queryKey: ['iso45001-readiness-widget'],
    queryFn:  fetchIso45001Readiness,
    staleTime: 5 * 60 * 1000,
  });

  const score = data?.readinessScore ?? 0;
  const total = data?.totalControls ?? 37;
  const done  = data?.implementedControls ?? 0;

  const scoreColor =
    score >= 80 ? 'text-emerald-600' :
    score >= 50 ? 'text-amber-600'   :
    'text-rose-600';

  const barColor =
    score >= 80 ? 'bg-emerald-500' :
    score >= 50 ? 'bg-amber-500'   :
    'bg-rose-500';

  return (
    <WidgetShell title="ISO 45001 OHS Readiness" color="yellow" isLoading={isLoading}>
      <div className="space-y-4">
        <div className="flex items-end justify-between">
          <div>
            <p className={`text-3xl font-bold ${scoreColor}`}>{score}%</p>
            <p className="text-xs text-gray-500 mt-0.5">
              {done} / {total} OHSMS controls addressed
            </p>
          </div>
          <Link href="/iso45001" className="text-xs text-amber-600 hover:text-amber-800 flex items-center gap-1 transition-colors">
            View <ExternalLink className="h-3 w-3" />
          </Link>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-2">
          <div className={`${barColor} h-2 rounded-full transition-all duration-500`} style={{ width: `${score}%` }} />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {['Hazards', 'Leadership', 'Operation', 'Incidents', 'Compliance'].map((cat) => (
            <span key={cat} className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full">{cat}</span>
          ))}
        </div>
      </div>
    </WidgetShell>
  );
}
