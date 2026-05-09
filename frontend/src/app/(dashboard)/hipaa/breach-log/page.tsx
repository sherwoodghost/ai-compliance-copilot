'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import {
  Activity, Plus, Pencil, Trash2, X, AlertTriangle, CheckCircle2,
  Clock, Bell,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Types ─────────────────────────────────────────────────────────────────────

interface BreachEntry {
  id: string;
  title: string;
  discoveryDate: string;
  occurrenceDate: string;
  breachType: 'unauthorized_access' | 'theft' | 'loss' | 'improper_disposal' | 'hacking' | 'other';
  phiAffected: string;
  individualsAffected: number | null;
  location: string;
  description: string;
  containmentActions: string;
  rootCause: string;
  correctiveActions: string;
  // Notification tracking
  hhsNotifiedDate: string;
  hhsNotificationMethod: string;
  individualNotificationDate: string;
  mediaNotificationRequired: boolean;  // ≥500 in a state/jurisdiction
  mediaNotificationDate: string;
  // Categorization
  safeguardBreached: 'administrative' | 'physical' | 'technical' | 'multiple';
  status: 'investigating' | 'contained' | 'notified' | 'closed';
  assignedTo: string;
  notes: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const BREACH_TYPE_LABELS: Record<string, string> = {
  unauthorized_access: 'Unauthorized Access',
  theft:               'Theft',
  loss:                'Loss',
  improper_disposal:   'Improper Disposal',
  hacking:             'Hacking/IT Incident',
  other:               'Other',
};

const STATUS_CFG: Record<string, { label: string; cls: string; icon: any }> = {
  investigating: { label: 'Investigating', cls: 'bg-amber-100 text-amber-700', icon: Clock },
  contained:     { label: 'Contained',     cls: 'bg-blue-100 text-blue-700',   icon: AlertTriangle },
  notified:      { label: 'Notified',      cls: 'bg-purple-100 text-purple-700', icon: Bell },
  closed:        { label: 'Closed',        cls: 'bg-green-100 text-green-700', icon: CheckCircle2 },
};

function daysSince(dateStr: string) {
  if (!dateStr) return null;
  return Math.ceil((Date.now() - new Date(dateStr).getTime()) / 86400000);
}

const EMPTY: Partial<BreachEntry> = {
  title: '', discoveryDate: '', occurrenceDate: '',
  breachType: 'unauthorized_access', phiAffected: '',
  individualsAffected: null, location: '', description: '',
  containmentActions: '', rootCause: '', correctiveActions: '',
  hhsNotifiedDate: '', hhsNotificationMethod: '',
  individualNotificationDate: '', mediaNotificationRequired: false,
  mediaNotificationDate: '', safeguardBreached: 'technical',
  status: 'investigating', assignedTo: '', notes: '',
};

// ── Page ─────────────────────────────────────────────────────────────────────

export default function HipaaBreachLogPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<BreachEntry | null>(null);
  const [form, setForm] = useState<Partial<BreachEntry>>(EMPTY);

  const { data: breaches = [], isLoading } = useQuery<BreachEntry[]>({
    queryKey: ['hipaa-breach-log'],
    queryFn: async () => {
      const { data } = await apiClient.get('/hipaa/breach-log');
      return data?.data ?? data ?? [];
    },
  });

