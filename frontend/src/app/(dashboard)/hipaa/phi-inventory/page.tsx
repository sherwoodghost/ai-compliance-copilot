'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import {
  ShieldCheck, Plus, Pencil, Trash2, X, Database, Server, Globe,
  Lock, AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Types ─────────────────────────────────────────────────────────────────────

interface PhiAsset {
  id: string;
  assetName: string;
  assetType: 'system' | 'database' | 'application' | 'file_share' | 'physical' | 'cloud_service';
  description: string;
  phiElements: string[];
  location: string;
  hosting: 'on_premises' | 'cloud' | 'hybrid' | 'vendor';
  cloudProvider: string;
  dataFlowIn: string;
  dataFlowOut: string;
  retentionPeriod: string;
  encryptionAtRest: boolean;
  encryptionInTransit: boolean;
  accessControls: string;
  backupExists: boolean;
  owner: string;
  riskLevel: 'critical' | 'high' | 'medium' | 'low';
  lastReviewed: string;
  notes: string;
}

const PHI_ELEMENTS = [
  'Name', 'Address', 'Dates (except year)', 'Phone numbers', 'Fax numbers',
  'Email addresses', 'SSN', 'Medical record numbers', 'Health plan beneficiary numbers',
  'Account numbers', 'Certificate/license numbers', 'VINs', 'Device identifiers',
  'URLs', 'IP addresses', 'Biometric identifiers', 'Full-face photographs',
  'Diagnosis codes', 'Treatment information', 'Prescription data',
];

const ASSET_TYPE_ICON: Record<string, any> = {
  system: Server, database: Database, application: Globe,
  file_share: ShieldCheck, physical: Lock, cloud_service: Globe,
};

const RISK_CFG: Record<string, string> = {
  critical: 'bg-red-100 text-red-700',
  high:     'bg-orange-100 text-orange-700',
  medium:   'bg-amber-100 text-amber-700',
  low:      'bg-green-100 text-green-700',
};

const EMPTY: Partial<PhiAsset> = {
  assetName: '', assetType: 'system', description: '',
  phiElements: [], location: '', hosting: 'on_premises', cloudProvider: '',
  dataFlowIn: '', dataFlowOut: '', retentionPeriod: '',
  encryptionAtRest: false, encryptionInTransit: false,
  accessControls: '', backupExists: false,
  owner: '', riskLevel: 'medium', lastReviewed: '', notes: '',
};

// ── Page ─────────────────────────────────────────────────────────────────────

