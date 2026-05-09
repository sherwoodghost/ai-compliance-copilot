'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FileText, Plus, Trash2, Edit2, CheckCircle, AlertCircle, Globe } from 'lucide-react';
import { apiClient } from '@/lib/api/client';

interface ProcessingActivity {
  id: string;
  name: string;
  purpose: string;
  lawfulBasis: string;
  dataCategories: string[];
  dataSubjects: string[];
  retentionPeriod?: string;
  internationalTransfers: boolean;
  transferMechanisms: string[];
  processorName?: string;
  dpaRequired: boolean;
  dpaSigned: boolean;
  dpiaRequired: boolean;
  notes?: string;
  createdAt: string;
}

const LAWFUL_BASIS_OPTIONS = [
  { value: 'consent', label: 'Consent' },
  { value: 'contract', label: 'Contract' },
  { value: 'legal_obligation', label: 'Legal Obligation' },
  { value: 'vital_interests', label: 'Vital Interests' },
  { value: 'public_task', label: 'Public Task' },
  { value: 'legitimate_interests', label: 'Legitimate Interests' },
];

const BASIS_COLORS: Record<string, string> = {
  consent: 'bg-blue-100 text-blue-700',
  contract: 'bg-green-100 text-green-700',
  legal_obligation: 'bg-purple-100 text-purple-700',
  vital_interests: 'bg-red-100 text-red-700',
  public_task: 'bg-orange-100 text-orange-700',
  legitimate_interests: 'bg-amber-100 text-amber-700',
};

