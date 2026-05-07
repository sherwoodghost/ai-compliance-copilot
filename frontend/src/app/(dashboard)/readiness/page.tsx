'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient as api } from '@/lib/api/client';
import {
  BarChart3, RefreshCw, TrendingUp, TrendingDown, Minus,
  Shield, FileText, FolderOpen, Zap, AlertTriangle, Calendar, Rocket,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type ReadinessScore = {
  overallScore: number;
  controlDesignScore: number;
  evidenceScore: number;
  policyScore: number;
  operationalScore: number;
  riskManagementScore: number;
  framework: string;
  formulaVersion: string;
  snapshotAt: string;
  scoreInputs: {
    applicableControls: number;
    implementedControls: number;
    requiredEvidenceItems: number;
    validEvidenceItems: number;
    requiredPolicies: number;
    approvedPolicies: number;
    openHighRisks: number;
    overdueTasks: number;
    openCheckpoints: number;
  };
};

function GradeRing({ score, label }: { score: number; label: string }) {
  const grade = score >= 90 ? 'A' : score >= 75 ? 'B' : score >= 60 ? 'C' : score >= 40 ? 'D' : 'F';
  const color = score >= 75 ? 'text-green-600' : score >= 50 ? 'text-yellow-600' : 'text-red-600';
  const bg = score >= 75 ? 'bg-green-50 border-green-200' : score >= 50 ? 'bg-yellow-50 border-yellow-200' : 'bg-red-50 border-red-200';

  return (
    <div className={cn('flex flex-col items-center p-5 rounded-xl border-2', bg)}>
      <span className={cn('text-4xl font-black', color)}>{grade}</span>
      <span className={cn('text-2xl font-bold', color)}>{score}%</span>
      <span className="text-xs text-gray-500 mt-1">{label}</span>
    </div>
  );
}

function ScoreBar({ label, score, icon: Icon, sub }: {
  label: string;
  score: number;
  icon: React.ElementType;
  sub?: string;
}) {
  const color = score >= 75 ? 'bg-green-500' : score >= 50 ? 'bg-yellow-500' : 'bg-red-500';

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-gray-400" />
          <span className="text-sm font-medium text-gray-700">{label}</span>
          {sub && <span className="text-xs text-gray-400">({sub})</span>}
        </div>
        <span className="text-sm font-bold text-gray-900">{score}%</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full transition-all duration-500', color)} style={{ width: `${score}%` }} />
      </div>
    </div>
  );
}

function ReadinessLabel({ score }: { score: number }) {
  const { label, color } = score >= 85
    ? { label: 'Audit Ready', color: 'bg-green-100 text-green-800' }
    : score >= 70
    ? { label: 'Near Ready', color: 'bg-blue-100 text-blue-800' }
    : score >= 40
    ? { label: 'In Progress', color: 'bg-yellow-100 text-yellow-800' }
    : score >= 10
    ? { label: 'Early Stage', color: 'bg-orange-100 text-orange-800' }
    : { label: 'Not Started', color: 'bg-red-100 text-red-800' };

  return <span className={cn('text-xs font-semibold px-2.5 py-1 rounded-full', color)}>{label}</span>;
}

type VelocityData = {
  summary: {
    totalControls: number;
    implementedControls: number;
    inProgressControls: number;
    remainingControls: number;
    readinessPct: number;
  };
  velocity: {
    completedLast30Days: number;
    completedPrev30Days: number;
    dailyRate: number;
    trend: 'up' | 'down' | 'flat';
    evidenceLast30Days: number;
    tasksCompleted30Days: number;
  };
  forecast: {
    daysToCompletion: number | null;
    estimatedCompletionDate: string | null;
    acceleratedScenario: {
      description: string;
      daysToCompletion: number | null;
      daysSaved: number | null;
    };
  };
};

