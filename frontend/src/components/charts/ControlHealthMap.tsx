'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient as api } from '@/lib/api/client';
import { cn } from '@/lib/utils';
import {
  CheckCircle, AlertTriangle, XCircle, RefreshCw, Activity,
} from 'lucide-react';
import Link from 'next/link';

// ─── Types ────────────────────────────────────────────────────────────────────

type Signal = 'green' | 'yellow' | 'red';

interface ControlDot {
  controlId: string;
  code: string;
  name: string;
  signal: Signal;
}

interface CategoryHealth {
  category: string;
  total: number;
  green: number;
  yellow: number;
  red: number;
  healthPct: number;
  worstSignal: Signal;
  controls: ControlDot[];
}

interface HealthData {
  lastChecked: string;
  overall: { green: number; yellow: number; red: number; total: number };
  categories: CategoryHealth[];
}

// ─── Signal config ────────────────────────────────────────────────────────────

const SIGNAL_CFG = {
  green:  { dot: 'bg-emerald-500', bar: 'bg-emerald-400', text: 'text-emerald-700', bg: 'bg-emerald-50',  border: 'border-emerald-200', label: 'Healthy'  },
  yellow: { dot: 'bg-amber-400',   bar: 'bg-amber-400',   text: 'text-amber-700',   bg: 'bg-amber-50',    border: 'border-amber-200',   label: 'Warning'  },
  red:    { dot: 'bg-red-500',     bar: 'bg-red-400',     text: 'text-red-700',     bg: 'bg-red-50',      border: 'border-red-200',     label: 'Critical' },
};

// ─── Dot grid for a category ──────────────────────────────────────────────────

function DotGrid({ controls }: { controls: ControlDot[] }) {
  return (
    <div className="flex flex-wrap gap-1 mt-2">
      {controls.map((c) => (
        <Link
          key={c.controlId}
          href={`/controls/${c.controlId}`}
          title={`${c.code} — ${c.name}`}
          className={cn(
            'w-3 h-3 rounded-sm transition-transform hover:scale-150 hover:z-10',
            SIGNAL_CFG[c.signal].dot,
          )}
        />
      ))}
    </div>
  );
}

// ─── Category row ─────────────────────────────────────────────────────────────

