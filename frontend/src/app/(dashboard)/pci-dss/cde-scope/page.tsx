'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import {
  Network, Plus, Pencil, Trash2, X, Server, Globe,
  Shield, AlertTriangle, CheckCircle2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Types ─────────────────────────────────────────────────────────────────────

interface CdeSystem {
  id: string;
  name: string;
  systemType: 'cardholder_data_system' | 'connected_system' | 'security_system' | 'out_of_scope';
  ipAddress: string;
  hostname: string;
  operatingSystem: string;
  function: string;
  location: 'cde' | 'dmz' | 'corporate' | 'cloud' | 'vendor';
  storesChd: boolean;
  processesCHD: boolean;
  transmitsCHD: boolean;
  segmented: boolean;
  segmentationMethod: string;
  pciRequirements: string[];
  lastScanDate: string;
  vulnerabilityStatus: 'pass' | 'fail' | 'pending' | 'not_scanned';
  owner: string;
  notes: string;
}

const SCOPE_COLOR: Record<string, string> = {
  cardholder_data_system: 'bg-red-100 text-red-700',
  connected_system:       'bg-orange-100 text-orange-700',
  security_system:        'bg-blue-100 text-blue-700',
  out_of_scope:           'bg-gray-100 text-gray-500',
};

const LOCATION_COLOR: Record<string, string> = {
  cde:       'text-red-600 bg-red-50',
  dmz:       'text-orange-600 bg-orange-50',
  corporate: 'text-blue-600 bg-blue-50',
  cloud:     'text-purple-600 bg-purple-50',
  vendor:    'text-gray-600 bg-gray-50',
};

const SCAN_STATUS: Record<string, { label: string; cls: string }> = {
  pass:       { label: 'Pass',       cls: 'bg-green-100 text-green-700' },
  fail:       { label: 'Fail',       cls: 'bg-red-100 text-red-700' },
  pending:    { label: 'Pending',    cls: 'bg-amber-100 text-amber-700' },
  not_scanned:{ label: 'Not Scanned', cls: 'bg-gray-100 text-gray-500' },
};

const EMPTY: Partial<CdeSystem> = {
  name: '', systemType: 'cardholder_data_system', ipAddress: '', hostname: '',
  operatingSystem: '', function: '', location: 'cde',
  storesChd: false, processesCHD: false, transmitsCHD: false,
  segmented: false, segmentationMethod: '',
  pciRequirements: [], lastScanDate: '',
  vulnerabilityStatus: 'not_scanned', owner: '', notes: '',
};

// ── Page ─────────────────────────────────────────────────────────────────────

