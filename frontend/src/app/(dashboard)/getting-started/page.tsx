'use client';

import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { teamApi, GuidedTask, GuidedProgram } from '@/lib/api/team';
import { tasksApi } from '@/lib/api/tasks';
import { readinessApi } from '@/lib/api/readiness';
import Link from 'next/link';
import {
  Rocket, CheckCircle2, Clock, Lock, RefreshCw, Loader2,
  ChevronDown, ChevronRight, AlertCircle, FileText, Upload,
  Shield, BookOpen, ClipboardCheck, Sparkles, Play, ArrowRight,
  Calendar, Users, Zap, X, CheckCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

const KIND_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  EVIDENCE_UPLOAD:  { label: 'Evidence Upload',   icon: Upload,        color: 'text-blue-600 bg-blue-50 border-blue-200' },
  POLICY_AUTHORING: { label: 'Policy Authoring',  icon: FileText,      color: 'text-purple-600 bg-purple-50 border-purple-200' },
  ACCESS_REVIEW:    { label: 'Access Review',      icon: Shield,        color: 'text-indigo-600 bg-indigo-50 border-indigo-200' },
  TRAINING:         { label: 'Training',           icon: BookOpen,      color: 'text-teal-600 bg-teal-50 border-teal-200' },
  RISK_ASSESSMENT:  { label: 'Risk Assessment',    icon: AlertCircle,   color: 'text-orange-600 bg-orange-50 border-orange-200' },
  VENDOR_REVIEW:    { label: 'Vendor Review',      icon: Users,         color: 'text-gray-600 bg-gray-50 border-gray-200' },
  INCIDENT_DRILL:   { label: 'Incident Drill',     icon: Zap,           color: 'text-red-600 bg-red-50 border-red-200' },
  ATTESTATION:      { label: 'Attestation',        icon: CheckCheck,    color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
  CONFIGURATION:    { label: 'Configuration',      icon: Sparkles,      color: 'text-cyan-600 bg-cyan-50 border-cyan-200' },
  APPROVAL:         { label: 'Approval',           icon: ClipboardCheck, color: 'text-amber-600 bg-amber-50 border-amber-200' },
};

const PRIORITY_DOT: Record<string, string> = {
  critical: 'bg-red-500',
  high:     'bg-orange-400',
  medium:   'bg-amber-400',
  low:      'bg-gray-300',
};

// ─── Task Row ─────────────────────────────────────────────────────────────────

function TaskRow({
  task,
  onSelect,
  selected,
}: {
  task: GuidedTask;
  onSelect: (t: GuidedTask) => void;
  selected: boolean;
}) {
  const kindCfg = KIND_CONFIG[task.kind] ?? KIND_CONFIG.EVIDENCE_UPLOAD;
  const KindIcon = kindCfg.icon;
  const isDone = task.status === 'done';
  const isBlocked = task.status === 'blocked' || (task.blockedBy ?? []).length > 0;

  const dueDays = task.dueDate
    ? Math.round((new Date(task.dueDate).getTime() - Date.now()) / 86400_000)
    : null;
  const isOverdue = dueDays !== null && dueDays < 0;

  return (
    <button
      className={cn(
        'w-full text-left flex items-center gap-3 px-4 py-3 rounded-xl border transition-all',
        selected ? 'border-brand-400 bg-brand-50 shadow-sm' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50',
        isDone && 'opacity-60',
      )}
      onClick={() => onSelect(task)}
    >
      {/* Done indicator */}
      <div className={cn(
        'w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0',
        isDone ? 'border-emerald-500 bg-emerald-500' : 'border-gray-300',
      )}>
        {isDone && <CheckCircle2 className="w-3 h-3 text-white" />}
      </div>

      {/* Priority dot */}
      <div className={cn('w-2 h-2 rounded-full shrink-0', PRIORITY_DOT[task.priority] ?? 'bg-gray-300')} />

      {/* Kind badge */}
      <span className={cn('hidden sm:inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border shrink-0', kindCfg.color)}>
        <KindIcon className="w-3 h-3" />
        {kindCfg.label}
      </span>

      {/* Control chip */}
      {task.control && (
        <span className="hidden md:inline text-xs font-mono bg-gray-100 text-gray-600 border border-gray-200 rounded px-1.5 py-0.5 shrink-0">
          {task.control.code}
        </span>
      )}

      {/* Title */}
      <span className={cn('flex-1 text-sm font-medium text-gray-800 truncate', isDone && 'line-through text-gray-400')}>
        {task.title}
      </span>

      {/* Assignee */}
      {task.assignee && (
        <div className="hidden lg:flex items-center gap-1.5 shrink-0">
          <div className="w-5 h-5 rounded-full bg-brand-100 flex items-center justify-center">
            <span className="text-xs font-bold text-brand-700">{task.assignee.fullName[0]}</span>
          </div>
          <span className="text-xs text-gray-500">{task.assignee.fullName.split(' ')[0]}</span>
        </div>
      )}

      {/* Due date */}
      {dueDays !== null && (
        <span className={cn(
          'hidden sm:inline text-xs font-medium shrink-0',
          isOverdue ? 'text-red-600' : dueDays <= 7 ? 'text-orange-600' : 'text-gray-400',
        )}>
          {isOverdue ? `${Math.abs(dueDays)}d overdue` : dueDays === 0 ? 'Due today' : `${dueDays}d`}
        </span>
      )}

      {/* Est time */}
      {task.estimatedMinutes && (
        <span className="hidden xl:inline text-xs text-gray-400 shrink-0">{task.estimatedMinutes}m</span>
      )}

      {/* Blocked icon */}
      {isBlocked && !isDone && (
        <Lock className="w-3.5 h-3.5 text-gray-400 shrink-0" />
      )}

      <ChevronRight className={cn('w-3.5 h-3.5 text-gray-400 shrink-0 transition-transform', selected && 'rotate-90')} />
    </button>
  );
}

// ─── Task Detail Panel ────────────────────────────────────────────────────────

function TaskDetailPanel({ task, onClose }: { task: GuidedTask; onClose: () => void }) {
  const qc = useQueryClient();
  const kindCfg = KIND_CONFIG[task.kind] ?? KIND_CONFIG.EVIDENCE_UPLOAD;
  const KindIcon = kindCfg.icon;

  const completeTask = useMutation({
    mutationFn: () => tasksApi.update(task.id, { status: 'done' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['guided-program'] }),
  });

  const startTask = useMutation({
    mutationFn: () => tasksApi.update(task.id, { status: 'in_progress' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['guided-program'] }),
  });

  const guidance = task.guidance;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5 sticky top-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className={cn('inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border', kindCfg.color)}>
              <KindIcon className="w-3 h-3" /> {kindCfg.label}
            </span>
            {task.control && (
              <span className="text-xs font-mono bg-gray-100 text-gray-600 border border-gray-200 rounded px-1.5 py-0.5">
                {task.control.code}
              </span>
            )}
            {task.recurrence && (
              <span className="text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded-full px-2 py-0.5">
                🔄 {task.recurrence.frequency}
              </span>
            )}
          </div>
          <h3 className="text-sm font-semibold text-gray-900">{task.title}</h3>
        </div>
        <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 transition-colors shrink-0">
          <X className="w-4 h-4 text-gray-400" />
        </button>
      </div>

      {/* Why this matters */}
      {guidance?.why && (
        <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 mb-4">
          <p className="text-xs font-semibold text-amber-800 mb-1">Why this matters</p>
          <p className="text-xs text-amber-700">{guidance.why}</p>
        </div>
      )}

      {/* Evidence hint */}
      {guidance?.evidenceHint && (
        <div className="mb-4">
          <p className="text-xs font-semibold text-gray-700 mb-1.5">What to provide</p>
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
            <p className="text-xs text-blue-800">{guidance.evidenceHint}</p>
            {guidance.fileFormat && (
              <p className="text-xs text-blue-600 mt-1 font-medium">Format: {guidance.fileFormat}</p>
            )}
          </div>
        </div>
      )}

      {/* Step by step */}
      {guidance?.stepByStep && guidance.stepByStep.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-semibold text-gray-700 mb-2">Steps</p>
          <ol className="space-y-1.5">
            {guidance.stepByStep.map((step, i) => (
              <li key={i} className="flex items-start gap-2.5 text-xs text-gray-600">
                <span className="w-4 h-4 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                  {i + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Example */}
      {guidance?.exampleDescription && (
        <div className="mb-4">
          <p className="text-xs font-semibold text-gray-700 mb-1.5">Example</p>
          <p className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-xl p-3 italic">
            {guidance.exampleDescription}
          </p>
        </div>
      )}

      {/* Assignee / Approver */}
      <div className="flex items-center gap-4 mb-4 pt-3 border-t border-gray-100">
        {task.assignee && (
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-brand-100 flex items-center justify-center">
              <span className="text-xs font-bold text-brand-700">{task.assignee.fullName[0]}</span>
            </div>
            <div>
              <p className="text-xs text-gray-400">Assigned to</p>
              <p className="text-xs font-medium text-gray-700">{task.assignee.fullName}</p>
            </div>
          </div>
        )}
        {task.approver && (
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center">
              <span className="text-xs font-bold text-indigo-700">{task.approver.fullName[0]}</span>
            </div>
            <div>
              <p className="text-xs text-gray-400">Approver</p>
              <p className="text-xs font-medium text-gray-700">{task.approver.fullName}</p>
            </div>
          </div>
        )}
        {task.estimatedMinutes && (
          <div className="ml-auto text-right">
            <p className="text-xs text-gray-400">Est. time</p>
            <p className="text-xs font-medium text-gray-700">
              {task.estimatedMinutes < 60 ? `${task.estimatedMinutes}m` : `${Math.round(task.estimatedMinutes / 60)}h`}
            </p>
          </div>
        )}
      </div>

      {/* Blocked by */}
      {(task.blockedBy ?? []).length > 0 && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-xl p-3">
          <p className="text-xs font-semibold text-red-800 mb-1.5">Blocked by</p>
          {task.blockedBy!.map((b) => (
            <p key={b.id} className="text-xs text-red-700 flex items-center gap-1.5">
              <Lock className="w-3 h-3 shrink-0" />
              {b.title}
            </p>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-2">
        {task.status === 'done' ? (
          <div className="flex items-center gap-2 text-emerald-700 font-medium text-sm">
            <CheckCircle2 className="w-4 h-4" /> Completed
          </div>
        ) : task.kind === 'EVIDENCE_UPLOAD' ? (
          <Link href="/evidence" className="btn-primary flex-1 text-center text-sm flex items-center justify-center gap-2">
            <Upload className="w-4 h-4" /> Upload Evidence
          </Link>
        ) : task.kind === 'POLICY_AUTHORING' ? (
          <Link href="/policies" className="btn-primary flex-1 text-center text-sm flex items-center justify-center gap-2">
            <FileText className="w-4 h-4" /> Open Policy Editor
          </Link>
        ) : task.kind === 'APPROVAL' ? (
          <button
            className="btn-primary flex-1 text-sm flex items-center justify-center gap-2"
            disabled={task.approvedAt != null || completeTask.isPending}
            onClick={() => completeTask.mutate()}
          >
            {completeTask.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <ClipboardCheck className="w-4 h-4" />}
            {task.approvedAt ? 'Already approved' : 'Approve'}
          </button>
        ) : (
          <>
            {task.status !== 'in_progress' && (
              <button
                className="btn-secondary flex-1 text-sm flex items-center justify-center gap-2"
                onClick={() => startTask.mutate()}
                disabled={startTask.isPending || (task.blockedBy ?? []).length > 0}
              >
                <Play className="w-4 h-4" /> Start
              </button>
            )}
            <button
              className="btn-primary flex-1 text-sm flex items-center justify-center gap-2"
              onClick={() => completeTask.mutate()}
              disabled={completeTask.isPending || (task.blockedBy ?? []).length > 0}
            >
              {completeTask.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Mark done
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Section ─────────────────────────────────────────────────────────────────

function Section({
  title,
  icon: Icon,
  count,
  colorClass,
  tasks,
  selectedId,
  onSelect,
  defaultOpen = true,
  emptyText,
}: {
  title: string;
  icon: React.ElementType;
  count: number;
  colorClass: string;
  tasks: GuidedTask[];
  selectedId: string | null;
  onSelect: (t: GuidedTask) => void;
  defaultOpen?: boolean;
  emptyText?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="mb-5">
      <button
        className="flex items-center gap-2 w-full text-left mb-2"
        onClick={() => setOpen(!open)}
      >
        <Icon className={cn('w-4 h-4', colorClass)} />
        <span className="text-sm font-semibold text-gray-800">{title}</span>
        <span className={cn('text-xs font-bold px-2 py-0.5 rounded-full', colorClass.includes('red') ? 'bg-red-100 text-red-700' : colorClass.includes('emerald') ? 'bg-emerald-100 text-emerald-700' : colorClass.includes('amber') ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600')}>
          {count}
        </span>
        <ChevronDown className={cn('w-3.5 h-3.5 text-gray-400 ml-auto transition-transform', !open && '-rotate-90')} />
      </button>

      {open && (
        <div className="space-y-1.5">
          {tasks.length === 0 ? (
            <p className="text-xs text-gray-400 py-3 text-center">{emptyText ?? 'No tasks in this section.'}</p>
          ) : (
            tasks.map((t) => (
              <TaskRow
                key={t.id}
                task={t}
                onSelect={onSelect}
                selected={t.id === selectedId}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ─── Progress Header ──────────────────────────────────────────────────────────

function ProgressHeader({ stats, targetDate }: {
  stats: GuidedProgram['stats'];
  targetDate?: string | null;
}) {
  const today = new Date();
  const target = targetDate ? new Date(targetDate) : null;
  const daysLeft = target ? Math.round((target.getTime() - today.getTime()) / 86400_000) : null;

  const categories = [
    { label: 'Policies', done: Math.min(stats.done, 14), total: 14, color: 'bg-purple-500' },
    { label: 'Access', done: Math.min(stats.done, 12), total: 12, color: 'bg-indigo-500' },
    { label: 'Monitoring', done: Math.min(stats.done, 18), total: 18, color: 'bg-blue-500' },
    { label: 'Training', done: Math.min(stats.done, 8), total: 8, color: 'bg-teal-500' },
  ];

  return (
    <div className="bg-gradient-to-br from-brand-700 to-brand-900 rounded-2xl p-5 text-white mb-6">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Rocket className="w-5 h-5" />
            <h2 className="text-base font-bold">Your Path to ISO 27001 + SOC 2</h2>
          </div>
          {daysLeft !== null && (
            <p className="text-sm text-brand-200">
              Target audit: {target!.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} · {daysLeft > 0 ? `${daysLeft} days remaining` : `${Math.abs(daysLeft)} days overdue`}
            </p>
          )}
        </div>
        <div className="text-right shrink-0">
          <p className="text-3xl font-black">{stats.percentComplete}%</p>
          <p className="text-xs text-brand-300">{stats.done} / {stats.total} tasks</p>
        </div>
      </div>

      {/* Main progress bar */}
      <div className="h-2.5 bg-brand-800 rounded-full overflow-hidden mb-3">
        <div
          className="h-2.5 bg-white rounded-full transition-all"
          style={{ width: `${stats.percentComplete}%` }}
        />
      </div>

      {/* Category breakdown */}
      <div className="grid grid-cols-4 gap-2">
        {categories.map(({ label, done, total, color }) => (
          <div key={label} className="bg-white/10 rounded-lg p-2">
            <p className="text-xs text-brand-200 mb-1">{label}</p>
            <p className="text-sm font-bold">{done}/{total}</p>
            <div className="h-1 bg-white/20 rounded-full mt-1 overflow-hidden">
              <div className={cn('h-1 rounded-full', color)} style={{ width: `${Math.round(done / total * 100)}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Generate CTA ─────────────────────────────────────────────────────────────

function GenerateCTA({ onGenerate, isGenerating }: { onGenerate: () => void; isGenerating: boolean }) {
  return (
    <div className="text-center py-16">
      <div className="w-16 h-16 rounded-2xl bg-brand-50 border border-brand-100 flex items-center justify-center mx-auto mb-4">
        <Rocket className="w-8 h-8 text-brand-600" />
      </div>
      <h3 className="text-lg font-bold text-gray-900 mb-2">Generate Your Compliance Roadmap</h3>
      <p className="text-sm text-gray-500 max-w-sm mx-auto mb-6">
        Build a personalized, DAG-ordered task program across all ISO 27001 and SOC 2 controls.
        Guided steps, RACI assignments, and due dates — all tailored to your organization.
      </p>
      <button
        className="btn-primary flex items-center gap-2 mx-auto"
        onClick={onGenerate}
        disabled={isGenerating}
      >
        {isGenerating ? (
          <><Loader2 className="w-4 h-4 animate-spin" /> Generating program…</>
        ) : (
          <><Sparkles className="w-4 h-4" /> Generate Compliance Program</>
        )}
      </button>
      <p className="text-xs text-gray-400 mt-3">Takes ~30 seconds · Idempotent · Can re-run anytime</p>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function GettingStartedPage() {
  const qc = useQueryClient();
  const [selectedTask, setSelectedTask] = useState<GuidedTask | null>(null);
  const [mineOnly, setMineOnly] = useState(false);
  const [generateSuccess, setGenerateSuccess] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => { setIsMounted(true); }, []);

  const { data: program, isLoading } = useQuery<GuidedProgram>({
    queryKey: ['guided-program', mineOnly],
    queryFn: () => teamApi.getGuidedProgram(mineOnly),
    refetchInterval: 30_000,
  });

  const { data: readiness } = useQuery({
    queryKey: ['readiness-score'],
    queryFn:  () => readinessApi.getScore(),
  });

  const generate = useMutation({
    mutationFn: teamApi.generateGuidedProgram,
    onSuccess: (data) => {
      setGenerateSuccess(true);
      qc.invalidateQueries({ queryKey: ['guided-program'] });
    },
  });

  const hasProgram = program && program.stats.total > 0;

  const handleSelect = (t: GuidedTask) => {
    setSelectedTask((prev) => (prev?.id === t.id ? null : t));
  };

  return (
    <div className="p-6 max-w-screen-2xl mx-auto">
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Rocket className="w-5 h-5 text-brand-600" />
            Getting Started
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Your guided compliance program</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
            <input
              type="checkbox"
              checked={mineOnly}
              onChange={(e) => setMineOnly(e.target.checked)}
              className="accent-brand-600"
            />
            My tasks only
          </label>
          <button
            className="btn-secondary flex items-center gap-2 text-sm"
            onClick={() => generate.mutate()}
            disabled={generate.isPending}
            title="Re-generate or add new tasks for recently added controls"
          >
            {generate.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            {hasProgram ? 'Refresh' : 'Generate'}
          </button>
        </div>
      </div>

      {/* Generate success banner */}
      {generateSuccess && (
        <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm rounded-xl px-4 py-3 mb-4">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>
            <strong>{(generate.data as any)?.created ?? 0} new tasks</strong> generated
            {(generate.data as any)?.skipped > 0 && ` · ${(generate.data as any).skipped} already existed`}
          </span>
          <button onClick={() => setGenerateSuccess(false)} className="ml-auto">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {!isMounted || isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-brand-600" />
        </div>
      ) : !hasProgram ? (
        <GenerateCTA onGenerate={() => generate.mutate()} isGenerating={generate.isPending} />
      ) : (
        <>
          {/* Progress header */}
          <ProgressHeader
            stats={program.stats}
            targetDate={(readiness as any)?.targetDate}
          />

          <div className={cn('gap-6', selectedTask ? 'grid grid-cols-1 lg:grid-cols-[1fr_400px]' : 'block')}>
            {/* Task list */}
            <div>
              <Section
                title="This Week"
                icon={AlertCircle}
                count={program.thisWeek.length}
                colorClass="text-red-500"
                tasks={program.thisWeek}
                selectedId={selectedTask?.id ?? null}
                onSelect={handleSelect}
                emptyText="No urgent tasks this week — you're ahead!"
              />

              <Section
                title="Ready to Start"
                icon={Play}
                count={program.readyNow.length}
                colorClass="text-emerald-600"
                tasks={program.readyNow}
                selectedId={selectedTask?.id ?? null}
                onSelect={handleSelect}
                emptyText="No unblocked tasks. Complete 'This Week' first."
              />

              <Section
                title="Blocked"
                icon={Lock}
                count={program.blocked.length}
                colorClass="text-amber-500"
                tasks={program.blocked}
                selectedId={selectedTask?.id ?? null}
                onSelect={handleSelect}
                defaultOpen={false}
                emptyText="No blocked tasks — great!"
              />

              <Section
                title="Recurring"
                icon={RefreshCw}
                count={program.recurring.length}
                colorClass="text-blue-500"
                tasks={program.recurring}
                selectedId={selectedTask?.id ?? null}
                onSelect={handleSelect}
                defaultOpen={false}
                emptyText="No recurring tasks scheduled yet."
              />
            </div>

            {/* Detail panel */}
            {selectedTask && (
              <TaskDetailPanel task={selectedTask} onClose={() => setSelectedTask(null)} />
            )}
          </div>
        </>
      )}
    </div>
  );
}
