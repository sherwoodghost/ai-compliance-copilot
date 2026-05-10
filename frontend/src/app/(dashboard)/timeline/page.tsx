'use client';

import { useQuery } from '@tanstack/react-query';
import { gapAnalysisApi, TimelineMilestone, ComplianceVelocity } from '@/lib/api/gap-analysis';
import {
  Clock, CheckCircle2, AlertCircle, Circle, ChevronRight,
  TrendingUp, Calendar, BarChart3, AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const STATUS_CONFIG = {
  completed: { icon: CheckCircle2, color: 'text-green-500', bg: 'bg-green-50', border: 'border-green-200', label: 'Completed' },
  in_progress: { icon: Clock, color: 'text-blue-500', bg: 'bg-blue-50', border: 'border-blue-200', label: 'In Progress' },
  upcoming: { icon: Circle, color: 'text-gray-400', bg: 'bg-gray-50', border: 'border-gray-200', label: 'Upcoming' },
  at_risk: { icon: AlertCircle, color: 'text-red-500', bg: 'bg-red-50', border: 'border-red-200', label: 'At Risk' },
};

function PhaseIndicator({ phase, progress }: { phase: string; progress: number }) {
  const phases = ['Getting Started', 'Foundation Building', 'Implementation', 'Final Review', 'Audit Ready'];
  const currentIndex = phases.indexOf(phase);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-800">Current Phase</h3>
          <p className="text-2xl font-bold text-brand-600 mt-0.5">{phase}</p>
        </div>
        <div className="text-right">
          <p className="text-3xl font-bold text-gray-900">{progress}%</p>
          <p className="text-xs text-gray-500">overall progress</p>
        </div>
      </div>
      <div className="flex items-center gap-1">
        {phases.map((p, i) => (
          <div key={p} className="flex-1 flex items-center">
            <div className={cn(
              'h-2 flex-1 rounded-full',
              i < currentIndex ? 'bg-green-400' :
              i === currentIndex ? 'bg-brand-500' :
              'bg-gray-200',
            )} />
            {i < phases.length - 1 && <ChevronRight className="w-3 h-3 text-gray-300 mx-0.5 flex-shrink-0" />}
          </div>
        ))}
      </div>
      <div className="flex justify-between mt-1">
        {phases.map((p, i) => (
          <span key={p} className={cn(
            'text-[9px]',
            i <= currentIndex ? 'text-brand-600 font-medium' : 'text-gray-400',
          )}>
            {p}
          </span>
        ))}
      </div>
    </div>
  );
}

