'use client';

import { CheckCircle, Circle, AlertCircle, Clock, User } from 'lucide-react';
import { formatRelative } from '@/lib/utils';
import { cn } from '@/lib/utils';

const STAGE_LABELS: Record<string, string> = {
  onboarding: 'Onboarding',
  planning: 'Planning',
  gap_analysis: 'Gap Analysis',
  policy_generation: 'Policy Generation',
  evidence_collection: 'Evidence Collection',
  validation: 'Validation',
  review: 'Review',
  remediation: 'Remediation',
  threat_intel: 'Threat Intel',
  vendor_risk: 'Vendor Risk',
  task_generation: 'Task Generation',
  audit: 'Audit',
  completed: 'Completed',
};

const ALL_STAGES = Object.keys(STAGE_LABELS);

interface HistoryEntry {
  stage: string;
  agentName: string;
  status: string;
  timestamp: string;
  durationMs?: number;
}

interface CheckpointEntry {
  id: string;
  checkpointType: string;
  status: string;
  agentName: string;
  createdAt: string;
  reviewer?: { fullName: string };
  decision?: string;
  comments?: string;
}

interface JourneyTimelineProps {
  currentStage: string;
  status: string;
  history: HistoryEntry[];
  checkpoints: CheckpointEntry[];
  onResolveCheckpoint?: (checkpointId: string) => void;
}

function StageIcon({ stage, currentStage, completedStages, checkpoints }: {
  stage: string;
  currentStage: string;
  completedStages: Set<string>;
  checkpoints: CheckpointEntry[];
}) {
  const pendingCheckpoint = checkpoints.find(
    (c) => c.agentName === stage && c.status === 'pending',
  );

  if (pendingCheckpoint) {
    return <User className="w-4 h-4 text-warning-600" />;
  }
  if (completedStages.has(stage)) {
    return <CheckCircle className="w-4 h-4 text-success-600" />;
  }
  if (stage === currentStage) {
    return <Clock className="w-4 h-4 text-brand-600 animate-pulse" />;
  }
  return <Circle className="w-4 h-4 text-gray-300" />;
}

export function JourneyTimeline({ currentStage, status, history, checkpoints, onResolveCheckpoint }: JourneyTimelineProps) {
  const completedStages = new Set(
    history.filter((h) => h.status === 'completed').map((h) => h.stage),
  );

  const currentIndex = ALL_STAGES.indexOf(currentStage);

  return (
    <div className="space-y-0">
      {ALL_STAGES.map((stage, i) => {
        const label = STAGE_LABELS[stage];
        const historyEntry = history.filter((h) => h.stage === stage).at(-1);
        const checkpoint = checkpoints.find((c) => {
          const stageMap: Record<string, string> = {
            onboarding: 'after_onboarding',
            policy_generation: 'after_policy_generation',
            audit: 'before_audit',
          };
          return stageMap[stage] === c.checkpointType;
        });
        const isCompleted = completedStages.has(stage);
        const isCurrent = stage === currentStage;
        const isPast = i < currentIndex;
        const isFuture = i > currentIndex && !isCompleted;

        return (
          <div key={stage} className="flex gap-3">
            {/* Spine */}
            <div className="flex flex-col items-center">
              <div className={cn(
                'w-7 h-7 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors',
                isCompleted ? 'border-success-500 bg-success-50' :
                isCurrent ? 'border-brand-500 bg-brand-50' :
                checkpoint?.status === 'pending' ? 'border-warning-400 bg-warning-50' :
                'border-gray-200 bg-white',
              )}>
                <StageIcon
                  stage={stage}
                  currentStage={currentStage}
                  completedStages={completedStages}
                  checkpoints={checkpoints}
                />
              </div>
              {i < ALL_STAGES.length - 1 && (
                <div className={cn(
                  'w-0.5 flex-1 my-1 min-h-[20px]',
                  isPast || isCompleted ? 'bg-success-200' : 'bg-gray-100',
                )} />
              )}
            </div>

            {/* Content */}
            <div className="flex-1 pb-4">
              <div className="flex items-center gap-2">
                <span className={cn(
                  'text-sm font-medium',
                  isCompleted ? 'text-success-800' :
                  isCurrent ? 'text-brand-800' :
                  isFuture ? 'text-gray-400' : 'text-gray-700',
                )}>
                  {label}
                </span>
                {historyEntry && (
                  <span className="text-xs text-gray-400">
                    {formatRelative(historyEntry.timestamp)}
                    {historyEntry.durationMs && ` · ${(historyEntry.durationMs / 1000).toFixed(1)}s`}
                  </span>
                )}
              </div>

              {/* Checkpoint badge */}
              {checkpoint && (
                <div className={cn(
                  'mt-1.5 rounded-lg border px-3 py-2 text-xs',
                  checkpoint.status === 'pending' ? 'border-warning-200 bg-warning-50' :
                  checkpoint.status === 'approved' ? 'border-success-200 bg-success-50' :
                  checkpoint.status === 'rejected' ? 'border-danger-200 bg-danger-50' :
                  'border-gray-200 bg-gray-50',
                )}>
                  <div className="flex items-center justify-between">
                    <span className={cn(
                      'font-medium',
                      checkpoint.status === 'pending' ? 'text-warning-800' :
                      checkpoint.status === 'approved' ? 'text-success-800' :
                      checkpoint.status === 'rejected' ? 'text-danger-800' :
                      'text-gray-700',
                    )}>
                      Human Review {checkpoint.status === 'pending' ? '(pending)' : `(${checkpoint.status})`}
                    </span>
                    {checkpoint.status === 'pending' && onResolveCheckpoint && (
                      <button
                        className="text-brand-600 hover:underline font-medium"
                        onClick={() => onResolveCheckpoint(checkpoint.id)}
                      >
                        Review →
                      </button>
                    )}
                  </div>
                  {checkpoint.reviewer && (
                    <p className="text-gray-500 mt-0.5">
                      Reviewed by {checkpoint.reviewer.fullName}
                      {checkpoint.decision && ` · ${checkpoint.decision}`}
                    </p>
                  )}
                  {checkpoint.comments && (
                    <p className="text-gray-600 mt-0.5 italic">"{checkpoint.comments}"</p>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