export default function HipaaPhiInventoryPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<PhiAsset | null>(null);
  const [form, setForm] = useState<Partial<PhiAsset>>(EMPTY);

  const { data: assets = [], isLoading } = useQuery<PhiAsset[]>({
    queryKey: ['hipaa-phi-inventory'],
    queryFn: async () => {
      const { data } = await apiClient.get('/hipaa/phi-inventory');
      return data?.data ?? data ?? [];
    },
  });

  const save = useMutation({
    mutationFn: async (p: Partial<PhiAsset>) => {
      if (editing) await apiClient.put(`/hipaa/phi-inventory/${editing.id}`, p);
      else await apiClient.post('/hipaa/phi-inventory', p);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['hipaa-phi-inventory'] }); closeForm(); },
  });

  const remove = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/hipaa/phi-inventory/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hipaa-phi-inventory'] }),
  });

  function openNew() { setForm(EMPTY); setEditing(null); setShowForm(true); }
  function openEdit(a: PhiAsset) { setForm(a); setEditing(a); setShowForm(true); }
  function closeForm() { setShowForm(false); setEditing(null); setForm(EMPTY); }

  function togglePhiElement(el: string) {
    setForm((f: any) => {
      const arr: string[] = f.phiElements ?? [];
      return { ...f, phiElements: arr.includes(el) ? arr.filter((e: string) => e !== el) : [...arr, el] };
    });
  }

  const encrypted   = assets.filter(a => a.encryptionAtRest && a.encryptionInTransit).length;
  const unencrypted = assets.filter(a => !a.encryptionAtRest || !a.encryptionInTransit).length;
  const critical    = assets.filter(a => a.riskLevel === 'critical').length;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">PHI Inventory</h1>
          <p className="text-sm text-gray-500 mt-1">§164.308(a)(1) — Inventory of ePHI assets and data flows</p>
        </div>
        <button onClick={openNew} className="flex items-center gap-2 px-4 py-2 bg-rose-600 text-white text-sm font-medium rounded-lg hover:bg-rose-700 transition-colors">
          <Plus className="h-4 w-4" /> Add Asset
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'PHI Assets',          value: assets.length,  cls: 'text-gray-700' },
          { label: 'Fully Encrypted',      value: encrypted,      cls: 'text-green-600' },
          { label: 'Encryption Gaps',      value: unencrypted,    cls: 'text-amber-600' },
          { label: 'Critical Risk',        value: critical,       cls: 'text-red-600' },
        ].map(({ label, value, cls }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
            <p className="text-xs text-gray-500 mb-1">{label}</p>
            <p className={cn('text-3xl font-bold', cls)}>{isLoading ? '—' : value}</p>
          </div>
        ))}
      </div>

      {/* Asset cards */}
      {isLoading ? (
        <div className="text-center py-8 text-gray-400">Loading…</div>
      ) : assets.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-8 text-center shadow-sm">
          <Database className="h-8 w-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500">No PHI assets catalogued yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {assets.map((a) => {
            const Icon = ASSET_TYPE_ICON[a.assetType] ?? Server;
            return (
              <div key={a.id} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-rose-50 flex items-center justify-center">
                      <Icon className="w-4 h-4 text-rose-600" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{a.assetName}</p>
                      <p className="text-xs text-gray-400">{a.assetType.replace('_', ' ')} · {a.hosting.replace('_', ' ')}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full capitalize', RISK_CFG[a.riskLevel])}>{a.riskLevel}</span>
                    <button onClick={() => openEdit(a)} className="p-1.5 text-gray-400 hover:text-gray-700 rounded"><Pencil className="h-3.5 w-3.5" /></button>
                    <button onClick={() => remove.mutate(a.id)} className="p-1.5 text-gray-400 hover:text-red-600 rounded"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                </div>

                {/* Encryption indicators */}
                <div className="flex items-center gap-2 mb-2">
                  <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded flex items-center gap-0.5',
                    a.encryptionAtRest ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700')}>
                    {a.encryptionAtRest ? '🔒 At-rest' : '⚠ No at-rest'}
                  </span>
                  <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded flex items-center gap-0.5',
                    a.encryptionInTransit ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700')}>
                    {a.encryptionInTransit ? '🔒 In-transit' : '⚠ No in-transit'}
                  </span>
                </div>

                <p className="text-xs text-gray-500 line-clamp-2">{a.description}</p>

                {a.phiElements.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {a.phiElements.slice(0, 4).map(el => (
                      <span key={el} className="text-[10px] bg-rose-50 text-rose-600 px-1.5 py-0.5 rounded">{el}</span>
                    ))}
                    {a.phiElements.length > 4 && (
                      <span className="text-[10px] text-gray-400">+{a.phiElements.length - 4} more</span>
                    )}
                  </div>
                )}

                <div className="mt-2 text-xs text-gray-400">Owner: {a.owner || '—'} · Last reviewed: {a.lastReviewed || '—'}</div>
              </div>
            );
          })}
        </div>
      )}

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-base font-semibold text-gray-900">{editing ? 'Edit PHI Asset' : 'Add PHI Asset'}</h2>
              <button onClick={closeForm} className="text-gray-400 hover:text-gray-700"><X className="h-5 w-5" /></button>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">Asset Name *</label>
                <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                  value={form.assetName ?? ''} onChange={e => setForm((f: any) => ({ ...f, assetName: e.target.value }))}
                  placeholder="e.g. Patient EHR Database, Lab Results Portal" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-gray-700 mb-1 block">Asset Type</label>
                  <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                    value={form.assetType ?? 'system'} onChange={e => setForm((f: any) => ({ ...f, assetType: e.target.value }))}>
                    <option value="system">System</option>
                    <option value="database">Database</option>
                    <option value="application">Application</option>
                    <option value="file_share">File Share</option>
                    <option value="physical">Physical Records</option>
                    <option value="cloud_service">Cloud Service</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 mb-1 block">Hosting</label>
                  <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                    value={form.hosting ?? 'on_premises'} onChange={e => setForm((f: any) => ({ ...f, hosting: e.target.value }))}>
                    <option value="on_premises">On-Premises</option>
                    <option value="cloud">Cloud</option>
                    <option value="hybrid">Hybrid</option>
                    <option value="vendor">Third-Party Vendor</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">Description</label>
                <textarea className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 resize-none" rows={2}
                  value={form.description ?? ''} onChange={e => setForm((f: any) => ({ ...f, description: e.target.value }))} />
              </div>

              {/* PHI elements multi-select */}
              <div>
                <label className="text-xs font-medium text-gray-700 mb-2 block">PHI Elements Contained (HIPAA §164.514)</label>
                <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-2 border border-gray-200 rounded-lg">
                  {PHI_ELEMENTS.map(el => (
                    <button
                      key={el}
                      type="button"
                      onClick={() => togglePhiElement(el)}
                      className={cn(
                        'text-[10px] px-2 py-1 rounded-full border transition-colors',
                        (form.phiElements ?? []).includes(el)
                          ? 'bg-rose-100 border-rose-300 text-rose-700 font-medium'
                          : 'bg-white border-gray-200 text-gray-500 hover:border-rose-200 hover:text-rose-600',
                      )}
                    >
                      {el}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-gray-700 mb-1 block">Data Flow In</label>
                  <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                    value={form.dataFlowIn ?? ''} onChange={e => setForm((f: any) => ({ ...f, dataFlowIn: e.target.value }))}
                    placeholder="Source systems feeding PHI in" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 mb-1 block">Data Flow Out</label>
                  <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                    value={form.dataFlowOut ?? ''} onChange={e => setForm((f: any) => ({ ...f, dataFlowOut: e.target.value }))}
                    placeholder="Downstream systems receiving PHI" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-gray-700 block">Encryption</label>
                  <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                    <input type="checkbox" className="accent-rose-600"
                      checked={form.encryptionAtRest ?? false} onChange={e => setForm((f: any) => ({ ...f, encryptionAtRest: e.target.checked }))} />
                    Encrypted at rest
                  </label>
                  <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                    <input type="checkbox" className="accent-rose-600"
                      checked={form.encryptionInTransit ?? false} onChange={e => setForm((f: any) => ({ ...f, encryptionInTransit: e.target.checked }))} />
                    Encrypted in transit
                  </label>
                  <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                    <input type="checkbox" className="accent-rose-600"
                      checked={form.backupExists ?? false} onChange={e => setForm((f: any) => ({ ...f, backupExists: e.target.checked }))} />
                    Backup exists
                  </label>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 mb-1 block">Risk Level</label>
                  <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                    value={form.riskLevel ?? 'medium'} onChange={e => setForm((f: any) => ({ ...f, riskLevel: e.target.value }))}>
                    <option value="critical">Critical</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-gray-700 mb-1 block">Data Owner</label>
                  <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                    value={form.owner ?? ''} onChange={e => setForm((f: any) => ({ ...f, owner: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 mb-1 block">Retention Period</label>
                  <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                    value={form.retentionPeriod ?? ''} onChange={e => setForm((f: any) => ({ ...f, retentionPeriod: e.target.value }))}
                    placeholder="e.g. 6 years (HIPAA minimum)" />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">
              <button onClick={closeForm} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">Cancel</button>
              <button
                onClick={() => save.mutate(form)}
                disabled={save.isPending || !form.assetName}
                className="px-4 py-2 text-sm bg-rose-600 text-white rounded-lg hover:bg-rose-700 disabled:opacity-50 transition-colors font-medium"
              >
                {save.isPending ? 'Saving…' : editing ? 'Update Asset' : 'Add Asset'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
