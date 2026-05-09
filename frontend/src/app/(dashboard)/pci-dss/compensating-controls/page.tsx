'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import {
  ShieldCheck, Plus, Pencil, Trash2, X, CheckCircle2, Clock, AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Types ─────────────────────────────────────────────────────────────────────

interface CompensatingControl {
  id: string;
  title: string;
  pciRequirement: string;
  originalRequirement: string;
  legitimateConstraint: string;
  riskObjective: string;
  compensatingControlDescription: string;
  additionalRisk: string;
  riskMitigation: string;
  effectiveness: string;
  reviewFrequency: 'annual' | 'semi_annual' | 'quarterly' | 'monthly';
  approvedBy: string;
  approvedDate: string;
  expiryDate: string;
  qsaAccepted: boolean;
  qsaName: string;
  status: 'active' | 'pending_approval' | 'expired' | 'retired';
  notes: string;
}

const STATUS_CFG: Record<string, { label: string; cls: string; icon: any }> = {
  active:           { label: 'Active',            cls: 'bg-green-100 text-green-700',  icon: CheckCircle2 },
  pending_approval: { label: 'Pending Approval',  cls: 'bg-amber-100 text-amber-700',  icon: Clock },
  expired:          { label: 'Expired',           cls: 'bg-red-100 text-red-700',      icon: AlertTriangle },
  retired:          { label: 'Retired',           cls: 'bg-gray-100 text-gray-500',    icon: X },
};

const EMPTY: Partial<CompensatingControl> = {
  title: '', pciRequirement: '', originalRequirement: '',
  legitimateConstraint: '', riskObjective: '',
  compensatingControlDescription: '', additionalRisk: '',
  riskMitigation: '', effectiveness: '',
  reviewFrequency: 'annual', approvedBy: '',
  approvedDate: '', expiryDate: '',
  qsaAccepted: false, qsaName: '',
  status: 'pending_approval', notes: '',
};

// ── Page ─────────────────────────────────────────────────────────────────────

