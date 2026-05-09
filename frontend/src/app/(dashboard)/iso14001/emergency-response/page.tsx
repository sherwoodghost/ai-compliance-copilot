'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Siren, Plus, CheckCircle2, AlertTriangle, Clock, X, FileText } from 'lucide-react';
import { apiClient } from '@/lib/api/client';
import { cn } from '@/lib/utils';

interface EmergencyPlan {
  id: string;
  title: string;
  scenario: string;
  potentialImpact: string;
  location: string;
  responseSteps: string[];
  responsible: string;
  contactNumbers: string;
  equipmentRequired: string;
  status: 'current' | 'under_review' | 'outdated';
  lastExerciseDate?: string;
  nextExerciseDate?: string;
  lastReviewDate?: string;
  nextReviewDate?: string;
  notes?: string;
  createdAt: string;
}

interface EmergencyDrill {
  id: string;
  planId: string;
  planTitle: string;
  drillDate: string;
  type: 'tabletop' | 'partial' | 'full';
  participants: number;
  outcome: 'pass' | 'partial' | 'fail';
  findings: string;
  correctiveActions: string;
  conductedBy: string;
}

const SCENARIOS = [
  'Chemical Spill', 'Fire', 'Fuel Leak', 'Hazardous Waste Release',
  'Air Emission Release', 'Wastewater Discharge', 'Natural Disaster', 'Other',
];

const STATUS_CFG: Record<string, { label: string; bg: string; text: string; icon: React.ElementType }> = {
  current:      { label: 'Current',       bg: 'bg-green-100', text: 'text-green-700', icon: CheckCircle2  },
  under_review: { label: 'Under Review',  bg: 'bg-amber-100', text: 'text-amber-700', icon: Clock         },
  outdated:     { label: 'Outdated',      bg: 'bg-red-100',   text: 'text-red-700',   icon: AlertTriangle },
};

const DRILL_OUTCOME_CFG: Record<string, { label: string; cls: string }> = {
  pass:    { label: 'Pass',    cls: 'bg-green-100 text-green-700' },
  partial: { label: 'Partial', cls: 'bg-amber-100 text-amber-700' },
  fail:    { label: 'Fail',    cls: 'bg-red-100 text-red-700' },
};

const EMPTY_PLAN = {
  title: '', scenario: 'Chemical Spill', potentialImpact: '', location: '',
  responseSteps: [''], responsible: '', contactNumbers: '',
  equipmentRequired: '', status: 'current' as EmergencyPlan['status'],
  lastExerciseDate: '', nextExerciseDate: '', lastReviewDate: '', nextReviewDate: '', notes: '',
};

const EMPTY_DRILL = {
  planId: '', drillDate: '', type: 'tabletop' as EmergencyDrill['type'],
  participants: 0, outcome: 'pass' as EmergencyDrill['outcome'],
  findings: '', correctiveActions: '', conductedBy: '',
};

