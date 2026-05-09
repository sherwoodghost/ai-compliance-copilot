'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Siren, Plus, X, CheckCircle2, AlertTriangle, Clock } from 'lucide-react';
import { apiClient } from '@/lib/api/client';
import { cn } from '@/lib/utils';

interface OhsEmergencyPlan {
  id: string;
  title: string;
  scenario: string;
  affectedPersonnel: string;
  assemblyPoint: string;
  responseActions: string[];
  firstAidArrangements: string;
  evacuationProcedure: string;
  externalContacts: string;
  responsible: string;
  status: 'current' | 'under_review' | 'outdated';
  lastDrillDate?: string;
  nextDrillDate?: string;
  lastReviewDate?: string;
  nextReviewDate?: string;
  notes?: string;
  createdAt: string;
}

const OHS_SCENARIOS = [
  'Fire / Explosion', 'Medical Emergency', 'Structural Collapse',
  'Hazardous Material Release', 'Severe Weather', 'Active Threat / Security',
  'Utility Failure', 'Mass Casualty', 'Other',
];

const STATUS_CFG: Record<string, { label: string; bg: string; text: string; icon: React.ElementType }> = {
  current:      { label: 'Current',       bg: 'bg-green-100', text: 'text-green-700', icon: CheckCircle2  },
  under_review: { label: 'Under Review',  bg: 'bg-amber-100', text: 'text-amber-700', icon: Clock         },
  outdated:     { label: 'Outdated',      bg: 'bg-red-100',   text: 'text-red-700',   icon: AlertTriangle },
};

const EMPTY: any = {
  title: '', scenario: 'Fire / Explosion', affectedPersonnel: '',
  assemblyPoint: '', responseActions: [''], firstAidArrangements: '',
  evacuationProcedure: '', externalContacts: '', responsible: '',
  status: 'current', lastDrillDate: '', nextDrillDate: '',
  lastReviewDate: '', nextReviewDate: '', notes: '',
};

