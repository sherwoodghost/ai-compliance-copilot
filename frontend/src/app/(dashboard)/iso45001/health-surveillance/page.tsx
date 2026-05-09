'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Activity, Plus, X, CheckCircle2, AlertTriangle, Clock, UserCircle2 } from 'lucide-react';
import { apiClient } from '@/lib/api/client';
import { cn } from '@/lib/utils';

interface HealthSurveillanceRecord {
  id: string;
  workerName: string;
  employeeId?: string;
  jobRole: string;
  hazardExposure: string;
  surveillanceType: string;
  assessmentDate: string;
  nextAssessmentDate: string;
  conductedBy: string;
  outcome: 'fit' | 'fit_with_restrictions' | 'unfit' | 'referred' | 'pending';
  restrictions?: string;
  referralDetails?: string;
  followUpRequired: boolean;
  followUpDate?: string;
  notes?: string;
  createdAt: string;
}

interface HealthProgram {
  id: string;
  title: string;
  hazardType: string;
  surveillanceType: string;
  frequency: string;
  roles: string[];
  nextBulkDate?: string;
  active: boolean;
}

const SURVEILLANCE_TYPES = [
  'Pre-employment Medical', 'Periodic Medical', 'Audiometry (Hearing)',
  'Lung Function (Spirometry)', 'Skin Assessment', 'Vision Test',
  'Blood Lead Test', 'Respiratory Assessment', 'Musculoskeletal Assessment',
  'Psychological Screening', 'Drug & Alcohol Test', 'Other',
];

const OUTCOME_CFG: Record<string, { label: string; bg: string; text: string; icon: React.ElementType }> = {
  fit:                  { label: 'Fit',                  bg: 'bg-green-100',  text: 'text-green-700',  icon: CheckCircle2  },
  fit_with_restrictions:{ label: 'Fit with Restrictions',bg: 'bg-amber-100',  text: 'text-amber-700',  icon: AlertTriangle },
  unfit:                { label: 'Unfit',                bg: 'bg-red-100',    text: 'text-red-700',    icon: AlertTriangle },
  referred:             { label: 'Referred',             bg: 'bg-blue-100',   text: 'text-blue-700',   icon: UserCircle2   },
  pending:              { label: 'Pending',              bg: 'bg-gray-100',   text: 'text-gray-500',   icon: Clock         },
};

const EMPTY: any = {
  workerName: '', employeeId: '', jobRole: '', hazardExposure: '',
  surveillanceType: 'Periodic Medical', assessmentDate: '',
  nextAssessmentDate: '', conductedBy: '',
  outcome: 'pending', restrictions: '', referralDetails: '',
  followUpRequired: false, followUpDate: '', notes: '',
};