export default function EmergencyResponsePage() {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<'plans' | 'drills'>('plans');
  const [showPlanForm, setShowPlanForm] = useState(false);
  const [showDrillForm, setShowDrillForm] = useState(false);
  const [editingPlan, setEditingPlan] = useState<EmergencyPlan | null>(null);
  const [planForm, setPlanForm] = useState({ ...EMPTY_PLAN });
  const [drillForm, setDrillForm] = useState({ ...EMPTY_DRILL });

  const { data: plans = [], isLoading: plansLoading } = useQuery<EmergencyPlan[]>({
    queryKey: ['emergency-plans'],
    queryFn: () => apiClient.get('/iso14001/emergency-response').then(r => r.data?.data ?? r.data ?? []),
  });

  const { data: drills = [], isLoading: drillsLoading } = useQuery<EmergencyDrill[]>({
    queryKey: ['emergency-drills'],
    queryFn: () => apiClient.get('/iso14001/emergency-response/drills').then(r => r.data?.data ?? r.data ?? []),
  });

  const savePlanMutation = useMutation({
    mutationFn: (dto: any) => editingPlan
      ? apiClient.put(`/iso14001/emergency-response/${editingPlan.id}`, dto).then(r => r.data)
      : apiClient.post('/iso14001/emergency-response', dto).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['emergency-plans'] });
      setShowPlanForm(false); setEditingPlan(null); setPlanForm({ ...EMPTY_PLAN });
    },
  });

  const deletePlanMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/iso14001/emergency-response/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['emergency-plans'] }),
  });

  const saveDrillMutation = useMutation({
    mutationFn: (dto: any) => apiClient.post('/iso14001/emergency-response/drills', dto).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['emergency-drills'] });
      setShowDrillForm(false); setDrillForm({ ...EMPTY_DRILL });
    },
  });

  function openEditPlan(p: EmergencyPlan) {
    setEditingPlan(p);
    setPlanForm({
      title: p.title, scenario: p.scenario, potentialImpact: p.potentialImpact,
      location: p.location, responseSteps: p.responseSteps.length ? p.responseSteps : [''],
      responsible: p.responsible, contactNumbers: p.contactNumbers,
      equipmentRequired: p.equipmentRequired, status: p.status,
      lastExerciseDate: p.lastExerciseDate?.split('T')[0] ?? '',
      nextExerciseDate: p.nextExerciseDate?.split('T')[0] ?? '',
      lastReviewDate: p.lastReviewDate?.split('T')[0] ?? '',
      nextReviewDate: p.nextReviewDate?.split('T')[0] ?? '',
      notes: p.notes ?? '',
    });
    setShowPlanForm(true);
  }

  function addStep() { setPlanForm(f => ({ ...f, responseSteps: [...f.responseSteps, ''] })); }
  function updateStep(idx: number, val: string) {
    setPlanForm(f => ({ ...f, responseSteps: f.responseSteps.map((s, i) => i === idx ? val : s) }));
  }
  function removeStep(idx: number) {
    setPlanForm(f => ({ ...f, responseSteps: f.responseSteps.filter((_, i) => i !== idx) }));
  }

  const current  = plans.filter(p => p.status === 'current').length;
  const outdated = plans.filter(p => p.status === 'outdated').length;
  const dueReview = plans.filter(p => p.nextReviewDate && new Date(p.nextReviewDate) < new Date()).length;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <div className="w-11 h-11 rounded-xl bg-red-100 flex items-center justify-center shrink-0">
            <Siren className="h-5 w-5 text-red-700" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Emergency Response Plans</h1>
            <p className="text-sm text-gray-500 mt-0.5">ISO 14001 Clause 8.2 — Emergency preparedness and response</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {activeTab === 'plans' ? (
            <button onClick={() => { setEditingPlan(null); setPlanForm({ ...EMPTY_PLAN }); setShowPlanForm(true); }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors">
              <Plus className="h-4 w-4" /> Add Plan
            </button>
          ) : (
            <button onClick={() => { setDrillForm({ ...EMPTY_DRILL }); setShowDrillForm(true); }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors">
              <Plus className="h-4 w-4" /> Log Drill
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total Plans',   value: plans.length, color: 'text-gray-900', bg: 'bg-gray-50' },
          { label: 'Current',       value: current,      color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Outdated',      value: outdated,     color: 'text-red-600',   bg: 'bg-red-50' },
          { label: 'Review Overdue',value: dueReview,    color: 'text-amber-600', bg: 'bg-amber-50' },
        ].map(({ label, value, color, bg }) => (
          <div key={label} className={cn('rounded-xl p-4 border border-gray-100', bg)}>
            <p className={cn('text-2xl font-bold', color)}>{value}</p>
            <p className="text-sm text-gray-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-gray-200">
        {(['plans', 'drills'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={cn('px-4 py-2.5 text-sm font-medium capitalize border-b-2 transition-colors',
              activeTab === tab ? 'border-red-500 text-red-600' : 'border-transparent text-gray-500 hover:text-gray-700')}>
            {tab === 'plans' ? 'Response Plans' : 'Drill Records'}
          </button>
        ))}
      </div>

      {activeTab === 'plans' && (
        <div className="space-y-3">
          {plansLoading ? (
            <div className="p-8 text-center text-gray-400">Loading plans…</div>
          ) : plans.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-12 text-center">
              <Siren className="w-10 h-10 text-gray-200 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">No emergency response plans</p>
              <p className="text-gray-400 text-sm mt-1">Add plans for scenarios with significant environmental impact</p>
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
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{plan.scenario}</span>
                      {plan.location && <span className="text-xs text-gray-400">📍 {plan.location}</span>}
                    </div>
                    <h3 className="font-semibold text-gray-900">{plan.title}</h3>
                    {plan.potentialImpact && (
                      <p className="text-sm text-gray-500 mt-1">{plan.potentialImpact}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => openEditPlan(plan)} className="text-xs text-blue-600 hover:text-blue-800">Edit</button>
                    <button onClick={() => deletePlanMutation.mutate(plan.id)} className="text-xs text-red-500 hover:text-red-700">Delete</button>
                  </div>
                </div>

                {plan.responseSteps.length > 0 && (
                  <div className="mt-4 bg-gray-50 rounded-lg p-3">
                    <p className="text-xs font-semibold text-gray-500 mb-2">RESPONSE STEPS</p>
                    <ol className="space-y-1">
                      {plan.responseSteps.filter(Boolean).map((step, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                          <span className="w-5 h-5 rounded-full bg-red-100 text-red-600 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                            {i + 1}
                          </span>
                          {step}
                        </li>
                      ))}
                    </ol>
                  </div>
                )}

                <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-50 text-xs text-gray-400 flex-wrap">
                  {plan.responsible && <span>Responsible: {plan.responsible}</span>}
                  {plan.lastExerciseDate && <span>Last drill: {new Date(plan.lastExerciseDate).toLocaleDateString()}</span>}
                  {plan.nextExerciseDate && <span>Next drill: {new Date(plan.nextExerciseDate).toLocaleDateString()}</span>}
                  {plan.nextReviewDate && (
                    <span className={new Date(plan.nextReviewDate) < new Date() ? 'text-red-500 font-semibold' : ''}>
                      Review due: {new Date(plan.nextReviewDate).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {activeTab === 'drills' && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          {drillsLoading ? (
            <div className="p-8 text-center text-gray-400">Loading drills…</div>
          ) : drills.length === 0 ? (
            <div className="p-12 text-center">
              <FileText className="w-10 h-10 text-gray-200 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">No drill records</p>
              <p className="text-gray-400 text-sm mt-1">Log emergency response exercises and their outcomes</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    {['Plan', 'Date', 'Type', 'Participants', 'Outcome', 'Findings', 'Conducted By'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {drills.map(drill => {
                    const outcomeConf = DRILL_OUTCOME_CFG[drill.outcome];
                    return (
                      <tr key={drill.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 font-medium text-gray-900">{drill.planTitle}</td>
                        <td className="px-4 py-3 text-gray-600">{new Date(drill.drillDate).toLocaleDateString()}</td>
                        <td className="px-4 py-3">
                          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full capitalize">
                            {drill.type.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-600 text-center">{drill.participants}</td>
                        <td className="px-4 py-3">
                          <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', outcomeConf.cls)}>{outcomeConf.label}</span>
                        </td>
                        <td className="px-4 py-3 text-gray-500 max-w-[200px] truncate text-xs">{drill.findings}</td>
                        <td className="px-4 py-3 text-gray-600 text-xs">{drill.conductedBy}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Plan Form Modal */}
      {showPlanForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-100 sticky top-0 bg-white z-10">
              <h2 className="font-bold text-gray-900">{editingPlan ? 'Edit Plan' : 'Add Emergency Response Plan'}</h2>
              <button onClick={() => setShowPlanForm(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <form onSubmit={e => { e.preventDefault(); savePlanMutation.mutate({ ...planForm, responseSteps: planForm.responseSteps.filter(Boolean) }); }} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Plan Title *</label>
                <input required value={planForm.title} onChange={e => setPlanForm(f => ({ ...f, title: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
                  placeholder="e.g., Chemical Spill Response — Site A" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Scenario</label>
                  <select value={planForm.scenario} onChange={e => setPlanForm(f => ({ ...f, scenario: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-400">
                    {SCENARIOS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Location / Facility</label>
                  <input value={planForm.location} onChange={e => setPlanForm(f => ({ ...f, location: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
                    placeholder="e.g., Building 3, Warehouse" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Potential Environmental Impact</label>
                <textarea rows={2} value={planForm.potentialImpact} onChange={e => setPlanForm(f => ({ ...f, potentialImpact: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-400 resize-none"
                  placeholder="e.g., Soil contamination, waterway pollution" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Response Steps</label>
                <div className="space-y-2">
                  {planForm.responseSteps.map((step, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-red-100 text-red-600 text-xs font-bold flex items-center justify-center shrink-0">{idx + 1}</span>
                      <input value={step} onChange={e => updateStep(idx, e.target.value)}
                        className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
                        placeholder="Describe action step..." />
                      {planForm.responseSteps.length > 1 && (
                        <button type="button" onClick={() => removeStep(idx)} className="text-gray-300 hover:text-red-400">
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                  <button type="button" onClick={addStep}
                    className="text-xs text-red-600 hover:text-red-800 flex items-center gap-1">
                    <Plus className="w-3 h-3" /> Add step
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Responsible Person</label>
                  <input value={planForm.responsible} onChange={e => setPlanForm(f => ({ ...f, responsible: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
                    placeholder="e.g., Site EHS Officer" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Status</label>
                  <select value={planForm.status} onChange={e => setPlanForm(f => ({ ...f, status: e.target.value as any }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-400">
                    {Object.entries(STATUS_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Emergency Contact Numbers</label>
                <input value={planForm.contactNumbers} onChange={e => setPlanForm(f => ({ ...f, contactNumbers: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
                  placeholder="e.g., Fire: 000, Spill Team: +1-555-0100" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Equipment Required</label>
                <input value={planForm.equipmentRequired} onChange={e => setPlanForm(f => ({ ...f, equipmentRequired: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
                  placeholder="e.g., Spill kit, PPE, absorbent material" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Last Drill Date</label>
                  <input type="date" value={planForm.lastExerciseDate} onChange={e => setPlanForm(f => ({ ...f, lastExerciseDate: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-400" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Next Drill Date</label>
                  <input type="date" value={planForm.nextExerciseDate} onChange={e => setPlanForm(f => ({ ...f, nextExerciseDate: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-400" />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowPlanForm(false)}
                  className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={savePlanMutation.isPending}
                  className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50">
                  {savePlanMutation.isPending ? 'Saving…' : editingPlan ? 'Save Changes' : 'Add Plan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Drill Form Modal */}
      {showDrillForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h2 className="font-bold text-gray-900">Log Emergency Drill</h2>
              <button onClick={() => setShowDrillForm(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <form onSubmit={e => { e.preventDefault(); saveDrillMutation.mutate(drillForm); }} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Linked Plan</label>
                  <select value={drillForm.planId} onChange={e => setDrillForm(f => ({ ...f, planId: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-400">
                    <option value="">Select plan…</option>
                    {plans.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Drill Date *</label>
                  <input required type="date" value={drillForm.drillDate} onChange={e => setDrillForm(f => ({ ...f, drillDate: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-400" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Type</label>
                  <select value={drillForm.type} onChange={e => setDrillForm(f => ({ ...f, type: e.target.value as any }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-400">
                    <option value="tabletop">Tabletop</option>
                    <option value="partial">Partial</option>
                    <option value="full">Full</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Participants</label>
                  <input type="number" min={0} value={drillForm.participants} onChange={e => setDrillForm(f => ({ ...f, participants: parseInt(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-400" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Outcome</label>
                  <select value={drillForm.outcome} onChange={e => setDrillForm(f => ({ ...f, outcome: e.target.value as any }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-400">
                    <option value="pass">Pass</option>
                    <option value="partial">Partial</option>
                    <option value="fail">Fail</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Findings / Observations</label>
                <textarea rows={2} value={drillForm.findings} onChange={e => setDrillForm(f => ({ ...f, findings: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-400 resize-none"
                  placeholder="What was found during the drill?" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Corrective Actions</label>
                <textarea rows={2} value={drillForm.correctiveActions} onChange={e => setDrillForm(f => ({ ...f, correctiveActions: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-400 resize-none"
                  placeholder="Actions to improve response capability" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Conducted By</label>
                <input value={drillForm.conductedBy} onChange={e => setDrillForm(f => ({ ...f, conductedBy: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
                  placeholder="e.g., EHS Team" />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowDrillForm(false)}
                  className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={saveDrillMutation.isPending}
                  className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50">
                  {saveDrillMutation.isPending ? 'Saving…' : 'Log Drill'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
