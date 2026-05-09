'use client';

import { useQuery } from '@tanstack/react-query';
import { Leaf, ExternalLink, Zap, Droplets, Trash2, Globe } from 'lucide-react';
import Link from 'next/link';
import { WidgetShell } from './WidgetShell';
import { apiClient } from '@/lib/api/client';

interface AspectsData {
  total: number;
  significant: number;
  mitigated: number;
  categories: { name: string; count: number; significant: number }[];
}

async function fetchAspects(): Promise<AspectsData> {
  try {
    const res = await apiClient.get<AspectsData>('/iso14001/aspects/summary');
    return res.data;
  } catch {
    // Return sensible defaults when the endpoint doesn't exist yet
    return { total: 0, significant: 0, mitigated: 0, categories: [] };
  }
}

const ASPECT_ICONS: Record<string, React.ElementType> = {
  Energy: Zap,
  Water: Droplets,
  Waste: Trash2,
  Emissions: Globe,
};

export function EnvAspectsWidget() {
  const { data, isLoading } = useQuery<AspectsData>({
    queryKey: ['env-aspects-summary'],
    queryFn:  fetchAspects,
    staleTime: 5 * 60 * 1000,
  });

  const categories = data?.categories?.length
    ? data.categories
    : [
        { name: 'Energy',    count: 0, significant: 0 },
        { name: 'Water',     count: 0, significant: 0 },
        { name: 'Waste',     count: 0, significant: 0 },
        { name: 'Emissions', count: 0, significant: 0 },
      ];

  const mitigatedPct = data && data.significant > 0
    ? Math.round((data.mitigated / data.significant) * 100)
    : 0;

  return (
    <WidgetShell title="Environmental Aspects" color="green" isLoading={isLoading}>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-3xl font-bold text-green-600">{data?.total ?? 0}</p>
            <p className="text-xs text-gray-500 mt-0.5">
              {data?.significant ?? 0} significant aspects • {mitigatedPct}% mitigated
            </p>
          </div>
          <Link href="/iso14001/aspects" className="text-xs text-green-600 hover:text-green-800 flex items-center gap-1">
            Manage <ExternalLink className="h-3 w-3" />
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {categories.slice(0, 4).map(({ name, count, significant }) => {
            const Icon = ASPECT_ICONS[name] ?? Leaf;
            return (
              <div key={name} className="flex items-center gap-2 bg-green-50 rounded-lg px-3 py-2">
                <Icon className="w-3.5 h-3.5 text-green-600 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-medium text-gray-700 truncate">{name}</p>
                  <p className="text-xs text-gray-400">{count} aspects</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </WidgetShell>
  );
}
