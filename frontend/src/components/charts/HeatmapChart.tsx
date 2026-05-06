'use client';

import { cn } from '@/lib/utils';

interface HeatmapItem {
  category: string;
  total: number;
  implemented: number;
}

interface HeatmapChartProps {
  data: HeatmapItem[];
}

function completionColor(pct: number): string {
  if (pct >= 80) return 'bg-success-500';
  if (pct >= 60) return 'bg-success-300';
  if (pct >= 40) return 'bg-warning-400';
  if (pct >= 20) return 'bg-warning-200';
  return 'bg-danger-200';
}

export function HeatmapChart({ data }: HeatmapChartProps) {
  if (!data || data.length === 0) return null;

  return (
    <div className="space-y-2">
      {data.map((item) => {
        const pct = item.total > 0 ? Math.round((item.implemented / item.total) * 100) : 0;
        return (
          <div key={item.category} className="flex items-center gap-3">
            <div className="w-36 text-xs text-gray-500 truncate shrink-0">{item.category}</div>
            <div className="flex-1 h-5 bg-gray-100 rounded overflow-hidden">
              <div
                className={cn('h-full rounded transition-all duration-500', completionColor(pct))}
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="w-10 text-right text-xs font-medium text-gray-600 shrink-0">{pct}%</div>
          </div>
        );
      })}
    </div>
  );
}
