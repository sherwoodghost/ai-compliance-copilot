'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { HardHat, Plus, X, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import { apiClient } from '@/lib/api/client';
import { cn } from '@/lib/utils';

interface OhsIncident {
  id: string;
  title: string;
  incidentDate: string;
  reportedDate: string;
  location: string;
  activity: string;
  type: 'injury' | 'illness' | 'near_miss' | 'dangerous_occurrence' | 'property_damage' | 'environmental';
  severity: 'fatality' | 'lost_time' | 'medical_treatment' | 'first_aid' | 'near_miss';
  description: string;
  injuredPerson?: string;
  bodyPart?: string;
  daysLost: number;
  immediateActions: string;
  rootCause?: string;
  correctiveActions?: string;
  reportedBy: string;
  investigatedBy?: string;
  status: 'reported' | 'under_investigation' | 'investigation_complete' | 'closed';
  capaCompleted: boolean;
  createdAt: string;
}

const TYPES: Record<string, string> = {
  injury:               'Injury',
  illness:              'Illness',
  near_miss:            'Near Miss',
  dangerous_occurrence: 'Dangerous Occurrence',
  property_damage:      'Property Damage',
  environmental:        'Environmental',
};

const SEVERITY_CFG: Record<string, { label: string; bg: string; text: string }> = {
  fatality:         { label: 'Fatality',          bg: 'bg-black',   text: 'text-white'       },
  lost_time:        { label: 'Lost Time Injury',   bg: 'bg-red-100', text: 'text-red-700'     },
  medical_treatment:{ label: 'Medical Treatment',  bg: 'bg-orange-100', text: 'text-orange-700' },
  first_aid:        { label: 'First Aid',          bg: 'bg-amber-100', text: 'text-amber-700'  },
  near_miss:        { label: 'Near Miss',          bg: 'bg-blue-100', text: 'text-blue-700'    },
};

const STATUS_CFG: Record<string, { label: string; icon: React.ElementType; cls: string }> = {
  reported:                { label: 'Reported',               icon: AlertTriangle,  cls: 'bg-gray-100 text-gray-600'  },
  under_investigation:     { label: 'Under Investigation',    icon: Clock,          cls: 'bg-amber-100 text-amber-700' },
  investigation_complete:  { label: 'Investigation Complete', icon: CheckCircle2,   cls: 'bg-blue-100 text-blue-700'  },
  closed:                  { label: 'Closed',                 icon: CheckCircle2,   cls: 'bg-green-100 text-green-700' },
};

const EMPTY: any = {
  title: '', incidentDate: '', reportedDate: '', location: '', activity: '',
  type: 'near_miss', severity: 'near_miss', description: '',
  injuredPerson: '', bodyPart: '', daysLost: 0, immediateActions: '',
  rootCause: '', correctiveActions: '', reportedBy: '', investigatedBy: '',
  status: 'reported', capaCompleted: false,
};

