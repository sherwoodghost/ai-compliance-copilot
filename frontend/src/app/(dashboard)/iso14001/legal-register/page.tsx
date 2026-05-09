'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ScrollText, Plus, CheckCircle2, AlertTriangle, Clock, X } from 'lucide-react';
import { apiClient } from '@/lib/api/client';
import { cn } from '@/lib/utils';

interface LegalRequirement {
  id: string;
  title: string;
  type: string;
  jurisdiction: string;
  reference: string;
  description: string;
  applicabilityReason: string;
  complianceStatus: 'compliant' | 'partial' | 'non_compliant' | 'not_assessed';
  responsiblePerson: string;
  reviewDate: string;
  nextReviewDate: string;
  notes?: string;
  createdAt: string;
}

const TYPES = ['Legislation', 'Regulation', 'Permit', 'License', 'Standard', 'Code of Practice', 'Other'];

const STATUS_CFG: Record<string, { label: string; bg: string; text: string; icon: React.ElementType }> = {
  compliant:      { label: 'Compliant',      bg: 'bg-green-100',  text: 'text-green-700',  icon: CheckCircle2  },
  partial:        { label: 'Partial',         bg: 'bg-amber-100',  text: 'text-amber-700',  icon: AlertTriangle },
  non_compliant:  { label: 'Non-Compliant',   bg: 'bg-red-100',    text: 'text-red-700',    icon: AlertTriangle },
  not_assessed:   { label: 'Not Assessed',    bg: 'bg-gray-100',   text: 'text-gray-600',   icon: Clock         },
};

const EMPTY = {
  title: '', type: 'Legislation', jurisdiction: '', reference: '',
  description: '', applicabilityReason: '',
  complianceStatus: 'not_assessed' as LegalRequirement['complianceStatus'],
  responsiblePerson: '', reviewDate: '', nextReviewDate: '', notes: '',
};

