'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { journeyApi } from '@/lib/api/journey';
import { JourneyTimeline } from '@/components/journey/JourneyTimeline';
import { formatRelative, formatMs, formatCurrency } from '@/lib/utils';
import {
  Activity, ChevronRight, AlertCircle, CheckCircle, X,
  Clock, DollarSign, Layers, ChevronDown, Sparkles, BookOpen,
  ArrowRight, ListChecks,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Journey Brief Types ──────────────────────────────────────────────────────

type StageHighlight = { stage: string; achievement: string };
type JourneyBriefResult = {
  journeyId: string;
  headline: string;
  statusNarrative: string;
  stageHighlights: StageHighlight[];
  keyFindings: string[];
  pendingItems: string[];
  estimatedCompletion: string;
  executiveOneLiner: string;
};

function JourneyBriefPanel({ result, onClose }: { result: JourneyBriefResult; onClose: () => void }) {
  return (
    <div className="border border-purple-200 rounded-xl bg-purple-50 p-4 space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-purple-600 shrink-0" />
          <span className="text-sm font-semibold text-purple-900">AI Journey Brief</span>
        </div>
        <button onClick={onClose} className="text-purple-400 hover:text-purple-600"><X className="w-4 h-4" /></button>
      </div>

      {result.headline && (
        <div className="bg-white rounded-lg border border-purple-100 px-3 py-2.5">
          <p className="text-sm font-semibold text-gray-900">{result.headline}</p>
          {result.statusNarrative && <p className="text-xs text-gray-600 mt-1">{result.statusNarrative}</p>}
        </div>
      )}

      {result.executiveOneLiner && (
        <div className="bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-2 flex gap-2">
          <BookOpen className="w-3.5 h-3.5 text-indigo-500 shrink-0 mt-0.5" />
          <p className="text-xs text-indigo-800 italic">"{result.executiveOneLiner}"</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {result.stageHighlights.length > 0 && (
          <div className="bg-white rounded-lg border border-gray-200 p-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Stage achievements</p>
            <ul className="space-y-1.5">
              {result.stageHighlights.map((sh, i) => (
                <li key={i} className="text-xs text-gray-700 flex gap-2">
                  <ArrowRight className="w-3 h-3 text-green-400 shrink-0 mt-0.5" />
                  <span><strong className="capitalize">{sh.stage.replace(/_/g, ' ')}</strong>: {sh.achievement}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="space-y-3">
          {result.keyFindings.length > 0 && (
            <div className="bg-white rounded-lg border border-gray-200 p-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Key findings</p>
              <ul className="space-y-1">
                {result.keyFindings.map((f, i) => (
                  <li key={i} className="text-xs text-gray-700 flex gap-1.5">
                    <CheckCircle className="w-3 h-3 text-blue-400 shrink-0 mt-0.5" /> {f}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {result.pendingItems.length > 0 && (
            <div className="bg-white rounded-lg border border-amber-200 p-3">
              <div className="flex items-center gap-1.5 mb-2">
                <ListChecks className="w-3.5 h-3.5 text-amber-500" />
                <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Still to do</p>
              </div>
              <ul className="space-y-1">
                {result.pendingItems.map((p, i) => (
                  <li key={i} className="text-xs text-gray-700 flex gap-1.5">
                    <span className="text-amber-400 font-bold shrink-0">{i + 1}.</span> {p}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {result.estimatedCompletion && (
        <p className="text-xs text-gray-500 flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-gray-400" />
          <span>Estimated completion: <strong>{result.estimatedCompletion}</strong></span>
        </p>
      )}
    </div>
  );
}

// ─── Pipeline stages (19 stages) ─────────────────────────────────────────────

const PIPELINE_STAGES = [
  'inference', 'onboarding', 'scoping', 'control-mapper', 'planner',
  'policy', 'evidence', 'validator', 'risk-scoring', 'gap-analysis',
  'remediation-advisor', 'task', 'review', 'drift-detector', 'vendor-risk',
  'threat-intel', 'integration', 'dashboard', 'audit',
];

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  active:             { label: 'Running',          cls: 'bg-brand-50 text-brand-700' },
  awaiting_human:     { label: 'Awaiting Review',  cls: 'bg-warning-50 text-warning-700' },
  paused_for_review:  { label: 'Paused',           cls: 'bg-gray-100 text-gray-600' },
  completed:          { label: 'Complete',         cls: 'bg-success-50 text-success-700' },
  failed:             { label: 'Failed',           cls: 'bg-danger-50 text-danger-700' },
};

// ─── Horizontal stepper ───────────────────────────────────────────────────────

function StageStepper({ currentStage, status }: { currentStage: string; status: string }) {
  const currentIdx = PIPELINE_STAGES.indexOf(currentStage);
  const isFailed = status === 'failed';
  const isDone = status === 'completed';

  return (
    <div className="overflow-x-auto pb-2">
      <div className="flex items-center gap-0 min-w-max">
        {PIPELINE_STAGES.map((stage, idx) => {
          const isPast    = isDone || idx < currentIdx;
          const isCurrent = !isDone && idx === currentIdx;
          const isFuture  = !isDone && idx > currentIdx;

          return (
            <div key={stage} className="flex items-center">
              {/* Node */}
              <div className="flex flex-col items-center">
                <div className={cn(
                  'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all',
                  isPast   ? 'bg-green-500 border-green-500 text-white'
                  : isCurrent ? (isFailed
                      ? 'bg-red-500 border-red-500 text-white'
                      : 'bg-brand-600 border-brand-600 text-white ring-2 ring-brand-200')
                  : 'bg-white border-gray-200 text-gray-400',
                )}>
                  {isPast ? '✓' : idx + 1}
                </div>
                <p className={cn(
                  'text-[9px] mt-1 font-medium capitalize w-16 text-center truncate',
                  isCurrent ? 'text-brand-600' : isPast ? 'text-green-600' : 'text-gray-300',
                )}>
                  {stage.replace(/-/g, ' ')}
                </p>
              </div>

              {/* Connector */}
              {idx < PIPELINE_STAGES.length - 1 && (
                <div className={cn(
                  'w-5 h-0.5 mx-0.5 mb-4',
                  isPast ? 'bg-green-400' : 'bg-gray-200',
                )} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Journey list item ────────────────────────────────────────────────────────

function JourneyListItem({
  journey,
  isSelected,
  onSelect,
}: {
  journey: any;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const statusCfg = STATUS_CONFIG[journey.status] ?? STATUS_CONFIG.active;
  const pending = (journey.checkpoints ?? []).filter((c: any) => c.status === 'pending').length;
  const currentIdx = PIPELINE_STAGES.indexOf(journey.currentStage ?? '');
  const stagePct = currentIdx >= 0 ? Math.round(((currentIdx + 1) / PIPELINE_STAGES.length) * 100) : 0;

  return (
    <button
      className={cn(
        'w-full text-left px-4 py-3.5 border-b border-gray-100 hover:bg-gray-50 transition-colors',
        isSelected && 'bg-brand-50 border-l-2 border-l-brand-500',
      )}
      onClick={onSelect}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <p className="text-sm font-medium text-gray-900 truncate">
          {journey.workflow?.name ?? 'Assessment'}
        </p>
        <div className="flex items-center gap-1.5 shrink-0">
          {pending > 0 && (
            <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-semibold">
              {pending}
            </span>
          )}
          <ChevronRight className="w-4 h-4 text-gray-300" />
        </div>
      </div>

      <div className="flex items-center gap-2 mb-2">
        <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', statusCfg.cls)}>
          {statusCfg.label}
        </span>
        <span className="text-xs text-gray-400">{formatRelative(journey.startedAt ?? journey.createdAt)}</span>
      </div>

      {/* Stage progress dots */}
      <div className="flex items-center gap-1">
        {PIPELINE_STAGES.slice(0, 10).map((_, i) => (
          <div
            key={i}
            className={cn(
              'w-1.5 h-1.5 rounded-full transition-all',
              i < currentIdx ? 'bg-green-400'
              : i === currentIdx ? 'bg-brand-500'
              : 'bg-gray-200',
            )}
          />
        ))}
        {currentIdx >= 0 && (
          <span className="text-xs text-gray-400 ml-1">
            {currentIdx + 1}/19
          </span>
        )}
      </div>
    </button>
  );
}

// ─── Accordion section ────────────────────────────────────────────────────────

function AccordionSection({
  title, count, color, children,
}: {
  title: string; count: number; color: string; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);
  if (count === 0) return null;
  return (
    <div>
      <button
        className="w-full flex items-center justify-between py-1.5"
        onClick={() => setOpen((p) => !p)}
      >
        <p className={cn('text-xs font-semibold uppercase tracking-wide', color)}>
          {title} ({count})
        </p>
        {open ? <ChevronDown className="w-3.5 h-3.5 text-gray-400" /> : <ChevronRight className="w-3.5 h-3.5 text-gray-400" />}
      </button>
      {open && <div className="space-y-1 mt-1">{children}</div>}
    </div>
  );
}

// ─── Checkpoint Modal ─────────────────────────────────────────────────────────

function CheckpointModal({
  checkpoint, onClose, onResolved,
}: {
  checkpoint: any; onClose: () => void; onResolved: () => void;
}) {
  const [decision, setDecision] = useState<'approved' | 'rejected' | 'override'>('approved');
  const [comments, setComments] = useState('');
  const [overrideReason, setOverrideReason] = useState('');

  const resolve = useMutation({
    mutationFn: () => journeyApi.resolveCheckpoint(checkpoint.id, decision, comments, overrideReason),
    onSuccess: () => { onResolved(); onClose(); },
  });

  const findings: any[]     = checkpoint.findings ?? [];
  const risks: any[]        = checkpoint.risks ?? [];
  const uncertainties: any[] = checkpoint.uncertainties ?? [];
  const isHighRisk = checkpoint.checkpointType === 'risk_threshold_exceeded';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-2xl card p-6 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-start gap-3">
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <h2 className="text-base font-semibold text-gray-900">Human Review Required</h2>
                {isHighRisk && (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                    <AlertCircle className="w-3 h-3" />
                    High Risk
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-400 capitalize">
                {checkpoint.checkpointType?.replace(/_/g, ' ')} · {checkpoint.agentName}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Summary */}
        {checkpoint.summary && (
          <div className="mb-4 p-4 bg-gray-50 rounded-xl border border-gray-200">
            <p className="text-sm text-gray-700 leading-relaxed">{checkpoint.summary}</p>
          </div>
        )}

        {/* Accordion sections */}
        <div className="space-y-2 mb-5">
          <AccordionSection title="Findings" count={findings.length} color="text-brand-600">
            {findings.map((f: any, i: number) => (
              <div key={i} className="flex items-start gap-2 text-sm text-gray-700 bg-blue-50 rounded-lg px-3 py-2">
                <CheckCircle className="w-3.5 h-3.5 text-brand-500 mt-0.5 shrink-0" />
                {typeof f === 'string' ? f : f.message ?? JSON.stringify(f)}
              </div>
            ))}
          </AccordionSection>

          <AccordionSection title="Risks" count={risks.length} color="text-warning-600">
            {risks.map((r: any, i: number) => (
              <div key={i} className="flex items-start gap-2 text-sm text-gray-700 bg-yellow-50 rounded-lg px-3 py-2">
                <AlertCircle className="w-3.5 h-3.5 text-warning-500 mt-0.5 shrink-0" />
                {typeof r === 'string' ? r : r.message ?? JSON.stringify(r)}
              </div>
            ))}
          </AccordionSection>

          <AccordionSection title="Uncertainties" count={uncertainties.length} color="text-gray-500">
            {uncertainties.map((u: any, i: number) => (
              <p key={i} className="text-xs text-gray-500 italic pl-2">
                · {typeof u === 'string' ? u : u.message ?? JSON.stringify(u)}
              </p>
            ))}
          </AccordionSection>
        </div>

        {/* Decision */}
        <div className="border-t border-gray-100 pt-4 space-y-4">
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Decision</p>
            <div className="flex gap-2">
              {(['approved', 'rejected', 'override'] as const).map((d) => (
                <button
                  key={d}
                  className={cn(
                    'flex-1 py-2 rounded-xl border text-sm font-medium capitalize transition-all',
                    decision === d
                      ? d === 'approved' ? 'border-green-500 bg-green-50 text-green-700 shadow-sm'
                        : d === 'rejected' ? 'border-red-500 bg-red-50 text-red-700 shadow-sm'
                        : 'border-yellow-400 bg-yellow-50 text-yellow-700 shadow-sm'
                      : 'border-gray-200 text-gray-500 hover:border-gray-300',
                  )}
                  onClick={() => setDecision(d)}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm font-medium text-gray-700">Comments</label>
              <span className="text-xs text-gray-400">{comments.length}/500</span>
            </div>
            <textarea
              className="input resize-none"
              rows={3}
              maxLength={500}
              placeholder="Add notes for the audit trail…"
              value={comments}
              onChange={(e) => setComments(e.target.value)}
            />
          </div>

          {decision === 'override' && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm font-medium text-gray-700">Override Reason (required)</label>
                <span className="text-xs text-gray-400">{overrideReason.length}/300</span>
              </div>
              <textarea
                className="input resize-none"
                rows={2}
                maxLength={300}
                placeholder="Document why you are overriding…"
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
              />
            </div>
          )}

          <div className="flex gap-3">
            <button className="btn-secondary flex-1" onClick={onClose}>Cancel</button>
            <button
              className="btn-primary flex-1"
              onClick={() => resolve.mutate()}
              disabled={resolve.isPending || (decision === 'override' && !overrideReason.trim())}
            >
              {resolve.isPending ? 'Submitting…' : 'Submit Decision'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function JourneyPage() {
  const qc = useQueryClient();
  const [selectedJourneyId, setSelectedJourneyId] = useState<string | null>(null);
  const [checkpointToReview, setCheckpointToReview] = useState<any>(null);
  const [briefResult, setBriefResult] = useState<JourneyBriefResult | null>(null);

  const aiBreef = useMutation({
    mutationFn: (journeyId: string) => journeyApi.aiGenerateBrief(journeyId),
    onSuccess: (res) => setBriefResult(res as unknown as JourneyBriefResult),
  });

  const { data: journeys, isLoading } = useQuery({
    queryKey: ['journeys'],
    queryFn: journeyApi.listJourneys,
    refetchInterval: 10_000,
  });

  const { data: selectedJourney } = useQuery({
    queryKey: ['journey', selectedJourneyId],
    queryFn: () => journeyApi.getJourney(selectedJourneyId!),
    enabled: !!selectedJourneyId,
    refetchInterval: 5_000,
  });

  const list: any[] = journeys ?? [];
  const totalPending = list.flatMap((j) =>
    (j.checkpoints ?? []).filter((c: any) => c.status === 'pending'),
  ).length;

  return (
    <div className="p-8 max-w-6xl">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Compliance Journey</h1>
          <p className="text-sm text-gray-500 mt-1">
            End-to-end compliance workflow — all decisions traceable and replayable
          </p>
        </div>
        {totalPending > 0 && (
          <div className="flex items-center gap-2 bg-warning-50 border border-warning-200 rounded-xl px-4 py-2.5">
            <AlertCircle className="w-4 h-4 text-warning-600" />
            <p className="text-sm font-medium text-warning-800">
              {totalPending} checkpoint{totalPending > 1 ? 's' : ''} awaiting review
            </p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Journey list */}
        <div className="lg:col-span-2 card overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <p className="text-sm font-semibold text-gray-700">
              Runs <span className="text-gray-400 font-normal">({list.length})</span>
            </p>
          </div>
          {isLoading ? (
            <div className="flex items-center justify-center h-40">
              <div className="w-6 h-6 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : list.length === 0 ? (
            <div className="p-8 text-center">
              <Activity className="w-8 h-8 text-gray-200 mx-auto mb-2" />
              <p className="text-xs text-gray-400">No journeys yet. Run an assessment from Overview.</p>
            </div>
          ) : (
            list.map((j) => (
              <JourneyListItem
                key={j.id}
                journey={j}
                isSelected={selectedJourneyId === j.id}
                onSelect={() => setSelectedJourneyId(j.id)}
              />
            ))
          )}
        </div>

        {/* Journey detail */}
        <div className="lg:col-span-3">
          {selectedJourney ? (
            <div className="card p-6 space-y-5">
              {/* Summary strip */}
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <p className="text-base font-semibold text-gray-900">
                    {selectedJourney.workflow?.name ?? 'Assessment'}
                  </p>
                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                    <span className="flex items-center gap-1">
                      <Layers className="w-3 h-3" />
                      Stage {PIPELINE_STAGES.indexOf(selectedJourney.currentStage ?? '') + 1} / 19
                    </span>
                    {selectedJourney.workflow?.totalCostUsd != null && (
                      <span className="flex items-center gap-1">
                        <DollarSign className="w-3 h-3" />
                        {formatCurrency(Number(selectedJourney.workflow.totalCostUsd))}
                      </span>
                    )}
                    {selectedJourney.createdAt && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatRelative(selectedJourney.createdAt)}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={cn(
                    'text-xs font-medium px-2.5 py-1 rounded-full',
                    STATUS_CONFIG[selectedJourney.status]?.cls ?? 'bg-gray-100 text-gray-600',
                  )}>
                    {STATUS_CONFIG[selectedJourney.status]?.label ?? selectedJourney.status}
                  </span>
                  <button
                    onClick={() => {
                      setBriefResult(null);
                      aiBreef.mutate(selectedJourney.id);
                    }}
                    disabled={aiBreef.isPending}
                    className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 bg-purple-50 text-purple-700 border border-purple-200 rounded-lg hover:bg-purple-100 transition-colors disabled:opacity-60"
                  >
                    {aiBreef.isPending ? (
                      <span className="w-3 h-3 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Sparkles className="w-3 h-3" />
                    )}
                    {aiBreef.isPending ? 'Briefing…' : 'AI Brief'}
                  </button>
                </div>
              </div>

              {/* AI Brief panel */}
              {briefResult && briefResult.journeyId === selectedJourney.id && (
                <JourneyBriefPanel result={briefResult} onClose={() => setBriefResult(null)} />
              )}

              {/* Visual stepper */}
              <StageStepper
                currentStage={selectedJourney.currentStage ?? ''}
                status={selectedJourney.status}
              />

              {/* Journey timeline */}
              <JourneyTimeline
                currentStage={selectedJourney.currentStage}
                status={selectedJourney.status}
                history={selectedJourney.history as any[]}
                checkpoints={selectedJourney.checkpoints ?? []}
                onResolveCheckpoint={(id) => {
                  const cp = selectedJourney.checkpoints?.find((c: any) => c.id === id);
                  if (cp) setCheckpointToReview(cp);
                }}
              />
            </div>
          ) : (
            <div className="card p-12 flex flex-col items-center justify-center text-center h-full min-h-[300px]">
              <Activity className="w-10 h-10 text-gray-200 mb-3" />
              <p className="text-sm text-gray-500">Select a run to view its compliance journey</p>
            </div>
          )}
        </div>
      </div>

      {checkpointToReview && (
        <CheckpointModal
          checkpoint={checkpointToReview}
          onClose={() => setCheckpointToReview(null)}
          onResolved={() => {
            qc.invalidateQueries({ queryKey: ['journeys'] });
            qc.invalidateQueries({ queryKey: ['journey', selectedJourneyId] });
          }}
        />
      )}
    </div>
  );
}
