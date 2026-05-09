'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Target, Plus, TrendingUp, TrendingDown, Minus, X } from 'lucide-react';
import { apiClient } from '@/lib/api/client';
import { cn } from '@/lib/utils';

interface EnvObjective {
  id: string;
  title: string;
  metric: string;
  unit: string;
  target: number;
  current: number;
  baseline: number;
  baselineYear: number;
  targetDate: string;
  frequency: string;
  responsible: string;
  status: 'on_track' | 'at_risk' | 'off_track' | 'achieved';
  notes?: string;
  createdAt: string;
}

const FREQUENCIES = ['Monthly', 'Quarterly', 'Semi-Annual', 'Annual'];
const STATUS_OPTS: EnvObjective['status'][] = ['on_track', 'at_risk', 'off_track', 'achieved'];

const STATUS_CFG: Record<string, { label: string; bg: string; text: string }> = {
  on_track:  { label: 'On Track',  bg: 'bg-green-100',  text: 'text-green-700' },
  at_risk:   { label: 'At Risk',   bg: 'bg-amber-100',  text: 'text-amber-700' },
  off_track: { label: 'Off Track', bg: 'bg-red-100',    text: 'text-red-700'   },
  achieved:  { label: 'Achieved',  bg: 'bg-blue-100',   text: 'text-blue-700'  },
};

const EMPTY = {
  title: '', metric: '', unit: '', target: 0, current: 0,
  baseline: 0, baselineYear: new Date().getFullYear(),
  targetDate: '', frequency: 'Quarterly', responsible: '',
  status: 'on_track' as EnvObjective['status'], notes: '',
};

function pct(current: number, target: number, baseline: number) {
  if (target === baseline) return 100;
  const progress = Math.abs(current - baseline) / Math.abs(target - baseline);
  return Math.min(100, Math.max(0, Math.round(progress * 100)));
}

