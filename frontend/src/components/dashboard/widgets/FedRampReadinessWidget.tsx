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

async function fetchFedRampReadiness(): Promise<FrameworkReadiness> {
  const res = await apiClient.get<FrameworkReadiness>('/controls/readiness?framework=FEDRAMP');
  return res.data;
}

export function FedRampReadinessWidget() {
  const { data, isLoading } = useQuery<FrameworkReadiness>({
    queryKey: ['fedramp-readiness-widget'],
    queryFn:  fetchFedRampReadiness,
    staleTime: 5 * 60 * 1000,
  });

  const score = data?.readinessScore ?? 0;
  const total = data?.totalControls ?? 47;
  const done  = data?.implementedControls ?? 0;

  const scoreColor =
    score >= 80 ? 'text-emerald-600' :
    score >= 50 ? 'text-amber-600'   :
    'text-rose-600';

  const barColor =
    score >= 80 ? 'bg-emerald-500' :
    score >= 50 ? 'bg-amber-500'   :
    'bg-rose-500';

  // NIST SP 800-53 family abbreviations for the Moderate baseline
  const families = [
    { label: 'AC', full: 'Access Control'                     },
    { label: 'AU', full: 'Audit & Accountability'             },
    { label: 'CA', full: 'Assessment & Authorization'         },
    { label: 'CM', full: 'Configuration Mgmt'                 },
    { label: 'IA', full: 'Identification & Auth'              },
    { label: 'IR', full: 'Incident Response'                  },
    { label: 'SC', full: 'System & Comms Protection'          },
    { label: 'SI', full: 'System & Info Integrity'            },
  ];

  return (
    <WidgetShell
      title="FedRAMP Readiness"
      color="blue"
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
            href="/fedramp"
            className="text-xs text-sky-600 hover:text-sky-800 flex items-center gap-1 transition-colors"
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

        {/* NIST family chips */}
        <div className="flex flex-wrap gap-1.5">
          {families.map((f) => (
            <span
              key={f.label}
              title={f.full}
              className="text-xs bg-sky-50 text-sky-700 px-2 py-0.5 rounded-full font-mono"
            >
              {f.label}
            </span>
          ))}
        </div>
      </div>
    </WidgetShell>
  );
}