export default function OhsIncidentsPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<OhsIncident | null>(null);
  const [form, setForm] = useState({ ...EMPTY });
  const [filter, setFilter] = useState<string>('all');

  const { data: incidents = [], isLoading } = useQuery<OhsIncident[]>({
    queryKey: ['ohs-incidents'],
    queryFn: () => apiClient.get('/iso45001/incidents').then(r => r.data?.data ?? r.data ?? []),
  });

  const saveMutation = useMutation({
    mutationFn: (dto: any) => editing
      ? apiClient.put(`/iso45001/incidents/${editing.id}`, dto).then(r => r.data)
      : apiClient.post('/iso45001/incidents', dto).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ohs-incidents'] });
      setShowForm(false); setEditing(null); setForm({ ...EMPTY });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/iso45001/incidents/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ohs-incidents'] }),
  });

  function openEdit(i: OhsIncident) {
    setEditing(i);
    setForm({
      title: i.title, incidentDate: i.incidentDate?.split('T')[0] ?? '',
      reportedDate: i.reportedDate?.split('T')[0] ?? '',
      location: i.location, activity: i.activity, type: i.type,
      severity: i.severity, description: i.description,
      injuredPerson: i.injuredPerson ?? '', bodyPart: i.bodyPart ?? '',
      daysLost: i.daysLost, immediateActions: i.immediateActions,
      rootCause: i.rootCause ?? '', correctiveActions: i.correctiveActions ?? '',
      reportedBy: i.reportedBy, investigatedBy: i.investigatedBy ?? '',
      status: i.status, capaCompleted: i.capaCompleted,
    });
    setShowForm(true);
  }

  const lti       = incidents.filter(i => i.severity === 'lost_time').length;
  const nearMiss  = incidents.filter(i => i.severity === 'near_miss').length;
  const open      = incidents.filter(i => i.status !== 'closed').length;
  const totalDays = incidents.reduce((acc, i) => acc + (i.daysLost ?? 0), 0);

  const filtered = filter === 'all' ? incidents :
    filter === 'open' ? incidents.filter(i => i.status !== 'closed') :
    incidents.filter(i => i.severity === filter || i.type === filter);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <div className="w-11 h-11 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
            <HardHat className="h-5 w-5 text-amber-700" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">OH&S Incident Register</h1>
            <p className="text-sm text-gray-500 mt-0.5">ISO 45001 Clause 10.2 — Incident investigation and nonconformity</p>
          </div>
        </div>
        <button onClick={() => { setEditing(null); setForm({ ...EMPTY }); setShowForm(true); }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-600 text-white text-sm font-medium hover:bg-amber-700 transition-colors">
          <Plus className="h-4 w-4" /> Report Incident
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total Incidents', value: incidents.length, color: 'text-gray-900', bg: 'bg-gray-50' },
          { label: 'Lost Time Injuries', value: lti, color: 'text-red-600', bg: 'bg-red-50' },
          { label: 'Near Misses', value: nearMiss, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Days Lost (Total)', value: totalDays, color: 'text-amber-600', bg: 'bg-amber-50' },
        ].map(({ label, value, color, bg }) => (
          <div key={label} className={cn('rounded-xl p-4 border border-gray-100', bg)}>
            <p className={cn('text-2xl font-bold', color)}>{value}</p>
            <p className="text-sm text-gray-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2 flex-wrap">
        {[
          { key: 'all', label: 'All' }, { key: 'open', label: 'Open' },
          { key: 'lost_time', label: 'Lost Time' }, { key: 'near_miss', label: 'Near Miss' },
          { key: 'medical_treatment', label: 'Medical Treatment' },
        ].map(({ key, label }) => (
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
          <div className="p-8 text-center text-gray-400">Loading incidents…</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <HardHat className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No incidents recorded</p>
            <p className="text-gray-400 text-sm mt-1">Report and track all workplace incidents and near misses</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  {['Date', 'Incident', 'Type', 'Severity', 'Days Lost', 'Status', 'CAPA', ''].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(inc => {
                  const sevCfg = SEVERITY_CFG[inc.severity];
                  const statCfg = STATUS_CFG[inc.status];
                  const StatIcon = statCfg.icon;
                  return (
                    <tr key={inc.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-gray-600 text-xs whitespace-nowrap">
                        {new Date(inc.incidentDate).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{inc.title}</p>
                        <p className="text-xs text-gray-400">{inc.location}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{TYPES[inc.type]}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', sevCfg.bg, sevCfg.text)}>{sevCfg.label}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={cn('text-sm font-bold', inc.daysLost > 0 ? 'text-red-600' : 'text-gray-400')}>{inc.daysLost}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn('inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full', statCfg.cls)}>
                          <StatIcon className="w-3 h-3" />{statCfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {inc.capaCompleted
                          ? <CheckCircle2 className="w-4 h-4 text-green-500" />
                          : <Clock className="w-4 h-4 text-amber-400" />}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button onClick={() => openEdit(inc)} className="text-xs text-blue-600 hover:text-blue-800">Edit</button>
                          <button onClick={() => deleteMutation.mutate(inc.id)} className="text-xs text-red-500 hover:text-red-700">Delete</button>
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
              <h2 className="font-bold text-gray-900">{editing ? 'Edit Incident' : 'Report Incident'}</h2>
              <button onClick={() => setShowForm(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <form onSubmit={e => { e.preventDefault(); saveMutation.mutate(form); }} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Incident Title *</label>
                <input required value={form.title} onChange={e => setForm((f: any) => ({ ...f, title: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                  placeholder="e.g., Slip on wet floor — canteen area" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Incident Date *</label>
                  <input required type="date" value={form.incidentDate} onChange={e => setForm((f: any) => ({ ...f, incidentDate: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Type</label>
                  <select value={form.type} onChange={e => setForm((f: any) => ({ ...f, type: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400">
                    {Object.entries(TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Severity</label>
                  <select value={form.severity} onChange={e => setForm((f: any) => ({ ...f, severity: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400">
                    {Object.entries(SEVERITY_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Location</label>
                  <input value={form.location} onChange={e => setForm((f: any) => ({ ...f, location: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Activity at Time of Incident</label>
                  <input value={form.activity} onChange={e => setForm((f: any) => ({ ...f, activity: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Description *</label>
                <textarea required rows={3} value={form.description} onChange={e => setForm((f: any) => ({ ...f, description: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Injured Person</label>
                  <input value={form.injuredPerson} onChange={e => setForm((f: any) => ({ ...f, injuredPerson: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Body Part Affected</label>
                  <input value={form.bodyPart} onChange={e => setForm((f: any) => ({ ...f, bodyPart: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                    placeholder="e.g., Left ankle" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Days Lost</label>
                  <input type="number" min={0} value={form.daysLost} onChange={e => setForm((f: any) => ({ ...f, daysLost: parseInt(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Immediate Actions Taken</label>
                <textarea rows={2} value={form.immediateActions} onChange={e => setForm((f: any) => ({ ...f, immediateActions: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Root Cause (Investigation)</label>
                <textarea rows={2} value={form.rootCause} onChange={e => setForm((f: any) => ({ ...f, rootCause: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Corrective Actions</label>
                <textarea rows={2} value={form.correctiveActions} onChange={e => setForm((f: any) => ({ ...f, correctiveActions: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Reported By *</label>
                  <input required value={form.reportedBy} onChange={e => setForm((f: any) => ({ ...f, reportedBy: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Status</label>
                  <select value={form.status} onChange={e => setForm((f: any) => ({ ...f, status: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400">
                    {Object.entries(STATUS_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="capa" checked={form.capaCompleted} onChange={e => setForm((f: any) => ({ ...f, capaCompleted: e.target.checked }))}
                  className="w-4 h-4 accent-amber-600" />
                <label htmlFor="capa" className="text-sm text-gray-700">Corrective actions completed (CAPA closed)</label>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowForm(false)}
                  className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={saveMutation.isPending}
                  className="px-4 py-2 text-sm bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50">
                  {saveMutation.isPending ? 'Saving…' : editing ? 'Save Changes' : 'Report Incident'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
