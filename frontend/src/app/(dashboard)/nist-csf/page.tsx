'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import {
  Shield, AlertTriangle, CheckCircle2, Eye, Activity,
  ExternalLink, ChevronRight, Lock, RefreshCw, FileText,
  Zap, ShieldCheck, Settings,
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

interface ControlSummary {
  code: string;
  title: string;
  status: 'implemented' | 'in_progress' | 'not_started';
  category: string;
}

function useNistCsfControls() {
  return useQuery<ControlSummary[]>({
    queryKey: ['controls', 'NIST_CSF'],
    queryFn: async () => {
      const { data } = await apiClient.get('/controls', { params: { framework: 'NIST_CSF', limit: 100 } });
      return (data?.data ?? data ?? []) as ControlSummary[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

const FUNCTIONS = [
  {
    prefix: 'NIST-GV', fn: 'GV', title: 'Govern',
    desc: 'Organizational context, risk management strategy, policies',
    icon: Settings, color: 'text-orange-700 bg-orange-50',
  },
  {
    prefix: 'NIST-ID', fn: 'ID', title: 'Identify',
    desc: 'Asset management, risk assessment, supply chain risk',
    icon: Eye, color: 'text-amber-700 bg-amber-50',
  },
  {
    prefix: 'NIST-PR', fn: 'PR', title: 'Protect',
    desc: 'Identity management, awareness, data security, platform security',
    icon: Lock, color: 'text-orange-700 bg-orange-50',
  },
  {
    prefix: 'NIST-DE', fn: 'DE', title: 'Detect',
    desc: 'Continuous monitoring, adverse event analysis',
    icon: Zap, color: 'text-amber-700 bg-amber-50',
  },
  {
    prefix: 'NIST-RS', fn: 'RS', title: 'Respond',
    desc: 'Incident management, analysis, mitigation, reporting',
    icon: Activity, color: 'text-orange-700 bg-orange-50',
  },
  {
    prefix: 'NIST-RC', fn: 'RC', title: 'Recover',
    desc: 'Incident recovery, communication, restoration',
    icon: RefreshCw, color: 'text-amber-700 bg-amber-50',
  },
];

const QUICK_LINKS = [
  { href: '/nist-csf/profiles',           icon: FileText,   label: 'CSF Profile Management',      color: 'text-orange-600' },
  { href: '/nist-csf/tier-assessment',    icon: ShieldCheck, label: 'Tier Self-Assessment',        color: 'text-amber-600' },
  { href: '/nist-csf/action-plan',        icon: Activity,   label: 'Implementation Action Plan',   color: 'text-orange-600' },
];

export default function NistCsfDashboardPage() {
  const { data: controls = [], isLoading } = useNistCsfControls();

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
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center shadow-sm">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">NIST CSF 2.0</h1>
            <p className="text-sm text-gray-500">NIST Cybersecurity Framework — 6 Core Functions</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/frameworks/nist-csf"
            target="_blank"
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Reference
          </Link>
          <Link
            href="/controls?framework=NIST_CSF"
            className="flex items-center gap-1.5 text-sm bg-orange-600 text-white px-3 py-1.5 rounded-lg hover:bg-orange-700 transition-colors font-medium"
          >
            View Controls <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Overall Progress', value: `${pct}%`, sub: `${implemented} of ${total} subcategories`, icon: CheckCircle2, color: 'text-orange-600 bg-orange-50' },
          { label: 'Implemented',      value: implemented, sub: 'subcategories', icon: CheckCircle2, color: 'text-orange-600 bg-orange-50' },
          { label: 'In Progress',      value: inProgress,  sub: 'subcategories', icon: RefreshCw,    color: 'text-amber-600 bg-amber-50' },
          { label: 'Not Started',      value: notStarted,  sub: 'subcategories', icon: AlertTriangle, color: 'text-gray-500 bg-gray-50' },
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
            <span className="text-sm font-semibold text-gray-700">NIST CSF Implementation Progress</span>
            <span className="text-sm font-bold text-orange-600">{pct}%</span>
          </div>
          <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-orange-500 to-amber-500 rounded-full transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-500" />{implemented} implemented</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400" />{inProgress} in progress</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-200" />{notStarted} not started</span>
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        {/* Function breakdown */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
          <div className="px-5 py-4 border-b border-gray-50">
            <h2 className="text-base font-semibold text-gray-900">Core Functions</h2>
            <p className="text-xs text-gray-500 mt-0.5">NIST CSF 2.0 — Govern + 5 original functions</p>
          </div>
          <div className="divide-y divide-gray-50">
            {FUNCTIONS.map(({ prefix, fn, title, desc, icon: Icon, color }) => {
              const fnControls = controls.filter(c => c.code.startsWith(prefix));
              const done = fnControls.filter(c => c.status === 'implemented').length;
              const fnPct = fnControls.length > 0 ? Math.round((done / fnControls.length) * 100) : 0;
              return (
                <div key={prefix} className="px-5 py-3">
                  <div className="flex items-center gap-3">
                    <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0', color.split(' ')[1])}>
                      <Icon className={cn('w-4 h-4', color.split(' ')[0])} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-mono font-bold text-orange-700 bg-orange-50 px-1.5 py-0.5 rounded">{fn}</span>
                          <p className="text-sm font-medium text-gray-800">{title}</p>
                        </div>
                        <div className="text-right shrink-0 ml-2">
                          <p className="text-sm font-semibold text-gray-700">{fnPct}%</p>
                          <p className="text-xs text-gray-400">{done}/{fnControls.length || '?'}</p>
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

        {/* Quick links + tier info */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
            <div className="px-5 py-4 border-b border-gray-50">
              <h2 className="text-base font-semibold text-gray-900">NIST CSF Modules</h2>
              <p className="text-xs text-gray-500 mt-0.5">Profiles, tiers & action planning</p>
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

          <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-xl border border-orange-100 p-4">
            <h3 className="text-sm font-semibold text-gray-800 mb-3">Implementation Tiers</h3>
            <div className="space-y-2">
              {[
                { tier: 'Tier 1', label: 'Partial',          color: 'text-red-700 bg-red-100' },
                { tier: 'Tier 2', label: 'Risk Informed',    color: 'text-amber-700 bg-amber-100' },
                { tier: 'Tier 3', label: 'Repeatable',       color: 'text-orange-700 bg-orange-100' },
                { tier: 'Tier 4', label: 'Adaptive',         color: 'text-green-700 bg-green-100' },
              ].map(({ tier, label, color }) => (
                <div key={tier} className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 shadow-sm">
                  <span className={cn('text-xs font-bold px-1.5 py-0.5 rounded', color)}>{tier}</span>
                  <span className="text-xs text-gray-700">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