function StatsRow({ weeksActive, avgVelocity, projectedDate }: {
  weeksActive: number; avgVelocity: number; projectedDate: string | null;
}) {
  return (
    <div className="grid grid-cols-3 gap-4">
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center gap-2 text-gray-500 mb-1">
          <Calendar className="w-4 h-4" />
          <span className="text-xs font-medium">Time Active</span>
        </div>
        <p className="text-xl font-bold text-gray-900">{weeksActive} weeks</p>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center gap-2 text-gray-500 mb-1">
          <TrendingUp className="w-4 h-4" />
          <span className="text-xs font-medium">Weekly Velocity</span>
        </div>
        <p className="text-xl font-bold text-gray-900">{avgVelocity}</p>
        <p className="text-[10px] text-gray-400">items/week avg</p>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center gap-2 text-gray-500 mb-1">
          <Clock className="w-4 h-4" />
          <span className="text-xs font-medium">Projected Completion</span>
        </div>
        {projectedDate ? (
          <>
            <p className="text-xl font-bold text-gray-900">
              {new Date(projectedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </p>
            <p className="text-[10px] text-gray-400">
              {Math.ceil((new Date(projectedDate).getTime() - Date.now()) / (7 * 24 * 60 * 60 * 1000))} weeks from now
            </p>
          </>
        ) : (
          <p className="text-sm text-gray-400 mt-1">Not enough data</p>
        )}
      </div>
    </div>
  );
}

function MilestoneCard({ milestone }: { milestone: TimelineMilestone }) {
  const config = STATUS_CONFIG[milestone.status];
  const Icon = config.icon;

  return (
    <div className={cn('rounded-xl border p-4', config.bg, config.border)}>
      <div className="flex items-start gap-3">
        <div className={cn('w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0', config.bg)}>
          <Icon className={cn('w-4 h-4', config.color)} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-semibold text-gray-800 truncate">{milestone.title}</h4>
            {milestone.framework && (
              <span className="text-[10px] text-brand-600 bg-brand-50 px-1.5 py-0.5 rounded flex-shrink-0">{milestone.framework}</span>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-0.5">{milestone.description}</p>

          {/* Progress bar */}
          <div className="mt-2">
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-[10px] text-gray-400">{config.label}</span>
              <span className="text-[10px] font-medium text-gray-600">{milestone.progress}%</span>
            </div>
            <div className="h-1.5 bg-white rounded-full overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all',
                  milestone.status === 'completed' ? 'bg-green-400' :
                  milestone.status === 'at_risk' ? 'bg-red-400' :
                  milestone.status === 'in_progress' ? 'bg-blue-400' :
                  'bg-gray-300',
                )}
                style={{ width: `${milestone.progress}%` }}
              />
            </div>
          </div>

          {/* Blockers */}
          {milestone.blockers.length > 0 && (
            <div className="mt-2 space-y-0.5">
              {milestone.blockers.map((b, i) => (
                <p key={i} className="text-[10px] text-red-500 flex items-center gap-1">
                  <AlertTriangle className="w-2.5 h-2.5" />
                  {b}
                </p>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function VelocityChart({ velocity }: { velocity: ComplianceVelocity[] }) {
  if (velocity.length === 0) return null;

  const maxVal = Math.max(
    ...velocity.map((v) => v.controlsImplemented + v.evidenceCollected + v.policiesApproved + v.tasksCompleted),
    1,
  );

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center gap-2 mb-4">
        <BarChart3 className="w-4 h-4 text-brand-600" />
        <h3 className="text-sm font-semibold text-gray-800">Weekly Activity</h3>
      </div>
      <div className="flex items-end gap-1.5 h-32">
        {velocity.map((v) => {
          const total = v.controlsImplemented + v.evidenceCollected + v.policiesApproved + v.tasksCompleted;
          const pct = (total / maxVal) * 100;
          return (
            <div key={v.period} className="flex-1 flex flex-col items-center gap-1" title={`${v.period}: ${total} items`}>
              <span className="text-[9px] text-gray-500">{total}</span>
              <div className="w-full rounded-t-sm overflow-hidden flex flex-col justify-end" style={{ height: `${Math.max(pct, 4)}%` }}>
                {v.controlsImplemented > 0 && (
                  <div className="bg-blue-400" style={{ height: `${(v.controlsImplemented / total) * 100}%`, minHeight: 2 }} />
                )}
                {v.evidenceCollected > 0 && (
                  <div className="bg-green-400" style={{ height: `${(v.evidenceCollected / total) * 100}%`, minHeight: 2 }} />
                )}
                {v.policiesApproved > 0 && (
                  <div className="bg-purple-400" style={{ height: `${(v.policiesApproved / total) * 100}%`, minHeight: 2 }} />
                )}
                {v.tasksCompleted > 0 && (
                  <div className="bg-yellow-400" style={{ height: `${(v.tasksCompleted / total) * 100}%`, minHeight: 2 }} />
                )}
              </div>
              <span className="text-[8px] text-gray-400 -rotate-45 origin-top-left whitespace-nowrap">
                {v.period.replace(/^\d{4}-/, '')}
              </span>
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-100">
        <span className="flex items-center gap-1 text-[10px] text-gray-500"><span className="w-2 h-2 rounded-sm bg-blue-400" /> Controls</span>
        <span className="flex items-center gap-1 text-[10px] text-gray-500"><span className="w-2 h-2 rounded-sm bg-green-400" /> Evidence</span>
        <span className="flex items-center gap-1 text-[10px] text-gray-500"><span className="w-2 h-2 rounded-sm bg-purple-400" /> Policies</span>
        <span className="flex items-center gap-1 text-[10px] text-gray-500"><span className="w-2 h-2 rounded-sm bg-yellow-400" /> Tasks</span>
      </div>
    </div>
  );
}

export default function TimelinePage() {
  const { data, isLoading } = useQuery({
    queryKey: ['compliance-timeline'],
    queryFn: () => gapAnalysisApi.getTimeline(),
  });

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Clock className="w-6 h-6 text-brand-600" />
          Compliance Timeline
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Track milestones, velocity, and projected completion for your compliance journey
        </p>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-gray-400">Loading timeline data...</div>
      ) : !data ? (
        <div className="text-center py-12">
          <Clock className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-lg font-medium text-gray-700">No timeline data</p>
          <p className="text-sm text-gray-400">Start implementing controls to see your compliance timeline.</p>
        </div>
      ) : (
        <>
          <PhaseIndicator phase={data.currentPhase} progress={data.overallProgress} />
          <StatsRow
            weeksActive={data.weeksActive}
            avgVelocity={data.avgWeeklyVelocity}
            projectedDate={data.projectedCompletionDate}
          />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Milestones */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-brand-600" />
                Milestones
              </h3>
              {data.milestones.map((ms) => (
                <MilestoneCard key={ms.id} milestone={ms} />
              ))}
            </div>

            {/* Velocity chart */}
            <div className="space-y-3">
              <VelocityChart velocity={data.velocity} />

              {/* Tips based on current state */}
              <div className="bg-brand-50 border border-brand-200 rounded-xl p-4">
                <h4 className="text-sm font-medium text-brand-800 mb-2">Recommendations</h4>
                <ul className="space-y-1.5 text-xs text-brand-700">
                  {data.milestones.some((m) => m.status === 'at_risk') && (
                    <li className="flex items-start gap-1.5">
                      <AlertTriangle className="w-3 h-3 text-red-500 mt-0.5 flex-shrink-0" />
                      Address at-risk milestones immediately to stay on track
                    </li>
                  )}
                  {data.milestones.some((m) => m.category === 'policies' && m.progress < 50) && (
                    <li className="flex items-start gap-1.5">
                      <ChevronRight className="w-3 h-3 text-brand-500 mt-0.5 flex-shrink-0" />
                      Use the AI policy generator to quickly create required policies
                    </li>
                  )}
                  {data.avgWeeklyVelocity < 2 && (
                    <li className="flex items-start gap-1.5">
                      <ChevronRight className="w-3 h-3 text-brand-500 mt-0.5 flex-shrink-0" />
                      Your weekly velocity is low — check the Action Plan for quick wins
                    </li>
                  )}
                  {data.overallProgress < 30 && (
                    <li className="flex items-start gap-1.5">
                      <ChevronRight className="w-3 h-3 text-brand-500 mt-0.5 flex-shrink-0" />
                      Focus on implementing high-weight controls first to build your foundation
                    </li>
                  )}
                  {data.overallProgress >= 70 && (
                    <li className="flex items-start gap-1.5">
                      <CheckCircle2 className="w-3 h-3 text-green-500 mt-0.5 flex-shrink-0" />
                      Great progress! Run the audit checklist to identify final gaps
                    </li>
                  )}
                </ul>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
