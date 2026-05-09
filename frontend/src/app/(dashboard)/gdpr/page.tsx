'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import {
  ShieldCheck, AlertTriangle, CheckCircle2, FileText,
  ExternalLink, ChevronRight, Users, Clock, Globe,
  RefreshCw, Activity, Lock, Database,
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

interface ControlSummary {
  code: string;
  title: string;
  status: 'implemented' | 'in_progress' | 'not_started';
  category: string;
}

function useGdprControls() {
  return useQuery<ControlSummary[]>({
    queryKey: ['controls', 'GDPR'],
    queryFn: async () => {
      const { data } = await apiClient.get('/controls', { params: { framework: 'GDPR', limit: 200 } });
      return (data?.data ?? data ?? []) as ControlSummary[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

const ARTICLE_GROUPS = [
  { prefix: 'GDPR-Art-5',  title: 'Principles',                    ref: 'Art. 5–11',   icon: ShieldCheck, color: 'text-violet-700 bg-violet-50', desc: 'Lawful basis, data minimisation, accuracy, storage limitation, accountability' },
  { prefix: 'GDPR-Art-15', title: 'Data Subject Rights',            ref: 'Art. 15–22',  icon: Users,       color: 'text-purple-700 bg-purple-50',  desc: 'Right to access, erasure, rectification, portability, objection, restriction' },
  { prefix: 'GDPR-Art-24', title: 'Controller & Processor',         ref: 'Art. 24–43',  icon: FileText,    color: 'text-violet-700 bg-violet-50',  desc: 'DPA templates, processor inventory, sub-processor management' },
  { prefix: 'GDPR-Art-32', title: 'Security (TOM)',                 ref: 'Art. 32',     icon: Lock,        color: 'text-purple-700 bg-purple-50',  desc: 'Encryption, pseudonymisation, access controls, technical & organisational measures' },
  { prefix: 'GDPR-Art-35', title: 'DPIA',                          ref: 'Art. 35–36',  icon: Activity,    color: 'text-violet-700 bg-violet-50',  desc: 'Data Protection Impact Assessment triggers, register, DPO consultation' },
  { prefix: 'GDPR-Art-33', title: 'Breach Notification',            ref: 'Art. 33–34',  icon: AlertTriangle, color: 'text-purple-700 bg-purple-50', desc: '72-hour supervisory notification, data subject communication procedures' },
  { prefix: 'GDPR-Art-44', title: 'International Transfers',        ref: 'Art. 44–49',  icon: Globe,       color: 'text-violet-700 bg-violet-50',  desc: 'Standard contractual clauses, BCRs, adequacy decision tracking' },
  { prefix: 'GDPR-Art-30', title: 'Records of Processing (ROPA)',   ref: 'Art. 30',     icon: Database,    color: 'text-purple-700 bg-purple-50',  desc: 'ROPA maintained, controller/processor records current and accurate' },
];

const QUICK_LINKS = [
  { href: '/gdpr/ropa',        icon: Database,      label: 'Records of Processing (ROPA)', color: 'text-violet-600' },
  { href: '/gdpr/dsar',        icon: Users,         label: 'Data Subject Request Queue',   color: 'text-purple-600' },
  { href: '/gdpr/dpia',        icon: Activity,      label: 'DPIA Register',                color: 'text-violet-600' },
  { href: '/gdpr/breach-log',  icon: AlertTriangle, label: 'Breach Notification Log',      color: 'text-purple-600' },
];

export default function GdprDashboardPage() {
  const { data: controls = [], isLoading } = useGdprControls();

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
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-sm">
            <ShieldCheck className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">GDPR Compliance</h1>
            <p className="text-sm text-gray-500">Regulation (EU) 2016/679 — General Data Protection Regulation</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/frameworks/gdpr"
            target="_blank"
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Reference
          </Link>
          <Link
            href="/controls?framework=GDPR"
            className="flex items-center gap-1.5 text-sm bg-violet-600 text-white px-3 py-1.5 rounded-lg hover:bg-violet-700 transition-colors font-medium"
          >
            View Controls <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Overall Progress', value: `${pct}%`,    sub: `${implemented} of ${total} requirements`, icon: CheckCircle2,  color: 'text-violet-600 bg-violet-50' },
          { label: 'Implemented',      value: implemented,  sub: 'requirements', icon: CheckCircle2,  color: 'text-violet-600 bg-violet-50' },
          { label: 'In Progress',      value: inProgress,   sub: 'requirements', icon: RefreshCw,     color: 'text-amber-600 bg-amber-50' },
          { label: 'Not Started',      value: notStarted,   sub: 'requirements', icon: AlertTriangle, color: 'text-gray-500 bg-gray-50' },
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
            <span className="text-sm font-semibold text-gray-700">GDPR Implementation Progress</span>
            <span className="text-sm font-bold text-violet-600">{pct}%</span>
          </div>
          <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-violet-500 to-purple-600 rounded-full transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-violet-500" />{implemented} implemented</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400" />{inProgress} in progress</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-200" />{notStarted} not started</span>
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        {/* Article group breakdown */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
          <div className="px-5 py-4 border-b border-gray-50">
            <h2 className="text-base font-semibold text-gray-900">GDPR Article Groups</h2>
            <p className="text-xs text-gray-500 mt-0.5">Regulation (EU) 2016/679 chapters</p>
          </div>
          <div className="divide-y divide-gray-50 max-h-[26rem] overflow-y-auto">
            {ARTICLE_GROUPS.map(({ prefix, title, ref, icon: Icon, color, desc }) => {
              const groupControls = controls.filter(c => c.code.startsWith(prefix));
              const done   = groupControls.filter(c => c.status === 'implemented').length;
              const grpPct = groupControls.length > 0 ? Math.round((done / groupControls.length) * 100) : 0;
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
                          <span className="text-xs font-mono text-violet-600 bg-violet-50 px-1.5 py-0.5 rounded">{ref}</span>
                          <span className="text-sm font-semibold text-gray-700">{grpPct}%</span>
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

        {/* Quick links + key obligations */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
            <div className="px-5 py-4 border-b border-gray-50">
              <h2 className="text-base font-semibold text-gray-900">GDPR Modules</h2>
              <p className="text-xs text-gray-500 mt-0.5">Operational compliance areas</p>
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

          <div className="bg-gradient-to-br from-violet-50 to-purple-50 rounded-xl border border-violet-100 p-4">
            <h3 className="text-sm font-semibold text-gray-800 mb-3">Key GDPR Obligations</h3>
            <div className="grid grid-cols-1 gap-2 text-xs">
              {[
                { icon: Clock,       label: '72h Breach Notification',   color: 'text-violet-600' },
                { icon: Users,       label: '30-day DSAR Response',       color: 'text-purple-600' },
                { icon: Database,    label: 'ROPA Up-to-Date',            color: 'text-violet-600' },
                { icon: Globe,       label: 'SCCs for Data Transfers',    color: 'text-purple-600' },
                { icon: Activity,    label: 'DPIA Before High-Risk Processing', color: 'text-violet-600' },
                { icon: FileText,    label: 'DPA with Every Processor',   color: 'text-purple-600' },
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
