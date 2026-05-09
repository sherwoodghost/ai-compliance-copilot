'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import {
  CreditCard, AlertTriangle, CheckCircle2, Network, Lock,
  ExternalLink, ChevronRight, ShieldCheck, Eye, RefreshCw,
  FileText, Server, UserCheck,
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

interface ControlSummary {
  code: string;
  title: string;
  status: 'implemented' | 'in_progress' | 'not_started';
  category: string;
}

function usePciDssControls() {
  return useQuery<ControlSummary[]>({
    queryKey: ['controls', 'PCI_DSS'],
    queryFn: async () => {
      const { data } = await apiClient.get('/controls', { params: { framework: 'PCI_DSS', limit: 100 } });
      return (data?.data ?? data ?? []) as ControlSummary[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

const REQUIREMENTS = [
  { prefix: 'PCI-1',  req: '1',  title: 'Network Security Controls',    icon: Network,    color: 'text-amber-700 bg-amber-50' },
  { prefix: 'PCI-2',  req: '2',  title: 'Secure Configurations',         icon: ShieldCheck, color: 'text-orange-700 bg-orange-50' },
  { prefix: 'PCI-3',  req: '3',  title: 'Protect Account Data',          icon: Lock,       color: 'text-amber-700 bg-amber-50' },
  { prefix: 'PCI-4',  req: '4',  title: 'Encryption in Transit',         icon: Lock,       color: 'text-yellow-700 bg-yellow-50' },
  { prefix: 'PCI-5',  req: '5',  title: 'Malware Protection',            icon: ShieldCheck, color: 'text-amber-700 bg-amber-50' },
  { prefix: 'PCI-6',  req: '6',  title: 'Secure Systems & Software',     icon: Server,     color: 'text-orange-700 bg-orange-50' },
  { prefix: 'PCI-7',  req: '7',  title: 'Restrict Access by Need-to-Know', icon: UserCheck, color: 'text-amber-700 bg-amber-50' },
  { prefix: 'PCI-8',  req: '8',  title: 'Identify & Authenticate Users', icon: UserCheck,  color: 'text-yellow-700 bg-yellow-50' },
  { prefix: 'PCI-9',  req: '9',  title: 'Physical Access Controls',      icon: ShieldCheck, color: 'text-amber-700 bg-amber-50' },
  { prefix: 'PCI-10', req: '10', title: 'Logging & Monitoring',          icon: Eye,        color: 'text-orange-700 bg-orange-50' },
  { prefix: 'PCI-11', req: '11', title: 'Security Testing',              icon: AlertTriangle, color: 'text-amber-700 bg-amber-50' },
  { prefix: 'PCI-12', req: '12', title: 'Information Security Policies', icon: FileText,   color: 'text-yellow-700 bg-yellow-50' },
];

const QUICK_LINKS = [
  { href: '/pci-dss/cde-scope',            icon: Network,       label: 'CDE Scope & Network Diagram',       color: 'text-amber-600' },
  { href: '/pci-dss/saq-tracker',          icon: FileText,      label: 'SAQ / Assessment Tracker',          color: 'text-orange-600' },
  { href: '/pci-dss/compensating-controls', icon: ShieldCheck,  label: 'Compensating Controls',             color: 'text-yellow-600' },
];

export default function PciDssDashboardPage() {
  const { data: controls = [], isLoading } = usePciDssControls();

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
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-sm">
            <CreditCard className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">PCI DSS v4.0</h1>
            <p className="text-sm text-gray-500">Payment Card Industry Data Security Standard</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/frameworks/pci-dss"
            target="_blank"
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Reference
          </Link>
          <Link
            href="/controls?framework=PCI_DSS"
            className="flex items-center gap-1.5 text-sm bg-amber-600 text-white px-3 py-1.5 rounded-lg hover:bg-amber-700 transition-colors font-medium"
          >
            View Controls <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Overall Progress', value: `${pct}%`, sub: `${implemented} of ${total} controls`, icon: CheckCircle2, color: 'text-amber-600 bg-amber-50' },
          { label: 'Implemented',      value: implemented, sub: 'controls', icon: CheckCircle2, color: 'text-amber-600 bg-amber-50' },
          { label: 'In Progress',      value: inProgress,  sub: 'controls', icon: RefreshCw,    color: 'text-orange-600 bg-orange-50' },
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
            <span className="text-sm font-semibold text-gray-700">PCI DSS Implementation Progress</span>
            <span className="text-sm font-bold text-amber-600">{pct}%</span>
          </div>
          <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-full transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" />{implemented} implemented</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-400" />{inProgress} in progress</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-200" />{notStarted} not started</span>
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        {/* Requirements breakdown */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
          <div className="px-5 py-4 border-b border-gray-50">
            <h2 className="text-base font-semibold text-gray-900">PCI DSS Requirements</h2>
            <p className="text-xs text-gray-500 mt-0.5">12 requirements across 6 goals</p>
          </div>
          <div className="divide-y divide-gray-50 max-h-96 overflow-y-auto">
            {REQUIREMENTS.map(({ prefix, req, title, icon: Icon, color }) => {
              const reqControls = controls.filter(c => c.code.startsWith(prefix));
              const done = reqControls.filter(c => c.status === 'implemented').length;
              const reqPct = reqControls.length > 0 ? Math.round((done / reqControls.length) * 100) : 0;
              return (
                <div key={prefix} className="flex items-center gap-3 px-5 py-2.5">
                  <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center shrink-0', color.split(' ')[1])}>
                    <Icon className={cn('w-3.5 h-3.5', color.split(' ')[0])} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-mono font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded shrink-0">Req {req}</span>
                      <p className="text-xs font-medium text-gray-800 truncate">{title}</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold text-gray-700">{reqPct}%</p>
                    <p className="text-xs text-gray-400">{done}/{reqControls.length || '?'}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Quick links + CDE info */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
            <div className="px-5 py-4 border-b border-gray-50">
              <h2 className="text-base font-semibold text-gray-900">PCI DSS Modules</h2>
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

          <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl border border-amber-100 p-4">
            <h3 className="text-sm font-semibold text-gray-800 mb-3">PCI DSS Key Facts</h3>
            <div className="space-y-2 text-xs">
              {[
                { label: 'Annual SAQ or QSA Assessment required',      color: 'text-amber-700' },
                { label: 'Quarterly vulnerability scans (ASV required)', color: 'text-orange-700' },
                { label: 'Network segmentation reduces CDE scope',      color: 'text-amber-700' },
                { label: 'Tokenization eliminates cardholder data storage', color: 'text-orange-700' },
              ].map(({ label, color }) => (
                <div key={label} className="flex items-start gap-2 bg-white rounded-lg px-3 py-2 shadow-sm">
                  <CreditCard className={cn('w-3.5 h-3.5 mt-0.5 shrink-0', color)} />
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