export default function RopaPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<ProcessingActivity | null>(null);
  const [form, setForm] = useState({
    name: '', purpose: '', lawfulBasis: 'legitimate_interests',
    dataCategories: '', dataSubjects: '', retentionPeriod: '',
    internationalTransfers: false, processorName: '',
    dpaRequired: false, dpaSigned: false, dpiaRequired: false, notes: '',
  });

  const { data: activities = [], isLoading } = useQuery<ProcessingActivity[]>({
    queryKey: ['gdpr-activities'],
    queryFn: () => apiClient.get('/gdpr/activities').then(r => r.data),
  });

  const saveMutation = useMutation({
    mutationFn: (dto: any) => editing
      ? apiClient.put(`/gdpr/activities/${editing.id}`, dto).then(r => r.data)
      : apiClient.post('/gdpr/activities', dto).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['gdpr-activities'] });
      setShowForm(false);
      setEditing(null);
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/gdpr/activities/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['gdpr-activities'] }),
  });

  function resetForm() {
    setForm({ name: '', purpose: '', lawfulBasis: 'legitimate_interests', dataCategories: '', dataSubjects: '', retentionPeriod: '', internationalTransfers: false, processorName: '', dpaRequired: false, dpaSigned: false, dpiaRequired: false, notes: '' });
  }

  function openEdit(a: ProcessingActivity) {
    setEditing(a);
    setForm({
      name: a.name, purpose: a.purpose, lawfulBasis: a.lawfulBasis,
      dataCategories: a.dataCategories.join(', '), dataSubjects: a.dataSubjects.join(', '),
      retentionPeriod: a.retentionPeriod ?? '', internationalTransfers: a.internationalTransfers,
      processorName: a.processorName ?? '', dpaRequired: a.dpaRequired,
      dpaSigned: a.dpaSigned, dpiaRequired: a.dpiaRequired, notes: a.notes ?? '',
    });
    setShowForm(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    saveMutation.mutate({
      ...form,
      dataCategories: form.dataCategories.split(',').map(s => s.trim()).filter(Boolean),
      dataSubjects: form.dataSubjects.split(',').map(s => s.trim()).filter(Boolean),
    });
  }

  const dpaMissing = activities.filter(a => a.dpaRequired && !a.dpaSigned).length;
  const dpiaPending = activities.filter(a => a.dpiaRequired).length;
  const hasTransfers = activities.filter(a => a.internationalTransfers).length;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-start gap-4">
          <div className="w-11 h-11 rounded-xl bg-violet-100 flex items-center justify-center shrink-0">
            <FileText className="h-5 w-5 text-violet-700" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Record of Processing Activities</h1>
            <p className="text-sm text-gray-500 mt-0.5">GDPR Art. 30 — {activities.length} processing activities documented</p>
          </div>
        </div>
        <button
          onClick={() => { setEditing(null); resetForm(); setShowForm(true); }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 text-white text-sm font-medium hover:bg-violet-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Add Activity
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="text-2xl font-bold text-gray-900">{activities.length}</div>
          <div className="text-sm text-gray-500">Total Activities</div>
        </div>
        <div className={`border rounded-xl p-4 ${dpaMissing > 0 ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200'}`}>
          <div className={`text-2xl font-bold ${dpaMissing > 0 ? 'text-red-600' : 'text-gray-900'}`}>{dpaMissing}</div>
          <div className={`text-sm ${dpaMissing > 0 ? 'text-red-500' : 'text-gray-500'}`}>DPAs Missing Signature</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="text-2xl font-bold text-gray-900">{hasTransfers}</div>
          <div className="text-sm text-gray-500">International Transfers</div>
        </div>
      </div>

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">{editing ? 'Edit' : 'Add'} Processing Activity</h2>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Activity Name *</label>
                  <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                    placeholder="e.g. Customer CRM, Marketing emails" />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Purpose *</label>
                  <textarea required rows={2} value={form.purpose} onChange={e => setForm(f => ({ ...f, purpose: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                    placeholder="Why is this data processed?" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Lawful Basis *</label>
                  <select required value={form.lawfulBasis} onChange={e => setForm(f => ({ ...f, lawfulBasis: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500">
                    {LAWFUL_BASIS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Retention Period</label>
                  <input value={form.retentionPeriod} onChange={e => setForm(f => ({ ...f, retentionPeriod: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                    placeholder="e.g. 3 years after contract end" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Data Categories (comma-separated)</label>
                  <input value={form.dataCategories} onChange={e => setForm(f => ({ ...f, dataCategories: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                    placeholder="name, email, address" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Data Subjects (comma-separated)</label>
                  <input value={form.dataSubjects} onChange={e => setForm(f => ({ ...f, dataSubjects: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                    placeholder="customers, employees" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Processor Name</label>
                  <input value={form.processorName} onChange={e => setForm(f => ({ ...f, processorName: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                    placeholder="e.g. AWS, Salesforce" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                  <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
                </div>
              </div>
              <div className="flex flex-wrap gap-4 pt-2">
                {[
                  { key: 'internationalTransfers', label: 'International Transfers' },
                  { key: 'dpaRequired', label: 'DPA Required' },
                  { key: 'dpaSigned', label: 'DPA Signed' },
                  { key: 'dpiaRequired', label: 'DPIA Required' },
                ].map(({ key, label }) => (
                  <label key={key} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                    <input type="checkbox" checked={(form as any)[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.checked }))}
                      className="rounded border-gray-300 text-violet-600 focus:ring-violet-500" />
                    {label}
                  </label>
                ))}
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <button type="button" onClick={() => { setShowForm(false); setEditing(null); }}
                  className="px-4 py-2 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={saveMutation.isPending}
                  className="px-4 py-2 text-sm font-medium text-white bg-violet-600 hover:bg-violet-700 rounded-lg transition-colors disabled:opacity-50">
                  {saveMutation.isPending ? 'Saving…' : editing ? 'Update' : 'Add Activity'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Activity list */}
      {isLoading ? (
        <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-violet-600 border-t-transparent rounded-full animate-spin" /></div>
      ) : activities.length === 0 ? (
        <div className="text-center py-16 bg-white border border-dashed border-gray-200 rounded-2xl">
          <FileText className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No processing activities yet</p>
          <p className="text-sm text-gray-400 mt-1">Add your first activity to start building your ROPA</p>
        </div>
      ) : (
        <div className="space-y-3">
          {activities.map(a => (
            <div key={a.id} className="bg-white border border-gray-200 rounded-xl p-5 hover:border-violet-200 transition-colors">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-semibold text-gray-900">{a.name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${BASIS_COLORS[a.lawfulBasis] ?? 'bg-gray-100 text-gray-700'}`}>
                      {LAWFUL_BASIS_OPTIONS.find(o => o.value === a.lawfulBasis)?.label ?? a.lawfulBasis}
                    </span>
                    {a.internationalTransfers && (
                      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">
                        <Globe className="h-3 w-3" /> Transfers
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 mb-2">{a.purpose}</p>
                  <div className="flex flex-wrap gap-3 text-xs text-gray-500">
                    {a.dataCategories.length > 0 && <span>Categories: {a.dataCategories.slice(0, 3).join(', ')}{a.dataCategories.length > 3 ? ` +${a.dataCategories.length - 3}` : ''}</span>}
                    {a.retentionPeriod && <span>Retention: {a.retentionPeriod}</span>}
                    {a.processorName && <span>Processor: {a.processorName}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {a.dpaRequired && (
                    a.dpaSigned
                      ? <CheckCircle className="h-4 w-4 text-green-500" aria-label="DPA Signed" />
                      : <AlertCircle className="h-4 w-4 text-red-500" aria-label="DPA Missing" />
                  )}
                  <button onClick={() => openEdit(a)} className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors">
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button onClick={() => { if (confirm('Delete this activity?')) deleteMutation.mutate(a.id); }}
                    className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {dpiaPending > 0 && (
        <div className="mt-6 bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          <strong>{dpiaPending} activit{dpiaPending > 1 ? 'ies' : 'y'}</strong> require a DPIA.
          Complete the assessment in the <a href="/gdpr/dpia" className="underline">DPIA Register</a>.
        </div>
      )}
    </div>
  );
}
