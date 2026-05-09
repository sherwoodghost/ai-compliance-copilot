'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Plus, CheckCircle2, X, Shield } from 'lucide-react';
import { apiClient } from '@/lib/api/client';
import { cn } from '@/lib/utils';

interface Hazard {
  id: string;
  title: string;
  location: string;
  activity: string;
  hazardType: string;
  description: string;
  // Risk matrix
  likelihoodBefore: number;
  consequenceBefore: number;
  likelihoodAfter: number;
  consequenceAfter: number;
  // Controls
  hierarchyLevel: 'elimination' | 'substitution' | 'engineering' | 'administrative' | 'ppe';
  controlMeasure: string;
  controlStatus: 'implemented' | 'in_progress' | 'planned' | 'not_started';
  responsible: string;
  dueDate?: string;
  reviewDate?: string;
  status: 'open' | 'controlled' | 'closed';
  notes?: string;
  createdAt: string;
}

const HAZARD_TYPES = [
  'Physical', 'Chemical', 'Biological', 'Ergonomic', 'Psychosocial',
  'Electrical', 'Mechanical', 'Thermal', 'Radiation', 'Fall', 'Other',
];

const HIERARCHY: Record<string, { label: string; color: string; rank: number }> = {
  elimination:    { label: 'Elimination',    color: 'bg-green-100 text-green-700',   rank: 1 },
  substitution:   { label: 'Substitution',   color: 'bg-emerald-100 text-emerald-700', rank: 2 },
  engineering:    { label: 'Engineering Controls', color: 'bg-blue-100 text-blue-700', rank: 3 },
  administrative: { label: 'Administrative', color: 'bg-amber-100 text-amber-700',   rank: 4 },
  ppe:            { label: 'PPE',            color: 'bg-red-100 text-red-700',        rank: 5 },
};

const CONTROL_STATUS_CFG: Record<string, { label: string; cls: string }> = {
  implemented:  { label: 'Implemented',  cls: 'bg-green-100 text-green-700' },
  in_progress:  { label: 'In Progress',  cls: 'bg-blue-100 text-blue-700'   },
  planned:      { label: 'Planned',      cls: 'bg-amber-100 text-amber-700' },
  not_started:  { label: 'Not Started',  cls: 'bg-gray-100 text-gray-500'   },
};

const RISK_COLORS = (score: number) => {
  if (score >= 15) return 'bg-red-500 text-white';
  if (score >= 9)  return 'bg-orange-400 text-white';
  if (score >= 5)  return 'bg-amber-300 text-gray-800';
  return 'bg-green-200 text-green-800';
};

const RISK_LABEL = (score: number) => {
  if (score >= 15) return 'Critical';
  if (score >= 9)  return 'High';
  if (score >= 5)  return 'Medium';
  return 'Low';
};

const EMPTY: any = {
  title: '', location: '', activity: '', hazardType: 'Physical',
  description: '', likelihoodBefore: 3, consequenceBefore: 3,
  likelihoodAfter: 2, consequenceAfter: 2,
  hierarchyLevel: 'engineering', controlMeasure: '',
  controlStatus: 'not_started', responsible: '',
  dueDate: '', reviewDate: '', status: 'open', notes: '',
};

