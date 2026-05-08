'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tasksApi, Task, SprintPlan as SprintResult, SprintItem } from '@/lib/api/tasks';
import {
  ClipboardList, AlertCircle, Clock, CheckCircle2,
  Calendar, LayoutGrid, List, Filter, Plus, X, Sparkles, Zap, RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState, useMemo } from 'react';

type ViewMode = 'board' | 'list';
type PriorityFilter = 'all' | 'critical' | 'high' | 'medium' | 'low';

// ─── Config ───────────────────────────────────────────────────────────────────

const PRIORITY_CONFIG = {
  critical: { label: 'Critical', cls: 'bg-red-100 text-red-700 border border-red-200',      dot: 'bg-red-500' },
  high:     { label: 'High',     cls: 'bg-orange-100 text-orange-700 border border-orange-200', dot: 'bg-orange-400' },
  medium:   { label: 'Medium',   cls: 'bg-amber-100 text-amber-700 border border-amber-200',    dot: 'bg-amber-400' },
  low:      { label: 'Low',      cls: 'bg-gray-100 text-gray-600',                              dot: 'bg-gray-300' },
} as const;

const COLUMNS = [
  { id: 'open',        label: 'To Do',       color: 'bg-gray-100', count_color: 'text-gray-600' },
  { id: 'in_progress', label: 'In Progress', color: 'bg-blue-100',  count_color: 'text-blue-600' },
  { id: 'blocked',     label: 'Blocked',     color: 'bg-red-100',   count_color: 'text-red-600' },
  { id: 'done',        label: 'Done',        color: 'bg-emerald-100', count_color: 'text-emerald-600' },
] as const;

const NEXT_STATUS: Record<string, string[]> = {
  open:        ['in_progress'],
  in_progress: ['blocked', 'done'],
  blocked:     ['in_progress'],
  done:        ['accepted'],
  accepted:    [],
};

// ─── Sprint Planner Panel ─────────────────────────────────────────────────────

const URGENCY_CFG: Record<string, { badge: string; border: string }> = {
  overdue:  { badge: 'bg-red-100 text-red-700 border-red-200',       border: 'border-l-red-400' },
  critical: { badge: 'bg-orange-100 text-orange-700 border-orange-200', border: 'border-l-orange-400' },
  high:     { badge: 'bg-yellow-100 text-yellow-700 border-yellow-200', border: 'border-l-yellow-400' },
  medium:   { badge: 'bg-blue-50 text-blue-700 border-blue-200',      border: 'border-l-blue-300' },
};

