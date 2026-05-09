'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import {
  FileText, Plus, Pencil, Trash2, X, AlertTriangle, CheckCircle2, Clock,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Baa {
  id: string;
  associateName: string;
  associateType: 'business_associate' | 'subcontractor';
  services: string;
  phiTypesShared: string;
  executionDate: string;
  expirationDate: string;
  renewalDate: string;
  status: 'active' | 'expired' | 'pending_signature' | 'terminated';
  signatoryName: string;
  signatoryTitle: string;
  documentRef: string;
  notes: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_CFG: Record<string, { label: string; cls: string; icon: any }> = {
  active:             { label: 'Active',            cls: 'bg-green-100 text-green-700',  icon: CheckCircle2 },
  expired:            { label: 'Expired',           cls: 'bg-red-100 text-red-700',      icon: AlertTriangle },
  pending_signature:  { label: 'Pending Signature', cls: 'bg-amber-100 text-amber-700',  icon: Clock },
  terminated:         { label: 'Terminated',        cls: 'bg-gray-100 text-gray-500',    icon: X },
};

function daysUntil(dateStr: string) {
  if (!dateStr) return null;
  const diff = Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
  return diff;
}

const EMPTY: Partial<Baa> = {
  associateName: '', associateType: 'business_associate',
  services: '', phiTypesShared: '',
  executionDate: '', expirationDate: '', renewalDate: '',
  status: 'active', signatoryName: '', signatoryTitle: '',
  documentRef: '', notes: '',
};

// ── Page ─────────────────────────────────────────────────────────────────────

export default function HipaaBaaTrackerPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Baa | null>(null);
  const [form, setForm] = useState<Partial<Baa>>(EMPTY);
  const [filter, setFilter] = useState<string>('all');

  const { data: baas = [], isLoading } = useQuery<Baa[]>({
    queryKey: ['hipaa-baa'],
    queryFn: async () => {
      const { data } = await apiClient.get('/hipaa/baa');
      return data?.data ?? data ?? [];
    },
  });

  const save = useMutation({
    mutationFn: async (p: Partial<Baa>) => {
      if (editing) await apiClient.put(`/hipaa/baa/${editing.id}`, p);
      else await apiClient.post('/hipaa/baa', p);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['hipaa-baa'] }); closeForm(); },
  });

  const remove = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/hipaa/baa/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hipaa-baa'] }),
  });

  function openNew() { setForm(EMPTY); setEditing(null); setShowForm(true); }
  function openEdit(b: Baa) { setForm(b); setEditing(b); setShowForm(true); }
  function closeForm() { setShowForm(false); setEditing(null); setForm(EMPTY); }

  const filtered = filter === 'all' ? baas : baas.filter(b => b.status === filter);
  const active   = baas.filter(b => b.status === 'active').length;
  const expiring = baas.filter(b => { const d = daysUntil(b.expirationDate); return d !== null && d >= 0 && d <= 90; }).length;
  const expired  = baas.filter(b => b.status === 'expired').length;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">BAA Tracker</h1>
          <p className="text-sm text-gray-500 mt-1">§164.308(b) & §164.314 — Business Associate Agreements</p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-2 px-4 py-2 bg-rose-600 text-white text-sm font-medium rounded-lg hover:bg-rose-700 transition-colors"
        >
          <Plus className="h-4 w-4" /> Add BAA
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total BAAs',     value: baas.length, cls: 'text-gray-700' },
          { label: 'Active',         value: active,      cls: 'text-green-600' },
          { label: 'Expiring ≤90d',  value: expiring,    cls: 'text-amber-600' },
          { label: 'Expired',        value: expired,     cls: 'text-red-600' },
        ].map(({ label, value, cls }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
            <p className="text-xs text-gray-500 mb-1">{label}</p>
            <p className={cn('text-3xl font-bold', cls)}>{isLoading ? '—' : value}</p>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {['all', 'active', 'pending_signature', 'expired', 'terminated'].map(s => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={cn(
              'px-3 py-1.5 text-xs font-medium rounded-lg transition-colors',
              filter === s ? 'bg-rose-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50',
            )}
          >
            {s === 'all' ? 'All' : STATUS_CFG[s]?.label ?? s}
            {s !== 'all' && (
              <span className="ml-1.5 text-[10px] opacity-75">
                {baas.filter(b => b.status === s).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Associate</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden sm:table-cell">Services</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">Executed</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Expires</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {isLoading ? (
              <tr><td colSpan={6} className="text-center py-8 text-gray-400">Loading…</td></tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-8">
                  <FileText className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">No BAAs found.</p>
                </td>
              </tr>
            ) : (
              filtered.map((b) => {
                const { label, cls, icon: Icon } = STATUS_CFG[b.status] ?? STATUS_CFG['active'];
                const days = daysUntil(b.expirationDate);
                const expCls = days !== null && days <= 30 && b.status === 'active' ? 'text-red-600 font-semibold' :
                               days !== null && days <= 90 && b.status === 'active' ? 'text-amber-600 font-semibold' : 'text-gray-600';
                return (
                  <tr key={b.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-800">{b.associateName}</p>
                      <p className="text-xs text-gray-400">{b.associateType.replace('_', ' ')}</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600 hidden sm:table-cell max-w-[200px] truncate">{b.services}</td>
                    <td className="px-4 py-3 text-xs text-gray-500 hidden md:table-cell">{b.executionDate || '—'}</td>
                    <td className="px-4 py-3 text-xs">
                      <span className={expCls}>{b.expirationDate || '—'}</span>
                      {days !== null && days >= 0 && days <= 90 && b.status === 'active' && (
                        <span className="block text-[10px] text-amber-600">{days}d remaining</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full', cls)}>
                        <Icon className="h-3 w-3" />{label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <button onClick={() => openEdit(b)} className="p-1.5 text-gray-400 hover:text-gray-700 rounded">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => remove.mutate(b.id)} className="p-1.5 text-gray-400 hover:text-red-600 rounded">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-base font-semibold text-gray-900">{editing ? 'Edit BAA' : 'Add BAA'}</h2>
              <button onClick={closeForm} className="text-gray-400 hover:text-gray-700"><X className="h-5 w-5" /></button>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">Business Associate Name *</label>
                <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                  value={form.associateName ?? ''} onChange={e => setForm((f: any) => ({ ...f, associateName: e.target.value }))}
                  placeholder="e.g. Acme Health Analytics Inc." />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-gray-700 mb-1 block">Type</label>
                  <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                    value={form.associateType ?? 'business_associate'} onChange={e => setForm((f: any) => ({ ...f, associateType: e.target.value }))}>
                    <option value="business_associate">Business Associate</option>
                    <option value="subcontractor">Subcontractor</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 mb-1 block">Status</label>
                  <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                    value={form.status ?? 'active'} onChange={e => setForm((f: any) => ({ ...f, status: e.target.value }))}>
                    <option value="active">Active</option>
                    <option value="pending_signature">Pending Signature</option>
                    <option value="expired">Expired</option>
                    <option value="terminated">Terminated</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">Services Provided</label>
                <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                  value={form.services ?? ''} onChange={e => setForm((f: any) => ({ ...f, services: e.target.value }))}
                  placeholder="e.g. EHR cloud hosting, medical billing" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">PHI Types Shared</label>
                <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                  value={form.phiTypesShared ?? ''} onChange={e => setForm((f: any) => ({ ...f, phiTypesShared: e.target.value }))}
                  placeholder="e.g. Demographics, diagnoses, lab results" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-700 mb-1 block">Execution Date</label>
                  <input type="date" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                    value={form.executionDate ?? ''} onChange={e => setForm((f: any) => ({ ...f, executionDate: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 mb-1 block">Expiration Date</label>
                  <input type="date" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                    value={form.expirationDate ?? ''} onChange={e => setForm((f: any) => ({ ...f, expirationDate: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 mb-1 block">Renewal Date</label>
                  <input type="date" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                    value={form.renewalDate ?? ''} onChange={e => setForm((f: any) => ({ ...f, renewalDate: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-gray-700 mb-1 block">Signatory Name</label>
                  <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                    value={form.signatoryName ?? ''} onChange={e => setForm((f: any) => ({ ...f, signatoryName: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 mb-1 block">Signatory Title</label>
                  <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                    value={form.signatoryTitle ?? ''} onChange={e => setForm((f: any) => ({ ...f, signatoryTitle: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">Document Reference</label>
                <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                  value={form.documentRef ?? ''} onChange={e => setForm((f: any) => ({ ...f, documentRef: e.target.value }))}
                  placeholder="e.g. BAA-2024-001, SharePoint link" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">Notes</label>
                <textarea className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 resize-none" rows={2}
                  value={form.notes ?? ''} onChange={e => setForm((f: any) => ({ ...f, notes: e.target.value }))} />
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">
              <button onClick={closeForm} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">Cancel</button>
              <button
                onClick={() => save.mutate(form)}
                disabled={save.isPending || !form.associateName}
                className="px-4 py-2 text-sm bg-rose-600 text-white rounded-lg hover:bg-rose-700 disabled:opacity-50 transition-colors font-medium"
              >
                {save.isPending ? 'Saving…' : editing ? 'Update BAA' : 'Add BAA'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
