'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import {
  ShieldCheck, AlertTriangle, CheckCircle2, ClipboardList,
  ExternalLink, ChevronRight, FileText, Users, Activity,
  Lock, Building, RefreshCw,
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

interface ControlSummary {
  code: string;
  title: string;
  status: 'implemented' | 'in_progress' | 'not_started';
  category: string;
}

function useHipaaControls() {
  return useQuery<ControlSummary[]>({
    queryKey: ['controls', 'HIPAA'],
    queryFn: async () => {
      const { data } = await apiClient.get('/controls', { params: { framework: 'HIPAA', limit: 100 } });
      return (data?.data ?? data ?? []) as ControlSummary[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

const SAFEGUARDS = [
  { code: 'HIPAA-Admin',  prefix: 'HIPAA-Admin', title: 'Administrative Safeguards', ref: '§164.308', icon: ClipboardList, color: 'text-rose-700 bg-rose-50',   desc: 'Risk analysis, workforce training, contingency planning, BAAs' },
  { code: 'HIPAA-Phys',  prefix: 'HIPAA-Phys',  title: 'Physical Safeguards',       ref: '§164.310', icon: Building,      color: 'text-pink-700 bg-pink-50',    desc: 'Facility access, workstation use, device & media controls' },
  { code: 'HIPAA-Tech',  prefix: 'HIPAA-Tech',  title: 'Technical Safeguards',      ref: '§164.312', icon: Lock,          color: 'text-red-700 bg-red-50',      desc: 'Access control, audit controls, integrity, transmission security' },
  { code: 'HIPAA-Org',   prefix: 'HIPAA-Org',   title: 'Organizational Requirements',ref: '§164.314', icon: Users,         color: 'text-rose-700 bg-rose-50',    desc: 'Business associate contracts, group health plan requirements' },
  { code: 'HIPAA-Policy',prefix: 'HIPAA-Policy', title: 'Policies & Procedures',    ref: '§164.316', icon: FileText,      color: 'text-pink-700 bg-pink-50',    desc: 'Documentation and change management requirements' },
];

const QUICK_LINKS = [
  { href: '/hipaa/risk-analysis',  icon: AlertTriangle, label: 'Risk Analysis & Management',   color: 'text-rose-600' },
  { href: '/hipaa/baa-tracker',    icon: FileText,      label: 'Business Associate Agreements', color: 'text-pink-600' },
  { href: '/hipaa/phi-inventory',  icon: ShieldCheck,   label: 'PHI Inventory',                 color: 'text-red-600' },
  { href: '/hipaa/breach-log',     icon: Activity,      label: 'Breach Notification Log',       color: 'text-rose-600' },
];

export default function HipaaDashboardPage() {
  const { data: controls = [], isLoading } = useHipaaControls();

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
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center shadow-sm">
            <ShieldCheck className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">HIPAA Security Rule</h1>
            <p className="text-sm text-gray-500">45 CFR §164 — Electronic Protected Health Information</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/frameworks/hipaa"
            target="_blank"
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Reference
          </Link>
          <Link
            href="/controls?framework=HIPAA"
            className="flex items-center gap-1.5 text-sm bg-rose-600 text-white px-3 py-1.5 rounded-lg hover:bg-rose-700 transition-colors font-medium"
          >
            View Controls <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Overall Progress', value: `${pct}%`, sub: `${implemented} of ${total} safeguards`, icon: CheckCircle2, color: 'text-rose-600 bg-rose-50' },
          { label: 'Implemented',      value: implemented, sub: 'safeguards', icon: CheckCircle2, color: 'text-rose-600 bg-rose-50' },
          { label: 'In Progress',      value: inProgress,  sub: 'safeguards', icon: RefreshCw,    color: 'text-amber-600 bg-amber-50' },
          { label: 'Not Started',      value: notStarted,  sub: 'safeguards', icon: AlertTriangle, color: 'text-gray-500 bg-gray-50' },
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
            <span className="text-sm font-semibold text-gray-700">HIPAA Implementation Progress</span>
            <span className="text-sm font-bold text-rose-600">{pct}%</span>
          </div>
          <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-rose-500 to-pink-500 rounded-full transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-500" />{implemented} implemented</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400" />{inProgress} in progress</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-200" />{notStarted} not started</span>
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        {/* Safeguard breakdown */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
          <div className="px-5 py-4 border-b border-gray-50">
            <h2 className="text-base font-semibold text-gray-900">Safeguard Categories</h2>
            <p className="text-xs text-gray-500 mt-0.5">HIPAA Security Rule 45 CFR §164</p>
          </div>
          <div className="divide-y divide-gray-50">
            {SAFEGUARDS.map(({ prefix, title, ref, icon: Icon, color, desc }) => {
              const safeguardControls = controls.filter(c => c.code.startsWith(prefix));
              const done = safeguardControls.filter(c => c.status === 'implemented').length;
              const safePct = safeguardControls.length > 0 ? Math.round((done / safeguardControls.length) * 100) : 0;
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
                          <span className="text-xs font-mono text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded">{ref}</span>
                          <span className="text-sm font-semibold text-gray-700">{safePct}%</span>
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

        {/* Quick links + key facts */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
            <div className="px-5 py-4 border-b border-gray-50">
              <h2 className="text-base font-semibold text-gray-900">HIPAA Modules</h2>
              <p className="text-xs text-gray-500 mt-0.5">Key operational areas</p>
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

          <div className="bg-gradient-to-br from-rose-50 to-pink-50 rounded-xl border border-rose-100 p-4">
            <h3 className="text-sm font-semibold text-gray-800 mb-3">Key HIPAA Requirements</h3>
            <div className="grid grid-cols-1 gap-2 text-xs">
              {[
                { icon: AlertTriangle, label: 'Annual Risk Analysis', color: 'text-rose-600' },
                { icon: FileText,      label: 'BAA with all BAs',     color: 'text-pink-600' },
                { icon: Activity,      label: '72h Breach Reporting', color: 'text-red-600' },
                { icon: Users,         label: 'Workforce Training',   color: 'text-rose-600' },
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
