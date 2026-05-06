'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { complianceApi } from '@/lib/api/compliance';
import { HeatmapChart } from '@/components/charts/HeatmapChart';
import { CheckCircle, XCircle, AlertCircle, Clock, BarChart2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const STATUS_CONFIG = {
  implemented: { label: 'Implemented', icon: CheckCircle, cls: 'badge-passed' },
  partial: { label: 'Partial', icon: AlertCircle, cls: 'badge-partial' },
  not_implemented: { label: 'Not implemented', icon: XCircle, cls: 'badge-failed' },
  not_applicable: { label: 'N/A', icon: Clock, cls: 'badge-pending' },
} as const;

type Status = keyof typeof STATUS_CONFIG;

function ControlRow({ control }: { control: any }) {
  const status = (control.status ?? 'not_implemented') as Status;
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.not_implemented;
  const Icon = cfg.icon;

  return (
    <tr className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
      <td className="px-4 py-3 text-xs font-mono text-gray-500 whitespace-nowrap">
        {control.control?.code}
      </td>
      <td className="px-4 py-3">
        <p className="text-sm font-medium text-gray-900 line-clamp-1">{control.control?.name}</p>
        <p className="text-xs text-gray-400 line-clamp-1 mt-0.5">{control.control?.category}</p>
      </td>
      <td className="px-4 py-3">
        <span className={cfg.cls}>
          <Icon className="w-3 h-3 mr-1" />
          {cfg.label}
        </span>
      </td>
      <td className="px-4 py-3 text-sm text-gray-700">
        {control.score != null ? `${control.score}%` : '—'}
      </td>
      <td className="px-4 py-3 text-xs text-gray-500">
        {control.assignedTo?.fullName ?? '—'}
      </td>
    </tr>
  );
}

export default function ControlsPage() {
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['controls', status],
    queryFn: () => complianceApi.getControls(status ? { status } : undefined),
  });

  const { data: stats } = useQuery({
    queryKey: ['control-stats'],
    queryFn: complianceApi.getControlStats,
  });

  const { data: heatmap } = useQuery({
    queryKey: ['control-heatmap'],
    queryFn: complianceApi.getControlHeatmap,
  });

  const [showHeatmap, setShowHeatmap] = useState(false);

  const controls: any[] = data ?? [];
  const filtered = search
    ? controls.filter(
        (c) =>
          c.control?.name?.toLowerCase().includes(search.toLowerCase()) ||
          c.control?.code?.toLowerCase().includes(search.toLowerCase()),
      )
    : controls;

  return (
    <div className="p-8 max-w-6xl">
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1>Controls</h1>
          <p className="text-sm text-gray-500 mt-1">
            {stats?.implemented ?? 0} implemented · {stats?.partial ?? 0} partial · {stats?.not_implemented ?? 0} gaps
          </p>
        </div>
        <button
          className="btn-secondary flex items-center gap-2"
          onClick={() => setShowHeatmap((v) => !v)}
        >
          <BarChart2 className="w-4 h-4" />
          {showHeatmap ? 'Hide' : 'Show'} heatmap
        </button>
      </div>

      {showHeatmap && heatmap && (
        <div className="card p-5 mb-6">
          <p className="text-sm font-semibold text-gray-700 mb-4">Category completion</p>
          <HeatmapChart data={heatmap} />
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3 mb-6">
        <input
          type="search"
          className="input max-w-xs"
          placeholder="Search controls…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="input w-44"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">All statuses</option>
          {Object.entries(STATUS_CONFIG).map(([val, { label }]) => (
            <option key={val} value={val}>{label}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Code</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Control</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Score</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Owner</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-sm text-gray-400">
                    Loading controls…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-sm text-gray-400">
                    No controls found
                  </td>
                </tr>
              ) : (
                filtered.map((c) => <ControlRow key={c.id} control={c} />)
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
