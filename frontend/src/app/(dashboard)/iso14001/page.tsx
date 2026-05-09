'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import {
  Leaf, Globe, Activity, AlertTriangle, CheckCircle2, ClipboardList,
  ExternalLink, ChevronRight, Zap, Droplets, Trash2, BookOpen,
  TrendingUp, RefreshCw,
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

// ── Types ────────────────────────────────────────────────────────────────────

interface ControlSummary {
  code: string;
  title: string;
  status: 'implemented' | 'in_progress' | 'not_started';
  category: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function useIso14001Controls() {
  return useQuery<ControlSummary[]>({
    queryKey: ['controls', 'ISO14001'],
    queryFn: async () => {
      const { data } = await apiClient.get('/controls', { params: { framework: 'ISO14001', limit: 100 } });
      return (data?.data ?? data ?? []) as ControlSummary[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    implemented: { label: 'Implemented', cls: 'bg-green-100 text-green-700' },
    in_progress:  { label: 'In Progress', cls: 'bg-yellow-100 text-yellow-700' },
    not_started:  { label: 'Not Started', cls: 'bg-gray-100 text-gray-500' },
  };
  const { label, cls } = map[status] ?? map['not_started'];
  return <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', cls)}>{label}</span>;
}

// ── EMS Clause Categories ────────────────────────────────────────────────────

const CLAUSES = [
  { clause: '4', title: 'Context of the Organization', icon: Globe, color: 'text-green-700 bg-green-50', prefix: 'ISO14001-4' },
  { clause: '5', title: 'Leadership', icon: ClipboardList, color: 'text-emerald-700 bg-emerald-50', prefix: 'ISO14001-5' },
  { clause: '6', title: 'Planning', icon: AlertTriangle, color: 'text-teal-700 bg-teal-50', prefix: 'ISO14001-6' },
  { clause: '7', title: 'Support', icon: BookOpen, color: 'text-green-700 bg-green-50', prefix: 'ISO14001-7' },
  { clause: '8', title: 'Operation', icon: Zap, color: 'text-lime-700 bg-lime-50', prefix: 'ISO14001-8' },
  { clause: '9', title: 'Performance Evaluation', icon: Activity, color: 'text-emerald-700 bg-emerald-50', prefix: 'ISO14001-9' },
  { clause: '10', title: 'Improvement', icon: TrendingUp, color: 'text-teal-700 bg-teal-50', prefix: 'ISO14001-10' },
  { clause: 'ENV', title: 'Environmental Performance', icon: Leaf, color: 'text-green-700 bg-green-50', prefix: 'ISO14001-ENV' },
];

const QUICK_LINKS = [
  { href: '/iso14001/aspects',            icon: Leaf,        label: 'Environmental Aspects Register',   color: 'text-green-600' },
  { href: '/iso14001/objectives',         icon: TrendingUp,  label: 'Environmental Objectives',         color: 'text-emerald-600' },
  { href: '/iso14001/legal-register',     icon: BookOpen,    label: 'Legal & Compliance Register',      color: 'text-teal-600' },
  { href: '/iso14001/emergency-response', icon: AlertTriangle, label: 'Emergency Response Plans',       color: 'text-yellow-600' },
];

// ── Page ─────────────────────────────────────────────────────────────────────

export default function Iso14001Page() {
  const { data: controls = [], isLoading } = useIso14001Controls();

  const implemented = controls.filter(c => c.status === 'implemented').length;
  const inProgress  = controls.filter(c => c.status === 'in_progress').length;
  const notStarted  = controls.filter(c => c.status === 'not_started').length;
  const total       = controls.length;
  const pct         = total > 0 ? Math.round((implemented / total) * 100) : 0;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-sm">
            <Leaf className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">ISO 14001:2015</h1>
            <p className="text-sm text-gray-500">Environmental Management System</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/frameworks/iso14001"
            target="_blank"
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Reference
          </Link>
          <Link
            href="/controls?framework=ISO14001"
            className="flex items-center gap-1.5 text-sm bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700 transition-colors font-medium"
          >
            View Controls <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Overall Progress', value: `${pct}%`, sub: `${implemented} of ${total} controls`, icon: CheckCircle2, color: 'text-green-600 bg-green-50' },
          { label: 'Implemented', value: implemented, sub: 'controls', icon: CheckCircle2, color: 'text-green-600 bg-green-50' },
          { label: 'In Progress', value: inProgress, sub: 'controls', icon: RefreshCw, color: 'text-yellow-600 bg-yellow-50' },
          { label: 'Not Started', value: notStarted, sub: 'controls', icon: AlertTriangle, color: 'text-gray-500 bg-gray-50' },
        ].map(({ label, value, sub, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
            <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center mb-2', color.split(' ')[1])}>
              <Icon className={cn('w-4 h-4', color.split(' ')[0])} />
            </div>
            <p className="text-2xl font-bold text-gray-900">{isLoading ? '—' : value}</p>
            <p className="text-xs font-medium text-gray-500 mt-0.5">{label}</p>
            <p className="text-xs text-gray-400">{sub}</p>
          </div>
        ))}
      </div>

      {/* Progress bar */}
      {!isLoading && total > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-gray-700">EMS Implementation Progress</span>
            <span className="text-sm font-bold text-green-600">{pct}%</span>
          </div>
          <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-green-500 to-emerald-600 rounded-full transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" />{implemented} implemented</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-400" />{inProgress} in progress</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-200" />{notStarted} not started</span>
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        {/* Clause breakdown */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
          <div className="px-5 py-4 border-b border-gray-50">
            <h2 className="text-base font-semibold text-gray-900">EMS Clauses</h2>
            <p className="text-xs text-gray-500 mt-0.5">ISO 14001:2015 Clause 4–10</p>
          </div>
          <div className="divide-y divide-gray-50">
            {CLAUSES.map(({ clause, title, icon: Icon, color }) => {
              const clauseControls = controls.filter(c => c.code.startsWith(`ISO14001-${clause}`));
              const clauseDone = clauseControls.filter(c => c.status === 'implemented').length;
              const clausePct = clauseControls.length > 0 ? Math.round((clauseDone / clauseControls.length) * 100) : 0;
              return (
                <div key={clause} className="flex items-center gap-3 px-5 py-3">
                  <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0', color.split(' ')[1])}>
                    <Icon className={cn('w-4 h-4', color.split(' ')[0])} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{title}</p>
                    <p className="text-xs text-gray-400">Clause {clause}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold text-gray-700">{clausePct}%</p>
                    <p className="text-xs text-gray-400">{clauseDone}/{clauseControls.length}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Quick links */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
            <div className="px-5 py-4 border-b border-gray-50">
              <h2 className="text-base font-semibold text-gray-900">EMS Modules</h2>
              <p className="text-xs text-gray-500 mt-0.5">Key ISO 14001 operational areas</p>
            </div>
            <div className="divide-y divide-gray-50">
              {QUICK_LINKS.map(({ href, icon: Icon, label, color }) => (
                <Link key={href} href={href} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors group">
                  <Icon className={cn('w-4 h-4 shrink-0', color)} />
                  <span className="text-sm text-gray-700 group-hover:text-gray-900 flex-1">{label}</span>
                  <ChevronRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-gray-500" />
                </Link>
              ))}
            </div>
          </div>

          {/* Environmental topics */}
          <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl border border-green-100 p-4">
            <h3 className="text-sm font-semibold text-gray-800 mb-3">Key Environmental Topics</h3>
            <div className="grid grid-cols-2 gap-2">
              {[
                { icon: Zap, label: 'Energy', color: 'text-yellow-600' },
                { icon: Droplets, label: 'Water', color: 'text-blue-600' },
                { icon: Leaf, label: 'Emissions', color: 'text-green-600' },
                { icon: Trash2, label: 'Waste', color: 'text-gray-600' },
              ].map(({ icon: Icon, label, color }) => (
                <div key={label} className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 shadow-sm">
                  <Icon className={cn('w-4 h-4', color)} />
                  <span className="text-xs font-medium text-gray-700">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