export default function PciCompensatingControlsPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<CompensatingControl | null>(null);
  const [form, setForm] = useState<Partial<CompensatingControl>>(EMPTY);

  const { data: controls = [], isLoading } = useQuery<CompensatingControl[]>({
    queryKey: ['pci-compensating-controls'],
    queryFn: async () => {
      const { data } = await apiClient.get('/pci-dss/compensating-controls');
      return data?.data ?? data ?? [];
    },
  });

  const save = useMutation({
    mutationFn: async (p: Partial<CompensatingControl>) => {
      if (editing) await apiClient.put(`/pci-dss/compensating-controls/${editing.id}`, p);
      else await apiClient.post('/pci-dss/compensating-controls', p);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['pci-compensating-controls'] }); closeForm(); },
  });

  const remove = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/pci-dss/compensating-controls/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pci-compensating-controls'] }),
  });

  function openNew() { setForm(EMPTY); setEditing(null); setShowForm(true); }
  function openEdit(c: CompensatingControl) { setForm(c); setEditing(c); setShowForm(true); }
  function closeForm() { setShowForm(false); setEditing(null); setForm(EMPTY); }

  const active   = controls.filter(c => c.status === 'active').length;
  const expiring = controls.filter(c => {
    const d = c.expiryDate ? Math.ceil((new Date(c.expiryDate).getTime() - Date.now()) / 86400000) : null;
    return d !== null && d >= 0 && d <= 90 && c.status === 'active';
  }).length;
  const expired  = controls.filter(c => c.status === 'expired').length;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Compensating Controls</h1>
          <p className="text-sm text-gray-500 mt-1">PCI DSS Appendix B — Documented workarounds for non-compliant requirements</p>
        </div>
        <button onClick={openNew} className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700 transition-colors">
          <Plus className="h-4 w-4" /> Add Control
        </button>
      </div>

      {/* Info banner */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
        <ShieldCheck className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="text-xs text-amber-800">
          <p className="font-semibold mb-0.5">About Compensating Controls</p>
          <p>Compensating controls may be considered for any PCI DSS requirement when an entity cannot technically meet a requirement due to a legitimate technical or documented business constraint, provided sufficient risk mitigation is achieved. All compensating controls must be reviewed annually and approved by a QSA.</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total',           value: controls.length, cls: 'text-gray-700' },
          { label: 'Active',          value: active,          cls: 'text-green-600' },
          { label: 'Expiring ≤90d',   value: expiring,        cls: 'text-amber-600' },
          { label: 'Expired',         value: expired,         cls: 'text-red-600' },
        ].map(({ label, value, cls }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
            <p className="text-xs text-gray-500 mb-1">{label}</p>
            <p className={cn('text-3xl font-bold', cls)}>{isLoading ? '—' : value}</p>
          </div>
        ))}
      </div>

      {/* Cards */}
      {isLoading ? (
        <div className="text-center py-8 text-gray-400">Loading…</div>
      ) : controls.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-8 text-center shadow-sm">
          <ShieldCheck className="h-8 w-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500">No compensating controls documented yet.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {controls.map((c) => {
            const { label, cls, icon: Icon } = STATUS_CFG[c.status] ?? STATUS_CFG['active'];
            return (
              <div key={c.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-start gap-2">
                    <span className="text-xs font-mono font-bold text-amber-700 bg-amber-50 px-2 py-1 rounded mt-0.5 shrink-0">
                      Req {c.pciRequirement}
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{c.title}</p>
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{c.compensatingControlDescription}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full inline-flex items-center gap-1', cls)}>
                      <Icon className="h-3 w-3" />{label}
                    </span>
                    <button onClick={() => openEdit(c)} className="p-1.5 text-gray-400 hover:text-gray-700 rounded"><Pencil className="h-3.5 w-3.5" /></button>
                    <button onClick={() => remove.mutate(c.id)} className="p-1.5 text-gray-400 hover:text-red-600 rounded"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs text-gray-500">
                  <div><span className="text-gray-700 font-medium">QSA Accepted:</span> {c.qsaAccepted ? `Yes — ${c.qsaName}` : 'No'}</div>
                  <div><span className="text-gray-700 font-medium">Approved:</span> {c.approvedDate || '—'}</div>
                  <div><span className="text-gray-700 font-medium">Expires:</span> {c.expiryDate || '—'}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-base font-semibold text-gray-900">{editing ? 'Edit Compensating Control' : 'Add Compensating Control'}</h2>
              <button onClick={closeForm} className="text-gray-400 hover:text-gray-700"><X className="h-5 w-5" /></button>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">Control Title *</label>
                <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                  value={form.title ?? ''} onChange={e => setForm((f: any) => ({ ...f, title: e.target.value }))}
                  placeholder="e.g. Network monitoring compensates for patch management delay" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-gray-700 mb-1 block">PCI Requirement Number</label>
                  <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                    value={form.pciRequirement ?? ''} onChange={e => setForm((f: any) => ({ ...f, pciRequirement: e.target.value }))}
                    placeholder="e.g. 6.3.3" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 mb-1 block">Status</label>
                  <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                    value={form.status ?? 'pending_approval'} onChange={e => setForm((f: any) => ({ ...f, status: e.target.value }))}>
                    <option value="pending_approval">Pending Approval</option>
                    <option value="active">Active</option>
                    <option value="expired">Expired</option>
                    <option value="retired">Retired</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">Legitimate Constraint (why you can't meet the requirement)</label>
                <textarea className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none" rows={2}
                  value={form.legitimateConstraint ?? ''} onChange={e => setForm((f: any) => ({ ...f, legitimateConstraint: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">Compensating Control Description</label>
                <textarea className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none" rows={3}
                  value={form.compensatingControlDescription ?? ''} onChange={e => setForm((f: any) => ({ ...f, compensatingControlDescription: e.target.value }))}
                  placeholder="Describe the alternative control that achieves equivalent risk mitigation" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">Risk Mitigation (how this achieves equivalent security)</label>
                <textarea className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none" rows={2}
                  value={form.riskMitigation ?? ''} onChange={e => setForm((f: any) => ({ ...f, riskMitigation: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-gray-700 mb-1 block">Approved By</label>
                  <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                    value={form.approvedBy ?? ''} onChange={e => setForm((f: any) => ({ ...f, approvedBy: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 mb-1 block">Approval Date</label>
                  <input type="date" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                    value={form.approvedDate ?? ''} onChange={e => setForm((f: any) => ({ ...f, approvedDate: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-gray-700 mb-1 block">Expiry Date</label>
                  <input type="date" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                    value={form.expiryDate ?? ''} onChange={e => setForm((f: any) => ({ ...f, expiryDate: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 mb-1 block">Review Frequency</label>
                  <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                    value={form.reviewFrequency ?? 'annual'} onChange={e => setForm((f: any) => ({ ...f, reviewFrequency: e.target.value }))}>
                    <option value="annual">Annual</option>
                    <option value="semi_annual">Semi-Annual</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                    <input type="checkbox" className="accent-amber-600"
                      checked={form.qsaAccepted ?? false} onChange={e => setForm((f: any) => ({ ...f, qsaAccepted: e.target.checked }))} />
                    QSA Accepted
                  </label>
                </div>
                {form.qsaAccepted && (
                  <div>
                    <label className="text-xs font-medium text-gray-700 mb-1 block">QSA Name</label>
                    <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                      value={form.qsaName ?? ''} onChange={e => setForm((f: any) => ({ ...f, qsaName: e.target.value }))} />
                  </div>
                )}
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">
              <button onClick={closeForm} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">Cancel</button>
              <button
                onClick={() => save.mutate(form)}
                disabled={save.isPending || !form.title}
                className="px-4 py-2 text-sm bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 transition-colors font-medium"
              >
                {save.isPending ? 'Saving…' : editing ? 'Update' : 'Add Control'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
