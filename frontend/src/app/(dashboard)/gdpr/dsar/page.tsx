'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Inbox, Plus, Clock, CheckCircle, AlertCircle, XCircle } from 'lucide-react';
import { apiClient } from '@/lib/api/client';

interface DataSubjectRequest {
  id: string;
  type: string;
  status: string;
  requestorEmail: string;
  description?: string;
  assignedTo?: string;
  receivedAt: string;
  dueAt: string;
  completedAt?: string;
}

const TYPE_LABELS: Record<string, string> = {
  access: 'Access', erasure: 'Erasure', portability: 'Portability',
  rectification: 'Rectification', objection: 'Objection', restriction: 'Restriction',
};

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  received:    { label: 'Received',    color: 'bg-blue-100 text-blue-700',   icon: Inbox },
  in_progress: { label: 'In Progress', color: 'bg-amber-100 text-amber-700',  icon: Clock },
  completed:   { label: 'Completed',   color: 'bg-green-100 text-green-700',  icon: CheckCircle },
  rejected:    { label: 'Rejected',    color: 'bg-red-100 text-red-700',      icon: XCircle },
};

function daysLeft(dueAt: string) {
  return Math.ceil((new Date(dueAt).getTime() - Date.now()) / 86400000);
}

export default function DsarPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [form, setForm] = useState({ type: 'access', requestorEmail: '', description: '' });

  const { data: dsars = [], isLoading } = useQuery<DataSubjectRequest[]>({
    queryKey: ['gdpr-dsars', statusFilter],
    queryFn: () => apiClient.get('/gdpr/dsars', { params: statusFilter ? { status: statusFilter } : {} }).then(r => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (dto: any) => apiClient.post('/gdpr/dsars', dto).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['gdpr-dsars'] });
      setShowForm(false);
      setForm({ type: 'access', requestorEmail: '', description: '' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => apiClient.patch(`/gdpr/dsars/${id}`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['gdpr-dsars'] }),
  });

  const overdue = dsars.filter(d => !['completed','rejected'].includes(d.status) && daysLeft(d.dueAt) <= 0).length;
  const dueSoon = dsars.filter(d => !['completed','rejected'].includes(d.status) && daysLeft(d.dueAt) > 0 && daysLeft(d.dueAt) <= 5).length;
  const open = dsars.filter(d => !['completed','rejected'].includes(d.status)).length;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-start gap-4">
          <div className="w-11 h-11 rounded-xl bg-violet-100 flex items-center justify-center shrink-0">
            <Inbox className="h-5 w-5 text-violet-700" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">DSAR Queue</h1>
            <p className="text-sm text-gray-500 mt-0.5">GDPR Art. 15–22 — 30-day response SLA</p>
          </div>
        </div>
        <button onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 text-white text-sm font-medium hover:bg-violet-700 transition-colors">
          <Plus className="h-4 w-4" /> Log Request
        </button>
      </div>

      {overdue > 0 && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-red-500 shrink-0" />
          <p className="text-sm text-red-700 font-medium">{overdue} overdue DSAR{overdue !== 1 ? 's' : ''} — 30-day deadline exceeded. Immediate action required.</p>
        </div>
      )}
      {dueSoon > 0 && overdue === 0 && (
        <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3">
          <Clock className="h-5 w-5 text-amber-500 shrink-0" />
          <p className="text-sm text-amber-700">{dueSoon} request{dueSoon !== 1 ? 's' : ''} due within 5 days</p>
        </div>
      )}

      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Open', value: open },
          { label: 'Overdue', value: overdue, alert: overdue > 0 },
          { label: 'Due Soon', value: dueSoon, warn: dueSoon > 0 },
          { label: 'Total', value: dsars.length },
        ].map(({ label, value, alert, warn }) => (
          <div key={label} className="bg-white border border-gray-200 rounded-xl p-4">
            <div className={`text-2xl font-bold ${alert ? 'text-red-600' : warn ? 'text-amber-600' : 'text-gray-900'}`}>{value}</div>
            <div className="text-sm text-gray-500">{label}</div>
          </div>
        ))}
      </div>

      <div className="flex gap-2 mb-4">
        {['', 'received', 'in_progress', 'completed', 'rejected'].map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${statusFilter === s ? 'bg-violet-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            {s === '' ? 'All' : (STATUS_CONFIG[s]?.label ?? s)}
          </button>
        ))}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
            <div className="p-6 border-b border-gray-100"><h2 className="text-lg font-semibold">Log Data Subject Request</h2></div>
            <form onSubmit={e => { e.preventDefault(); createMutation.mutate(form); }} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Request Type *</label>
                <select required value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500">
                  {Object.entries(TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Requestor Email *</label>
                <input required type="email" value={form.requestorEmail} onChange={e => setForm(f => ({ ...f, requestorEmail: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
              </div>
              <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg">Cancel</button>
                <button type="submit" disabled={createMutation.isPending} className="px-4 py-2 text-sm font-medium text-white bg-violet-600 hover:bg-violet-700 rounded-lg disabled:opacity-50">
                  {createMutation.isPending ? 'Logging…' : 'Log Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-violet-600 border-t-transparent rounded-full animate-spin" /></div>
      ) : dsars.length === 0 ? (
        <div className="text-center py-16 bg-white border border-dashed border-gray-200 rounded-2xl">
          <Inbox className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No requests yet</p>
          <p className="text-sm text-gray-400 mt-1">Log a data subject request to start tracking 30-day SLAs</p>
        </div>
      ) : (
        <div className="space-y-3">
          {dsars.map(d => {
            const days = daysLeft(d.dueAt);
            const isOpen = !['completed', 'rejected'].includes(d.status);
            const cfg = STATUS_CONFIG[d.status] ?? { label: d.status, color: 'bg-gray-100 text-gray-700', icon: Clock };
            const StatusIcon = cfg.icon;
            return (
              <div key={d.id} className={`bg-white border rounded-xl p-5 ${isOpen && days <= 0 ? 'border-red-300' : isOpen && days <= 5 ? 'border-amber-300' : 'border-gray-200'}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-semibold text-gray-900">{TYPE_LABELS[d.type] ?? d.type} Request</span>
                      <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${cfg.color}`}>
                        <StatusIcon className="h-3 w-3" /> {cfg.label}
                      </span>
                      {isOpen && (
                        <span className={`text-xs font-medium ${days <= 0 ? 'text-red-600' : days <= 5 ? 'text-amber-600' : 'text-gray-500'}`}>
                          {days <= 0 ? `${Math.abs(days)}d overdue` : `${days}d left`}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500">{d.requestorEmail}</p>
                    {d.description && <p className="text-xs text-gray-400 mt-1 truncate">{d.description}</p>}
                    <p className="text-xs text-gray-400 mt-2">Received {new Date(d.receivedAt).toLocaleDateString()} · Due {new Date(d.dueAt).toLocaleDateString()}</p>
                  </div>
                  {isOpen && (
                    <div className="flex gap-2 shrink-0">
                      {d.status === 'received' && (
                        <button onClick={() => updateMutation.mutate({ id: d.id, data: { status: 'in_progress' } })}
                          className="px-3 py-1 text-xs font-medium text-amber-700 bg-amber-100 hover:bg-amber-200 rounded-lg">
                          Start
                        </button>
                      )}
                      <button onClick={() => updateMutation.mutate({ id: d.id, data: { status: 'completed', completedAt: new Date().toISOString() } })}
                        className="px-3 py-1 text-xs font-medium text-green-700 bg-green-100 hover:bg-green-200 rounded-lg">
                        Complete
                      </button>
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
