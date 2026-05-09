'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import {
  Target, Plus, Pencil, Trash2, X, ChevronDown, ChevronUp, AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ActionItem {
  id: string;
  actionTitle: string;
  csfFunction: 'GV' | 'ID' | 'PR' | 'DE' | 'RS' | 'RC';
  categoryId: string;
  currentTier: 1 | 2 | 3 | 4;
  targetTier: 1 | 2 | 3 | 4;
  priority: 'critical' | 'high' | 'medium' | 'low';
  status: 'not_started' | 'in_progress' | 'completed' | 'deferred' | 'cancelled';
  owner: string;
  startDate: string;
  targetDate: string;
  completedDate?: string;
  estimatedEffort: string;
  successCriteria: string;
  dependencies: string;
  notes: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function daysUntil(dateStr: string): number {
  if (!dateStr) return Infinity;
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86_400_000);
}

const FUNCTION_META: Record<string, { label: string; color: string; bg: string }> = {
  GV: { label: 'Govern',   color: 'text-purple-700', bg: 'bg-purple-100' },
  ID: { label: 'Identify', color: 'text-blue-700',   bg: 'bg-blue-100' },
  PR: { label: 'Protect',  color: 'text-green-700',  bg: 'bg-green-100' },
  DE: { label: 'Detect',   color: 'text-amber-700',  bg: 'bg-amber-100' },
  RS: { label: 'Respond',  color: 'text-red-700',    bg: 'bg-red-100' },
  RC: { label: 'Recover',  color: 'text-sky-700',    bg: 'bg-sky-100' },
};

function priorityColor(p: ActionItem['priority']) {
  return p === 'critical' ? 'bg-red-100 text-red-700'
    : p === 'high'        ? 'bg-orange-100 text-orange-700'
    : p === 'medium'      ? 'bg-amber-100 text-amber-700'
    : 'bg-slate-100 text-slate-600';
}

function statusColor(s: ActionItem['status']) {
  return s === 'completed'   ? 'bg-green-100 text-green-700'
    : s === 'in_progress'    ? 'bg-blue-100 text-blue-700'
    : s === 'deferred'       ? 'bg-slate-100 text-slate-500'
    : s === 'cancelled'      ? 'bg-slate-100 text-slate-400'
    : 'bg-slate-100 text-slate-600';
}

function statusLabel(s: ActionItem['status']) {
  const m: Record<string, string> = {
    not_started: 'Not Started', in_progress: 'In Progress', completed: 'Completed',
    deferred: 'Deferred', cancelled: 'Cancelled',
  };
  return m[s] ?? s;
}

const EMPTY: Partial<ActionItem> = {
  actionTitle: '', csfFunction: 'GV', categoryId: '',
  currentTier: 1, targetTier: 2, priority: 'medium',
  status: 'not_started', owner: '', startDate: '', targetDate: '',
  completedDate: '', estimatedEffort: '', successCriteria: '',
  dependencies: '', notes: '',
};

// ── Main Component ────────────────────────────────────────────────────────────