  const save = useMutation({
    mutationFn: async (p: Partial<BreachEntry>) => {
      if (editing) await apiClient.put(`/hipaa/breach-log/${editing.id}`, p);
      else await apiClient.post('/hipaa/breach-log', p);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['hipaa-breach-log'] }); closeForm(); },
  });

  const remove = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/hipaa/breach-log/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hipaa-breach-log'] }),
  });

  function openNew() { setForm(EMPTY); setEditing(null); setShowForm(true); }
  function openEdit(b: BreachEntry) { setForm(b); setEditing(b); setShowForm(true); }
  function closeForm() { setShowForm(false); setEditing(null); setForm(EMPTY); }

  const open      = breaches.filter(b => b.status !== 'closed').length;
  const unnotified = breaches.filter(b => !b.hhsNotifiedDate && b.status !== 'closed').length;
  const total500Plus = breaches.filter(b => (b.individualsAffected ?? 0) >= 500).length;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Breach Notification Log</h1>
          <p className="text-sm text-gray-500 mt-1">§164.400–414 — Breach discovery, notification tracking, and HHS reporting</p>
        </div>
        <button onClick={openNew} className="flex items-center gap-2 px-4 py-2 bg-rose-600 text-white text-sm font-medium rounded-lg hover:bg-rose-700 transition-colors">
          <Plus className="h-4 w-4" /> Log Breach
        </button>
      </div>

      {/* 60-day notification banner */}
      {unnotified > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-800">HHS Notification Required</p>
            <p className="text-xs text-red-700 mt-0.5">
              {unnotified} breach{unnotified > 1 ? 'es' : ''} pending HHS notification.
              HIPAA requires notification within 60 days of discovery.
            </p>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Breaches',     value: breaches.length, cls: 'text-gray-700' },
          { label: 'Open / Active',      value: open,            cls: 'text-amber-600' },
          { label: 'Pending HHS Notice', value: unnotified,      cls: 'text-red-600' },
          { label: '≥500 Individuals',   value: total500Plus,    cls: 'text-orange-600' },
        ].map(({ label, value, cls }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
            <p className="text-xs text-gray-500 mb-1">{label}</p>
            <p className={cn('text-3xl font-bold', cls)}>{isLoading ? '—' : value}</p>
          </div>
        ))}
      </div>

      {/* Breach list */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-50">
          <h2 className="text-base font-semibold text-gray-900">Breach Register</h2>
        </div>
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Loading…</div>
        ) : breaches.length === 0 ? (
          <div className="p-8 text-center">
            <Activity className="h-8 w-8 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-500">No breaches logged. Maintain this register for all suspected or confirmed incidents.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {breaches.map((b) => {
              const { label, cls, icon: Icon } = STATUS_CFG[b.status] ?? STATUS_CFG['investigating'];
              const daysSinceDiscovery = daysSince(b.discoveryDate);
              const needsHhsNotice = !b.hhsNotifiedDate && b.status !== 'closed';
              const hhsOverdue = needsHhsNotice && daysSinceDiscovery !== null && daysSinceDiscovery > 60;
              return (
                <div key={b.id} className="px-5 py-3 flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-semibold text-gray-800">{b.title}</p>
                      <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full inline-flex items-center gap-1', cls)}>
                        <Icon className="h-3 w-3" />{label}
                      </span>
                      {hhsOverdue && (
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                          HHS OVERDUE
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-400">
                      <span>Discovered: {b.discoveryDate || '—'}</span>
                      <span>{BREACH_TYPE_LABELS[b.breachType] || b.breachType}</span>
                      {b.individualsAffected != null && (
                        <span className={(b.individualsAffected >= 500) ? 'text-orange-600 font-medium' : ''}>
                          {b.individualsAffected.toLocaleString()} individuals
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs">
                      {b.hhsNotifiedDate ? (
                        <span className="text-green-600">✓ HHS notified {b.hhsNotifiedDate}</span>
                      ) : (
                        <span className={cn('font-medium', hhsOverdue ? 'text-red-600' : 'text-amber-600')}>
                          {hhsOverdue ? '⚠ HHS notification overdue' : '○ HHS notification pending'}
                        </span>
                      )}
                      {b.individualNotificationDate && (
                        <span className="text-green-600">✓ Individuals notified {b.individualNotificationDate}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => openEdit(b)} className="p-1.5 text-gray-400 hover:text-gray-700 rounded"><Pencil className="h-3.5 w-3.5" /></button>
                    <button onClick={() => remove.mutate(b.id)} className="p-1.5 text-gray-400 hover:text-red-600 rounded"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-base font-semibold text-gray-900">{editing ? 'Edit Breach Record' : 'Log Breach'}</h2>
              <button onClick={closeForm} className="text-gray-400 hover:text-gray-700"><X className="h-5 w-5" /></button>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">Incident Title *</label>
                <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                  value={form.title ?? ''} onChange={e => setForm((f: any) => ({ ...f, title: e.target.value }))}
                  placeholder="Brief description of the breach event" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-gray-700 mb-1 block">Discovery Date *</label>
                  <input type="date" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                    value={form.discoveryDate ?? ''} onChange={e => setForm((f: any) => ({ ...f, discoveryDate: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 mb-1 block">Occurrence Date</label>
                  <input type="date" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                    value={form.occurrenceDate ?? ''} onChange={e => setForm((f: any) => ({ ...f, occurrenceDate: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-gray-700 mb-1 block">Breach Type</label>
                  <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                    value={form.breachType ?? 'unauthorized_access'} onChange={e => setForm((f: any) => ({ ...f, breachType: e.target.value }))}>
                    {Object.entries(BREACH_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 mb-1 block">Individuals Affected</label>
                  <input type="number" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                    value={form.individualsAffected ?? ''} onChange={e => setForm((f: any) => ({ ...f, individualsAffected: parseInt(e.target.value) || null }))}
                    placeholder="Number of individuals" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">PHI Affected</label>
                <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                  value={form.phiAffected ?? ''} onChange={e => setForm((f: any) => ({ ...f, phiAffected: e.target.value }))}
                  placeholder="Types of PHI involved" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">Description</label>
                <textarea className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 resize-none" rows={3}
                  value={form.description ?? ''} onChange={e => setForm((f: any) => ({ ...f, description: e.target.value }))} />
              </div>

              <hr className="border-gray-100" />
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider">HHS Notification (§164.408)</p>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-gray-700 mb-1 block">HHS Notified Date</label>
                  <input type="date" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                    value={form.hhsNotifiedDate ?? ''} onChange={e => setForm((f: any) => ({ ...f, hhsNotifiedDate: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 mb-1 block">Individual Notification Date</label>
                  <input type="date" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                    value={form.individualNotificationDate ?? ''} onChange={e => setForm((f: any) => ({ ...f, individualNotificationDate: e.target.value }))} />
                </div>
              </div>
              <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                <input type="checkbox" className="accent-rose-600"
                  checked={form.mediaNotificationRequired ?? false} onChange={e => setForm((f: any) => ({ ...f, mediaNotificationRequired: e.target.checked }))} />
                Media notification required (≥500 individuals in a state/jurisdiction)
              </label>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-gray-700 mb-1 block">Safeguard Breached</label>
                  <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                    value={form.safeguardBreached ?? 'technical'} onChange={e => setForm((f: any) => ({ ...f, safeguardBreached: e.target.value }))}>
                    <option value="administrative">Administrative</option>
                    <option value="physical">Physical</option>
                    <option value="technical">Technical</option>
                    <option value="multiple">Multiple</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 mb-1 block">Status</label>
                  <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                    value={form.status ?? 'investigating'} onChange={e => setForm((f: any) => ({ ...f, status: e.target.value }))}>
                    <option value="investigating">Investigating</option>
                    <option value="contained">Contained</option>
                    <option value="notified">Notified</option>
                    <option value="closed">Closed</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">Corrective Actions</label>
                <textarea className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 resize-none" rows={2}
                  value={form.correctiveActions ?? ''} onChange={e => setForm((f: any) => ({ ...f, correctiveActions: e.target.value }))} />
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">
              <button onClick={closeForm} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">Cancel</button>
              <button
                onClick={() => save.mutate(form)}
                disabled={save.isPending || !form.title}
                className="px-4 py-2 text-sm bg-rose-600 text-white rounded-lg hover:bg-rose-700 disabled:opacity-50 transition-colors font-medium"
              >
                {save.isPending ? 'Saving…' : editing ? 'Update' : 'Log Breach'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