export default function LegalRegisterPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<LegalRequirement | null>(null);
  const [form, setForm] = useState({ ...EMPTY });
  const [filter, setFilter] = useState<string>('all');

  const { data: requirements = [], isLoading } = useQuery<LegalRequirement[]>({
    queryKey: ['legal-requirements'],
    queryFn: () => apiClient.get('/iso14001/legal-register').then(r => r.data?.data ?? r.data ?? []),
  });

  const saveMutation = useMutation({
    mutationFn: (dto: any) => editing
      ? apiClient.put(`/iso14001/legal-register/${editing.id}`, dto).then(r => r.data)
      : apiClient.post('/iso14001/legal-register', dto).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['legal-requirements'] });
      setShowForm(false); setEditing(null); setForm({ ...EMPTY });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/iso14001/legal-register/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['legal-requirements'] }),
  });

  function openEdit(r: LegalRequirement) {
    setEditing(r);
    setForm({
      title: r.title, type: r.type, jurisdiction: r.jurisdiction,
      reference: r.reference, description: r.description,
      applicabilityReason: r.applicabilityReason,
      complianceStatus: r.complianceStatus, responsiblePerson: r.responsiblePerson,
      reviewDate: r.reviewDate?.split('T')[0] ?? '',
      nextReviewDate: r.nextReviewDate?.split('T')[0] ?? '',
      notes: r.notes ?? '',
    });
    setShowForm(true);
  }

  const compliant   = requirements.filter(r => r.complianceStatus === 'compliant').length;
  const nonComp     = requirements.filter(r => r.complianceStatus === 'non_compliant').length;
  const overdue     = requirements.filter(r => r.nextReviewDate && new Date(r.nextReviewDate) < new Date()).length;

  const filtered = filter === 'all' ? requirements : requirements.filter(r => r.complianceStatus === filter);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <div className="w-11 h-11 rounded-xl bg-green-100 flex items-center justify-center shrink-0">
            <ScrollText className="h-5 w-5 text-green-700" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Legal & Other Requirements Register</h1>
            <p className="text-sm text-gray-500 mt-0.5">ISO 14001 Clause 6.1.3 — Compliance obligations</p>
          </div>
        </div>
        <button
          onClick={() => { setEditing(null); setForm({ ...EMPTY }); setShowForm(true); }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 transition-colors"
        >
          <Plus className="h-4 w-4" /> Add Requirement
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total',         value: requirements.length, color: 'text-gray-900', bg: 'bg-gray-50' },
          { label: 'Compliant',     value: compliant,           color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Non-Compliant', value: nonComp,             color: 'text-red-600',   bg: 'bg-red-50' },
          { label: 'Review Overdue',value: overdue,             color: 'text-amber-600', bg: 'bg-amber-50' },
        ].map(({ label, value, color, bg }) => (
          <div key={label} className={cn('rounded-xl p-4 border border-gray-100', bg)}>
            <p className={cn('text-2xl font-bold', color)}>{value}</p>
            <p className="text-sm text-gray-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        {[
          { key: 'all',          label: 'All' },
          { key: 'compliant',    label: 'Compliant' },
          { key: 'partial',      label: 'Partial' },
          { key: 'non_compliant',label: 'Non-Compliant' },
          { key: 'not_assessed', label: 'Not Assessed' },
        ].map(({ key, label }) => (
          <button key={key} onClick={() => setFilter(key)}
            className={cn('px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
              filter === key ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}>
            {label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Loading register…</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <ScrollText className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No legal requirements recorded</p>
            <p className="text-gray-400 text-sm mt-1">Add applicable environmental legislation and regulations</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  {['Requirement', 'Type', 'Jurisdiction', 'Reference', 'Status', 'Next Review', ''].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(req => {
                  const cfg = STATUS_CFG[req.complianceStatus];
                  const StatusIcon = cfg.icon;
                  const isOverdue = req.nextReviewDate && new Date(req.nextReviewDate) < new Date();
                  return (
                    <tr key={req.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{req.title}</p>
                        <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{req.applicabilityReason}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{req.type}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-xs">{req.jurisdiction}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs font-mono">{req.reference}</td>
                      <td className="px-4 py-3">
                        <span className={cn('inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full', cfg.bg, cfg.text)}>
                          <StatusIcon className="w-3 h-3" />
                          {cfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {req.nextReviewDate ? (
                          <span className={cn('text-xs', isOverdue ? 'text-red-600 font-semibold' : 'text-gray-500')}>
                            {new Date(req.nextReviewDate).toLocaleDateString()}
                            {isOverdue && ' ⚠'}
                          </span>
                        ) : <span className="text-xs text-gray-400">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button onClick={() => openEdit(req)} className="text-xs text-blue-600 hover:text-blue-800">Edit</button>
                          <button onClick={() => deleteMutation.mutate(req.id)} className="text-xs text-red-500 hover:text-red-700">Delete</button>
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
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-100 sticky top-0 bg-white z-10">
              <h2 className="font-bold text-gray-900">{editing ? 'Edit Requirement' : 'Add Legal Requirement'}</h2>
              <button onClick={() => setShowForm(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <form onSubmit={e => { e.preventDefault(); saveMutation.mutate(form); }} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Title / Name *</label>
                <input required value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                  placeholder="e.g., Clean Air Act 1993" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Type</label>
                  <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-400">
                    {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Jurisdiction</label>
                  <input value={form.jurisdiction} onChange={e => setForm(f => ({ ...f, jurisdiction: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                    placeholder="e.g., Federal / State / EU" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Reference / Citation</label>
                <input value={form.reference} onChange={e => setForm(f => ({ ...f, reference: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                  placeholder="e.g., 40 CFR Part 63, Article 4(1)" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Description</label>
                <textarea rows={2} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-400 resize-none"
                  placeholder="Brief description of requirements imposed" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Why It Applies *</label>
                <input required value={form.applicabilityReason} onChange={e => setForm(f => ({ ...f, applicabilityReason: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                  placeholder="e.g., Applies because we operate boilers >25 MW" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Compliance Status</label>
                  <select value={form.complianceStatus} onChange={e => setForm(f => ({ ...f, complianceStatus: e.target.value as any }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-400">
                    {Object.entries(STATUS_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Responsible Person</label>
                  <input value={form.responsiblePerson} onChange={e => setForm(f => ({ ...f, responsiblePerson: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                    placeholder="e.g., EHS Manager" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Last Review Date</label>
                  <input type="date" value={form.reviewDate} onChange={e => setForm(f => ({ ...f, reviewDate: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Next Review Date</label>
                  <input type="date" value={form.nextReviewDate} onChange={e => setForm(f => ({ ...f, nextReviewDate: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Notes</label>
                <textarea rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-400 resize-none" />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowForm(false)}
                  className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={saveMutation.isPending}
                  className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50">
                  {saveMutation.isPending ? 'Saving…' : editing ? 'Save Changes' : 'Add Requirement'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