export default function HealthSurveillancePage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<HealthSurveillanceRecord | null>(null);
  const [form, setForm] = useState({ ...EMPTY });
  const [activeTab, setActiveTab] = useState<'records' | 'programs'>('records');
  const [search, setSearch] = useState('');

  const { data: records = [], isLoading } = useQuery<HealthSurveillanceRecord[]>({
    queryKey: ['health-surveillance'],
    queryFn: () => apiClient.get('/iso45001/health-surveillance').then(r => r.data?.data ?? r.data ?? []),
  });

  const { data: programs = [] } = useQuery<HealthProgram[]>({
    queryKey: ['health-programs'],
    queryFn: () => apiClient.get('/iso45001/health-surveillance/programs').then(r => r.data?.data ?? r.data ?? []),
  });

  const saveMutation = useMutation({
    mutationFn: (dto: any) => editing
      ? apiClient.put(`/iso45001/health-surveillance/${editing.id}`, dto).then(r => r.data)
      : apiClient.post('/iso45001/health-surveillance', dto).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['health-surveillance'] });
      setShowForm(false); setEditing(null); setForm({ ...EMPTY });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/iso45001/health-surveillance/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['health-surveillance'] }),
  });

  function openEdit(r: HealthSurveillanceRecord) {
    setEditing(r);
    setForm({
      workerName: r.workerName, employeeId: r.employeeId ?? '',
      jobRole: r.jobRole, hazardExposure: r.hazardExposure,
      surveillanceType: r.surveillanceType,
      assessmentDate: r.assessmentDate?.split('T')[0] ?? '',
      nextAssessmentDate: r.nextAssessmentDate?.split('T')[0] ?? '',
      conductedBy: r.conductedBy, outcome: r.outcome,
      restrictions: r.restrictions ?? '', referralDetails: r.referralDetails ?? '',
      followUpRequired: r.followUpRequired, followUpDate: r.followUpDate?.split('T')[0] ?? '',
      notes: r.notes ?? '',
    });
    setShowForm(true);
  }

  const fit         = records.filter(r => r.outcome === 'fit').length;
  const restricted  = records.filter(r => r.outcome === 'fit_with_restrictions').length;
  const overdue     = records.filter(r => r.nextAssessmentDate && new Date(r.nextAssessmentDate) < new Date()).length;
  const followUp    = records.filter(r => r.followUpRequired && !r.followUpDate).length;

  const filtered = records.filter(r =>
    !search || r.workerName.toLowerCase().includes(search.toLowerCase()) ||
    r.jobRole.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <div className="w-11 h-11 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
            <Activity className="h-5 w-5 text-amber-700" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Health Surveillance</h1>
            <p className="text-sm text-gray-500 mt-0.5">ISO 45001 Clause 8.1.4 — Occupational health monitoring</p>
          </div>
        </div>
        {activeTab === 'records' && (
          <button onClick={() => { setEditing(null); setForm({ ...EMPTY }); setShowForm(true); }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-600 text-white text-sm font-medium hover:bg-amber-700 transition-colors">
            <Plus className="h-4 w-4" /> Add Record
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total Records',      value: records.length, color: 'text-gray-900',   bg: 'bg-gray-50'  },
          { label: 'Fit for Work',       value: fit,            color: 'text-green-600',  bg: 'bg-green-50' },
          { label: 'With Restrictions',  value: restricted,     color: 'text-amber-600',  bg: 'bg-amber-50' },
          { label: 'Assessments Overdue',value: overdue,        color: 'text-red-600',    bg: 'bg-red-50'   },
        ].map(({ label, value, color, bg }) => (
          <div key={label} className={cn('rounded-xl p-4 border border-gray-100', bg)}>
            <p className={cn('text-2xl font-bold', color)}>{value}</p>
            <p className="text-sm text-gray-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-gray-200">
        {(['records', 'programs'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={cn('px-4 py-2.5 text-sm font-medium capitalize border-b-2 transition-colors',
              activeTab === tab ? 'border-amber-500 text-amber-600' : 'border-transparent text-gray-500 hover:text-gray-700')}>
            {tab === 'records' ? 'Individual Records' : 'Surveillance Programs'}
          </button>
        ))}
      </div>

      {activeTab === 'records' && (
        <>
          {/* Search */}
          <input value={search} onChange={e => setSearch(e.target.value)}
            className="w-full md:w-80 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
            placeholder="Search by name or role…" />

          {/* Follow-up alert */}
          {followUp > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
              <p className="text-sm text-amber-800">
                <strong>{followUp} worker{followUp > 1 ? 's' : ''}</strong> {followUp > 1 ? 'have' : 'has'} pending follow-up actions that need to be scheduled.
              </p>
            </div>
          )}

          {/* Records table */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            {isLoading ? (
              <div className="p-8 text-center text-gray-400">Loading records…</div>
            ) : filtered.length === 0 ? (
              <div className="p-12 text-center">
                <Activity className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                <p className="text-gray-500 font-medium">No health surveillance records</p>
                <p className="text-gray-400 text-sm mt-1">Track medical assessments for workers exposed to occupational hazards</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      {['Worker', 'Assessment', 'Date', 'Next Due', 'Outcome', 'Follow-up', ''].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {filtered.map(rec => {
                      const outcomeConf = OUTCOME_CFG[rec.outcome];
                      const OutcomeIcon = outcomeConf.icon;
                      const isOverdue = rec.nextAssessmentDate && new Date(rec.nextAssessmentDate) < new Date();
                      return (
                        <tr key={rec.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3">
                            <p className="font-medium text-gray-900">{rec.workerName}</p>
                            <p className="text-xs text-gray-400">{rec.jobRole}</p>
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-xs text-gray-700">{rec.surveillanceType}</p>
                            {rec.hazardExposure && <p className="text-xs text-gray-400 mt-0.5">{rec.hazardExposure}</p>}
                          </td>
                          <td className="px-4 py-3 text-gray-600 text-xs">
                            {rec.assessmentDate ? new Date(rec.assessmentDate).toLocaleDateString() : '—'}
                          </td>
                          <td className="px-4 py-3">
                            <span className={cn('text-xs', isOverdue ? 'text-red-600 font-semibold' : 'text-gray-500')}>
                              {rec.nextAssessmentDate ? new Date(rec.nextAssessmentDate).toLocaleDateString() : '—'}
                              {isOverdue && ' ⚠'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={cn('inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full', outcomeConf.bg, outcomeConf.text)}>
                              <OutcomeIcon className="w-3 h-3" />{outcomeConf.label}
                            </span>
                            {rec.restrictions && (
                              <p className="text-xs text-amber-600 mt-0.5">{rec.restrictions}</p>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {rec.followUpRequired ? (
                              rec.followUpDate
                                ? <span className="text-xs text-gray-500">📅 {new Date(rec.followUpDate).toLocaleDateString()}</span>
                                : <span className="text-xs text-amber-600 font-semibold">⚠ Needed</span>
                            ) : (
                              <span className="text-xs text-gray-400">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <button onClick={() => openEdit(rec)} className="text-xs text-blue-600 hover:text-blue-800">Edit</button>
                              <button onClick={() => deleteMutation.mutate(rec.id)} className="text-xs text-red-500 hover:text-red-700">Delete</button>
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
        </>
      )}

      {activeTab === 'programs' && (
        <div className="space-y-3">
          {programs.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-12 text-center">
              <Activity className="w-10 h-10 text-gray-200 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">No surveillance programs defined</p>
              <p className="text-gray-400 text-sm mt-1">Define programs to systematically track health assessments by hazard type</p>
            </div>
          ) : programs.map(prog => (
            <div key={prog.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-gray-900">{prog.title}</h3>
                    <span className={cn('text-xs px-2 py-0.5 rounded-full', prog.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500')}>
                      {prog.active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-500 flex-wrap">
                    <span>Hazard: {prog.hazardType}</span>
                    <span>Assessment: {prog.surveillanceType}</span>
                    <span>Frequency: {prog.frequency}</span>
                    {prog.nextBulkDate && <span>Next batch: {new Date(prog.nextBulkDate).toLocaleDateString()}</span>}
                  </div>
                  {prog.roles.length > 0 && (
                    <div className="flex items-center gap-1 mt-2 flex-wrap">
                      {prog.roles.map(r => (
                        <span key={r} className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full">{r}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-100 sticky top-0 bg-white z-10">
              <h2 className="font-bold text-gray-900">{editing ? 'Edit Record' : 'Add Health Surveillance Record'}</h2>
              <button onClick={() => setShowForm(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <form onSubmit={e => { e.preventDefault(); saveMutation.mutate(form); }} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Worker Name *</label>
                  <input required value={form.workerName} onChange={e => setForm((f: any) => ({ ...f, workerName: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Employee ID</label>
                  <input value={form.employeeId} onChange={e => setForm((f: any) => ({ ...f, employeeId: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Job Role *</label>
                  <input required value={form.jobRole} onChange={e => setForm((f: any) => ({ ...f, jobRole: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                    placeholder="e.g., Welder, Lab Technician" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Hazard Exposure</label>
                  <input value={form.hazardExposure} onChange={e => setForm((f: any) => ({ ...f, hazardExposure: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                    placeholder="e.g., Noise, Fumes, Vibration" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Surveillance Type</label>
                <select value={form.surveillanceType} onChange={e => setForm((f: any) => ({ ...f, surveillanceType: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400">
                  {SURVEILLANCE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Assessment Date *</label>
                  <input required type="date" value={form.assessmentDate} onChange={e => setForm((f: any) => ({ ...f, assessmentDate: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Next Assessment Date</label>
                  <input type="date" value={form.nextAssessmentDate} onChange={e => setForm((f: any) => ({ ...f, nextAssessmentDate: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Conducted By</label>
                  <input value={form.conductedBy} onChange={e => setForm((f: any) => ({ ...f, conductedBy: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                    placeholder="e.g., Occupational Health Physician" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Outcome</label>
                  <select value={form.outcome} onChange={e => setForm((f: any) => ({ ...f, outcome: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400">
                    {Object.entries(OUTCOME_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
              </div>
              {form.outcome === 'fit_with_restrictions' && (
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Restrictions Detail</label>
                  <input value={form.restrictions} onChange={e => setForm((f: any) => ({ ...f, restrictions: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                    placeholder="e.g., No work above 2m, limited lifting to 10kg" />
                </div>
              )}
              {form.outcome === 'referred' && (
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Referral Details</label>
                  <input value={form.referralDetails} onChange={e => setForm((f: any) => ({ ...f, referralDetails: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
                </div>
              )}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="followUp" checked={form.followUpRequired}
                    onChange={e => setForm((f: any) => ({ ...f, followUpRequired: e.target.checked }))}
                    className="w-4 h-4 accent-amber-600" />
                  <label htmlFor="followUp" className="text-sm text-gray-700">Follow-up action required</label>
                </div>
                {form.followUpRequired && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Follow-up Date</label>
                    <input type="date" value={form.followUpDate} onChange={e => setForm((f: any) => ({ ...f, followUpDate: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
                  </div>
                )}
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Notes</label>
                <textarea rows={2} value={form.notes} onChange={e => setForm((f: any) => ({ ...f, notes: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none" />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowForm(false)}
                  className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={saveMutation.isPending}
                  className="px-4 py-2 text-sm bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50">
                  {saveMutation.isPending ? 'Saving…' : editing ? 'Save Changes' : 'Add Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
