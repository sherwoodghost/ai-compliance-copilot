'use client';

import { useQuery } from '@tanstack/react-query';
import { ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { WidgetShell } from './WidgetShell';
import { apiClient } from '@/lib/api/client';

interface FrameworkReadiness {
  frameworkType:       string;
  totalControls:       number;
  implementedControls: number;
  readinessScore:      number;
}

async function fetchNistCsfReadiness(): Promise<FrameworkReadiness> {
  const res = await apiClient.get<FrameworkReadiness>('/controls/readiness?framework=NIST_CSF');
  return res.data;
}

export function NistCsfReadinessWidget() {
  const { data, isLoading } = useQuery<FrameworkReadiness>({
    queryKey: ['nist-csf-readiness-widget'],
    queryFn:  fetchNistCsfReadiness,
    staleTime: 5 * 60 * 1000,
  });

  const score = data?.readinessScore ?? 0;
  const total = data?.totalControls ?? 49;
  const done  = data?.implementedControls ?? 0;

  const scoreColor =
    score >= 80 ? 'text-emerald-600' :
    score >= 50 ? 'text-amber-600'   :
    'text-rose-600';

  const barColor =
    score >= 80 ? 'bg-emerald-500' :
    score >= 50 ? 'bg-amber-500'   :
    'bg-rose-500';

  // NIST CSF 2.0 core Function abbreviations
  const functions = [
    { label: 'GV', full: 'Govern'   },
    { label: 'ID', full: 'Identify' },
    { label: 'PR', full: 'Protect'  },
    { label: 'DE', full: 'Detect'   },
    { label: 'RS', full: 'Respond'  },
    { label: 'RC', full: 'Recover'  },
  ];

  return (
    <WidgetShell
      title="NIST CSF Readiness"
      color="orange"
      isLoading={isLoading}
    >
      <div className="space-y-4">
        {/* Score */}
        <div className="flex items-end justify-between">
          <div>
            <p className={`text-3xl font-bold ${scoreColor}`}>{score}%</p>
            <p className="text-xs text-gray-500 mt-0.5">
              {done} / {total} controls addressed
            </p>
          </div>
          <Link
            href="/nist-csf"
            className="text-xs text-orange-600 hover:text-orange-800 flex items-center gap-1 transition-colors"
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

        {/* CSF Function chips */}
        <div className="flex flex-wrap gap-1.5">
          {functions.map((f) => (
            <span
              key={f.label}
              title={f.full}
              className="text-xs bg-orange-50 text-orange-700 px-2 py-0.5 rounded-full font-mono"
            >
              {f.label}
            </span>
          ))}
        </div>
      </div>
    </WidgetShell>
  );
}
