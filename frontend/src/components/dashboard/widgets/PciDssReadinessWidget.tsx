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

async function fetchPciReadiness(): Promise<FrameworkReadiness> {
  const res = await apiClient.get<FrameworkReadiness>('/controls/readiness?framework=PCI_DSS');
  return res.data;
}

export function PciDssReadinessWidget() {
  const { data, isLoading } = useQuery<FrameworkReadiness>({
    queryKey: ['pci-dss-readiness-widget'],
    queryFn:  fetchPciReadiness,
    staleTime: 5 * 60 * 1000,
  });

  const score = data?.readinessScore ?? 0;
  const total = data?.totalControls ?? 50;
  const done  = data?.implementedControls ?? 0;

  const scoreColor =
    score >= 80 ? 'text-emerald-600' :
    score >= 50 ? 'text-amber-600'   :
    'text-rose-600';

  const barColor =
    score >= 80 ? 'bg-emerald-500' :
    score >= 50 ? 'bg-amber-500'   :
    'bg-rose-500';

  // PCI DSS v4.0 requirement groups (condensed)
  const reqGroups = [
    { label: 'Network',     reqs: '1–2'  },
    { label: 'Data',        reqs: '3–4'  },
    { label: 'Vuln Mgmt',   reqs: '5–6'  },
    { label: 'Access',      reqs: '7–9'  },
    { label: 'Monitoring',  reqs: '10–11'},
    { label: 'Policy',      reqs: '12'   },
  ];

  return (
    <WidgetShell
      title="PCI DSS Readiness"
      color="amber"
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
            href="/pci-dss"
            className="text-xs text-amber-600 hover:text-amber-800 flex items-center gap-1 transition-colors"
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

        {/* Requirement group chips */}
        <div className="flex flex-wrap gap-1.5">
          {reqGroups.map((g) => (
            <span
              key={g.label}
              title={`Req ${g.reqs}`}
              className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full"
            >
              {g.label}
            </span>
          ))}
        </div>
      </div>
    </WidgetShell>
  );
}