export default function HazardRegisterPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Hazard | null>(null);
  const [form, setForm] = useState({ ...EMPTY });
  const [filter, setFilter] = useState<string>('all');

  const { data: hazards = [], isLoading } = useQuery<Hazard[]>({
    queryKey: ['hazards'],
    queryFn: () => apiClient.get('/iso45001/hazards').then(r => r.data?.data ?? r.data ?? []),
  });

  const saveMutation = useMutation({
    mutationFn: (dto: any) => editing
      ? apiClient.put(`/iso45001/hazards/${editing.id}`, dto).then(r => r.data)
      : apiClient.post('/iso45001/hazards', dto).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hazards'] });
      setShowForm(false); setEditing(null); setForm({ ...EMPTY });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/iso45001/hazards/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hazards'] }),
  });

  function openEdit(h: Hazard) {
    setEditing(h);
    setForm({
      title: h.title, location: h.location, activity: h.activity,
      hazardType: h.hazardType, description: h.description,
      likelihoodBefore: h.likelihoodBefore, consequenceBefore: h.consequenceBefore,
      likelihoodAfter: h.likelihoodAfter, consequenceAfter: h.consequenceAfter,
      hierarchyLevel: h.hierarchyLevel, controlMeasure: h.controlMeasure,
      controlStatus: h.controlStatus, responsible: h.responsible,
      dueDate: h.dueDate?.split('T')[0] ?? '',
      reviewDate: h.reviewDate?.split('T')[0] ?? '',
      status: h.status, notes: h.notes ?? '',
    });
    setShowForm(true);
  }

  const high       = hazards.filter(h => h.likelihoodAfter * h.consequenceAfter >= 9).length;
  const controlled = hazards.filter(h => h.controlStatus === 'implemented').length;
  const overdue    = hazards.filter(h => h.dueDate && new Date(h.dueDate) < new Date() && h.controlStatus !== 'implemented').length;

  const filtered = filter === 'all' ? hazards :
    filter === 'high' ? hazards.filter(h => h.likelihoodAfter * h.consequenceAfter >= 9) :
    hazards.filter(h => h.status === filter || h.hazardType === filter);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <div className="w-11 h-11 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
            <AlertTriangle className="h-5 w-5 text-amber-700" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Hazard & Risk Register</h1>
            <p className="text-sm text-gray-500 mt-0.5">ISO 45001 Clause 6.1.2 — Hazard identification and risk assessment</p>
          </div>
        </div>
        <button onClick={() => { setEditing(null); setForm({ ...EMPTY }); setShowForm(true); }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-600 text-white text-sm font-medium hover:bg-amber-700 transition-colors">
          <Plus className="h-4 w-4" /> Add Hazard
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total Hazards',    value: hazards.length, color: 'text-gray-900', bg: 'bg-gray-50'   },
          { label: 'High / Critical',  value: high,           color: 'text-red-600',   bg: 'bg-red-50'    },
          { label: 'Controls in Place',value: controlled,     color: 'text-green-600', bg: 'bg-green-50'  },
          { label: 'Actions Overdue',  value: overdue,        color: 'text-amber-600', bg: 'bg-amber-50'  },
        ].map(({ label, value, color, bg }) => (
          <div key={label} className={cn('rounded-xl p-4 border border-gray-100', bg)}>
            <p className={cn('text-2xl font-bold', color)}>{value}</p>
            <p className="text-sm text-gray-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2 flex-wrap">
        {[{ key: 'all', label: 'All' }, { key: 'high', label: 'High Risk' }, { key: 'open', label: 'Open' }, { key: 'controlled', label: 'Controlled' }].map(({ key, label }) => (
          <button key={key} onClick={() => setFilter(key)}
            className={cn('px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
              filter === key ? 'bg-amber-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}>
            {label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Loading hazards…</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <Shield className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No hazards recorded</p>
            <p className="text-gray-400 text-sm mt-1">Identify and assess workplace hazards to manage risk</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  {['Hazard', 'Type', 'Risk Before', 'Control', 'Risk After', 'Due', 'Status', ''].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(h => {
                  const beforeScore = h.likelihoodBefore * h.consequenceBefore;
                  const afterScore  = h.likelihoodAfter  * h.consequenceAfter;
                  const ctrlCfg     = CONTROL_STATUS_CFG[h.controlStatus];
                  const hierCfg     = HIERARCHY[h.hierarchyLevel];
                  return (
                    <tr key={h.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{h.title}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{h.location}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{h.hazardType}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn('text-xs font-bold px-2 py-1 rounded', RISK_COLORS(beforeScore))}>
                          {RISK_LABEL(beforeScore)} ({beforeScore})
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', hierCfg.color)}>{hierCfg.label}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn('text-xs font-bold px-2 py-1 rounded', RISK_COLORS(afterScore))}>
                          {RISK_LABEL(afterScore)} ({afterScore})
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {h.dueDate ? (
                          <span className={cn('text-xs', new Date(h.dueDate) < new Date() && h.controlStatus !== 'implemented' ? 'text-red-600 font-semibold' : 'text-gray-500')}>
                            {new Date(h.dueDate).toLocaleDateString()}
                          </span>
                        ) : <span className="text-xs text-gray-400">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', ctrlCfg.cls)}>{ctrlCfg.label}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button onClick={() => openEdit(h)} className="text-xs text-blue-600 hover:text-blue-800">Edit</button>
                          <button onClick={() => deleteMutation.mutate(h.id)} className="text-xs text-red-500 hover:text-red-700">Delete</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-100 sticky top-0 bg-white z-10">
              <h2 className="font-bold text-gray-900">{editing ? 'Edit Hazard' : 'Add Hazard'}</h2>
              <button onClick={() => setShowForm(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <form onSubmit={e => { e.preventDefault(); saveMutation.mutate(form); }} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Hazard Title *</label>
                <input required value={form.title} onChange={e => setForm((f: any) => ({ ...f, title: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                  placeholder="e.g., Working at height — roof maintenance" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Hazard Type</label>
                  <select value={form.hazardType} onChange={e => setForm((f: any) => ({ ...f, hazardType: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400">
                    {HAZARD_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Location</label>
                  <input value={form.location} onChange={e => setForm((f: any) => ({ ...f, location: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                    placeholder="e.g., Building A, Warehouse" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Activity</label>
                  <input value={form.activity} onChange={e => setForm((f: any) => ({ ...f, activity: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                    placeholder="e.g., Maintenance" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Description</label>
                <textarea rows={2} value={form.description} onChange={e => setForm((f: any) => ({ ...f, description: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
                  placeholder="Describe the hazard and potential harm" />
              </div>

              {/* Risk matrix before */}
              <div>
                <p className="text-xs font-semibold text-gray-600 mb-2">INHERENT RISK (Before Controls)</p>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { key: 'likelihoodBefore', label: 'Likelihood (1–5)' },
                    { key: 'consequenceBefore', label: 'Consequence (1–5)' },
                  ].map(({ key, label }) => (
                    <div key={key}>
                      <label className="block text-xs text-gray-500 mb-1">{label}</label>
                      <input type="number" min={1} max={5} value={(form as any)[key]}
                        onChange={e => setForm((f: any) => ({ ...f, [key]: parseInt(e.target.value) || 1 }))}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
                    </div>
                  ))}
                </div>
                <div className="mt-2">
                  <span className={cn('text-xs font-bold px-2 py-1 rounded', RISK_COLORS(form.likelihoodBefore * form.consequenceBefore))}>
                    Risk Score: {form.likelihoodBefore * form.consequenceBefore} — {RISK_LABEL(form.likelihoodBefore * form.consequenceBefore)}
                  </span>
                </div>
              </div>

              {/* Control */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Hierarchy of Controls Level</label>
                  <select value={form.hierarchyLevel} onChange={e => setForm((f: any) => ({ ...f, hierarchyLevel: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400">
                    {Object.entries(HIERARCHY).sort((a, b) => a[1].rank - b[1].rank).map(([k, v]) => (
                      <option key={k} value={k}>{v.rank}. {v.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Control Status</label>
                  <select value={form.controlStatus} onChange={e => setForm((f: any) => ({ ...f, controlStatus: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400">
                    {Object.entries(CONTROL_STATUS_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Control Measure Description</label>
                <input value={form.controlMeasure} onChange={e => setForm((f: any) => ({ ...f, controlMeasure: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                  placeholder="e.g., Install guardrails + harness system" />
              </div>

              {/* Residual risk */}
              <div>
                <p className="text-xs font-semibold text-gray-600 mb-2">RESIDUAL RISK (After Controls)</p>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { key: 'likelihoodAfter', label: 'Likelihood (1–5)' },
                    { key: 'consequenceAfter', label: 'Consequence (1–5)' },
                  ].map(({ key, label }) => (
                    <div key={key}>
                      <label className="block text-xs text-gray-500 mb-1">{label}</label>
                      <input type="number" min={1} max={5} value={(form as any)[key]}
                        onChange={e => setForm((f: any) => ({ ...f, [key]: parseInt(e.target.value) || 1 }))}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
                    </div>
                  ))}
                </div>
                <div className="mt-2">
                  <span className={cn('text-xs font-bold px-2 py-1 rounded', RISK_COLORS(form.likelihoodAfter * form.consequenceAfter))}>
                    Residual Score: {form.likelihoodAfter * form.consequenceAfter} — {RISK_LABEL(form.likelihoodAfter * form.consequenceAfter)}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Responsible</label>
                  <input value={form.responsible} onChange={e => setForm((f: any) => ({ ...f, responsible: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                    placeholder="e.g., Safety Officer" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Due Date</label>
                  <input type="date" value={form.dueDate} onChange={e => setForm((f: any) => ({ ...f, dueDate: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Review Date</label>
                  <input type="date" value={form.reviewDate} onChange={e => setForm((f: any) => ({ ...f, reviewDate: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowForm(false)}
                  className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={saveMutation.isPending}
                  className="px-4 py-2 text-sm bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50">
                  {saveMutation.isPending ? 'Saving…' : editing ? 'Save Changes' : 'Add Hazard'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
