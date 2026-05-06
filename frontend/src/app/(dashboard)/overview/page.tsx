'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient as api } from '@/lib/api/client';
import { complianceApi } from '@/lib/api/compliance';
import { ScoreGauge } from '@/components/charts/ScoreGauge';
import {
  Play, CheckCircle, AlertCircle, Clock, FileText, ClipboardList,
  Zap, AlertTriangle, TrendingUp, Shield, ArrowRight, RefreshCw,
  XCircle, Activity,
} from 'lucide-react';
import { useState } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

function StatCard({ label, value, icon: Icon, sub, color }: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  sub?: string;
  color?: string;
}) {
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-gray-500">{label}</p>
        <Icon className={cn('w-4 h-4', color ?? 'text-gray-400')} />
      </div>
      <p className={cn('text-2xl font-bold', color ? color.replace('text-', 'text-').replace('-400', '-700').replace('-500', '-700') : 'text-gray-900')}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

function AlertBanner({ message, severity, actionHref }: {
  message: string;
  severity: 'critical' | 'warning' | 'info';
  actionHref?: string;
}) {
  const cfg = {
    critical: 'bg-red-50 border-red-200 text-red-800',
    warning: 'bg-amber-50 border-amber-200 text-amber-800',
    info: 'bg-blue-50 border-blue-200 text-blue-800',
  }[severity];

  const Icon = severity === 'critical' ? AlertTriangle : severity === 'warning' ? AlertCircle : Zap;

  return (
    <div className={cn('rounded-lg border px-4 py-3 flex items-start gap-3', cfg)}>
      <Icon className="w-4 h-4 shrink-0 mt-0.5" />
      <p className="text-sm flex-1">{message}</p>
      {actionHref && (
        <Link href={actionHref} className="text-xs font-semibold underline shrink-0 flex items-center gap-1">
          View <ArrowRight className="w-3 h-3" />
        </Link>
      )}
    </div>
  );
}

function RecommendedAction({ action, priority, href, effort }: {
  action: string;
  priority: string;
  href?: string;
  effort?: string;
}) {
  const priorityColor = priority === 'high' ? 'text-red-600' : priority === 'medium' ? 'text-yellow-600' : 'text-green-600';
  const effortBadge = effort === 'low' ? 'bg-green-50 text-green-700' : effort === 'high' ? 'bg-red-50 text-red-700' : 'bg-gray-100 text-gray-600';

  return (
    <div className="flex items-start gap-3 p-3 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors">
      <div className={cn('w-1.5 h-1.5 rounded-full mt-2 shrink-0', priority === 'high' ? 'bg-red-500' : priority === 'medium' ? 'bg-yellow-500' : 'bg-green-500')} />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-800">{action}</p>
        <div className="flex items-center gap-2 mt-1">
          <span className={cn('text-xs font-medium capitalize', priorityColor)}>{priority} priority</span>
          {effort && <span className={cn('text-xs px-1.5 py-0.5 rounded capitalize', effortBadge)}>{effort} effort</span>}
        </div>
      </div>
      {href && (
        <Link href={href} className="text-brand-600 hover:text-brand-700 shrink-0">
          <ArrowRight className="w-4 h-4" />
        </Link>
      )}
    </div>
  );
}

// ─── Compliance Health Widget ─────────────────────────────────────────────────

function ComplianceHealthWidget() {
  const qc = useQueryClient();

  const { data: summary, isLoading } = useQuery({
    queryKey: ['control-test-summary'],
    queryFn:  complianceApi.getControlTestSummary,
    refetchInterval: 30_000,
  });

  const { data: results } = useQuery({
    queryKey: ['control-test-results'],
    queryFn:  complianceApi.getControlTestResults,
  });

  const runAll = useMutation({
    mutationFn: complianceApi.runAllControlTests,
    onSuccess: () => {
      setTimeout(() => {
        qc.invalidateQueries({ queryKey: ['control-test-summary'] });
        qc.invalidateQueries({ queryKey: ['control-test-results'] });
      }, 3000);
    },
  });

  const failing = (results ?? []).filter((r: any) => r.outcome === 'fail');

  if (isLoading) {
    return (
      <div className="card p-5 animate-pulse">
        <div className="h-4 bg-gray-100 rounded w-40 mb-4" />
        <div className="h-20 bg-gray-50 rounded" />
      </div>
    );
  }

  const passRate  = summary?.passRate ?? 0;
  const total     = summary?.total ?? 0;
  const rateColor = passRate >= 80 ? 'text-emerald-600' : passRate >= 60 ? 'text-amber-600' : 'text-red-500';
  const barColor  = passRate >= 80 ? 'bg-emerald-500' : passRate >= 60 ? 'bg-amber-500' : 'bg-red-500';

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-brand-600" />
          <h2 className="text-sm font-semibold text-gray-900">Compliance Health</h2>
          <span className="text-xs text-gray-400 font-normal">automated tests · every 6h</span>
        </div>
        <button
          className="btn-secondary text-xs px-2.5 py-1 flex items-center gap-1.5"
          onClick={() => runAll.mutate()}
          disabled={runAll.isPending}
        >
          <Play className={cn('w-3 h-3', runAll.isPending && 'animate-spin')} />
          {runAll.isPending ? 'Running…' : 'Run now'}
        </button>
      </div>

      {total === 0 ? (
        <div className="text-center py-6 text-gray-400">
          <Activity className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">No tests run yet. Click "Run now" to start.</p>
        </div>
      ) : (
        <>
          {/* Pass rate bar */}
          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className={cn('h-full rounded-full transition-all duration-500', barColor)} style={{ width: `${passRate}%` }} />
            </div>
            <span className={cn('text-sm font-bold tabular-nums w-10 text-right', rateColor)}>{passRate}%</span>
          </div>

          {/* Counts row */}
          <div className="grid grid-cols-4 gap-2 mb-4">
            {[
              { label: 'Pass',    count: summary?.pass,    color: 'text-emerald-600', bg: 'bg-emerald-50' },
              { label: 'Fail',    count: summary?.fail,    color: 'text-red-500',     bg: 'bg-red-50' },
              { label: 'Error',   count: summary?.error,   color: 'text-amber-600',   bg: 'bg-amber-50' },
              { label: 'Skipped', count: summary?.skipped, color: 'text-gray-500',    bg: 'bg-gray-50' },
            ].map(({ label, count, color, bg }) => (
              <div key={label} className={cn('rounded-lg p-2 text-center', bg)}>
                <p className={cn('text-lg font-bold', color)}>{count ?? 0}</p>
                <p className={cn('text-xs', color)}>{label}</p>
              </div>
            ))}
          </div>

          {/* Failing tests list */}
          {failing.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-gray-500 mb-2">Failing tests</p>
              {failing.slice(0, 4).map((r: any) => (
                <div key={r.testId} className="flex items-center gap-2 text-xs p-2 bg-red-50 rounded-lg">
                  <XCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                  <span className="text-gray-700 flex-1 truncate">{r.definition?.name ?? r.testId}</span>
                  <span className="text-gray-400 font-mono shrink-0">{r.controlCode}</span>
                </div>
              ))}
              {failing.length > 4 && (
                <p className="text-xs text-gray-400 text-center pt-1">+{failing.length - 4} more failing</p>
              )}
            </div>
          )}

          {failing.length === 0 && (
            <div className="flex items-center gap-2 text-xs text-emerald-600 bg-emerald-50 rounded-lg p-2.5">
              <CheckCircle className="w-3.5 h-3.5 shrink-0" />
              All {summary?.pass} automated tests passing
            </div>
          )}
        </>
      )}

      <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
        <Link href="/settings" className="text-xs text-gray-400 hover:text-gray-600">
          Configure integrations
        </Link>
        <Link href="/evidence" className="text-xs text-brand-600 hover:text-brand-700 font-medium flex items-center gap-1">
          View evidence <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OverviewPage() {
  const qc = useQueryClient();
  const [triggered, setTriggered] = useState<string | null>(null);

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['org-stats'],
    queryFn: complianceApi.getOrgStats,
  });

  const { data: readiness } = useQuery({
    queryKey: ['readiness-breakdown'],
    queryFn: () => api.get('/readiness/breakdown').then((r: any) => r.data),
  });

  const { data: dashboardConfig } = useQuery({
    queryKey: ['dashboard-config'],
    queryFn: () => api.get('/dashboard/config?role=executive').then((r: any) => r.data),
  });

  const { data: riskStats } = useQuery({
    queryKey: ['risk-stats'],
    queryFn: () => api.get('/risks/stats').then((r: any) => r.data),
  });

  const assess = useMutation({
    mutationFn: (frameworkType: string) => complianceApi.triggerAssessment(frameworkType),
    onSuccess: (_, type) => {
      setTriggered(type);
      qc.invalidateQueries({ queryKey: ['org-stats'] });
    },
  });

  const recalculate = useMutation({
    mutationFn: () => api.post('/readiness/recalculate').then((r: any) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['readiness-breakdown'] }),
  });

  // Use readiness score from the new deterministic engine if available, else fall back to legacy
  const score = readiness?.overallScore ?? stats?.complianceScore ?? 0;
  const readinessLabel = score >= 85 ? 'Audit Ready' : score >= 70 ? 'Near Ready' : score >= 40 ? 'In Progress' : 'Early Stage';
  const readinessColor = score >= 85 ? 'text-green-600' : score >= 70 ? 'text-blue-600' : score >= 40 ? 'text-yellow-600' : 'text-red-600';

  const alerts: any[] = dashboardConfig?.alerts ?? [];
  const recommendedActions: any[] = dashboardConfig?.recommendedActions ?? [];

  if (statsLoading) {
    return (
      <div className="p-8 flex items-center justify-center h-full">
        <div className="w-6 h-6 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Compliance Overview</h1>
          <p className="text-sm text-gray-500 mt-0.5">Real-time posture across all active frameworks</p>
        </div>
        <button
          className="btn-secondary flex items-center gap-2 text-sm"
          onClick={() => recalculate.mutate()}
          disabled={recalculate.isPending}
        >
          <RefreshCw className={cn('w-4 h-4', recalculate.isPending && 'animate-spin')} />
          Recalculate Score
        </button>
      </div>

      {/* Alerts from dashboard config */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((alert: any, i: number) => (
            <AlertBanner key={i} message={alert.message} severity={alert.severity} actionHref={alert.actionHref} />
          ))}
        </div>
      )}

      {triggered && (
        <AlertBanner
          severity="info"
          message={`Assessment pipeline triggered for ${triggered}. Results appear as agents complete.`}
        />
      )}

      {/* Score + quick stats */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="card p-6 flex flex-col items-center justify-center">
          <p className="text-sm font-medium text-gray-500 mb-1">Readiness Score</p>
          <ScoreGauge score={Math.round(score)} />
          <span className={cn('text-xs font-semibold mt-2', readinessColor)}>{readinessLabel}</span>
          {readiness?.formulaVersion && (
            <p className="text-xs text-gray-400 mt-1">Formula v{readiness.formulaVersion}</p>
          )}
        </div>

        <div className="lg:col-span-3 grid grid-cols-2 sm:grid-cols-3 gap-4">
          <StatCard
            label="Controls"
            value={`${stats?.implementedControls ?? 0}/${stats?.totalControls ?? 0}`}
            icon={CheckCircle}
            sub="implemented"
          />
          <StatCard
            label="Evidence"
            value={stats?.totalEvidence ?? 0}
            icon={FileText}
            sub="items collected"
          />
          <StatCard
            label="Open Tasks"
            value={stats?.openTasks ?? 0}
            icon={ClipboardList}
            sub="pending action"
          />
          <StatCard
            label="High Risks"
            value={riskStats?.highRisks ?? 0}
            icon={AlertTriangle}
            sub="open critical+high"
            color={riskStats?.highRisks > 0 ? 'text-red-500' : 'text-gray-400'}
          />
          <StatCard
            label="Control Score"
            value={readiness ? `${readiness.controlDesignScore}%` : '—'}
            icon={Shield}
            sub="35% weight"
          />
          <StatCard
            label="Evidence Score"
            value={readiness ? `${readiness.evidenceScore}%` : '—'}
            icon={TrendingUp}
            sub="30% weight"
          />
        </div>
      </div>

      {/* Compliance Health — live automated test results */}
      <ComplianceHealthWidget />

      {/* Recommended actions + trigger assessments */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recommended actions */}
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Recommended Actions</h2>
          {recommendedActions.length > 0 ? (
            <div className="space-y-2">
              {recommendedActions.slice(0, 5).map((ra: any, i: number) => (
                <RecommendedAction key={i} action={ra.action} priority={ra.priority} href={ra.href} effort={ra.effort} />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {[
                { action: 'Run the Readiness Score calculation to get your baseline', priority: 'high', href: '/readiness', effort: 'low' },
                { action: 'Define your SOC 2 scope and Trust Service Categories', priority: 'high', href: '/scope', effort: 'low' },
                { action: 'Review the Control Library and mark applicable controls', priority: 'medium', href: '/control-library', effort: 'medium' },
                { action: 'Upload evidence for implemented controls', priority: 'medium', href: '/evidence', effort: 'high' },
                { action: 'Generate your first audit export package', priority: 'low', href: '/audit-exports', effort: 'low' },
              ].map((ra, i) => (
                <RecommendedAction key={i} {...ra} />
              ))}
            </div>
          )}
        </div>

        {/* Trigger assessments */}
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Run Assessment</h2>
          <div className="space-y-3">
            {[
              { type: 'SOC2', description: 'Full AI-powered SOC 2 Type II readiness assessment', icon: Shield },
              { type: 'ISO27001', description: 'ISO 27001:2022 ISMS gap analysis and Statement of Applicability', icon: FileText },
            ].map(({ type, description, icon: Icon }) => (
              <div key={type} className="flex items-start justify-between gap-4 p-4 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-brand-50 flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4 text-brand-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{type}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{description}</p>
                  </div>
                </div>
                <button
                  className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5 shrink-0"
                  onClick={() => assess.mutate(type)}
                  disabled={assess.isPending}
                >
                  <Play className="w-3 h-3" /> Run
                </button>
              </div>
            ))}

            <div className="flex items-center gap-3 pt-2 border-t border-gray-100">
              <Link href="/readiness" className="text-xs text-brand-600 hover:text-brand-700 font-medium flex items-center gap-1">
                View readiness breakdown <ArrowRight className="w-3 h-3" />
              </Link>
              <Link href="/audit-exports" className="text-xs text-brand-600 hover:text-brand-700 font-medium flex items-center gap-1">
                Generate audit export <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Readiness breakdown mini-view */}
      {readiness && (
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-900">Score Breakdown</h2>
            <Link href="/readiness" className="text-xs text-brand-600 hover:text-brand-700 font-medium flex items-center gap-1">
              Full breakdown <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Controls', score: readiness.controlDesignScore, weight: '35%' },
              { label: 'Evidence', score: readiness.evidenceScore, weight: '30%' },
              { label: 'Policies', score: readiness.policyScore, weight: '25%' },
              { label: 'Operational', score: readiness.operationalScore, weight: '10%' },
            ].map((item) => (
              <div key={item.label} className="text-center">
                <p className="text-xs text-gray-400 mb-1">{item.label} <span className="opacity-60">({item.weight})</span></p>
                <div className="relative h-1.5 bg-gray-100 rounded-full overflow-hidden mb-1">
                  <div
                    className={cn('h-full rounded-full', item.score >= 75 ? 'bg-green-500' : item.score >= 50 ? 'bg-yellow-500' : 'bg-red-500')}
                    style={{ width: `${item.score}%` }}
                  />
                </div>
                <p className="text-sm font-bold text-gray-900">{item.score}%</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