function VelocityWidget({ data }: { data: VelocityData }) {
  const { summary, velocity, forecast } = data;

  const TrendIcon = velocity.trend === 'up'
    ? TrendingUp
    : velocity.trend === 'down'
    ? TrendingDown
    : Minus;

  const trendColor = velocity.trend === 'up'
    ? 'text-emerald-600'
    : velocity.trend === 'down'
    ? 'text-red-600'
    : 'text-gray-400';

  const completionDate = forecast.estimatedCompletionDate
    ? new Date(forecast.estimatedCompletionDate)
    : null;

  return (
    <div className="card p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
          <Rocket className="w-4 h-4 text-brand-500" />
          Compliance Velocity
        </h2>
        <span className="text-xs text-gray-400">Last 30 days</span>
      </div>

      {/* Velocity stats row */}
      <div className="grid grid-cols-3 gap-4">
        <div className="text-center">
          <div className="flex items-center justify-center gap-1 mb-0.5">
            <span className="text-2xl font-black text-gray-900">{velocity.completedLast30Days}</span>
            <TrendIcon className={cn('w-4 h-4', trendColor)} />
          </div>
          <p className="text-xs text-gray-500">Controls completed</p>
          <p className={cn('text-xs font-medium mt-0.5', trendColor)}>
            vs {velocity.completedPrev30Days} prev period
          </p>
        </div>
        <div className="text-center">
          <span className="text-2xl font-black text-gray-900">{velocity.evidenceLast30Days}</span>
          <p className="text-xs text-gray-500">Evidence items</p>
          <p className="text-xs text-gray-400 mt-0.5">collected</p>
        </div>
        <div className="text-center">
          <span className="text-2xl font-black text-gray-900">{velocity.tasksCompleted30Days}</span>
          <p className="text-xs text-gray-500">Tasks closed</p>
          <p className="text-xs text-gray-400 mt-0.5">this period</p>
        </div>
      </div>

      {/* Progress bar */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs text-gray-500">
            {summary.implementedControls} of {summary.totalControls} controls done
          </span>
          <span className="text-xs font-bold text-gray-900">{summary.readinessPct}%</span>
        </div>
        <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-brand-500 to-indigo-500 rounded-full transition-all duration-700"
            style={{ width: `${summary.readinessPct}%` }}
          />
        </div>
        <p className="text-xs text-gray-400 mt-1">
          {summary.remainingControls} remaining · {summary.inProgressControls} in progress
        </p>
      </div>

      {/* Forecast */}
      {forecast.daysToCompletion != null ? (
        <div className="space-y-3">
          <div className="rounded-xl bg-brand-50 border border-brand-100 p-4 flex items-start gap-3">
            <Calendar className="w-5 h-5 text-brand-600 shrink-0 mt-0.5" />
            <div>
              {forecast.daysToCompletion === 0 ? (
                <p className="text-sm font-bold text-emerald-700">🎉 All controls implemented!</p>
              ) : (
                <>
                  <p className="text-sm font-bold text-brand-900">
                    Estimated audit-ready in <span className="text-brand-600">{forecast.daysToCompletion} days</span>
                  </p>
                  {completionDate && (
                    <p className="text-xs text-brand-700 mt-0.5">
                      ~ {completionDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                      {' '}at current pace ({velocity.dailyRate} controls/day)
                    </p>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Accelerated scenario */}
          {forecast.acceleratedScenario.daysSaved != null &&
           forecast.acceleratedScenario.daysSaved > 0 && (
            <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-3 flex items-start gap-2">
              <Zap className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-emerald-800">
                  Accelerated: {forecast.acceleratedScenario.description}
                </p>
                <p className="text-xs text-emerald-700 mt-0.5">
                  Could complete in{' '}
                  <strong>{forecast.acceleratedScenario.daysToCompletion} days</strong>
                  {' '}— saving <strong>{forecast.acceleratedScenario.daysSaved} days</strong>
                </p>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-xl bg-amber-50 border border-amber-100 p-3">
          <p className="text-xs text-amber-800 font-medium">No velocity data yet</p>
          <p className="text-xs text-amber-700 mt-0.5">
            Start implementing controls — the forecast will appear once you have activity in the last 30 days.
          </p>
        </div>
      )}
    </div>
  );
}

export default function ReadinessPage() {
  const qc = useQueryClient();

  const { data: breakdown, isLoading } = useQuery<ReadinessScore>({
    queryKey: ['readiness-breakdown'],
    queryFn: () => api.get('/readiness/breakdown').then((r: any) => r.data),
  });

  const { data: history } = useQuery<ReadinessScore[]>({
    queryKey: ['readiness-history'],
    queryFn: () => api.get('/readiness/history?limit=10').then((r: any) => r.data),
  });

  const { data: velocityData } = useQuery<VelocityData>({
    queryKey: ['readiness-velocity'],
    queryFn: () => api.get('/readiness/velocity').then((r: any) => r.data),
  });

  const recalculate = useMutation({
    mutationFn: () => api.post('/readiness/recalculate').then((r: any) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['readiness-breakdown'] });
      qc.invalidateQueries({ queryKey: ['readiness-history'] });
      qc.invalidateQueries({ queryKey: ['readiness-velocity'] });
    },
  });

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-brand-100 flex items-center justify-center">
            <BarChart3 className="w-5 h-5 text-brand-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Readiness Score</h1>
            <p className="text-sm text-gray-500">Deterministic formula — no AI estimates</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {breakdown && <ReadinessLabel score={breakdown.overallScore} />}
          <button
            className="btn-secondary flex items-center gap-2 text-sm"
            onClick={() => recalculate.mutate()}
            disabled={recalculate.isPending}
          >
            <RefreshCw className={cn('w-4 h-4', recalculate.isPending && 'animate-spin')} />
            Recalculate
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
      ) : breakdown && typeof breakdown.overallScore === 'number' ? (
        <>
          {/* Grade overview */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <GradeRing score={breakdown.overallScore} label="Overall" />
            <GradeRing score={breakdown.controlDesignScore} label="Controls" />
            <GradeRing score={breakdown.evidenceScore} label="Evidence" />
            <GradeRing score={breakdown.policyScore} label="Policies" />
          </div>

          {/* Velocity & Forecast */}
          {velocityData && <VelocityWidget data={velocityData} />}

          {/* Detailed breakdown */}
          <div className="card p-6 space-y-5">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-sm font-semibold text-gray-900">Score Breakdown</h2>
              <span className="text-xs text-gray-400">Formula v{breakdown.formulaVersion} · {breakdown.framework}</span>
            </div>

            <ScoreBar label="Control Design" score={breakdown.controlDesignScore} icon={Shield}
              sub={`${breakdown.scoreInputs?.implementedControls ?? 0}/${breakdown.scoreInputs?.applicableControls ?? 0} implemented · weight 35%`} />
            <ScoreBar label="Evidence" score={breakdown.evidenceScore} icon={FolderOpen}
              sub={`${breakdown.scoreInputs?.validEvidenceItems ?? 0}/${breakdown.scoreInputs?.requiredEvidenceItems ?? 0} items valid · weight 30%`} />
            <ScoreBar label="Policy" score={breakdown.policyScore} icon={FileText}
              sub={`${breakdown.scoreInputs?.approvedPolicies ?? 0}/${breakdown.scoreInputs?.requiredPolicies ?? 0} approved · weight 25%`} />
            <ScoreBar label="Operational" score={breakdown.operationalScore} icon={Zap}
              sub={`${breakdown.scoreInputs?.overdueTasks ?? 0} overdue tasks · weight 10%`} />
            {breakdown.framework !== 'SOC2' && (
              <ScoreBar label="Risk Management" score={breakdown.riskManagementScore} icon={AlertTriangle}
                sub={`${breakdown.scoreInputs?.openHighRisks ?? 0} open high risks · weight 15% (ISO)`} />
            )}
          </div>

          {/* Score history */}
          {history && history.length > 1 && (
            <div className="card p-5">
              <h2 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-brand-500" />
                Score History
              </h2>
              <div className="space-y-2">
                {history.slice(0, 10).map((h, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="text-xs text-gray-400 w-32 shrink-0">
                      {new Date(h.snapshotAt).toLocaleDateString()}
                    </span>
                    <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={cn('h-full rounded-full', h.overallScore >= 75 ? 'bg-green-500' : h.overallScore >= 50 ? 'bg-yellow-500' : 'bg-red-500')}
                        style={{ width: `${h.overallScore}%` }}
                      />
                    </div>
                    <span className="text-xs font-bold text-gray-700 w-8 text-right">{h.overallScore}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Snapshot info */}
          <p className="text-xs text-gray-400 text-center">
            Last calculated: {new Date(breakdown.snapshotAt).toLocaleString()} · Scores are deterministic math — no AI estimates
          </p>
        </>
      ) : (
        <div className="card p-10 text-center">
          <BarChart3 className="w-10 h-10 mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500 mb-4">No readiness score computed yet</p>
          <button className="btn-primary" onClick={() => recalculate.mutate()} disabled={recalculate.isPending}>
            Calculate Now
          </button>
        </div>
      )}
    </div>
  );
}