export default function ActionPlanPage() {
  const qc = useQueryClient();
  const [modal, setModal]       = useState<'create' | 'edit' | null>(null);
  const [form, setForm]         = useState<Partial<ActionItem>>(EMPTY);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterFn, setFilterFn]         = useState('');

  const { data: actions = [], isLoading } = useQuery<ActionItem[]>({
    queryKey: ['nist-csf-actions'],
    queryFn: () => apiClient.get('/nist-csf/action-plan').then(r => r.data),
  });

  const save = useMutation({
    mutationFn: (a: Partial<ActionItem>) =>
      a.id ? apiClient.put(`/nist-csf/action-plan/${a.id}`, a).then(r => r.data)
           : apiClient.post('/nist-csf/action-plan', a).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['nist-csf-actions'] }); setModal(null); },
  });

  const remove = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/nist-csf/action-plan/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['nist-csf-actions'] }),
  });

  const completed  = actions.filter(a => a.status === 'completed').length;
  const inProgress = actions.filter(a => a.status === 'in_progress').length;
  const overdue    = actions.filter(a => a.targetDate && daysUntil(a.targetDate) < 0 && a.status !== 'completed' && a.status !== 'cancelled').length;
  const pct        = actions.length ? Math.round((completed / actions.length) * 100) : 0;

  const filtered = actions.filter(a =>
    (filterStatus === '' || a.status === filterStatus) &&
    (filterFn === '' || a.csfFunction === filterFn)
  );

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Implementation Action Plan</h1>
          <p className="text-sm text-slate-500 mt-1">
            NIST CSF 2.0 — Track actions to close tier gaps and improve cybersecurity posture
          </p>
        </div>
        <button
          onClick={() => { setForm(EMPTY); setModal('create'); }}
          className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 text-sm font-medium"
        >
          <Plus className="w-4 h-4" /> Add Action
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Actions',  value: actions.length, color: 'text-orange-600' },
          { label: 'In Progress',    value: inProgress,     color: 'text-blue-600' },
          { label: 'Completed',      value: completed,      color: 'text-green-600' },
          { label: 'Overdue',        value: overdue,        color: 'text-red-600' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-xs text-slate-500 mb-1">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Progress */}
      {actions.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-700">Overall Completion</span>
            <span className="text-sm font-bold text-orange-700">{pct}%</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-3">
            <div className="h-3 rounded-full bg-gradient-to-r from-orange-500 to-amber-400 transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}

      {overdue > 0 && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-lg p-4 text-red-800 text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span><strong>{overdue} action{overdue > 1 ? 's' : ''}</strong> past target date — review timelines and update status.</span>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-600">Status:</span>
          {['', 'in_progress', 'not_started', 'completed', 'deferred'].map(st => (
            <button key={st} onClick={() => setFilterStatus(st)}
              className={cn('text-xs px-2 py-1 rounded-full border',
                filterStatus === st ? 'bg-orange-600 text-white border-orange-600' : 'border-slate-200 text-slate-600')}>
              {st === '' ? 'All' : statusLabel(st as ActionItem['status'])}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-600">Function:</span>
          {['', ...Object.keys(FUNCTION_META)].map(fn => (
            <button key={fn} onClick={() => setFilterFn(fn)}
              className={cn('text-xs px-2 py-1 rounded-full border',
                filterFn === fn ? 'bg-orange-600 text-white border-orange-600' : 'border-slate-200 text-slate-600')}>
              {fn === '' ? 'All' : fn}
            </button>
          ))}
        </div>
      </div>

      {/* Actions List */}
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
          <Target className="w-4 h-4 text-orange-600" />
          <span className="font-semibold text-slate-800 text-sm">Actions ({filtered.length})</span>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-slate-400 text-sm">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">No actions yet — add improvement actions to close tier gaps.</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filtered.map(action => {
              const isOpen = expanded === action.id;
              const meta = FUNCTION_META[action.csfFunction];
              const days = action.targetDate ? daysUntil(action.targetDate) : null;
              return (
                <div key={action.id}>
                  <div className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50">
                    <button className="text-slate-400 hover:text-slate-600" onClick={() => setExpanded(isOpen ? null : action.id)}>
                      {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={cn('text-xs px-2 py-0.5 rounded-full font-mono font-medium', meta.bg, meta.color)}>
                          {action.csfFunction}
                        </span>
                        {action.categoryId && (
                          <span className="text-xs font-mono bg-slate-100 text-slate-600 px-2 py-0.5 rounded">{action.categoryId}</span>
                        )}
                        <span className="font-medium text-sm text-slate-900">{action.actionTitle}</span>
                        <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', priorityColor(action.priority))}>
                          {action.priority.toUpperCase()}
                        </span>
                        <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', statusColor(action.status))}>
                          {statusLabel(action.status)}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-xs text-slate-500">
                        <span>Tier {action.currentTier} → {action.targetTier}</span>
                        {action.owner && <span>{action.owner}</span>}
                        {days !== null && (
                          <span className={cn(days < 0 ? 'text-red-600 font-medium' : days <= 14 ? 'text-amber-600' : '')}>
                            {days < 0 ? `${Math.abs(days)}d overdue` : `Due: ${action.targetDate}`}
                          </span>
                        )}
                        {action.estimatedEffort && <span>Est: {action.estimatedEffort}</span>}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => { setForm(action); setModal('edit'); }} className="p-1.5 text-slate-400 hover:text-orange-600">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => remove.mutate(action.id)} className="p-1.5 text-slate-400 hover:text-red-600">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {isOpen && (
                    <div className="px-10 pb-4 bg-slate-50 space-y-2 text-sm">
                      {action.successCriteria && (
                        <div><span className="text-slate-500">Success Criteria: </span><span>{action.successCriteria}</span></div>
                      )}
                      {action.dependencies && (
                        <div><span className="text-slate-500">Dependencies: </span><span>{action.dependencies}</span></div>
                      )}
                      {action.startDate && (
                        <div><span className="text-slate-500">Start Date: </span><span className="font-medium">{action.startDate}</span></div>
                      )}
                      {action.completedDate && (
                        <div><span className="text-slate-500">Completed: </span><span className="font-medium text-green-700">{action.completedDate}</span></div>
                      )}
                      {action.notes && (
                        <div><span className="text-slate-500">Notes: </span><span>{action.notes}</span></div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="font-semibold text-slate-900">{modal === 'create' ? 'Add Action' : 'Edit Action'}</h2>
              <button onClick={() => setModal(null)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-xs font-medium text-slate-600 mb-1">Action Title *</label>
                <input value={form.actionTitle ?? ''} onChange={e => setForm((f: any) => ({ ...f, actionTitle: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="Implement formal risk management process" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">CSF Function *</label>
                <select value={form.csfFunction ?? 'GV'} onChange={e => setForm((f: any) => ({ ...f, csfFunction: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                  {Object.entries(FUNCTION_META).map(([fn, m]) => (
                    <option key={fn} value={fn}>{fn} – {m.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Category ID</label>
                <input value={form.categoryId ?? ''} onChange={e => setForm((f: any) => ({ ...f, categoryId: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="GV.RM-1" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Current Tier</label>
                <select value={form.currentTier ?? 1} onChange={e => setForm((f: any) => ({ ...f, currentTier: +e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                  {[1,2,3,4].map(t => <option key={t} value={t}>Tier {t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Target Tier</label>
                <select value={form.targetTier ?? 2} onChange={e => setForm((f: any) => ({ ...f, targetTier: +e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                  {[1,2,3,4].map(t => <option key={t} value={t}>Tier {t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Priority</label>
                <select value={form.priority ?? 'medium'} onChange={e => setForm((f: any) => ({ ...f, priority: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                  <option value="critical">Critical</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Status</label>
                <select value={form.status ?? 'not_started'} onChange={e => setForm((f: any) => ({ ...f, status: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                  <option value="not_started">Not Started</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                  <option value="deferred">Deferred</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Owner</label>
                <input value={form.owner ?? ''} onChange={e => setForm((f: any) => ({ ...f, owner: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="CISO" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Estimated Effort</label>
                <input value={form.estimatedEffort ?? ''} onChange={e => setForm((f: any) => ({ ...f, estimatedEffort: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="2 weeks, 40 hours" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Start Date</label>
                <input type="date" value={form.startDate ?? ''} onChange={e => setForm((f: any) => ({ ...f, startDate: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Target Date</label>
                <input type="date" value={form.targetDate ?? ''} onChange={e => setForm((f: any) => ({ ...f, targetDate: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
              </div>
              {form.status === 'completed' && (
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Completed Date</label>
                  <input type="date" value={form.completedDate ?? ''} onChange={e => setForm((f: any) => ({ ...f, completedDate: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
                </div>
              )}
              <div className="col-span-2">
                <label className="block text-xs font-medium text-slate-600 mb-1">Success Criteria</label>
                <textarea rows={2} value={form.successCriteria ?? ''} onChange={e => setForm((f: any) => ({ ...f, successCriteria: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm resize-none" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-slate-600 mb-1">Dependencies</label>
                <textarea rows={1} value={form.dependencies ?? ''} onChange={e => setForm((f: any) => ({ ...f, dependencies: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm resize-none" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
                <textarea rows={2} value={form.notes ?? ''} onChange={e => setForm((f: any) => ({ ...f, notes: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm resize-none" />
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100">
              <button onClick={() => setModal(null)} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900">Cancel</button>
              <button onClick={() => save.mutate(form)} disabled={save.isPending}
                className="px-5 py-2 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700 disabled:opacity-50">
                {save.isPending ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