export default function EnvObjectivesPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<EnvObjective | null>(null);
  const [form, setForm] = useState({ ...EMPTY });

  const { data: objectives = [], isLoading } = useQuery<EnvObjective[]>({
    queryKey: ['env-objectives'],
    queryFn: () => apiClient.get('/iso14001/objectives').then(r => r.data?.data ?? r.data ?? []),
  });

  const saveMutation = useMutation({
    mutationFn: (dto: any) => editing
      ? apiClient.put(`/iso14001/objectives/${editing.id}`, dto).then(r => r.data)
      : apiClient.post('/iso14001/objectives', dto).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['env-objectives'] });
      setShowForm(false); setEditing(null); setForm({ ...EMPTY });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/iso14001/objectives/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['env-objectives'] }),
  });

  function openEdit(o: EnvObjective) {
    setEditing(o);
    setForm({
      title: o.title, metric: o.metric, unit: o.unit,
      target: o.target, current: o.current, baseline: o.baseline,
      baselineYear: o.baselineYear,
      targetDate: o.targetDate?.split('T')[0] ?? '',
      frequency: o.frequency, responsible: o.responsible,
      status: o.status, notes: o.notes ?? '',
    });
    setShowForm(true);
  }

  const onTrack   = objectives.filter(o => o.status === 'on_track').length;
  const achieved  = objectives.filter(o => o.status === 'achieved').length;
  const offTrack  = objectives.filter(o => o.status === 'off_track').length;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <div className="w-11 h-11 rounded-xl bg-green-100 flex items-center justify-center shrink-0">
            <Target className="h-5 w-5 text-green-700" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Environmental Objectives</h1>
            <p className="text-sm text-gray-500 mt-0.5">ISO 14001 Clause 6.2 — Environmental objectives and planning</p>
          </div>
        </div>
        <button
          onClick={() => { setEditing(null); setForm({ ...EMPTY }); setShowForm(true); }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 transition-colors"
        >
          <Plus className="h-4 w-4" /> Add Objective
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total', value: objectives.length, color: 'text-gray-900', bg: 'bg-gray-50' },
          { label: 'On Track', value: onTrack, color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Achieved', value: achieved, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Off Track', value: offTrack, color: 'text-red-600', bg: 'bg-red-50' },
        ].map(({ label, value, color, bg }) => (
          <div key={label} className={cn('rounded-xl p-4 border border-gray-100', bg)}>
            <p className={cn('text-2xl font-bold', color)}>{value}</p>
            <p className="text-sm text-gray-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Objectives grid */}
      {isLoading ? (
        <div className="p-8 text-center text-gray-400">Loading objectives…</div>
      ) : objectives.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-12 text-center">
          <Target className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No environmental objectives set</p>
          <p className="text-gray-400 text-sm mt-1">Define SMART environmental objectives to drive improvement</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {objectives.map(o => {
            const progress = pct(o.current, o.target, o.baseline);
            const cfg = STATUS_CFG[o.status];
            const TrendIcon = o.current > o.baseline ? TrendingDown : o.current < o.baseline ? TrendingUp : Minus;
            const trendColor = o.current < o.target
              ? (o.target < o.baseline ? 'text-green-500' : 'text-amber-500')
              : 'text-green-500';
            return (
              <div key={o.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', cfg.bg, cfg.text)}>{cfg.label}</span>
                      <span className="text-xs text-gray-400">{o.frequency}</span>
                    </div>
                    <h3 className="font-semibold text-gray-900 mt-1.5 text-sm">{o.title}</h3>
                    <p className="text-xs text-gray-500 mt-0.5">{o.metric}</p>
                  </div>
                  <div className="flex items-center gap-2 ml-3 shrink-0">
                    <button onClick={() => openEdit(o)} className="text-xs text-blue-600 hover:text-blue-800">Edit</button>
                    <button onClick={() => deleteMutation.mutate(o.id)} className="text-xs text-red-500 hover:text-red-700">Delete</button>
                  </div>
                </div>

                {/* Progress */}
                <div className="space-y-1.5 mb-3">
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Progress toward target</span>
                    <span className="font-semibold text-gray-700">{progress}%</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={cn('h-full rounded-full transition-all duration-500',
                        o.status === 'achieved' ? 'bg-blue-500' :
                        o.status === 'on_track'  ? 'bg-green-500' :
                        o.status === 'at_risk'   ? 'bg-amber-400' : 'bg-red-500'
                      )}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>

                {/* Metrics row */}
                <div className="grid grid-cols-3 gap-2 text-center">
                  {[
                    { label: 'Baseline', value: `${o.baseline} ${o.unit}` },
                    { label: 'Current',  value: `${o.current} ${o.unit}` },
                    { label: 'Target',   value: `${o.target} ${o.unit}` },
                  ].map(({ label, value }) => (
                    <div key={label} className="bg-gray-50 rounded-lg p-2">
                      <p className="text-xs text-gray-500">{label}</p>
                      <p className="text-sm font-semibold text-gray-800 mt-0.5">{value}</p>
                    </div>
                  ))}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-50 text-xs text-gray-400">
                  <span className="flex items-center gap-1">
                    <TrendIcon className={cn('w-3 h-3', trendColor)} />
                    {o.responsible}
                  </span>
                  {o.targetDate && (
                    <span>Target: {new Date(o.targetDate).toLocaleDateString()}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-100 sticky top-0 bg-white z-10">
              <h2 className="font-bold text-gray-900">{editing ? 'Edit Objective' : 'Add Environmental Objective'}</h2>
              <button onClick={() => setShowForm(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <form onSubmit={e => { e.preventDefault(); saveMutation.mutate(form); }} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Objective Title *</label>
                <input required value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                  placeholder="e.g., Reduce GHG emissions by 30%" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Metric *</label>
                  <input required value={form.metric} onChange={e => setForm(f => ({ ...f, metric: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                    placeholder="e.g., tCO2e / year" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Unit *</label>
                  <input required value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                    placeholder="e.g., tCO2e" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { key: 'baseline', label: 'Baseline Value' },
                  { key: 'current',  label: 'Current Value' },
                  { key: 'target',   label: 'Target Value' },
                ].map(({ key, label }) => (
                  <div key={key}>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">{label} *</label>
                    <input required type="number" value={(form as any)[key]}
                      onChange={e => setForm(f => ({ ...f, [key]: parseFloat(e.target.value) || 0 }))}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Baseline Year</label>
                  <input type="number" min={2000} max={2050} value={form.baselineYear}
                    onChange={e => setForm(f => ({ ...f, baselineYear: parseInt(e.target.value) || 2020 }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Target Date</label>
                  <input type="date" value={form.targetDate}
                    onChange={e => setForm(f => ({ ...f, targetDate: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Measurement Frequency</label>
                  <select value={form.frequency} onChange={e => setForm(f => ({ ...f, frequency: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-400">
                    {FREQUENCIES.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Status</label>
                  <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as any }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-400">
                    {STATUS_OPTS.map(s => <option key={s} value={s}>{STATUS_CFG[s].label}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Responsible Person / Team</label>
                <input value={form.responsible} onChange={e => setForm(f => ({ ...f, responsible: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                  placeholder="e.g., Environmental Manager" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Notes</label>
                <textarea rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-400 resize-none"
                  placeholder="Additional context or methodology notes" />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowForm(false)}
                  className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={saveMutation.isPending}
                  className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50">
                  {saveMutation.isPending ? 'Saving…' : editing ? 'Save Changes' : 'Add Objective'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
