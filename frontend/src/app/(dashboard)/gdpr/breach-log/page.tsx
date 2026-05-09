'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Siren, Plus, Clock, AlertCircle, CheckCircle } from 'lucide-react';
import { apiClient } from '@/lib/api/client';

interface BreachNotification {
  id: string;
  title: string;
  description: string;
  severity: string;
  status: string;
  detectedAt: string;
  deadlineAt: string;
  supervisoryNotifiedAt?: string;
  dataSubjectsNotifiedAt?: string;
  affectedRecords?: number;
}

const SEVERITY_COLORS: Record<string, string> = {
  low: 'bg-blue-100 text-blue-700', medium: 'bg-amber-100 text-amber-700',
  high: 'bg-orange-100 text-orange-700', critical: 'bg-red-100 text-red-700',
};

function hoursLeft(deadlineAt: string) {
  return Math.ceil((new Date(deadlineAt).getTime() - Date.now()) / 3600000);
}

export default function BreachLogPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', severity: 'medium', affectedRecords: '' });

  const { data: breaches = [], isLoading } = useQuery<BreachNotification[]>({
    queryKey: ['gdpr-breaches'],
    queryFn: () => apiClient.get('/gdpr/breaches').then(r => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (dto: any) => apiClient.post('/gdpr/breaches', dto).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['gdpr-breaches'] });
      setShowForm(false);
      setForm({ title: '', description: '', severity: 'medium', affectedRecords: '' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => apiClient.patch(`/gdpr/breaches/${id}`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['gdpr-breaches'] }),
  });

  const openBreaches = breaches.filter(b => b.status !== 'closed');
  const criticalOpen = openBreaches.filter(b => b.severity === 'critical' || b.severity === 'high');

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-start gap-4">
          <div className="w-11 h-11 rounded-xl bg-red-100 flex items-center justify-center shrink-0">
            <Siren className="h-5 w-5 text-red-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Breach Log</h1>
            <p className="text-sm text-gray-500 mt-0.5">GDPR Art. 33–34 — 72-hour supervisory authority notification SLA</p>
          </div>
        </div>
        <button onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors">
          <Plus className="h-4 w-4" /> Log Breach
        </button>
      </div>

      {criticalOpen.length > 0 && (
        <div className="mb-5 bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-red-500 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-red-700">{criticalOpen.length} active high/critical breach{criticalOpen.length !== 1 ? 'es' : ''}</p>
              <p className="text-xs text-red-600 mt-0.5">72-hour notification deadline is running. Check supervisory authority notification status below.</p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className={`border rounded-xl p-4 ${openBreaches.length > 0 ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200'}`}>
          <div className={`text-2xl font-bold ${openBreaches.length > 0 ? 'text-red-600' : 'text-gray-900'}`}>{openBreaches.length}</div>
          <div className={`text-sm ${openBreaches.length > 0 ? 'text-red-500' : 'text-gray-500'}`}>Open Breaches</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="text-2xl font-bold text-gray-900">{breaches.filter(b => b.supervisoryNotifiedAt).length}</div>
          <div className="text-sm text-gray-500">SA Notified</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="text-2xl font-bold text-gray-900">{breaches.length}</div>
          <div className="text-sm text-gray-500">Total Logged</div>
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
            <div className="p-6 border-b border-gray-100 bg-red-50 rounded-t-2xl">
              <h2 className="text-lg font-semibold text-red-900">Log Security Breach</h2>
              <p className="text-xs text-red-600 mt-1">72-hour notification clock starts from detection time</p>
            </div>
            <form onSubmit={e => { e.preventDefault(); createMutation.mutate({ ...form, affectedRecords: form.affectedRecords ? parseInt(form.affectedRecords) : undefined }); }} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Breach Title *</label>
                <input required value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Severity *</label>
                  <select required value={form.severity} onChange={e => setForm(f => ({ ...f, severity: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500">
                    {['low','medium','high','critical'].map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Affected Records</label>
                  <input type="number" min="0" value={form.affectedRecords} onChange={e => setForm(f => ({ ...f, affectedRecords: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description *</label>
                <textarea required rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                  placeholder="Nature of the breach, data categories involved, likely consequences..." />
              </div>
              <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg">Cancel</button>
                <button type="submit" disabled={createMutation.isPending} className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-50">
                  {createMutation.isPending ? 'Logging…' : 'Log Breach'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-red-600 border-t-transparent rounded-full animate-spin" /></div>
      ) : breaches.length === 0 ? (
        <div className="text-center py-16 bg-white border border-dashed border-gray-200 rounded-2xl">
          <Siren className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No breaches logged</p>
          <p className="text-sm text-gray-400 mt-1">Log security incidents that involve personal data</p>
        </div>
      ) : (
        <div className="space-y-3">
          {breaches.map(b => {
            const hours = hoursLeft(b.deadlineAt);
            const isOpen = b.status !== 'closed';
            return (
              <div key={b.id} className={`bg-white border rounded-xl p-5 ${isOpen && hours <= 0 ? 'border-red-400' : isOpen && hours <= 12 ? 'border-orange-300' : 'border-gray-200'}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-semibold text-gray-900">{b.title}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${SEVERITY_COLORS[b.severity] ?? 'bg-gray-100 text-gray-700'}`}>{b.severity.toUpperCase()}</span>
                      {isOpen && (
                        <span className={`text-xs font-medium flex items-center gap-1 ${hours <= 0 ? 'text-red-600' : hours <= 12 ? 'text-orange-600' : 'text-gray-500'}`}>
                          <Clock className="h-3 w-3" />
                          {hours <= 0 ? `${Math.abs(hours)}h overdue` : `${hours}h until 72h deadline`}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mb-2">{b.description}</p>
                    <div className="flex flex-wrap gap-3 text-xs">
                      {b.supervisoryNotifiedAt
                        ? <span className="text-green-600 flex items-center gap-1"><CheckCircle className="h-3 w-3" /> SA Notified {new Date(b.supervisoryNotifiedAt).toLocaleDateString()}</span>
                        : isOpen && <span className="text-amber-600">⚠ SA not yet notified</span>
                      }
                      {b.affectedRecords != null && <span className="text-gray-500">{b.affectedRecords.toLocaleString()} records affected</span>}
                    </div>
                    <p className="text-xs text-gray-400 mt-2">Detected {new Date(b.detectedAt).toLocaleDateString()}</p>
                  </div>
                  {isOpen && !b.supervisoryNotifiedAt && (
                    <button onClick={() => updateMutation.mutate({ id: b.id, data: { supervisoryNotifiedAt: new Date().toISOString() } })}
                      className="shrink-0 px-3 py-1.5 text-xs font-medium text-white bg-violet-600 hover:bg-violet-700 rounded-lg">
                      Mark SA Notified
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
