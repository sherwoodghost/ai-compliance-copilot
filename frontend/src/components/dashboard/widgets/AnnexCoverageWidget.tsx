'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { WidgetShell } from './WidgetShell';

interface AnnexDomain {
  label:    string;  // 'A.5', 'A.6', 'A.7', 'A.8'
  name:     string;
  covered:  number;
  total:    number;
}

interface AnnexData {
  domains: AnnexDomain[];
  overall: number;
}

async function fetchAnnexCoverage(): Promise<AnnexData> {
  try {
    const { data } = await apiClient.get('/readiness/breakdown');
    const bd = data?.data ?? data;
    // Map readiness breakdown to annex domains if available
    const domains: AnnexDomain[] = [
      { label: 'A.5', name: 'Organizational', covered: bd?.a5covered ?? 0, total: 38 },
      { label: 'A.6', name: 'People',          covered: bd?.a6covered ?? 0, total: 8  },
      { label: 'A.7', name: 'Physical',        covered: bd?.a7covered ?? 0, total: 14 },
      { label: 'A.8', name: 'Technological',   covered: bd?.a8covered ?? 0, total: 34 },
    ];
    return { domains, overall: bd?.overallScore ?? 0 };
  } catch {
    return {
      overall: 0,
      domains: [
        { label: 'A.5', name: 'Organizational', covered: 0, total: 38 },
        { label: 'A.6', name: 'People',          covered: 0, total: 8  },
        { label: 'A.7', name: 'Physical',        covered: 0, total: 14 },
        { label: 'A.8', name: 'Technological',   covered: 0, total: 34 },
      ],
    };
  }
}

export function AnnexCoverageWidget() {
  const { data, isLoading } = useQuery<AnnexData>({
    queryKey:  ['annex-coverage-widget'],
    queryFn:   fetchAnnexCoverage,
    staleTime: 5 * 60 * 1000,
  });

  return (
    <WidgetShell
      title="Annex A Coverage"
      color="indigo"
      linkHref="/control-library"
      linkLabel="Control library"
      isLoading={isLoading}
    >
      {data && (
        <div className="space-y-2">
          {data.domains.map(d => {
            const pct = Math.round((d.covered / d.total) * 100);
            return (
              <div key={d.label}>
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-xs text-gray-600">
                    <span className="font-mono font-semibold text-indigo-600">{d.label}</span>
                    {' '}{d.name}
                  </span>
                  <span className="text-xs text-gray-500">{d.covered}/{d.total}</span>
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-indigo-400 rounded-full transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </WidgetShell>
  );
}
