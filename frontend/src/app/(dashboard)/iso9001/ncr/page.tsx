'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Plus, CheckCircle, Clock } from 'lucide-react';
import { apiClient } from '@/lib/api/client';

interface Nonconformity {
  id: string;
  title: string;
  description: string;
  source: string;
  severity: string;
  status: string;
  detectedAt: string;
  containedAt?: string;
  closedAt?: string;
  rootCause?: string;
}

const SEVERITY_COLORS: Record<string, string> = {
  major:       'bg-red-100 text-red-700',
  minor:       'bg-amber-100 text-amber-700',
  observation: 'bg-blue-100 text-blue-700',
  opportunity: 'bg-green-100 text-green-700',
};

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  open:            { label: 'Open',            color: 'bg-red-100 text-red-700' },
  investigating:   { label: 'Investigating',   color: 'bg-amber-100 text-amber-700' },
  contained:       { label: 'Contained',       color: 'bg-blue-100 text-blue-700' },
  pending_capa:    { label: 'Pending CAPA',    color: 'bg-purple-100 text-purple-700' },
  closed:          { label: 'Closed',          color: 'bg-green-100 text-green-700' },
};

function ageDays(detectedAt: string) {
  return Math.floor((Date.now() - new Date(detectedAt).getTime()) / 86400000);
}

export default function NcrPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', source: 'internal_audit', severity: 'minor' });

  const { data: ncrs = [], isLoading } = useQuery<Nonconformity[]>({
    queryKey: ['quality-ncrs'],
    queryFn: () => apiClient.get('/quality/ncrs').then(r => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (dto: any) => apiClient.post('/quality/ncrs', dto).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['quality-ncrs'] }); setShowForm(false); setForm({ title: '', description: '', source: 'internal_audit', severity: 'minor' }); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => apiClient.patch(`/quality/ncrs/${id}`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['quality-ncrs'] }),
  });

  const open = ncrs.filter(n => n.status !== 'closed');
  const majorOpen = open.filter(n => n.severity === 'major');
  const old30 = open.filter(n => ageDays(n.detectedAt) > 30);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-start gap-4">
          <div className="w-11 h-11 rounded-xl bg-teal-100 flex items-center justify-center shrink-0">
            <AlertTriangle className="h-5 w-5 text-teal-700" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">NCR Tracker</h1>
            <p className="text-sm text-gray-500 mt-0.5">ISO 9001 Clause 10.2 — Nonconformity and corrective action</p>
          </div>
        </div>
        <button onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-teal-600 text-white text-sm font-medium hover:bg-teal-700 transition-colors">
          <Plus className="h-4 w-4" /> Log NCR
        </button>
      </div>

      {majorOpen.length > 0 && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-red-500 shrink-0" />
          <p className="text-sm text-red-700 font-medium">{majorOpen.length} major NCR{majorOpen.length !== 1 ? 's' : ''} open — Major nonconformities block certification</p>
        </div>
      )}

      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Open', value: open.length, alert: open.length > 0 && open.length > 5 },
          { label: 'Major', value: majorOpen.length, alert: majorOpen.length > 0 },
          { label: '>30 days', value: old30.length, warn: old30.length > 0 },
          { label: 'Total', value: ncrs.length },
        ].map(({ label, value, alert, warn }) => (
          <div key={label} className="bg-white border border-gray-200 rounded-xl p-4">
            <div className={`text-2xl font-bold ${alert ? 'text-red-600' : warn ? 'text-amber-600' : 'text-gray-900'}`}>{value}</div>
            <div className="text-sm text-gray-500">{label}</div>
          </div>
        ))}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
            <div className="p-6 border-b border-gray-100"><h2 className="text-lg font-semibold">Log Nonconformity</h2></div>
            <form onSubmit={e => { e.preventDefault(); createMutation.mutate(form); }} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                <input required value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Source *</label>
                  <select required value={form.source} onChange={e => setForm(f => ({ ...f, source: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500">
                    {['internal_audit','external_audit','customer','supplier','process','product','other'].map(s => (
                      <option key={s} value={s}>{s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Severity *</label>
                  <select required value={form.severity} onChange={e => setForm(f => ({ ...f, severity: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500">
                    {['major','minor','observation','opportunity'].map(s => (
                      <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description *</label>
                <textarea required rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
              </div>
              <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg">Cancel</button>
                <button type="submit" disabled={createMutation.isPending} className="px-4 py-2 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-lg disabled:opacity-50">
                  {createMutation.isPending ? 'Logging…' : 'Log NCR'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" /></div>
      ) : ncrs.length === 0 ? (
        <div className="text-center py-16 bg-white border border-dashed border-gray-200 rounded-2xl">
          <AlertTriangle className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No nonconformities logged</p>
          <p className="text-sm text-gray-400 mt-1">Track quality issues, audit findings, and improvement opportunities</p>
        </div>
      ) : (
        <div className="space-y-3">
          {ncrs.map(n => {
            const age = ageDays(n.detectedAt);
            const isOpen = n.status !== 'closed';
            const cfg = STATUS_CONFIG[n.status] ?? { label: n.status, color: 'bg-gray-100 text-gray-700' };
            return (
              <div key={n.id} className={`bg-white border rounded-xl p-5 ${isOpen && age > 60 ? 'border-red-300' : isOpen && age > 30 ? 'border-amber-300' : 'border-gray-200'}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-semibold text-gray-900">{n.title}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${SEVERITY_COLORS[n.severity] ?? 'bg-gray-100 text-gray-700'}`}>{n.severity.toUpperCase()}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.color}`}>{cfg.label}</span>
                      <span className={`text-xs ${age > 30 ? 'text-amber-600' : 'text-gray-400'}`}>{age}d old</span>
                    </div>
                    <p className="text-sm text-gray-600">{n.description}</p>
                    {n.rootCause && <p className="text-xs text-gray-500 mt-1">Root cause: {n.rootCause}</p>}
                    <p className="text-xs text-gray-400 mt-1">Source: {n.source.replace(/_/g, ' ')} · Detected {new Date(n.detectedAt).toLocaleDateString()}</p>
                  </div>
                  {isOpen && (
                    <div className="flex gap-2 shrink-0 flex-col items-end">
                      {n.status === 'open' && (
                        <button onClick={() => updateMutation.mutate({ id: n.id, data: { status: 'investigating' } })}
                          className="px-3 py-1 text-xs font-medium text-amber-700 bg-amber-100 hover:bg-amber-200 rounded-lg">
                          Investigate
                        </button>
                      )}
                      <button onClick={() => updateMutation.mutate({ id: n.id, data: { status: 'closed', closedAt: new Date().toISOString() } })}
                        className="px-3 py-1 text-xs font-medium text-green-700 bg-green-100 hover:bg-green-200 rounded-lg flex items-center gap-1">
                        <CheckCircle className="h-3 w-3" /> Close
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
