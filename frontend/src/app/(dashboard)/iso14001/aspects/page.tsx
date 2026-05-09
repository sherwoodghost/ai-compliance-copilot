'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Leaf, Plus, AlertTriangle, CheckCircle2, X } from 'lucide-react';
import { apiClient } from '@/lib/api/client';
import { cn } from '@/lib/utils';

interface EnvAspect {
  id: string;
  activity: string;
  aspect: string;
  impact: string;
  category: string;
  significance: 'significant' | 'not_significant';
  controlMeasure?: string;
  isControlled: boolean;
  notes?: string;
  createdAt: string;
}

const CATEGORIES = ['Energy', 'Water', 'Emissions', 'Waste', 'Land Use', 'Biodiversity', 'Noise', 'Chemical', 'Other'];

const SIG_COLORS: Record<string, string> = {
  significant:     'bg-red-100 text-red-700',
  not_significant: 'bg-green-100 text-green-700',
};

const CAT_COLORS: Record<string, string> = {
  Energy:      'bg-yellow-100 text-yellow-700',
  Water:       'bg-blue-100 text-blue-700',
  Emissions:   'bg-gray-100 text-gray-700',
  Waste:       'bg-orange-100 text-orange-700',
  'Land Use':  'bg-lime-100 text-lime-700',
  Biodiversity:'bg-emerald-100 text-emerald-700',
  Noise:       'bg-purple-100 text-purple-700',
  Chemical:    'bg-rose-100 text-rose-700',
  Other:       'bg-slate-100 text-slate-700',
};

const EMPTY: Pick<EnvAspect, 'activity'|'aspect'|'impact'|'category'|'significance'|'controlMeasure'|'isControlled'|'notes'> = {
  activity: '', aspect: '', impact: '', category: 'Emissions',
  significance: 'not_significant', controlMeasure: '', isControlled: false, notes: '',
};

export default function EnvAspectsPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<EnvAspect | null>(null);
  const [form, setForm] = useState({ ...EMPTY });

  const { data: aspects = [], isLoading } = useQuery<EnvAspect[]>({
    queryKey: ['env-aspects'],
    queryFn: () => apiClient.get('/iso14001/aspects').then(r => r.data?.data ?? r.data ?? []),
  });

  const saveMutation = useMutation({
    mutationFn: (dto: any) => editing
      ? apiClient.put(`/iso14001/aspects/${editing.id}`, dto).then(r => r.data)
      : apiClient.post('/iso14001/aspects', dto).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['env-aspects'] });
      setShowForm(false);
      setEditing(null);
      setForm({ ...EMPTY });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/iso14001/aspects/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['env-aspects'] }),
  });

  function openEdit(a: EnvAspect) {
    setEditing(a);
    setForm({ activity: a.activity, aspect: a.aspect, impact: a.impact, category: a.category, significance: a.significance, controlMeasure: a.controlMeasure ?? '', isControlled: a.isControlled, notes: a.notes ?? '' });
    setShowForm(true);
  }

  const significant = aspects.filter(a => a.significance === 'significant');
  const controlled  = aspects.filter(a => a.isControlled);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <div className="w-11 h-11 rounded-xl bg-green-100 flex items-center justify-center shrink-0">
            <Leaf className="h-5 w-5 text-green-700" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Environmental Aspects Register</h1>
            <p className="text-sm text-gray-500 mt-0.5">ISO 14001 Clause 6.1.2 — Environmental aspects and impacts</p>
          </div>
        </div>
        <button onClick={() => { setEditing(null); setForm({ ...EMPTY }); setShowForm(true); }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 transition-colors">
          <Plus className="h-4 w-4" /> Add Aspect
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Aspects', value: aspects.length, color: 'text-gray-900', bg: 'bg-gray-50' },
          { label: 'Significant', value: significant.length, color: 'text-red-600', bg: 'bg-red-50' },
          { label: 'Controlled', value: controlled.length, color: 'text-green-600', bg: 'bg-green-50' },
        ].map(({ label, value, color, bg }) => (
          <div key={label} className={cn('rounded-xl p-4 border border-gray-100', bg)}>
            <p className={cn('text-2xl font-bold', color)}>{value}</p>
            <p className="text-sm text-gray-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Loading aspects…</div>
        ) : aspects.length === 0 ? (
          <div className="p-12 text-center">
            <Leaf className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No environmental aspects recorded</p>
            <p className="text-gray-400 text-sm mt-1">Add your first aspect to build your register</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  {['Activity / Source', 'Aspect', 'Impact', 'Category', 'Significance', 'Controlled', ''].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {aspects.map(a => (
                  <tr key={a.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-900">{a.activity}</td>
                    <td className="px-4 py-3 text-gray-600">{a.aspect}</td>
                    <td className="px-4 py-3 text-gray-600 max-w-[200px] truncate">{a.impact}</td>
                    <td className="px-4 py-3">
                      <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', CAT_COLORS[a.category] ?? 'bg-gray-100 text-gray-600')}>{a.category}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', SIG_COLORS[a.significance])}>
                        {a.significance === 'significant' ? 'Significant' : 'Not Significant'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {a.isControlled
                        ? <CheckCircle2 className="w-4 h-4 text-green-500" />
                        : <AlertTriangle className="w-4 h-4 text-amber-400" />}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button onClick={() => openEdit(a)} className="text-xs text-blue-600 hover:text-blue-800">Edit</button>
                        <button onClick={() => deleteMutation.mutate(a.id)} className="text-xs text-red-500 hover:text-red-700">Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h2 className="font-bold text-gray-900">{editing ? 'Edit Aspect' : 'Add Environmental Aspect'}</h2>
              <button onClick={() => setShowForm(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <form onSubmit={e => { e.preventDefault(); saveMutation.mutate(form); }} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Activity / Source *</label>
                  <input required value={form.activity} onChange={e => setForm(f => ({ ...f, activity: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-400" placeholder="e.g., Office operations" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Category</label>
                  <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-400">
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Environmental Aspect *</label>
                <input required value={form.aspect} onChange={e => setForm(f => ({ ...f, aspect: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-400" placeholder="e.g., Electricity consumption" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Environmental Impact *</label>
                <input required value={form.impact} onChange={e => setForm(f => ({ ...f, impact: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-400" placeholder="e.g., Depletion of natural resources, GHG emissions" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Significance</label>
                  <select value={form.significance} onChange={e => setForm(f => ({ ...f, significance: e.target.value as any }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-400">
                    <option value="not_significant">Not Significant</option>
                    <option value="significant">Significant</option>
                  </select>
                </div>
                <div className="flex items-center gap-2 pt-5">
                  <input type="checkbox" id="controlled" checked={form.isControlled} onChange={e => setForm(f => ({ ...f, isControlled: e.target.checked }))}
                    className="w-4 h-4 accent-green-600" />
                  <label htmlFor="controlled" className="text-sm text-gray-700">Control measure in place</label>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Control Measure</label>
                <input value={form.controlMeasure} onChange={e => setForm(f => ({ ...f, controlMeasure: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-400" placeholder="e.g., Renewable energy procurement" />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={saveMutation.isPending}
                  className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50">
                  {saveMutation.isPending ? 'Saving…' : editing ? 'Save Changes' : 'Add Aspect'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