function SprintPanel({ result, onClose }: { result: SprintResult; onClose: () => void }) {
  const weekLabel = new Date(result.weekOf).toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
  return (
    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0">
            <Zap className="w-4 h-4 text-indigo-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">AI Sprint Planner</p>
            <p className="text-xs text-indigo-700">Week of {weekLabel} · {result.sprintItems.length} tasks · Readiness {result.readinessScore}%</p>
          </div>
        </div>
        <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-white/60">
          <X className="w-4 h-4" />
        </button>
      </div>

      {result.weekFocus && (
        <div className="bg-white/70 rounded-xl border border-blue-100 px-4 py-2.5">
          <p className="text-xs font-semibold text-indigo-700 mb-0.5">This week&apos;s focus</p>
          <p className="text-sm text-gray-800">{result.weekFocus}</p>
        </div>
      )}

      <div className="space-y-2">
        {result.sprintItems.map((item) => {
          const urg = URGENCY_CFG[item.urgencyLevel] ?? URGENCY_CFG.medium;
          const isOverdue = item.dueDate && new Date(item.dueDate) < new Date();
          return (
            <div key={item.taskId} className={cn('bg-white rounded-xl border-l-4 border border-blue-100 p-3', urg.border)}>
              <div className="flex items-start gap-2 mb-1">
                <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">{item.rank}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-gray-900 truncate">{item.title}</p>
                    <span className={cn('text-xs font-medium px-1.5 py-0.5 rounded-full border', urg.badge)}>
                      {item.urgencyLevel === 'overdue' ? '⚠ Overdue' : item.urgencyLevel}
                    </span>
                    {item.estimatedHours > 0 && (
                      <span className="text-xs text-gray-400">~{item.estimatedHours}h</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{item.reason}</p>
                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                    {item.controlCode && (
                      <span className="font-mono bg-gray-100 px-1 rounded">{item.controlCode}</span>
                    )}
                    {item.assignee && <span>{item.assignee}</span>}
                    {item.dueDate && (
                      <span className={cn(isOverdue ? 'text-red-500 font-medium' : '')}>
                        {isOverdue ? '⚠' : '📅'} {new Date(item.dueDate).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-xs text-gray-400 text-center">{result.totalOpen} total open tasks · showing top {result.sprintItems.length} priority items</p>
    </div>
  );
}

// ─── Add Task Modal ───────────────────────────────────────────────────────────

function TaskModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<'critical' | 'high' | 'medium' | 'low'>('medium');
  const [dueDate, setDueDate] = useState('');

  const create = useMutation({
    mutationFn: () =>
      tasksApi.create({
        title,
        description: description || undefined,
        priority,
        dueDate: dueDate || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
      onClose();
    },
  });

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-brand-600" />
            <h2 className="text-sm font-semibold text-gray-900">Add Task</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {/* Title */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Title *</label>
            <input
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="e.g. Schedule quarterly access review"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
            <textarea
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-brand-500"
              rows={2}
              placeholder="Optional details about this task…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {/* Priority */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-2">Priority</label>
            <div className="flex gap-1.5">
              {(['critical', 'high', 'medium', 'low'] as const).map((p) => {
                const cfg = PRIORITY_CONFIG[p];
                return (
                  <button
                    key={p}
                    onClick={() => setPriority(p)}
                    className={cn(
                      'flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors capitalize',
                      priority === p ? cfg.cls : 'border-gray-200 text-gray-500 hover:bg-gray-50',
                    )}
                  >
                    <span className={cn('w-1.5 h-1.5 rounded-full', cfg.dot)} />
                    {cfg.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Due Date */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Due Date (optional)</label>
            <input
              type="date"
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-2 justify-end px-5 py-4 border-t border-gray-100">
          <button className="btn-secondary text-sm" onClick={onClose}>Cancel</button>
          <button
            className="btn-primary text-sm"
            disabled={!title.trim() || create.isPending}
            onClick={() => create.mutate()}
          >
            {create.isPending ? 'Adding…' : 'Add Task'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Task Card (Board) ────────────────────────────────────────────────────────

function TaskCard({ task, onMove }: { task: Task; onMove: (status: string) => void }) {
  const overdue = task.dueDate && task.status !== 'done' && task.status !== 'accepted'
    && new Date(task.dueDate) < new Date();
  const p = PRIORITY_CONFIG[task.priority] ?? PRIORITY_CONFIG.low;
  const nextStatuses = NEXT_STATUS[task.status] ?? [];

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm hover:shadow-md
                    transition-all duration-150 group">
      {/* Priority + title */}
      <div className="flex items-start gap-2 mb-3">
        <span className={cn('w-1.5 h-1.5 rounded-full mt-1.5 shrink-0', p.dot)} />
        <p className="text-sm font-medium text-gray-900 leading-snug flex-1">{task.title}</p>
      </div>

      {task.description && (
        <p className="text-xs text-gray-500 mb-3 line-clamp-2 ml-3.5">{task.description}</p>
      )}

      {/* Tags row */}
      <div className="flex items-center gap-2 flex-wrap mb-3 ml-3.5">
        <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', p.cls)}>
          {p.label}
        </span>
        {task.control?.code && (
          <span className="text-xs font-mono bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
            {task.control.code}
          </span>
        )}
      </div>

      {/* Meta row */}
      <div className="flex items-center gap-3 text-xs text-gray-400 ml-3.5 mb-3">
        {task.dueDate && (
          <span className={cn('flex items-center gap-1', overdue && 'text-red-500 font-medium')}>
            {overdue && <AlertCircle className="w-3 h-3" />}
            <Calendar className="w-3 h-3" />
            {new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            {overdue && ' · Overdue'}
          </span>
        )}
        {task.assignee && (
          <span className="flex items-center gap-1 ml-auto">
            <div className="w-4 h-4 rounded-full bg-brand-100 flex items-center justify-center">
              <span className="text-[9px] font-bold text-brand-600">
                {task.assignee.fullName.charAt(0)}
              </span>
            </div>
            {task.assignee.fullName.split(' ')[0]}
          </span>
        )}
      </div>

      {/* Move buttons */}
      {nextStatuses.length > 0 && (
        <div className="flex gap-1 pt-2 border-t border-gray-100 ml-3.5">
          {nextStatuses.map((s) => {
            const col = COLUMNS.find((c) => c.id === s);
            return (
              <button
                key={s}
                onClick={() => onMove(s)}
                className="text-xs text-gray-400 hover:text-brand-600 transition-colors
                           px-2 py-0.5 rounded hover:bg-brand-50"
              >
                → {col?.label ?? s}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Task Row (List) ──────────────────────────────────────────────────────────

function TaskRow({ task, onMove }: { task: Task; onMove: (status: string) => void }) {
  const overdue = task.dueDate && task.status !== 'done' && task.status !== 'accepted'
    && new Date(task.dueDate) < new Date();
  const p = PRIORITY_CONFIG[task.priority] ?? PRIORITY_CONFIG.low;
  const statusCol = COLUMNS.find((c) => c.id === task.status);
  const nextStatuses = NEXT_STATUS[task.status] ?? [];

  return (
    <div className="flex items-center gap-4 px-4 py-3 bg-white border-b border-gray-100
                    hover:bg-gray-50/70 transition-colors last:border-0">
      {/* Priority dot */}
      <span className={cn('w-2 h-2 rounded-full shrink-0', p.dot)} />

      {/* Title */}
      <p className="text-sm text-gray-900 flex-1 min-w-0 truncate">{task.title}</p>

      {/* Control code */}
      {task.control?.code ? (
        <span className="text-xs font-mono bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded shrink-0 hidden sm:block">
          {task.control.code}
        </span>
      ) : <span className="w-16 shrink-0 hidden sm:block" />}

      {/* Priority badge */}
      <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium shrink-0 hidden md:block', p.cls)}>
        {p.label}
      </span>

      {/* Status */}
      {statusCol && (
        <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium shrink-0', statusCol.color, statusCol.count_color)}>
          {statusCol.label}
        </span>
      )}

      {/* Due date */}
      <span className={cn(
        'text-xs shrink-0 hidden lg:flex items-center gap-1',
        overdue ? 'text-red-500 font-medium' : 'text-gray-400',
      )}>
        {task.dueDate ? (
          <>
            {overdue && <AlertCircle className="w-3 h-3" />}
            {new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </>
        ) : '—'}
      </span>

      {/* Assignee */}
      <span className="text-xs text-gray-400 shrink-0 hidden lg:block w-24 truncate text-right">
        {task.assignee?.fullName.split(' ')[0] ?? '—'}
      </span>

      {/* Move */}
      {nextStatuses.length > 0 && (
        <button
          onClick={() => onMove(nextStatuses[0])}
          className="text-xs text-gray-400 hover:text-brand-600 shrink-0 transition-colors"
        >
          →
        </button>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TasksPage() {
  const qc = useQueryClient();
  const [viewMode, setViewMode] = useState<ViewMode>('board');
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [aiResult, setAiResult] = useState<{ created: number } | null>(null);
  const [sprintResult, setSprintResult] = useState<SprintResult | null>(null);

  const sprintMutation = useMutation({
    mutationFn: () => tasksApi.sprintPlan(),
    onSuccess: (result) => setSprintResult(result),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['tasks'],
    queryFn: () => tasksApi.list(),
    refetchInterval: 30_000,
  });

  const updateTask = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      tasksApi.update(id, { status: status as Task['status'] }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  });

  const generateTasks = useMutation({
    mutationFn: () => tasksApi.generateFromGaps(),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
      setAiResult({ created: result.created });
      setTimeout(() => setAiResult(null), 5000);
    },
  });

  // Backend returns an array; guard against unexpected shapes
  const tasks: Task[] = Array.isArray(data) ? data : [];

  const filtered = useMemo(() => {
    if (priorityFilter === 'all') return tasks;
    return tasks.filter((t) => t.priority === priorityFilter);
  }, [tasks, priorityFilter]);

  const stats = useMemo(() => ({
    total:   tasks.length,
    open:    tasks.filter((t) => t.status === 'open').length,
    active:  tasks.filter((t) => t.status === 'in_progress').length,
    overdue: tasks.filter((t) =>
      t.dueDate && t.status !== 'done' && t.status !== 'accepted' && new Date(t.dueDate) < new Date()
    ).length,
    done:    tasks.filter((t) => t.status === 'done' || t.status === 'accepted').length,
  }), [tasks]);

  const byStatus = (status: string) => filtered.filter((t) => t.status === status);

  const PRIORITY_TABS: { key: PriorityFilter; label: string }[] = [
    { key: 'all',      label: 'All' },
    { key: 'critical', label: 'Critical' },
    { key: 'high',     label: 'High' },
    { key: 'medium',   label: 'Medium' },
    { key: 'low',      label: 'Low' },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      {showAddModal && <TaskModal onClose={() => setShowAddModal(false)} />}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Tasks</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {stats.open} to do · {stats.active} in progress
            {stats.overdue > 0 && (
              <span className="text-red-500 font-medium"> · {stats.overdue} overdue</span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* AI Sprint Planner button */}
          <button
            onClick={() => sprintMutation.mutate()}
            disabled={sprintMutation.isPending}
            className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg border border-indigo-200
                       bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors disabled:opacity-60"
          >
            {sprintMutation.isPending
              ? <RefreshCw className="w-4 h-4 animate-spin" />
              : <Zap className="w-4 h-4" />}
            {sprintMutation.isPending ? 'Planning…' : 'Sprint Planner'}
          </button>

          {/* AI Generate button */}
          <button
            onClick={() => generateTasks.mutate()}
            disabled={generateTasks.isPending}
            className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg border border-purple-200
                       bg-purple-50 text-purple-700 hover:bg-purple-100 transition-colors disabled:opacity-60"
          >
            {generateTasks.isPending ? (
              <div className="w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            {generateTasks.isPending ? 'Generating…' : 'AI Generate Tasks'}
          </button>

          {/* Add Task button */}
          <button
            onClick={() => setShowAddModal(true)}
            className="btn-primary flex items-center gap-1.5 text-sm"
          >
            <Plus className="w-4 h-4" />
            Add Task
          </button>

          {/* View toggle */}
          <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg">
          <button
            onClick={() => setViewMode('board')}
            className={cn(
              'p-1.5 rounded-md transition-colors',
              viewMode === 'board' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700',
            )}
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={cn(
              'p-1.5 rounded-md transition-colors',
              viewMode === 'list' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700',
            )}
          >
            <List className="w-4 h-4" />
          </button>
          </div>
        </div>
      </div>

      {/* AI result banner */}
      {aiResult !== null && (
        <div className="flex items-center gap-2 px-4 py-3 bg-purple-50 border border-purple-200 rounded-xl text-sm text-purple-800">
          <Sparkles className="w-4 h-4 text-purple-500 shrink-0" />
          {aiResult.created === 0
            ? 'All controls already have open tasks — nothing new to generate.'
            : `✓ ${aiResult.created} AI-generated task${aiResult.created !== 1 ? 's' : ''} added to your board.`}
        </div>
      )}

      {/* Sprint planner panel */}
      {sprintResult && (
        <SprintPanel result={sprintResult} onClose={() => setSprintResult(null)} />
      )}

      {/* Stats strip */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Total', value: stats.total, icon: ClipboardList, color: 'text-gray-700' },
          { label: 'In Progress', value: stats.active, icon: Clock, color: 'text-blue-600' },
          { label: 'Overdue', value: stats.overdue, icon: AlertCircle, color: 'text-red-500' },
          { label: 'Completed', value: stats.done, icon: CheckCircle2, color: 'text-emerald-600' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs text-gray-500">{label}</p>
              <Icon className={cn('w-4 h-4', color)} />
            </div>
            <p className={cn('text-2xl font-bold', color)}>{value}</p>
          </div>
        ))}
      </div>

      {/* Priority filter */}
      <div className="flex items-center gap-2">
        <Filter className="w-4 h-4 text-gray-400" />
        <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg">
          {PRIORITY_TABS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setPriorityFilter(key)}
              className={cn(
                'px-3 py-1 text-xs font-medium rounded-md transition-all',
                priorityFilter === key
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700',
              )}
            >
              {key !== 'all' && (
                <span className={cn('inline-block w-1.5 h-1.5 rounded-full mr-1.5 align-middle',
                  PRIORITY_CONFIG[key as keyof typeof PRIORITY_CONFIG]?.dot)} />
              )}
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-5 h-5 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : tasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
            <ClipboardList className="w-7 h-7 text-gray-300" />
          </div>
          <p className="text-sm font-semibold text-gray-700 mb-1">No tasks yet</p>
          <p className="text-xs text-gray-400 max-w-xs text-center mb-5">
            Create tasks manually or let AI generate remediation tasks from your open compliance gaps.
          </p>
          <button
            onClick={() => generateTasks.mutate()}
            disabled={generateTasks.isPending}
            className="flex items-center gap-2 text-sm px-4 py-2.5 rounded-lg bg-purple-600 text-white
                       hover:bg-purple-700 transition-colors disabled:opacity-60 font-medium"
          >
            {generateTasks.isPending ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            {generateTasks.isPending ? 'Generating tasks…' : 'Generate AI Remediation Tasks'}
          </button>
        </div>
      ) : viewMode === 'board' ? (
        /* ── Board view ── */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {COLUMNS.map((col) => {
            const colTasks = byStatus(col.id);
            return (
              <div key={col.id} className="flex flex-col gap-3">
                {/* Column header */}
                <div className="flex items-center gap-2">
                  <span className={cn('w-2 h-2 rounded-full', col.color.replace('bg-', 'bg-')
                    .replace('-100', '-400'))} />
                  <h3 className="text-sm font-semibold text-gray-700">{col.label}</h3>
                  <span className={cn(
                    'text-xs font-medium px-1.5 py-0.5 rounded-full',
                    col.color, col.count_color,
                  )}>
                    {colTasks.length}
                  </span>
                </div>

                {/* Tasks */}
                <div className="space-y-2 min-h-[80px]">
                  {colTasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      onMove={(status) => updateTask.mutate({ id: task.id, status })}
                    />
                  ))}
                  {colTasks.length === 0 && (
                    <div className="rounded-xl border-2 border-dashed border-gray-200 p-6 text-center">
                      <p className="text-xs text-gray-400">Empty</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* ── List view ── */
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          {/* Table header */}
          <div className="flex items-center gap-4 px-4 py-2.5 bg-gray-50 border-b border-gray-200">
            <span className="w-2 shrink-0" />
            <span className="text-xs font-medium text-gray-500 flex-1">Task</span>
            <span className="text-xs font-medium text-gray-500 w-16 hidden sm:block">Control</span>
            <span className="text-xs font-medium text-gray-500 w-20 hidden md:block">Priority</span>
            <span className="text-xs font-medium text-gray-500 w-24">Status</span>
            <span className="text-xs font-medium text-gray-500 w-20 hidden lg:block">Due</span>
            <span className="text-xs font-medium text-gray-500 w-24 text-right hidden lg:block">Owner</span>
            <span className="w-6" />
          </div>

          {filtered.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              onMove={(status) => updateTask.mutate({ id: task.id, status })}
            />
          ))}

          {filtered.length === 0 && (
            <div className="py-10 text-center text-sm text-gray-400">
              No tasks match the current filter.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
