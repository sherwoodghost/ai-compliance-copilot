'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { complianceApi } from '@/lib/api/compliance';
import { HeatmapChart } from '@/components/charts/HeatmapChart';
import { CheckCircle, XCircle, AlertCircle, Clock, BarChart2, Plus, CheckSquare, RotateCcw, ArrowLeftRight, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

const STATUS_CONFIG = {
  implemented:    { label: 'Implemented',  icon: CheckCircle,  cls: 'badge-passed' },
  in_progress:    { label: 'In Progress',  icon: Clock,        cls: 'badge-partial' },
  not_started:    { label: 'Not Started',  icon: XCircle,      cls: 'badge-failed' },
  failed:         { label: 'Failed',       icon: AlertCircle,  cls: 'badge-failed' },
  not_applicable: { label: 'N/A',          icon: Clock,        cls: 'badge-pending' },
} as const;

type Status = keyof typeof STATUS_CONFIG;

function ControlRow({ control }: { control: any }) {
  const status = (control.status ?? 'not_started') as Status;
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.not_started;
  const Icon = cfg.icon;

  // Detect crosswalk-credited controls from the notes field
  const isCrosswalkCredit = typeof control.notes === 'string' &&
    control.notes.toLowerCase().includes('crosswalk');
  const crosswalkType = isCrosswalkCredit
    ? (control.notes?.includes('equivalent') ? 'Equivalent' : 'Partial')
    : null;

  const controlId = control.controlId ?? control.control?.id;

  return (
    <tr className="border-b border-gray-100 hover:bg-gray-50 transition-colors group">
      <td className="px-4 py-3 text-xs font-mono text-gray-500 whitespace-nowrap">
        {control.control?.code}
      </td>
      <td className="px-4 py-3">
        {controlId ? (
          <Link href={`/controls/${controlId}`} className="group-hover:text-brand-600 transition-colors">
            <p className="text-sm font-medium text-gray-900 group-hover:text-brand-700 line-clamp-1">{control.control?.name ?? control.control?.title}</p>
            <p className="text-xs text-gray-400 line-clamp-1 mt-0.5">{control.control?.category}</p>
          </Link>
        ) : (
          <>
            <p className="text-sm font-medium text-gray-900 line-clamp-1">{control.control?.name ?? control.control?.title}</p>
            <p className="text-xs text-gray-400 line-clamp-1 mt-0.5">{control.control?.category}</p>
          </>
        )}
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-col gap-1">
          <span className={cfg.cls}>
            <Icon className="w-3 h-3 mr-1" />
            {cfg.label}
          </span>
          {isCrosswalkCredit && (
            <span
              title={control.notes}
              className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded bg-teal-50 text-teal-700 border border-teal-200 w-fit cursor-default"
            >
              <ArrowLeftRight className="w-2.5 h-2.5" />
              {crosswalkType} crosswalk
            </span>
          )}
        </div>
      </td>
      <td className="px-4 py-3 text-sm text-gray-700">
        {control.score != null ? `${control.score}%` : '—'}
      </td>
      <td className="px-4 py-3 text-xs text-gray-500">
        {control.assignee?.fullName ?? '—'}
      </td>
      <td className="px-4 py-3 text-right">
        {controlId && (
          <Link href={`/controls/${controlId}`} className="text-gray-300 hover:text-brand-600 transition-colors">
            <ChevronRight className="w-4 h-4" />
          </Link>
        )}
      </td>
    </tr>
  );
}

export default function ControlsPage() {
  const qc = useQueryClient();
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [showHeatmap, setShowHeatmap] = useState(false);

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

  const initControls = useMutation({
    mutationFn: () => complianceApi.initializeControls('soc2'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['controls'] });
      qc.invalidateQueries({ queryKey: ['control-stats'] });
    },
  });

  const controls: any[] = data ?? [];
  const crosswalkCredited = controls.filter(
    (c) => typeof c.notes === 'string' && c.notes.toLowerCase().includes('crosswalk'),
  ).length;

  const filtered = search
    ? controls.filter(
        (c) =>
          c.control?.name?.toLowerCase().includes(search.toLowerCase()) ||
          c.control?.code?.toLowerCase().includes(search.toLowerCase()),
      )
    : controls;

  return (
    <div className="p-8 max-w-6xl">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Controls</h1>
          <p className="text-sm text-gray-500 mt-1">
            {stats?.byStatus?.implemented ?? 0} implemented · {stats?.byStatus?.in_progress ?? 0} in progress · {(stats?.byStatus?.not_started ?? 0) + (stats?.byStatus?.failed ?? 0)} gaps
            {crosswalkCredited > 0 && (
              <span className="ml-2 text-teal-600">· {crosswalkCredited} auto-credited via crosswalk</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="btn-secondary flex items-center gap-2"
            onClick={() => setShowHeatmap((v) => !v)}
          >
            <BarChart2 className="w-4 h-4" />
            {showHeatmap ? 'Hide' : 'Show'} heatmap
          </button>
          {controls.length === 0 && (
            <button
              className="btn-primary flex items-center gap-2"
              onClick={() => initControls.mutate()}
              disabled={initControls.isPending}
            >
              {initControls.isPending
                ? <><RotateCcw className="w-4 h-4 animate-spin" /> Initializing…</>
                : <><Plus className="w-4 h-4" /> Initialize SOC 2 Controls</>}
            </button>
          )}
        </div>
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

      {/* Crosswalk info banner */}
      {crosswalkCredited > 0 && (
        <div className="flex items-start gap-2 mb-4 rounded-xl bg-teal-50 border border-teal-200 px-4 py-3">
          <ArrowLeftRight className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-teal-800">Multi-Framework Crosswalk Active</p>
            <p className="text-xs text-teal-700 mt-0.5">
              {crosswalkCredited} control{crosswalkCredited !== 1 ? 's were' : ' was'} automatically credited in another framework
              because an equivalent control is already implemented. No duplicate work needed.
            </p>
          </div>
        </div>
      )}

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
                  <td colSpan={5} className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center">
                      <CheckSquare className="w-10 h-10 text-gray-200 mb-3" />
                      <p className="text-sm font-medium text-gray-500 mb-1">
                        {search || status ? 'No controls match your filter' : 'No controls initialized yet'}
                      </p>
                      {!search && !status && (
                        <>
                          <p className="text-xs text-gray-400 mb-4">Initialize your SOC 2 control set to get started</p>
                          <button
                            className="btn-primary flex items-center gap-2 text-sm"
                            onClick={() => initControls.mutate()}
                            disabled={initControls.isPending}
                          >
                            {initControls.isPending
                              ? <><RotateCcw className="w-4 h-4 animate-spin" /> Initializing…</>
                              : <><Plus className="w-4 h-4" /> Initialize SOC 2 Controls</>}
                          </button>
                        </>
                      )}
                    </div>
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