function CategoryRow({ cat }: { cat: CategoryHealth }) {
  const cfg = SIGNAL_CFG[cat.worstSignal];

  return (
    <div className={cn(
      'rounded-xl border p-3 transition-colors',
      cfg.bg, cfg.border,
    )}>
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className={cn('w-2 h-2 rounded-full shrink-0', cfg.dot)} />
          <span className="text-xs font-semibold text-gray-800 truncate">{cat.category}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0 text-xs text-gray-500">
          {cat.red > 0    && <span className="text-red-600 font-medium">{cat.red}🔴</span>}
          {cat.yellow > 0 && <span className="text-amber-600 font-medium">{cat.yellow}🟡</span>}
          {cat.green > 0  && <span className="text-emerald-600 font-medium">{cat.green}🟢</span>}
        </div>
      </div>

      {/* Health bar */}
      <div className="h-1.5 bg-white/60 rounded-full overflow-hidden flex gap-px">
        {cat.green  > 0 && <div className="bg-emerald-500 h-full rounded-l-full transition-all" style={{ width: `${(cat.green  / cat.total) * 100}%` }} />}
        {cat.yellow > 0 && <div className="bg-amber-400  h-full transition-all"                style={{ width: `${(cat.yellow / cat.total) * 100}%` }} />}
        {cat.red    > 0 && <div className="bg-red-500    h-full rounded-r-full transition-all" style={{ width: `${(cat.red    / cat.total) * 100}%` }} />}
      </div>

      {/* Control dots */}
      <DotGrid controls={cat.controls} />
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface ControlHealthMapProps {
  /** Show the full grid (all categories). If false, shows only a compact summary bar. */
  expanded?: boolean;
}

export function ControlHealthMap({ expanded = true }: ControlHealthMapProps) {
  const { data, isLoading, dataUpdatedAt, isFetching } = useQuery<HealthData>({
    queryKey: ['control-health'],
    queryFn: () => api.get('/controls/health').then((r: any) => r.data),
    refetchInterval: 30_000,   // live refresh every 30 seconds
    staleTime:        20_000,
  });

  // ── Loading skeleton ───────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="space-y-2 animate-pulse">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-20 bg-gray-100 rounded-xl" />
        ))}
      </div>
    );
  }

  if (!data) return null;

  const { overall, categories, lastChecked } = data;
  const overallSignal: Signal =
    overall.red > 0 ? 'red' : overall.yellow > 0 ? 'yellow' : 'green';
  const overallPct = overall.total > 0
    ? Math.round(((overall.green + overall.yellow * 0.5) / overall.total) * 100)
    : 100;

  const lastCheckedLabel = (() => {
    const diff = Date.now() - new Date(dataUpdatedAt).getTime();
    const secs = Math.round(diff / 1000);
    if (secs < 10) return 'just now';
    if (secs < 60) return `${secs}s ago`;
    return `${Math.round(secs / 60)}m ago`;
  })();

  // ── Compact summary bar (used when expanded=false) ─────────────────────────
  if (!expanded) {
    return (
      <div className="flex items-center gap-3">
        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden flex gap-px">
          {overall.green  > 0 && <div className="bg-emerald-500 h-full" style={{ width: `${(overall.green  / overall.total) * 100}%` }} />}
          {overall.yellow > 0 && <div className="bg-amber-400  h-full" style={{ width: `${(overall.yellow / overall.total) * 100}%` }} />}
          {overall.red    > 0 && <div className="bg-red-500    h-full" style={{ width: `${(overall.red    / overall.total) * 100}%` }} />}
        </div>
        <span className={cn('text-sm font-bold', SIGNAL_CFG[overallSignal].text)}>
          {overallPct}%
        </span>
      </div>
    );
  }

  // ── Full map ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Overall status bar */}
      <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl border border-gray-200">
        {/* Icon */}
        <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0',
          overallSignal === 'green'  ? 'bg-emerald-100' :
          overallSignal === 'yellow' ? 'bg-amber-100'   : 'bg-red-100',
        )}>
          {overallSignal === 'green'
            ? <CheckCircle className="w-5 h-5 text-emerald-600" />
            : overallSignal === 'yellow'
            ? <AlertTriangle className="w-5 h-5 text-amber-600" />
            : <XCircle className="w-5 h-5 text-red-600" />}
        </div>

        {/* Counts */}
        <div className="flex-1 grid grid-cols-3 gap-2">
          {[
            { label: 'Healthy',  count: overall.green,  color: 'text-emerald-600', bg: 'bg-emerald-50',  href: '/controls?status=implemented' },
            { label: 'Warning',  count: overall.yellow, color: 'text-amber-600',   bg: 'bg-amber-50',    href: '/controls?status=in_progress' },
            { label: 'Critical', count: overall.red,    color: 'text-red-600',     bg: 'bg-red-50',      href: '/controls?status=not_started'  },
          ].map(({ label, count, color, bg, href }) => (
            <Link
              key={label}
              href={href}
              className={cn('rounded-lg px-3 py-2 text-center hover:opacity-80 transition-opacity', bg)}
            >
              <p className={cn('text-xl font-bold', color)}>{count}</p>
              <p className={cn('text-xs font-medium', color)}>{label}</p>
            </Link>
          ))}
        </div>

        {/* Refresh indicator */}
        <div className="text-right shrink-0">
          <div className="flex items-center gap-1 justify-end mb-0.5">
            <Activity className={cn('w-3 h-3', isFetching ? 'text-brand-500 animate-pulse' : 'text-gray-400')} />
            <span className="text-xs text-gray-400">Live</span>
          </div>
          <span className="text-xs text-gray-400">Updated {lastCheckedLabel}</span>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 px-1">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Category health</p>
        <div className="flex items-center gap-3 ml-auto text-xs text-gray-400">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> Implemented, evidence fresh</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400  inline-block" /> In progress / evidence expiring</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500    inline-block" /> Not started / failed</span>
        </div>
      </div>

      {/* Category grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {categories.map((cat) => (
          <CategoryRow key={cat.category} cat={cat} />
        ))}
      </div>

      {/* Footer */}
      <p className="text-xs text-gray-400 text-center">
        <RefreshCw className={cn('w-3 h-3 inline mr-1', isFetching && 'animate-spin')} />
        Auto-refreshes every 30 seconds · Click any dot to view control detail
      </p>
    </div>
  );
}
