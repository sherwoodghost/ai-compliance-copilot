'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { readinessApi } from '@/lib/api/readiness';
import {
  BarChart3, RefreshCw, TrendingUp, TrendingDown, Minus,
  Shield, FileText, FolderOpen, Zap, AlertTriangle, Calendar, Rocket,
  Users, Award, ChevronRight, Sparkles, X, Clock, ArrowRight,
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

// ─── Benchmark types ─────────────────────────────────────────────────────────

type BenchmarkData = {
  orgScore: number;
  framework: string;
  cohort: {
    industry: string;
    sizeBucket: string;
    peerCount: number;
    averageScore: number;
    medianScore: number;
    topQuartile: number;
    bottomQuartile: number;
  };
  percentile: number;
  percentileLabel: string;
  topPerformerScore: number;
  distribution: Array<{ range: string; count: number; label: string }>;
  commonGaps: string[];
  improvementTip: string;
};

function BenchmarkWidget({ data }: { data: BenchmarkData }) {
  const { orgScore, cohort, percentile, percentileLabel, commonGaps, improvementTip, topPerformerScore } = data;
  const abovePeer = orgScore >= cohort.averageScore;
  const maxCount = Math.max(...data.distribution.map((d) => d.count));

  return (
    <div className="card p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
          <Users className="w-4 h-4 text-brand-500" />
          Peer Benchmark
        </h2>
        <span className="text-xs text-gray-400">{cohort.industry} · {cohort.sizeBucket} employees · {cohort.peerCount.toLocaleString()} peers</span>
      </div>

      {/* Percentile badge */}
      <div className="flex items-center gap-4">
        <div className={cn(
          'flex flex-col items-center justify-center w-24 h-24 rounded-2xl border-2 shrink-0',
          percentile >= 75 ? 'bg-emerald-50 border-emerald-200' :
          percentile >= 50 ? 'bg-blue-50 border-blue-200' :
          'bg-amber-50 border-amber-200',
        )}>
          <span className={cn(
            'text-2xl font-black',
            percentile >= 75 ? 'text-emerald-700' : percentile >= 50 ? 'text-blue-700' : 'text-amber-700',
          )}>
            {percentile}
            <span className="text-sm font-bold">th</span>
          </span>
          <span className="text-xs text-gray-500 mt-0.5">percentile</span>
        </div>

        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn(
              'text-sm font-bold px-2.5 py-1 rounded-full',
              percentile >= 75 ? 'bg-emerald-100 text-emerald-800' : percentile >= 50 ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800',
            )}>
              <Award className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />
              {percentileLabel}
            </span>
            <span className="text-xs text-gray-500">
              of {cohort.industry} companies
            </span>
          </div>
          <p className="text-xs text-gray-600">{improvementTip}</p>
          <div className="flex items-center gap-4 text-xs">
            <div>
              <span className="text-gray-400">Peer avg </span>
              <span className={cn('font-bold', abovePeer ? 'text-emerald-600' : 'text-amber-600')}>
                {cohort.averageScore}%
              </span>
              <span className={cn('ml-1', abovePeer ? 'text-emerald-600' : 'text-amber-600')}>
                {abovePeer ? `↑ you're +${orgScore - cohort.averageScore}` : `↓ you're -${cohort.averageScore - orgScore}`}
              </span>
            </div>
            <div>
              <span className="text-gray-400">Top performer </span>
              <span className="font-bold text-gray-700">{topPerformerScore}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Distribution bar chart */}
      <div>
        <p className="text-xs font-medium text-gray-500 mb-2">Score distribution across {cohort.peerCount.toLocaleString()} peers</p>
        <div className="flex items-end gap-1 h-14">
          {data.distribution.map((bucket) => {
            const height = maxCount > 0 ? Math.max(4, Math.round((bucket.count / maxCount) * 100)) : 4;
            const [low, high] = bucket.range.split('-').map(Number);
            const isOrgBucket = orgScore >= low && orgScore <= high;
            return (
              <div key={bucket.range} className="flex flex-col items-center flex-1" title={`${bucket.label}: ~${bucket.count} companies`}>
                <div
                  className={cn(
                    'w-full rounded-sm transition-all duration-500',
                    isOrgBucket
                      ? 'bg-brand-600 ring-2 ring-brand-300'
                      : 'bg-gray-200 hover:bg-gray-300',
                  )}
                  style={{ height: `${height}%` }}
                />
                <span className="text-[9px] text-gray-400 mt-0.5 leading-none">{bucket.range.split('-')[0]}</span>
              </div>
            );
          })}
        </div>
        <p className="text-xs text-gray-400 mt-1 text-center">
          <span className="inline-block w-2 h-2 bg-brand-600 rounded-sm mr-1" />
          Your score ({orgScore}%) highlighted
        </p>
      </div>

      {/* Common gaps */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
          Most common gaps in your cohort
        </p>
        <div className="space-y-1.5">
          {commonGaps.map((gap, i) => (
            <div key={i} className="flex items-start gap-2 text-xs text-gray-600">
              <ChevronRight className="w-3 h-3 text-amber-500 shrink-0 mt-0.5" />
              {gap}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── AI Coaching Panel ────────────────────────────────────────────────────────

type CoachingItem = {
  priority: number;
  action: string;
  impact: string;
  effort: 'low' | 'medium' | 'high';
  timeEstimate: string;
  category: string;
  why: string;
};

type CoachingResult = {
  summary: string;
  scoreToUnlock: string;
  focusArea: string;
  coachingItems: CoachingItem[];
  currentScore: number;
  generatedAt: string;
};

const EFFORT_CONFIG = {
  low:    { cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', label: 'Low effort' },
  medium: { cls: 'bg-amber-50 text-amber-700 border-amber-200',       label: 'Medium effort' },
  high:   { cls: 'bg-red-50 text-red-700 border-red-200',             label: 'High effort' },
};

const CATEGORY_ICON: Record<string, React.ElementType> = {
  evidence: FolderOpen, controls: Shield, policies: FileText,
  operational: Zap, risks: AlertTriangle,
};

function CoachingPanel({ data, onClose }: { data: CoachingResult; onClose: () => void }) {
  return (
    <div className="card border-purple-200 bg-purple-50/30 p-6 space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-purple-600 shrink-0" />
          <div>
            <h2 className="text-sm font-semibold text-gray-900">AI Coaching Plan</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Based on current score ({data.currentScore}%) · Target: {data.scoreToUnlock}
            </p>
          </div>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 shrink-0">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Summary */}
      <div className="rounded-xl bg-white border border-purple-100 px-4 py-3">
        <p className="text-sm text-gray-700">{data.summary}</p>
      </div>

      {/* Coaching items */}
      <div className="space-y-3">
        {data.coachingItems.map((item) => {
          const Icon = CATEGORY_ICON[item.category] ?? Shield;
          const effortCfg = EFFORT_CONFIG[item.effort] ?? EFFORT_CONFIG.medium;
          return (
            <div key={item.priority} className="bg-white rounded-xl border border-gray-100 p-4 space-y-2">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-purple-100 text-purple-700 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                  {item.priority}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900">{item.action}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{item.why}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap ml-9">
                <span className="inline-flex items-center gap-1 text-xs font-medium text-purple-700 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-full">
                  <ArrowRight className="w-3 h-3" /> {item.impact}
                </span>
                <span className={cn('inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border', effortCfg.cls)}>
                  {effortCfg.label}
                </span>
                {item.timeEstimate && (
                  <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                    <Clock className="w-3 h-3" /> {item.timeEstimate}
                  </span>
                )}
                <span className="inline-flex items-center gap-1 text-xs text-gray-400">
                  <Icon className="w-3 h-3" /> {item.category}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-gray-400 text-center">
        Generated {new Date(data.generatedAt).toLocaleString()} — refresh score then re-generate to update
      </p>
    </div>
  );
}

export default function ReadinessPage() {
  const qc = useQueryClient();
  const [coaching, setCoaching] = useState<CoachingResult | null>(null);

  const { data: breakdown, isLoading } = useQuery<ReadinessScore>({
    queryKey: ['readiness-breakdown'],
    queryFn: () => readinessApi.getBreakdown() as unknown as Promise<ReadinessScore>,
  });

  const { data: history } = useQuery<ReadinessScore[]>({
    queryKey: ['readiness-history'],
    queryFn: () => readinessApi.getHistory(10) as unknown as Promise<ReadinessScore[]>,
  });

  const { data: velocityData } = useQuery<VelocityData>({
    queryKey: ['readiness-velocity'],
    queryFn: () => readinessApi.getVelocity() as unknown as Promise<VelocityData>,
  });

  const { data: benchmark } = useQuery<BenchmarkData>({
    queryKey: ['readiness-benchmark'],
    queryFn: () => readinessApi.getBenchmark() as unknown as Promise<BenchmarkData>,
    staleTime: 10 * 60 * 1000, // 10 minutes — benchmark data is stable
  });

  const recalculate = useMutation({
    mutationFn: () => readinessApi.recalculate(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['readiness-breakdown'] });
      qc.invalidateQueries({ queryKey: ['readiness-history'] });
      qc.invalidateQueries({ queryKey: ['readiness-velocity'] });
      qc.invalidateQueries({ queryKey: ['readiness-benchmark'] });
    },
  });

  const getCoaching = useMutation({
    mutationFn: () => readinessApi.aiCoach(),
    onSuccess: (data) => setCoaching(data as unknown as typeof coaching),
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
          {breakdown && (
            <button
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-purple-50 border border-purple-200 text-purple-700 text-sm font-medium hover:bg-purple-100 transition-colors disabled:opacity-60"
              onClick={() => getCoaching.mutate()}
              disabled={getCoaching.isPending}
            >
              {getCoaching.isPending
                ? <><span className="w-3.5 h-3.5 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />Analysing…</>
                : <><Sparkles className="w-3.5 h-3.5" />AI Coach</>
              }
            </button>
          )}
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

          {/* AI Coaching Panel */}
          {coaching && <CoachingPanel data={coaching} onClose={() => setCoaching(null)} />}

          {/* Velocity & Forecast */}
          {velocityData && <VelocityWidget data={velocityData} />}

          {/* Peer Benchmark */}
          {benchmark && benchmark.cohort && <BenchmarkWidget data={benchmark} />}

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