export default function PciCdeScopePage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<CdeSystem | null>(null);
  const [form, setForm] = useState<Partial<CdeSystem>>(EMPTY);

  const { data: systems = [], isLoading } = useQuery<CdeSystem[]>({
    queryKey: ['pci-cde-scope'],
    queryFn: async () => {
      const { data } = await apiClient.get('/pci-dss/cde-scope');
      return data?.data ?? data ?? [];
    },
  });

  const save = useMutation({
    mutationFn: async (p: Partial<CdeSystem>) => {
      if (editing) await apiClient.put(`/pci-dss/cde-scope/${editing.id}`, p);
      else await apiClient.post('/pci-dss/cde-scope', p);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['pci-cde-scope'] }); closeForm(); },
  });

  const remove = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/pci-dss/cde-scope/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pci-cde-scope'] }),
  });

  function openNew() { setForm(EMPTY); setEditing(null); setShowForm(true); }
  function openEdit(s: CdeSystem) { setForm(s); setEditing(s); setShowForm(true); }
  function closeForm() { setShowForm(false); setEditing(null); setForm(EMPTY); }

  const inScope   = systems.filter(s => s.systemType !== 'out_of_scope').length;
  const failing   = systems.filter(s => s.vulnerabilityStatus === 'fail').length;
  const segGaps   = systems.filter(s => s.systemType === 'cardholder_data_system' && !s.segmented).length;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">CDE Scope & System Inventory</h1>
          <p className="text-sm text-gray-500 mt-1">PCI DSS Req. 1 & 12 — Cardholder Data Environment definition</p>
        </div>
        <button onClick={openNew} className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700 transition-colors">
          <Plus className="h-4 w-4" /> Add System
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Systems',   value: systems.length, cls: 'text-gray-700' },
          { label: 'In-Scope (CDE)',   value: inScope,        cls: 'text-amber-600' },
          { label: 'Scan Failures',    value: failing,        cls: 'text-red-600' },
          { label: 'Segmentation Gaps',value: segGaps,        cls: 'text-orange-600' },
        ].map(({ label, value, cls }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
            <p className="text-xs text-gray-500 mb-1">{label}</p>
            <p className={cn('text-3xl font-bold', cls)}>{isLoading ? '—' : value}</p>
          </div>
        ))}
      </div>

      {/* Systems table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-gray-900">CDE System Inventory</h2>
            <p className="text-xs text-gray-500 mt-0.5">All systems in or connected to the Cardholder Data Environment</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">System</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Scope</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">Location</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">CHD Functions</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Scan Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading ? (
                <tr><td colSpan={6} className="text-center py-8 text-gray-400">Loading…</td></tr>
              ) : systems.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8">
                    <Network className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">No systems inventoried. Define your CDE scope.</p>
                  </td>
                </tr>
              ) : (
                systems.map((s) => (
                  <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-800">{s.name}</p>
                      <p className="text-xs text-gray-400">{s.ipAddress || s.hostname}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', SCOPE_COLOR[s.systemType])}>
                        {s.systemType.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className={cn('text-xs font-medium px-2 py-0.5 rounded uppercase', LOCATION_COLOR[s.location])}>
                        {s.location}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <div className="flex gap-1">
                        {s.storesChd   && <span className="text-[10px] bg-red-50 text-red-600 px-1.5 py-0.5 rounded">Store</span>}
                        {s.processesCHD && <span className="text-[10px] bg-orange-50 text-orange-600 px-1.5 py-0.5 rounded">Process</span>}
                        {s.transmitsCHD && <span className="text-[10px] bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded">Transmit</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', SCAN_STATUS[s.vulnerabilityStatus]?.cls ?? '')}>
                        {SCAN_STATUS[s.vulnerabilityStatus]?.label ?? s.vulnerabilityStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <button onClick={() => openEdit(s)} className="p-1.5 text-gray-400 hover:text-gray-700 rounded"><Pencil className="h-3.5 w-3.5" /></button>
                        <button onClick={() => remove.mutate(s.id)} className="p-1.5 text-gray-400 hover:text-red-600 rounded"><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-base font-semibold text-gray-900">{editing ? 'Edit System' : 'Add System'}</h2>
              <button onClick={closeForm} className="text-gray-400 hover:text-gray-700"><X className="h-5 w-5" /></button>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">System Name *</label>
                <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                  value={form.name ?? ''} onChange={e => setForm((f: any) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Payment Gateway Server, POS Terminal" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-gray-700 mb-1 block">Scope Classification</label>
                  <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                    value={form.systemType ?? 'cardholder_data_system'} onChange={e => setForm((f: any) => ({ ...f, systemType: e.target.value }))}>
                    <option value="cardholder_data_system">Cardholder Data System</option>
                    <option value="connected_system">Connected System</option>
                    <option value="security_system">Security System</option>
                    <option value="out_of_scope">Out of Scope</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 mb-1 block">Network Location</label>
                  <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                    value={form.location ?? 'cde'} onChange={e => setForm((f: any) => ({ ...f, location: e.target.value }))}>
                    <option value="cde">CDE Network</option>
                    <option value="dmz">DMZ</option>
                    <option value="corporate">Corporate Network</option>
                    <option value="cloud">Cloud</option>
                    <option value="vendor">Vendor-Hosted</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-gray-700 mb-1 block">IP Address</label>
                  <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                    value={form.ipAddress ?? ''} onChange={e => setForm((f: any) => ({ ...f, ipAddress: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 mb-1 block">Hostname</label>
                  <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                    value={form.hostname ?? ''} onChange={e => setForm((f: any) => ({ ...f, hostname: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">Function / Description</label>
                <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                  value={form.function ?? ''} onChange={e => setForm((f: any) => ({ ...f, function: e.target.value }))}
                  placeholder="What this system does" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 mb-2 block">CHD Functions</label>
                <div className="flex gap-4">
                  {[
                    { key: 'storesChd', label: 'Stores CHD' },
                    { key: 'processesCHD', label: 'Processes CHD' },
                    { key: 'transmitsCHD', label: 'Transmits CHD' },
                  ].map(({ key, label }) => (
                    <label key={key} className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                      <input type="checkbox" className="accent-amber-600"
                        checked={(form as any)[key] ?? false} onChange={e => setForm((f: any) => ({ ...f, [key]: e.target.checked }))} />
                      {label}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer mb-2">
                  <input type="checkbox" className="accent-amber-600"
                    checked={form.segmented ?? false} onChange={e => setForm((f: any) => ({ ...f, segmented: e.target.checked }))} />
                  Network segmentation applied
                </label>
                {form.segmented && (
                  <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                    value={form.segmentationMethod ?? ''} onChange={e => setForm((f: any) => ({ ...f, segmentationMethod: e.target.value }))}
                    placeholder="Segmentation method (e.g. VLAN, firewall rules)" />
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-gray-700 mb-1 block">Vulnerability Scan Status</label>
                  <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                    value={form.vulnerabilityStatus ?? 'not_scanned'} onChange={e => setForm((f: any) => ({ ...f, vulnerabilityStatus: e.target.value }))}>
                    <option value="pass">Pass</option>
                    <option value="fail">Fail</option>
                    <option value="pending">Pending</option>
                    <option value="not_scanned">Not Scanned</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 mb-1 block">Last Scan Date</label>
                  <input type="date" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                    value={form.lastScanDate ?? ''} onChange={e => setForm((f: any) => ({ ...f, lastScanDate: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">System Owner</label>
                <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                  value={form.owner ?? ''} onChange={e => setForm((f: any) => ({ ...f, owner: e.target.value }))} />
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">
              <button onClick={closeForm} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">Cancel</button>
              <button
                onClick={() => save.mutate(form)}
                disabled={save.isPending || !form.name}
                className="px-4 py-2 text-sm bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 transition-colors font-medium"
              >
                {save.isPending ? 'Saving…' : editing ? 'Update System' : 'Add System'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
