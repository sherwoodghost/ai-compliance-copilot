'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import {
  ShieldCheck, AlertTriangle, CheckCircle2, Server,
  ExternalLink, ChevronRight, Lock, Eye, Users, FileText,
  RefreshCw, Activity, Network,
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

interface ControlSummary {
  code: string;
  title: string;
  status: 'implemented' | 'in_progress' | 'not_started';
  category: string;
}

function useFedRampControls() {
  return useQuery<ControlSummary[]>({
    queryKey: ['controls', 'FEDRAMP'],
    queryFn: async () => {
      const { data } = await apiClient.get('/controls', { params: { framework: 'FEDRAMP', limit: 200 } });
      return (data?.data ?? data ?? []) as ControlSummary[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

const CONTROL_FAMILIES = [
  { prefix: 'FedRAMP-AC', family: 'AC', title: 'Access Control',                      icon: Lock,          color: 'text-sky-700 bg-sky-50' },
  { prefix: 'FedRAMP-AT', family: 'AT', title: 'Awareness & Training',                 icon: Users,         color: 'text-blue-700 bg-blue-50' },
  { prefix: 'FedRAMP-AU', family: 'AU', title: 'Audit & Accountability',               icon: Eye,           color: 'text-sky-700 bg-sky-50' },
  { prefix: 'FedRAMP-CA', family: 'CA', title: 'Assessment, Authorization & Monitoring', icon: ShieldCheck, color: 'text-blue-700 bg-blue-50' },
  { prefix: 'FedRAMP-CM', family: 'CM', title: 'Configuration Management',             icon: Server,        color: 'text-sky-700 bg-sky-50' },
  { prefix: 'FedRAMP-CP', family: 'CP', title: 'Contingency Planning',                 icon: Activity,      color: 'text-blue-700 bg-blue-50' },
  { prefix: 'FedRAMP-IA', family: 'IA', title: 'Identification & Authentication',      icon: Users,         color: 'text-sky-700 bg-sky-50' },
  { prefix: 'FedRAMP-IR', family: 'IR', title: 'Incident Response',                   icon: AlertTriangle, color: 'text-blue-700 bg-blue-50' },
  { prefix: 'FedRAMP-RA', family: 'RA', title: 'Risk Assessment',                     icon: AlertTriangle, color: 'text-sky-700 bg-sky-50' },
  { prefix: 'FedRAMP-SC', family: 'SC', title: 'System & Communications Protection',  icon: Network,       color: 'text-blue-700 bg-blue-50' },
  { prefix: 'FedRAMP-SI', family: 'SI', title: 'System & Information Integrity',       icon: ShieldCheck,   color: 'text-sky-700 bg-sky-50' },
];

const QUICK_LINKS = [
  { href: '/fedramp/ato-tracker',    icon: FileText,    label: 'ATO Package Tracker',              color: 'text-sky-600' },
  { href: '/fedramp/ssp',            icon: Server,      label: 'System Security Plan (SSP)',        color: 'text-blue-600' },
  { href: '/fedramp/continuous-mon', icon: Activity,    label: 'Continuous Monitoring',             color: 'text-sky-600' },
  { href: '/fedramp/poam',           icon: AlertTriangle, label: 'Plan of Action & Milestones (POA&M)', color: 'text-blue-600' },
];

export default function FedRampDashboardPage() {
  const { data: controls = [], isLoading } = useFedRampControls();

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
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-sky-600 to-blue-700 flex items-center justify-center shadow-sm">
            <ShieldCheck className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">FedRAMP Moderate</h1>
            <p className="text-sm text-gray-500">NIST SP 800-53 Rev 5 — U.S. Federal Cloud Authorization</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/frameworks/fedramp"
            target="_blank"
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Reference
          </Link>
          <Link
            href="/controls?framework=FEDRAMP"
            className="flex items-center gap-1.5 text-sm bg-sky-600 text-white px-3 py-1.5 rounded-lg hover:bg-sky-700 transition-colors font-medium"
          >
            View Controls <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Overall Progress', value: `${pct}%`, sub: `${implemented} of ${total} controls`, icon: CheckCircle2, color: 'text-sky-600 bg-sky-50' },
          { label: 'Implemented',      value: implemented, sub: 'controls', icon: CheckCircle2, color: 'text-sky-600 bg-sky-50' },
          { label: 'In Progress',      value: inProgress,  sub: 'controls', icon: RefreshCw,    color: 'text-blue-600 bg-blue-50' },
          { label: 'Not Started',      value: notStarted,  sub: 'controls', icon: AlertTriangle, color: 'text-gray-500 bg-gray-50' },
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
            <span className="text-sm font-semibold text-gray-700">FedRAMP Authorization Progress</span>
            <span className="text-sm font-bold text-sky-600">{pct}%</span>
          </div>
          <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-sky-500 to-blue-600 rounded-full transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-sky-500" />{implemented} implemented</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-400" />{inProgress} in progress</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-200" />{notStarted} not started</span>
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        {/* Control families */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
          <div className="px-5 py-4 border-b border-gray-50">
            <h2 className="text-base font-semibold text-gray-900">NIST 800-53 Control Families</h2>
            <p className="text-xs text-gray-500 mt-0.5">FedRAMP Moderate baseline</p>
          </div>
          <div className="divide-y divide-gray-50 max-h-96 overflow-y-auto">
            {CONTROL_FAMILIES.map(({ prefix, family, title, icon: Icon, color }) => {
              const familyControls = controls.filter(c => c.code.startsWith(prefix));
              const done = familyControls.filter(c => c.status === 'implemented').length;
              const famPct = familyControls.length > 0 ? Math.round((done / familyControls.length) * 100) : 0;
              return (
                <div key={prefix} className="flex items-center gap-3 px-5 py-2.5">
                  <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center shrink-0', color.split(' ')[1])}>
                    <Icon className={cn('w-3.5 h-3.5', color.split(' ')[0])} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-mono font-bold text-sky-700 bg-sky-50 px-1.5 py-0.5 rounded shrink-0">{family}</span>
                      <p className="text-xs font-medium text-gray-800 truncate">{title}</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold text-gray-700">{famPct}%</p>
                    <p className="text-xs text-gray-400">{done}/{familyControls.length || '?'}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Quick links + authorization info */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
            <div className="px-5 py-4 border-b border-gray-50">
              <h2 className="text-base font-semibold text-gray-900">FedRAMP Modules</h2>
              <p className="text-xs text-gray-500 mt-0.5">Authorization & monitoring areas</p>
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

          <div className="bg-gradient-to-br from-sky-50 to-blue-50 rounded-xl border border-sky-100 p-4">
            <h3 className="text-sm font-semibold text-gray-800 mb-3">FedRAMP Authorization Path</h3>
            <div className="space-y-2">
              {[
                { step: '1', label: 'Readiness Assessment',    color: 'text-sky-700 bg-sky-100' },
                { step: '2', label: 'Full Assessment (3PAO)',   color: 'text-blue-700 bg-blue-100' },
                { step: '3', label: 'Agency ATO Review',        color: 'text-sky-700 bg-sky-100' },
                { step: '4', label: 'PMO Authorization',        color: 'text-blue-700 bg-blue-100' },
              ].map(({ step, label, color }) => (
                <div key={step} className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 shadow-sm">
                  <span className={cn('text-xs font-bold px-1.5 py-0.5 rounded', color)}>{step}</span>
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
