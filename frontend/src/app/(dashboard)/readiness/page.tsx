'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient as api } from '@/lib/api/client';
import { BarChart3, RefreshCw, TrendingUp, Shield, FileText, FolderOpen, Zap, AlertTriangle } from 'lucide-react';
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

  const recalculate = useMutation({
    mutationFn: () => api.post('/readiness/recalculate').then((r: any) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['readiness-breakdown'] });
      qc.invalidateQueries({ queryKey: ['readiness-history'] });
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
