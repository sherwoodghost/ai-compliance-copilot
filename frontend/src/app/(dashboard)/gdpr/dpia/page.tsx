'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ShieldAlert, Plus, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { apiClient } from '@/lib/api/client';

interface DpiaRecord {
  id: string;
  processingActivityName: string;
  status: string;
  riskLevel?: string;
  triggeredAt: string;
  completedAt?: string;
  dpoConsulted: boolean;
  notes?: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending:    { label: 'Pending',     color: 'bg-amber-100 text-amber-700' },
  in_progress:{ label: 'In Progress', color: 'bg-blue-100 text-blue-700' },
  completed:  { label: 'Completed',   color: 'bg-green-100 text-green-700' },
  approved:   { label: 'Approved',    color: 'bg-emerald-100 text-emerald-700' },
};

const RISK_COLORS: Record<string, string> = {
  low: 'text-green-600', medium: 'text-amber-600', high: 'text-red-600', critical: 'text-red-700',
};

export default function DpiaPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ processingActivityName: '', notes: '', dpoConsulted: false });

  const { data: dpias = [], isLoading } = useQuery<DpiaRecord[]>({
    queryKey: ['gdpr-dpias'],
    queryFn: () => apiClient.get('/gdpr/dpias').then(r => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (dto: any) => apiClient.post('/gdpr/dpias', dto).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['gdpr-dpias'] });
      setShowForm(false);
      setForm({ processingActivityName: '', notes: '', dpoConsulted: false });
    },
  });

  const pending = dpias.filter(d => d.status === 'pending' || d.status === 'in_progress').length;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-start gap-4">
          <div className="w-11 h-11 rounded-xl bg-violet-100 flex items-center justify-center shrink-0">
            <ShieldAlert className="h-5 w-5 text-violet-700" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">DPIA Register</h1>
            <p className="text-sm text-gray-500 mt-0.5">GDPR Art. 35 — Data Protection Impact Assessments</p>
          </div>
        </div>
        <button onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 text-white text-sm font-medium hover:bg-violet-700 transition-colors">
          <Plus className="h-4 w-4" /> New DPIA
        </button>
      </div>

      {pending > 0 && (
        <div className="mb-5 bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-amber-500 shrink-0" />
          <p className="text-sm text-amber-700">{pending} DPIA{pending !== 1 ? 's' : ''} in progress — complete before launching associated processing activities</p>
        </div>
      )}

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="text-2xl font-bold text-gray-900">{dpias.length}</div>
          <div className="text-sm text-gray-500">Total DPIAs</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className={`text-2xl font-bold ${pending > 0 ? 'text-amber-600' : 'text-gray-900'}`}>{pending}</div>
          <div className="text-sm text-gray-500">In Progress</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="text-2xl font-bold text-green-600">{dpias.filter(d => d.status === 'approved').length}</div>
          <div className="text-sm text-gray-500">Approved</div>
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
            <div className="p-6 border-b border-gray-100"><h2 className="text-lg font-semibold">Start New DPIA</h2></div>
            <form onSubmit={e => { e.preventDefault(); createMutation.mutate(form); }} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Processing Activity Name *</label>
                <input required value={form.processingActivityName} onChange={e => setForm(f => ({ ...f, processingActivityName: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                  placeholder="e.g. AI-powered recruitment screening" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Initial Notes</label>
                <textarea rows={3} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                  placeholder="Describe the nature, scope and context of the processing..." />
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input type="checkbox" checked={form.dpoConsulted} onChange={e => setForm(f => ({ ...f, dpoConsulted: e.target.checked }))}
                  className="rounded border-gray-300 text-violet-600 focus:ring-violet-500" />
                DPO has been consulted
              </label>
              <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg">Cancel</button>
                <button type="submit" disabled={createMutation.isPending} className="px-4 py-2 text-sm font-medium text-white bg-violet-600 hover:bg-violet-700 rounded-lg disabled:opacity-50">
                  {createMutation.isPending ? 'Creating…' : 'Start DPIA'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-violet-600 border-t-transparent rounded-full animate-spin" /></div>
      ) : dpias.length === 0 ? (
        <div className="text-center py-16 bg-white border border-dashed border-gray-200 rounded-2xl">
          <ShieldAlert className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No DPIAs yet</p>
          <p className="text-sm text-gray-400 mt-1">DPIAs are required for high-risk processing activities</p>
        </div>
      ) : (
        <div className="space-y-3">
          {dpias.map(d => {
            const cfg = STATUS_CONFIG[d.status] ?? { label: d.status, color: 'bg-gray-100 text-gray-700' };
            return (
              <div key={d.id} className="bg-white border border-gray-200 rounded-xl p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-semibold text-gray-900">{d.processingActivityName}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.color}`}>{cfg.label}</span>
                      {d.riskLevel && <span className={`text-xs font-medium ${RISK_COLORS[d.riskLevel] ?? 'text-gray-500'}`}>{d.riskLevel.toUpperCase()} risk</span>}
                      {d.dpoConsulted && <span className="text-xs text-green-600 flex items-center gap-1"><CheckCircle className="h-3 w-3" /> DPO consulted</span>}
                    </div>
                    {d.notes && <p className="text-sm text-gray-500">{d.notes}</p>}
                    <p className="text-xs text-gray-400 mt-2">
                      Triggered {new Date(d.triggeredAt).toLocaleDateString()}
                      {d.completedAt && ` · Completed ${new Date(d.completedAt).toLocaleDateString()}`}
                    </p>
                  </div>
                  {d.status !== 'approved' && (
                    <div className="flex gap-2 shrink-0">
                      <span className="inline-flex items-center gap-1 text-xs text-gray-500"><Clock className="h-3 w-3" /> Review needed</span>
                    </div>
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
