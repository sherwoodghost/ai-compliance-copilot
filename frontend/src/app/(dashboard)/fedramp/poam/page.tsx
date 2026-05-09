'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import {
  AlertTriangle, Plus, Pencil, Trash2, X, ChevronDown, ChevronUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Types ─────────────────────────────────────────────────────────────────────

interface PoamItem {
  id: string;
  poamId: string;
  controlId: string;
  controlFamily: string;
  weakness: string;
  weaknessDescription: string;
  detectionDate: string;
  originalTargetDate: string;
  currentTargetDate: string;
  milestones: string;
  responsibleParty: string;
  resources: string;
  severity: 'critical' | 'high' | 'moderate' | 'low' | 'informational';
  status: 'open' | 'in_remediation' | 'delayed' | 'closed' | 'accepted_risk' | 'false_positive';
  remediationPlan: string;
  vendorDependency: boolean;
  vendorName?: string;
  comments: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function daysUntil(dateStr: string): number {
  if (!dateStr) return Infinity;
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86_400_000);
}

function severityColor(s: PoamItem['severity']) {
  const m: Record<string, string> = {
    critical:      'bg-red-100 text-red-700',
    high:          'bg-orange-100 text-orange-700',
    moderate:      'bg-amber-100 text-amber-700',
    low:           'bg-yellow-100 text-yellow-700',
    informational: 'bg-blue-100 text-blue-700',
  };
  return m[s] ?? 'bg-slate-100 text-slate-600';
}

function statusColor(s: PoamItem['status']) {
  const m: Record<string, string> = {
    open:           'bg-red-100 text-red-700',
    in_remediation: 'bg-blue-100 text-blue-700',
    delayed:        'bg-orange-100 text-orange-700',
    closed:         'bg-green-100 text-green-700',
    accepted_risk:  'bg-slate-100 text-slate-600',
    false_positive: 'bg-slate-100 text-slate-500',
  };
  return m[s] ?? 'bg-slate-100 text-slate-600';
}

function statusLabel(s: PoamItem['status']) {
  const m: Record<string, string> = {
    open: 'Open', in_remediation: 'In Remediation', delayed: 'Delayed',
    closed: 'Closed', accepted_risk: 'Accepted Risk', false_positive: 'False Positive',
  };
  return m[s] ?? s;
}

const CONTROL_FAMILIES = [
  'AC', 'AT', 'AU', 'CA', 'CM', 'CP', 'IA', 'IR', 'MA', 'MP',
  'PE', 'PL', 'PS', 'RA', 'SA', 'SC', 'SI',
];

const EMPTY: Partial<PoamItem> = {
  poamId: '', controlId: '', controlFamily: 'AC',
  weakness: '', weaknessDescription: '', detectionDate: '',
  originalTargetDate: '', currentTargetDate: '', milestones: '',
  responsibleParty: '', resources: '',
  severity: 'moderate', status: 'open',
  remediationPlan: '', vendorDependency: false,
  vendorName: '', comments: '',
};

// ── Main Component ────────────────────────────────────────────────────────────