export default function OhsEmergencyPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<OhsEmergencyPlan | null>(null);
  const [form, setForm] = useState({ ...EMPTY });

  const { data: plans = [], isLoading } = useQuery<OhsEmergencyPlan[]>({
    queryKey: ['ohs-emergency-plans'],
    queryFn: () => apiClient.get('/iso45001/emergency').then(r => r.data?.data ?? r.data ?? []),
  });

  const saveMutation = useMutation({
    mutationFn: (dto: any) => editing
      ? apiClient.put(`/iso45001/emergency/${editing.id}`, dto).then(r => r.data)
      : apiClient.post('/iso45001/emergency', dto).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ohs-emergency-plans'] });
      setShowForm(false); setEditing(null); setForm({ ...EMPTY });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/iso45001/emergency/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ohs-emergency-plans'] }),
  });

  function openEdit(p: OhsEmergencyPlan) {
    setEditing(p);
    setForm({
      title: p.title, scenario: p.scenario, affectedPersonnel: p.affectedPersonnel,
      assemblyPoint: p.assemblyPoint,
      responseActions: p.responseActions.length ? p.responseActions : [''],
      firstAidArrangements: p.firstAidArrangements, evacuationProcedure: p.evacuationProcedure,
      externalContacts: p.externalContacts, responsible: p.responsible,
      status: p.status, lastDrillDate: p.lastDrillDate?.split('T')[0] ?? '',
      nextDrillDate: p.nextDrillDate?.split('T')[0] ?? '',
      lastReviewDate: p.lastReviewDate?.split('T')[0] ?? '',
      nextReviewDate: p.nextReviewDate?.split('T')[0] ?? '',
      notes: p.notes ?? '',
    });
    setShowForm(true);
  }

  function addStep() { setForm((f: any) => ({ ...f, responseActions: [...f.responseActions, ''] })); }
  function updateStep(idx: number, val: string) {
    setForm((f: any) => ({ ...f, responseActions: f.responseActions.map((s: string, i: number) => i === idx ? val : s) }));
  }
  function removeStep(idx: number) {
    setForm((f: any) => ({ ...f, responseActions: f.responseActions.filter((_: any, i: number) => i !== idx) }));
  }

  const current  = plans.filter(p => p.status === 'current').length;
  const outdated = plans.filter(p => p.status === 'outdated').length;
  const overdueReview = plans.filter(p => p.nextReviewDate && new Date(p.nextReviewDate) < new Date()).length;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <div className="w-11 h-11 rounded-xl bg-red-100 flex items-center justify-center shrink-0">
            <Siren className="h-5 w-5 text-red-700" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">OH&S Emergency Plans</h1>
            <p className="text-sm text-gray-500 mt-0.5">ISO 45001 Clause 8.2 — Emergency preparedness and response</p>
          </div>
        </div>
        <button onClick={() => { setEditing(null); setForm({ ...EMPTY }); setShowForm(true); }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors">
          <Plus className="h-4 w-4" /> Add Plan
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total Plans',    value: plans.length, color: 'text-gray-900', bg: 'bg-gray-50' },
          { label: 'Current',        value: current,      color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Outdated',       value: outdated,     color: 'text-red-600',   bg: 'bg-red-50' },
          { label: 'Review Overdue', value: overdueReview, color: 'text-amber-600', bg: 'bg-amber-50' },
        ].map(({ label, value, color, bg }) => (
          <div key={label} className={cn('rounded-xl p-4 border border-gray-100', bg)}>
            <p className={cn('text-2xl font-bold', color)}>{value}</p>
            <p className="text-sm text-gray-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Plans */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Loading plans…</div>
        ) : plans.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-12 text-center">
            <Siren className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No emergency plans defined</p>
            <p className="text-gray-400 text-sm mt-1">Create response plans for all identified emergency scenarios</p>
          </div>
        ) : plans.map(plan => {
          const cfg = STATUS_CFG[plan.status];
          const StatusIcon = cfg.icon;
          return (
            <div key={plan.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className={cn('inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full', cfg.bg, cfg.text)}>
                      <StatusIcon className="w-3 h-3" />{cfg.label}
                    </span>
                    <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">{plan.scenario}</span>
                    {plan.assemblyPoint && <span className="text-xs text-gray-400">📍 {plan.assemblyPoint}</span>}
                  </div>
                  <h3 className="font-semibold text-gray-900">{plan.title}</h3>
                  {plan.affectedPersonnel && (
                    <p className="text-sm text-gray-500 mt-0.5">Affected: {plan.affectedPersonnel}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => openEdit(plan)} className="text-xs text-blue-600 hover:text-blue-800">Edit</button>
                  <button onClick={() => deleteMutation.mutate(plan.id)} className="text-xs text-red-500 hover:text-red-700">Delete</button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
                {plan.evacuationProcedure && (
                  <div className="bg-amber-50 rounded-lg p-3">
                    <p className="text-xs font-semibold text-amber-700 mb-1">EVACUATION PROCEDURE</p>
                    <p className="text-sm text-gray-700">{plan.evacuationProcedure}</p>
                  </div>
                )}
                {plan.firstAidArrangements && (
                  <div className="bg-red-50 rounded-lg p-3">
                    <p className="text-xs font-semibold text-red-700 mb-1">FIRST AID ARRANGEMENTS</p>
                    <p className="text-sm text-gray-700">{plan.firstAidArrangements}</p>
                  </div>
                )}
              </div>

              {plan.responseActions.filter(Boolean).length > 0 && (
                <div className="mt-3 bg-gray-50 rounded-lg p-3">
                  <p className="text-xs font-semibold text-gray-500 mb-2">RESPONSE STEPS</p>
                  <ol className="space-y-1">
                    {plan.responseActions.filter(Boolean).map((step, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                        <span className="w-5 h-5 rounded-full bg-red-100 text-red-600 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                        {step}
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-50 text-xs text-gray-400 flex-wrap">
                {plan.responsible && <span>Lead: {plan.responsible}</span>}
                {plan.externalContacts && <span>External: {plan.externalContacts}</span>}
                {plan.lastDrillDate && <span>Last drill: {new Date(plan.lastDrillDate).toLocaleDateString()}</span>}
                {plan.nextDrillDate && <span>Next drill: {new Date(plan.nextDrillDate).toLocaleDateString()}</span>}
                {plan.nextReviewDate && (
                  <span className={new Date(plan.nextReviewDate) < new Date() ? 'text-red-500 font-semibold' : ''}>
                    Review: {new Date(plan.nextReviewDate).toLocaleDateString()}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-100 sticky top-0 bg-white z-10">
              <h2 className="font-bold text-gray-900">{editing ? 'Edit Plan' : 'Add Emergency Plan'}</h2>
              <button onClick={() => setShowForm(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <form onSubmit={e => {
              e.preventDefault();
              saveMutation.mutate({ ...form, responseActions: form.responseActions.filter(Boolean) });
            }} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Plan Title *</label>
                <input required value={form.title} onChange={e => setForm((f: any) => ({ ...f, title: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
                  placeholder="e.g., Fire Emergency Response — All Sites" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Scenario</label>
                  <select value={form.scenario} onChange={e => setForm((f: any) => ({ ...f, scenario: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-400">
                    {OHS_SCENARIOS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Assembly Point</label>
                  <input value={form.assemblyPoint} onChange={e => setForm((f: any) => ({ ...f, assemblyPoint: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
                    placeholder="e.g., Car park north, Gate 3" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Affected Personnel</label>
                <input value={form.affectedPersonnel} onChange={e => setForm((f: any) => ({ ...f, affectedPersonnel: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
                  placeholder="e.g., All staff, Visitors, Contractors" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Response Steps</label>
                <div className="space-y-2">
                  {form.responseActions.map((step: string, idx: number) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-red-100 text-red-600 text-xs font-bold flex items-center justify-center shrink-0">{idx + 1}</span>
                      <input value={step} onChange={e => updateStep(idx, e.target.value)}
                        className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
                        placeholder="Describe action step..." />
                      {form.responseActions.length > 1 && (
                        <button type="button" onClick={() => removeStep(idx)} className="text-gray-300 hover:text-red-400">
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                  <button type="button" onClick={addStep} className="text-xs text-red-600 hover:text-red-800 flex items-center gap-1">
                    <Plus className="w-3 h-3" /> Add step
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Evacuation Procedure</label>
                <textarea rows={2} value={form.evacuationProcedure} onChange={e => setForm((f: any) => ({ ...f, evacuationProcedure: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-400 resize-none" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">First Aid Arrangements</label>
                <input value={form.firstAidArrangements} onChange={e => setForm((f: any) => ({ ...f, firstAidArrangements: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
                  placeholder="e.g., First aiders: Jane (ext 201), AED at reception" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">External Emergency Contacts</label>
                <input value={form.externalContacts} onChange={e => setForm((f: any) => ({ ...f, externalContacts: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
                  placeholder="e.g., Fire: 000, Hospital: +1-555-0100, HSE Hotline" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Responsible Person</label>
                  <input value={form.responsible} onChange={e => setForm((f: any) => ({ ...f, responsible: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-400" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Status</label>
                  <select value={form.status} onChange={e => setForm((f: any) => ({ ...f, status: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-400">
                    {Object.entries(STATUS_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Last Drill Date</label>
                  <input type="date" value={form.lastDrillDate} onChange={e => setForm((f: any) => ({ ...f, lastDrillDate: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-400" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Next Drill Date</label>
                  <input type="date" value={form.nextDrillDate} onChange={e => setForm((f: any) => ({ ...f, nextDrillDate: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-400" />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowForm(false)}
                  className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={saveMutation.isPending}
                  className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50">
                  {saveMutation.isPending ? 'Saving…' : editing ? 'Save Changes' : 'Add Plan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
