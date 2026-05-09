'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import {
  CheckCircle2, AlertTriangle, ClipboardList, Settings,
  ExternalLink, ChevronRight, Users, BarChart3, FileText,
  RefreshCw, Activity, Target, Wrench,
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

interface ControlSummary {
  code: string;
  title: string;
  status: 'implemented' | 'in_progress' | 'not_started';
  category: string;
}

function useIso9001Controls() {
  return useQuery<ControlSummary[]>({
    queryKey: ['controls', 'ISO9001'],
    queryFn: async () => {
      const { data } = await apiClient.get('/controls', { params: { framework: 'ISO9001', limit: 200 } });
      return (data?.data ?? data ?? []) as ControlSummary[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

const CLAUSE_GROUPS = [
  { prefix: 'ISO9001-4', clause: '4', title: 'Context of the Organization', icon: Settings,     color: 'text-teal-700 bg-teal-50',    desc: 'Internal/external issues, interested parties, QMS scope, processes' },
  { prefix: 'ISO9001-5', clause: '5', title: 'Leadership',                   icon: Users,        color: 'text-emerald-700 bg-emerald-50', desc: 'Top management commitment, quality policy, roles and responsibilities' },
  { prefix: 'ISO9001-6', clause: '6', title: 'Planning',                     icon: Target,       color: 'text-teal-700 bg-teal-50',    desc: 'Risks and opportunities, quality objectives, planning for changes' },
  { prefix: 'ISO9001-7', clause: '7', title: 'Support',                      icon: Wrench,       color: 'text-emerald-700 bg-emerald-50', desc: 'Resources, competence, awareness, communication, documented information' },
  { prefix: 'ISO9001-8', clause: '8', title: 'Operation',                    icon: Activity,     color: 'text-teal-700 bg-teal-50',    desc: 'Operational planning, customer requirements, design, production, nonconforming outputs' },
  { prefix: 'ISO9001-9', clause: '9', title: 'Performance Evaluation',       icon: BarChart3,    color: 'text-emerald-700 bg-emerald-50', desc: 'Monitoring, customer satisfaction, analysis, internal audit, management review' },
  { prefix: 'ISO9001-10',clause: '10', title: 'Improvement',                 icon: RefreshCw,    color: 'text-teal-700 bg-teal-50',    desc: 'Nonconformity, corrective action, preventive action, continual improvement' },
];

const QUICK_LINKS = [
  { href: '/iso9001/ncr',        icon: AlertTriangle, label: 'Nonconformity (NCR) Tracker', color: 'text-teal-600' },
  { href: '/iso9001/capa',       icon: RefreshCw,     label: 'CAPA Board',                  color: 'text-emerald-600' },
  { href: '/iso9001/objectives', icon: Target,        label: 'Quality Objectives',           color: 'text-teal-600' },
  { href: '/iso9001/audits',     icon: ClipboardList, label: 'Process Audits',               color: 'text-emerald-600' },
];

export default function Iso9001DashboardPage() {
  const { data: controls = [], isLoading } = useIso9001Controls();

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
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center shadow-sm">
            <CheckCircle2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">ISO 9001 Quality Management</h1>
            <p className="text-sm text-gray-500">ISO 9001:2015 — Quality Management System Requirements</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/frameworks/iso9001"
            target="_blank"
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Reference
          </Link>
          <Link
            href="/controls?framework=ISO9001"
            className="flex items-center gap-1.5 text-sm bg-teal-600 text-white px-3 py-1.5 rounded-lg hover:bg-teal-700 transition-colors font-medium"
          >
            View Controls <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Overall Progress', value: `${pct}%`,   sub: `${implemented} of ${total} requirements`, icon: CheckCircle2,  color: 'text-teal-600 bg-teal-50' },
          { label: 'Implemented',      value: implemented, sub: 'requirements', icon: CheckCircle2,  color: 'text-teal-600 bg-teal-50' },
          { label: 'In Progress',      value: inProgress,  sub: 'requirements', icon: RefreshCw,     color: 'text-amber-600 bg-amber-50' },
          { label: 'Not Started',      value: notStarted,  sub: 'requirements', icon: AlertTriangle, color: 'text-gray-500 bg-gray-50' },
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
            <span className="text-sm font-semibold text-gray-700">ISO 9001 Implementation Progress</span>
            <span className="text-sm font-bold text-teal-600">{pct}%</span>
          </div>
          <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-teal-500 to-emerald-600 rounded-full transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-teal-500" />{implemented} implemented</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400" />{inProgress} in progress</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-200" />{notStarted} not started</span>
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        {/* Clause breakdown */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
          <div className="px-5 py-4 border-b border-gray-50">
            <h2 className="text-base font-semibold text-gray-900">QMS Clauses</h2>
            <p className="text-xs text-gray-500 mt-0.5">ISO 9001:2015 — Clauses 4–10</p>
          </div>
          <div className="divide-y divide-gray-50">
            {CLAUSE_GROUPS.map(({ prefix, clause, title, icon: Icon, color, desc }) => {
              const clauseControls = controls.filter(c => c.code.startsWith(prefix));
              const done     = clauseControls.filter(c => c.status === 'implemented').length;
              const clsPct   = clauseControls.length > 0 ? Math.round((done / clauseControls.length) * 100) : 0;
              return (
                <div key={prefix} className="px-5 py-3">
                  <div className="flex items-center gap-3">
                    <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0', color.split(' ')[1])}>
                      <Icon className={cn('w-4 h-4', color.split(' ')[0])} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-gray-800 truncate">{title}</p>
                        <div className="flex items-center gap-2 shrink-0 ml-2">
                          <span className="text-xs font-mono text-teal-600 bg-teal-50 px-1.5 py-0.5 rounded">§{clause}</span>
                          <span className="text-sm font-semibold text-gray-700">{clsPct}%</span>
                        </div>
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5 truncate">{desc}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Quick links + PDCA cycle */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
            <div className="px-5 py-4 border-b border-gray-50">
              <h2 className="text-base font-semibold text-gray-900">ISO 9001 Modules</h2>
              <p className="text-xs text-gray-500 mt-0.5">Quality management operations</p>
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

          <div className="bg-gradient-to-br from-teal-50 to-emerald-50 rounded-xl border border-teal-100 p-4">
            <h3 className="text-sm font-semibold text-gray-800 mb-3">PDCA Improvement Cycle</h3>
            <div className="grid grid-cols-2 gap-2">
              {[
                { step: 'Plan',  label: 'Clauses 4–6',  desc: 'Context, Leadership, Planning',   color: 'text-teal-700 bg-teal-100' },
                { step: 'Do',    label: 'Clauses 7–8',  desc: 'Support & Operations',             color: 'text-emerald-700 bg-emerald-100' },
                { step: 'Check', label: 'Clause 9',     desc: 'Performance Evaluation',           color: 'text-teal-700 bg-teal-100' },
                { step: 'Act',   label: 'Clause 10',    desc: 'Improvement & CAPA',               color: 'text-emerald-700 bg-emerald-100' },
              ].map(({ step, label, desc, color }) => (
                <div key={step} className="bg-white rounded-lg px-3 py-2 shadow-sm">
                  <span className={cn('text-xs font-bold px-1.5 py-0.5 rounded', color)}>{step}</span>
                  <p className="text-xs font-medium text-gray-700 mt-1">{label}</p>
                  <p className="text-xs text-gray-400">{desc}</p>
                </div>
              ))}
            </div>
            <div className="mt-3 pt-3 border-t border-teal-100 grid grid-cols-1 gap-1.5">
              {[
                { icon: FileText,    label: 'Customer Satisfaction Monitoring',  color: 'text-teal-600' },
                { icon: BarChart3,   label: 'Quality Objectives Tracking',       color: 'text-emerald-600' },
                { icon: ClipboardList, label: 'Annual Internal Audit (Cl. 9.2)', color: 'text-teal-600' },
              ].map(({ icon: Icon, label, color }) => (
                <div key={label} className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 shadow-sm">
                  <Icon className={cn('w-3.5 h-3.5', color)} />
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