export default function PoamPage() {
  const qc = useQueryClient();
  const [modal, setModal]       = useState<'create' | 'edit' | null>(null);
  const [form, setForm]         = useState<Partial<PoamItem>>(EMPTY);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [filterSeverity, setFilterSeverity] = useState('');

  const { data: items = [], isLoading } = useQuery<PoamItem[]>({
    queryKey: ['fedramp-poam'],
    queryFn: () => apiClient.get('/fedramp/poam').then(r => r.data),
  });

  const save = useMutation({
    mutationFn: (item: Partial<PoamItem>) =>
      item.id ? apiClient.put(`/fedramp/poam/${item.id}`, item).then(r => r.data)
              : apiClient.post('/fedramp/poam', item).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['fedramp-poam'] }); setModal(null); },
  });

  const remove = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/fedramp/poam/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fedramp-poam'] }),
  });

  const openItems    = items.filter(i => i.status !== 'closed' && i.status !== 'false_positive').length;
  const critical     = items.filter(i => i.severity === 'critical' && i.status !== 'closed').length;
  const delayed      = items.filter(i => i.currentTargetDate && daysUntil(i.currentTargetDate) < 0 && i.status !== 'closed').length;
  const vendorItems  = items.filter(i => i.vendorDependency && i.status !== 'closed').length;

  const filtered = filterSeverity ? items.filter(i => i.severity === filterSeverity) : items;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Plan of Action &amp; Milestones</h1>
          <p className="text-sm text-slate-500 mt-1">
            FedRAMP NIST SP 800-37 — POA&amp;M tracking for security weaknesses and remediation plans
          </p>
        </div>
        <button
          onClick={() => { setForm(EMPTY); setModal('create'); }}
          className="flex items-center gap-2 px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 text-sm font-medium"
        >
          <Plus className="w-4 h-4" /> Add POA&amp;M Item
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Open Items',       value: openItems,   color: 'text-sky-600' },
          { label: 'Critical',         value: critical,    color: 'text-red-600' },
          { label: 'Delayed',          value: delayed,     color: 'text-orange-600' },
          { label: 'Vendor Dependent', value: vendorItems, color: 'text-amber-600' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-xs text-slate-500 mb-1">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Alerts */}
      {critical > 0 && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-lg p-4 text-red-800 text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span><strong>{critical} critical POA&amp;M item{critical > 1 ? 's' : ''}</strong> require immediate attention — report to AO within required timeframe.</span>
        </div>
      )}
      {delayed > 0 && (
        <div className="flex items-center gap-3 bg-orange-50 border border-orange-200 rounded-lg p-4 text-orange-800 text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span><strong>{delayed} item{delayed > 1 ? 's' : ''}</strong> past remediation target date — update milestones and notify authorizing official.</span>
        </div>
      )}

      {/* Severity Filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm text-slate-600">Severity:</span>
        {['', 'critical', 'high', 'moderate', 'low', 'informational'].map(sv => (
          <button key={sv} onClick={() => setFilterSeverity(sv)}
            className={cn('text-xs px-3 py-1.5 rounded-full border transition-colors',
              filterSeverity === sv
                ? 'bg-sky-600 text-white border-sky-600'
                : 'border-slate-200 text-slate-600 hover:border-sky-400')}>
            {sv === '' ? `All (${items.length})` : `${sv.charAt(0).toUpperCase() + sv.slice(1)} (${items.filter(i => i.severity === sv).length})`}
          </button>
        ))}
      </div>

      {/* POA&M List */}
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-sky-600" />
          <span className="font-semibold text-slate-800 text-sm">POA&amp;M Items ({filtered.length})</span>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-slate-400 text-sm">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">No POA&amp;M items — add one when a security weakness is identified.</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filtered.map(item => {
              const isOpen = expanded === item.id;
              const days = item.currentTargetDate ? daysUntil(item.currentTargetDate) : null;
              return (
                <div key={item.id}>
                  <div className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50">
                    <button className="text-slate-400 hover:text-slate-600" onClick={() => setExpanded(isOpen ? null : item.id)}>
                      {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {item.poamId && (
                          <span className="text-xs font-mono bg-sky-50 text-sky-700 px-2 py-0.5 rounded">{item.poamId}</span>
                        )}
                        <span className="font-medium text-sm text-slate-900">{item.weakness}</span>
                        <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', severityColor(item.severity))}>
                          {item.severity.toUpperCase()}
                        </span>
                        <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', statusColor(item.status))}>
                          {statusLabel(item.status)}
                        </span>
                        {item.vendorDependency && (
                          <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">Vendor</span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-xs text-slate-500">
                        <span>{item.controlId} ({item.controlFamily})</span>
                        {item.responsibleParty && <span>{item.responsibleParty}</span>}
                        {days !== null && (
                          <span className={cn(days < 0 ? 'text-red-600 font-medium' : days <= 30 ? 'text-amber-600' : '')}>
                            Target: {item.currentTargetDate}
                            {days < 0 ? ` (${Math.abs(days)}d overdue)` : days <= 30 ? ` (${days}d)` : ''}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => { setForm(item); setModal('edit'); }} className="p-1.5 text-slate-400 hover:text-sky-600">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => remove.mutate(item.id)} className="p-1.5 text-slate-400 hover:text-red-600">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {isOpen && (
                    <div className="px-10 pb-4 bg-slate-50 space-y-2 text-sm">
                      {item.weaknessDescription && (
                        <div>
                          <span className="text-slate-500">Weakness Description: </span>
                          <span>{item.weaknessDescription}</span>
                        </div>
                      )}
                      {item.remediationPlan && (
                        <div>
                          <span className="text-slate-500">Remediation Plan: </span>
                          <span>{item.remediationPlan}</span>
                        </div>
                      )}
                      {item.milestones && (
                        <div>
                          <span className="text-slate-500">Milestones: </span>
                          <span>{item.milestones}</span>
                        </div>
                      )}
                      <div className="grid grid-cols-3 gap-3">
                        <div><span className="text-slate-500">Detected: </span><span className="font-medium">{item.detectionDate || '—'}</span></div>
                        <div><span className="text-slate-500">Original Target: </span><span className="font-medium">{item.originalTargetDate || '—'}</span></div>
                        {item.resources && <div><span className="text-slate-500">Resources: </span><span>{item.resources}</span></div>}
                        {item.vendorName && <div><span className="text-slate-500">Vendor: </span><span className="font-medium">{item.vendorName}</span></div>}
                      </div>
                      {item.comments && (
                        <div><span className="text-slate-500">Comments: </span><span>{item.comments}</span></div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="font-semibold text-slate-900">{modal === 'create' ? 'Add POA&M Item' : 'Edit POA&M Item'}</h2>
              <button onClick={() => setModal(null)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">POA&M ID</label>
                <input value={form.poamId ?? ''} onChange={e => setForm((f: any) => ({ ...f, poamId: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="POAM-001" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Control ID *</label>
                <input value={form.controlId ?? ''} onChange={e => setForm((f: any) => ({ ...f, controlId: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="AC-2" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Control Family</label>
                <select value={form.controlFamily ?? 'AC'} onChange={e => setForm((f: any) => ({ ...f, controlFamily: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                  {CONTROL_FAMILIES.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Weakness / Finding Title *</label>
                <input value={form.weakness ?? ''} onChange={e => setForm((f: any) => ({ ...f, weakness: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="Missing MFA on privileged accounts" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Severity</label>
                <select value={form.severity ?? 'moderate'} onChange={e => setForm((f: any) => ({ ...f, severity: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                  <option value="critical">Critical</option>
                  <option value="high">High</option>
                  <option value="moderate">Moderate</option>
                  <option value="low">Low</option>
                  <option value="informational">Informational</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Status</label>
                <select value={form.status ?? 'open'} onChange={e => setForm((f: any) => ({ ...f, status: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                  <option value="open">Open</option>
                  <option value="in_remediation">In Remediation</option>
                  <option value="delayed">Delayed</option>
                  <option value="closed">Closed</option>
                  <option value="accepted_risk">Accepted Risk</option>
                  <option value="false_positive">False Positive</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Responsible Party</label>
                <input value={form.responsibleParty ?? ''} onChange={e => setForm((f: any) => ({ ...f, responsibleParty: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="IT Security Team" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Detection Date</label>
                <input type="date" value={form.detectionDate ?? ''} onChange={e => setForm((f: any) => ({ ...f, detectionDate: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Original Target Date</label>
                <input type="date" value={form.originalTargetDate ?? ''} onChange={e => setForm((f: any) => ({ ...f, originalTargetDate: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Current Target Date</label>
                <input type="date" value={form.currentTargetDate ?? ''} onChange={e => setForm((f: any) => ({ ...f, currentTargetDate: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-slate-600 mb-1">Weakness Description</label>
                <textarea rows={2} value={form.weaknessDescription ?? ''} onChange={e => setForm((f: any) => ({ ...f, weaknessDescription: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm resize-none" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-slate-600 mb-1">Remediation Plan</label>
                <textarea rows={2} value={form.remediationPlan ?? ''} onChange={e => setForm((f: any) => ({ ...f, remediationPlan: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm resize-none" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-slate-600 mb-1">Milestones</label>
                <textarea rows={2} value={form.milestones ?? ''} onChange={e => setForm((f: any) => ({ ...f, milestones: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm resize-none"
                  placeholder="M1: Identify accounts (30d), M2: Enable MFA (60d), M3: Verify (90d)" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Resources Required</label>
                <input value={form.resources ?? ''} onChange={e => setForm((f: any) => ({ ...f, resources: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="2 FTE, MFA license" />
              </div>
              <div className="flex items-end gap-2 pb-1">
                <input type="checkbox" id="vendor" checked={!!form.vendorDependency} onChange={e => setForm((f: any) => ({ ...f, vendorDependency: e.target.checked }))}
                  className="rounded border-slate-300" />
                <label htmlFor="vendor" className="text-sm text-slate-700">Vendor dependency</label>
              </div>
              {form.vendorDependency && (
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-slate-600 mb-1">Vendor Name</label>
                  <input value={form.vendorName ?? ''} onChange={e => setForm((f: any) => ({ ...f, vendorName: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
                </div>
              )}
              <div className="col-span-2">
                <label className="block text-xs font-medium text-slate-600 mb-1">Comments</label>
                <textarea rows={2} value={form.comments ?? ''} onChange={e => setForm((f: any) => ({ ...f, comments: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm resize-none" />
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100">
              <button onClick={() => setModal(null)} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900">Cancel</button>
              <button onClick={() => save.mutate(form)} disabled={save.isPending}
                className="px-5 py-2 bg-sky-600 text-white rounded-lg text-sm font-medium hover:bg-sky-700 disabled:opacity-50">
                {save.isPending ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
